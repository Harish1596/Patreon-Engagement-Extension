const { test, expect, chromium } = require('@playwright/test');
const path = require('node:path');
const { browserExecutable } = require('../scripts/browser-config');
test('installed Brave recovers an old collection control after an actual extension reload', async () => {
  test.setTimeout(45_000);
  test.skip(process.env.TEST_BROWSER !== 'brave', 'Uses unpacked-extension support.');
  const root = path.resolve(__dirname, '../extension');
  const context = await chromium.launchPersistentContext('', { headless: true, executablePath: browserExecutable('brave'),
    ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`] });
  try {
    const manager = await context.newPage(); await manager.goto('chrome://extensions');
    let id;
    await expect.poll(async () => id = await manager.evaluate(() => {
      const list = document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-item-list');
      return [...(list?.shadowRoot?.querySelectorAll('extensions-item') || [])].find(item => item.data?.name === 'Patreon Reader')?.data.id;
    })).toBeTruthy();
    // CLI loading bypasses the initial Developer-mode requirement; browser reload
    // enforces it, matching the user's normal unpacked-extension setup.
    await manager.evaluate(() => new Promise((resolve, reject) => {
      chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve();
      });
    }));
    await context.route('https://www.patreon.com/**', route => route.fulfill({ contentType: 'text/html', body: '<main><h1>Reload collection</h1></main>' }));
    const page = await context.newPage();
    const errors = [];
    const diagnostics = await context.newCDPSession(page); await diagnostics.send('Runtime.enable');
    diagnostics.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description?.split('\n')[0] || event.exceptionDetails.text));
    let navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    await page.goto('https://www.patreon.com/collection/500?view=expanded');
    await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
    const chooser = page.frameLocator('iframe[title="Collection export formats"]');
    await expect(chooser.locator('#download-collection')).toBeEnabled();
    await page.getByRole('button', { name: 'Close collection download' }).click();
    await test.step('Reload the extension through the browser manager', async () => {
      await manager.evaluate(id => new Promise((resolve, reject) => {
        chrome.developerPrivate.reload(id, { failQuietly: true }, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve();
        });
      }), id);
    });
    const before = navigations;
    await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('The extension was reloaded. Refresh this Patreon page to continue.');
    await expect(page.locator('iframe[title="Collection export formats"]')).toBeHidden();
    const refresh = page.getByRole('button', { name: 'Refresh page', exact: true });
    await expect(refresh).toBeVisible(); await expect(refresh).toBeFocused();
    expect(navigations).toBe(before);
    const previousDocument = await page.evaluate(() => performance.timeOrigin);
    const refreshed = page.waitForEvent('domcontentloaded', { timeout: 10_000 });
    await refresh.click({ noWaitAfter: true }); await refreshed;
    expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(previousDocument);
    expect(page.url()).toBe('https://www.patreon.com/collection/500?view=expanded');
    await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
    await expect(chooser.locator('#download-collection')).toBeEnabled();
    await expect(refresh).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
