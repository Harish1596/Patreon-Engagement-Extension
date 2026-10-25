const { test, expect, chromium } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs");
const { browserExecutable } = require("../scripts/browser-config");

test("installed Brave extension: actual storage, content scripts, and popup", async () => {
  test.skip(process.env.TEST_BROWSER !== "brave", "Uses Brave's unpacked-extension support.");
  const root = path.resolve(__dirname, "../extension");
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath: browserExecutable("brave"),
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  try {
    const manager = await context.newPage();
    await manager.goto("chrome://extensions");
    const extensionId = await manager.evaluate(async () => {
      for (let attempt = 0; attempt < 50; attempt++) {
        const list = document.querySelector("extensions-manager")?.shadowRoot?.querySelector("extensions-item-list");
        const item = [...(list?.shadowRoot?.querySelectorAll("extensions-item") ?? [])]
          .find((node) => node.data?.name === "Patreon Reader");
        if (item) return item.data.id;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Unpacked extension did not load");
    });
    await context.route("https://www.patreon.com/**", (route) => route.fulfill({
      contentType: "text/html",
      body: fs.readFileSync(path.join(__dirname, "fixtures/installed-post.html"), "utf8")
    }));
    const first = await context.newPage();
    await first.goto("https://www.patreon.com/example/posts/test-123");
    const second = await context.newPage();
    await second.goto("https://www.patreon.com/example/posts/test-124");
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup).toHaveTitle("Patreon Reader");
    const toggle = popup.getByRole("switch", { name: "Enable Reader Customization", exact: true });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    const reader = first.getByRole("button", { name: "Customize reading appearance", exact: true });
    await expect(reader).toBeVisible();
    await expect(second.getByRole("button", { name: "Customize reading appearance", exact: true })).toBeVisible();
    await first.bringToFront();
    await popup.evaluate(() => showPageStatus());
    await expect(popup.locator("#status")).toHaveText("Preferences apply to all posts");
    await reader.click();
    await first.getByLabel("Font family", { exact: true }).selectOption("georgia");
    await expect(first.locator("#body")).toHaveCSS("font-family", 'Georgia, "Times New Roman", serif');
    await expect(second.locator("#body")).toHaveCSS("font-family", 'Georgia, "Times New Roman", serif');
    await first.getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name: "Charcoal", exact: true }).click();
    await expect(first.locator("[data-patreon-reader-surface]")).toHaveCSS("background-color", "rgb(32, 33, 36)");
    await expect(first.locator("[data-patreon-reader-surface]")).toHaveClass(/__singleColumnContentWrapper/);
    await expect(first.locator('[class$="__singleColumnContent"]')).toHaveCSS("background-color", "rgb(32, 33, 36)");
    await expect(second.locator("[data-patreon-reader-surface]")).toHaveCSS("background-color", "rgb(32, 33, 36)");
    await expect(second.locator("#body")).toHaveCSS("color", "rgb(245, 245, 240)");
    await expect(first.locator('.actions [data-tag="like-button"] span')).toHaveCSS("color", "rgb(245, 245, 240)");
    await first.getByRole("radiogroup", { name: "Post Color", exact: true }).getByRole("radio", { name: "Light Green", exact: true }).click();
    await expect(first.locator('.actions [data-tag="like-button"] span')).toHaveCSS("color", "rgb(34, 34, 34)");
    await expect(second.locator('.actions [data-tag="like-button"] span')).toHaveCSS("color", "rgb(34, 34, 34)");
    await first.getByRole("dialog").screenshot({ path: "test-results/reader-panel.png" });
    await popup.locator("body").screenshot({ path: "test-results/popup.png" });
    await toggle.uncheck();
    await expect(reader).toHaveCount(0);
    await expect(first.getByRole("dialog")).toHaveCount(0);
    await expect(second.locator("#body")).toHaveCSS("font-family", "Arial");
    await toggle.check();
    await expect(second.locator("#body")).toHaveCSS("font-family", 'Georgia, "Times New Roman", serif');
    await popup.getByRole("switch", { name: "Hide engagement bar", exact: true }).uncheck();
    await expect(first.locator('[data-tag="floating-engagement-sheet"]')).toBeVisible();
  } finally {
    await context.close();
  }
});
