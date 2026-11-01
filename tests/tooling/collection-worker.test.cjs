const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../../extension/background/media.js"), "utf8");

function backgroundHarness({ delayedNavigation = false, navigationReplies = 2, fastTimers = false } = {}) {
  let listener;
  let removedListener;
  let nextTabId = 10;
  let nextTransferId = 1;
  let elapsed = 0;
  const tabUrls = new Map();
  const pendingUrls = new Map();
  const transfers = new Map();
  const calls = { create: [], update: [], remove: [], workerChunks: [], progress: [], staleReplies: 0 };
  const browser = {
    runtime: {
      id: "fixture-extension",
      onMessage: { addListener(value) { listener = value; } }
    },
    tabs: {
      async create(options) {
        const tab = { id: nextTabId++ };
        calls.create.push({ ...options, id: tab.id });
        tabUrls.set(tab.id, options.url);
        return tab;
      },
      async update(tabId, options) {
        calls.update.push({ tabId, ...options });
        if (options.url) {
          if (delayedNavigation) pendingUrls.set(tabId, { url: options.url, attempts: navigationReplies });
          else tabUrls.set(tabId, options.url);
        }
        return { id: tabId };
      },
      async sendMessage(tabId, message) {
        if (message.type === "COLLECTION_EXPORT_PROGRESS") {
          calls.progress.push(message);
          return { reported: true };
        }
        const pending = pendingUrls.get(tabId);
        if (pending && ["DESCRIBE_POST_EXPORT", "BUILD_POST_EXPORT"].includes(message.type)) {
          if (pending.attempts-- > 0) calls.staleReplies++;
          else { tabUrls.set(tabId, pending.url); pendingUrls.delete(tabId); }
        }
        const url = tabUrls.get(tabId) || "https://www.patreon.com/posts/open-999";
        const id = new URL(url).pathname.split("/").pop();
        if (message.type === "DESCRIBE_POST_EXPORT") {
          return { post: { title: `Post ${id}`, origins: [], postId: id } };
        }
        if (message.type === "BUILD_POST_EXPORT") {
          const data = id === "101" ? "x".repeat(2 * 1024 * 1024 + 17) : id;
          transfers.set(message.transferId, data);
          return { file: { title: `Post ${id}`, extension: "md", encoding: "text", length: data.length, postId: id } };
        }
        if (message.type === "GET_POST_EXPORT_CHUNK") {
          const source = transfers.get(message.transferId);
          const data = source.slice(message.offset, message.offset + 1024 * 1024);
          calls.workerChunks.push(data.length);
          return { data, done: message.offset + data.length === source.length };
        }
        if (message.type === "RELEASE_POST_EXPORT") {
          transfers.delete(message.transferId);
          return { released: true };
        }
        return { delivered: true };
      },
      async remove(tabIds) {
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
        calls.remove.push(...ids);
        for (const id of ids) {
          tabUrls.delete(id);
          removedListener?.(id);
        }
      },
      onRemoved: { addListener(value) { removedListener = value; } }
    },
    permissions: { async contains() { return true; } }
  };
  vm.runInNewContext(source, {
    browser, URL, Map, Set, Promise, Uint8Array,
    Date: class extends Date { static now() { return Date.now() + elapsed; } }, Error, Array,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(nextTransferId++).padStart(12, "0")}` },
    setTimeout: fastTimers ? callback => setTimeout(callback, 0) : setTimeout,
    clearTimeout, fetch: async () => { throw new Error("Unexpected fetch"); },
    btoa: value => Buffer.from(value, "binary").toString("base64")
  });
  const sender = {
    id: browser.runtime.id,
    tab: { id: 1, windowId: 2, url: "https://www.patreon.com/collection/500" }
  };
  const send = message => new Promise((resolve, reject) => {
    try {
      const result = listener(message, sender, resolve);
      if (result !== true && result !== undefined) resolve(result);
    } catch (error) { reject(error); }
  });
  return { calls, send, advanceTime: minutes => { elapsed += minutes * 60_000; } };
}

test("collection export chunks payloads and closes each phase's reusable worker", async () => {
  const { calls, send, advanceTime } = backgroundHarness();
  const token = "11111111-1111-4111-8111-111111111111";
  const urls = [101, 102, 103].map(id => `https://www.patreon.com/posts/${id}`);

  const prepared = await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls });
  assert.equal(prepared.count, 3);
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.update.map(call => call.url), urls.slice(1));
  assert.deepEqual(calls.remove, [calls.create[0].id]);
  assert.deepEqual(calls.progress.filter(item => item.phase === "prepare").map(item => item.current), [0, 1, 2, 3]);
  advanceTime(119);
  assert.equal((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).count, 3);

  const built = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown" });
  assert.equal(built.files.length, 3);
  assert.equal(built.files[0].data, undefined);
  assert.equal(built.files[0].length, 2 * 1024 * 1024 + 17);
  let received = "";
  while (received.length < built.files[0].length) {
    const chunk = await send({
      type: "GET_COLLECTION_EXPORT_CHUNK", token, index: 0, offset: received.length
    });
    assert.ok(chunk.data.length <= 1024 * 1024);
    received += chunk.data;
  }
  assert.equal(received.length, built.files[0].length);
  assert.ok(calls.workerChunks.every(length => length <= 1024 * 1024));
  assert.deepEqual(calls.progress.filter(item => item.phase === "build").map(item => item.current), [0, 1, 2, 3]);
  assert.equal(calls.create.length, 2);
  assert.deepEqual(calls.update.map(call => call.url), [...urls.slice(1), ...urls.slice(1)]);
  assert.deepEqual(calls.remove, calls.create.map(call => call.id));
  assert.equal((await send({ type: "FINISH_COLLECTION_EXPORT", token })).finished, true);
  assert.equal((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).count, 3);
  assert.ok((await send({ type: "GET_COLLECTION_EXPORT_CHUNK", token, index: 1, offset: 0 })).error);
  const rebuilt = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown" });
  assert.equal(rebuilt.files.length, 3);
  assert.equal(calls.progress.filter(item => item.phase === "prepare").length, 4);
  assert.deepEqual(calls.remove, calls.create.map(call => call.id));
  await send({ type: "CANCEL_COLLECTION_EXPORT", token });
  assert.ok((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).error);
});

test("slow collection preparation and generation never activate worker or owner tabs", async () => {
  const { calls, send } = backgroundHarness({ delayedNavigation: true, navigationReplies: 10, fastTimers: true });
  const token = "33333333-3333-4333-8333-333333333333";
  const urls = [101, 102].map(id => `https://www.patreon.com/posts/${id}`);
  assert.equal((await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls })).count, 2);
  const built = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown" });
  assert.deepEqual(Array.from(built.files, file => file.title), ["Post 101", "Post 102"]);
  assert.equal(calls.staleReplies, 20);
  assert.ok(calls.create.every(call => call.active === false));
  assert.ok(calls.update.every(call => call.active === false && call.tabId !== 1));
  assert.deepEqual(calls.remove, calls.create.map(call => call.id));
});

test("a collection readiness timeout reports a skip without stealing focus", async () => {
  const { calls, send } = backgroundHarness({ delayedNavigation: true, navigationReplies: 70, fastTimers: true });
  const token = "44444444-4444-4444-8444-444444444444";
  const urls = [101, 102].map(id => `https://www.patreon.com/posts/${id}`);
  const prepared = await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls });
  assert.equal(prepared.count, 1);
  assert.equal(prepared.skipped, 1);
  assert.ok(calls.update.every(call => call.active === false && call.tabId !== 1));
  assert.deepEqual(calls.remove, calls.create.map(call => call.id));
});

test("collection worker rejects successful old-document replies until each destination loads", async () => {
  const { calls, send, advanceTime } = backgroundHarness({ delayedNavigation: true });
  const token = "22222222-2222-4222-8222-222222222222";
  const urls = [101, 102, 103].map(id => `https://www.patreon.com/posts/${id}`);
  assert.equal((await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls })).count, 3);
  const built = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown" });
  assert.deepEqual(Array.from(built.files, file => file.title), ["Post 101", "Post 102", "Post 103"]);
  for (const index of [1, 2]) {
    const chunk = await send({ type: "GET_COLLECTION_EXPORT_CHUNK", token, index, offset: 0 });
    assert.equal(chunk.data, String(101 + index));
  }
  assert.equal(calls.staleReplies, 8);
  assert.equal((await send({ type: "FINISH_COLLECTION_EXPORT", token })).finished, true);
  assert.deepEqual(calls.remove, calls.create.map(call => call.id));
  advanceTime(121);
  assert.ok((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).error);
});
