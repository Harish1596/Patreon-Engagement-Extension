const { test, expect, chromium } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs");
const { browserExecutable } = require("../scripts/browser-config");
const { readZip } = require("./helpers/zip");

async function downloadBytes(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("installed Brave extension: actual storage, content scripts, and popup", async () => {
  test.skip(process.env.TEST_BROWSER !== "brave", "Uses Brave's unpacked-extension support.");
  const root = path.resolve(__dirname, "../extension");
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath: browserExecutable("brave"),
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  try {
    const manager = await context.newPage();
    await manager.goto("chrome://extensions");
    const extensionId = await manager.evaluate(async () => {
      for (let attempt = 0; attempt < 50; attempt++) {
        const list = document.querySelector("extensions-manager")?.shadowRoot?.querySelector("extensions-item-list");
        const item = [...(list?.shadowRoot?.querySelectorAll("extensions-item") ?? [])]
          .find((node) => node.data?.name === "Patreon Reader");
        if (item) return item.data.id;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Unpacked extension did not load");
    });
    await context.route("https://www.patreon.com/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith("/collection/")) return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>Test collection | Patreon</title></head><body><main>
          <h1>Test collection</h1>
          <a class="IhO0fW_gridCard" href="/posts/201?collection=555">Collection post one</a>
          <a class="IhO0fW_gridCard" href="/posts/202?collection=555">Collection post two</a>
          <a class="IhO0fW_gridCard" href="/posts/201?collection=555">Duplicate link</a>
        </main></body></html>`
      });
      const postNumber = pathname.endsWith("201") ? "one" : pathname.endsWith("202") ? "two" : "";
      let body = fs.readFileSync(path.join(__dirname, "fixtures/installed-post.html"), "utf8");
      if (postNumber) body = body
        .replace("Installed extension test", `Collection post ${postNumber}`)
        .replace("Post content.", `Collection body ${postNumber}.`)
        .replace('</p></div>', '</p><img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\'%3E%3C/svg%3E"><img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\'%3E%3C/svg%3E"></div>');
      return route.fulfill({
        contentType: "text/html",
        // Simulate a framework removing the early-injected flag on initial load.
        body: body.replace("</body>", `<script>addEventListener("load", () => {
          document.documentElement.removeAttribute("data-hide-patreon-floating-engagement");
          document.body.append(document.createElement("div"));
          window.hideFlagRemovedOnLoad = true;
        });</script></body>`)
      });
    });
    const first = await context.newPage();
    await first.goto("https://www.patreon.com/example/posts/test-123");
    const second = await context.newPage();
    await second.goto("https://www.patreon.com/example/posts/test-124");
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup).toHaveTitle("Patreon Reader");
    await expect(popup.locator(".app-mark")).toHaveAttribute("src", "../icons/reader.svg");
    await expect.poll(() => popup.locator(".app-mark").evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const hideToggle = popup.getByRole("switch", { name: "Hide engagement bar", exact: true });
    await expect(hideToggle).toBeChecked();
    await expect(first.locator('[data-tag="floating-engagement-sheet"]')).toBeHidden();
    await expect(second.locator('[data-tag="floating-engagement-sheet"]')).toBeHidden();
    // Persist the setting through the real popup before opening the same post again.
    await hideToggle.uncheck();
    await expect(first.locator('[data-tag="floating-engagement-sheet"]')).toBeVisible();
    await hideToggle.check();
    const fresh = await context.newPage();
    await fresh.goto(first.url());
    await fresh.waitForFunction(() => window.hideFlagRemovedOnLoad);
    await expect(fresh.locator('[data-tag="floating-engagement-sheet"]')).toBeHidden();
    await fresh.evaluate(() => document.documentElement.removeAttribute("data-hide-patreon-floating-engagement"));
    await expect(fresh.locator("html")).toHaveAttribute("data-hide-patreon-floating-engagement", "");
    await fresh.reload();
    await fresh.waitForFunction(() => window.hideFlagRemovedOnLoad);
    await expect(fresh.locator('[data-tag="floating-engagement-sheet"]')).toBeHidden();
    await hideToggle.uncheck();
    await expect(fresh.locator('[data-tag="floating-engagement-sheet"]')).toBeVisible();
    await fresh.reload();
    await fresh.waitForFunction(() => window.hideFlagRemovedOnLoad);
    await expect(fresh.locator('[data-tag="floating-engagement-sheet"]')).toBeVisible();
    await hideToggle.check();
    await expect(fresh.locator('[data-tag="floating-engagement-sheet"]')).toBeHidden();
    await fresh.close();
    const download = first.getByRole("button", { name: "Download post", exact: true });
    await expect(download).toBeVisible();
    await expect(first.locator('.actions > :first-child')).toHaveAttribute("data-patreon-download-button", "");
    await download.click();
    await expect(first.getByRole("dialog", { name: "Download post", exact: true })).toBeVisible();
    await expect(first.frameLocator('iframe[title="Post export formats"]')
      .getByRole("button", { name: "Markdown", exact: true })).toBeEnabled();
    await first.getByRole("button", { name: "Close download options", exact: true }).click();
    const toggle = popup.getByRole("switch", { name: "Enable Reader Customization", exact: true });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    const reader = first.getByRole("button", { name: "Customize reading appearance", exact: true });
    await expect(reader).toBeVisible();
    await expect(second.getByRole("button", { name: "Customize reading appearance", exact: true })).toBeVisible();
    await first.bringToFront();
    await popup.evaluate(() => showPageStatus());
    await expect(popup.locator("#status")).toHaveText("Preferences apply to all posts");
    await reader.click();
    await first.getByLabel("Font family", { exact: true }).selectOption("georgia");
    await expect(first.locator("#body")).toHaveCSS("font-family", 'Georgia, "Times New Roman", serif');
    await expect(second.locator("#body")).toHaveCSS("font-family", 'Georgia, "Times New Roman", serif');
    await first.getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name: "Charcoal", exact: true }).click();
    await expect(first.locator("[data-patreon-reader-surface]")).toHaveCSS("background-color", "rgb(32, 33, 36)");
    await expect(first.locator("[data-patreon-reader-surface]")).toHaveClass(/__singleColumnContentWrapper/);
    await expect(first.locator('[class$="__singleColumnContent"]')).toHaveCSS("background-color", "rgb(32, 33, 36)");
    await expect(second.locator("[data-patreon-reader-surface]")).toHaveCSS("background-color", "rgb(32, 33, 36)");
    await expect(second.locator("#body")).toHaveCSS("color", "rgb(245, 245, 240)");
    await expect(first.locator('.actions [data-tag="like-button"] span')).toHaveCSS("color", "rgb(245, 245, 240)");
    await first.getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name: "Light Green", exact: true }).click();
    await expect(first.locator('.actions [data-tag="like-button"] span')).toHaveCSS("color", "rgb(34, 34, 34)");
    await expect(second.locator('.actions [data-tag="like-button"] span')).toHaveCSS("color", "rgb(34, 34, 34)");
    await first.getByRole("dialog").screenshot({ path: "test-results/reader-panel.png" });
    await popup.locator("body").screenshot({ path: "test-results/popup.png" });
    await first.getByRole("button", { name: "Download post", exact: true }).click();
    const [downloaded] = await Promise.all([
      first.waitForEvent("download"),
      first.frameLocator('iframe[title="Post export formats"]')
        .getByRole("button", { name: "Markdown", exact: true }).click()
    ]);
    expect(downloaded.suggestedFilename()).toBe("Installed extension test.md");
    await expect(first.getByRole("dialog", { name: "Download post", exact: true })
      .getByRole("status")).toHaveText("Markdown download started.");
    const epubButton = first.frameLocator('iframe[title="Post export formats"]')
      .getByRole("button", { name: "EPUB", exact: true });
    await expect(epubButton).toBeEnabled();
    const [secondDownload] = await Promise.all([
      first.waitForEvent("download"),
      epubButton.click()
    ]);
    expect(secondDownload.suggestedFilename()).toBe("Installed extension test.epub");
    await expect(first.getByRole("dialog", { name: "Download post", exact: true })
      .getByRole("status")).toHaveText("EPUB download started.");
    await first.getByRole("button", { name: "Close download options", exact: true }).click();
    await toggle.uncheck();
    await expect(reader).toHaveCount(0);
    await expect(first.getByRole("dialog")).toHaveCount(0);
    await expect(second.locator("#body")).toHaveCSS("font-family", "Arial");
    await toggle.check();
    await expect(second.locator("#body")).toHaveCSS("font-family", 'Georgia, "Times New Roman", serif');
    await popup.getByRole("switch", { name: "Hide engagement bar", exact: true }).uncheck();
    await expect(first.locator('[data-tag="floating-engagement-sheet"]')).toBeVisible();
    const collectionPostOne = await context.newPage();
    await collectionPostOne.goto("https://www.patreon.com/posts/201");
    const collectionPostTwo = await context.newPage();
    await collectionPostTwo.goto("https://www.patreon.com/posts/202");
    await expect(collectionPostOne.getByRole("button", { name: "Download post", exact: true })).toBeVisible();
    await expect(collectionPostTwo.getByRole("button", { name: "Download post", exact: true })).toBeVisible();
    const collection = await context.newPage();
    await collection.goto("https://www.patreon.com/collection/555");
    const collectionDownload = collection.getByRole("button", { name: "Download Collection", exact: true });
    await expect(collectionDownload).toBeVisible();
    await collectionDownload.click();
    await expect(collection.getByRole("status")).toContainText("posts are ready", { timeout: 20_000 });
    const collectionMarkdown = collection.frameLocator('iframe[title="Collection export formats"]')
      .getByRole("button", { name: "Markdown", exact: true });
    await expect(collectionMarkdown).toBeEnabled({ timeout: 20_000 });
    const workerControl = await context.newCDPSession(manager);
    async function suspendExportWorker() {
      const { targetInfos } = await workerControl.send("Target.getTargets");
      const target = targetInfos.find(item => item.type === "service_worker"
        && item.url.startsWith(`chrome-extension://${extensionId}/`));
      expect(target).toBeTruthy();
      await workerControl.send("Target.closeTarget", { targetId: target.targetId });
      await expect.poll(async () => {
        const current = await workerControl.send("Target.getTargets");
        return current.targetInfos.some(item => item.targetId === target.targetId);
      }).toBe(false);
    }
    await suspendExportWorker();
    const [collectionZip] = await Promise.all([
      collection.waitForEvent("download"),
      collectionMarkdown.click()
    ]);
    expect(collectionZip.suggestedFilename()).toBe("Test collection.zip");
    const collectionBytes = await downloadBytes(collectionZip);
    expect(collectionBytes.includes(Buffer.from("001 - Collection post one.md"))).toBe(true);
    expect(collectionBytes.includes(Buffer.from("002 - Collection post two.md"))).toBe(true);
    const collectionEntries = readZip(collectionBytes);
    expect(collectionEntries[0].data.toString()).toContain("Collection body one.");
    expect(collectionEntries[1].data.toString()).toContain("Collection body two.");
    await expect(collectionMarkdown).toBeEnabled({ timeout: 20_000 });
    const cachedSources = await popup.evaluate(async () => {
      const cache = await caches.open("patreon-export-sources-v1");
      const keys = await cache.keys();
      const snapshots = await Promise.all(keys.map(async key => (await cache.match(key)).json()));
      return { count: keys.length, assets: snapshots.map(snapshot => snapshot.assets.length) };
    });
    expect(cachedSources).toEqual({ count: 2, assets: [1, 1] });
    await collectionPostOne.close();
    await collectionPostTwo.close();
    await suspendExportWorker();
    let openedPostTabs = 0;
    const countPostTab = () => { openedPostTabs++; };
    context.on("page", countPostTab);
    const [collectionEpub] = await Promise.all([
      collection.waitForEvent("download"),
      collection.frameLocator('iframe[title="Collection export formats"]')
        .getByRole("button", { name: "EPUB", exact: true }).click()
    ]);
    const epubEntries = readZip(await downloadBytes(collectionEpub));
    expect(epubEntries.map(entry => entry.name)).toEqual([
      "001 - Collection post one.epub", "002 - Collection post two.epub"
    ]);
    expect(readZip(epubEntries[0].data).find(entry => entry.name === "EPUB/post.xhtml").data.toString())
      .toContain("Collection body one.");
    expect(readZip(epubEntries[1].data).find(entry => entry.name === "EPUB/post.xhtml").data.toString())
      .toContain("Collection body two.");
    for (const entry of epubEntries) {
      const images = readZip(entry.data).filter(file => file.name.startsWith("EPUB/images/"));
      expect(images).toHaveLength(1);
      expect(images[0].data.toString()).toContain("<svg");
    }
    await expect(collectionMarkdown).toBeEnabled({ timeout: 20_000 });
    context.off("page", countPostTab);
    expect(openedPostTabs).toBe(0);
    await collection.frameLocator('iframe[title="Collection export formats"]').locator("body").evaluate(async () => {
      await chrome.runtime.sendMessage({ type: "CANCEL_COLLECTION_EXPORT", token: location.hash.slice(1) });
    });
    await collectionMarkdown.click();
    await expect(collection.getByRole("status")).toContainText("expired", { timeout: 10_000 });
    await expect(collectionMarkdown).toBeEnabled();
    await collection.getByRole("button", { name: "Close collection download", exact: true }).click();
    await collection.close();
    await collectionPostOne.close();
    await collectionPostTwo.close();
  } finally {
    await context.close();
  }
});
