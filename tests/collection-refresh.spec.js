const { startCollectionDownload } = require("./helpers/collection-choice");
const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
async function fixture(page) {
  await setup(page, { content: '<main><h1>Incremental collection</h1></main>', url: "https://www.patreon.com/collection/500" });
  await page.evaluate(() => {
    globalThis.refreshPosts = [101, 102, 103].map(id => ({ id: String(id), type: "post", attributes: {
      title: `Post ${id}`, current_user_can_view: true, content_json_string: JSON.stringify({ type: "doc", content: [{ text: `Body ${id}` }] })
    } }));
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, "getEntriesByType", { value: type => type === "resource"
      ? [...original(type), { name: "https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500" }] : original(type) });
  });
  await page.route("https://www.patreon.com/api/posts**", async route => {
    const posts = await page.evaluate(() => refreshPosts);
    await route.fulfill({ json: { data: posts, meta: { pagination: { total: posts.length } } } });
  });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  await download(page);
}

async function download(page) {
  const pending = page.waitForEvent("download");
  await startCollectionDownload(page.frameLocator('iframe[title="Collection export formats"]'), "Markdown");
  await pending;
  await expect(page.getByRole("status")).toContainText("ZIP download started");
}

test("refresh rediscovery sends full-content fingerprints in fresh order using the existing owner token", async ({ page }) => {
  await fixture(page);
  const first = await page.evaluate(() => collectionPrepareRequests[0]);
  expect(first.revisions).toHaveLength(3);
  await page.evaluate(() => {
    // Initial deferred registration may discard an empty stale token. Refresh
    // itself must preserve the established source namespace.
    delete globalThis.collectionExportCancelled;
    refreshPosts = [refreshPosts[2], { id: "104", type: "post", attributes: { title: "New post", current_user_can_view: true, content_json_string: '{"text":"New body"}' } }, refreshPosts[1]];
    refreshPosts[2].attributes.content_json_string = '{"text":"Edited body"}';
    globalThis.collectionPreparationOverrides = { reused: 1 };
  });
  await page.getByRole("button", { name: "Refresh collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  await download(page);
  const refreshed = await page.evaluate(() => collectionPrepareRequests[1]);
  expect(refreshed.token).toBe(first.token); expect(refreshed.refresh).toBe(true);
  expect(refreshed.urls).toEqual([103, 104, 102].map(id => `https://www.patreon.com/posts/${id}`));
  expect(refreshed.revisions[0]).toEqual(first.revisions[2]);
  expect(refreshed.revisions[2].revision).not.toBe(first.revisions[1].revision);
  expect(await page.evaluate(() => globalThis.collectionExportCancelled)).toBeUndefined();
});

test("refresh excludes newly locked posts and does not trust missing full content or unknown access", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => {
    refreshPosts[0].attributes.current_user_can_view = false;
    refreshPosts[1].attributes.content_json_string = null;
    delete refreshPosts[2].attributes.current_user_can_view;
  });
  await page.getByRole("button", { name: "Refresh collection", exact: true }).click();
  await download(page);
  const next = await page.evaluate(() => collectionPrepareRequests[1]);
  expect(next.revisions).toEqual([]);
  expect(next.urls).toEqual([102, 103].map(id => `https://www.patreon.com/posts/${id}`));
  await page.evaluate(() => { refreshPosts.forEach(post => { post.attributes.current_user_can_view = false; }); });
  await page.getByRole("button", { name: "Refresh collection", exact: true }).click();
  await startCollectionDownload(page.frameLocator('iframe[title="Collection export formats"]'), "Markdown");
  await expect(page.getByRole("status")).toContainText("All 3 posts are locked");
  expect(await page.evaluate(() => collectionExportCancelled)).toBe(true);
});
