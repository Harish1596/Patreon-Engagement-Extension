const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers/reader');
const { startCollectionDownload } = require('./helpers/collection-choice');
const { readZip } = require('./helpers/zip');
const { inspectPdf } = require('./helpers/pdf');
const frame = page => page.frameLocator('iframe[title="Collection export formats"]');
const url = id => `https://www.patreon.com/posts/${id}`;
async function filesByPost(page, files) {
  await page.evaluate(files => {
    Object.defineProperty(globalThis, 'collectionBuildResult', { configurable: true, get() {
      return { files: (globalThis.requestedCollectionUrls || []).map(url => files[url.match(/(\d+)$/)[1]]), skipped: 0 };
    } });
  }, files);
}
async function download(page, format) {
  const pending = page.waitForEvent('download'); await startCollectionDownload(frame(page), format);
  const result = await pending, chunks = [];
  for await (const chunk of await result.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function apiFixture(page, resources, files, paginated = false) {
  await setup(page, { content: '<main><h1>Reading order</h1></main>', url: 'https://www.patreon.com/collection/500' });
  await filesByPost(page, files);
  const queries = [];
  await page.route('https://www.patreon.com/api/posts**', route => {
    const query = new URL(route.request().url()).searchParams; queries.push(Object.fromEntries(query));
    const next = paginated && !query.has('page[cursor]');
    return route.fulfill({ json: {
      data: paginated ? (next ? resources.slice(0, 2) : resources.slice(2)) : resources,
      meta: { pagination: { total: new Set(resources.map(post => post.id)).size, cursors: { next: next ? 'next-page' : null } } }
    } });
  });
  await page.evaluate(() => {
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, 'getEntriesByType', { value: type => type === 'resource'
      ? [...original(type), { name: 'https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500&sort=-published_at' }] : original(type) });
  });
  await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
  return queries;
}
const post = (id, published_at, accessible = true) => ({ id: String(id), type: 'post', attributes: { title: `Post ${id}`, published_at, current_user_can_view: accessible } });
const file = (title, body) => ({ title, extension: 'md', encoding: 'text', data: body });
for (const format of ['Markdown', 'EPUB', 'PDF', 'Single Markdown', 'Single EPUB', 'Single PDF']) {
  test(`${format} orders paginated newest-first API posts by publication time before exporting`, async ({ page }) => {
    // Publication order deliberately differs from ID order, as with scheduled posts.
    const queries = await apiFixture(page, [post(102, '2026-01-03T00:00:00Z'), post(104, '2026-01-04T00:00:00Z', false),
      post(101, '2026-01-02T00:00:00Z'), post(103, '2026-01-01T00:00:00Z'), post(102, '2026-01-03T00:00:00Z')], {
      103: file('Oldest chapter', 'Body oldest'), 101: file('Middle chapter', 'Body middle'), 102: file('Newest chapter', 'Body newest')
    }, true);
    const bytes = await download(page, format);
    expect(await page.evaluate(() => requestedCollectionUrls)).toEqual([103, 101, 102].map(url));
    expect(queries).toHaveLength(2);
    for (const query of queries) expect(query['fields[post]'].split(',')).toContain('published_at');
    if (format === 'Single Markdown') {
      const text = bytes.toString();
      expect(text.indexOf('Body oldest')).toBeLessThan(text.indexOf('Body middle'));
      expect(text.indexOf('Body middle')).toBeLessThan(text.indexOf('Body newest'));
      await download(page, 'Single EPUB');
      expect(queries).toHaveLength(2); // Reuse the correctly ordered prepared session.
      expect(await page.evaluate(() => collectionPrepareCount)).toBe(1);
    } else if (format === 'Single EPUB') {
      const entries = readZip(bytes);
      const nav = entries.find(entry => entry.name === 'EPUB/nav.xhtml').data.toString();
      expect(nav.indexOf('Oldest chapter')).toBeLessThan(nav.indexOf('Middle chapter'));
      expect(nav.indexOf('Middle chapter')).toBeLessThan(nav.indexOf('Newest chapter'));
      expect(entries.find(entry => entry.name === 'EPUB/chapters/001/post.xhtml').data.toString()).toContain('Body oldest');
      expect(entries.find(entry => entry.name === 'EPUB/chapters/003/post.xhtml').data.toString()).toContain('Body newest');
    } else if (format === 'Single PDF') {
      const doc = await inspectPdf(bytes);
      expect(doc.pages).toHaveLength(4);
      for (const [index, body] of ['Body oldest', 'Body middle', 'Body newest'].entries()) expect(doc.pages[index + 1].text).toContain(body);
    } else {
      const extension = { Markdown: 'md', EPUB: 'epub', PDF: 'pdf' }[format], entries = readZip(bytes);
      expect(entries.map(entry => entry.name)).toEqual(['Oldest', 'Middle', 'Newest'].map((name, index) => `00${index + 1} - ${name} chapter.${extension}`));
      for (const [index, body] of ['Body oldest', 'Body middle', 'Body newest'].entries()) {
        const text = format === 'PDF' ? (await inspectPdf(entries[index].data)).pages[0].text
          : format === 'EPUB' ? readZip(entries[index].data).find(entry => entry.name === 'EPUB/post.xhtml').data.toString() : entries[index].data.toString();
        expect(text).toContain(body);
      }
    }
  });
}
test('DOM fallback uses numeric post IDs rather than newest-first display or lexical order', async ({ page }) => {
  const ids = ['9007199254740993', '100', '9007199254740992', '10', '9'];
  await setup(page, { content: '<main><h1>Fallback</h1>' + ids.map(id => `<a class="fixture_gridCard" href="/posts/${id}">Post</a>`).join('') + '</main>', url: 'https://www.patreon.com/collection/500' });
  await filesByPost(page, Object.fromEntries(ids.map(id => [id, file(`Post ${id}`, `Body ${id}`)])));
  await page.getByRole('button', { name: 'Download Collection', exact: true }).click(); await download(page, 'Markdown');
  expect(await page.evaluate(() => requestedCollectionUrls)).toEqual(['9', '10', '100', '9007199254740992', '9007199254740993'].map(url));
});
test('missing or invalid publication dates use one deterministic numeric-ID fallback', async ({ page }) => {
  await apiFixture(page, [post(103, '2020-01-01T00:00:00Z'), post(102, 'invalid'), post(101)], {
    101: file('First', 'One'), 102: file('Second', 'Two'), 103: file('Third', 'Three')
  });
  await download(page, 'Markdown'); expect(await page.evaluate(() => requestedCollectionUrls)).toEqual([101, 102, 103].map(url));
});
test('equal publication dates use numeric IDs as a stable tie-breaker', async ({ page }) => {
  await apiFixture(page, [post(100, '2026-01-01T00:00:00Z'), post(10, '2026-01-01T01:00:00+01:00'), post(9, '2026-01-01T00:00:00Z')], {
    9: file('First', 'One'), 10: file('Second', 'Two'), 100: file('Third', 'Three')
  });
  await download(page, 'Markdown'); expect(await page.evaluate(() => requestedCollectionUrls)).toEqual([9, 10, 100].map(url));
});
test('oldest-first ordering is applied globally before numbered collection parts', async ({ page }) => {
  const ids = Array.from({ length: 101 }, (_, n) => 201 - n);
  await setup(page, { content: '<main><h1>Ordered parts</h1>' + ids.map(id => `<a class="fixture_gridCard" href="/posts/${id}">Post</a>`).join('') + '</main>', url: 'https://www.patreon.com/collection/500' });
  await filesByPost(page, Object.fromEntries(ids.map(id => [id, file(`Chapter ${id - 100}`, `Body ${id}`)])));
  const downloads = []; page.on('download', item => downloads.push(item));
  await page.getByRole('button', { name: 'Download Collection', exact: true }).click(); await startCollectionDownload(frame(page), 'Markdown');
  await expect.poll(() => downloads.length).toBe(2);
  const names = [];
  for (const item of downloads) {
    const chunks = []; for await (const chunk of await item.createReadStream()) chunks.push(chunk);
    names.push(readZip(Buffer.concat(chunks)).map(entry => entry.name));
  }
  expect(names[0][0]).toBe('001 - Chapter 1.md'); expect(names[0].at(-1)).toBe('100 - Chapter 100.md');
  expect(names[1]).toEqual(['101 - Chapter 101.md']);
});
