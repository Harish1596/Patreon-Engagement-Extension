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
  await expect(page.getByRole("status")).toContainText(`${count} posts are ready`);
  await report(page).locator("summary").click();
}
async function download(page) {
  const previous = await page.evaluate(() => globalThis.collectionArchiveHandoffs?.length || 0);
  await formats(page).getByRole("button", { name: "Markdown", exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionArchiveHandoffs?.length || 0)).toBeGreaterThan(previous);
  await expect(formats(page).getByRole("button", { name: "Markdown", exact: true })).toBeEnabled();
}
async function result(page, index, state, reason) {
  await page.evaluate(({ index, state, reason }) => deliverBackgroundMessage({
    type: "COLLECTION_ARCHIVE_RESULT", id: collectionArchiveHandoffs[index].id, state, reason
  }), { index, state, reason });
}

test("completed results update closed reports, survive reopening, and appear in saved reports", async ({ page }) => {
  await fixture(page); await download(page);
  await expect(report(page)).toContainText("In progress");
  await page.getByRole("button", { name: "Close collection download" }).click();
  await result(page, 0, "complete");
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(report(page).locator(".report-totals")).toContainText("2 completed · 0 interrupted");
  await expect(report(page)).toContainText("Completion collection.zip: Completed");
  const pending = page.waitForEvent("download");
  await report(page).getByRole("button", { name: "Save report" }).click();
  const saved = await pending, chunks = [];
  for await (const chunk of await saved.createReadStream()) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString();
  expect(text.match(/COMPLETED:/g)).toHaveLength(2);
  expect(text).toContain("Completion collection.zip: Completed");
  await result(page, 0, "interrupted", "Late duplicate");
  await expect(report(page).locator(".report-totals")).toContainText("2 completed · 0 interrupted");
});

test("terminal results arriving before PACKAGE replies are not overwritten", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionEarlyCompletion = true; });
  await download(page);
  await expect(report(page).locator(".report-totals")).toContainText("2 completed · 0 interrupted");
  await expect(report(page)).not.toContainText("In progress");
});

test("results require a background sender and the current report's part identifier", async ({ page }) => {
  await fixture(page); await download(page);
  await page.evaluate(() => deliverExtensionMessage({ type: "COLLECTION_ARCHIVE_RESULT", id: collectionArchiveHandoffs[0].id, state: "complete" }));
  await expect(report(page).locator(".report-totals")).toContainText("0 completed · 0 interrupted");
  await download(page);
  await result(page, 0, "complete");
  await expect(report(page).locator(".report-totals")).toContainText("0 completed · 0 interrupted");
  await result(page, 1, "interrupted", "The download was cancelled in the browser.");
  await expect(report(page).locator(".report-totals")).toContainText("0 completed · 2 interrupted");
  await expect(report(page)).toContainText("The download was cancelled in the browser");
});

test("numbered part completion and interruption remain independent", async ({ page }) => {
  test.setTimeout(60_000);
  await fixture(page, 101); await download(page);
  await result(page, 1, "interrupted", "The device has insufficient disk space.");
  await result(page, 0, "complete");
  await expect(report(page).locator(".report-totals")).toContainText("100 completed · 1 interrupted");
  await expect(report(page)).toContainText("Part 001 of 002.zip: Completed");
  await expect(report(page)).toContainText("Part 002 of 002.zip: Interrupted");
});

test("unavailable history stays unconfirmed and expired reports ignore late results", async ({ page }) => {
  await page.clock.install();
  await fixture(page); await download(page);
  await result(page, 0, "unavailable", "The browser download record is unavailable. Completion could not be confirmed.");
  await expect(report(page)).toContainText("Status unavailable");
  await expect(report(page).locator(".report-totals")).toContainText("0 completed · 0 interrupted");
  await page.clock.fastForward(2 * 60 * 60_000 + 1000);
  await expect(report(page)).toBeHidden();
  await result(page, 0, "complete");
  await expect(report(page)).toBeHidden();
});
