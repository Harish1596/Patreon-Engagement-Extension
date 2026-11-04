const { test, expect } = require('@playwright/test');
const { setup, extensionRoot } = require('./helpers/reader');
const fs = require('node:fs');
const path = require('node:path');
const menu = page => page.getByRole('dialog', { name: 'Download Collection', exact: true });
const frame = page => page.frameLocator('iframe[title="Collection export formats"]');
async function fixture(page, largeText = false) {
  await setup(page, { url: 'https://www.patreon.com/collection/500', content: '<main><h1>Collection</h1><a class="fixture_gridCard" href="/posts/101">First</a><a class="fixture_gridCard" href="/posts/102">Second</a></main>' });
  if (largeText) await page.route('https://fixture-extension.invalid/export/collection-chooser.css', route => route.fulfill({
    contentType: 'text/css', body: fs.readFileSync(path.join(extensionRoot, 'export/collection-chooser.css'), 'utf8') + '\nlabel,legend,button{font-size:28px!important}.description{font-size:26px}'
  }));
  await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
  await expect(frame(page).getByRole('button', { name: 'Download EPUB', exact: true })).toBeEnabled();
}
for (const [theme, width, height] of [['light', 1280, 900], ['dark', 1280, 900], ['dark', 360, 740]]) {
  test(`${theme} ${width}px selectors show one clear action without clipping`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: theme });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page);
    await expect(frame(page).getByRole('group', { name: 'Format', exact: true }).getByRole('radio')).toHaveCount(3);
    await expect(frame(page).getByRole('group', { name: 'Packaging', exact: true }).getByRole('radio')).toHaveCount(2);
    await expect(frame(page).locator('#formats button')).toHaveCount(1);
    await expect(frame(page).getByRole('radio', { name: 'EPUB', exact: true })).toBeChecked();
    await expect(frame(page).getByRole('radio', { name: 'Single file', exact: true })).toBeChecked();
    await expect(frame(page).locator('#download-collection')).toHaveAccessibleDescription(/one ebook/);
    // Selecting options is safe: discovery and fetching start only on Download.
    await frame(page).getByRole('radio', { name: 'Markdown', exact: true }).check();
    await frame(page).getByRole('radio', { name: 'Separate files (ZIP)', exact: true }).check();
    expect(await page.evaluate(() => collectionPrepareCount)).toBe(0);
    await expect(frame(page).locator('#download-collection')).toHaveText('Download Markdown ZIP');
    await expect(frame(page).locator('#download-collection')).toHaveAccessibleDescription(/editable.*ZIP/);
    const bounds = await page.locator('iframe[title="Collection export formats"]').boundingBox();
    const panel = await menu(page).boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0); expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    const geometry = await frame(page).locator('body').evaluate(() => ({
      height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight,
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      controls: [...document.querySelectorAll('label, #download-collection')].map(node => ({ bottom: node.getBoundingClientRect().bottom, height: node.getBoundingClientRect().height }))
    }));
    expect(geometry.scrollHeight).toBeLessThanOrEqual(Math.ceil(bounds.height));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
    expect(geometry.controls.every(control => control.height >= 44 && control.bottom <= geometry.height)).toBe(true);
    await page.screenshot({ path: `/tmp/collection-selectors-${theme}-${width}.png` });
    await frame(page).locator('#download-collection').focus();
    const pending = page.waitForEvent('download'); await frame(page).locator('#download-collection').click(); await pending;
    await expect(page.getByRole('status')).toContainText('ZIP download started');
    expect(errors).toEqual([]);
  });
}
test('native radio keyboard navigation changes selection and Escape returns focus', async ({ page }) => {
  await fixture(page);
  await frame(page).getByRole('radio', { name: 'EPUB', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(frame(page).getByRole('radio', { name: 'PDF', exact: true })).toBeChecked();
  await expect(frame(page).locator('#download-collection')).toHaveText('Download PDF');
  await expect(frame(page).getByRole('radio', { name: 'PDF', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(frame(page).getByRole('radio', { name: 'Markdown', exact: true })).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(frame(page).getByRole('radio', { name: 'Single file', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(frame(page).getByRole('radio', { name: 'Separate files (ZIP)', exact: true })).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(frame(page).locator('#download-collection')).toBeFocused();
  await expect(frame(page).locator('#download-collection')).toBeEnabled();
  const pending = page.waitForEvent('download'); await page.keyboard.press('Enter'); await pending;
  await expect(page.getByRole('status')).toContainText('ZIP download started');
  await frame(page).locator('#download-collection').focus();
  await page.keyboard.press('Escape'); await expect(menu(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Download Collection', exact: true })).toBeFocused();
});
test('initial doubled text remains enabled and fits the measured frame on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 }); await fixture(page, true);
  const geometry = await frame(page).locator('body').evaluate(() => ({
    height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight,
    width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    bottom: document.querySelector('#download-collection').getBoundingClientRect().bottom
  }));
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  await expect(frame(page).getByRole('radio')).toHaveCount(5);
  for (const input of await frame(page).getByRole('radio').all()) await expect(input).toBeEnabled();
  await page.screenshot({ path: '/tmp/collection-selectors-doubled-text.png' });
});
test('resize accepts only the current frame token and bounded height', async ({ page }) => {
  await fixture(page);
  const iframe = page.locator('iframe[title="Collection export formats"]');
  const initial = await iframe.evaluate(node => node.style.height);
  for (const [token, height] of [['old-token', 500], [null, 50000]]) {
    await frame(page).locator('body').evaluate(({ token, height }) => parent.postMessage({
      source: 'patreon-reader-collection-size', token: token || location.hash.slice(1), height
    }, 'https://www.patreon.com'), { token, height });
    await expect(iframe).toHaveCSS('height', initial);
  }
});
