const { test, expect } = require("@playwright/test");
const { setup } = require("./helpers/reader");
async function fixture(page) {
  await page.clock.install();
  await setup(page, { content: '<main><h1>Retry collection</h1><a class="fixture_gridCard" href="/posts/101">First</a></main>', url: "https://www.patreon.com/collection/500" });
  await page.evaluate(() => {
    const original = performance.getEntriesByType.bind(performance);
    Object.defineProperty(performance, "getEntriesByType", { value: type => type === "resource"
      ? [...original(type), { name: "https://www.patreon.com/api/posts?filter%5Bcollection_id%5D=500" }] : original(type) });
  });
}
const success = { data: [{ id: "101", type: "post", attributes: { current_user_can_view: true } }], meta: { pagination: { total: 1 } } };

test("temporary collection failures retry with backoff and recover without manual intervention", async ({ page }) => {
  await fixture(page); let requests = 0;
  await page.route("https://www.patreon.com/api/posts**", route => {
    requests++;
    return requests < 3 ? route.fulfill({ status: 503, headers: { "Retry-After": "0" }, body: "Temporarily unavailable" }) : route.fulfill({ json: success });
  });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Retry 2 of 3");
  await page.clock.fastForward(3000);
  await expect(page.getByRole("status")).toContainText("Retry 3 of 3");
  await page.clock.fastForward(5000);
  await expect(page.getByRole("status")).toContainText("ZIP download started");
  expect(requests).toBe(3);
  expect(await page.evaluate(() => collectionPrepareCount)).toBe(1);
});

test("cancel during a retry delay stops further requests and preparation", async ({ page }) => {
  await fixture(page); let requests = 0;
  await page.route("https://www.patreon.com/api/posts**", route => { requests++; return route.fulfill({ status: 503, body: "Temporary failure" }); });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Retry 2 of 3");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cancelled");
  await page.clock.fastForward(60_000);
  expect(requests).toBe(1); expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
});

test("long server Retry-After leaves a visible manual failure without falling back to post loading", async ({ page }) => {
  await fixture(page); let requests = 0;
  await page.route("https://www.patreon.com/api/posts**", route => { requests++; return route.fulfill({ status: 429, headers: { "Retry-After": "120" }, body: "Slow down" }); });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("retry manually later");
  await page.clock.fastForward(60_000);
  expect(requests).toBe(1); expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
});

test("an exhausted transient request stops after three attempts without a hidden DOM retry", async ({ page }) => {
  await fixture(page); let requests = 0;
  await page.route("https://www.patreon.com/api/posts**", route => { requests++; return route.abort("connectionreset"); });
  await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Retry 2 of 3");
  await page.clock.fastForward(3000);
  await expect(page.getByRole("status")).toContainText("Retry 3 of 3");
  await page.clock.fastForward(5000);
  await expect(page.getByRole("status")).toContainText("Automatic retries exhausted after 3 attempts");
  expect(requests).toBe(3); expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
});

for (const status of [401, 403]) {
  test(`collection access failure ${status} stays manual without an automatic retry or DOM fallback`, async ({ page }) => {
    await fixture(page); let requests = 0;
    await page.route("https://www.patreon.com/api/posts**", route => { requests++; return route.fulfill({ status, body: "Access unavailable" }); });
    await page.getByRole("button", { name: "Download Collection", exact: true }).click();
  await page.frameLocator('iframe[title="Collection export formats"]').getByRole("button", { name: "Markdown", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(`Patreon collection request failed (${status})`);
    await page.clock.fastForward(60_000);
    expect(requests).toBe(1); expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
  });
}
