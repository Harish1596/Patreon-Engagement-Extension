const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../extension');
function adapter() {
  const context = { TextEncoder, URL }; context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/pdf.js'), 'utf8'), context);
  return context.PatreonPdf;
}
const snapshot = { version: 1, title: 'A post', author: 'Creator', sourceUrl: 'https://www.patreon.com/posts/123?private=1',
  language: 'en', downloadedAt: 'Nov 4, 2026', assets: [], body: { tag: 'p', children: ['Text ', { tag: 'strong', children: ['bold'] }] } };
test('PDF adapter builds structured selectable content and strips source query data', () => {
  const pdf = adapter();
  const chapter = pdf.chapter(snapshot);
  assert.equal(chapter.sourceUrl, 'https://www.patreon.com/posts/123');
  const doc = pdf.definition([chapter]);
  const serialized = JSON.stringify(doc);
  assert.ok(serialized.includes('Text '));
  assert.ok(serialized.includes('"bold":true'));
  assert.ok(!serialized.includes('private=1'));
  assert.equal(doc.info.title, 'A post');
});
test('PDF adapter rejects external assets, active nodes and oversized trees', () => {
  const pdf = adapter();
  assert.throws(() => pdf.chapter({ ...snapshot, assets: [{ dataUrl: 'https://example.com/image.png' }] }), /embedded|image/i);
  assert.throws(() => pdf.chapter({ ...snapshot, body: { tag: 'script', children: ['bad'] } }), /unsupported|invalid/i);
  let body = 'deep'; for (let n = 0; n < 205; n++) body = { tag: 'div', children: [body] };
  assert.throws(() => pdf.chapter({ ...snapshot, body }), /deep|limit/i);
});
test('combined PDF has linked contents, ordered headings and chapter page breaks', () => {
  const pdf = adapter();
  const doc = pdf.definition([pdf.chapter(snapshot), pdf.chapter({ ...snapshot, title: 'Second' })],
    { title: 'Collection', source: 'https://www.patreon.com/collection/500', downloadedAt: 'Today' });
  assert.ok(doc.content.some(x => x.toc));
  const headings = doc.content.filter(x => x.tocItem);
  assert.deepEqual(Array.from(headings, x => x.text), ['A post', 'Second']);
  assert.ok(headings.every(x => x.pageBreak === 'before'));
});
async function render(chapters, book) {
  const { Worker } = require('node:worker_threads');
  const worker = new Worker(path.resolve(__dirname, '../helpers/pdf-node-worker.cjs'));
  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Renderer timed out')), 20_000);
      worker.on('error', error => { clearTimeout(timeout); reject(error); });
      worker.on('message', result => { clearTimeout(timeout); result.error ? reject(new Error(result.error)) : resolve(result.bytes); });
      worker.postMessage({ chapters, book });
    });
  } finally { await worker.terminate(); }
}
test('real packaged worker emits parseable PDFs with text, metadata and links', async () => {
  const data = await render([adapter().chapter({ ...snapshot, body: { tag: 'p', children: ['Hello café Ελληνικά Привет ', { tag: 'a', href: 'https://example.com/article', children: ['Link'] }] } })]);
  assert.equal(Buffer.from(data).subarray(0, 5).toString(), '%PDF-');
  const { inspectPdf } = require('../helpers/pdf');
  const doc = await inspectPdf(data);
  assert.ok(doc.pages[0].text.includes('Hello café Ελληνικά Привет'), doc.pages[0].text);
  assert.equal(doc.metadata.info.Title, 'A post');
  assert.ok(doc.pages[0].annotations.some(x => x.url === 'https://example.com/article'));
});
test('real worker rejects unsupported glyphs and oversized image headers', async () => {
  await assert.rejects(render([adapter().chapter({ ...snapshot, title: 'Unsupported 😀' })]), /character U\+1F600/);
  const image = Buffer.alloc(24); image.writeUInt32BE(0x89504e47); image.writeUInt32BE(10000, 16); image.writeUInt32BE(10000, 20);
  await assert.rejects(render([adapter().chapter({ ...snapshot, body: { tag: 'img', image: 0 }, assets: [{ dataUrl: 'data:image/png;base64,' + image.toString('base64') }] })]), /pixel/);
});
test('linked inline images survive PDF mapping and embed image data', async () => {
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(8, 8); canvas.getContext('2d').fillRect(0, 0, 8, 8);
  const input = adapter().chapter({ ...snapshot, body: { tag: 'p', children: ['Before ', { tag: 'a', href: 'https://example.com/image',
    children: [{ tag: 'img', image: 0 }] }, ' after'] }, assets: [{ dataUrl: canvas.toDataURL('image/png') }] });
  const doc = adapter().definition([input]);
  assert.ok(JSON.stringify(doc).includes('data:image/png;base64,'), 'Linked image must not disappear inside an inline link');
  const data = await render([input]);
  const { inspectPdf } = require('../helpers/pdf');
  const pdf = await inspectPdf(data);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  assert.ok(pdf.pages[0].operators.includes(pdfjs.OPS.paintImageXObject));
});
test('PNG inflation is bounded by declared pixels inside the packaged worker', async () => {
  const zlib = require('node:zlib');
  const crc32 = value => { let crc = 0xffffffff; for (const byte of value) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
  function chunk(name, data) {
    const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(name), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([size, body, crc]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  const image = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.alloc(100_000))), chunk('IEND', Buffer.alloc(0))]);
  await assert.rejects(render([adapter().chapter({ ...snapshot, body: { tag: 'img', image: 0 }, assets: [{ dataUrl: 'data:image/png;base64,' + image.toString('base64') }] })]), /inflated PNG/);
});

test('PDF input accepts a document above the old cap and rejects oversized UTF-8 data', () => {
  const pdf = adapter();
  assert.doesNotThrow(() => pdf.size({ text: 'x'.repeat(32 * 1024 * 1024) }));
  assert.throws(() => pdf.size({ text: 'x'.repeat(49 * 1024 * 1024) }), /48 MiB input limit/);
  // Count encoded bytes, not only JavaScript string code units.
  assert.throws(() => pdf.size({ text: 'é'.repeat(25 * 1024 * 1024) }), /48 MiB input limit/);
});

test('real worker renders 75 image chapters whose combined input exceeds 24 MiB', { timeout: 90_000 }, async () => {
  const { chapters, book } = require('../helpers/large-pdf.cjs').largePdfFixture();
  const inputBytes = Buffer.byteLength(JSON.stringify({ chapters, book }));
  assert.ok(inputBytes > 24 * 1024 * 1024, `Fixture must cross the old limit: ${inputBytes}`);
  assert.ok(inputBytes < 48 * 1024 * 1024);
  const bytes = await render(chapters, book);
  const { inspectPdf } = require('../helpers/pdf');
  const doc = await inspectPdf(bytes);
  // A 75-entry contents list legitimately occupies more than one page.
  const chapterPages = doc.pages.filter(page => /\bBody \d+\b/.test(page.text));
  assert.equal(chapterPages.length, 75);
  chapterPages.forEach((page, index) => assert.match(page.text, new RegExp(`\\bBody ${index + 1}\\b`)));
  assert.ok(doc.pages.length > 75);
  console.log(`Large PDF fixture: ${inputBytes} input bytes, ${bytes.length} output bytes, ${doc.pages.length} pages.`);
});
