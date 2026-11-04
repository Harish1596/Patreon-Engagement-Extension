const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectPdf } = require('../helpers/pdf');
const { contentHarness, until } = require('../helpers/pdf-dom.cjs');
test('real post PDF action uses extraction and downloads a PDF without printing', async t => {
  const h = contentHarness(t), w = h.w;
  w.document.title = 'Original tab title';
  w.print = () => { throw new Error('Native print must not run'); };
  w.PatreonExporter.reconcile(true);
  w.document.querySelector('[data-patreon-download-button]').click();
  await until(() => w.document.querySelector('[data-patreon-download-panel]')?.shadowRoot.querySelector('iframe')?.src.includes('#'));
  const frame = w.document.querySelector('[data-patreon-download-panel]').shadowRoot.querySelector('iframe');
  const token = new URL(frame.src).hash.slice(1);
  assert.equal((await h.send({ type: 'POST_EXPORT_CHOICE', token, format: 'pdf' })).started, true);
  await until(() => h.downloads.length || w.document.querySelector('[data-patreon-download-panel]').shadowRoot.querySelector('[data-tone="error"]'));
  assert.equal(h.downloads.length, 1, w.document.querySelector('[data-patreon-download-panel]').shadowRoot.textContent);
  assert.equal(h.downloads[0].name, 'A sample post.pdf');
  assert.equal(h.downloads[0].blob.type, 'application/pdf');
  const pdf = await inspectPdf(await h.downloads[0].blob.arrayBuffer());
  assert.ok(pdf.pages[0].text.includes('A sample post'));
  assert.ok(!pdf.pages[0].text.includes('A comment.'));
  assert.equal(w.document.title, 'Original tab title');
  assert.equal(w.document.querySelector('[data-patreon-export-print-frame]'), null);
});
test('cached post PDF and combined-chapter formatting use the same source without refetching', async t => {
  const { w } = contentHarness(t);
  const source = { version: 1, postId: '123', title: 'Cached PDF', author: 'Creator', sourceUrl: 'https://www.patreon.com/posts/123',
    language: 'en', assets: [], body: { tag: 'p', children: ['Cached text'] } };
  const file = await w.PatreonExporter.fileFromSnapshot(source, 'pdf', source.sourceUrl);
  assert.equal(file.extension, 'pdf');
  assert.ok((await inspectPdf(Buffer.from(file.data, 'base64'))).pages[0].text.includes('Cached text'));
  const chapter = await w.PatreonExporter.fileFromSnapshot(source, 'pdf-book', source.sourceUrl);
  assert.equal(chapter.extension, 'pdfchapter');
  assert.equal(JSON.parse(chapter.data).title, 'Cached PDF');
});
