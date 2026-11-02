const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const cryptoSource = fs.readFileSync(path.resolve(__dirname, "../../extension/background/disk-crypto.js"), "utf8");
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
  const session = {};
  const browser = { runtime: { id: "fixture" }, storage: { session: {
    async get() { return { ...session }; }, async set(values) { Object.assign(session, values); }
  } } };
  const scope = { Blob, Response, URL, Uint8Array, TextEncoder, TextDecoder, browser, crypto: require("node:crypto").webcrypto };
  vm.runInNewContext(cryptoSource + "\n" + source, scope);
  scope.PatreonDiskCrypto = scope.PatreonExportCrypto.create();
  return { records, cache, session, restartCrypto: () => { scope.PatreonDiskCrypto = scope.PatreonExportCrypto.create(); }, clock: value => { clock = value; },
    create: (extra = {}) => scope.PatreonPostCache.create({ storage: { async open() { return cache; } }, now: () => clock, ...options, ...extra }) };
}

const file = (id = "1") => ({ title: `Chapter ${id}`, extension: "snapshot", encoding: "text",
  data: JSON.stringify({ version: 1, postId: id, assets: [], body: "A synthetic chapter." }) });

test("source cache enforces a shared byte budget and fixed two-hour expiry", async () => {
  const one = file();
  const { create, clock, records } = fixture();
  await create().put("a", "1", one);
  const size = Number([...records.values()][0].headers.get("x-bytes"));
  const cache = create({ maxBytes: size * 2 });
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


test("disk sources hide text and titles, authenticate their owner, and reject legacy plaintext", async () => {
  const { create, records, cache: disk } = fixture();
  const cache = create();
  await cache.put("a", "1", file());
  const [url, response] = [...records][0];
  const bytes = new Uint8Array(await response.clone().arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes).includes("synthetic chapter"), false);
  assert.equal(new TextDecoder().decode(bytes).includes("Chapter 1"), false);
  assert.equal(response.headers.get("x-title"), null);
  await disk.put(url.replace("/a/", "/b/"), response.clone());
  assert.equal(await cache.get("b", "1"), null);
  assert.equal((await create().get("a", "1")).data, file().data);
  bytes[15] ^= 1;
  await disk.put(url, new Response(bytes, { headers: response.headers }));
  assert.equal(await cache.get("a", "1"), null);
  await disk.put(url, new Response(file().data, { headers: { "x-bytes": "100", "x-expires": "999999" } }));
  assert.equal(await cache.get("a", "1"), null);
});


test("a worker restart restores the session key, while a lost browser-session key makes leftovers unreadable", async () => {
  const { create, records, session, restartCrypto } = fixture();
  await create().put("a", "1", file());
  restartCrypto();
  assert.equal((await create().get("a", "1")).data, file().data);
  delete session["export-disk-key-v1"];
  restartCrypto();
  assert.equal(await create().get("a", "1"), null);
  assert.equal(records.size, 0);
});
