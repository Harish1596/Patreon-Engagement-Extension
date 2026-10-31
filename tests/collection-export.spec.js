const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");

async function downloadBytes(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("collection export creates ordered separate Markdown files in one ZIP", async ({ page }) => {
  const content = `<!doctype html><html><head><title>Example collection | Patreon</title></head><body><main>
    <h1>Example collection</h1>
    <a href="/example/posts/first-post-101">First</a>
    <a href="/example/posts/second-post-102">Second</a>
    <a href="/example/posts/first-post-101?duplicate=1">Duplicate</a>
    <a href="https://example.com/example/posts/not-patreon-103">External</a>
  </main></body></html>`;
  await setup(page, { content, url: "https://www.patreon.com/collection/500" });
  const trigger = page.getByRole("button", { name: "Download collection", exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("status")).toContainText("2 posts are ready");
  expect(await page.evaluate(() => requestedCollectionUrls)).toEqual([
    "https://www.patreon.com/example/posts/first-post-101",
    "https://www.patreon.com/example/posts/second-post-102"
  ]);
  const pending = page.waitForEvent("download");
  await page.frameLocator('iframe[title="Collection export formats"]')
    .getByRole("button", { name: "Markdown", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("Example collection.zip");
  const bytes = await downloadBytes(download);
  expect(bytes.includes(Buffer.from("001 - First post.md"))).toBe(true);
  expect(bytes.includes(Buffer.from("002 - Second post.md"))).toBe(true);
  expect(bytes.includes(Buffer.from("# First post"))).toBe(true);
  expect(bytes.includes(Buffer.from("# Second post"))).toBe(true);
});

test("collection controls are scoped to collection routes", async ({ page }) => {
  await setup(page);
  await expect(page.getByRole("button", { name: "Download collection", exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    history.pushState({}, "", "/collection/500");
    document.body.innerHTML = '<main><h1>Collection</h1><a href="/example/posts/post-101">Post</a></main>';
  });
  await expect(page.getByRole("button", { name: "Download collection", exact: true })).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, "", "/example");
    document.body.append(document.createElement("div"));
  });
  await expect(page.getByRole("button", { name: "Download collection", exact: true })).toHaveCount(0);
});
