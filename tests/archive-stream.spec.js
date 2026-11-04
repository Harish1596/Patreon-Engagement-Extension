const { test, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { setup } = require("./helpers/reader");
const { readZip } = require("./helpers/zip");

test("large archive streams through disk without whole-file reads or retained chapter payloads", async ({ page }, testInfo) => {
  await setup(page, { content: '<main><h1>Streaming fixture</h1></main>', url: "https://www.patreon.com/collection/500" });
  const pending = page.waitForEvent("download");
  const result = await page.evaluate(async () => {
    Blob.prototype.arrayBuffer = () => { throw new Error("Whole-file reads are forbidden in this streaming test."); };
    const id = crypto.randomUUID();
    const { request, store } = PatreonArchiveStream;
    await request("CREATE", { id, count: 12, filename: "Streaming fixture.zip" });
    const entries = [];
    for (let index = 0; index < 12; index++) {
      const data = new Uint8Array(1024 * 1024);
      for (let offset = 0; offset < data.length; offset += 65536) crypto.getRandomValues(data.subarray(offset, offset + 65536));
      data[0] = index;
      entries.push(await store(id, index, { name: `${index + 1} - 章节.md`, data }));
    }
    const beforePackage = await request("GET", { id });
    await request("PACKAGE", { id });
    return { id, entries, beforePackage, sizes: globalThis.archiveChunkSizes };
  });
  const download = await pending;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  await page.evaluate(id => PatreonArchiveStream.request("DROP", { id }), result.id);
  const entries = readZip(bytes);
  expect(entries).toHaveLength(12);
  for (const [index, entry] of entries.entries()) {
    expect(entry.name).toBe(`${index + 1} - 章节.md`);
    expect(entry.data.length).toBe(1024 * 1024);
    expect(entry.data[0]).toBe(index);
    expect(result.entries[index].data).toBeUndefined();
  }
  expect(result.beforePackage.entries).toEqual(result.entries);
  expect(result.sizes.every(size => size <= 1024 * 1024)).toBe(true);
  const file = testInfo.outputPath("streamed.zip");
  fs.writeFileSync(file, bytes);
  execFileSync("unzip", ["-t", file]);
  if (process.platform === "darwin") {
    expect(execFileSync("file", ["-b", file], { encoding: "utf8" })).toContain("Zip archive");
    execFileSync("ditto", ["-x", "-k", file, testInfo.outputPath("extracted")]);
  }
});

test("missing temporary storage produces a visible error without a partial download", async ({ page }) => {
  await setup(page, { content: '<main><h1>Storage fixture</h1><a class="fixture_gridCard" href="/posts/101">Post</a></main>',
    url: "https://www.patreon.com/collection/500" });
  let downloads = 0;
  page.on("download", () => { downloads++; });
  await page.evaluate(async () => {
    await archiveTestBackend.ready;
    navigator.storage.getDirectory = async () => { throw new Error("Temporary disk storage is unavailable."); };
  });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Temporary disk storage is unavailable");
  expect(downloads).toBe(0);
});
