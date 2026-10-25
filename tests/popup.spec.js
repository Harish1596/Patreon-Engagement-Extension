const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { fixture, extensionRoot, setup, button, dialog, enable, change } = require("./helpers/reader");

test("popup toggles persist independently and report save failures", async ({ page }) => {
  const fs = require("node:fs");
  const html = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8").replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.addScriptTag({ path: path.join(extensionRoot, "popup/popup.js") });
  const reader = page.getByRole("switch", { name: "Enable Reader Customization", exact: true });
  const engagement = page.getByRole("switch", { name: "Hide engagement bar", exact: true });
  await expect(reader).not.toBeChecked();
  await reader.check();
  await expect(reader).toBeChecked();
  expect(await page.evaluate(async () => (await readStored()).readerEnabled)).toBe(true);
  await expect(engagement).toBeChecked();
  await engagement.uncheck();
  await expect(engagement).not.toBeChecked();
  await page.evaluate(() => { globalThis.failStorage = true; });
  await reader.click();
  await expect(page.locator("#status")).toHaveText("Unable to save. Please try again.");
  await expect(reader).toBeChecked();
});





test("popup distinguishes page connection failures from unsupported or undetected posts", async ({ page }) => {
  const fs = require("node:fs");
  const html = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8").replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.addScriptTag({ path: path.join(extensionRoot, "popup/popup.js") });
  await expect(page.locator("#status")).toHaveText("Preferences apply to all posts");
  await page.evaluate(async () => {
    globalThis.pageReply = { isPostPage: true, readerEnabled: true, readerMounted: false };
    await showPageStatus();
  });
  await expect(page.locator("#status")).toHaveText("Reader controls not found on this post");
  await page.evaluate(async () => { globalThis.pageReply = { isPostPage: false }; await showPageStatus(); });
  await expect(page.locator("#status")).toHaveText("Available on Patreon post pages");
  await page.evaluate(async () => { globalThis.failMessage = true; await showPageStatus(); });
  await expect(page.locator("#status")).toHaveText("Open or refresh a Patreon post to connect");
});
