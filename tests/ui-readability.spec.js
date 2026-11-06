const { startCollectionDownload } = require("./helpers/collection-choice");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { setup, extensionRoot } = require("./helpers/reader");
function luminance(rgb) {
  return rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, index) => sum + v * [.2126, .7152, .0722][index], 0);
}
for (const theme of ["light", "dark"]) {
  test(`${theme} collection descriptions include archive type`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await setup(page, { url: "https://www.patreon.com/collection/500", content: '<main><h1>Collection</h1><a class="fixture_gridCard" href="/posts/101">First</a></main>' });
    await page.getByRole("button", { name: "Download Collection", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Choose a format");
    const frame = page.frameLocator('iframe[title="Collection export formats"]');
    const packaging = frame.getByRole("radio", { name: "Separate files (ZIP)", exact: true });
    await expect(packaging).toBeEnabled();
    await packaging.press("Space");
    await expect(packaging).toBeChecked();
    await expect(frame.locator("#download-collection")).toHaveAccessibleDescription(/ZIP/);
    const markdown = frame.getByRole("radio", { name: "Markdown", exact: true });
    await expect(markdown).toBeEnabled();
    await markdown.press("Space");
    await expect(markdown).toBeChecked();
    await expect(frame.locator("#download-collection")).toHaveAccessibleDescription(/editable.*ZIP/i);

  });
  test(`${theme} disclosure contrast meets the normal-text target`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await setup(page, { url: "https://www.patreon.com/collection/500", content: '<main><h1>Collection</h1><a class="fixture_gridCard" href="/posts/101">First</a></main>' });
    await page.getByRole("button", { name: "Download Collection", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Choose a format");
    await page.evaluate(() => { globalThis.collectionMessageHolds = ["BUILD_COLLECTION_EXPORT"]; });
    await startCollectionDownload(page.frameLocator('iframe[title="Collection export formats"]'), "Markdown");
    await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("BUILD_COLLECTION_EXPORT");
    const colors = await page.locator(".progress-details summary").evaluate(node => ({ text: getComputedStyle(node).color, surface: getComputedStyle(node.closest("section")).backgroundColor }));
    const values = [luminance(colors.text), luminance(colors.surface)].sort((a, b) => b - a);
    expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
  });
}

test("post formats explain PDF, ebook and editing workflows in their accessible descriptions", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Download post", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Post export formats"]');
  await expect(frame.getByRole("button", { name: "PDF", exact: true })).toHaveAccessibleDescription(/download.*document.*text.*images/i);
  await expect(frame.getByRole("button", { name: "EPUB", exact: true })).toHaveAccessibleDescription(/ebook reader/i);
  await expect(frame.getByRole("button", { name: "Markdown", exact: true })).toHaveAccessibleDescription(/editable.*text/i);
});

test("popup supporting text is at least 12px and fits the existing narrow layout", async ({ page }) => {
  const html = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8").replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.addStyleTag({ path: path.join(extensionRoot, "popup/popup.css") });
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    const geometry = await page.locator(".setting-description, .tagline").evaluateAll(nodes => nodes.map(node => ({ size: parseFloat(getComputedStyle(node).fontSize), overflows: node.scrollWidth > node.clientWidth })));
    expect(geometry.every(node => node.size >= 12 && !node.overflows)).toBe(true);
  }
});
