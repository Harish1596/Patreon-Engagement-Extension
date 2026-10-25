const { test, expect } = require("@playwright/test");
const { setup, button, dialog, enable, change } = require("./helpers/reader");

test("disable removes UI and restores CSS; re-enable restores saved choices", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, readerPreferences: { textSize: 26, font: "verdana" } } });
  await button(page).click();
  await enable(page, false);
  await expect(button(page)).toHaveCount(0);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator("[data-patreon-reader-body]")).toHaveCount(0);
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "16px");
  await enable(page);
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "26px");
});

test("rerenders, post navigation, and leaving posts clean up correctly", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, readerPreferences: { textSize: 22 } } });
  await expect(button(page)).toHaveCount(1);
  const markup = await page.locator("#post").innerHTML();
  await page.locator("#post").evaluate((node, html) => {
    const template = document.createElement("template"); template.innerHTML = html;
    template.content.querySelector("[data-patreon-reader-button]")?.remove();
    node.replaceChildren(template.content);
  }, markup);
  await expect(button(page)).toHaveCount(1);
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "22px");
  await button(page).click();
  await page.evaluate(() => { history.pushState({}, "", "/example/posts/next-124"); document.body.append(document.createElement("div")); });
  await expect(dialog(page)).toHaveCount(0);
  await expect(button(page)).toHaveCount(1);
  await page.evaluate(() => { history.pushState({}, "", "/example"); document.body.append(document.createElement("div")); });
  await expect(button(page)).toHaveCount(0);
  await expect(page.locator("[data-patreon-reader-body]")).toHaveCount(0);
  await page.goBack();
  await expect(button(page)).toHaveCount(1);
});

test("keyboard, outside click, individual reset and narrow layout", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true } });
  await button(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Close reading appearance", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog(page).getByRole("button", { name: "Reset to Patreon defaults", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Close reading appearance", exact: true })).toBeFocused();
  await change(page, "textSize", "28");
  await dialog(page).getByRole("button", { name: "Reset text size to site default", exact: true }).click();
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "16px");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(button(page)).toBeFocused();
  await button(page).click();
  await page.locator("#comment").click();
  await expect(dialog(page)).toBeHidden();
  await page.setViewportSize({ width: 375, height: 667 });
  await button(page).click();
  const bounds = await dialog(page).boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(667);
});
