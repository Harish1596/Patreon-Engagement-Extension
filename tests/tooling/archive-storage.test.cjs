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
  + "\n" + fs.readFileSync(path.join(extension, "background/disk-crypto.js"), "utf8")
  + "\n" + fs.readFileSync(path.join(extension, "background/epub-book.js"), "utf8")
  + "\n" + fs.readFileSync(path.join(extension, "background/archives.js"), "utf8");
const id = "11111111-1111-4111-8111-111111111111";
const transferId = "22222222-2222-4222-8222-222222222222";

function harness(t, { maxBytes, deliver, onProgress } = {}) {
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
  let controller;
  const progress = [];
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
    tabs: { async sendMessage(tabId, message) { if (message.type === "COLLECTION_ARCHIVE_PROGRESS") { progress.push(message); onProgress?.(message); } return { reported: true, handedOff: true }; }, onRemoved: { addListener(value) { removed = value; } } },
    storage: { session: {
      async get() { return structuredClone(records); },
      async set(value) { Object.assign(records, structuredClone(value)); },
      async remove(key) { delete records[key]; }
    } }
  };
  const restart = async () => {
    for (const writer of [...writers]) await writer.abort();
    const scope = { browser, URL, AbortController, Uint8Array, DataView, TextEncoder, TextDecoder, ReadableStream, DecompressionStream, setTimeout, crypto: require("node:crypto").webcrypto,
      Date: class extends Date { static now() { return Date.now() + elapsed; } },
      atob: value => Buffer.from(value, "base64").toString("binary") };
    vm.runInNewContext(source, scope);
    scope.PatreonDiskCrypto = scope.PatreonExportCrypto.create();
    controller = scope.PatreonArchives.install({ root: async () => directory(disk), ...(maxBytes === undefined ? {} : { maxBytes }),
      download: async () => { downloads++; if (deliver) return deliver(); return { started: true }; } });
    await controller.ready;
    return scope;
  };
  const send = (action, data = {}, owner = 1) => new Promise(resolve => listener({ type: `COLLECTION_ARCHIVE_${action}`, id, ...data },
    { id: browser.runtime.id, tab: { id: owner, url: "https://www.patreon.com/collection/500" } }, resolve));
  return { disk, records, restart, send, writers, progress,
    sweep: () => controller.sweep(),
    fail: value => { failWrite = value; }, advance: minutes => { elapsed += minutes * 60_000; },
    closeOwner: () => removed(1), downloadCount: () => downloads, largestRead: () => largestRead };
}

async function store(h, scope, index, text, metadata) {
  const raw = Buffer.from(text);
  const compressed = deflateRawSync(raw);
  let crc = scope.PatreonZip.updateCrc32(0xffffffff, raw);
  crc = (crc ^ 0xffffffff) >>> 0;
  assert.equal((await h.send("BEGIN", { index, transferId, name: `${index + 1} - Chapter.md`, metadata })).begun, true);
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
  h.progress.length = 0;
  assert.equal((await h.send("PACKAGE", { operationId: transferId })).started, true);
  assert.ok(h.progress.every(message => message.operationId === transferId));
  assert.ok(h.progress.every((message, index) => message.bytesCopied <= message.bytesTotal
    && (!index || message.bytesCopied >= h.progress[index - 1].bytesCopied)));
  assert.equal(h.progress.at(-1).bytesCopied, h.progress.at(-1).bytesTotal);
  assert.equal(h.progress.at(-1).stage, "finalize");
  const bytes = fs.readFileSync(path.join(h.disk, "patreon-archives-v1", id, "archive.zip"));
  assert.deepEqual(readZip(bytes).map(entry => entry.data.toString()), ["First chapter. ".repeat(100_000), "Second chapter."]);
  assert.ok(h.largestRead() <= 64 * 1024);
  assert.equal(h.writers.size, 0);
  assert.equal((await h.send("DROP")).dropped, true);
  assert.match((await h.send("CREATE", { count: 2, filename: "Synthetic.zip" })).error, /cancelled/);
  assert.equal(Object.keys(h.records).filter(key => key.startsWith("collection-archive:")).length, 0);
  assert.deepEqual(fs.readdirSync(path.join(h.disk, "patreon-archives-v1")), []);
});

test("archive owner closure aborts partial files and startup prunes expired and orphaned files", async t => {
  const h = harness(t);
  await h.restart();
  await h.send("CREATE", { count: 1, filename: "Synthetic.zip" });
  await h.send("BEGIN", { index: 0, name: "Chapter.md", transferId });
  h.closeOwner();
  for (let check = 0; check < 30 && Object.keys(h.records).filter(key => key.startsWith("collection-archive:")).length; check++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(Object.keys(h.records).filter(key => key.startsWith("collection-archive:")).length, 0);
  assert.equal(h.writers.size, 0);
  await h.send("CREATE", { count: 1, filename: "Synthetic.zip" });
  const orphan = path.join(h.disk, "patreon-archives-v1", "orphan");
  fs.mkdirSync(orphan);
  fs.writeFileSync(path.join(orphan, "partial"), "synthetic");
  h.advance(121);
  await h.restart();
  assert.match((await h.send("GET")).error, /expired/);
  assert.equal(Object.keys(h.records).filter(key => key.startsWith("collection-archive:")).length, 0);
  assert.deepEqual(fs.readdirSync(path.join(h.disk, "patreon-archives-v1")), []);
});

test("expiry sweep removes idle archive files and an expired GET cannot renew a job", async t => {
  const h = harness(t);
  const scope = await h.restart();
  await h.send("CREATE", { count: 1, filename: "Synthetic.zip" });
  await store(h, scope, 0, "Synthetic chapter");
  h.advance(121);
  assert.match((await h.send("GET")).error, /expired/);
  assert.equal(Object.keys(h.records).filter(key => key.startsWith("collection-archive:")).length, 0);
  assert.deepEqual(fs.readdirSync(path.join(h.disk, "patreon-archives-v1")), []);
  await h.send("CREATE", { count: 1, filename: "Synthetic.zip" });
  await store(h, scope, 0, "Another synthetic chapter");
  h.advance(121);
  await h.sweep();
  assert.equal(Object.keys(h.records).filter(key => key.startsWith("collection-archive:")).length, 0);
  assert.deepEqual(fs.readdirSync(path.join(h.disk, "patreon-archives-v1")), []);
});

test("archive quota covers concurrent pending writes across jobs and releases aborted reservations", async t => {
  const h = harness(t, { maxBytes: 700 });
  await h.restart();
  const second = "33333333-3333-4333-8333-333333333333";
  const ids = [id, second];
  for (const jobId of ids) {
    await h.send("CREATE", { id: jobId, count: 1, filename: "Synthetic.zip" });
    await h.send("BEGIN", { id: jobId, index: 0, name: "Chapter.md", transferId });
  }
  const data = Buffer.alloc(400, 1).toString("base64");
  const results = await Promise.all(ids.map(jobId => h.send("CHUNK", { id: jobId, index: 0, transferId, offset: 0, data })));
  assert.equal(results.filter(result => result.written).length, 1);
  assert.match(results.find(result => result.error).error, /storage is full/);
  const winner = results.findIndex(result => result.written), loser = 1 - winner;
  await h.send("ABORT", { id: ids[winner], index: 0, transferId });
  assert.equal((await h.send("CHUNK", { id: ids[loser], index: 0, transferId, offset: 0, data })).written, true);
});

test("encrypted retry files reject tampering and a failed handoff leaves no plaintext ZIP", async t => {
  const h = harness(t, { deliver: async () => { throw new Error("Synthetic handoff failure"); } });
  const scope = await h.restart();
  await h.send("CREATE", { count: 1, filename: "Synthetic.zip" });
  await store(h, scope, 0, "Sensitive synthetic chapter.");
  const folder = path.join(h.disk, "patreon-archives-v1", id);
  const retry = path.join(folder, "0.deflate");
  const encrypted = fs.readFileSync(retry);
  assert.notDeepEqual(encrypted, deflateRawSync(Buffer.from("Sensitive synthetic chapter.")));
  assert.match((await h.send("PACKAGE")).error, /handoff/);
  assert.equal(fs.existsSync(path.join(folder, "archive.zip")), false);
  encrypted[20] ^= 1; fs.writeFileSync(retry, encrypted);
  assert.ok((await h.send("PACKAGE")).error);
  assert.equal(fs.existsSync(path.join(folder, "archive.zip")), false);
});

test("ZIP staging shares the retry-file quota, also after worker restart", async t => {
  const h = harness(t, { maxBytes: 150 });
  let scope = await h.restart();
  await h.send("CREATE", { count: 1, filename: "Synthetic.zip" });
  await store(h, scope, 0, "A small synthetic chapter.");
  scope = await h.restart();
  assert.match((await h.send("PACKAGE")).error, /storage is full/);
  assert.equal(fs.existsSync(path.join(h.disk, "patreon-archives-v1", id, "archive.zip")), false);
  assert.ok((await h.send("GET")).entries[0]);
});


test("startup removes legacy plaintext retry files instead of adopting them", async t => {
  const h = harness(t);
  const folder = path.join(h.disk, "patreon-archives-v1", id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "0.deflate"), "Legacy synthetic plaintext");
  h.records["collection-archive:" + id] = { version: 1, id };
  await h.restart();
  assert.equal(fs.existsSync(folder), false);
  assert.equal(h.records["collection-archive:" + id], undefined);
});


function storedZip(scope, entries) {
  const parts = [], central = [], timestamp = scope.PatreonZip.dosTimestamp();
  let offset = 0;
  for (const [name, content] of entries) {
    const bytes = Buffer.from(content), encoded = Buffer.from(name);
    const crc = (scope.PatreonZip.updateCrc32(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
    parts.push(scope.PatreonZip.zipHeader(bytes.length, bytes.length, crc, encoded.length, offset, timestamp, 0), encoded, bytes);
    central.push(scope.PatreonZip.zipHeader(bytes.length, bytes.length, crc, encoded.length, offset, timestamp, 0, true), encoded);
    offset += 30 + encoded.length + bytes.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.reduce((sum, bytes) => sum + bytes.length, 0), 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}
const book = { title: "Synthetic book", source: "https://www.patreon.com/collection/500", downloadedAt: "Synthetic download time" };
const chapterMetadata = { title: "Synthetic chapter", creator: "Fixture Creator", language: "en" };

test("single EPUB assembly streams encrypted retry chapters after worker restart", async t => {
  const h = harness(t);
  let scope = await h.restart();
  assert.equal((await h.send("CREATE", { count: 1, filename: "Synthetic.epub", book })).created, true);
  const chapter = storedZip(scope, [["mimetype", "application/epub+zip"], ["EPUB/styles.css", "body{color:black}"],
    ["EPUB/post.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml"><body>' + "Synthetic text. ".repeat(100_000) + '</body></html>']]);
  await store(h, scope, 0, chapter, chapterMetadata);
  scope = await h.restart();
  assert.equal((await h.send("PACKAGE")).started, true);
  const entries = readZip(fs.readFileSync(path.join(h.disk, "patreon-archives-v1", id, "archive.zip")));
  assert.equal(entries[0].name, "mimetype"); assert.equal(entries[0].method, 0);
  assert.ok(entries.find(entry => entry.name === "EPUB/chapters/001/post.xhtml").data.length > 1_000_000);
  assert.ok(h.largestRead() <= 64 * 1024);
});

test("single EPUB staging obeys the shared quota and leaves no partial plaintext download", async t => {
  const h = harness(t, { maxBytes: 6000 });
  const scope = await h.restart();
  await h.send("CREATE", { count: 1, filename: "Synthetic.epub", book });
  await store(h, scope, 0, storedZip(scope, [["mimetype", "application/epub+zip"], ["EPUB/styles.css", "body{}"], ["EPUB/post.xhtml", "x".repeat(10000)]]), chapterMetadata);
  assert.match((await h.send("PACKAGE")).error, /storage is full/);
  assert.equal(h.downloadCount(), 0);
  assert.equal(fs.existsSync(path.join(h.disk, "patreon-archives-v1", id, "archive.zip")), false);
  assert.ok((await h.send("GET")).entries[0]);
});

test("single EPUB assembly rejects unexpected nested archive paths and invalid collection metadata", async t => {
  const h = harness(t);
  const scope = await h.restart();
  assert.match((await h.send("CREATE", { count: 1, filename: "Synthetic.epub", book: { ...book, source: "https://example.invalid/collection/500" } })).error, /metadata/);
  await h.send("CREATE", { count: 1, filename: "Synthetic.epub", book });
  await store(h, scope, 0, storedZip(scope, [["../../outside", "untrusted"]]), chapterMetadata);
  assert.match((await h.send("PACKAGE")).error, /unexpected resource/);
  assert.equal(h.downloadCount(), 0);
  assert.equal(fs.existsSync(path.join(h.disk, "patreon-archives-v1", id, "archive.zip")), false);
});


test("closing the owner during streamed book assembly aborts without a plaintext download", async t => {
  let closed = false;
  const h = harness(t, { onProgress: () => { if (!closed) { closed = true; h.closeOwner(); } } });
  const scope = await h.restart();
  await h.send("CREATE", { count: 1, filename: "Synthetic.epub", book });
  await store(h, scope, 0, storedZip(scope, [["mimetype", "application/epub+zip"], ["EPUB/styles.css", "body{}"], ["EPUB/post.xhtml", "text".repeat(10000)]]), chapterMetadata);
  assert.ok((await h.send("PACKAGE")).error);
  assert.equal(h.downloadCount(), 0);
  for (let attempt = 0; attempt < 50 && fs.existsSync(path.join(h.disk, "patreon-archives-v1", id)); attempt++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(fs.existsSync(path.join(h.disk, "patreon-archives-v1", id)), false);
});
