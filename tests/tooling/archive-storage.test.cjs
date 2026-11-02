const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { Readable } = require("node:stream");
const { deflateRawSync } = require("node:zlib");
const { readZip } = require("../helpers/zip");
const extension = path.resolve(__dirname, "../../extension");
const source = fs.readFileSync(path.join(extension, "shared/zip.js"), "utf8")
  + "\n" + fs.readFileSync(path.join(extension, "background/archives.js"), "utf8");
const id = "11111111-1111-4111-8111-111111111111";
const transferId = "22222222-2222-4222-8222-222222222222";

function harness(t) {
  const disk = fs.mkdtempSync(path.join(os.tmpdir(), "patreon-archive-test-"));
  t.after(() => fs.rmSync(disk, { force: true, recursive: true }));
  const records = {};
  const writers = new Set();
  let listener;
  let removed;
  let elapsed = 0;
  let failWrite = false;
  let downloads = 0;
  let largestRead = 0;
  function directory(location) {
    return {
      async getDirectoryHandle(name, { create = false } = {}) {
        const child = path.join(location, name);
        if (create) fs.mkdirSync(child, { recursive: true });
        else if (!fs.existsSync(child)) throw new Error("Missing directory");
        return directory(child);
      },
      async *entries() { for (const name of fs.readdirSync(location)) yield [name, {}]; },
      async removeEntry(name) { fs.rmSync(path.join(location, name), { force: true, recursive: true }); },
      async getFileHandle(name, { create = false } = {}) {
        const file = path.join(location, name);
        if (create && !fs.existsSync(file)) fs.writeFileSync(file, "");
        if (!fs.existsSync(file)) throw new Error("Missing file");
        return {
          async getFile() {
            return { size: fs.statSync(file).size,
              // No arrayBuffer()/text(): assembly must consume a bounded stream.
              stream() {
                const input = fs.createReadStream(file, { highWaterMark: 64 * 1024 });
                input.on("data", bytes => { largestRead = Math.max(largestRead, bytes.length); });
                return Readable.toWeb(input);
              }
            };
          },
          async createWritable() {
            const temporary = file + ".pending";
            const handle = await fs.promises.open(temporary, "w");
            let closed = false;
            const stream = {
              async write(bytes) { if (failWrite) throw new Error("Disk quota exceeded"); await handle.write(bytes); },
              async close() { if (closed) return; closed = true; await handle.close(); fs.renameSync(temporary, file); writers.delete(stream); },
              async abort() { if (closed) return; closed = true; await handle.close(); fs.rmSync(temporary, { force: true }); writers.delete(stream); }
            };
            writers.add(stream);
            return stream;
          }
        };
      }
    };
  }
  const browser = {
    runtime: { id: "fixture-extension", onMessage: { addListener(value) { listener = value; } } },
    tabs: { async sendMessage() { return { reported: true, handedOff: true }; }, onRemoved: { addListener(value) { removed = value; } } },
    storage: { session: {
      async get() { return structuredClone(records); },
      async set(value) { Object.assign(records, structuredClone(value)); },
      async remove(key) { delete records[key]; }
    } }
  };
  const restart = async () => {
    for (const writer of [...writers]) await writer.abort();
    const scope = { browser, URL, AbortController, Uint8Array, DataView, TextEncoder, setTimeout,
      Date: class extends Date { static now() { return Date.now() + elapsed; } },
      atob: value => Buffer.from(value, "base64").toString("binary") };
    vm.runInNewContext(source, scope);
    const controller = scope.PatreonArchives.install({ root: async () => directory(disk),
      download: async () => { downloads++; return { started: true }; } });
    await controller.ready;
    return scope;
  };
  const send = (action, data = {}, owner = 1) => new Promise(resolve => listener({ type: `COLLECTION_ARCHIVE_${action}`, id, ...data },
    { id: browser.runtime.id, tab: { id: owner, url: "https://www.patreon.com/collection/500" } }, resolve));
  return { disk, records, restart, send, writers,
    fail: value => { failWrite = value; }, advance: minutes => { elapsed += minutes * 60_000; },
    closeOwner: () => removed(1), downloadCount: () => downloads, largestRead: () => largestRead };
}

async function store(h, scope, index, text) {
  const raw = Buffer.from(text);
  const compressed = deflateRawSync(raw);
  let crc = scope.PatreonZip.updateCrc32(0xffffffff, raw);
  crc = (crc ^ 0xffffffff) >>> 0;
  assert.equal((await h.send("BEGIN", { index, transferId, name: `${index + 1} - Chapter.md` })).begun, true);
  assert.equal((await h.send("CHUNK", { index, transferId, offset: 1, data: compressed.toString("base64") })).error.includes("order"), true);
  assert.equal((await h.send("CHUNK", { index, transferId, offset: 0, data: compressed.toString("base64") })).written, true);
  assert.equal((await h.send("END", { index, transferId, size: raw.length, compressedSize: compressed.length, crc })).stored, true);
}

test("disk archive resumes after worker restart and assembles independently readable ZIP bytes using streams", async t => {
  const h = harness(t);
  let scope = await h.restart();
  assert.equal((await h.send("CREATE", { count: 2, filename: "Synthetic collection.zip" })).created, true);
  await store(h, scope, 0, "First chapter. ".repeat(100_000));
  assert.match((await h.send("GET", {}, 2)).error, /another tab/);
  scope = await h.restart();
  const restored = await h.send("GET");
  assert.equal(restored.entries[0].name, "1 - Chapter.md");
  assert.equal(restored.entries[0].data, undefined);
  await store(h, scope, 1, "Second chapter.");
  h.fail(true);
  assert.match((await h.send("PACKAGE")).error, /quota/);
  assert.equal(h.downloadCount(), 0);
  h.fail(false);
  assert.equal((await h.send("PACKAGE")).started, true);
  const bytes = fs.readFileSync(path.join(h.disk, "patreon-archives-v1", id, "archive.zip"));
  assert.deepEqual(readZip(bytes).map(entry => entry.data.toString()), ["First chapter. ".repeat(100_000), "Second chapter."]);
  assert.ok(h.largestRead() <= 64 * 1024);
  assert.equal(h.writers.size, 0);
  assert.equal((await h.send("DROP")).dropped, true);
  assert.match((await h.send("CREATE", { count: 2, filename: "Synthetic.zip" })).error, /cancelled/);
  assert.equal(Object.keys(h.records).length, 0);
  assert.deepEqual(fs.readdirSync(path.join(h.disk, "patreon-archives-v1")), []);
});

test("archive owner closure aborts partial files and startup prunes expired and orphaned files", async t => {
  const h = harness(t);
  await h.restart();
  await h.send("CREATE", { count: 1, filename: "Synthetic.zip" });
  await h.send("BEGIN", { index: 0, name: "Chapter.md", transferId });
  h.closeOwner();
  for (let check = 0; check < 30 && Object.keys(h.records).length; check++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(Object.keys(h.records).length, 0);
  assert.equal(h.writers.size, 0);
  await h.send("CREATE", { count: 1, filename: "Synthetic.zip" });
  const orphan = path.join(h.disk, "patreon-archives-v1", "orphan");
  fs.mkdirSync(orphan);
  fs.writeFileSync(path.join(orphan, "partial"), "synthetic");
  h.advance(121);
  await h.restart();
  assert.match((await h.send("GET")).error, /expired/);
  assert.equal(Object.keys(h.records).length, 0);
  assert.deepEqual(fs.readdirSync(path.join(h.disk, "patreon-archives-v1")), []);
});
