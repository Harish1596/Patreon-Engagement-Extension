const { test, expect } = require("@playwright/test");
const { fixture, extensionRoot, setup, button, dialog, enable, change } = require("./helpers/reader");

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
  for (const [name, ink] of [["White", "rgb(34, 34, 34)"], ["Sepia", "rgb(91, 70, 54)"], ["Light Green", "rgb(34, 34, 34)"], ["Charcoal", "rgb(245, 245, 240)"]]) {
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
    for (const [name, ink] of [["White", "rgb(34, 34, 34)"], ["Sepia", "rgb(91, 70, 54)"], ["Light Green", "rgb(34, 34, 34)"], ["Charcoal", "rgb(245, 245, 240)"]]) {
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
    await palette.getByRole("radio", { name: "Charcoal", exact: true }).click();
    await enable(page, false);
    await expect(like.locator("span").first()).toHaveCSS("color", original);
    for (const icon of await controls.locator("svg").all()) await expect(icon).toHaveCSS("fill", original);
  });
}

for (const disabled of [false, true]) {
  test(`comment entry follows Post Color with disabled=${disabled} without changing editing or login behavior`, async ({ page }) => {
    const field = `<a data-tag="login-field" href="/login"><div class="TextInput-module__hash__root ${disabled ? "TextInput-module__hash__disabled" : ""}">
      <label data-tag="comment-field-label">Comment Field</label>
      <div data-tag="comment-field-box"><div data-tag="comment-field-with-affixes">
        <textarea data-tag="comment-field" placeholder="Join the conversation..." aria-invalid="false" ${disabled ? "disabled" : ""}></textarea>
      </div></div></div></a>`;
    const content = fixture.replace('</style>', `
      [data-tag="comment-field-box"], [data-tag="comment-field-with-affixes"] { background:rgb(28,28,32); }
      [data-tag="comment-field-with-affixes"] { border:1px solid rgb(120,120,120); border-radius:8px; }
      [data-tag="comment-field"] { color:white; background:transparent; border:none; padding:12px; font:16px Arial; }
      [data-tag="comment-field"]::placeholder { color:rgb(200,200,200); opacity:1; }
      [data-tag="comment-field"]:disabled { -webkit-text-fill-color:rgb(200,200,200); }
      .TextInput-module__hash__root.TextInput-module__hash__disabled { opacity:.5; }
    </style>`).replace('</main>', `<section data-tag="content-card-comment-thread-container">${field}<button id="other-form-button" style="color:rgb(10,20,30);background:rgb(40,50,60)">Send</button></section></main><aside id="outside-field">${field}</aside>`);
    await setup(page, { content, stored: { readerEnabled: true } });
    await page.locator('#post [data-tag="login-field"]').evaluate(node => {
      globalThis.loginClicks = 0;
      node.addEventListener("click", event => { event.preventDefault(); globalThis.loginClicks++; });
    });
    // Disabled textareas can suppress pointer-event bubbling. Preserve the
    // browser's original behavior rather than making the disabled input active.
    await page.locator('#post [data-tag="comment-field-with-affixes"]').click({ position: { x: 1, y: 1 } });
    const nativeLoginClicks = await page.evaluate(() => loginClicks);
    await button(page).click();
    const input = page.locator('#post [data-tag="comment-field"]');
    const box = page.locator('#post [data-tag="comment-field-box"]');
    const affixes = page.locator('#post [data-tag="comment-field-with-affixes"]');
    const palette = dialog(page).getByRole("radiogroup", { name: "Post Color", exact: true });
    for (const [name, background, ink] of [
      ["White", "rgb(255, 255, 255)", "rgb(34, 34, 34)"],
      ["Sepia", "rgb(244, 236, 216)", "rgb(91, 70, 54)"],
      ["Light Green", "rgb(227, 237, 223)", "rgb(34, 34, 34)"],
      ["Charcoal", "rgb(32, 33, 36)", "rgb(245, 245, 240)"]
    ]) {
      await palette.getByRole("radio", { name, exact: true }).click();
      const inputBackground = await box.evaluate(node => getComputedStyle(node).backgroundColor);
      await expect(affixes).toHaveCSS("background-color", inputBackground);
      const appearance = await box.evaluate((node, { background, ink }) => {
        const context = document.createElement("canvas").getContext("2d");
        context.fillStyle = getComputedStyle(node).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        const pageRgb = background.match(/\d+/g).map(Number);
        const hex = channels => "#" + channels.map(value => value.toString(16).padStart(2, "0")).join("");
        return {
          rgb, pageRgb,
          contrast: PatreonExtension.contrast(hex(rgb), hex(ink.match(/\d+/g).map(Number)))
        };
      }, { background, ink });
      for (let channel = 0; channel < 3; channel++) {
        // Allow a one-level canvas readback variation across browser privacy settings.
        expect(Math.abs(appearance.rgb[channel] - Math.round(appearance.pageRgb[channel] * .92))).toBeLessThanOrEqual(1);
        expect(appearance.rgb[channel]).toBeLessThan(appearance.pageRgb[channel]);
      }
      expect(appearance.contrast).toBeGreaterThanOrEqual(4.5);
      await expect(affixes).toHaveCSS("border-top-color", ink);
      await expect(input).toHaveCSS("color", ink);
      await expect(input).toHaveCSS("-webkit-text-fill-color", ink);
      expect(await input.evaluate(node => getComputedStyle(node, "::placeholder").color)).toBe(ink);
      await expect(input).toHaveCSS("font-size", "16px");
      await expect(page.locator('#post .TextInput-module__hash__root')).toHaveCSS("opacity", disabled ? "0.5" : "1");
      expect(await input.isDisabled()).toBe(disabled);
      await expect(page.locator('#outside-field [data-tag="comment-field-with-affixes"]')).toHaveCSS("background-color", "rgb(28, 28, 32)");
      await expect(page.locator('#other-form-button')).toHaveCSS("background-color", "rgb(40, 50, 60)");
    }
    await page.keyboard.press("Escape");
    if (!disabled) {
      await input.fill("A draft comment");
      await expect(input).toBeFocused();
      await expect(affixes).toHaveCSS("outline-style", "solid");
      await expect(affixes).toHaveCSS("outline-color", "rgb(245, 245, 240)");
    }
    await affixes.click({ position: { x: 1, y: 1 } });
    expect(await page.evaluate(() => loginClicks)).toBe(nativeLoginClicks * 2);
    await page.locator('#post [data-tag="login-field"]').dispatchEvent("click");
    expect(await page.evaluate(() => loginClicks)).toBe(nativeLoginClicks * 2 + 1);
    await expect(page.locator('#post [data-tag="login-field"]')).toHaveAttribute("href", "/login");
    await input.evaluate(node => node.setAttribute("aria-invalid", "true"));
    await affixes.evaluate(node => { node.style.borderColor = "rgb(255, 0, 0)"; });
    await expect(affixes).toHaveCSS("border-top-color", "rgb(255, 0, 0)");
    await button(page).click();
    await palette.getByRole("radio", { name: "Default", exact: true }).click();
    await expect(affixes).toHaveCSS("background-color", "rgb(28, 28, 32)");
    await expect(input).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(await input.evaluate(node => getComputedStyle(node, "::placeholder").color)).toBe("rgb(200, 200, 200)");
    await palette.getByRole("radio", { name: "Sepia", exact: true }).click();
    await enable(page, false);
    await expect(box).toHaveCSS("background-color", "rgb(28, 28, 32)");
    await expect(input).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(await input.isDisabled()).toBe(disabled);
    if (!disabled) await expect(input).toHaveValue("A draft comment");
  });
}
