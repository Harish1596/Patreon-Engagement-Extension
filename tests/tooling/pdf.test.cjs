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
