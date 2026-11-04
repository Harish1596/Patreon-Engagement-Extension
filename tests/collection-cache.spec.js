const { startCollectionDownload } = require('./helpers/collection-choice');
const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers/reader');
const formats = page => page.frameLocator('iframe[title="Collection export formats"]');
const ttl = 2 * 60 * 60_000;
async function fixture(page) {
  await page.clock.install();
  await setup(page, { content: '<main><h1>Cached collection</h1></main>', url: 'https://www.patreon.com/collection/500' });
  await page.evaluate(() => {
    globalThis.cachedPosts = [101, 102, 103].map(id => ({ id: String(id), type: 'post', attributes: {
      title: `Post ${id}`, current_user_can_view: true, content_json_string: JSON.stringify({ text: `Body ${id}` })
    } }));
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, 'getEntriesByType', { value: type => type === 'resource'
      ? [...original(type), { name: 'https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500' }] : original(type) });
  });
  let apiCalls = 0;
  await page.route('https://www.patreon.com/api/posts**', async route => {
    apiCalls++;
    const posts = await page.evaluate(() => cachedPosts);
    await route.fulfill({ json: { data: posts, meta: { pagination: { total: posts.length } } } });
  });
  await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
  return () => apiCalls;
}
async function download(page, format = 'Markdown') {
  const pending = page.waitForEvent('download');
  await startCollectionDownload(formats(page), format); await pending;
  await expect(page.getByRole('status')).toContainText('download started');
}
test('downloads reuse metadata for two hours and rediscover current posts only after expiry', async ({ page }) => {
  const calls = await fixture(page); expect(calls()).toBe(0);
  await download(page);
  const first = await page.evaluate(() => collectionPrepareRequests[0]);
  expect(first.revisions).toHaveLength(3);
  await page.evaluate(() => { cachedPosts = [cachedPosts[2], { id: '104', type: 'post', attributes: {
    title: 'New post', current_user_can_view: true, content_json_string: '{"text":"New body"}'
  } }, cachedPosts[1]]; });
  await page.clock.fastForward(ttl - 60_000);
  await download(page, 'EPUB'); expect(calls()).toBe(1);
  expect(await page.evaluate(() => collectionPrepareRequests.length)).toBe(1);
  await page.clock.fastForward(61_000);
  expect(calls()).toBe(1); // Expiry performs no eager collection reads.
  await download(page);
  expect(calls()).toBe(2);
  const next = await page.evaluate(() => collectionPrepareRequests[1]);
  expect(next.urls).toEqual([102, 103, 104].map(id => `https://www.patreon.com/posts/${id}`));
  expect(next.token).not.toBe(first.token);
  expect(next.deferred).toBe(true); expect(next.refresh).toBeUndefined();
});
test('expiry rediscovery applies current access flags and omits uncertain source fingerprints', async ({ page }) => {
  const calls = await fixture(page); await download(page);
  await page.evaluate(() => {
    cachedPosts[0].attributes.current_user_can_view = false;
    cachedPosts[1].attributes.content_json_string = null;
    delete cachedPosts[2].attributes.current_user_can_view;
  });
  await page.clock.fastForward(ttl + 1000);
  await download(page); expect(calls()).toBe(2);
  const next = await page.evaluate(() => collectionPrepareRequests[1]);
  expect(next.revisions).toEqual([]);
  expect(next.urls).toEqual([102, 103].map(id => `https://www.patreon.com/posts/${id}`));
  await page.evaluate(() => { cachedPosts.forEach(post => { post.attributes.current_user_can_view = false; }); });
  await page.clock.fastForward(ttl + 1000);
  await startCollectionDownload(formats(page), 'Markdown');
  await expect(page.getByRole('status')).toContainText('All 3 posts are locked');
  expect(await page.evaluate(() => collectionPrepareRequests.length)).toBe(2);
});
