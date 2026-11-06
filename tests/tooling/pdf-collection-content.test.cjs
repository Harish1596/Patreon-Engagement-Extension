const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { contentHarness, until } = require('../helpers/pdf-dom.cjs');
const { directory } = require('../helpers/disk.cjs');
const { inspectPdf } = require('../helpers/pdf');
const { readZip } = require('../helpers/zip');
const { render } = require('../helpers/pdf-render.cjs');
async function harness(t, count = 2) {
  const h = contentHarness(t, { url: 'https://www.patreon.com/collection/500', html: '<main><h1>PDF collection</h1>' +
    Array.from({ length: count }, (_, n) => `<a class="fixture_gridCard" href="/posts/${101 + n}">Post ${n + 1}</a>`).join('') + '</main>' });
  const { w } = h, records = {}, builds = [], output = [], failures = new Set(), skips = new Set(); let prepared;
  const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'patreon-pdf-dom-')); t.after(() => fs.rmSync(disk, { recursive: true, force: true }));
  Object.assign(w, { ReadableStream, TransformStream, CompressionStream, DecompressionStream });
  w.browser.storage = { session: { get: async () => records, set: async value => Object.assign(records, value), remove: async key => delete records[key] } };
  w.browser.tabs = { sendMessage: async (id, message) => h.send(message), onRemoved: { addListener() {} } };
  const original = w.browser.runtime.sendMessage;
  w.browser.runtime.sendMessage = async message => {
    if (message.type === 'PREPARE_COLLECTION_EXPORT') {
      assert.equal(message.deferred, true, 'Collection registration must remain on demand');
      prepared = { registered: true, count: message.urls.length, postUrls: message.urls, postTitles: message.urls.map((url, n) => `Post ${n + 1}`), skipped: 0, origins: [] };
      return prepared;
    }
    if (message.type === 'GET_COLLECTION_EXPORT_REQUEST') return prepared || { error: 'Session missing' };
    if (message.type === 'BUILD_COLLECTION_EXPORT') {
      builds.push(message.index);
      if (skips.has(message.index)) return { skippedPost: { url: prepared.postUrls[message.index], title: `Post ${message.index + 1}`, reason: 'Unsupported synthetic post' } };
      if (failures.has(message.index)) return { error: 'Synthetic chapter failure' };
      const title = `Post ${message.index + 1}`;
      const data = JSON.stringify({ version: 1, postId: String(101 + message.index), title, author: 'Creator', language: 'en',
        sourceUrl: prepared.postUrls[message.index], assets: [], body: { tag: 'p', children: [`Body ${message.index + 1}`] } });
      h.transfer = data;
      return { files: [{ title, extension: 'snapshot', encoding: 'text', length: data.length }] };
    }
    if (message.type === 'GET_COLLECTION_EXPORT_CHUNK') return { data: h.transfer.slice(message.offset, message.offset + 1024 * 1024), done: true };
    if (message.type === 'FINISH_COLLECTION_EXPORT') return { finished: true };
    if (message.type.startsWith('COLLECTION_ARCHIVE_')) return h.send(message, { id: 'fixture-extension', tab: { id: 1, url: w.location.href } });
    return original(message);
  };
  for (const name of ['content/archive-stream.js', 'content/collection-export.js', 'background/disk-crypto.js', 'background/epub-book.js', 'background/markdown-book.js', 'background/pdf-book.js', 'background/archives.js']) h.load(name);
  w.PatreonDiskCrypto = w.PatreonExportCrypto.create(); w.PatreonPdfRenderService = { render };
  const backend = w.PatreonArchives.install({ root: async () => directory(disk), download: async (job, file) => { output.push({ name: job.filename, bytes: new Uint8Array(await file.arrayBuffer()) }); return { started: true }; } });
  await backend.ready;
  w.PatreonCollectionExporter.reconcile(true);
  w.document.querySelector('[data-patreon-collection-download]').shadowRoot.querySelector('button').click();
  const shadow = () => w.document.querySelector('[data-patreon-collection-download]').shadowRoot;
  await until(() => shadow().querySelector('iframe')?.src.includes('#'));
  const choose = async format => {
    const token = new URL(shadow().querySelector('iframe').src).hash.slice(1);
    return h.send({ type: 'COLLECTION_EXPORT_CHOICE', token, format });
  };
  return { ...h, output, builds, failures, skips, choose, shadow, registered: () => Boolean(prepared) };
}
for (const mode of ['pdf', 'pdf-book']) test(`real collection controller downloads ${mode} through encrypted storage`, async t => {
  const h = await harness(t);
  await h.choose(mode);
  await until(() => h.output.length || h.shadow().querySelector('[data-tone="error"]'));
  assert.equal(h.output.length, 1, h.shadow().textContent);
  assert.equal(h.output[0].name, mode === 'pdf' ? 'PDF collection.zip' : 'PDF collection.pdf');
  if (mode === 'pdf') {
    const entries = readZip(Buffer.from(h.output[0].bytes));
    assert.deepEqual(entries.map(x => x.name), ['001 - Post 1.pdf', '002 - Post 2.pdf']);
    for (const entry of entries) {
      const text = (await inspectPdf(entry.data)).pages[0].text;
      assert.ok(text.includes('Body'));
      for (const label of ['Creator:', 'Download time:', 'Source:']) assert.ok(text.includes(label));
    }
  } else {
    const pdf = await inspectPdf(h.output[0].bytes);
    assert.equal(pdf.pages.length, 3); assert.ok(pdf.pages[1].text.includes('Post 1')); assert.ok(pdf.pages[2].text.includes('Post 2'));
    assert.ok(pdf.pages[0].text.includes('Download time:'));
    assert.ok(pdf.pages[0].text.replace(/\s/g, '').includes('https://www.patreon.com/collection/500'));
    for (const page of pdf.pages.slice(1)) {
      for (const label of ['Creator:', 'Download time:', 'Source:', 'https://www.patreon.com/posts/']) {
        assert.ok(!page.text.includes(label), `Chapter must omit ${label}`);
      }
    }
  }
  await until(() => h.shadow().textContent.includes(mode === 'pdf' ? 'PDF ZIP download started.' : 'PDF book download started.'));
});
test('real collection controller retains successful PDF chapters when retrying a failure', async t => {
  const h = await harness(t); h.failures.add(1);
  await h.choose('pdf-book');
  await until(() => !h.shadow().querySelector('.retry').hidden);
  assert.equal(h.output.length, 0); h.failures.clear();
  h.shadow().querySelector('.retry').click();
  await until(() => h.output.length);
  assert.deepEqual(h.builds, [0, 1, 1]);
});
test('101 posts produce two ordered combined PDF parts through the real controller', async t => {
  const h = await harness(t, 101);
  await h.choose('pdf-book');
  await until(() => h.output.length === 2 || h.shadow().querySelector('[data-tone="error"]'));
  assert.deepEqual(h.output.map(x => x.name), ['PDF collection - Part 001 of 002.pdf', 'PDF collection - Part 002 of 002.pdf']);
  const last = await inspectPdf(h.output[1].bytes); assert.ok(last.pages[1].text.includes('Post 101'));
});

test('opening the merged chooser does no discovery; all six format choices still work', async t => {
  const h = await harness(t);
  assert.equal(h.registered(), false); assert.equal(h.builds.length, 0);
  for (const [mode, extension] of [['markdown-book', 'md'], ['epub-book', 'epub'], ['pdf-book', 'pdf'], ['markdown', 'zip'], ['epub', 'zip'], ['pdf', 'zip']]) {
    const before = h.output.length;
    await h.choose(mode);
    await until(() => h.output.length > before || h.shadow().querySelector('[data-tone="error"]'));
    assert.equal(h.output.length, before + 1, h.shadow().textContent);
    assert.equal(h.output.at(-1).name, `PDF collection.${extension}`);
    if (extension === 'md') {
      const text = Buffer.from(h.output.at(-1).bytes).toString();
      assert.ok(text.includes('## Contents')); assert.ok(text.includes('## Post 1')); assert.ok(text.includes('## Post 2'));
      for (const label of ['**Creator:**', '**Download time:**', '**Source:**']) assert.equal(text.split(label).length, 2);
    }
    if (extension === 'epub') {
      const entries = readZip(Buffer.from(h.output.at(-1).bytes));
      const chapters = entries.filter(entry => entry.name.endsWith('/post.xhtml'));
      assert.equal(chapters.length, 2);
      for (const entry of chapters) assert.ok(!entry.data.toString().includes('<dl class="metadata">'));
      assert.ok(entries.find(entry => entry.name === 'EPUB/title.xhtml').data.toString().includes('Download time'));
    }
    if (mode === 'markdown' || mode === 'epub') {
      const entries = readZip(Buffer.from(h.output.at(-1).bytes));
      for (const entry of entries) {
        const text = mode === 'markdown' ? entry.data.toString() : readZip(entry.data).find(file => file.name === 'EPUB/post.xhtml').data.toString();
        for (const label of mode === 'markdown' ? ['**Creator:**', '**Download time:**', '**Source:**'] : ['<dt>Creator</dt>', '<dt>Download time</dt>', '<dt>Source</dt>']) assert.ok(text.includes(label));
      }
    }
    await until(() => h.shadow().querySelector('.format-options').getAttribute('aria-hidden') === 'false');
  }
});
for (const mode of ['pdf', 'pdf-book']) test(`on-demand skipped posts are omitted from ${mode} output`, async t => {
  const h = await harness(t, 3); h.skips.add(1);
  await h.choose(mode);
  await until(() => h.output.length || h.shadow().querySelector('[data-tone="error"]'));
  assert.equal(h.output.length, 1, h.shadow().textContent);
  if (mode === 'pdf') {
    assert.deepEqual(readZip(Buffer.from(h.output[0].bytes)).map(x => x.name), ['001 - Post 1.pdf', '003 - Post 3.pdf']);
  } else {
    const pdf = await inspectPdf(h.output[0].bytes);
    assert.equal(pdf.pages.length, 3); assert.ok(pdf.pages[1].text.includes('Post 1')); assert.ok(pdf.pages[2].text.includes('Post 3'));
    assert.ok(!pdf.pages[0].text.includes('Post 2'));
  }
});
