const { startCollectionDownload } = require("./helpers/collection-choice");
const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers/reader');
const { inspectPdf } = require('./helpers/pdf');
const { readZip } = require('./helpers/zip');
const chooser = page => page.frameLocator('iframe[title="Collection export formats"]');
async function fixture(page, count = 2) {
  await setup(page, { url: 'https://www.patreon.com/collection/500', content: '<main><h1>PDF collection</h1>' +
    Array.from({ length: count }, (_, n) => `<a class="fixture_gridCard" href="/posts/${101 + n}">Post ${n + 1}</a>`).join('') + '</main>' });
  // The shared Markdown stress default is a 70,000-character unbroken word;
  // PDF pagination fixtures use representative chapter text and explicit titles.
  await page.evaluate(count => { globalThis.collectionBuildResult = { files: Array.from({ length: count }, (_, n) => ({
    title: `Post ${n + 1}`, extension: 'md', encoding: 'text', data: `Chapter ${n + 1} content for offline reading.`
  })), skipped: 0 }; }, count);
  await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
  await expect(chooser(page).locator("#download-collection")).toBeEnabled();
}
async function download(page, action) {
  const pending = page.waitForEvent('download'); await action();
  const result = await pending, chunks = [];
  for await (const bytes of await result.createReadStream()) chunks.push(bytes);
  return { result, bytes: Buffer.concat(chunks) };
}
for (const format of ['Single PDF', 'PDF']) test(`${format} downloads ordered collection content in the requested container`, async ({ page }) => {
  await fixture(page);
  const { result, bytes } = await download(page, () => startCollectionDownload(chooser(page), format));
  expect(result.suggestedFilename()).toBe(`PDF collection.${format === 'PDF' ? 'zip' : 'pdf'}`);
  if (format === 'PDF') {
    const entries = readZip(bytes);
    expect(entries.map(x => x.name)).toEqual(['001 - Post 1.pdf', '002 - Post 2.pdf']);
    for (const entry of entries) expect((await inspectPdf(entry.data)).pages[0].text).toContain('Source:');
  } else {
    const doc = await inspectPdf(bytes);
    expect(doc.pages[0].text).toContain('Contents');
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[1].text).toContain('Post 1'); expect(doc.pages[2].text).toContain('Post 2');
  }
  await expect(chooser(page).locator("#download-collection")).toBeEnabled();
});
test('PDF failed-post retry retains successful chapters and switching to ZIP changes the output', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionFailedIndices = [1]; });
  await startCollectionDownload(chooser(page), 'PDF');
  await expect(page.getByRole('button', { name: 'Retry failed posts' })).toBeVisible();
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; });
  await download(page, () => page.getByRole('button', { name: 'Retry failed posts' }).click());
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1, 1]);
  await expect(chooser(page).locator("#download-collection")).toBeEnabled();
  const combined = await download(page, () => startCollectionDownload(chooser(page), 'Single PDF'));
  expect(combined.result.suggestedFilename()).toBe('PDF collection.pdf');
});
test('combined PDF packaging retry keeps chapters and cancellation prevents late handoff', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.failArchivePackaging = true; });
  await startCollectionDownload(chooser(page), 'Single PDF');
  await expect(page.getByRole('button', { name: 'Retry packaging' })).toBeVisible();
  await page.evaluate(() => { globalThis.failArchivePackaging = false; });
  const result = await download(page, () => page.getByRole('button', { name: 'Retry packaging' }).click());
  expect((await inspectPdf(result.bytes)).pages).toHaveLength(3);
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1]);
  await expect(chooser(page).locator("#download-collection")).toBeEnabled();
  await page.evaluate(() => { globalThis.collectionMessageHolds = ['COLLECTION_ARCHIVE_PACKAGE']; });
  let late = 0; page.on('download', () => late++);
  await startCollectionDownload(chooser(page), 'Single PDF');
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe('COLLECTION_ARCHIVE_PACKAGE');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => releaseCollectionMessage());
  await expect(page.getByRole('status')).toContainText('Cancelled');
  expect(late).toBe(0);
});
test('101-post combined PDFs are delivered as ordered numbered parts', async ({ page }) => {
  test.setTimeout(90_000);
  await fixture(page, 101);
  const downloads = []; page.on('download', value => downloads.push(value));
  await startCollectionDownload(chooser(page), 'Single PDF');
  await expect.poll(() => downloads.length, { timeout: 60_000 }).toBe(2);
  expect(downloads.map(x => x.suggestedFilename())).toEqual(['PDF collection - Part 001 of 002.pdf', 'PDF collection - Part 002 of 002.pdf']);
});

test('combined PDF errors name all affected posts, keep their data and link report rows across skips', async ({ page }) => {
  await fixture(page, 4);
  await page.evaluate(() => {
    globalThis.collectionSkippedIndices = [1];
    collectionBuildResult.files[0].title = 'Chapter Alpha';
    collectionBuildResult.files[0].data = 'Unsupported sample 😀';
    collectionBuildResult.files[2].title = 'Chapter Gamma';
    collectionBuildResult.files[2].data = 'Unsupported sample א';
  });
  await startCollectionDownload(chooser(page), 'Single PDF');
  await expect(page.getByRole('button', { name: 'Retry packaging', exact: true })).toBeVisible();
  const status = page.getByRole('status');
  await expect(status).toContainText('Post 1'); await expect(status).toContainText('Chapter Alpha');
  await expect(status).toContainText('Post 3'); await expect(status).toContainText('Chapter Gamma');
  const report = page.locator('.download-report');
  for (const [title, url, code] of [['Chapter Alpha', 'https://www.patreon.com/posts/101', 'U+1F600'], ['Chapter Gamma', 'https://www.patreon.com/posts/103', 'U+5D0']]) {
    const row = report.locator('li').filter({ has: page.getByText(title, { exact: true }) });
    await expect(row).toContainText('Failed'); await expect(row).toContainText(code);
    await expect(row.getByRole('link', { name: 'Open post', exact: true })).toHaveAttribute('href', url);
  }
  await expect(report).toContainText('Prepared chapter data is retained for retry.');
  await expect(report).toContainText('2 failed');
  await expect(report.getByRole('button', { name: 'Save report' })).toHaveCount(0);
  await expect(report).not.toContainText('Unsupported sample');
  const builds = await page.evaluate(() => collectionBuildIndices.slice());
  await page.getByRole('button', { name: 'Retry packaging', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry packaging', exact: true })).toBeVisible();
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual(builds);
});
