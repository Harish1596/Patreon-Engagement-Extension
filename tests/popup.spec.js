const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { fixture, extensionRoot, setup, button, dialog, enable, change } = require("./helpers/reader");

test("compact popup keeps text and switches within its 320px layout", async ({ page }) => {
  const fs = require("node:fs");
  const html = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8")
    .replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.addStyleTag({ path: path.join(extensionRoot, "popup/popup.css") });
  await page.addScriptTag({ path: path.join(extensionRoot, "popup/popup.js") });
  await expect(page.getByText("Runs locally on Patreon post pages", { exact: true })).toHaveCount(0);
  await expect(page.locator(".scope-note, .lock")).toHaveCount(0);
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator("body")).toHaveCSS("width", "320px");
    for (const status of ["Preferences apply to all posts", "Open or refresh a Patreon post to connect",
      "Reader controls not found on this post", "Unable to save. Please try again."]) {
      await page.locator("#status").evaluate((node, text) => { node.textContent = text; }, status);
      const fits = await page.evaluate(() => {
        const body = document.body.getBoundingClientRect();
        return [...document.querySelectorAll(".app-header, .setting, .setting-copy, .switch, #status")]
          .every(node => {
            const rect = node.getBoundingClientRect();
            return rect.left >= body.left && rect.right <= body.right && node.scrollWidth <= node.clientWidth;
          }) && [...document.querySelectorAll(".setting")].every(node =>
            node.querySelector(".setting-copy").getBoundingClientRect().right <=
            node.querySelector(".switch").getBoundingClientRect().left);
      });
      expect(fits).toBe(true);
    }
    await expect(page.getByRole("switch", { name: "Enable Reader Customization", exact: true })).toBeVisible();
    await page.getByRole("switch", { name: "Enable Reader Customization", exact: true }).check();
    await expect(page.getByRole("switch", { name: "Enable Reader Customization", exact: true })).toBeChecked();
  }
});

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


test("popup leaves saved media grants to the download flow", async ({ page }) => {
  const fs = require("node:fs");
  const html = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8").replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.evaluate(() => {
    globalThis.permissionCalls = [];
    chrome.permissions = {
      getAll() { permissionCalls.push("getAll"); },
      remove() { permissionCalls.push("remove"); }
    };
  });
  await page.addScriptTag({ path: path.join(extensionRoot, "popup/popup.js") });
  await expect(page.locator("#status")).toHaveText("Preferences apply to all posts");
  await expect(page.getByRole("region", { name: "Media permissions" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Forget media access" })).toHaveCount(0);
  expect(await page.evaluate(() => permissionCalls)).toEqual([]);
});

test("community links open configured destinations below Reader in light and dark modes", async ({ page }) => {
  const fs = require("node:fs");
  const html = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8")
    .replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.addStyleTag({ path: path.join(extensionRoot, "popup/popup.css") });
  await page.evaluate(() => {
    globalThis.PatreonLinks = {
      discord: "https://discord.gg/example", github: "https://github.com/example/repo"
    };
  });
  await page.addScriptTag({ path: path.join(extensionRoot, "popup/popup.js") });
  const links = page.getByRole("navigation", { name: "Support" });
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    await expect(page.getByRole("heading", { name: "Support", exact: true })).toBeVisible();
    await expect(links).toBeVisible();
    const bounds = await links.boundingBox();
    const readerBounds = await page.locator('label[for="reader-toggle"]').boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(readerBounds.y + readerBounds.height);
    for (const [name, url] of [["Discord", "https://discord.gg/example"],
      ["GitHub", "https://github.com/example/repo"]]) {
      const link = page.getByRole("link", { name, exact: true });
      await expect(link).toHaveAttribute("href", url);
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await link.focus();
      await expect(link).toBeFocused();
      const rect = await link.boundingBox();
      expect(rect.width).toBeCloseTo(103, 0);
      expect(rect.height).toBeCloseTo(30, 0);
      await expect(link.locator("svg")).toBeVisible();
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(320);
      await page.context().route(url, route => route.fulfill({ body: "Synthetic destination" }));
      const [opened] = await Promise.all([page.waitForEvent("popup"), link.press("Enter")]);
      await opened.waitForLoadState();
      expect(opened.url()).toBe(url);
      await opened.close();
    }
  }
});
