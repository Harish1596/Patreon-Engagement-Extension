const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../extension');
function adapter() {
  const context = { TextEncoder, URL }; context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'vendor/pdfmake/coverage.js'), 'utf8'), context);
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
      worker.on('message', result => { clearTimeout(timeout); result.error ? reject(Object.assign(new Error(result.error), { pdfFailures: result.pdfFailures })) : resolve(result.bytes); });
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

test('PDF preserves extended Latin diacritics in metadata and all four text faces', async () => {
  const source = { ...snapshot, title: 'Chapter Ḫ', author: 'Creator ḫ', body: { tag: 'div', children: [
    { tag: 'p', children: ['Regular Ḫ ḫ Ṭ ṭ Ḥ ḥ Ā ā'] },
    { tag: 'p', children: [{ tag: 'strong', children: ['Bold Ḫ'] }] },
    { tag: 'p', children: [{ tag: 'em', children: ['Italic Ḫ'] }] },
    { tag: 'p', children: [{ tag: 'strong', children: [{ tag: 'em', children: ['Both Ḫ'] }] }] },
    { tag: 'p', children: ['Decomposed H\u032e'] }
  ] } };
  const bytes = await render([adapter().chapter(source)], { title: 'Collection Ḫ', source: 'https://www.patreon.com/collection/500', downloadedAt: 'Today' });
  const { inspectPdf } = require('../helpers/pdf');
  const doc = await inspectPdf(bytes);
  assert.equal(doc.metadata.info.Title, 'Collection Ḫ');
  const text = doc.pages.map(page => page.text).join(' ').normalize('NFC');
  for (const expected of ['Chapter Ḫ', 'Creator ḫ', 'Regular Ḫ ḫ Ṭ ṭ Ḥ ḥ Ā ā', 'Bold Ḫ', 'Italic Ḫ', 'Both Ḫ', 'Decomposed Ḫ']) assert.ok(text.includes(expected), expected + '\n' + text);
});

test('PDF font fallback preserves mixed Latin and cuneiform in styled text, metadata, contents and links', async () => {
  const input = { ...snapshot, title: 'Chapter Ḫ𒀭', author: 'Creator𒀭', body: { tag: 'div', children: [
    { tag: 'p', children: ['Before𒀭after Ḫ'] },
    { tag: 'h2', children: ['Heading𒀭'] },
    { tag: 'p', children: [{ tag: 'strong', children: ['Bold𒀭'] }] },
    { tag: 'p', children: [{ tag: 'em', children: ['Italic𒀭'] }] },
    { tag: 'p', children: [{ tag: 'strong', children: [{ tag: 'em', children: ['Both𒀭'] }] }] },
    { tag: 'p', children: [{ tag: 'a', href: 'https://example.com/cuneiform', children: ['Link𒀭'] }] },
    { tag: 'ul', children: [{ tag: 'li', children: ['List𒀭'] }] },
    { tag: 'pre', children: ['Code𒀭'] }
  ] } };
  const bytes = await render([adapter().chapter(input)], { title: 'Collection𒀭', source: 'https://www.patreon.com/collection/500', downloadedAt: 'Today' });
  const { inspectPdf } = require('../helpers/pdf'); const doc = await inspectPdf(bytes);
  assert.equal(doc.metadata.info.Title, 'Collection𒀭');
  assert.match(doc.pages[0].text, /Collection\s*𒀭/); assert.match(doc.pages[0].text, /Chapter Ḫ\s*𒀭/);
  assert.ok(doc.pages[0].annotations.some(item => item.dest), 'Mixed-font contents entry remains linked');
  const text = doc.pages[1].text.normalize('NFC');
  for (const pattern of [/Creator\s*𒀭/, /Before\s*𒀭\s*after Ḫ/, /Heading\s*𒀭/, /Bold\s*𒀭/, /Italic\s*𒀭/, /Both\s*𒀭/, /Link\s*𒀭/, /List\s*𒀭/, /Code\s*𒀭/]) assert.match(text, pattern);
  assert.ok(doc.pages[1].annotations.some(item => item.url === 'https://example.com/cuneiform'));
});

test('font fallback bounds alternating-script fragment expansion before layout', () => {
  const pdf = adapter();
  const input = pdf.chapter({ ...snapshot, body: { tag: 'p', children: ['a𒀭'.repeat(50_001)] } });
  assert.throws(() => pdf.definition([input]), /font fallback complexity limit/);
});

test('SVG text keeps its primary-font guard instead of silently dropping fallback-only glyphs', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><text x="0" y="20">𒀭</text></svg>';
  await assert.rejects(render([adapter().chapter({ ...snapshot, assets: [{ dataUrl: 'data:image/svg+xml,' + encodeURIComponent(svg) }], body: { tag: 'img', image: 0 } })]), /SVG font.*U\+1202D/);
});

test('PDF preserves CJK ideographs alongside Latin and cuneiform across styles, metadata and links', async () => {
  const input = { ...snapshot, title: 'Chapter 天 Ḫ𒀭', author: 'Creator 天', body: { tag: 'div', children: [
    { tag: 'p', children: ['Regular 天地玄黃 中文 简体 繁體 Ḫ𒀭'] },
    { tag: 'p', children: [{ tag: 'strong', children: ['Bold 天地'] }] },
    { tag: 'p', children: [{ tag: 'em', children: ['Italic 天地'] }] },
    { tag: 'p', children: [{ tag: 'strong', children: [{ tag: 'em', children: ['Both 天地'] }] }] },
    { tag: 'p', children: [{ tag: 'a', href: 'https://example.com/cjk', children: ['Link 天地'] }] }
  ] } };
  const bytes = await render([adapter().chapter(input)], { title: 'Collection 天', source: 'https://www.patreon.com/collection/500', downloadedAt: 'Today' });
  const { inspectPdf } = require('../helpers/pdf'); const doc = await inspectPdf(bytes);
  assert.equal(doc.metadata.info.Title, 'Collection 天');
  assert.ok(doc.pages[0].text.replace(/\s/g, '').includes('Chapter天Ḫ𒀭'));
  assert.ok(doc.pages[0].annotations.some(item => item.dest), 'Mixed-font contents entry remains linked');
  const text = doc.pages[1].text.replace(/\s/g, '');
  for (const expected of ['Creator天', 'Regular天地玄黃中文简体繁體Ḫ𒀭', 'Bold天地', 'Italic天地', 'Both天地', 'Link天地']) assert.ok(text.includes(expected), expected + '\n' + text);
  assert.ok(doc.pages[1].annotations.some(item => item.url === 'https://example.com/cjk'));
});

test('PDF validation identifies every affected chapter without including post contents or source queries', async () => {
  const pdf = adapter();
  const chapters = ['Supported text', 'Private sample 😀', 'Still supported', 'Another sample א'].map((text, index) => pdf.chapter({
    ...snapshot, title: `Chapter ${index + 1}`, sourceUrl: `https://www.patreon.com/posts/${201 + index}?secret=private`, body: { tag: 'p', children: [text] }
  }));
  await assert.rejects(render(chapters), error => {
    assert.deepEqual(error.pdfFailures?.map(item => item.index), [1, 3]);
    assert.match(error.pdfFailures[0].message, /U\+1F600/);
    assert.match(error.pdfFailures[1].message, /U\+5D0/);
    assert.ok(!JSON.stringify(error.pdfFailures).includes('Private sample'));
    assert.ok(!JSON.stringify(error.pdfFailures).includes('secret='));
    return true;
  });
});

test('PDF failure metadata is bounded, redacted and restricted to actual chapter indices', () => {
  const pdf = adapter();
  const details = pdf.failureDetails([{ index: 0, message: 'Image failed https://media.example/image?secret=private\nRetry' },
    { index: 0, message: 'Duplicate' }, { index: -1, message: 'Negative' }, { index: 1, message: 'Outside chapter list' },
    { index: 0.5, message: 'Fraction' }, { index: 0, message: 'x'.repeat(1201) }], 1);
  assert.equal(details.length, 1); assert.equal(details[0].index, 0);
  assert.equal(details[0].message, 'Image failed [URL omitted] Retry');
  assert.equal(pdf.failureDetails(Array.from({ length: 101 }, () => ({ index: 0, message: 'Too many' }))).length, 0);
});
