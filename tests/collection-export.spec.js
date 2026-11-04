const { test, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { setup } = require("./helpers/reader");
const { readZip } = require("./helpers/zip");

async function downloadBytes(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("collection export creates ordered separate Markdown files in one ZIP", async ({ page }, testInfo) => {
  const content = `<!doctype html><html><head><title>Example collection | Patreon</title></head><body><main>
    <h1>Example collection</h1>
    <div id="cards"><a class="IhO0fW_gridCard" href="/posts/101?collection=500">First</a></div>
    <div class="IhO0fW_loadMoreContainer"><button id="load-more">Load more</button></div>
    <a href="/example/posts/unrelated-104">Unrelated main link</a>
    <script>let nextPost = 102; document.getElementById("load-more").onclick = event => {
      const button = event.currentTarget;
      button.disabled = true;
      setTimeout(() => {
        document.getElementById("cards").insertAdjacentHTML("beforeend",
          '<a class="IhO0fW_gridCard" href="/posts/' + nextPost + '?collection=500">Next</a><a class="IhO0fW_gridCard" href="/posts/101?collection=500">Duplicate</a>');
        nextPost++;
        if (nextPost > 103) document.querySelector(".IhO0fW_loadMoreContainer").remove();
        else setTimeout(() => { button.disabled = false; }, 250);
      }, 20);
    };</script>
  </main></body></html>`;
  await setup(page, { content, url: "https://www.patreon.com/collection/500" });
  const trigger = page.getByRole("button", { name: "Download Collection", exact: true });
  const progress = page.getByRole("progressbar", { name: "Collection download progress" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  await expect(progress).toBeHidden();
  const pending = page.waitForEvent("download");
  await page.frameLocator('iframe[title="Collection export formats"]')
    .getByRole("button", { name: "Markdown", exact: true }).click();
  const download = await pending;
  expect(await page.evaluate(() => requestedCollectionUrls)).toEqual([
    "https://www.patreon.com/posts/101",
    "https://www.patreon.com/posts/102",
    "https://www.patreon.com/posts/103"
  ]);

  expect(download.suggestedFilename()).toBe("Example collection.zip");
  const bytes = await downloadBytes(download);
  expect(bytes.readUInt16LE(8)).toBe(8);
  expect(bytes.readUInt16LE(12)).not.toBe(0);
  expect(await page.evaluate(() => PatreonExporter.makeZip([], "application/zip").type))
    .toBe("application/zip");
  const archive = testInfo.outputPath("Example collection.zip");
  fs.writeFileSync(archive, bytes);
  execFileSync("unzip", ["-t", archive]);
  if (process.platform === "darwin") {
    const extracted = testInfo.outputPath("ditto-extracted");
    fs.mkdirSync(extracted);
    execFileSync("ditto", ["-x", "-k", archive, extracted]);
  }
  expect(bytes.includes(Buffer.from("001 - First post.md"))).toBe(true);
  expect(bytes.includes(Buffer.from("002 - Second post.md"))).toBe(true);
  expect(bytes.includes(Buffer.from("003 - Third post.md"))).toBe(true);
  const entries = readZip(bytes);
  for (const [index, title] of ["First post", "Second post", "Third post"].entries()) {
    expect(entries[index].data.toString()).toContain(`# ${title}`);
  }
  expect(await page.evaluate(() => collectionChunkSizes.every(size => size <= 1024 * 1024))).toBe(true);
});

test("collection EPUB ZIP compresses nested EPUBs without confusing macOS format detection", async ({ page }, testInfo) => {
  await setup(page, { content: '<main><h1>EPUB collection</h1><a class="fixture_gridCard" href="/posts/101">Post</a></main>',
    url: "https://www.patreon.com/collection/500" });
  await page.evaluate(async () => {
    const nested = PatreonExporter.makeZip([
      { name: "mimetype", data: "application/epub+zip" },
      { name: "EPUB/post.xhtml", data: '<html><body>' + 'Synthetic chapter body. '.repeat(50_000) + '</body></html>' }
    ]);
    const bytes = new Uint8Array(await nested.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    globalThis.collectionBuildResult = { files: [{ title: "Example chapter", extension: "epub", encoding: "base64", data: btoa(binary) }] };
  });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  const pending = page.waitForEvent("download");
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "EPUB", exact: true }).click();
  const bytes = await downloadBytes(await pending);
  const [entry] = readZip(bytes);
  expect(entry.method).toBe(8);
  expect(entry.size).toBeLessThan(entry.data.length / 2);
  expect(bytes.subarray(30, 130).includes(Buffer.from("application/epub+zip"))).toBe(false);
  const nestedEntries = readZip(entry.data);
  const mime = nestedEntries[0];
  const body = nestedEntries.find(entry => entry.name === "EPUB/post.xhtml");
  expect(mime.name).toBe("mimetype");
  expect(mime.method).toBe(0);
  expect(mime.data.toString()).toBe("application/epub+zip");
  expect(body.data.toString()).toContain("Synthetic chapter body.");
  const archive = testInfo.outputPath("nested-epub.zip");
  fs.writeFileSync(archive, bytes);
  execFileSync("unzip", ["-t", archive]);
  if (process.platform === "darwin") {
    expect(execFileSync("file", ["-b", archive], { encoding: "utf8" })).toContain("Zip archive");
    const extracted = testInfo.outputPath("extracted");
    fs.mkdirSync(extracted);
    execFileSync("ditto", ["-x", "-k", archive, extracted]);
    expect(fs.readFileSync(`${extracted}/${entry.name}`)).toEqual(entry.data);
  }
});

test("collection export follows API cursors and excludes only explicitly locked posts", async ({ page }) => {
  const content = `<!doctype html><html><head><title>API collection | Patreon</title></head><body><main>
    <h1>API collection</h1>
    <div><a class="IhO0fW_gridCard" href="/posts/101?collection=500">First</a></div>
    <div class="IhO0fW_loadMoreContainer"><button id="load-more">Load more</button></div>
    <script>window.loadMoreClicks = 0; document.getElementById("load-more").onclick = () => { window.loadMoreClicks++; };</script>
  </main></body></html>`;
  await setup(page, { content, url: "https://www.patreon.com/collection/500" });
  const apiBase = "https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=900&filter%5Bcollection_id%5D=500&sort=collection_order";
  await page.route("https://www.patreon.com/api/posts**", async route => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get("fields[post]").split(",")).toContain("current_user_can_view");
    const cursor = query.get("page[cursor]");
    const data = cursor ? [
      { id: "103", type: "post", attributes: { current_user_can_view: "false" } },
      { id: "104", type: "post", attributes: { current_user_can_view: false } },
      { id: "105", type: "post", attributes: { current_user_can_view: false } }
    ] : [
      { id: "101", type: "post", attributes: { current_user_can_view: true } },
      { id: "104", type: "post", attributes: { current_user_can_view: false } },
      { id: "102", type: "post" }
    ];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data,
        links: { next: cursor ? null : `${apiBase}&page%5Bcursor%5D=next-page` },
        meta: { pagination: { total: 5, cursors: { next: cursor ? null : "next-page" } } }
      })
    });
  });
  await page.evaluate(url => {
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, "getEntriesByType", {
      configurable: true,
      value: type => type === "resource" ? [...original(type), { name: url }] : original(type)
    });
  }, apiBase);

  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await pending;
  expect(await page.evaluate(() => requestedCollectionUrls)).toEqual([
    "https://www.patreon.com/posts/101",
    "https://www.patreon.com/posts/102",
    "https://www.patreon.com/posts/103"
  ]);
  expect(await page.evaluate(() => window.loadMoreClicks)).toBe(0);
});

for (const count of [1, 2]) {
  test(`collection with ${count} locked posts stops before worker preparation`, async ({ page }) => {
    await setup(page, { content: '<main><h1>Locked collection</h1></main>', url: "https://www.patreon.com/collection/500" });
    const apiBase = "https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500";
    await page.route("https://www.patreon.com/api/posts**", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: Array.from({ length: count }, (_, index) => ({
          id: String(101 + index), type: "post", attributes: { current_user_can_view: false }
        })),
        meta: { pagination: { total: count } }
      })
    }));
    await page.evaluate(url => {
      const original = performance.getEntriesByType.bind(performance);
      Object.defineProperty(performance, "getEntriesByType", {
        configurable: true,
        value: type => type === "resource" ? [...original(type), { name: url }] : original(type)
      });
    }, apiBase);
    await page.getByRole("button", { name: "Download Collection", exact: true }).click();
    await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("locked for your current membership");
    await expect(page.getByRole("progressbar")).toBeHidden();
    expect(await page.evaluate(() => globalThis.requestedCollectionUrls)).toBeUndefined();
    await expect(page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true })).toBeEnabled();
  });
}

test("collection does no work on open or refresh and reuses discovery after an actual download", async ({ page }) => {
  await setup(page, { content: '<main><h1>Cached collection</h1><a class="fixture_gridCard" href="/posts/101">Post</a></main>',
    url: "https://www.patreon.com/collection/500" });
  let apiCalls = 0;
  await page.route("https://www.patreon.com/api/posts**", route => {
    apiCalls++;
    return route.fulfill({ json: { data: [{ id: "101", type: "post", attributes: { current_user_can_view: true } }], meta: { pagination: { total: 1 } } } });
  });
  await page.evaluate(() => {
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, "getEntriesByType", { value: type => type === "resource"
      ? [...original(type), { name: "https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500" }] : original(type) });
  });
  const trigger = page.getByRole("button", { name: "Download Collection", exact: true });
  const close = page.getByRole("button", { name: "Close collection download", exact: true });
  const formats = page.frameLocator('iframe[title="Collection export formats"]');
  await trigger.click();
  await expect(formats.getByRole("button", { name: "Markdown", exact: true })).toBeEnabled();
  await close.click(); await trigger.click();
  expect(apiCalls).toBe(0); expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
  for (const format of ["Markdown", "EPUB"]) {
    const pending = page.waitForEvent("download");
    await formats.getByRole("button", { name: format, exact: true }).click(); await pending;
    await expect(page.getByRole("status")).toContainText("download started");
  }
  expect(apiCalls).toBe(1); expect(await page.evaluate(() => collectionPrepareCount)).toBe(1);
  await page.getByRole("button", { name: "Refresh collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  expect(apiCalls).toBe(1); expect(await page.evaluate(() => collectionPrepareCount)).toBe(1);
  const pending = page.waitForEvent("download");
  await formats.getByRole("button", { name: "Markdown", exact: true }).click(); await pending;
  await expect(page.getByRole("status")).toContainText("download started");
  expect(apiCalls).toBe(2); expect(await page.evaluate(() => collectionPrepareCount)).toBe(2);
  expect(await page.evaluate(() => collectionPrepareRequests.every(request => request.deferred === true))).toBe(true);
});

for (const phase of ["PREPARE_COLLECTION_EXPORT", "BUILD_COLLECTION_EXPORT", "GET_COLLECTION_EXPORT_CHUNK", "COLLECTION_ARCHIVE_CHUNK", "COLLECTION_ARCHIVE_PACKAGE"]) {
  test(`Cancel stops ${phase} and ignores late replies before restarting`, async ({ page }) => {
    await setup(page, { content: '<main><h1>Collection</h1><a class="fixture_gridCard" href="/posts/101">Post</a></main>',
      url: "https://www.patreon.com/collection/500" });
    let downloads = 0;
    page.on("download", () => { downloads++; });
    if (phase === "PREPARE_COLLECTION_EXPORT") await page.evaluate(type => { globalThis.collectionMessageHolds = [type]; }, phase);
    await page.getByRole("button", { name: "Download Collection", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Choose a format");
    await page.evaluate(type => { globalThis.collectionMessageHolds = [type]; }, phase);
    await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
    await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe(phase);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Cancelled. You can start again.");
    await expect(page.getByRole("progressbar")).toBeHidden();
    await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
    await expect.poll(() => page.evaluate(() => globalThis.collectionLateReplyReleased)).toBe(true);
    await expect(page.getByRole("status")).toHaveText("Cancelled. You can start again.");
    expect(downloads).toBe(0);
    await page.getByRole("button", { name: "Start again", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Choose a format");
    const pending = page.waitForEvent("download");
    await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
    await pending;
  });
}

test("Cancel during cached-session recovery cannot start a late preparation", async ({ page }) => {
  await setup(page, { content: '<main><h1>Collection</h1><a class="fixture_gridCard" href="/posts/101">Post</a></main>',
    url: "https://www.patreon.com/collection/500" });
  const trigger = page.getByRole("button", { name: "Download Collection", exact: true });
  await trigger.click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  const first = page.waitForEvent("download");
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click(); await first;
  await expect(page.getByRole("status")).toContainText("download started");
  await page.getByRole("button", { name: "Close collection download", exact: true }).click();
  await page.evaluate(() => { forgetCollectionSessions(); globalThis.collectionMessageHolds = ["CANCEL_COLLECTION_EXPORT"]; });
  await trigger.click();
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("CANCEL_COLLECTION_EXPORT");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Cancelled. You can start again.");
  await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
  await expect.poll(() => page.evaluate(() => globalThis.collectionLateReplyReleased)).toBe(true);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(1);
  await expect(page.getByRole("status")).toHaveText("Cancelled. You can start again.");
});

test("Cancel aborts API discovery without falling back to Load more", async ({ page }) => {
  await setup(page, { content: '<main><h1>Collection</h1><div class="fixture_loadMoreContainer"><button onclick="window.loadClicks=(window.loadClicks||0)+1">Load more</button></div></main>',
    url: "https://www.patreon.com/collection/500" });
  const apiBase = "https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500";
  let release;
  let started = false;
  let aborted = false;
  const held = new Promise(resolve => { release = resolve; });
  page.on("requestfailed", request => { if (request.url().includes("/api/posts?")) aborted = true; });
  await page.route("https://www.patreon.com/api/posts**", async route => {
    started = true;
    await held;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      data: [{ id: "101", type: "post" }], meta: { pagination: { total: 1 } }
    }) }).catch(() => {});
  });
  await page.evaluate(url => {
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, "getEntriesByType", { configurable: true,
      value: type => type === "resource" ? [...original(type), { name: url }] : original(type) });
  }, apiBase);
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Cancelled. You can start again.");
  await expect.poll(() => aborted).toBe(true);
  release();
  expect(await page.evaluate(() => window.loadClicks || 0)).toBe(0);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
});

test("Cancel during compression prevents a late ZIP download", async ({ page }) => {
  await setup(page, { content: '<main><h1>Collection</h1><a class="fixture_gridCard" href="/posts/101">Post</a></main>',
    url: "https://www.patreon.com/collection/500" });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  let downloads = 0;
  page.on("download", () => { downloads++; });
  await page.evaluate(() => {
    globalThis.originalCompressionStream = CompressionStream;
    globalThis.CompressionStream = class {
      constructor() {
        return new TransformStream({ async transform(chunk, controller) {
          globalThis.compressionStarted = true;
          await new Promise(resolve => { globalThis.releaseCompression = resolve; });
          controller.enqueue(chunk);
        } });
      }
    };
  });
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.compressionStarted)).toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Cancelled. You can start again.");
  await page.evaluate(() => { globalThis.CompressionStream = originalCompressionStream; releaseCompression(); });
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  expect(downloads).toBe(0);
});

test("collection panel accepts chooser errors only from its current frame and token", async ({ page }) => {
  await setup(page, { content: '<main><h1>Collection</h1><a class="fixture_gridCard" href="/posts/101">Post</a></main>',
    url: "https://www.patreon.com/collection/500" });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  const body = page.frameLocator('iframe[title="Collection export formats"]').locator("body");
  await body.evaluate(() => parent.postMessage({ source: "patreon-reader-collection-error",
    token: "old-token", error: "Ignored stale error" }, "https://www.patreon.com"));
  await expect(page.getByRole("status")).toContainText("Choose a format");
  await body.evaluate(() => parent.postMessage({ source: "patreon-reader-collection-error",
    token: location.hash.slice(1), error: "The collection session expired. Reopen Download Collection." }, "https://www.patreon.com"));
  await expect(page.getByRole("status")).toContainText("session expired");
});

test("collection controls are scoped to collection routes", async ({ page }) => {
  await setup(page);
  await expect(page.getByRole("button", { name: "Download Collection", exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    history.pushState({}, "", "/collection/500");
    document.body.innerHTML = '<main><h1>Collection</h1><a class="IhO0fW_gridCard" href="/posts/101">Post</a></main>';
  });
  await expect(page.getByRole("button", { name: "Download Collection", exact: true })).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, "", "/example");
    document.body.append(document.createElement("div"));
  });
  await expect(page.getByRole("button", { name: "Download Collection", exact: true })).toHaveCount(0);
});

for (const failure of ["build", "chunk"]) {
  test(`collection recovery after ${failure} failure preserves ordering and respects retry-file expiry`, async ({ page }) => {
    const format = failure === "chunk" ? "EPUB" : "Markdown";
    await setup(page, { content: '<main><h1>Recovery</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Second</a><a class="fixture_gridCard" href="/posts/103">Third</a></main>',
      url: "https://www.patreon.com/collection/500" });
    await page.evaluate(async failure => {
      if (failure === "build") globalThis.collectionFailedIndices = [1];
      else {
        globalThis.collectionFailedChunkIndices = [1];
        const files = [];
        for (const title of ["First post", "Second post", "Third post"]) {
          const archive = PatreonExporter.makeZip([
            { name: "mimetype", data: "application/epub+zip" }, { name: "EPUB/post.xhtml", data: `<p>${title}</p>` }
          ]);
          const binary = String.fromCharCode(...new Uint8Array(await archive.arrayBuffer()));
          files.push({ title, extension: "epub", encoding: "base64", data: btoa(binary) });
        }
        globalThis.collectionBuildResult = { files };
      }
    }, failure);
    let downloads = 0;
    page.on("download", () => { downloads++; });
    const trigger = page.getByRole("button", { name: "Download Collection", exact: true });
    await trigger.click();
    await expect(page.getByRole("status")).toContainText("Choose a format");
    await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: format, exact: true }).click();
    await expect(page.getByRole("status")).toContainText("2 of 3 posts retained. 1 failed.");
    expect(downloads).toBe(0);
    expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1, 2]);
    if (failure === "build") await page.getByRole("button", { name: "Close collection download", exact: true }).click();
    await page.evaluate(failure => {
      globalThis.collectionFailedIndices = [];
      globalThis.collectionFailedChunkIndices = [];
      forgetCollectionSessions();
      if (failure === "chunk") {
        const now = Date.now;
        Date.now = () => now() + 121 * 60_000;
      }
    }, failure);
    if (failure === "build") await trigger.click();
    await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeVisible();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Retry failed posts", exact: true }).click();
    const entries = readZip(await downloadBytes(await pending));
    const extension = format === "EPUB" ? "epub" : "md";
    expect(entries.map(entry => entry.name)).toEqual([`001 - First post.${extension}`, `002 - Second post.${extension}`, `003 - Third post.${extension}`]);
    if (format === "EPUB") {
      for (const [index, title] of ["First post", "Second post", "Third post"].entries()) {
        expect(readZip(entries[index].data).find(entry => entry.name === "EPUB/post.xhtml").data.toString()).toContain(`<p>${title}</p>`);
      }
    }
    expect(await page.evaluate(() => collectionBuildIndices)).toEqual(failure === "chunk" ? [0, 1, 2, 0, 1, 2] : [0, 1, 2, 1]);
    expect(downloads).toBe(1);
  });
}

test("packaging retry reuses every completed chapter", async ({ page }) => {
  await setup(page, { content: '<main><h1>Recovery</h1><a class="fixture_gridCard" href="/posts/101">First</a></main>',
    url: "https://www.patreon.com/collection/500" });
  await page.evaluate(() => {
    globalThis.failArchivePackaging = true;
  });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry packaging", exact: true })).toBeVisible();
  await page.evaluate(() => { globalThis.failArchivePackaging = false; });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Retry packaging", exact: true }).click();
  expect(readZip(await downloadBytes(await pending))).toHaveLength(1);
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0]);
});

test("Refresh collection discards retained chapters before a new export", async ({ page }) => {
  await setup(page, { content: '<main><h1>Refresh</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Second</a></main>',
    url: "https://www.patreon.com/collection/500" });
  await page.evaluate(() => { globalThis.collectionFailedIndices = [1]; });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  const markdown = () => page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true });
  await markdown().click();
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeVisible();
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; });
  await page.getByRole("button", { name: "Refresh collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeHidden();
  const pending = page.waitForEvent("download");
  await markdown().click();
  await pending;
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1, 0, 1]);
});
