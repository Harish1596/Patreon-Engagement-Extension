const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../../extension/background/media.js"), "utf8");
const cryptoSource = fs.readFileSync(path.resolve(__dirname, "../../extension/background/disk-crypto.js"), "utf8");
const cacheSource = fs.readFileSync(path.resolve(__dirname, "../../extension/background/post-cache.js"), "utf8");

test("retention sweep deletes expired source files and metadata without another export request", async () => {
  const { send, disk, sessionStore, retention, advanceTime } = backgroundHarness();
  const token = "88888888-8888-4888-8888-888888888888";
  await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: ["https://www.patreon.com/posts/101"] });
  await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "snapshot", index: 0 });
  assert.equal(disk.size, 1);
  advanceTime(121);
  await retention.sweep();
  assert.equal(disk.size, 0);
  assert.equal(Object.keys(sessionStore).filter(key => key.startsWith("collection-export:")).length, 0);
});

test("collection source hits survive worker restart without reopening posts and are cleared with their owner", async () => {
  const { calls, send, restart, disk, sender, closeTab } = backgroundHarness();
  const token = "77777777-7777-4777-8777-777777777777";
  await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: ["https://www.patreon.com/posts/101"] });
  const first = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "snapshot", index: 0, operationId: "first-attempt" });
  assert.equal(first.files[0].extension, "snapshot");
  assert.equal(first.files[0].cached, false);
  assert.equal(disk.size, 1);
  await send({ type: "FINISH_COLLECTION_EXPORT", token });
  const created = calls.create.length;
  restart();
  const cached = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "snapshot", index: 0, operationId: "second-attempt" });
  assert.equal(cached.files[0].cached, true);
  const message = calls.progress.findLast(item => item.phase === "build");
  assert.equal(message.operationId, "second-attempt");
  assert.equal(message.title, "Post 101");
  assert.equal(message.cached, true);
  assert.equal(cached.files[0].length, first.files[0].length);
  assert.equal(calls.create.length, created);
  assert.ok((await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "snapshot", index: 0 },
    { ...sender, tab: { ...sender.tab, id: 42 } })).error);
  const chunk = await send({ type: "GET_COLLECTION_EXPORT_CHUNK", token, index: 0, offset: 0 });
  assert.ok(chunk.data.length <= 1024 * 1024);
  await closeTab(sender.tab.id);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(disk.size, 0);
});

test("indexed chapter failure keeps the session retryable across worker restart", async () => {
  let fail = true;
  const { send, calls, restart } = backgroundHarness({ fastTimers: true, failBuild: id => fail && id === "102" });
  const token = "11111111-1111-4111-8111-111111111111";
  await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: [101, 102].map(id => `https://www.patreon.com/posts/${id}`) });
  assert.match((await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown", index: -1 })).error, /index/);
  const first = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown", index: 0 });
  assert.equal(first.files.length, 1);
  assert.equal(first.files[0].title, "Post 101");
  const failed = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown", index: 1 });
  assert.match(failed.error, /Synthetic build failure/);
  assert.equal(calls.remove.length, calls.create.length);
  assert.equal((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).count, 2);
  restart();
  fail = false;
  const recovered = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown", index: 1 });
  assert.equal(recovered.files[0].title, "Post 102");
  const chunk = await send({ type: "GET_COLLECTION_EXPORT_CHUNK", token, index: 1, offset: 0 });
  assert.equal(chunk.data, "102");
  assert.equal(chunk.done, true);
  assert.equal(calls.remove.length, calls.create.length);
});

function backgroundHarness({ delayedNavigation = false, navigationReplies = 2, fastTimers = false, fetchMedia, failDescribe = () => false, failBuild = () => false } = {}) {
  let listener;
  let removedListener;
  let nextTabId = 10;
  let nextTransferId = 1;
  let elapsed = 0;
  const tabUrls = new Map();
  const pendingUrls = new Map();
  const transfers = new Map();
  const sessionStore = {};
  const retentionServices = [];
  const retention = { register: service => retentionServices.push(service), changed() {}, wait: async () => {}, isClosed: () => false,
    sweep: async () => { await Promise.all(retentionServices.map(service => service.ready)); for (const service of retentionServices) await service.sweep(); },
    clear: async () => { await Promise.all(retentionServices.map(service => service.ready)); for (const service of retentionServices) await service.clear(); } };
  const disk = new Map();
  const cache = {
    async keys() { return [...disk.keys()].map(url => ({ url })); },
    async match(request) { return disk.get(request.url || request)?.clone(); },
    async delete(request) { return disk.delete(request.url || request); },
    async put(request, response) { disk.set(request.url || request, response.clone()); }
  };
  const holds = new Map();
  function hold(type) {
    let enter;
    let release;
    const entered = new Promise(resolve => { enter = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    holds.set(type, { enter, gate });
    return { entered, release };
  }
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
        if (holds.has("create")) {
          const held = holds.get("create"); holds.delete("create");
          held.enter(tab.id); await held.gate;
        }
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
        if (holds.has(message.type)) {
          const held = holds.get(message.type); holds.delete(message.type);
          held.enter({ tabId, message }); await held.gate;
        }
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
          if (failDescribe(id)) return { error: "This post does not expose a supported text body. https://media.example/private?signature=secret" };
          return { post: { title: `Post ${id}`, origins: [], postId: id } };
        }
        if (message.type === "BUILD_POST_EXPORT") {
          if (failBuild(id)) return { error: "Synthetic build failure." };
          let data = id === "101" ? "x".repeat(2 * 1024 * 1024 + 17) : id;
          if (message.format === "snapshot") data = JSON.stringify({ version: 1, postId: id, assets: [], body: data });
          transfers.set(message.transferId, data);
          return { file: { title: `Post ${id}`, extension: message.format === "snapshot" ? "snapshot" : "md", encoding: "text", length: data.length, postId: id } };
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
    permissions: { async contains() { return true; } },
    storage: { session: {
      async get() { return structuredClone(sessionStore); },
      async set(values) { Object.assign(sessionStore, structuredClone(values)); },
      async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete sessionStore[key]; }
    } }
  };
  const restart = () => vm.runInNewContext(cryptoSource + "\n" + cacheSource + "\n" + source, {
    browser, URL, Map, Set, Promise, Uint8Array, AbortController,
    TextEncoder, TextDecoder, importScripts() {}, caches: { async open() { return cache; } }, Blob, Response,
    PatreonArchives: { install() {} },
    PatreonExportRetention: { create: () => retention },
    Date: class extends Date { static now() { return Date.now() + elapsed; } }, Error, Array,
    crypto: { subtle: require("node:crypto").webcrypto.subtle, getRandomValues: bytes => require("node:crypto").webcrypto.getRandomValues(bytes), randomUUID: () => `00000000-0000-4000-8000-${String(nextTransferId++).padStart(12, "0")}` },
    setTimeout: fastTimers ? callback => setTimeout(callback, 0) : setTimeout,
    clearTimeout, fetch: fetchMedia || (async () => { throw new Error("Unexpected fetch"); }),
    btoa: value => Buffer.from(value, "binary").toString("base64")
  });
  restart();
  const sender = {
    id: browser.runtime.id,
    tab: { id: 1, windowId: 2, url: "https://www.patreon.com/collection/500" }
  };
  const send = (message, owner = sender) => new Promise((resolve, reject) => {
    try {
      const result = listener(message, owner, resolve);
      if (result !== true && result !== undefined) resolve(result);
    } catch (error) { reject(error); }
  });
  return { calls, send, restart, sessionStore, sender, hold, disk, retention, closeTab: id => browser.tabs.remove(id),
    advanceTime: minutes => { elapsed += minutes * 60_000; } };
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

test("prepared collection survives worker restarts without repeating preflight or persisting file data", async () => {
  const { calls, send, restart, sessionStore, sender, advanceTime } = backgroundHarness();
  const token = "55555555-5555-4555-8555-555555555555";
  const urls = [101, 102].map(id => `https://www.patreon.com/posts/${id}`);
  assert.equal((await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls })).count, 2);
  const [record] = Object.values(sessionStore);
  assert.equal(record.posts.length, 2);
  assert.equal(record.files, undefined);
  assert.equal(record.workerTabId, undefined);
  advanceTime(5);
  restart();
  assert.equal((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).count, 2);
  assert.ok((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token }, {
    ...sender, tab: { ...sender.tab, id: 2 }
  })).error);
  assert.equal(Object.keys(sessionStore).filter(key => key.startsWith("collection-export:")).length, 1);
  const built = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown" });
  assert.deepEqual(Array.from(built.files, file => file.title), ["Post 101", "Post 102"]);
  assert.equal(calls.progress.filter(item => item.phase === "prepare").length, 3);
  assert.equal(Object.values(sessionStore)[0].files, undefined);
  assert.equal((await send({ type: "FINISH_COLLECTION_EXPORT", token })).finished, true);
  restart();
  assert.equal((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).count, 2);
  await send({ type: "CANCEL_COLLECTION_EXPORT", token });
  assert.equal(Object.keys(sessionStore).filter(key => key.startsWith("collection-export:")).length, 0);
  restart();
  assert.ok((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).error);
});

test("worker startup removes expired persisted collections", async () => {
  const { send, restart, sessionStore, advanceTime } = backgroundHarness();
  const token = "66666666-6666-4666-8666-666666666666";
  await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: ["https://www.patreon.com/posts/101"] });
  advanceTime(121);
  restart();
  assert.ok((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).error);
  assert.equal(Object.keys(sessionStore).filter(key => key.startsWith("collection-export:")).length, 0);
});

test("closing the owner tab removes its session even while the restarted worker is restoring", async () => {
  const { send, restart, sessionStore, closeTab } = backgroundHarness();
  const token = "77777777-7777-4777-8777-777777777777";
  await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: ["https://www.patreon.com/posts/101"] });
  restart();
  await closeTab(1);
  await new Promise(setImmediate);
  assert.equal(Object.keys(sessionStore).filter(key => key.startsWith("collection-export:")).length, 0);
  restart();
  assert.ok((await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token })).error);
});

test("cancelling preflight closes its worker before a stalled response and ignores late replies", async () => {
  const { calls, send, hold, sessionStore, sender } = backgroundHarness();
  const stalled = hold("DESCRIBE_POST_EXPORT");
  const token = "88888888-8888-4888-8888-888888888888";
  const prepared = send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: ["https://www.patreon.com/posts/101"] });
  const { tabId } = await stalled.entered;
  assert.ok((await send({ type: "CANCEL_COLLECTION_EXPORT", token }, { ...sender, tab: { ...sender.tab, id: 2 } })).error);
  assert.equal((await send({ type: "CANCEL_COLLECTION_EXPORT", token })).cancelled, true);
  assert.ok(calls.remove.includes(tabId));
  assert.match((await prepared).error, /cancelled/);
  stalled.release();
  await new Promise(setImmediate);
  assert.equal(Object.keys(sessionStore).filter(key => key.startsWith("collection-export:")).length, 0);
  assert.equal(calls.create.length, 1);
});

test("cancelling a build aborts media and closes the worker without waiting for generation", async () => {
  let mediaSignal;
  let mediaStarted;
  const started = new Promise(resolve => { mediaStarted = resolve; });
  const { calls, send, hold, sessionStore, sender } = backgroundHarness({ fetchMedia: (url, options) => new Promise((resolve, reject) => {
    mediaSignal = options.signal;
    mediaStarted();
    options.signal.addEventListener("abort", () => reject(new Error("Media cancelled")), { once: true });
  }) });
  const token = "99999999-9999-4999-8999-999999999999";
  await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: ["https://www.patreon.com/posts/101"] });
  const stalled = hold("BUILD_POST_EXPORT");
  const built = send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown" });
  const { tabId, message } = await stalled.entered;
  const media = send({ type: "FETCH_POST_EXPORT_IMAGE", url: "https://media.example/image.png", transferId: message.transferId }, {
    ...sender, tab: { ...sender.tab, id: tabId, url: "https://www.patreon.com/posts/101" }
  });
  await started;
  assert.equal((await send({ type: "CANCEL_COLLECTION_EXPORT", token })).cancelled, true);
  assert.ok(mediaSignal.aborted);
  assert.match((await send({ type: "FETCH_POST_EXPORT_IMAGE", url: "https://media.example/image.png", transferId: message.transferId }, {
    ...sender, tab: { ...sender.tab, id: tabId, url: "https://www.patreon.com/posts/101" }
  })).error, /cancelled/);
  assert.match((await media).error, /cancelled/i);
  assert.match((await built).error, /cancelled/);
  assert.ok(calls.remove.includes(tabId));
  stalled.release();
  await new Promise(setImmediate);
  assert.equal(Object.keys(sessionStore).filter(key => key.startsWith("collection-export:")).length, 0);
});

test("a worker created after cancellation is immediately closed", async () => {
  const { send, hold, calls } = backgroundHarness();
  const stalled = hold("create");
  const token = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const prepared = send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: ["https://www.patreon.com/posts/101"] });
  const tabId = await stalled.entered;
  await send({ type: "CANCEL_COLLECTION_EXPORT", token });
  stalled.release();
  assert.match((await prepared).error, /cancelled/);
  assert.ok(calls.remove.includes(tabId));
  assert.equal(calls.create.length, 1);
});


test("image streams stop at the byte budget, cancel their reader, and never buffer the whole response", async () => {
  let reads = 0, cancelled = false, wholeRead = false;
  const { send } = backgroundHarness({ fetchMedia: async (_url, options) => {
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    return { ok: true, headers: { get: name => name === "content-type" ? "image/png" : null },
      arrayBuffer() { wholeRead = true; throw Error("Whole body read"); },
      body: { getReader: () => ({
        async read() { reads++; return { value: new Uint8Array(3), done: false }; },
        async cancel() { cancelled = true; }, releaseLock() {}
      }) }
    };
  } });
  const result = await send({ type: "FETCH_POST_EXPORT_IMAGE", url: "https://media.example/image.png", maxBytes: 4 });
  assert.match(result.error, /too large/);
  assert.equal(reads, 2);
  assert.ok(cancelled);
  assert.equal(wholeRead, false);
});

test("image streams return exact bytes below budget and cap simultaneous network requests", async () => {
  let active = 0, maximum = 0;
  const releases = [];
  const { send } = backgroundHarness({ fetchMedia: async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => releases.push(resolve));
    let done = false;
    return { ok: true, headers: { get: name => name === "content-type" ? "image/png" : null },
      body: { getReader: () => ({ async read() {
        if (done) return { done: true };
        done = true; return { value: new Uint8Array([1, 2, 3]), done: false };
      }, async cancel() { active--; }, releaseLock() {} }) }
    };
  } });
  const requests = Array.from({ length: 4 }, () => send({ type: "FETCH_POST_EXPORT_IMAGE", url: "https://media.example/image.png", maxBytes: 3 }));
  await new Promise(setImmediate);
  assert.equal(releases.length, 2);
  releases.splice(0).forEach(release => release());
  await new Promise(setImmediate);
  releases.splice(0).forEach(release => release());
  const replies = await Promise.all(requests);
  assert.equal(maximum, 2);
  assert.ok(replies.every(reply => reply.dataUrl === "data:image/png;base64,AQID"));
});


test("image requests time out and abort stalled network work", async () => {
  let signal;
  const { send } = backgroundHarness({ fastTimers: true, fetchMedia: async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  } });
  const result = await send({ type: "FETCH_POST_EXPORT_IMAGE", url: "https://media.example/stalled.png" });
  assert.match(result.error, /timed out/);
  assert.ok(signal.aborted);
});


test("preparation reports per-post skips after restart without retaining signed failure URLs", async () => {
  const { send, restart, sessionStore } = backgroundHarness({ failDescribe: id => id === "102", fastTimers: true });
  const token = "abababab-abab-4bab-8bab-abababababab";
  const prepared = await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls: [101, 102].map(id => `https://www.patreon.com/posts/${id}`) });
  assert.equal(prepared.count, 1); assert.equal(prepared.skippedPosts.length, 1);
  assert.equal(prepared.skippedPosts[0].url, "https://www.patreon.com/posts/102");
  assert.match(prepared.skippedPosts[0].reason, /supported text body/);
  assert.equal(JSON.stringify(sessionStore).includes("signature=secret"), false);
  restart();
  const restored = await send({ type: "GET_COLLECTION_EXPORT_REQUEST", token });
  assert.equal(restored.skippedPosts[0].reason, prepared.skippedPosts[0].reason);
});

test("an entirely unsupported collection returns individual skip details without leaving a session", async () => {
  const { send, sessionStore } = backgroundHarness({ failDescribe: () => true, fastTimers: true });
  const result = await send({ type: "PREPARE_COLLECTION_EXPORT", token: "abababab-abab-4bab-8bab-abababababab", urls: ["https://www.patreon.com/posts/101"] });
  assert.match(result.error, /No accessible text posts/);
  assert.equal(result.skippedPosts.length, 1);
  assert.equal(Object.keys(sessionStore).filter(key => key.startsWith("collection-export:")).length, 0);
});
