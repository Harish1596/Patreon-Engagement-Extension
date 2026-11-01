const { test, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { setup } = require("./helpers/reader");

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
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("status")).toContainText("3 posts are ready");
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
  expect(bytes.includes(Buffer.from("# First post"))).toBe(true);
  expect(bytes.includes(Buffer.from("# Second post"))).toBe(true);
  expect(bytes.includes(Buffer.from("# Third post"))).toBe(true);
  expect(await page.evaluate(() => collectionChunkSizes.every(size => size <= 1024 * 1024))).toBe(true);
});

test("collection export follows local API cursors without clicking Load more", async ({ page }) => {
  const content = `<!doctype html><html><head><title>API collection | Patreon</title></head><body><main>
    <h1>API collection</h1>
    <div><a class="IhO0fW_gridCard" href="/posts/101?collection=500">First</a></div>
    <div class="IhO0fW_loadMoreContainer"><button id="load-more">Load more</button></div>
    <script>window.loadMoreClicks = 0; document.getElementById("load-more").onclick = () => { window.loadMoreClicks++; };</script>
  </main></body></html>`;
  await setup(page, { content, url: "https://www.patreon.com/collection/500" });
  const apiBase = "https://www.patreon.com/api/posts?filter%5Bcampaign_id%5D=900&filter%5Bcollection_id%5D=500&sort=collection_order";
  await page.route("https://www.patreon.com/api/posts**", async route => {
    const cursor = new URL(route.request().url()).searchParams.get("page[cursor]");
    const data = cursor ? [{ id: "103", type: "post" }] : [
      { id: "101", type: "post" }, { id: "102", type: "post" }
    ];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data,
        links: { next: cursor ? null : `${apiBase}&page%5Bcursor%5D=next-page` },
        meta: { pagination: { total: 3, cursors: { next: cursor ? null : "next-page" } } }
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
  await expect(page.getByRole("status")).toContainText("3 posts are ready");
  expect(await page.evaluate(() => requestedCollectionUrls)).toEqual([
    "https://www.patreon.com/posts/101",
    "https://www.patreon.com/posts/102",
    "https://www.patreon.com/posts/103"
  ]);
  expect(await page.evaluate(() => window.loadMoreClicks)).toBe(0);
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
