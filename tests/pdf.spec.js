const { test, expect } = require('@playwright/test');
const { pdfWorkerFixture, inspectPdf } = require('./helpers/pdf');
const chapter = { version: 1, postId: '123', title: 'Readable PDF', author: 'Fixture Creator',
  sourceUrl: 'https://www.patreon.com/posts/123', language: 'en', downloadedAt: 'Nov 4, 2026',
  assets: [], body: { tag: 'div', children: [{ tag: 'h2', children: ['Heading'] },
    { tag: 'p', children: ['Hello café Ελληνικά Привет ', { tag: 'strong', children: ['bold'] },
      { tag: 'a', href: 'https://example.com/article', children: ['source link'] }] },
    { tag: 'ul', children: [{ tag: 'li', children: ['First item'] }] }] } };
test.beforeEach(async ({ page }) => {
  await page.route('https://www.patreon.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>PDF fixture</title>' }));
  await page.goto('https://www.patreon.com/posts/123');
});
test('worker generates selectable text, metadata and clickable links without printing', async ({ page }) => {
  await pdfWorkerFixture(page);
  const data = await page.evaluate(async snapshot => Array.from(await pdfFixtureRender([PatreonPdf.chapter(snapshot)])), chapter);
  expect(Buffer.from(data).subarray(0, 5).toString()).toBe('%PDF-');
  const doc = await inspectPdf(data);
  expect(doc.pages[0].text).toContain('Hello café Ελληνικά Привет');
  expect(doc.pages[0].text).toContain('First item');
  expect(doc.pages[0].text).toContain('Fixture Creator');
  expect(doc.metadata.info.Title).toBe('Readable PDF');
  expect(doc.pages[0].annotations.some(x => x.url === 'https://example.com/article')).toBe(true);
});
test('combined PDF preserves chapter order, contents links and new page boundaries', async ({ page }) => {
  await pdfWorkerFixture(page);
  const data = await page.evaluate(async snapshot => {
    const first = PatreonPdf.chapter(snapshot);
    const second = PatreonPdf.chapter({ ...snapshot, title: 'Second chapter', postId: '124', sourceUrl: 'https://www.patreon.com/posts/124' });
    return Array.from(await pdfFixtureRender([first, second], { title: 'Fixture collection', source: 'https://www.patreon.com/collection/500', downloadedAt: 'Nov 4, 2026' }));
  }, chapter);
  const doc = await inspectPdf(data);
  expect(doc.pages.length).toBeGreaterThanOrEqual(3);
  expect(doc.pages[0].text).toContain('Contents');
  expect(new Set(doc.pages[0].annotations.filter(x => x.dest).map(x => JSON.stringify(x.dest))).size).toBe(2);
  expect(doc.pages[1].text).toContain('Readable PDF');
  expect(doc.pages[2].text).toContain('Second chapter');
});
test('malformed sources and missing glyphs fail visibly instead of fetching or dropping text', async ({ page }) => {
  await pdfWorkerFixture(page);
  const errors = await page.evaluate(async snapshot => {
    const result = [];
    for (const input of [{ ...snapshot, body: { tag: 'img', image: 0 }, assets: [{ dataUrl: 'https://private.invalid/image.png' }] },
      { ...snapshot, title: 'Unsupported 😀' }]) {
      try { await pdfFixtureRender([PatreonPdf.chapter(input)]); result.push('no error'); }
      catch (error) { result.push(error.message); }
    }
    return result;
  }, chapter);
  expect(errors[0]).toMatch(/embedded|image/i);
  expect(errors[1]).toMatch(/font|character|glyph/i);
});
test('cancellation terminates rendering with no late result', async ({ page }) => {
  await pdfWorkerFixture(page);
  const message = await page.evaluate(async snapshot => {
    const controller = new AbortController();
    const result = pdfFixtureRender([PatreonPdf.chapter(snapshot)], undefined, controller.signal).then(() => 'completed', e => e.name);
    controller.abort(); return result;
  }, chapter);
  expect(message).toBe('AbortError');
});
