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
async function reportText(page) {
  if (await report(page).getAttribute("open") === null) await report(page).locator("summary").click();
  const pending = page.waitForEvent("download");
  await report(page).getByRole("button", { name: "Save report" }).click();
  const result = await pending, chunks = [];
  for await (const chunk of await result.createReadStream()) chunks.push(chunk);
  expect(result.suggestedFilename()).toBe("Report collection - Download Report.txt");
  return Buffer.concat(chunks).toString();
}

test("download report lists skipped and failed posts, redacts URLs, and updates a successful retry", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionFailedIndices = [1]; });
  await startCollectionDownload(formats(page), "Single EPUB");
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeVisible();
  await expect(report(page)).toContainText("Unavailable post");
  expect(await report(page).locator("img").count()).toBe(0);
  await expect(report(page)).toContainText("Failed · Synthetic chapter failure.");
  await expect(report(page)).toContainText("Prepared");
  await expect(report(page)).toContainText("Nothing downloaded");
  let text = await reportText(page);
  expect(text).toContain("FAILED:"); expect(text).toContain("SKIPPED: Unavailable post");
  expect(text).not.toContain("secret=private");
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Retry failed posts", exact: true }).click(); await pending;
  await expect(report(page)).toContainText("2 included · 1 skipped · 0 failed");
  await expect(report(page)).toContainText("The browser is saving the file");
  text = await reportText(page);
  expect(text.match(/DOWNLOAD-STARTED:/g)).toHaveLength(2);
  expect(text).not.toContain("FAILED:");
  await page.getByRole("button", { name: "Close collection download" }).click();
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(report(page)).toContainText("2 included");
  const next = page.waitForEvent("download");
  await startCollectionDownload(formats(page), "Markdown"); await next;
  const replaced = await reportText(page);
  expect(replaced).toContain("Format: Markdown files (ZIP)");
  expect(replaced).not.toContain("Format: Single EPUB");
});

test("packaging failure keeps prepared outcomes and sanitizes failure messages", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.failArchivePackaging = true; });
  await startCollectionDownload(formats(page), "Markdown");
  await expect(page.getByRole("button", { name: "Retry packaging" })).toBeVisible();
  await expect(report(page)).toContainText("Collection download failed");
  await expect(report(page)).toContainText("0 included");
  expect((await reportText(page)).match(/PREPARED:/g)).toHaveLength(2);
});

test("all locked posts receive individual report rows without a download", async ({ page }) => {
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
  await report(page).locator('summary').click();
  await expect(report(page).locator('li')).toHaveCount(2);
  await expect(report(page)).toContainText("Locked for your current membership");
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
  expect((await reportText(page)).match(/CANCELLED:/g)).toHaveLength(2);
  await page.evaluate(() => globalThis.releaseCollectionMessage());
  await page.goto("https://www.patreon.com/home");
  expect(await page.locator('[data-patreon-collection-download]').count()).toBe(0);
});

test("export errors redact remote URLs in saved reports and expire after two hours", async ({ page }) => {
  await page.clock.install();
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionBuildResult = { error: 'Image request failed: https://media.example/image?signature=private-secret' }; });
  await startCollectionDownload(formats(page), "Markdown");
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeVisible();
  const text = await reportText(page);
  expect(text).toContain("[URL omitted]"); expect(text).not.toContain("private-secret");
  await page.clock.fastForward(2 * 60 * 60_000 + 1000);
  await expect(report(page)).toBeHidden();
});
