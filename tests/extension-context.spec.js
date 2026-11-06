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
