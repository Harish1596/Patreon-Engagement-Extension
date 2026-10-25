const { test, expect } = require("@playwright/test");
const { fixture, extensionRoot, setup, button, dialog, enable, change } = require("./helpers/reader");

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

test("missing post hooks fail safely without adding controls elsewhere", async ({ page }) => {
  await setup(page, { content: fixture.replace('data-tag="post-title"', 'data-tag="unknown-title"'), stored: { readerEnabled: true } });
  await expect(button(page)).toHaveCount(0);
  await expect(page.locator("[data-patreon-reader-body]")).toHaveCount(0);
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
