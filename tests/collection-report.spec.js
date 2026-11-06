const { startCollectionDownload } = require("./helpers/collection-choice");
const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const report = page => page.locator('[data-patreon-collection-download]').locator('.download-report');
const formats = page => page.frameLocator('iframe[title="Collection export formats"]');
async function fixture(page) {
  await setup(page, { content: '<main><h1>Report collection</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Second</a></main>', url: "https://www.patreon.com/collection/500" });
  await page.evaluate(() => { globalThis.collectionPreparationOverrides = {
    count: 2, postUrls: ["https://www.patreon.com/posts/101", "https://www.patreon.com/posts/102"],
    postTitles: ['First <img src=x onerror=alert(1)>', "Second"], skipped: 1,
    skippedPosts: [{ url: "https://www.patreon.com/posts/103?secret=private", title: "Unavailable post", reason: "No supported text body was available." }]
  }; });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
}

test("download summary counts skipped posts, lists failures and updates a successful retry", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionFailedIndices = [1]; });
  await startCollectionDownload(formats(page), "Single EPUB");
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeVisible();
  await expect(report(page)).toContainText("1 skipped");
  expect(await report(page).locator("img").count()).toBe(0);
  await expect(report(page)).toContainText("Failed · Synthetic chapter failure.");
  await expect(report(page)).toContainText("1 failed");
  await expect(report(page)).toContainText("Nothing downloaded");
  await expect(report(page).locator(".report-issues li")).toHaveCount(1);
  await expect(report(page)).not.toContainText("secret=private");
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Retry failed posts", exact: true }).click(); await pending;
  await expect(report(page)).toContainText("2 saving");
  await expect(report(page)).toContainText("The browser is saving the file");
  await expect(report(page).locator(".report-issues li")).toHaveCount(0);
  await page.getByRole("button", { name: "Close collection download" }).click();
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(report(page)).toContainText("2 saving");
  const next = page.waitForEvent("download");
  await startCollectionDownload(formats(page), "Markdown"); await next;
  await expect(report(page)).toContainText("2 saving");
  await expect(report(page).getByRole("button")).toHaveCount(0);
});

test("packaging failure keeps prepared outcomes and sanitizes failure messages", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.failArchivePackaging = true; });
  await startCollectionDownload(formats(page), "Markdown");
  await expect(page.getByRole("button", { name: "Retry packaging" })).toBeVisible();
  await expect(report(page)).toContainText("Packaging failed");
  await expect(report(page)).toContainText("0 of 3 posts downloaded");
  await expect(report(page).locator(".report-issues li")).toHaveCount(0);
});

test("all locked posts show skipped totals without inventing failures or starting a download", async ({ page }) => {
  await setup(page, { content: '<main><h1>Locked collection</h1></main>', url: "https://www.patreon.com/collection/500" });
  await page.route("https://www.patreon.com/api/posts?**", route => route.fulfill({ json: { data: [101, 102].map(id => ({ id: String(id), type: "post", attributes: { title: `Locked ${id}`, current_user_can_view: false } })), meta: { pagination: { total: 2 } } } }));
  await page.evaluate(() => {
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, "getEntriesByType", { value: type => type === "resource"
      ? [...original(type), { name: "https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500" }] : original(type) });
  });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await startCollectionDownload(formats(page), "Markdown");
  await expect(page.getByRole("status")).toContainText("All 2 posts are locked");
  await expect(report(page).locator('.report-issues li')).toHaveCount(0);
  await expect(report(page)).toContainText("2 skipped");
  await expect(report(page)).toContainText("0 of 2 posts downloaded");
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
});

test("cancelled chapters are reported and navigation removes the report", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionMessageHolds = ["BUILD_COLLECTION_EXPORT"]; });
  await startCollectionDownload(formats(page), "Markdown");
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("BUILD_COLLECTION_EXPORT");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cancelled");
  await expect(report(page)).toContainText("Cancelled. Nothing downloaded");
  await expect(report(page)).toContainText("2 cancelled");
  await page.evaluate(() => globalThis.releaseCollectionMessage());
  await page.goto("https://www.patreon.com/home");
  expect(await page.locator('[data-patreon-collection-download]').count()).toBe(0);
});

test("export errors redact remote URLs in the summary and expire after two hours", async ({ page }) => {
  await page.clock.install();
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionBuildResult = { error: 'Image request failed: https://media.example/image?signature=private-secret' }; });
  await startCollectionDownload(formats(page), "Markdown");
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeVisible();
  const text = await report(page).textContent();
  expect(text).toContain("[URL omitted]"); expect(text).not.toContain("private-secret");
  await page.clock.fastForward(2 * 60 * 60_000 + 1000);
  await expect(report(page)).toBeHidden();
});

for (const width of [360, 1280]) test(`report replaces progress and summarizes 75 posts at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 740 : 900 });
  await setup(page, { content: '<main><h1>Summary collection</h1><a class="fixture_gridCard" href="/posts/101">First</a></main>', url: "https://www.patreon.com/collection/500" });
  await page.evaluate(() => {
    globalThis.collectionPreparationOverrides = { count: 75, postUrls: Array.from({ length: 75 }, (_, i) => `https://www.patreon.com/posts/${101 + i}`), skipped: 0 };
    globalThis.collectionBuildResult = { files: Array.from({ length: 75 }, (_, i) => ({ title: `Chapter ${i + 1}`, extension: "md", encoding: "text", data: "Body" })), skipped: 0 };
    globalThis.collectionMessageHolds = ["COLLECTION_ARCHIVE_PACKAGE"];
  });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(report(page)).toBeHidden();
  await startCollectionDownload(formats(page), "Markdown");
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("COLLECTION_ARCHIVE_PACKAGE");
  await expect(page.locator(".progress-details")).toBeVisible();
  await expect(report(page)).toBeHidden();
  const pending = page.waitForEvent("download");
  await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
  await pending;
  await expect(report(page)).toBeVisible();
  await expect(page.locator(".progress-details")).toBeHidden();
  await expect(report(page).getByRole("heading", { name: "Download report", exact: true })).toBeVisible();
  await expect(report(page).locator("summary")).toHaveCount(0);
  await expect(report(page).locator(".report-totals")).toContainText("75 saving");
  await expect(report(page).locator(".report-issues li")).toHaveCount(0);
  await page.evaluate(() => deliverBackgroundMessage({ type: "COLLECTION_ARCHIVE_RESULT", id: collectionArchiveHandoffs[0].id, state: "complete" }));
  await expect(report(page).locator(".report-totals")).toContainText("All 75 posts downloaded.");
  await expect(report(page)).not.toContainText("0 skipped");
  const box = await report(page).boundingBox();
  expect(box.height).toBeLessThan(300);
  const overflow = await report(page).evaluate(node => node.scrollWidth > node.clientWidth);
  expect(overflow).toBe(false);
  await expect(report(page).getByRole("button")).toHaveCount(0);
  expect(await report(page).evaluate(node => node === node.parentElement.lastElementChild)).toBe(true);
  // Starting another attempt replaces the previous summary until work stops.
  await page.evaluate(() => { globalThis.collectionMessageHolds = ["BUILD_COLLECTION_EXPORT"]; });
  await startCollectionDownload(formats(page), "Markdown");
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("BUILD_COLLECTION_EXPORT");
  await expect(report(page)).toBeHidden();
  await expect(page.locator(".progress-details")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(report(page)).toBeVisible();
  await expect(page.locator(".progress-details")).toBeHidden();
  await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
});

test('bottom summary has no save action or file inventory and never hides a skipped post in all-success wording', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionEarlyCompletion = true; });
  const pending = page.waitForEvent('download');
  await startCollectionDownload(formats(page), 'Markdown'); await pending;
  await expect(report(page)).toBeVisible();
  await expect(report(page).getByRole('button', { name: 'Save report' })).toHaveCount(0);
  await expect(report(page).locator('.download-parts')).toHaveCount(0);
  await expect(report(page).locator('.report-totals')).toContainText('2 of 3 posts downloaded');
  await expect(report(page)).toContainText('1 skipped');
  await expect(report(page)).not.toContainText('All 3 posts downloaded');
  expect(await report(page).evaluate(node => node === node.parentElement.lastElementChild)).toBe(true);
});
