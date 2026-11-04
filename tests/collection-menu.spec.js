const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const menu = page => page.getByRole("dialog", { name: "Download Collection", exact: true });
const frame = page => page.frameLocator('iframe[title="Collection export formats"]');
async function fixture(page) {
  await setup(page, { url: "https://www.patreon.com/collection/500", content: '<main><h1>Collection</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Second</a></main>' });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 posts are ready");
  await expect(frame(page).getByRole("button", { name: "Markdown", exact: true })).toBeEnabled();
}
for (const [theme, width, height] of [["light", 1280, 900], ["dark", 1280, 900], ["dark", 360, 740]]) {
  test(`${theme} ${width}px menu shows all choices without clipping or an inner scrollbar`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: theme });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await fixture(page);
    await expect(frame(page).getByRole("button", { name: "Single EPUB", exact: true })).toHaveAccessibleDescription("Read chapters together in an ebook reader.");
    await expect(frame(page).getByRole("button", { name: "EPUB", exact: true })).toHaveAccessibleDescription("One ebook per chapter, in a ZIP archive.");
    await expect(frame(page).getByRole("button", { name: "Markdown", exact: true })).toHaveAccessibleDescription("Editable text files, one per chapter, in a ZIP archive.");
    await expect(page.locator(".progress-details")).not.toHaveAttribute("open");
    const bounds = await page.locator('iframe[title="Collection export formats"]').boundingBox();
    const panel = await menu(page).boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0); expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    const geometry = await frame(page).locator("body").evaluate(body => ({
      height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight,
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      buttons: [...body.querySelectorAll("button")].map(node => ({ bottom: node.getBoundingClientRect().bottom, height: node.getBoundingClientRect().height }))
    }));
    expect(geometry.scrollHeight).toBeLessThanOrEqual(Math.ceil(bounds.height));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
    expect(geometry.buttons.every(button => button.height >= 44 && button.bottom <= geometry.height)).toBe(true);
    await page.screenshot({ path: `/tmp/collection-menu-${theme}-${width}.png` });
    await frame(page).getByRole("button", { name: "Markdown", exact: true }).focus();
    await expect(frame(page).getByRole("button", { name: "Markdown", exact: true })).toBeFocused();
    const download = page.waitForEvent("download"); await page.keyboard.press("Enter"); await download;
    await expect(page.getByRole("status")).toContainText("ZIP download started");
    expect(errors).toEqual([]);
  });
}

test("chooser follows enlarged text and accepts resize messages only from its current frame and token", async ({ page }) => {
  await fixture(page);
  const iframe = page.locator('iframe[title="Collection export formats"]');
  await frame(page).locator("body").evaluate(body => {
    const style = document.createElement("style");
    style.textContent = '.title{font-size:22px}.description{font-size:18px}button{padding:20px}';
    body.append(style);
  });
  await expect.poll(() => iframe.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(300);
  const resized = await iframe.evaluate(node => node.style.height);
  await frame(page).locator("body").evaluate(() => parent.postMessage({ source: "patreon-reader-collection-size", token: "old-token", height: 500 }, "https://www.patreon.com"));
  await expect(iframe).toHaveCSS("height", resized);
  await frame(page).locator("body").evaluate(() => parent.postMessage({ source: "patreon-reader-collection-size", token: location.hash.slice(1), height: 50000 }, "https://www.patreon.com"));
  await expect(iframe).toHaveCSS("height", resized);
  const geometry = await frame(page).locator("body").evaluate(() => ({ height: document.documentElement.clientHeight, bottom: document.querySelector('button:last-child').getBoundingClientRect().bottom }));
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  await frame(page).getByRole("button", { name: "Markdown", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Download Collection", exact: true })).toBeFocused();
});
