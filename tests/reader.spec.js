const { test, expect } = require("@playwright/test");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

const fixture = `<!doctype html><html><head><style>
  body { margin: 24px; font: 16px Arial; }
  .actions { display: flex; gap: 8px; }
  button { min-width: 44px; min-height: 44px; }
  h1 { font-size: 30px; } p { margin: 0 0 16px; line-height: 1.4; }
</style></head><body>
<main id="post">
  <div><h1 data-tag="post-title"><div>A sample post</div></h1></div>
  <div class="actions"><button data-tag="like-button">Like</button><button data-tag="comment-post-icon">Comment</button><button data-tag="reshare-button">Repost</button><button data-tag="share-post-icon">Share</button><button data-tag="more-actions-button">More</button></div>
  <div class="PostBodies-module__newHash__postContent"><div class="RichText-module__newHash__root RichText-module__newHash__additionalStylesPostContentWrapper">
    <p>First <strong>bold</strong> paragraph with <a href="#link">a link</a>.</p><p>Another paragraph.</p>
    <h2>A heading</h2><ul><li>A list item</li></ul><blockquote><p>A quotation.</p></blockquote>
    <img width="80" height="40" alt="Sample image" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3C/svg%3E">
  </div></div>
</main>
<aside data-tag="comments"><p id="comment">A comment.</p></aside>
<aside data-tag="post-card"><h2 data-tag="post-title">Recommended post</h2><button data-tag="like-button">Other like</button></aside>
<div data-tag="floating-engagement-sheet"><button data-tag="like-button">Floating like</button></div>
</body></html>`;

async function setup(page, { stored = {}, namespace = "chrome", content = fixture } = {}) {
  await page.route("https://www.patreon.com/**", (route) => route.fulfill({ contentType: "text/html", body: content }));
  await page.goto("https://www.patreon.com/example/posts/test-123");
  await page.evaluate(({ stored, namespace }) => {
    localStorage.setItem("test-storage", JSON.stringify(stored));
    const listeners = [];
    const messages = [];
    const changes = (old, next) => {
      const result = {};
      for (const key of Object.keys(next)) if (JSON.stringify(old[key]) !== JSON.stringify(next[key])) result[key] = { oldValue: old[key], newValue: next[key] };
      for (const listener of listeners) listener(result, "local");
    };
    const api = {
      runtime: { id: "fixture-extension", onMessage: { addListener: (fn) => messages.push(fn) } },
      storage: {
        local: {
          get: async () => JSON.parse(localStorage.getItem("test-storage")),
          set: async (next) => {
            if (globalThis.failStorage) throw new Error("Storage unavailable");
            const old = JSON.parse(localStorage.getItem("test-storage"));
            localStorage.setItem("test-storage", JSON.stringify({ ...old, ...next }));
            changes(old, next);
          }
        },
        onChanged: { addListener: (fn) => listeners.push(fn) }
      },
      tabs: {
        query: async () => [{ id: 1 }],
        sendMessage: async () => {
          if (globalThis.failMessage) throw new Error("Receiving end does not exist");
          return globalThis.pageReply ?? { isPostPage: true };
        }
      }
    };
    globalThis.setStored = api.storage.local.set;
    globalThis.readStored = api.storage.local.get;
    window.addEventListener("storage", (event) => {
      if (event.key === "test-storage") changes(JSON.parse(event.oldValue || "{}"), JSON.parse(event.newValue || "{}"));
    });
    if (namespace === "browser") globalThis.browser = api;
    else {
      const wrap = (target, name) => {
        const original = target[name];
        target[name] = (...args) => {
          const callback = args.pop();
          original(...args).then(callback, (error) => {
            api.runtime.lastError = { message: error.message };
            callback();
            delete api.runtime.lastError;
          });
        };
      };
      wrap(api.storage.local, "get"); wrap(api.storage.local, "set");
      wrap(api.tabs, "query"); wrap(api.tabs, "sendMessage");
      globalThis.chrome = api;
    }
  }, { stored, namespace });
  await page.addStyleTag({ path: path.join(root, "content.css") });
  for (const name of ["extension.js", "reader.js", "content.js"]) await page.addScriptTag({ path: path.join(root, name) });
}

const button = (page) => page.getByRole("button", { name: "Customize reading appearance", exact: true });
const dialog = (page) => page.getByRole("dialog", { name: "Reading appearance" });
async function enable(page, value = true) {
  await page.evaluate((readerEnabled) => setStored({ readerEnabled }), value);
}
async function change(page, id, value) {
  await page.locator(`[data-patreon-reader-panel]`).evaluate((host, { id, value }) => {
    const input = host.shadowRoot.getElementById(id);
    if (input.getAttribute("role") === "radiogroup") {
      input.querySelector(`[data-color="${value}"]`).click();
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  }, { id, value });
}

for (const namespace of ["chrome", "browser"]) {
  test(`${namespace}: disabled by default; inserts Reader first only when enabled`, async ({ page }) => {
    await setup(page, { namespace });
    await expect(button(page)).toHaveCount(0);
    await expect(page.locator('[data-tag="floating-engagement-sheet"]')).toBeHidden();
    await enable(page);
    await expect(button(page)).toHaveCount(1);
    await expect(page.locator("#post .actions > :first-child")).toHaveAttribute("data-patreon-reader-button", "");
    await expect(page.locator('[data-tag="post-card"] [data-patreon-reader-button]')).toHaveCount(0);
    await expect(page.locator('[data-tag="floating-engagement-sheet"] [data-patreon-reader-button]')).toHaveCount(0);
  });
}

test("all controls preview and persist; reset removes only reader overrides", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, isHidden: false } });
  await button(page).click();
  await change(page, "font", "georgia");
  await change(page, "textSize", "24");
  await change(page, "postColor", "#f4ecd8");
  await change(page, "paragraphSpacing", "30");
  await change(page, "lineSpacing", "2");
  const paragraph = page.locator('[data-patreon-reader-body] > p').first();
  await expect(paragraph).toHaveCSS("font-size", "24px");
  await expect(paragraph).toHaveCSS("font-family", 'Georgia, "Times New Roman", serif');
  await expect(paragraph).toHaveCSS("line-height", "48px");
  await expect(paragraph).toHaveCSS("margin-bottom", "30px");
  await expect(paragraph).toHaveCSS("color", "rgb(91, 70, 54)");
  await expect(page.locator('[data-patreon-reader-title]')).toHaveCSS("font-size", "36px");
  await expect(page.locator('[data-patreon-reader-body]')).toHaveCSS("background-color", "rgb(244, 236, 216)");
  await expect(paragraph.locator("a")).toHaveCSS("text-decoration-line", "underline");
  await expect(paragraph.locator("strong")).toHaveCSS("font-weight", "700");
  await expect(page.locator("#comment")).toHaveCSS("font-size", "16px");
  await expect(page.locator("img")).toHaveCSS("width", "80px");
  await expect.poll(() => page.evaluate(async () => (await readStored()).readerPreferences?.lineSpacing)).toBe(2);
  await dialog(page).getByRole("button", { name: "Reset to Patreon defaults", exact: true }).click();
  await expect(paragraph).toHaveCSS("font-size", "16px");
  await expect(page.locator('[data-tag="post-title"]').first()).toHaveCSS("font-size", "30px");
  await expect.poll(() => page.evaluate(async () => (await readStored()).readerPreferences?.font)).toBe("default");
  expect(await page.evaluate(async () => (await readStored()).readerEnabled)).toBe(true);
  await expect(page.locator('[data-tag="floating-engagement-sheet"]')).toBeVisible();
});

test("disable removes UI and restores CSS; re-enable restores saved choices", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, readerPreferences: { textSize: 26, font: "verdana" } } });
  await button(page).click();
  await enable(page, false);
  await expect(button(page)).toHaveCount(0);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator("[data-patreon-reader-body]")).toHaveCount(0);
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "16px");
  await enable(page);
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "26px");
});

test("rerenders, post navigation, and leaving posts clean up correctly", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, readerPreferences: { textSize: 22 } } });
  await expect(button(page)).toHaveCount(1);
  const markup = await page.locator("#post").innerHTML();
  await page.locator("#post").evaluate((node, html) => {
    const template = document.createElement("template"); template.innerHTML = html;
    template.content.querySelector("[data-patreon-reader-button]")?.remove();
    node.replaceChildren(template.content);
  }, markup);
  await expect(button(page)).toHaveCount(1);
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "22px");
  await button(page).click();
  await page.evaluate(() => { history.pushState({}, "", "/example/posts/next-124"); document.body.append(document.createElement("div")); });
  await expect(dialog(page)).toHaveCount(0);
  await expect(button(page)).toHaveCount(1);
  await page.evaluate(() => { history.pushState({}, "", "/example"); document.body.append(document.createElement("div")); });
  await expect(button(page)).toHaveCount(0);
  await expect(page.locator("[data-patreon-reader-body]")).toHaveCount(0);
  await page.goBack();
  await expect(button(page)).toHaveCount(1);
});

test("keyboard, outside click, individual reset and narrow layout", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true } });
  await button(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Close reading appearance", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog(page).getByRole("button", { name: "Reset to Patreon defaults", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Close reading appearance", exact: true })).toBeFocused();
  await change(page, "textSize", "28");
  await dialog(page).getByRole("button", { name: "Reset text size to site default", exact: true }).click();
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "16px");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(button(page)).toBeFocused();
  await button(page).click();
  await page.locator("#comment").click();
  await expect(dialog(page)).toBeHidden();
  await page.setViewportSize({ width: 375, height: 667 });
  await button(page).click();
  const bounds = await dialog(page).boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(667);
});

test("malformed preferences cannot inject CSS or exceed control bounds", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, readerPreferences: {
    font: "__proto__", textSize: 9999, paragraphSpacing: -9, lineSpacing: "url(bad)",
    postColor: "red; } body { display:none", backgroundColor: "url(https://example.com)"
  } } });
  await expect(button(page)).toHaveCount(1);
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "32px");
  await expect(page.locator("#post p").first()).toHaveCSS("margin-bottom", "0px");
  await expect(page.locator("body")).toBeVisible();
  expect(await page.locator("html").getAttribute("style")).not.toContain("url(");
});

test("storage failure is visible; preview survives and retry saves", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true } });
  await button(page).click();
  await page.evaluate(() => { globalThis.failStorage = true; });
  await change(page, "textSize", "25");
  await expect(dialog(page).locator("#save-status")).toContainText("Could not save");
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "25px");
  await page.evaluate(() => { globalThis.failStorage = false; });
  await change(page, "font", "georgia");
  await expect(dialog(page).locator("#save-status")).toHaveText("Saved on this device");
  expect(await page.evaluate(async () => (await readStored()).readerPreferences.textSize)).toBe(25);
});

test("missing post hooks fail safely without adding controls elsewhere", async ({ page }) => {
  await setup(page, { content: fixture.replace('data-tag="post-title"', 'data-tag="unknown-title"'), stored: { readerEnabled: true } });
  await expect(button(page)).toHaveCount(0);
  await expect(page.locator("[data-patreon-reader-body]")).toHaveCount(0);
});

test("popup toggles persist independently and report save failures", async ({ page }) => {
  const fs = require("node:fs");
  const html = fs.readFileSync(path.join(root, "popup.html"), "utf8").replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.addScriptTag({ path: path.join(root, "popup.js") });
  const reader = page.getByRole("switch", { name: "Enable Reader Customization", exact: true });
  const engagement = page.getByRole("switch", { name: "Hide engagement bar", exact: true });
  await expect(reader).not.toBeChecked();
  await reader.check();
  await expect(reader).toBeChecked();
  expect(await page.evaluate(async () => (await readStored()).readerEnabled)).toBe(true);
  await expect(engagement).toBeChecked();
  await engagement.uncheck();
  await expect(engagement).not.toBeChecked();
  await page.evaluate(() => { globalThis.failStorage = true; });
  await reader.click();
  await expect(page.locator("#status")).toHaveText("Unable to save. Please try again.");
  await expect(reader).toBeChecked();
});

test("rapid input keeps the latest selection and new sessions restore it", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true } });
  await button(page).click();
  await page.locator("[data-patreon-reader-panel]").evaluate((host) => {
    const input = host.shadowRoot.getElementById("textSize");
    for (const size of [15, 20, 30, 22, 27]) {
      input.value = size; input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await expect.poll(() => page.evaluate(async () => (await readStored()).readerPreferences?.textSize)).toBe(27);
  await expect(dialog(page).locator("#textSize-value")).toHaveText("27px");
  const stored = await page.evaluate(() => readStored());
  await setup(page, { stored });
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "27px");
});

test("changes and enablement propagate to another open post tab", async ({ page, context }) => {
  const stored = { readerEnabled: true };
  await setup(page, { stored });
  const other = await context.newPage();
  await setup(other, { stored });
  await expect(button(other)).toHaveCount(1);
  await button(page).click();
  await change(page, "textSize", "23");
  await expect(other.locator("#post p").first()).toHaveCSS("font-size", "23px");
  await enable(page, false);
  await expect(button(other)).toHaveCount(0);
  await expect(other.locator("#post p").first()).toHaveCSS("font-size", "16px");
});

test("main post-card is supported while comment actions and recommended cards are excluded", async ({ page }) => {
  const content = fixture.replace('<main id="post">', '<main id="post" data-tag="post-card">')
    .replace('<div class="actions">', '<div data-tag="post-details"><div data-tag="top-engagement" class="actions">')
    .replace('</div>\n  <div class="PostBodies', '</div></div>\n  <div class="PostBodies')
    .replace('</main>', '<div data-tag="content-card-comment-thread-container"><div data-tag="comment-row"><p id="nested-comment">Nested comment</p><div data-tag="comment-actions"><button data-tag="like-button">Comment like</button></div></div></div></main>');
  await setup(page, { content, stored: { readerEnabled: true, readerPreferences: { textSize: 24 } } });
  await expect(button(page)).toHaveCount(1);
  await expect(page.locator('[data-tag="top-engagement"] > :first-child')).toHaveAttribute("data-patreon-reader-button", "");
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "24px");
  await expect(page.locator("#nested-comment")).toHaveCSS("font-size", "16px");
  await expect(page.locator('[data-tag="comment-actions"] [data-patreon-reader-button]')).toHaveCount(0);
  await expect(page.locator('[data-tag="post-card"] aside [data-patreon-reader-button]')).toHaveCount(0);
});

test("responsive duplicate titles do not prevent detection or style the wrong post", async ({ page }) => {
  const content = fixture.replace('<main id="post">', '<main id="post" data-tag="post-card">')
    .replace('<div><h1 data-tag="post-title">', '<div class="desktop"><h1 data-tag="post-title">')
    .replace('</h1></div>', '</h1>')
    .replace('<div class="actions">', '<div data-tag="top-engagement" class="actions">')
    .replace('</div>\n  <div class="PostBodies', '</div></div><div class="mobile"><h1 data-tag="post-title">Mobile title</h1><div data-tag="top-engagement"><button data-tag="like-button">Mobile like</button></div></div>\n  <div class="PostBodies')
    .replace('</style>', '.mobile { display:none; } @media(max-width:480px) { .desktop { display:none; } .mobile { display:block; } }</style>');
  await setup(page, { content, stored: { readerEnabled: true, readerPreferences: { textSize: 23 } } });
  await expect(button(page)).toHaveCount(1);
  await expect(page.locator(".desktop [data-patreon-reader-button]")).toBeVisible();
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "23px");
  await page.setViewportSize({ width: 390, height: 720 });
  await expect(button(page)).toHaveCount(1);
  await expect(page.locator(".mobile [data-patreon-reader-button]")).toBeVisible();
  await expect(page.locator('[data-tag="post-card"] > [data-patreon-reader-title]')).toHaveCount(0);
  await expect(page.locator('[data-tag="post-card"] h2[data-tag="post-title"]')).toHaveCSS("font-size", "24px");
});

test("popup distinguishes page connection failures from unsupported or undetected posts", async ({ page }) => {
  const fs = require("node:fs");
  const html = fs.readFileSync(path.join(root, "popup.html"), "utf8").replace(/<script[^>]*><\/script>/g, "").replace('<link rel="stylesheet" href="popup.css" />', "");
  await setup(page, { content: html });
  await page.addScriptTag({ path: path.join(root, "popup.js") });
  await expect(page.locator("#status")).toHaveText("Preferences apply to all posts");
  await page.evaluate(async () => {
    globalThis.pageReply = { isPostPage: true, readerEnabled: true, readerMounted: false };
    await showPageStatus();
  });
  await expect(page.locator("#status")).toHaveText("Reader controls not found on this post");
  await page.evaluate(async () => { globalThis.pageReply = { isPostPage: false }; await showPageStatus(); });
  await expect(page.locator("#status")).toHaveText("Available on Patreon post pages");
  await page.evaluate(async () => { globalThis.failMessage = true; await showPageStatus(); });
  await expect(page.locator("#status")).toHaveText("Open or refresh a Patreon post to connect");
});

test("reading swatches cover the full supplied post column and preserve native controls", async ({ page }) => {
  const content = fixture.replace('<main id="post">', `<nav id="navigation" style="background:rgb(210,220,230)">Navigation</nav><main id="post" data-tag="post-card"><div id="surface" class="PostBodies-module__hash__singleColumnContent"><div id="shell" data-testid="single-column-post-wrapper" style="background:white"><p id="byline" style="color:black">Creator information</p><button id="native-control" style="color:rgb(10,20,30);background:white"><span>Native control</span></button>`)
    .replace('</main>', '<aside data-tag="comments"><p id="surface-comment" style="color:black"><span>A comment inside the column.</span></p></aside></div></div></main>');
  await setup(page, { content, stored: { readerEnabled: true } });
  await button(page).click();
  const backgrounds = dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true });
  await expect(backgrounds.getByRole("radio")).toHaveCount(5);
  await expect(dialog(page).getByRole("radiogroup")).toHaveCount(1);
  await expect(dialog(page).locator('input[type="color"]')).toHaveCount(0);
  await backgrounds.getByRole("radio", { name: "Black", exact: true }).click();
  await expect(page.locator("#surface")).toHaveCSS("background-color", "rgb(32, 33, 36)");
  await expect(page.locator("#shell")).toHaveCSS("background-color", "rgb(32, 33, 36)");
  await expect(page.locator("#byline")).toHaveCSS("color", "rgb(245, 245, 240)");
  await expect(page.locator("#surface-comment span")).toHaveCSS("color", "rgb(245, 245, 240)");
  await expect(page.locator("#post p").nth(1)).toHaveCSS("color", "rgb(245, 245, 240)");
  await expect(page.locator("#native-control span")).toHaveCSS("color", "rgb(10, 20, 30)");
  await expect(page.locator("#navigation")).toHaveCSS("background-color", "rgb(210, 220, 230)");
  await expect(page.locator("#comment")).toHaveCSS("color", "rgb(0, 0, 0)");
  await backgrounds.getByRole("radio", { name: "Sepia", exact: true }).click();
  await expect(page.locator("#surface")).toHaveCSS("background-color", "rgb(244, 236, 216)");
  await expect(page.locator("#byline")).toHaveCSS("color", "rgb(91, 70, 54)");
  await expect(page.locator('[data-patreon-reader-body] > p').first()).toHaveCSS("color", "rgb(91, 70, 54)");
  await backgrounds.getByRole("radio", { name: "Black", exact: true }).click();
  await expect(page.locator('[data-patreon-reader-body] > p').first()).toHaveCSS("color", "rgb(245, 245, 240)");
  await backgrounds.getByRole("radio", { name: "Default", exact: true }).click();
  await expect(page.locator("#shell")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator("#byline")).toHaveCSS("color", "rgb(0, 0, 0)");
  await backgrounds.getByRole("radio", { name: "Light Green", exact: true }).click();
  await enable(page, false);
  await expect(page.locator("[data-patreon-reader-surface]")).toHaveCount(0);
  await expect(page.locator("#shell")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("clickable parent comments and replies receive post ink without recoloring other controls", async ({ page }) => {
  const comments = `<section data-tag="content-card-comment-thread-container">
    <div data-tag="comment-row" role="button" tabindex="0">
      <button data-tag="commenter-name" style="color:white"><span style="color:white">Parent author</span></button>
      <time style="color:white">3w</time>
      <div data-tag="comment-body" style="color:white"><div><p style="color:white"><span style="color:white">Parent comment</span></p></div></div>
      <div data-tag="comment-actions"><button style="color:white"><span style="color:white">Like comment</span></button></div>
    </div>
    <div data-tag="comment-row">
      <button data-tag="commenter-name" style="color:white"><span style="color:white">Reply author</span></button>
      <div data-tag="comment-body"><p style="color:white"><span style="color:white">Reply</span></p></div>
    </div>
    <div role="button" style="color:white"><span id="unrelated-control" style="color:white">Other control</span></div>
  </section>`;
  await setup(page, { content: fixture.replace('</main>', `${comments}</main>`), stored: { readerEnabled: true } });
  await button(page).click();
  const swatches = dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true });
  await expect(swatches.locator('.swatch-face')).toHaveText(["↺", "", "", "", ""]);
  for (const [name, ink] of [["White", "rgb(34, 34, 34)"], ["Sepia", "rgb(91, 70, 54)"], ["Light Green", "rgb(34, 34, 34)"], ["Black", "rgb(245, 245, 240)"]]) {
    await swatches.getByRole("radio", { name, exact: true }).click();
    for (const text of await page.locator('[data-tag="comment-body"], [data-tag="comment-body"] p, [data-tag="comment-body"] span, [data-tag="commenter-name"], [data-tag="commenter-name"] span, [data-tag="comment-row"] time').all()) {
      await expect(text).toHaveCSS("color", ink);
    }
    await expect(page.locator('#unrelated-control')).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator('[data-tag="comment-actions"] span')).toHaveCSS("color", ink);
  }
  await swatches.getByRole("radio", { name: "Default", exact: true }).click();
  await expect(page.locator('[data-tag="comment-body"] span').first()).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator('[data-tag="commenter-name"] span').first()).toHaveCSS("color", "rgb(255, 255, 255)");
  await swatches.getByRole("radio", { name: "Light Green", exact: true }).click();
  await enable(page, false);
  await expect(page.locator('[data-tag="comment-body"] span').first()).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator('[data-tag="commenter-name"] span').first()).toHaveCSS("color", "rgb(255, 255, 255)");
});

for (const native of ["white", "black"]) {
  test(`comment action icons and counts contrast with presets over native ${native}`, async ({ page }) => {
    const actions = `<div data-tag="comment-actions">
      <button class="TextLinkStyle-module__PNsRYa__root TextLinkStyle-module__PNsRYa__hasIconColor" data-tag="like-button" aria-label="Like comment" aria-pressed="false"><span><svg width="20" height="20"><path d="M0 0h10v10z"/></svg></span><span class="count">4</span></button>
      <button class="TextLinkStyle-module__PNsRYa__root" aria-label="Reply to comment"><span><svg width="20" height="20"><path d="M0 0h10v10z"/></svg></span><span class="count">3</span></button>
      <button class="TextLinkStyle-module__PNsRYa__root" data-tag="comment-more-actions" aria-label="More actions" aria-expanded="false"><span><svg width="20" height="20"><path d="M0 0h10v10z"/></svg></span></button>
    </div>`;
    // Match Patreon's rule: Reply/More lack hasIconColor and force SVG fill.
    // Paths deliberately inherit fill, as in the supplied real-page HTML.
    const content = fixture.replace('</style>', `[data-tag="comment-actions"] button, [data-tag="comment-actions"] span { color:${native}; background:transparent; }
      .TextLinkStyle-module__PNsRYa__root { --TextLinkStyle-color:${native}; }
      .TextLinkStyle-module__PNsRYa__root svg { fill:currentColor; }
      .TextLinkStyle-module__PNsRYa__root:not(.TextLinkStyle-module__PNsRYa__hasIconColor) svg { fill:var(--TextLinkStyle-color) !important; }
      </style>`)
      .replace('</main>', `<section data-tag="content-card-comment-thread-container"><div data-tag="comment-row" role="button" tabindex="0">${actions}</div><div data-tag="comment-row">${actions}</div><button id="comment-form-control" style="color:rgb(10,20,30)">Submit</button></section></main><aside id="outside-comment-actions">${actions}</aside>`);
    await setup(page, { content, stored: { readerEnabled: true } });
    await button(page).click();
    const palette = dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true });
    const controls = page.locator('#post [data-tag="comment-actions"] button');
    const original = native === "white" ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
    for (const [name, ink] of [["White", "rgb(34, 34, 34)"], ["Sepia", "rgb(91, 70, 54)"], ["Light Green", "rgb(34, 34, 34)"], ["Black", "rgb(245, 245, 240)"]]) {
      await palette.getByRole("radio", { name, exact: true }).click();
      for (const control of await controls.all()) {
        await expect(control).toHaveCSS("color", ink);
        await expect(control.locator("span").first()).toHaveCSS("color", ink);
        await expect(control.locator("path")).toHaveCSS("fill", ink);
      }
      for (const count of await page.locator('#post [data-tag="comment-actions"] .count').all()) await expect(count).toHaveCSS("color", ink);
      await expect(page.locator('#comment-form-control')).toHaveCSS("color", "rgb(10, 20, 30)");
      for (const icon of await page.locator('#outside-comment-actions svg').all()) await expect(icon).toHaveCSS("fill", original);
    }
    await palette.getByRole("radio", { name: "Light Green", exact: true }).click();
    await page.keyboard.press("Escape");
    const like = controls.first();
    await like.focus();
    await expect(like).toHaveCSS("outline-color", "rgb(34, 34, 34)");
    await expect(like).toHaveCSS("outline-style", "solid");
    await like.hover();
    await expect(like).toHaveCSS("background-color", "rgb(213, 213, 206)");
    await like.evaluate(node => node.setAttribute("aria-pressed", "true"));
    await expect(like.locator("path")).toHaveCSS("fill", "rgb(155, 35, 67)");
    const more = controls.nth(2);
    await more.evaluate(node => node.setAttribute("aria-expanded", "true"));
    await expect(more).toHaveCSS("color", "rgb(155, 35, 67)");
    await expect(more.locator("path")).toHaveCSS("fill", "rgb(155, 35, 67)");
    await more.evaluate(node => node.setAttribute("aria-disabled", "true"));
    await expect(more).toHaveCSS("opacity", "0.55");
    await expect(more).toHaveCSS("cursor", "not-allowed");
    await button(page).click();
    await palette.getByRole("radio", { name: "Default", exact: true }).click();
    await expect(like.locator("span").first()).toHaveCSS("color", original);
    for (const icon of await controls.locator("svg").all()) await expect(icon).toHaveCSS("fill", original);
    await palette.getByRole("radio", { name: "Black", exact: true }).click();
    await enable(page, false);
    await expect(like.locator("span").first()).toHaveCSS("color", original);
    for (const icon of await controls.locator("svg").all()) await expect(icon).toHaveCSS("fill", original);
  });
}

test("swatch groups support arrow keys and migrate older free-picker colors", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, readerPreferences: { textColor: "#124567", backgroundColor: "#efdfcf" } } });
  await button(page).click();
  const colors = dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true });
  await expect(colors.getByRole("radio", { name: "Sepia", exact: true })).toHaveAttribute("aria-checked", "true");
  await colors.getByRole("radio", { name: "Sepia", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(colors.getByRole("radio", { name: "Light Green", exact: true })).toBeFocused();
  await expect(colors.getByRole("radio", { name: "Light Green", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("End");
  await expect(colors.getByRole("radio", { name: "Black", exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(async () => (await readStored()).readerPreferences?.postColor)).toBe("#202124");
  const normalized = await page.evaluate(() => PatreonExtension.normalize({ textColor: "#124567", backgroundColor: "#efdfcf" }));
  expect(normalized.postColor).toBe("#f4ecd8");
  expect(normalized).not.toHaveProperty("textColor");
  expect(normalized).not.toHaveProperty("backgroundColor");
  const stored = await page.evaluate(async () => (await readStored()).readerPreferences);
  expect(stored).not.toHaveProperty("textColor");
  expect(stored).not.toHaveProperty("backgroundColor");
});

test("post presets are readable matched pairs and new settings override legacy colors", async ({ page }) => {
  await setup(page, { stored: { readerEnabled: true, readerPreferences: {
    postColor: null, backgroundColor: "#202124", textColor: "#ffffff", font: "georgia", textSize: 22
  } } });
  await expect(page.locator("html")).not.toHaveAttribute("data-patreon-reader-background-color", "");
  await expect(page.locator("#post p").first()).toHaveCSS("font-size", "22px");
  const cases = await page.evaluate(() => {
    const { colors, contrast, normalize } = PatreonExtension;
    return {
      ratios: colors.postColor.map(({ value, ink }) => contrast(value, ink)),
      textOnly: normalize({ textColor: "#ffffff" }).postColor,
      invalid: normalize({ postColor: "invalid", backgroundColor: "#202124" }).postColor,
      selected: normalize({ postColor: "#ffffff", backgroundColor: "#202124" }).postColor
    };
  });
  for (const ratio of cases.ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  expect(cases.textOnly).toBeNull();
  expect(cases.invalid).toBeNull();
  expect(cases.selected).toBe("#ffffff");
});

test("background covers the outer single-column wrapper and its padding", async ({ page }) => {
  const content = fixture.replace('<main id="post">', '<main id="post" data-tag="post-card"><div id="outer-surface" class="PostBodies-module__changedHash__singleColumnContentWrapper" style="padding:40px;background:rgb(200,210,220)"><div id="inner-surface" class="PostBodies-module__changedHash__singleColumnContent" style="background:white">')
    .replace('</main>', '</div></div></main>');
  await setup(page, { content, stored: { readerEnabled: true, readerPreferences: { backgroundColor: "#f4ecd8" } } });
  await expect(page.locator("#outer-surface")).toHaveAttribute("data-patreon-reader-surface", "");
  await expect(page.locator("#inner-surface")).not.toHaveAttribute("data-patreon-reader-surface", "");
  await expect(page.locator("#outer-surface")).toHaveCSS("background-color", "rgb(244, 236, 216)");
  await expect(page.locator("#inner-surface")).toHaveCSS("background-color", "rgb(244, 236, 216)");
  await expect(page.locator("#outer-surface")).toHaveCSS("padding", "40px");
  await button(page).click();
  await dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name: "Default", exact: true }).click();
  await expect(page.locator("#outer-surface")).toHaveCSS("background-color", "rgb(200, 210, 220)");
  await expect(page.locator("#inner-surface")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await change(page, "postColor", "#202124");
  await expect(page.locator("#outer-surface")).toHaveCSS("background-color", "rgb(32, 33, 36)");
  await enable(page, false);
  await expect(page.locator("[data-patreon-reader-surface]")).toHaveCount(0);
  await expect(page.locator("#outer-surface")).toHaveCSS("background-color", "rgb(200, 210, 220)");
});

for (const nativeColor of ["white", "black"]) {
  test(`post actions contrast with every reading background over native ${nativeColor} icons`, async ({ page }) => {
    const content = fixture.replace('</style>', `.actions button { color:${nativeColor}; border:1px solid ${nativeColor}; background:transparent; } .native-icon, .native-count { color:${nativeColor}; } </style>`)
      .replace('<div class="actions">', '<div class="actions" data-tag="top-engagement">')
      .replace('<button data-tag="like-button">Like</button>', '<button data-tag="like-button" aria-pressed="false"><span class="native-icon"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="currentColor"/></svg></span><span class="native-count">16</span></button>');
    await setup(page, { content, stored: { readerEnabled: true } });
    const like = page.locator('#post [data-tag="like-button"]');
    const original = nativeColor === "white" ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
    await expect(like.locator(".native-count")).toHaveCSS("color", original);
    await button(page).click();
    for (const [name, ink] of [["White", "rgb(34, 34, 34)"], ["Sepia", "rgb(91, 70, 54)"], ["Light Green", "rgb(34, 34, 34)"], ["Black", "rgb(245, 245, 240)"]]) {
      await dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name, exact: true }).click();
      for (const tag of ["like-button", "comment-post-icon", "reshare-button", "share-post-icon", "more-actions-button"]) {
        await expect(page.locator(`#post [data-tag="${tag}"]`)).toHaveCSS("color", ink);
        await expect(page.locator(`#post [data-tag="${tag}"]`)).toHaveCSS("border-top-color", ink);
      }
      await expect(like.locator(".native-count")).toHaveCSS("color", ink);
      await expect(like.locator("circle")).toHaveCSS("fill", ink);
      await expect(page.locator('[data-patreon-reader-body] > p').first()).toHaveCSS("color", ink);
      await expect(button(page)).toHaveCSS("color", name === "Black" ? "rgb(255, 179, 191)" : "rgb(155, 35, 67)");
    }
    await dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name: "Light Green", exact: true }).click();
    await expect(like).toHaveCSS("color", "rgb(34, 34, 34)");
    await page.keyboard.press("Escape");
    await button(page).focus();
    await expect(button(page)).toHaveCSS("outline-style", "solid");
    await expect(button(page)).toHaveCSS("outline-color", "rgb(34, 34, 34)");
    await like.hover();
    await expect(like).toHaveCSS("background-color", "rgb(213, 213, 206)");
    await like.evaluate((node) => node.setAttribute("aria-pressed", "true"));
    await expect(like).toHaveCSS("color", "rgb(155, 35, 67)");
    await expect(like.locator(".native-count")).toHaveCSS("color", "rgb(155, 35, 67)");
    await like.evaluate((node) => node.setAttribute("aria-disabled", "true"));
    await expect(like).toHaveCSS("opacity", "0.55");
    await expect(like).toHaveCSS("cursor", "not-allowed");
    await button(page).click();
    await dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name: "Default", exact: true }).click();
    await expect(like.locator(".native-count")).toHaveCSS("color", original);
    await change(page, "postColor", "#202124");
    await enable(page, false);
    await expect(like.locator(".native-count")).toHaveCSS("color", original);
    await expect(page.locator("[data-patreon-reader-actions]")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-patreon-reader-action-hover", "");
  });
}
