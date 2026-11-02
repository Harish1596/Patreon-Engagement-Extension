const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.resolve(__dirname, "../../extension/background/post-cache.js"), "utf8");

function fixture(options = {}) {
  const records = new Map();
  let clock = 0;
  const cache = {
    async keys() { return [...records.keys()].map(url => ({ url })); },
    async match(key) { return records.get(key.url || key)?.clone(); },
    async delete(key) { return records.delete(key.url || key); },
    async put(key, response) { records.set(key, response.clone()); }
  };
  const scope = { Blob, Response, URL };
  vm.runInNewContext(source, scope);
  return { records, cache, clock: value => { clock = value; },
    create: (extra = {}) => scope.PatreonPostCache.create({ storage: { async open() { return cache; } }, now: () => clock, ...options, ...extra }) };
}

const file = (id = "1") => ({ title: `Chapter ${id}`, extension: "snapshot", encoding: "text",
  data: JSON.stringify({ version: 1, postId: id, assets: [], body: "A synthetic chapter." }) });

test("source cache enforces a shared byte budget and fixed two-hour expiry", async () => {
  const one = file();
  const { create, clock, records } = fixture({ maxBytes: new Blob([one.data]).size * 2 });
  const cache = create();
  assert.equal(await cache.put("a", "1", one), true);
  await cache.put("a", "2", file("2"));
  assert.equal(await cache.put("a", "3", file("3")), false);
  assert.ok(await cache.get("a", "1"));
  await cache.put("b", "3", file("3"));
  assert.equal(await cache.get("a", "1"), null);
  assert.equal((await cache.get("a", "2")).data, file("2").data);
  clock(119 * 60_000);
  assert.ok(await cache.get("a", "2"));
  // Reading does not extend retention, including after recreating the worker cache.
  clock(121 * 60_000);
  assert.equal(await create().get("a", "2"), null);
  await cache.prune(new Set(["a", "b"]));
  assert.equal(records.size, 0);
  assert.equal(await cache.put("a", "1", { ...one, data: "x".repeat(1000) }), false);
});

test("source cache clears only its owner and rejects corrupt entries", async () => {
  const { create, records, cache: disk } = fixture();
  const cache = create();
  await cache.put("a", "1", file());
  await cache.put("b", "1", file());
  await cache.clear("a");
  assert.equal(await cache.get("a", "1"), null);
  assert.ok(await cache.get("b", "1"));
  const key = [...records.keys()][0];
  const headers = records.get(key).headers;
  await disk.put(key, new Response("corrupt", { headers }));
  assert.equal(await cache.get("b", "1"), null);
  assert.equal(records.size, 0);
  await cache.put("orphan", "1", file());
  await cache.prune(new Set());
  assert.equal(records.size, 0);
});

test("source cache cannot retain a write cancelled while disk storage is pending", async () => {
  const { create, records, cache: disk } = fixture();
  const original = disk.put;
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  disk.put = async (...args) => { entered(); await gate; await original(...args); };
  const cache = create();
  const controller = new AbortController();
  const pending = cache.put("a", "1", file(), controller.signal);
  await started;
  controller.abort();
  const cleanup = cache.clear("a");
  release();
  assert.equal(await pending, false);
  await cleanup;
  assert.equal(records.size, 0);
});

test("unavailable or full disk cache is a miss, allowing normal exports to continue", async () => {
  const { create } = fixture();
  const cache = create({ storage: { async open() { throw new Error("Storage unavailable"); } } });
  assert.equal(await cache.get("a", "1"), null);
  assert.equal(await cache.put("a", "1", file()), false);
  await cache.clear("a");
  await cache.prune(new Set());
});
