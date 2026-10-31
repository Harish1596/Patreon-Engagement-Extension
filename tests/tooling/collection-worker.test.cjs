const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../../extension/background/media.js"), "utf8");

function backgroundHarness() {
  let listener;
  let removedListener;
  let nextTabId = 10;
  const tabUrls = new Map();
  const calls = { create: [], update: [], remove: [] };
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
        if (options.url) tabUrls.set(tabId, options.url);
        return { id: tabId };
      },
      async sendMessage(tabId, message) {
        const url = tabUrls.get(tabId) || "https://www.patreon.com/posts/open-999";
        const id = new URL(url).pathname.split("/").pop();
        if (message.type === "DESCRIBE_POST_EXPORT") {
          return { post: { title: `Post ${id}`, origins: [] } };
        }
        if (message.type === "BUILD_POST_EXPORT") {
          return { file: { title: `Post ${id}`, extension: "md", encoding: "text", data: id } };
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
    browser, URL, Map, Set, Promise, Uint8Array, Date, Error, Array,
    setTimeout, clearTimeout, fetch: async () => { throw new Error("Unexpected fetch"); },
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
  return { calls, send };
}

test("collection export navigates one temporary worker tab across every unopened post", async () => {
  const { calls, send } = backgroundHarness();
  const token = "11111111-1111-4111-8111-111111111111";
  const urls = [101, 102, 103].map(id => `https://www.patreon.com/posts/${id}`);

  const prepared = await send({ type: "PREPARE_COLLECTION_EXPORT", token, urls });
  assert.equal(prepared.count, 3);
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.update.map(call => call.url), urls.slice(1));
  assert.deepEqual(calls.remove, []);

  const built = await send({ type: "BUILD_COLLECTION_EXPORT", token, format: "markdown" });
  assert.equal(built.files.length, 3);
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.update.map(call => call.url), [...urls.slice(1), ...urls]);
  assert.deepEqual(calls.remove, [calls.create[0].id]);
});
