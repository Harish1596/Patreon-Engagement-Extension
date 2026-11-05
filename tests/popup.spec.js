const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { fixture, extensionRoot, setup, button, dialog, enable, change } = require("./helpers/reader");

test("compact popup keeps text and switches within its 320px layout", async ({ page }) => {
  const fs = require("node:fs");
  const html = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8")
    .replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.addStyleTag({ path: path.join(extensionRoot, "popup/popup.css") });
  await page.evaluate(() => { chrome.runtime.getManifest = () => ({ version: "1.1.1" }); });
  await page.addScriptTag({ path: path.join(extensionRoot, "popup/popup.js") });
  await expect(page.getByText("Runs locally on Patreon post pages", { exact: true })).toHaveCount(0);
  await expect(page.locator(".scope-note, .lock")).toHaveCount(0);
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator("body")).toHaveCSS("width", "320px");
    for (const status of ["Preferences apply to all posts", "Open a Patreon post or collection to get started.",
      "Reader controls not found on this post", "Unable to save. Please try again."]) {
      await page.locator("#status").evaluate((node, text) => { node.textContent = text; }, status);
      const fits = await page.evaluate(() => {
        const body = document.body.getBoundingClientRect();
        return [...document.querySelectorAll(".app-header, .identity-row, .version, .tagline, .setting, .setting-copy, .switch, #status, .download-hint")]
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
  await expect(page.locator("#status")).toHaveText("Open a Patreon post or collection to get started.");
  await page.evaluate(async () => { globalThis.failMessage = true; await showPageStatus(); });
  await expect(page.locator("#status")).toHaveText("Open a Patreon post or collection to get started.");
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
  const links = page.getByRole("navigation", { name: "Community" });
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    await expect(page.getByRole("heading", { name: "Community", exact: true })).toBeVisible();
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

for (const namespace of ["chrome", "browser"]) {
  test(`${namespace} popup separates product identity from contextual page status`, async ({ page }) => {
    const fs = require("node:fs");
    const html = fs.readFileSync(path.join(extensionRoot, "popup/popup.html"), "utf8")
      .replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
    await setup(page, { content: html, namespace });
    await page.evaluate(namespace => {
      globalThis[namespace].runtime.getManifest = () => ({ version: "9.8.7" });
    }, namespace);
    await page.addScriptTag({ path: path.join(extensionRoot, "popup/popup.js") });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Patreon Reader");
    await expect(page.locator("#version")).toHaveText("v9.8.7");
    await expect(page.locator(".app-header")).toContainText("Reading comfort. Offline access.");
    await expect(page.locator(".app-header #status")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Reading preferences", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Page status", exact: true })).toContainText("Preferences apply to all posts");
    await expect(page.getByText("Download posts and collections from their Patreon pages.", { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      globalThis.pageReply = { isPostPage: false, collectionDownloadMounted: true };
      await showPageStatus();
    });
    await expect(page.locator("#status")).toHaveText("Collection downloads are available on this page");
    await page.evaluate(async namespace => {
      const api = globalThis[namespace];
      api.tabs.query = namespace === "browser" ? async () => [{ id: 1, url: "https://www.patreon.com/collection/500" }]
        : (options, done) => done([{ id: 1, url: "https://www.patreon.com/collection/500" }]);
      globalThis.failMessage = true;
      await showPageStatus();
    }, namespace);
    await expect(page.locator("#status")).toHaveText("Refresh this page to enable Patreon Reader.");
    await page.evaluate(async namespace => {
      const api = globalThis[namespace];
      api.tabs.query = namespace === "browser" ? async () => [{ id: 1, url: "https://example.com/" }]
        : (options, done) => done([{ id: 1, url: "https://example.com/" }]);
      await showPageStatus();
    }, namespace);
    await expect(page.locator("#status")).toHaveText("Open a Patreon post or collection to get started.");
  });
}
