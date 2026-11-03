const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { setup } = require("./helpers/reader");
const { readZip } = require("./helpers/zip");
const frames = page => page.frameLocator('iframe[title="Collection export formats"]');
async function bookFixture(page) {
  await setup(page, { content: '<main><h1>A &amp; B collection</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Second</a></main>', url: "https://www.patreon.com/collection/500?view=expanded" });
  await page.evaluate(() => {
    globalThis.collectionBuildResult = { files: [0, 1].map(index => {
      const title = index ? "Second chapter" : "First <chapter> & title";
      return { title, extension: "snapshot", encoding: "text", data: JSON.stringify({
        version: 1, postId: String(101 + index), title, author: "Creator & Co", language: "en",
        sourceUrl: `https://www.patreon.com/posts/${101 + index}`,
        assets: [{ type: "image/svg+xml", path: "images/image-1.svg", dataUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><script>alert(1)</script><rect width="8" height="8"/></svg>') }],
        body: { tag: "div", children: [{ tag: "p", children: [`Body ${index + 1}.`] }, { tag: "img", image: 0, alt: "Embedded image" }, { tag: "img", image: 0, alt: "Repeated image" }] }
      }) };
    }) };
  });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 posts are ready");
}
async function download(page, click) {
  const pending = page.waitForEvent("download"); await click();
  const result = await pending, chunks = [];
  for await (const bytes of await result.createReadStream()) chunks.push(bytes);
  return { result, bytes: Buffer.concat(chunks) };
}

test("Single EPUB contains ordered chapters, a title page, TOC, navigation and offline images", async ({ page }, testInfo) => {
  await bookFixture(page);
  const { result, bytes } = await download(page, () => frames(page).getByRole("button", { name: "Single EPUB", exact: true }).click());
  expect(result.suggestedFilename()).toBe("A & B collection.epub");
  const file = testInfo.outputPath("collection.epub"); fs.writeFileSync(file, bytes);
  expect(execFileSync("unzip", ["-t", file], { encoding: "utf8" })).toContain("No errors detected");
  const entries = readZip(bytes), names = entries.map(entry => entry.name);
  expect(entries[0].name).toBe("mimetype"); expect(entries[0].method).toBe(0);
  expect(entries[0].data.toString()).toBe("application/epub+zip");
  expect(bytes.readUInt16LE(28)).toBe(0);
  expect(names.filter(name => name.endsWith("post.xhtml"))).toEqual(["EPUB/chapters/001/post.xhtml", "EPUB/chapters/002/post.xhtml"]);
  expect(names.filter(name => name.endsWith(".svg"))).toEqual(["EPUB/chapters/001/images/image-1.svg", "EPUB/chapters/002/images/image-1.svg"]);
  expect(names.some(name => name.endsWith(".epub"))).toBe(false);
  const documents = Object.fromEntries(entries.filter(entry => /\.(xhtml|opf|xml)$/.test(entry.name)).map(entry => [entry.name, entry.data.toString()]));
  const inspected = await page.evaluate(documents => {
    const docs = Object.fromEntries(Object.entries(documents).map(([name, content]) => [name, new DOMParser().parseFromString(content, "application/xml")]));
    if (Object.values(docs).some(doc => doc.querySelector("parsererror"))) throw Error("Invalid EPUB XML");
    const opf = docs["EPUB/package.opf"], nav = docs["EPUB/nav.xhtml"], first = docs["EPUB/chapters/001/post.xhtml"];
    return {
      title: opf.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "title")[0].textContent,
      toc: [...nav.querySelectorAll("li a")].map(link => [link.textContent, link.getAttribute("href")]),
      spine: [...opf.querySelectorAll("spine itemref")].map(item => item.getAttribute("idref")),
      images: [...first.querySelectorAll("img")].map(img => img.getAttribute("src")),
      navigation: [...first.querySelectorAll("nav a")].map(link => link.getAttribute("href")),
      style: first.querySelector("link").getAttribute("href"),
      manifest: [...opf.querySelectorAll("manifest item")].map(item => item.getAttribute("href"))
    };
  }, documents);
  expect(inspected.title).toBe("A & B collection");
  expect(inspected.toc).toEqual([["First <chapter> & title", "chapters/001/post.xhtml"], ["Second chapter", "chapters/002/post.xhtml"]]);
  expect(inspected.spine).toEqual(["title", "nav", "chapter-0", "chapter-1"]);
  expect(inspected.images).toEqual(["images/image-1.svg", "images/image-1.svg"]);
  expect(inspected.navigation).toEqual(["../../nav.xhtml", "../002/post.xhtml"]);
  expect(inspected.style).toBe("../../styles.css");
  for (const path of inspected.manifest) expect(names).toContain(`EPUB/${path}`);
  expect(documents["EPUB/title.xhtml"]).toContain("Creator &amp; Co");
  expect(documents["EPUB/title.xhtml"]).toContain("Download time");
  expect(documents["EPUB/title.xhtml"]).toContain("https://www.patreon.com/collection/500");
  expect(documents["EPUB/chapters/002/post.xhtml"]).toContain('../001/post.xhtml');
  expect(entries.filter(entry => entry.name.endsWith(".svg")).every(entry => !entry.data.toString().includes("<script"))).toBe(true);
  await expect(frames(page).getByRole("button", { name: "EPUB", exact: true })).toBeEnabled();
  const separate = await download(page, () => frames(page).getByRole("button", { name: "EPUB", exact: true }).click());
  expect(separate.result.suggestedFilename()).toBe("A & B collection.zip");
  expect(readZip(separate.bytes).every(entry => entry.name.endsWith(".epub"))).toBe(true);
});

test("a failed chapter retries independently before a Single EPUB is downloaded", async ({ page }) => {
  await bookFixture(page);
  await page.evaluate(() => { globalThis.collectionFailedIndices = [1]; });
  await frames(page).getByRole("button", { name: "Single EPUB", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry failed posts" })).toBeVisible();
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1]);
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; });
  const { bytes } = await download(page, () => page.getByRole("button", { name: "Retry failed posts" }).click());
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1, 1]);
  expect(readZip(bytes).filter(entry => entry.name.endsWith("post.xhtml"))).toHaveLength(2);
});


test("book packaging retry reuses staged chapters without whole-file reads", async ({ page }) => {
  await bookFixture(page);
  await page.evaluate(() => { globalThis.failArchivePackaging = true; });
  await frames(page).getByRole("button", { name: "Single EPUB", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry packaging" })).toBeVisible();
  await page.evaluate(() => { globalThis.failArchivePackaging = false; globalThis.collectionMessageHolds = ["COLLECTION_ARCHIVE_PACKAGE"]; });
  await page.getByRole("button", { name: "Retry packaging" }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("COLLECTION_ARCHIVE_PACKAGE");
  const pending = page.waitForEvent("download");
  await page.evaluate(() => {
    Blob.prototype.arrayBuffer = () => { throw new Error("Whole-file reads are forbidden during book assembly"); };
    globalThis.releaseCollectionMessage();
  });
  const chunks = [];
  for await (const bytes of await (await pending).createReadStream()) chunks.push(bytes);
  expect(readZip(Buffer.concat(chunks))[0].name).toBe("mimetype");
  expect(await page.evaluate(() => collectionBuildIndices)).toEqual([0, 1]);
});

test("cancelling book packaging removes the checkpoint and ignores late work", async ({ page }) => {
  await bookFixture(page);
  await page.evaluate(() => { globalThis.collectionMessageHolds = ["COLLECTION_ARCHIVE_PACKAGE"]; });
  let downloads = 0;
  page.on("download", () => { downloads++; });
  await frames(page).getByRole("button", { name: "Single EPUB", exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("COLLECTION_ARCHIVE_PACKAGE");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cancelled");
  await page.evaluate(() => globalThis.releaseCollectionMessage());
  await expect.poll(() => page.evaluate(() => globalThis.collectionLateReplyReleased)).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle("patreon-archives-v1");
    let count = 0; for await (const item of dir.values()) { void item; count++; } return count;
  })).toBe(0);
  expect(downloads).toBe(0);
});
