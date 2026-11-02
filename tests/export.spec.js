const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const { readZip } = require("./helpers/zip");

const downloadButton = (page) => page.getByRole("button", { name: "Download post", exact: true });
const downloadDialog = (page) => page.getByRole("dialog", { name: "Download post", exact: true });
const formats = (page) => page.frameLocator('iframe[title="Post export formats"]');
const formatButton = (page, name) => formats(page).getByRole("button", { name, exact: true });

test("collection requests cannot export a previous document during post navigation", async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const wrong = await deliverExtensionMessage({ type: "DESCRIBE_POST_EXPORT", expectedPostId: "124" });
    const right = await deliverExtensionMessage({ type: "DESCRIBE_POST_EXPORT", expectedPostId: "123" });
    history.pushState({}, "", "/posts/124");
    const stale = await deliverExtensionMessage({ type: "BUILD_POST_EXPORT", expectedPostId: "124",
      format: "markdown", transferId: "11111111-1111-4111-8111-111111111111" });
    return { wrong, right, stale };
  });
  expect(result.wrong.error).toContain("not finished loading");
  expect(result.right.post.postId).toBe("123");
  expect(result.stale.error).toContain("not finished loading");
  expect(result.stale.file).toBeUndefined();
});

async function downloadBytes(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("cancelling a portable build prevents late media from publishing a file in an existing tab", async ({ page }) => {
  let release;
  let started = false;
  const held = new Promise(resolve => { release = resolve; });
  await page.route("https://media.example/**", async route => {
    if (route.request().resourceType() === "fetch") { started = true; await held; }
    await route.fulfill({ contentType: "image/png", body: Buffer.from("89504e470d0a1a0a", "hex") });
  });
  const content = require("./helpers/reader").fixture.replace(/data:image\/svg\+xml,[^\"]+/, "https://media.example/image.png");
  await setup(page, { content });
  await page.evaluate(() => {
    globalThis.pendingPortableBuild = deliverExtensionMessage({ type: "BUILD_POST_EXPORT", format: "markdown",
      expectedPostId: "123", transferId: "11111111-1111-4111-8111-111111111111" });
  });
  await expect.poll(() => started).toBe(true);
  const cancelled = await page.evaluate(() => deliverExtensionMessage({ type: "CANCEL_POST_EXPORT",
    transferId: "11111111-1111-4111-8111-111111111111" }));
  expect(cancelled.cancelled).toBe(true);
  release();
  const result = await page.evaluate(() => pendingPortableBuild);
  expect(result.error).toBeTruthy();
  expect(result.file).toBeUndefined();
  const late = await page.evaluate(() => deliverExtensionMessage({ type: "BUILD_POST_EXPORT", format: "markdown",
    expectedPostId: "123", transferId: "11111111-1111-4111-8111-111111111111" }));
  expect(late.error).toContain("cancelled");
  await expect(downloadButton(page)).toBeVisible();
});

test("EPUB is a self-contained stored ZIP with post XHTML and image bytes", async ({ page }) => {
  const content = require("./helpers/reader").fixture.replace('<div class="actions">',
    '<div data-tag="post-details"><a href="/example">Example Creator</a></div><div class="actions">');
  await setup(page, { content });
  await downloadButton(page).click();
  const pending = page.waitForEvent("download");
  await formatButton(page, "EPUB").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("A sample post.epub");
  const bytes = await downloadBytes(download);
  expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(bytes.includes(Buffer.from("application/epub+zip"))).toBe(true);
  expect(bytes.includes(Buffer.from("EPUB/post.xhtml"))).toBe(true);
  expect(bytes.includes(Buffer.from("A sample post"))).toBe(true);
  expect(bytes.includes(Buffer.from("<dt>Creator</dt><dd>Example Creator</dd>"))).toBe(true);
  expect(bytes.includes(Buffer.from("<dt>Download time</dt>"))).toBe(true);
  expect(bytes.includes(Buffer.from("<dt>Source</dt>"))).toBe(true);
  expect(bytes.includes(Buffer.from("<dc:creator>Example Creator</dc:creator>"))).toBe(true);
  expect(bytes.includes(Buffer.from("A comment."))).toBe(false);
  expect(bytes.includes(Buffer.from("<svg"))).toBe(true);
});

test("PDF prepares a sanitized offline print view and invokes native printing", async ({ page }) => {
  const content = require("./helpers/reader").fixture.replace("A sample post", "A / sample: post?").replace('<div class="actions">',
    '<div data-tag="post-details"><a href="/example">Example Creator</a></div><div class="actions">');
  await setup(page, { content });
  await page.evaluate(() => {
    document.title = "Existing Patreon tab title";
    const observer = new MutationObserver(() => {
      const frame = document.querySelector("[data-patreon-export-print-frame]");
      if (!frame) return;
      frame.contentWindow.print = () => {
        window.printedExportHtml = frame.contentDocument.documentElement.outerHTML;
        window.printedTabTitle = document.title;
        window.exportPrintCalled = true;
      };
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
  await downloadButton(page).click();
  await formatButton(page, "PDF").click();
  await expect(downloadDialog(page).getByRole("status")).toContainText("Save as PDF");
  const result = await page.evaluate(() => ({
    html: printedExportHtml, printed: exportPrintCalled,
    printedTabTitle, restoredTabTitle: document.title
  }));
  expect(result.printed).toBe(true);
  expect(result.html).toContain("<title>A sample post</title>");
  expect(result.html).toContain("<h1>A / sample: post?</h1>");
  expect(result.printedTabTitle).toBe("A sample post");
  expect(result.restoredTabTitle).toBe("Existing Patreon tab title");
  expect(result.html).toContain("<dt>Creator</dt><dd>Example Creator</dd>");
  expect(result.html).toContain("<dt>Download time</dt>");
  expect(result.html).toContain("<dt>Source</dt>");
  expect(result.html.indexOf('<dl class="metadata">')).toBeLessThan(result.html.indexOf("<h1>A / sample: post?</h1>"));
  expect(result.html).toContain("https://www.patreon.com/example/posts/test-123");
  expect(result.html).toContain("@page{margin:0}");
  expect(result.html).toContain("data:image/svg+xml");
  expect(result.html).not.toContain("A comment.");
  expect(result.html).not.toContain("<script");
});

test("remote post media requests only its exact origin and embeds returned bytes", async ({ page }) => {
  await page.route("https://media.example/**", async route => {
    await new Promise(resolve => setTimeout(resolve, 100));
    await route.fulfill({
      contentType: "image/png",
      body: Buffer.from("89504e470d0a1a0a", "hex")
    });
  });
  const image = "https://media.example/post-image.png?signature=private";
  const content = require("./helpers/reader").fixture.replace(/data:image\/svg\+xml,[^\"]+/, image);
  await setup(page, { content });
  await downloadButton(page).click();
  const progress = downloadDialog(page).getByRole("progressbar", { name: "Post download progress" });
  const pending = page.waitForEvent("download");
  await formatButton(page, "Markdown").click();
  await expect(progress).toBeVisible();
  const markdown = (await downloadBytes(await pending)).toString("utf8");
  await expect(progress).toBeHidden();
  expect(await page.evaluate(() => requestedExportOrigins)).toEqual(["https://media.example/*"]);
  expect(markdown).toContain("# A sample post");
  expect(markdown).toContain("**Creator:** Not available");
  expect(markdown).toContain("**Download time:**");
  expect(markdown).toContain("**Source:** [https://www.patreon.com/example/posts/test-123]");
  expect(markdown.indexOf("**Creator:**")).toBeLessThan(markdown.indexOf("# A sample post"));
  expect(markdown).toContain("**bold**");
  expect(markdown).toContain("data:image/png;base64,iVBORw0KGgo=");
  expect(markdown).not.toContain("signature=private");
  expect(markdown).not.toContain("A comment.");
  expect(markdown).not.toContain("Recommended post");
});

test("denied media permission produces no partial offline export", async ({ page }) => {
  const content = require("./helpers/reader").fixture.replace(/data:image\/svg\+xml,[^\"]+/, "https://media.example/post.png");
  await setup(page, { content });
  await downloadButton(page).click();
  await expect(formatButton(page, "Markdown")).toBeVisible();
  await formats(page).locator("body").evaluate(() => parent.postMessage({
    source: "patreon-reader-export",
    token: location.hash.slice(1),
    error: "Media access was not granted, so an offline export cannot be created."
  }, "https://www.patreon.com"));
  await expect(downloadDialog(page).getByRole("status")).toContainText("Media access was not granted");
});

test("download UI follows post rerenders and leaves unsupported routes", async ({ page }) => {
  await setup(page);
  await expect(downloadButton(page)).toHaveCount(1);
  await page.locator("#post").evaluate(node => node.querySelector("[data-patreon-download-button]").remove());
  await expect(downloadButton(page)).toHaveCount(1);
  await page.evaluate(() => { history.pushState({}, "", "/example"); document.body.append(document.createElement("div")); });
  await expect(downloadButton(page)).toHaveCount(0);
  await expect(downloadDialog(page)).toHaveCount(0);
});

test("post formats share distinct images, refresh download time, and invalidate changed or expired content", async ({ page }) => {
  let fetches = 0;
  await page.route("https://media.example/**", async route => {
    if (route.request().resourceType() === "fetch") fetches++;
    await route.fulfill({ contentType: "image/png", body: Buffer.from("89504e470d0a1a0a", "hex") });
  });
  const content = require("./helpers/reader").fixture.replace(/data:image\/svg\+xml,[^\"]+/, "https://media.example/post.png?signature=private");
  await setup(page, { content });
  await page.locator("#post img").evaluate(image => image.after(image.cloneNode()));
  await downloadButton(page).click();
  async function download(format) {
    const pending = page.waitForEvent("download");
    await expect(formatButton(page, format)).toBeVisible();
    const result = await page.evaluate(format => {
      const frame = document.querySelector('[data-patreon-download-panel]').shadowRoot.querySelector("iframe");
      return deliverExtensionMessage({ type: "POST_EXPORT_CHOICE", token: new URL(frame.src).hash.slice(1), format: format.toLowerCase() });
    }, format);
    expect(result.started).toBe(true);
    const bytes = await downloadBytes(await pending);
    await expect(downloadDialog(page).getByRole("status")).toHaveText(`${format} download started.`);
    return bytes;
  }
  const markdown = (await download("Markdown")).toString();
  expect(fetches).toBe(1);
  expect(markdown.match(/data:image\/png;base64/g)).toHaveLength(2);
  await page.evaluate(() => {
    const OriginalDate = Date;
    const future = OriginalDate.now() + 60 * 60_000;
    globalThis.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [future])); }
    };
    document.querySelector('#post [class*="additionalStylesPostContentWrapper"]').style.fontSize = "26px";
  });
  const epub = readZip(await download("EPUB"));
  expect(fetches).toBe(1);
  expect(epub.filter(entry => entry.name.startsWith("EPUB/images/"))).toHaveLength(1);
  const xhtml = epub.find(entry => entry.name === "EPUB/post.xhtml").data.toString();
  expect(xhtml.match(/src="images\/image-1.png"/g)).toHaveLength(2);
  const time = await page.evaluate(() => new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short"
  }).format(new Date()));
  expect(xhtml).toContain(time);
  expect(xhtml).not.toContain("signature=private");
  await page.locator("#post p").first().evaluate(node => { node.textContent = "Updated chapter text."; });
  expect((await download("Markdown")).toString()).toContain("Updated chapter text.");
  expect(fetches).toBe(2);
  await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 121 * 60_000; });
  await download("EPUB");
  expect(fetches).toBe(3);
});
