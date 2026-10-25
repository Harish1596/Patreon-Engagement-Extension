const { test, expect } = require("@playwright/test");
const { fixture, setup, button, dialog, enable, change } = require("./helpers/reader");

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

test("reading swatches cover the full supplied post column and preserve native controls", async ({ page }) => {
  const content = fixture.replace('<main id="post">', `<nav id="navigation" style="background:rgb(210,220,230)">Navigation</nav><main id="post" data-tag="post-card"><div id="surface" class="PostBodies-module__hash__singleColumnContent"><div id="shell" data-testid="single-column-post-wrapper" style="background:white"><p id="byline" style="color:black">Creator information</p><button id="native-control" style="color:rgb(10,20,30);background:white"><span>Native control</span></button>`)
    .replace('</main>', '<aside data-tag="comments"><p id="surface-comment" style="color:black"><span>A comment inside the column.</span></p></aside></div></div></main>');
  await setup(page, { content, stored: { readerEnabled: true } });
  await button(page).click();
  const backgrounds = dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true });
  await expect(backgrounds.getByRole("radio")).toHaveCount(5);
  await expect(dialog(page).getByRole("radiogroup")).toHaveCount(1);
  await expect(dialog(page).locator('input[type="color"]')).toHaveCount(0);
  await backgrounds.getByRole("radio", { name: "Charcoal", exact: true }).click();
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
  await backgrounds.getByRole("radio", { name: "Charcoal", exact: true }).click();
  await expect(page.locator('[data-patreon-reader-body] > p').first()).toHaveCSS("color", "rgb(245, 245, 240)");
  await backgrounds.getByRole("radio", { name: "Default", exact: true }).click();
  await expect(page.locator("#shell")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator("#byline")).toHaveCSS("color", "rgb(0, 0, 0)");
  await backgrounds.getByRole("radio", { name: "Light Green", exact: true }).click();
  await enable(page, false);
  await expect(page.locator("[data-patreon-reader-surface]")).toHaveCount(0);
  await expect(page.locator("#shell")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});



test("membership banner follows Post Color without changing Join buttons, images, or layout", async ({ page }) => {
  const banner = `<div data-testid="cta-banner-wrapper"><div class="PostBodies-module__newHash__singleColumnContent"><div class="CTABanner-module__newHash__root" style="background:rgb(28,28,32);border-radius:12px;padding:24px;display:flex;gap:16px;box-shadow:0 2px 4px rgba(0,0,0,.12)">
    <img alt="Creator artwork" width="64" height="64" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3C/svg%3E">
    <div><p style="color:white">Get more from the creator</p><p style="color:white">Join to get free updates.</p></div>
    <button data-tag="join-for-free-button" style="color:white;background:rgb(82,48,255);border-radius:99px"><span style="color:white">Join for free</span></button>
    <div><p style="color:white">Get free updates on mobile.</p><button style="color:white;background:rgb(82,48,255)"><span style="color:white">Join</span></button></div>
  </div></div></div>`;
  const content = fixture.replace('</main>', `${banner}</main><aside id="outside-banner">${banner}</aside>`);
  await setup(page, { content, stored: { readerEnabled: true } });
  await button(page).click();
  await change(page, "textSize", "24");
  const card = page.locator('#post [class*="CTABanner-module__"][class*="__root"]');
  const originalShadow = await card.evaluate(node => getComputedStyle(node).boxShadow);
  const originalSize = await card.evaluate(node => [node.offsetWidth, node.offsetHeight]);
  const palette = dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true });
  for (const [name, background, ink] of [
    ["White", "rgb(255, 255, 255)", "rgb(34, 34, 34)"],
    ["Sepia", "rgb(244, 236, 216)", "rgb(91, 70, 54)"],
    ["Light Green", "rgb(227, 237, 223)", "rgb(34, 34, 34)"],
    ["Charcoal", "rgb(32, 33, 36)", "rgb(245, 245, 240)"]
  ]) {
    await palette.getByRole("radio", { name, exact: true }).click();
    await expect(card).toHaveCSS("background-color", background);
    const shadow = await card.evaluate(node => getComputedStyle(node).boxShadow);
    expect(shadow).not.toBe(originalShadow);
    expect(shadow).toContain("0px 0px 0px 1px");
    expect(shadow).toContain("0px 6px 18px 0px");
    // Check the outline derives from the current preset, including light ink on Charcoal.
    const expectedShadow = await card.evaluate((node, color) => {
      const probe = document.createElement("div");
      probe.style.boxShadow = `0 0 0 1px color-mix(in srgb, ${color} 28%, transparent), 0 6px 18px rgba(0,0,0,.18)`;
      node.append(probe);
      const result = getComputedStyle(probe).boxShadow;
      probe.remove();
      return result;
    }, ink);
    expect(shadow).toBe(expectedShadow);
    expect(await card.evaluate(node => [node.offsetWidth, node.offsetHeight])).toEqual(originalSize);
    for (const paragraph of await card.locator("p").all()) {
      await expect(paragraph).toHaveCSS("color", ink);
      await expect(paragraph).toHaveCSS("font-size", "16px");
    }
    for (const join of await card.locator("button").all()) {
      await expect(join).toHaveCSS("background-color", "rgb(82, 48, 255)");
      await expect(join.locator("span")).toHaveCSS("color", "rgb(255, 255, 255)");
      await expect(join).toHaveCSS("box-shadow", "none");
    }
    await expect(card).toHaveCSS("padding", "24px");
    await expect(card).toHaveCSS("display", "flex");
    await expect(card).toHaveCSS("border-radius", "12px");
    await expect(card.locator("img")).toHaveCSS("width", "64px");
    await expect(page.locator('#outside-banner [class*="CTABanner-module__"]')).toHaveCSS("background-color", "rgb(28, 28, 32)");
    await expect(page.locator('#outside-banner p').first()).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.locator('#outside-banner [class*="CTABanner-module__"]')).toHaveCSS("box-shadow", originalShadow);
  }
  await palette.getByRole("radio", { name: "Default", exact: true }).click();
  await expect(card).toHaveCSS("background-color", "rgb(28, 28, 32)");
  await expect(card).toHaveCSS("box-shadow", originalShadow);
  await expect(card.locator("p").first()).toHaveCSS("color", "rgb(255, 255, 255)");
  await palette.getByRole("radio", { name: "Sepia", exact: true }).click();
  await enable(page, false);
  await expect(card).toHaveCSS("background-color", "rgb(28, 28, 32)");
  await expect(card).toHaveCSS("box-shadow", originalShadow);
  await expect(card.locator("p").first()).toHaveCSS("color", "rgb(255, 255, 255)");
});


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
  await expect(colors.getByRole("radio", { name: "Charcoal", exact: true })).toBeFocused();
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
    for (const [name, ink] of [["White", "rgb(34, 34, 34)"], ["Sepia", "rgb(91, 70, 54)"], ["Light Green", "rgb(34, 34, 34)"], ["Charcoal", "rgb(245, 245, 240)"]]) {
      await dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name, exact: true }).click();
      for (const tag of ["like-button", "comment-post-icon", "reshare-button", "share-post-icon", "more-actions-button"]) {
        await expect(page.locator(`#post [data-tag="${tag}"]`)).toHaveCSS("color", ink);
        await expect(page.locator(`#post [data-tag="${tag}"]`)).toHaveCSS("border-top-color", ink);
      }
      await expect(like.locator(".native-count")).toHaveCSS("color", ink);
      await expect(like.locator("circle")).toHaveCSS("fill", ink);
      await expect(page.locator('[data-patreon-reader-body] > p').first()).toHaveCSS("color", ink);
      await expect(button(page)).toHaveCSS("color", name === "Charcoal" ? "rgb(255, 179, 191)" : "rgb(155, 35, 67)");
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
