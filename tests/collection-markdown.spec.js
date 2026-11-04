const { test, expect } = require("@playwright/test");
const commonmark = require("commonmark");
const { setup } = require("./helpers/reader");
const { readZip } = require("./helpers/zip");
const formats = page => page.frameLocator('iframe[title="Collection export formats"]');
async function fixture(page, count = 2) {
  await setup(page, { url: "https://www.patreon.com/collection/500", content: `<main><h1>Collected stories</h1>${Array.from({ length: count }, (_, index) => `<a class="fixture_gridCard" href="/posts/${101 + index}">Chapter ${index + 1}</a>`).join("")}</main>` });
  await page.evaluate(count => { globalThis.collectionBuildResult = { files: Array.from({ length: count }, (_, index) => ({
    title: `Chapter ${index + 1} [story]`, extension: "snapshot", encoding: "text", data: JSON.stringify({
      version: 1, postId: String(101 + index), title: `Chapter ${index + 1} [story]`, author: "Creator & Co", language: "en",
      sourceUrl: `https://www.patreon.com/posts/${101 + index}`, assets: [{ type: "image/svg+xml", path: "images/image-1.svg", dataUrl: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>') }],
      body: { tag: "div", children: [{ tag: "p", children: [`Body ${index + 1}: café 日本語.`] }, { tag: "h1", children: ["A section"] }, { tag: "img", image: 0, alt: "Inline picture" }] }
    })
  })), skipped: 0 }; }, count);
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(`${count} posts are ready`);
}
async function bytes(download) {
  const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function download(page, click) { const pending = page.waitForEvent("download"); await click(); const result = await pending; return { result, data: await bytes(result) }; }

test("Single Markdown is one ordered offline document with metadata, contents and embedded images", async ({ page }) => {
  await fixture(page);
  const single = await download(page, () => formats(page).getByRole("button", { name: "Single Markdown", exact: true }).click({ timeout: 5000 }));
  expect(single.result.suggestedFilename()).toBe("Collected stories.md");
  expect(single.data.subarray(0, 2).toString()).not.toBe("PK");
  const text = single.data.toString("utf8");
  expect(text).toContain("**Creator:** Creator &amp; Co"); expect(text).toContain("**Download time:**");
  expect(text).toContain("https://www.patreon.com/collection/500");
  expect(text).toContain("# Collected stories"); expect(text).toContain("## Contents");
  expect(text).toContain("(#chapter-001)"); expect(text).toContain('id="chapter-002"');
  expect(text.indexOf("Body 1:")).toBeLessThan(text.indexOf("Body 2:"));
  expect(text).toContain("café 日本語"); expect(text).toContain("### A section");
  expect(text.match(/!\[Inline picture\]\(data:image\//g)).toHaveLength(2);
  const html = new commonmark.HtmlRenderer().render(new commonmark.Parser().parse(text));
  expect(html).toContain('<h2>Chapter 1 [story]</h2>');
  await expect(page.locator(".report-totals")).toContainText("2 included");
  await expect(formats(page).getByRole("button", { name: "Markdown", exact: true })).toBeEnabled();
  const separate = await download(page, () => formats(page).getByRole("button", { name: "Markdown", exact: true }).click());
  expect(separate.result.suggestedFilename()).toBe("Collected stories.zip");
  expect(readZip(separate.data).map(entry => entry.name)).toEqual(["001 - Chapter 1 [story].md", "002 - Chapter 2 [story].md"]);
});

test("Single Markdown retries chapters and packaging without rebuilding retained chapters", async ({ page }) => {
  await fixture(page); await page.evaluate(() => { globalThis.collectionFailedIndices = [1]; });
  await formats(page).getByRole("button", { name: "Single Markdown", exact: true }).click({ timeout: 5000 });
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeVisible();
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; globalThis.failArchivePackaging = true; });
  await page.getByRole("button", { name: "Retry failed posts", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry packaging", exact: true })).toBeVisible();
  await page.evaluate(() => { globalThis.failArchivePackaging = false; });
  const file = await download(page, () => page.getByRole("button", { name: "Retry packaging", exact: true }).click());
  expect(file.result.suggestedFilename()).toBe("Collected stories.md");
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1, 1]);
});

test("Single Markdown cancellation prevents a late file and 101 chapters use numbered parts", async ({ page }) => {
  test.setTimeout(90_000);
  await fixture(page, 101);
  await page.evaluate(() => { globalThis.collectionMessageHolds = ["COLLECTION_ARCHIVE_PACKAGE"]; });
  await formats(page).getByRole("button", { name: "Single Markdown", exact: true }).click({ timeout: 5000 });
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType), { timeout: 60_000 }).toBe("COLLECTION_ARCHIVE_PACKAGE");
  const downloads = []; page.on("download", value => downloads.push(value));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
  await expect(page.getByRole("status")).toContainText("Cancelled"); expect(downloads).toHaveLength(0);
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("101 posts are ready");
  await formats(page).getByRole("button", { name: "Single Markdown", exact: true }).click({ timeout: 5000 });
  await expect.poll(() => downloads.length, { timeout: 60_000 }).toBe(2);
  expect(downloads.map(item => item.suggestedFilename())).toEqual(["Collected stories - Part 001 of 002.md", "Collected stories - Part 002 of 002.md"]);
  const tail = (await bytes(downloads[1])).toString("utf8");
  expect(tail).toContain("Body 101:"); expect(tail).not.toContain("Body 100:");
  expect(tail).toContain('id="chapter-001"');
});
