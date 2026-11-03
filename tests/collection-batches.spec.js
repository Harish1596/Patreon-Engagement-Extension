const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const { readZip } = require("./helpers/zip");
const frames = page => page.frameLocator('iframe[title="Collection export formats"]');

async function fixture(page, count = 101) {
  await setup(page, { url: "https://www.patreon.com/collection/500", content: `<main><h1>Large collection</h1>${Array.from({ length: count }, (_, index) => `<a class="fixture_gridCard" href="/posts/${101 + index}">Chapter ${index + 1}</a>`).join("")}</main>` });
  await page.evaluate(count => {
    globalThis.collectionBuildResult = { files: Array.from({ length: count }, (_, index) => ({
      title: `Chapter ${index + 1}`, extension: "md", encoding: "text", data: `Body ${index + 1}`
    })), skipped: 0 };
  }, count);
  const downloads = [];
  page.on("download", download => downloads.push(download));
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  return downloads;
}
async function entries(download) {
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return readZip(Buffer.concat(chunks));
}

for (const format of ["Markdown", "EPUB", "Single EPUB"]) {
  test(`${format} automatically splits 101 chapters into ordered, independently readable parts`, async ({ page }) => {
    test.setTimeout(90_000);
    const downloads = await fixture(page);
    await expect(page.getByRole("status")).toContainText("101 posts are ready");
    await expect(page.getByRole("status")).toContainText("2 numbered parts");
    await frames(page).getByRole("button", { name: format, exact: true }).click();
    await expect.poll(() => downloads.length, { timeout: 60_000 }).toBe(2);
    await expect(page.getByRole("status")).toContainText("part downloads started");
    const book = format === "Single EPUB", extension = book ? "epub" : "zip";
    expect(downloads.map(item => item.suggestedFilename())).toEqual([
      `Large collection - Part 001 of 002.${extension}`, `Large collection - Part 002 of 002.${extension}`
    ]);
    const first = await entries(downloads[0]), second = await entries(downloads[1]);
    expect(first.filter(item => !book || item.name.endsWith("post.xhtml"))).toHaveLength(100);
    expect(second.filter(item => !book || item.name.endsWith("post.xhtml"))).toHaveLength(1);
    if (book) {
      expect(second[0].name).toBe("mimetype");
      const chapter = second.find(item => item.name.endsWith("post.xhtml")).data.toString();
      expect(chapter).toContain("Body 101");
      expect(chapter).not.toContain("../002/post.xhtml");
      expect(chapter).not.toContain("../000/post.xhtml");
      const nav = second.find(item => item.name === "EPUB/nav.xhtml").data.toString();
      expect(nav).toContain("Chapter 101");
      expect(nav).toContain("chapters/001/post.xhtml");
    } else {
      expect(first[0].name).toMatch(/^001 - Chapter 1\./);
      expect(first[99].name).toMatch(/^100 - Chapter 100\./);
      expect(second[0].name).toMatch(/^101 - Chapter 101\./);
    }
    expect(await page.evaluate(() => collectionBuildIndices)).toEqual(Array.from({ length: 101 }, (_, index) => index));
    await page.locator(".download-report summary").click();
    await expect(page.locator(".download-report li").filter({ hasText: "Download started" })).toHaveCount(101);
  });
}

test("later-part retry and cancellation retain the earlier handoff", async ({ page }) => {
  test.setTimeout(90_000);
  const downloads = await fixture(page);
  await page.evaluate(() => { globalThis.collectionFailedIndices = [100]; });
  await expect(page.getByRole("status")).toContainText("101 posts are ready");
  await frames(page).getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry failed posts" })).toBeVisible({ timeout: 60_000 });
  expect(downloads).toHaveLength(1);
  await page.locator(".download-report summary").click();
  await expect(page.locator(".download-report li").filter({ hasText: "Download started" })).toHaveCount(100);
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; });
  await page.getByRole("button", { name: "Retry failed posts" }).click();
  await expect.poll(() => downloads.length).toBe(2);
  expect(downloads[1].suggestedFilename()).toBe("Large collection - Part 002 of 002.zip");
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([...Array.from({ length: 101 }, (_, index) => index), 100]);
  // A new export can be cancelled after the first part without retracting it.
  await expect(frames(page).getByRole("button", { name: "Markdown", exact: true })).toBeEnabled();
  await page.evaluate(() => { globalThis.collectionFailedIndices = [100]; });
  await frames(page).getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry failed posts" })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => { globalThis.collectionMessageHolds = ["BUILD_COLLECTION_EXPORT"]; });
  await page.getByRole("button", { name: "Retry failed posts" }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("BUILD_COLLECTION_EXPORT");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".report-state")).toContainText("Earlier downloads were already handed to the browser");
  expect(downloads).toHaveLength(3);
});

test("collections beyond the discovery bound fail visibly before preparing posts", async ({ page }) => {
  await setup(page, { url: "https://www.patreon.com/collection/500", content: "<main><h1>Too large</h1></main>" });
  await page.evaluate(() => {
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, "getEntriesByType", { value: type => type === "resource"
      ? [...original(type), { name: "https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500" }] : original(type) });
  });
  await page.route("https://www.patreon.com/api/posts**", route => route.fulfill({ json: {
    data: Array.from({ length: 1001 }, (_, index) => ({ id: String(101 + index), type: "post", attributes: { current_user_can_view: true } }))
  } }));
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("more than 1,000 posts");
  expect(await page.evaluate(() => collectionPrepareCount || 0)).toBe(0);
});

test("choosing another format after a later-part failure starts at the first chapter", async ({ page }) => {
  test.setTimeout(90_000);
  const downloads = await fixture(page);
  await page.evaluate(() => { globalThis.collectionFailedIndices = [100]; });
  await expect(page.getByRole("status")).toContainText("101 posts are ready");
  await frames(page).getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry failed posts" })).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; });
  await frames(page).getByRole("button", { name: "Single EPUB", exact: true }).click();
  await expect.poll(() => downloads.length, { timeout: 60_000 }).toBe(3);
  expect(downloads.slice(1).map(item => item.suggestedFilename())).toEqual([
    "Large collection - Part 001 of 002.epub", "Large collection - Part 002 of 002.epub"
  ]);
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([
    ...Array.from({ length: 101 }, (_, index) => index), ...Array.from({ length: 101 }, (_, index) => index)
  ]);
});
