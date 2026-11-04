const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
const current = page => page.locator("[data-progress-current]");
const counts = page => page.locator("[data-progress-counts]");
const elapsed = page => page.locator("[data-progress-elapsed]");
const formats = page => page.frameLocator('iframe[title="Collection export formats"]');

async function ready(page) {
  await setup(page, { content: '<main><h1>Progress collection</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Second</a></main>',
    url: "https://www.patreon.com/collection/500" });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Choose a format");
}

test("progress shows the current title and elapsed time, rejects stale updates, and freezes on cancellation", async ({ page }) => {
  await ready(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.evaluate(() => { globalThis.collectionMessageHolds = ["BUILD_COLLECTION_EXPORT"]; });
  await formats(page).getByRole("button", { name: "Markdown", exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("BUILD_COLLECTION_EXPORT");
  await expect(current(page)).toHaveText("Post 1 of 2: First post");
  await expect(counts(page)).toHaveText("Completed 0 of 2");
  await page.clock.runFor(2100);
  await expect(elapsed(page)).toHaveText("Elapsed: 0:02");
  await page.evaluate(async () => {
    const held = collectionHeldMessage;
    const progress = { type: "COLLECTION_EXPORT_PROGRESS", token: held.token,
      phase: "build", current: 0, total: 2, index: 0, operationId: "old-operation", title: "Stale title" };
    await deliverExtensionMessage(progress);
  });
  await expect(current(page)).toHaveText("Post 1 of 2: First post");
  await page.evaluate(() => deliverExtensionMessage({ type: "COLLECTION_EXPORT_PROGRESS", token: collectionHeldMessage.token,
    phase: "build", current: 0, total: 2, index: 0, operationId: collectionHeldMessage.operationId, title: "<img src=x> Chapter" }));
  await expect(current(page)).toHaveText("Post 1 of 2: <img src=x> Chapter");
  await expect(current(page).locator("img")).toHaveCount(0);
  await formats(page).locator("body").evaluate(() => parent.postMessage({ source: "patreon-reader-collection-error",
    token: location.hash.slice(1), error: "Late chooser error" }, "https://www.patreon.com"));
  await expect(page.getByRole("status")).not.toContainText("Late chooser error");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cancelled.");
  const stopped = await elapsed(page).textContent();
  await page.clock.runFor(5000);
  await expect(elapsed(page)).toHaveText(stopped);
  await page.evaluate(async () => {
    await deliverExtensionMessage({ ...collectionHeldMessage,
      type: "COLLECTION_EXPORT_PROGRESS", phase: "build", current: 1, total: 2, title: "Late title" });
    globalThis.collectionMessageHolds = [];
    releaseCollectionMessage();
  });
  await expect(page.getByRole("status")).toContainText("Cancelled.");
});

test("compression reports bytes and stays below 100 percent until the file is committed", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    globalThis.collectionMessageHolds = ["COLLECTION_ARCHIVE_END"];
    globalThis.collectionCachedIndices = [0];
  });
  await formats(page).getByRole("button", { name: "Markdown", exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("COLLECTION_ARCHIVE_END");
  await expect(page.getByRole("status")).toHaveText("Compressing and saving chapter… 99%.");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Compressing and saving chapter: 99%");
  await expect(page.locator("[data-progress-bytes]")).toContainText("Compressed");
  await expect(counts(page)).toHaveText("Completed 0 of 2 · 1 cached");
  await page.evaluate(() => {
    globalThis.collectionMessageHolds = ["COLLECTION_ARCHIVE_PACKAGE"];
    releaseCollectionMessage();
  });
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("COLLECTION_ARCHIVE_PACKAGE");
  await expect(counts(page)).toHaveText("Completed 2 of 2 · 1 cached");
  const stopped = await page.evaluate(() => collectionHeldMessage);
  await page.evaluate(async held => {
    const message = { type: "COLLECTION_ARCHIVE_PROGRESS", id: held.id, operationId: held.operationId,
      current: 0, total: 2, index: 0, name: "001 - First post.md", bytesCopied: 512, bytesTotal: 1024 };
    await deliverExtensionMessage({ ...message, operationId: "old-operation", name: "Stale filename" });
    await deliverExtensionMessage(message);
  }, stopped);
  await expect(current(page)).toHaveText("File 1 of 2: 001 - First post.md");
  await expect(page.getByRole("status")).toHaveText("Packaging collection ZIP… 50%.");
  await expect(page.locator("[data-progress-bytes]")).toHaveText("512 B of 1.0 KiB packaged");
  const pending = page.waitForEvent("download");
  await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
  await pending;
  await expect(page.getByRole("status")).toContainText("ZIP download started");
  await expect(page.getByRole("progressbar")).toBeHidden();
});

test("retry retains completed counts and starts a fresh clock and failure count", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => { globalThis.collectionFailedIndices = [1]; });
  await formats(page).getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry failed posts", exact: true })).toBeVisible();
  await expect(counts(page)).toHaveText("Completed 1 of 2 · 1 failed");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.evaluate(() => { globalThis.collectionFailedIndices = []; globalThis.collectionMessageHolds = ["BUILD_COLLECTION_EXPORT"]; });
  await page.getByRole("button", { name: "Retry failed posts", exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.collectionHeldType)).toBe("BUILD_COLLECTION_EXPORT");
  await expect(current(page)).toHaveText("Post 2 of 2: Second post");
  await expect(counts(page)).toHaveText("Completed 1 of 2");
  await expect(elapsed(page)).toHaveText("Elapsed: 0:00");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cancelled.");
  await page.evaluate(() => { globalThis.collectionMessageHolds = []; releaseCollectionMessage(); });
});
