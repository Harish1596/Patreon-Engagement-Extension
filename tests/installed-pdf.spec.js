const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { browserExecutable } = require('../scripts/browser-config');
const { inspectPdf } = require('./helpers/pdf');
const { readZip } = require('./helpers/zip');
test('installed Brave exports a post, a combined PDF, and individual PDFs without printing', async () => {
  test.skip(process.env.TEST_BROWSER !== 'brave', 'Uses unpacked-extension support.');
  const root = path.resolve(__dirname, '../extension');
  const context = await chromium.launchPersistentContext('', { headless: true, executablePath: browserExecutable('brave'),
    ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`] });
  try {
    const manager = await context.newPage(); await manager.goto('chrome://extensions');
    const id = await manager.evaluate(async () => {
      for (let n = 0; n < 50; n++) {
        const list = document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-item-list');
        const item = [...(list?.shadowRoot?.querySelectorAll('extensions-item') || [])].find(x => x.data?.name === 'Patreon Reader');
        if (item) return item.data.id; await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Extension did not load');
    });
    await context.route('https://www.patreon.com/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith('/collection/')) return route.fulfill({ contentType: 'text/html', body: '<main><h1>Installed PDF collection</h1><a class="fixture_gridCard" href="/posts/201">First</a><a class="fixture_gridCard" href="/posts/202">Second</a></main>' });
      if (pathname === '/api/posts') return route.fulfill({ status: 404, body: 'Synthetic DOM discovery' });
      return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.resolve(__dirname, 'fixtures/installed-post.html'), 'utf8') });
    });
    const page = await context.newPage(); await page.goto('https://www.patreon.com/posts/201');
    const download = async action => {
      const pending = page.waitForEvent('download'); await action(); const value = await pending;
      const chunks = []; for await (const chunk of await value.createReadStream()) chunks.push(chunk);
      return { value, bytes: Buffer.concat(chunks) };
    };
    await page.getByRole('button', { name: 'Download post', exact: true }).click();
    const post = await download(() => page.frameLocator('iframe[title="Post export formats"]').getByRole('button', { name: 'PDF', exact: true }).click());
    expect(post.value.suggestedFilename()).toBe('Installed extension test.pdf');
    expect((await inspectPdf(post.bytes)).pages[0].text).toContain('Post content.');
    await expect(page.locator('[data-patreon-export-print-frame]')).toHaveCount(0);
    await page.goto('https://www.patreon.com/collection/500');
    await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Collection export formats"]');
    const combined = await download(() => frame.getByRole('button', { name: 'Single PDF', exact: true }).click());
    expect(combined.value.suggestedFilename()).toBe('Installed PDF collection.pdf');
    expect((await inspectPdf(combined.bytes)).pages).toHaveLength(3);
    await expect(frame.getByRole('button', { name: 'PDF', exact: true })).toBeEnabled();
    const zip = await download(() => frame.getByRole('button', { name: 'PDF', exact: true }).click());
    expect(readZip(zip.bytes).map(x => x.name)).toEqual(['001 - Installed extension test.pdf', '002 - Installed extension test.pdf']);
    // Native download results are delivered through the existing report path.
    await expect(page.locator('.download-report')).toContainText('completed');
    const worker = context.serviceWorkers().find(x => x.url().startsWith(`chrome-extension://${id}/`));
    expect(worker).toBeTruthy();
  } finally { await context.close(); }
});
