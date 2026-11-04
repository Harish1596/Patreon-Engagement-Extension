const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const panel = page => page.getByRole("dialog", { name: "Download Collection", exact: true });
const formats = page => page.frameLocator('iframe[title="Collection export formats"]');
async function ready(page) {
  await setup(page, { url: "https://www.patreon.com/collection/500", content: '<main><h1>Recovery collection</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Second</a></main>' });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
}
async function withinPanel(page, control) {
  const box = await control.boundingBox(), bounds = await panel(page).boundingBox();
  expect(box).not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(bounds.y);
  expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
}

test("collection is a nonmodal panel with focus entry and predictable return", async ({ page }) => {
  await ready(page);
  await expect(panel(page)).toHaveAttribute("aria-modal", "false");
  await expect(panel(page)).toBeFocused();
  await page.getByRole("button", { name: "Close collection download" }).click();
  await expect(panel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Download Collection", exact: true })).toBeFocused();
});

test("narrow busy panel keeps Cancel visible and can be dismissed without stopping work", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await ready(page);
  await page.evaluate(() => { globalThis.collectionMessageHolds = ["BUILD_COLLECTION_EXPORT"]; });
  await formats(page).getByRole("button", { name: "Markdown", exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("BUILD_COLLECTION_EXPORT");
  await withinPanel(page, page.getByRole("button", { name: "Cancel", exact: true }));
  await expect(page.locator('iframe[title="Collection export formats"]')).toBeHidden();
  const preparations = await page.evaluate(() => collectionPrepareCount);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Download Collection", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Building post");
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(preparations);
  const download = page.waitForEvent("download");
  await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
  await download;
  await expect(page.getByRole("status")).toContainText("ZIP download started");
});

test("Retry stays visible with an expanded failure report and preserves prepared chapters", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await ready(page);
  await page.evaluate(() => { globalThis.collectionFailedIndices = [1]; });
  await formats(page).getByRole("button", { name: "Markdown", exact: true }).click();
  const retry = page.getByRole("button", { name: "Retry failed posts", exact: true });
  await expect(retry).toBeVisible();
  await page.locator(".download-report summary").click();
  await withinPanel(page, retry);
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; });
  const download = page.waitForEvent("download"); await retry.click(); await download;
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1, 1]);
});
