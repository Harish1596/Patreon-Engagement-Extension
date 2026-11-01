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
  await expect(progress).toBeVisible();
  await expect(page.getByRole("status")).toContainText("3 posts are ready");
  await expect(progress).toBeHidden();
  expect(await page.evaluate(() => requestedCollectionUrls)).toEqual([
    "https://www.patreon.com/posts/101",
    "https://www.patreon.com/posts/102",
    "https://www.patreon.com/posts/103"
  ]);
  const pending = page.waitForEvent("download");
  await page.frameLocator('iframe[title="Collection export formats"]')
    .getByRole("button", { name: "Markdown", exact: true }).click();
  const download = await pending;
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
  expect(entries.map(entry => entry.data.toString().split("\n")[0]))
    .toEqual(["# First post", "# Second post", "# Third post"]);
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
  await expect(page.getByRole("status")).toContainText("post is ready");
  const pending = page.waitForEvent("download");
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "EPUB", exact: true }).click();
  const bytes = await downloadBytes(await pending);
  const [entry] = readZip(bytes);
  expect(entry.method).toBe(8);
  expect(entry.size).toBeLessThan(entry.data.length / 2);
  expect(bytes.subarray(30, 130).includes(Buffer.from("application/epub+zip"))).toBe(false);
  const [mime, body] = readZip(entry.data);
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
  await expect(page.getByRole("status")).toHaveText("3 posts are ready. 2 locked posts were skipped.");
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
    await expect(page.getByRole("status")).toContainText("locked for your current membership");
    await expect(page.getByRole("progressbar")).toBeHidden();
    expect(await page.evaluate(() => globalThis.requestedCollectionUrls)).toBeUndefined();
    await expect(page.locator('iframe[title="Collection export formats"]')).toHaveAttribute("src", "about:blank");
  });
}

test("collection reuses discovery and preparation across downloads and refreshes explicitly or on expiry", async ({ page }) => {
  await setup(page, { content: '<main><h1>Cached collection</h1><a class="fixture_gridCard" href="/posts/101">Post</a></main>',
    url: "https://www.patreon.com/collection/500" });
  let apiCalls = 0;
  let postCount = 1;
  const apiBase = "https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500";
  await page.route("https://www.patreon.com/api/posts**", route => {
    apiCalls++;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({
      data: Array.from({ length: postCount }, (_, index) => ({ id: String(101 + index), type: "post",
        attributes: { current_user_can_view: true } })),
      meta: { pagination: { total: postCount } }
    }) });
  });
  await page.evaluate(url => {
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, "getEntriesByType", {
      configurable: true, value: type => type === "resource" ? [...original(type), { name: url }] : original(type)
    });
    globalThis.collectionBuildResult = { files: [{ title: "Post", extension: "md", encoding: "text", data: "# Post" }] };
  }, apiBase);
  const trigger = page.getByRole("button", { name: "Download Collection", exact: true });
  const close = page.getByRole("button", { name: "Close collection download", exact: true });
  const status = page.getByRole("status");
  await trigger.click();
  await expect(status).toContainText("1 post is ready");
  await close.click();
  await trigger.click();
  await expect(status).toContainText("1 post is ready");
  for (const format of ["Markdown", "EPUB"]) {
    const pending = page.waitForEvent("download");
    await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: format, exact: true }).click();
    await pending;
    await expect(status).toContainText(`${format} ZIP download started. 1 post is ready`);
  }
  expect(apiCalls).toBe(1);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(1);

  await close.click();
  await page.evaluate(() => { const original = Date.now; Date.now = () => original() + 119 * 60_000; });
  await trigger.click();
  await expect(status).toContainText("1 post is ready");
  expect(apiCalls).toBe(1);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(1);

  postCount = 2;
  await page.getByRole("button", { name: "Refresh collection", exact: true }).click();
  await expect(status).toContainText("2 posts are ready");
  expect(apiCalls).toBe(2);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(2);

  await page.evaluate(() => forgetCollectionSessions());
  await close.click();
  await trigger.click();
  await expect(status).toContainText("2 posts are ready");
  expect(apiCalls).toBe(2);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(3);

  await close.click();
  await page.evaluate(() => { const original = Date.now; Date.now = () => original() + 121 * 60_000; });
  await trigger.click();
  await expect(status).toContainText("2 posts are ready");
  expect(apiCalls).toBe(3);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(4);

  await close.click();
  await page.evaluate(() => {
    history.pushState({}, "", "/collection/501");
    document.body.append(document.createElement("div"));
  });
  await trigger.click();
  await expect(status).toContainText("1 post is ready");
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(5);
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
