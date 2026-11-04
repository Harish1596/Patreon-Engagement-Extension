const { test, expect, chromium } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs");
const { browserExecutable } = require("../scripts/browser-config");
const { readZip } = require("./helpers/zip");

test("installed Brave extension: actual storage, content scripts, and popup", async ({}, testInfo) => {
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
    let collectionApiCalls = 0;
    await context.route("https://www.patreon.com/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/api/posts" && ++collectionApiCalls < 3) return route.fulfill({ status: 503, headers: { "Retry-After": "0" }, body: "Synthetic temporary failure" });
      if (pathname === "/api/posts") return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        data: [201, 202].map(id => ({ id: String(id), type: "post", attributes: {
          current_user_can_view: true, title: `Collection post ${id === 201 ? "one" : "two"}`,
          content_json_string: JSON.stringify({ type: "doc", content: [{ type: "text", text: `Synthetic body ${id}` }] })
        } })), meta: { pagination: { total: 2 } }
      }) });
      if (pathname.startsWith("/collection/")) return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>Test collection | Patreon</title></head><body><main>
          <h1>Test collection</h1><script>fetch('/api/posts?filter%5Bcollection_id%5D=555');</script>
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
    await expect(popup.locator("#media-status")).toHaveText("No saved media access.");
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
    await expect.poll(() => collection.evaluate(() => performance.getEntriesByType("resource").some(entry => entry.name.includes("/api/posts?")))).toBe(true);
    await collectionDownload.click();
    await expect(collection.getByRole("status")).toContainText("posts are ready", { timeout: 20_000 });
    await expect.poll(() => popup.evaluate(async () => {
      const sessions = Object.entries(await chrome.storage.session.get(null)).filter(([key]) => key.startsWith("collection-export:"));
      return sessions[0]?.[1].posts.map(post => Boolean(post.revision));
    })).toEqual([true, true]);
    expect(collectionApiCalls).toBeGreaterThanOrEqual(3);
    const collectionMarkdown = collection.frameLocator('iframe[title="Collection export formats"]')
      .getByRole("button", { name: "Markdown", exact: true });
    await expect(collectionMarkdown).toBeEnabled({ timeout: 20_000 });
    const workerControl = await context.newCDPSession(manager);
    const downloadDirectory = testInfo.outputPath("collection-downloads");
    fs.mkdirSync(downloadDirectory, { recursive: true });
    await workerControl.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDirectory, eventsEnabled: true });
    const receivedIds = new Set();
    async function downloadCollectionZip(click, extension = ".zip") {
      await click();
      let result;
      await expect.poll(async () => {
        const items = await popup.evaluate(async () => chrome.downloads.search({ state: "complete", orderBy: ["-startTime"], limit: 10 }));
        result = items.find(item => item.byExtensionId === extensionId && !receivedIds.has(item.id));
        return Boolean(result);
      }, { timeout: 20_000 }).toBe(true);
      receivedIds.add(result.id);
      expect(result.filename.startsWith(downloadDirectory + path.sep)).toBe(true);
      expect(result.filename.endsWith(extension)).toBe(true);
      return fs.readFileSync(result.filename);
    }
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
    const collectionBytes = await downloadCollectionZip(async () => {
      await collectionMarkdown.click();
      await expect(collection.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
      await collection.getByRole("button", { name: "Close collection download", exact: true }).click();
      await expect(collection.getByRole("dialog", { name: "Download Collection", exact: true })).toBeHidden();
    });
    // The actual downloads API must finish even while the nonmodal panel is closed.
    await expect(collection.getByRole("dialog", { name: "Download Collection", exact: true })).toBeHidden();
    await collection.getByRole("button", { name: "Download Collection", exact: true }).click();
    expect(collectionBytes.includes(Buffer.from("001 - Collection post one.md"))).toBe(true);
    expect(collectionBytes.includes(Buffer.from("002 - Collection post two.md"))).toBe(true);
    const collectionEntries = readZip(collectionBytes);
    expect(collectionEntries[0].data.toString()).toContain(String.raw`Collection body one\.`);
    expect(collectionEntries[1].data.toString()).toContain(String.raw`Collection body two\.`);
    await expect(collectionMarkdown).toBeEnabled({ timeout: 20_000 });
    const cachedSources = await popup.evaluate(async () => {
      const cache = await caches.open("patreon-export-sources-v1");
      const keys = await cache.keys();
      const stored = await chrome.storage.session.get("export-disk-key-v1");
      const secret = await crypto.subtle.importKey("raw", new Uint8Array(stored["export-disk-key-v1"]), "AES-GCM", false, ["decrypt"]);
      const snapshots = await Promise.all(keys.map(async key => {
        const response = await cache.match(key);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (new TextDecoder().decode(bytes).includes("Collection body")) throw new Error("Plaintext source on disk");
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12), additionalData: new TextEncoder().encode(key.url) }, secret, bytes.subarray(12));
        return JSON.parse(JSON.parse(new TextDecoder().decode(plain)).data);
      }));
      return { count: keys.length, assets: snapshots.map(snapshot => snapshot.assets.length) };
    });
    expect(cachedSources).toEqual({ count: 2, assets: [1, 1] });
    await collectionPostOne.close();
    await collectionPostTwo.close();
    await suspendExportWorker();
    let openedPostTabs = 0;
    const countPostTab = () => { openedPostTabs++; };
    context.on("page", countPostTab);
    const epubBytes = await downloadCollectionZip(() => collection.frameLocator('iframe[title="Collection export formats"]')
      .getByRole("button", { name: "EPUB", exact: true }).click());
    const epubEntries = readZip(epubBytes);
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
    await suspendExportWorker();
    const bookBytes = await downloadCollectionZip(() => collection.frameLocator('iframe[title="Collection export formats"]')
      .getByRole("button", { name: "Single EPUB", exact: true }).click(), ".epub");
    const bookEntries = readZip(bookBytes);
    await expect(collection.locator(".download-report .report-totals")).toContainText("2 included");
    await collection.locator(".download-report summary").click();
    await expect(collection.locator(".download-report")).toContainText("Completed");
    await expect(collection.locator(".download-report").getByRole("button", { name: "Save report" })).toBeEnabled();
    expect(bookEntries[0].name).toBe("mimetype");
    expect(bookEntries.filter(entry => entry.name.endsWith("post.xhtml")).map(entry => entry.name)).toEqual([
      "EPUB/chapters/001/post.xhtml", "EPUB/chapters/002/post.xhtml"
    ]);
    expect(bookEntries.find(entry => entry.name === "EPUB/nav.xhtml").data.toString()).toContain("Collection post two");
    expect(bookEntries.find(entry => entry.name === "EPUB/chapters/001/post.xhtml").data.toString()).toContain("Collection body one.");
    await expect(collectionMarkdown).toBeEnabled({ timeout: 20_000 });
    await expect.poll(() => popup.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const folder = await root.getDirectoryHandle("patreon-archives-v1");
      let count = 0;
      for await (const entry of folder.values()) { void entry; count++; }
      return count;
    })).toBe(0);
    await expect.poll(() => popup.evaluate(() => chrome.offscreen.hasDocument())).toBe(false);
    await collection.getByRole("button", { name: "Refresh collection", exact: true }).click();
    await expect(collection.getByRole("status")).toContainText("2 unchanged cached posts were reused");
    context.off("page", countPostTab);
    expect(openedPostTabs).toBe(0);
    const preferencesBeforeExpiry = await popup.evaluate(() => chrome.storage.local.get(null));
    const expiryAlarm = await popup.evaluate(() => chrome.alarms.get("patreon-export-expiry"));
    expect(expiryAlarm.scheduledTime).toBeGreaterThan(Date.now());
    // Leave an unfinished OPFS entry, then expire both sources and archive data
    // in the real worker. A native alarm must clean them without another export.
    await collection.frameLocator('iframe[title="Collection export formats"]').locator("body").evaluate(async () => {
      const id = crypto.randomUUID();
      const transferId = crypto.randomUUID();
      const created = await chrome.runtime.sendMessage({ type: "COLLECTION_ARCHIVE_CREATE", id, count: 1, filename: "Retention fixture.zip" });
      if (!created.created) throw new Error(created.error);
      await chrome.runtime.sendMessage({ type: "COLLECTION_ARCHIVE_BEGIN", id, index: 0, transferId, name: "Unfinished.md" });
      await chrome.runtime.sendMessage({ type: "COLLECTION_ARCHIVE_CHUNK", id, index: 0, transferId, offset: 0, data: "eA==" });
    });
    let liveWorker;
    for (const candidate of context.serviceWorkers().filter(worker => worker.url().startsWith(`chrome-extension://${extensionId}/`)).reverse()) {
      try { await candidate.evaluate(() => typeof PatreonRetention); liveWorker = candidate; break; } catch { /* Stopped worker proxy. */ }
    }
    expect(liveWorker).toBeTruthy();
    await liveWorker.evaluate(() => { const now = Date.now; Date.now = () => now() + 121 * 60_000; });
    await popup.evaluate(() => chrome.alarms.create("patreon-export-expiry", { when: Date.now() + 1000 }));
    await expect.poll(() => popup.evaluate(async () => {
      const cache = await caches.open("patreon-export-sources-v1");
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle("patreon-archives-v1");
      let files = 0;
      for await (const item of directory.values()) { void item; files++; }
      const records = await chrome.storage.session.get(null);
      return { sources: (await cache.keys()).length, files,
        metadata: Object.keys(records).filter(key => key.startsWith("collection-export:") || key.startsWith("collection-archive:")).length };
    }), { timeout: 15_000 }).toEqual({ sources: 0, files: 0, metadata: 0 });
    expect(await popup.evaluate(() => chrome.storage.local.get(null))).toEqual(preferencesBeforeExpiry);
    await expect(collection.getByRole("status")).toContainText("Cached collection data expired");
    await expect(collection.getByRole("button", { name: "Start again", exact: true })).toBeVisible();
    await collection.getByRole("button", { name: "Close collection download", exact: true }).click();
    await collection.close();
    await collectionPostOne.close();
    await collectionPostTwo.close();
  } finally {
    await context.close();
  }
});
