const { test, expect } = require("@playwright/test");
const { fixture, extensionRoot, setup, button, dialog, enable, change } = require("./helpers/reader");

test("malformed preferences cannot inject CSS or exceed control bounds", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, readerPreferences: {
    font: "__proto__", textSize: 9999, paragraphSpacing: -9, lineSpacing: "url(bad)",
    postColor: "red; } body { display:none", backgroundColor: "url(https://example.com)"
  } } });
  await expect(button(page)).toHaveCount(1);
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "32px");
  await expect(page.locator("#post p").first()).toHaveCSS("margin-bottom", "0px");
  await expect(page.locator("body")).toBeVisible();
  expect(await page.locator("html").getAttribute("style")).not.toContain("url(");
});

test("storage failure is visible; preview survives and retry saves", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true } });
  await button(page).click();
  await page.evaluate(() => { globalThis.failStorage = true; });
  await change(page, "textSize", "25");
  await expect(dialog(page).locator("#save-status")).toContainText("Could not save");
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "25px");
  await page.evaluate(() => { globalThis.failStorage = false; });
  await change(page, "font", "georgia");
  await expect(dialog(page).locator("#save-status")).toHaveText("Saved on this device");
  expect(await page.evaluate(async () => (await readStored()).readerPreferences.textSize)).toBe(25);
});


test("rapid input keeps the latest selection and new sessions restore it", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true } });
  await button(page).click();
  await page.locator("[data-patreon-reader-panel]").evaluate((host) => {
    const input = host.shadowRoot.getElementById("textSize");
    for (const size of [15, 20, 30, 22, 27]) {
      input.value = size; input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await expect.poll(() => page.evaluate(async () => (await readStored()).readerPreferences?.textSize)).toBe(27);
  await expect(dialog(page).locator("#textSize-value")).toHaveText("27px");
  const stored = await page.evaluate(() => readStored());
  await setup(page, { stored });
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "27px");
});

test("changes and enablement propagate to another open post tab", async ({ page, context }) => {
  const stored = { readerEnabled: true };
  await setup(page, { stored });
  const other = await context.newPage();
  await setup(other, { stored });
  await expect(button(other)).toHaveCount(1);
  await button(page).click();
  await change(page, "textSize", "23");
  await expect(other.locator("#post p").first()).toHaveCSS("font-size", "23px");
  await enable(page, false);
  await expect(button(other)).toHaveCount(0);
  await expect(other.locator("#post p").first()).toHaveCSS("font-size", "16px");
});
