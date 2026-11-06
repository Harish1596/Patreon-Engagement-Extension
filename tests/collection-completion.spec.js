const { startCollectionDownload } = require("./helpers/collection-choice");
const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const formats = page => page.frameLocator('iframe[title="Collection export formats"]');
const report = page => page.locator(".download-report");
async function fixture(page, count = 2) {
  await setup(page, { url: "https://www.patreon.com/collection/500", content: `<main><h1>Completion collection</h1>${Array.from({ length: count }, (_, index) => `<a class="fixture_gridCard" href="/posts/${101 + index}">Chapter ${index + 1}</a>`).join("")}</main>` });
  await page.evaluate(count => { globalThis.collectionBuildResult = { files: Array.from({ length: count }, (_, index) => ({
    title: `Chapter ${index + 1}`, extension: "md", encoding: "text", data: `Body ${index + 1}`
  })), skipped: 0 }; }, count);
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
}
async function download(page) {
  const previous = await page.evaluate(() => globalThis.collectionArchiveHandoffs?.length || 0);
  await startCollectionDownload(formats(page), "Markdown");
  await expect.poll(() => page.evaluate(() => globalThis.collectionArchiveHandoffs?.length || 0)).toBeGreaterThan(previous);
  await expect(formats(page).locator("#download-collection")).toBeEnabled();
}
async function result(page, index, state, reason) {
  await page.evaluate(({ index, state, reason }) => deliverBackgroundMessage({
    type: "COLLECTION_ARCHIVE_RESULT", id: collectionArchiveHandoffs[index].id, state, reason
  }), { index, state, reason });
}

test("completed results update a closed summary and survive reopening without a save action", async ({ page }) => {
  await fixture(page); await download(page);
  await expect(report(page)).toContainText("2 saving");
  await page.getByRole("button", { name: "Close collection download" }).click();
  await result(page, 0, "complete");
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(report(page).locator(".report-totals")).toContainText("All 2 posts downloaded.");
  await expect(report(page).getByRole("button")).toHaveCount(0);
  await expect(report(page).locator(".download-parts")).toHaveCount(0);
  await result(page, 0, "interrupted", "Late duplicate");
  await expect(report(page).locator(".report-totals")).toContainText("All 2 posts downloaded.");
});

test("terminal results arriving before PACKAGE replies are not overwritten", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionEarlyCompletion = true; });
  await download(page);
  await expect(report(page).locator(".report-totals")).toContainText("All 2 posts downloaded.");
  await expect(report(page)).not.toContainText("2 saving");
});

test("results require a background sender and the current report's part identifier", async ({ page }) => {
  await fixture(page); await download(page);
  await page.evaluate(() => deliverExtensionMessage({ type: "COLLECTION_ARCHIVE_RESULT", id: collectionArchiveHandoffs[0].id, state: "complete" }));
  await expect(report(page).locator(".report-totals")).toContainText("2 saving");
  await download(page);
  await result(page, 0, "complete");
  await expect(report(page).locator(".report-totals")).toContainText("2 saving");
  await result(page, 1, "interrupted", "The download was cancelled in the browser.");
  await expect(report(page).locator(".report-totals")).toContainText("2 failed");
  await expect(report(page)).toContainText("The download was cancelled in the browser");
});

test("numbered part completion and interruption remain independent", async ({ page }) => {
  test.setTimeout(60_000);
  await fixture(page, 101); await download(page);
  await result(page, 1, "interrupted", "The device has insufficient disk space.");
  await result(page, 0, "complete");
  await expect(report(page).locator(".report-totals")).toContainText("100 of 101 posts downloaded");
  await expect(report(page).locator(".report-totals")).toContainText("1 failed");
  await expect(report(page).locator(".report-issues li")).toHaveCount(1);
  await expect(report(page).locator(".report-issues li")).toContainText("Chapter 101");
  await expect(report(page)).toContainText("insufficient disk space");
});

test("unavailable history stays unconfirmed and expired reports ignore late results", async ({ page }) => {
  await page.clock.install();
  await fixture(page); await download(page);
  await result(page, 0, "unavailable", "The browser download record is unavailable. Completion could not be confirmed.");
  await expect(report(page)).toContainText("Download completion could not be confirmed");
  await expect(report(page).locator(".report-totals")).toContainText("2 unconfirmed");
  await page.clock.fastForward(2 * 60 * 60_000 + 1000);
  await expect(report(page)).toBeHidden();
  await result(page, 0, "complete");
  await expect(report(page)).toBeHidden();
});
