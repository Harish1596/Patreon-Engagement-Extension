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

test('browser PDF preserves U+1E2A and related diacritics across styled text', async ({ page }) => {
  await pdfWorkerFixture(page);
  const data = await page.evaluate(async snapshot => {
    const input = PatreonPdf.chapter({ ...snapshot, title: 'Chapter Ḫ', author: 'Creator ḫ', body: { tag: 'div', children: [
      { tag: 'p', children: ['Normal Ḫ ḫ Ṭ ṭ Ḥ ḥ'] },
      { tag: 'p', children: [{ tag: 'strong', children: ['Bold Ḫ'] }] },
      { tag: 'p', children: [{ tag: 'em', children: ['Italic Ḫ'] }] },
      { tag: 'p', children: [{ tag: 'strong', children: [{ tag: 'em', children: ['Both Ḫ'] }] }] }
    ] } });
    return Array.from(await pdfFixtureRender([input]));
  }, chapter);
  const doc = await inspectPdf(data), text = doc.pages.map(page => page.text).join(' ').normalize('NFC');
  for (const expected of ['Chapter Ḫ', 'Creator ḫ', 'Normal Ḫ ḫ Ṭ ṭ Ḥ ḥ', 'Bold Ḫ', 'Italic Ḫ', 'Both Ḫ']) expect(text).toContain(expected);
});

test('browser PDF uses cuneiform fallback in mixed text, contents and links', async ({ page }) => {
  await pdfWorkerFixture(page);
  const data = await page.evaluate(async snapshot => {
    const input = PatreonPdf.chapter({ ...snapshot, title: 'Chapter Ḫ𒀭', author: 'Creator𒀭', body: { tag: 'div', children: [
      { tag: 'p', children: ['Before𒀭after Ḫ'] },
      { tag: 'p', children: [{ tag: 'strong', children: ['Bold𒀭'] }] },
      { tag: 'p', children: [{ tag: 'em', children: ['Italic𒀭'] }] },
      { tag: 'p', children: [{ tag: 'strong', children: [{ tag: 'em', children: ['Both𒀭'] }] }] },
      { tag: 'p', children: [{ tag: 'a', href: 'https://example.com/cuneiform', children: ['Link𒀭'] }] }
    ] } });
    return Array.from(await pdfFixtureRender([input], { title: 'Collection𒀭', source: 'https://www.patreon.com/collection/500', downloadedAt: 'Today' }));
  }, chapter);
  const doc = await inspectPdf(data);
  expect(doc.metadata.info.Title).toBe('Collection𒀭');
  expect(doc.pages[0].text).toMatch(/Chapter Ḫ\s*𒀭/);
  expect(doc.pages[0].annotations.some(item => item.dest)).toBe(true);
  for (const pattern of [/Creator\s*𒀭/, /Before\s*𒀭\s*after Ḫ/, /Bold\s*𒀭/, /Italic\s*𒀭/, /Both\s*𒀭/, /Link\s*𒀭/]) expect(doc.pages[1].text).toMatch(pattern);
  expect(doc.pages[1].annotations.some(item => item.url === 'https://example.com/cuneiform')).toBe(true);
});

test('CJK fallback loads only for needed text and preserves mixed-script PDF styles and links', async ({ page }) => {
  await pdfWorkerFixture(page);
  let imports = 0;
  await page.route('https://www.patreon.com/pdf-assets/vendor/pdfmake/vfs_cjk.js', route => {
    imports++;
    return route.fulfill({ contentType: 'text/javascript', path: require('node:path').resolve(__dirname, '../extension/vendor/pdfmake/vfs_cjk.js') });
  });
  await page.evaluate(async snapshot => pdfFixtureRender([PatreonPdf.chapter(snapshot)]), chapter);
  expect(imports).toBe(0);
  const data = await page.evaluate(async snapshot => {
    const input = PatreonPdf.chapter({ ...snapshot, title: 'Chapter 天 Ḫ𒀭', author: 'Creator 天', body: { tag: 'div', children: [
      { tag: 'p', children: ['Regular 天地玄黃 中文 简体 繁體 Ḫ𒀭'] },
      { tag: 'p', children: [{ tag: 'strong', children: ['Bold 天地'] }] },
      { tag: 'p', children: [{ tag: 'em', children: ['Italic 天地'] }] },
      { tag: 'p', children: [{ tag: 'strong', children: [{ tag: 'em', children: ['Both 天地'] }] }] },
      { tag: 'p', children: [{ tag: 'a', href: 'https://example.com/cjk', children: ['Link 天地'] }] }
    ] } });
    return Array.from(await pdfFixtureRender([input], { title: 'Collection 天', source: 'https://www.patreon.com/collection/500', downloadedAt: 'Today' }));
  }, chapter);
  expect(imports).toBe(1);
  const doc = await inspectPdf(data);
  expect(doc.metadata.info.Title).toBe('Collection 天');
  expect(doc.pages[0].text.replace(/\s/g, '')).toContain('Chapter天Ḫ𒀭');
  expect(doc.pages[0].annotations.some(item => item.dest)).toBe(true);
  for (const expected of ['Creator天', 'Regular天地玄黃中文简体繁體Ḫ𒀭', 'Bold天地', 'Italic天地', 'Both天地', 'Link天地']) expect(doc.pages[1].text.replace(/\s/g, '')).toContain(expected);
  expect(doc.pages[1].annotations.some(item => item.url === 'https://example.com/cjk')).toBe(true);
});
