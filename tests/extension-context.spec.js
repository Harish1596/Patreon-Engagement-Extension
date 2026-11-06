const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers/reader');
for (const namespace of ['browser', 'chrome']) test(`${namespace} invalidation does not escape collection route observer error handling`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page, { namespace, url: 'https://www.patreon.com/collection/500', content: '<main><h1>Context collection</h1></main>' });
  await expect(page.getByRole('button', { name: 'Download Collection', exact: true })).toBeVisible();
  await page.evaluate(namespace => {
    globalThis.invalidatedCalls = 0;
    globalThis[namespace].runtime.sendMessage = () => {
      globalThis.invalidatedCalls++;
      throw new Error('Extension context invalidated.');
    };
  }, namespace);
  for (let n = 0; n < 3; n++) {
    const before = await page.evaluate(() => invalidatedCalls);
    await page.evaluate(() => document.querySelector('main').append(document.createElement('div')));
    await expect.poll(() => page.evaluate(() => invalidatedCalls)).toBeGreaterThan(before);
  }
  expect(errors).toEqual([]);
  const message = await page.evaluate(async () => {
    try { await PatreonExtension.call(PatreonExtension.api.runtime, 'sendMessage', {}); }
    catch (error) { return error.message; }
  });
  expect(message).toMatch(/Refresh this Patreon page/);
});

for (const namespace of ['browser', 'chrome']) for (const failure of ['missing-id', 'url-throws']) {
  test(`${namespace} collection opens refresh recovery after ${failure} and refreshes only on request`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await setup(page, { namespace, url: 'https://www.patreon.com/collection/500', content: '<main><h1>Context collection</h1></main>' });
    await expect(page.getByRole('button', { name: 'Download Collection', exact: true })).toBeVisible();
    await page.evaluate(({ namespace, failure }) => {
      const runtime = globalThis[namespace].runtime;
      if (failure === 'missing-id') runtime.id = undefined;
      else runtime.getURL = () => { throw new Error('Extension context invalidated.'); };
    }, { namespace, failure });
    await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('The extension was reloaded. Refresh this Patreon page to continue.');
    const refresh = page.getByRole('button', { name: 'Refresh page', exact: true });
    await expect(refresh).toBeVisible(); await expect(refresh).toBeFocused();
    await expect(page.locator('iframe[title="Collection export formats"]')).toBeHidden();
    await expect(page.locator('.format-options')).toBeHidden();
    expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
    const bounds = await page.getByRole('dialog', { name: 'Download Collection', exact: true }).boundingBox();
    expect(bounds.height).toBeLessThan(300);
    await page.getByRole('button', { name: 'Close collection download' }).click();
    await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
    await expect(refresh).toBeVisible();
    expect(errors).toEqual([]);
    const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
    await refresh.click(); await navigation;
    expect(new URL(page.url()).pathname).toBe('/collection/500');
  });
}

test('a chooser resize after context loss switches an open panel to recovery without an uncaught URL call', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page, { url: 'https://www.patreon.com/collection/500', content: '<main><h1>Context collection</h1></main>' });
  await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Collection export formats"]');
  await expect(frame.locator('#download-collection')).toBeEnabled();
  await page.evaluate(() => { chrome.runtime.getURL = () => { throw new Error('Extension context invalidated.'); }; });
  await frame.locator('body').evaluate(() => parent.postMessage({ source: 'patreon-reader-collection-size',
    token: location.hash.slice(1), height: 500, revision: 999 }, 'https://www.patreon.com'));
  await expect(page.getByRole('button', { name: 'Refresh page', exact: true })).toBeVisible();
  await expect(page.locator('.format-options')).toBeHidden();
  await expect(page.getByRole('progressbar')).toBeHidden();
  expect(errors).toEqual([]);
});
