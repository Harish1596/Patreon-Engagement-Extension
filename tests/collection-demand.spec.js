const { startCollectionDownload } = require("./helpers/collection-choice");
const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const formats = page => page.frameLocator('iframe[title="Collection export formats"]');

async function fixture(page) {
  await setup(page, { content: '<main><h1>On demand</h1><a class="fixture_gridCard" href="/posts/101">First</a></main>',
    url: "https://www.patreon.com/collection/500" });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(formats(page).locator("#download-collection")).toBeEnabled();
}

test("opening and dismissing collection formats performs no discovery, preparation or chapter reads", async ({ page }) => {
  let requests = 0;
  await page.route("https://www.patreon.com/api/posts**", route => { requests++; return route.abort(); });
  await fixture(page);
  for (const radio of await formats(page).getByRole("radio").all()) await expect(radio).toBeEnabled();
  await page.getByRole("button", { name: "Close collection download" }).click();
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(formats(page).locator("#download-collection")).toBeEnabled();
  expect(requests).toBe(0);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
  expect(await page.evaluate(() => globalThis.collectionBuildIndices)).toBeUndefined();
});

for (const cancel of [false, true]) test(`image access waits for the current frame and survives dismissal; cancel=${cancel}`, async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { globalThis.collectionMessageHolds = ["BUILD_COLLECTION_EXPORT"]; });
  await startCollectionDownload(formats(page), "Markdown");
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("BUILD_COLLECTION_EXPORT");
  await page.evaluate(() => {
    globalThis.permissionReply = null;
    globalThis.permissionPending = deliverBackgroundMessage({ type: "COLLECTION_MEDIA_PERMISSION",
      token: collectionHeldMessage.token, operationId: collectionHeldMessage.operationId, index: 0 })
      .then(reply => { globalThis.permissionReply = reply; });
  });
  const allow = formats(page).getByRole("button", { name: "Allow images and continue", exact: true });
  await expect(allow).toBeVisible();
  await formats(page).locator("body").evaluate(() => parent.postMessage({ source: "patreon-reader-collection-permission-result",
    token: location.hash.slice(1), requestId: "stale", granted: true }, "https://www.patreon.com"));
  await expect(page.getByRole("status")).toContainText("Allow image access");
  expect(await page.evaluate(() => permissionReply)).toBeNull();
  await page.getByRole("button", { name: "Close collection download" }).click();
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(allow).toBeVisible();
  if (cancel) {
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Cancelled");
  } else {
    await allow.click();
  }
  await expect.poll(() => page.evaluate(() => permissionReply?.granted)).toBe(!cancel);
  const pending = cancel ? null : page.waitForEvent("download");
  await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
  if (pending) await pending;
});

for (const format of ["Markdown", "EPUB", "Single Markdown", "Single EPUB"]) test(`${format} downloads supported posts while reporting an unsupported chapter`, async ({ page }) => {
  const { readZip } = require("./helpers/zip");
  await setup(page, { content: '<main><h1>Mixed</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Unsupported</a><a class="fixture_gridCard" href="/posts/103">Third</a></main>',
    url: "https://www.patreon.com/collection/500" });
  await page.evaluate(() => { globalThis.collectionSkippedIndices = [1]; });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  const pending = page.waitForEvent("download");
  await startCollectionDownload(formats(page), format);
  const chunks = [];
  for await (const chunk of await (await pending).createReadStream()) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  if (format === "Single Markdown") {
    expect(bytes.toString()).toContain("chapter-001"); expect(bytes.toString()).toContain("chapter-003");
    expect(bytes.toString()).not.toContain("chapter-002");
  } else {
    const entries = readZip(bytes);
    if (format === "Single EPUB") {
      const nav = entries.find(entry => entry.name === "EPUB/nav.xhtml").data.toString();
      expect(nav).toContain("chapters/001/post.xhtml"); expect(nav).toContain("chapters/003/post.xhtml");
      expect(nav).not.toContain("chapters/002/post.xhtml");
    } else expect(entries.map(entry => entry.name)).toEqual([
      `001 - First post.${format === "EPUB" ? "epub" : "md"}`, `003 - Third post.${format === "EPUB" ? "epub" : "md"}`
    ]);
  }
  await expect(page.locator(".report-totals")).toContainText("2 saving");
  await expect(page.locator(".report-totals")).toContainText("1 skipped");
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeHidden();
});

test("an entirely unsupported collection reports skips without a native download", async ({ page }) => {
  await fixture(page);
  let downloads = 0; page.on("download", () => { downloads++; });
  await page.evaluate(() => { globalThis.collectionSkippedIndices = [0]; });
  await startCollectionDownload(formats(page), "Markdown");
  await expect(page.getByRole("status")).toContainText("No supported text posts");
  await expect(page.locator(".report-totals")).toContainText("1 skipped");
  expect(downloads).toBe(0);
});
