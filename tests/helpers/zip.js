const assert = require("node:assert/strict");
const { inflateRawSync } = require("node:zlib");

// Read the directory independently of the extension's writer; compressed bytes
// must be inflated before asserting file contents.
function readZip(bytes) {
  const end = bytes.lastIndexOf(Buffer.from("504b0506", "hex"));
  assert.ok(end >= 0);
  let offset = bytes.readUInt32LE(end + 16);
  const entries = [];
  for (let index = 0; index < bytes.readUInt16LE(end + 10); index++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const method = bytes.readUInt16LE(offset + 10);
    const size = bytes.readUInt32LE(offset + 20);
    const length = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const local = bytes.readUInt32LE(offset + 42);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const payload = bytes.subarray(start, start + size);
    assert.ok(method === 8 || method === 0);
    const data = method === 8 ? inflateRawSync(payload) : payload;
    assert.equal(data.length, length);
    entries.push({ name: bytes.toString("utf8", offset + 46, offset + 46 + nameLength), data, method, size });
    offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  assert.equal(offset, end);
  return entries;
}

module.exports = { readZip };
