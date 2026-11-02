const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const { readZip } = require("./helpers/zip");
const commonmark = require("commonmark");

async function portable(page, format) {
  return page.evaluate(async format => {
    const transferId = crypto.randomUUID();
    const result = await deliverExtensionMessage({ type: "BUILD_POST_EXPORT", expectedPostId: "123", format, transferId });
    if (result.error) return result;
    let data = "";
    while (data.length < result.file.length) {
      const chunk = await deliverExtensionMessage({ type: "GET_POST_EXPORT_CHUNK", transferId, offset: data.length });
      data += chunk.data;
    }
    return { data };
  }, format);
}

test("Markdown keeps literal markup inert while preserving formatting and fenced code", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const body = document.querySelector("#post img").parentElement;
    const p = document.createElement("p");
    p.textContent = '<img src="https://tracker.invalid/pixel"> ![literal](https://tracker.invalid/image)';
    body.append(p);
    const pre = document.createElement("pre"); pre.textContent = '```\n<img src="https://tracker.invalid/code">'; body.append(pre);
    const code = document.createElement("code"); code.textContent = '`tick`'; body.append(code);
    const link = document.createElement("a"); link.href = "https://example.invalid/a(b)";
    link.textContent = "label](injection)"; body.append(link);
    document.querySelector('[data-tag="post-title"]').textContent = "![title](https://tracker.invalid/title)";
  });
  const { data } = await portable(page, "markdown");
  expect(data).toContain('&lt;img src="https://tracker');
  expect(data).not.toContain('![literal]');
  expect(data).not.toContain('# ![title]');
  expect(data).toContain('\\!\\[literal\\]\\(');
  expect(data).toContain('**bold**');
  expect(data).toContain('````\n```\n<img src="https://tracker.invalid/code">\n````');
  expect(data).toContain('`` `tick` ``');
  expect(data).toContain('[label\\]\\(injection\\)](https://example.invalid/a%28b%29)');
});

test("SVG exports keep shapes and local gradients but remove active and external content, including cached sources", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    document.querySelector("#post img").src = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" viewBox="0 0 80 40">
      <script>alert(1)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">unsafe</div></foreignObject>
      <style>@import url(https://tracker.invalid/style);</style><image href="https://tracker.invalid/image"/>
      <a href="javascript:alert(1)"><rect width="10"/></a><animate attributeName="href" values="https://tracker.invalid/animate"/>
      <defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs>
      <rect width="80" height="40" fill="url(#g)"/><circle r="2" fill="url(https://tracker.invalid/fill)"/>
    </svg>`);
  });
  const snapshot = JSON.parse((await portable(page, "snapshot")).data);
  // Simulate a source written by an older version, without persisting page data.
  snapshot.assets[0].dataUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><image href="https://tracker.invalid/old"/><rect width="20"/></svg>');
  const cached = await page.evaluate(async snapshot => {
    const file = await PatreonExporter.fileFromSnapshot(snapshot, "epub", "https://www.patreon.com/posts/123");
    return file;
  }, snapshot);
  const svg = readZip(Buffer.from((await portable(page, "epub")).data, "base64")).find(entry => entry.name.endsWith(".svg")).data.toString();
  expect(svg).toContain('fill="url(#g)"');
  expect(svg).toContain('<rect');
  expect(svg).not.toMatch(/script|foreignObject|<style|<image|<animate|onload|tracker\.invalid|javascript:/);
  const oldSvg = readZip(Buffer.from(cached.data, "base64")).find(entry => entry.name.endsWith(".svg")).data.toString();
  expect(oldSvg).toContain('<rect');
  expect(oldSvg).not.toMatch(/script|<image|tracker\.invalid/);
  snapshot.assets[0].type = "image/png";
  snapshot.assets[0].dataUrl = snapshot.assets[0].dataUrl.replace("image/svg+xml", "image/png");
  const disguised = await page.evaluate(async snapshot => {
    try { await PatreonExporter.fileFromSnapshot(snapshot, "epub", "https://www.patreon.com/posts/123"); return "accepted"; }
    catch (error) { return error.message; }
  }, snapshot);
  expect(disguised).toContain("declared format");
});

test("invalid image MIME types and SVG document declarations fail without an export", async ({ page }) => {
  await setup(page);
  for (const src of ['data:text/html,%3Cscript%3E', 'data:image/png,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'data:image/svg+xml,' + encodeURIComponent('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>')]) {
    await page.locator('#post img').evaluate((image, src) => { image.src = src; }, src);
    const result = await portable(page, "markdown");
    expect(result.error).toMatch(/unsupported|not supported|declared format/);
    expect(result.data).toBeUndefined();
  }
});


test("rendered Markdown keeps code inert in lists, nested lists, blockquotes and headings", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const body = document.querySelector("#post img").parentElement;
    const payload = '<img src="https://tracker.invalid/nested" onerror="globalThis.auditExecuted=true">';
    for (const shape of ["list", "nested-list", "quote-list", "heading"]) {
      const pre = document.createElement("pre"); pre.textContent = payload;
      let root = pre;
      if (shape !== "heading") {
        const list = document.createElement("ul"), item = document.createElement("li"); item.append(pre); list.append(item); root = list;
        if (shape === "nested-list") { const outer = document.createElement("ul"), li = document.createElement("li"); li.append("Outer", list); outer.append(li); root = outer; }
        if (shape === "quote-list") { const quote = document.createElement("blockquote"); quote.append(list); root = quote; }
      } else { const heading = document.createElement("h2"); heading.append(pre); root = heading; }
      body.append(root);
    }
  });
  const { data } = await portable(page, "markdown");
  const html = new commonmark.HtmlRenderer().render(new commonmark.Parser().parse(data));
  expect(html).not.toContain('<img src="https://tracker.invalid/');
  expect(html.match(/&lt;img src=/g)).toHaveLength(4);
  const preview = await page.context().newPage();
  let requested = false;
  await preview.route("https://tracker.invalid/**", route => { requested = true; return route.abort(); });
  await preview.setContent(html);
  expect(await preview.evaluate(() => globalThis.auditExecuted)).toBeUndefined();
  expect(requested).toBe(false);
  await preview.close();
});
