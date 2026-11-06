const { startCollectionDownload } = require("./helpers/collection-choice");
const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { browserExecutable } = require('../scripts/browser-config');
const { inspectPdf } = require('./helpers/pdf');
const { readZip } = require('./helpers/zip');
test('installed Brave exports a post, a combined PDF, and individual PDFs without printing', async ({}, testInfo) => {
  test.setTimeout(90_000);
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
      if (pathname.startsWith('/collection/')) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<main><h1>Installed PDF collection</h1><a class="fixture_gridCard" href="/posts/201">First</a><a class="fixture_gridCard" href="/posts/202">Second</a></main>' });
      if (pathname === '/api/posts') return route.fulfill({ status: 404, body: 'Synthetic DOM discovery' });
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.resolve(__dirname, 'fixtures/installed-post.html'), 'utf8').replace('Post content.', 'Post content. Ḫ ḫ Ṭ ṭ Ḥ ḥ. 𒀭 天地玄黃') });
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
    const postText = (await inspectPdf(post.bytes)).pages[0].text;
    expect(postText).toContain('Post content. Ḫ ḫ Ṭ ṭ Ḥ ḥ.'); expect(postText).toContain('𒀭'); expect(postText.replace(/\s/g, '')).toContain('天地玄黃');
    await expect(page.locator('[data-patreon-export-print-frame]')).toHaveCount(0);
    // Match the existing native export fixture: reuse ready signed-in post tabs.
    for (const id of [201, 202]) {
      const postTab = await context.newPage();
      await postTab.goto(`https://www.patreon.com/posts/${id}`);
      await expect(postTab.getByRole('button', { name: 'Download post', exact: true })).toBeVisible();
    }
    const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup/popup.html`);
    const control = await context.newCDPSession(manager);
    const directory = testInfo.outputPath('pdf-downloads'); fs.mkdirSync(directory, { recursive: true });
    await control.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory, eventsEnabled: true });
    const received = new Set(await popup.evaluate(async () => (await chrome.downloads.search({})).map(record => record.id)));
    const nativeDownload = async action => {
      await action(); let saved;
      await expect.poll(async () => {
        const records = await popup.evaluate(() => chrome.downloads.search({ state: 'complete', orderBy: ['-startTime'], limit: 10 }));
        saved = records.find(record => record.byExtensionId === id && record.filename.startsWith(directory + path.sep) && !received.has(record.id));
        return Boolean(saved);
      }, { timeout: 20_000 }).toBe(true);
      received.add(saved.id);
      return { value: { suggestedFilename: () => path.basename(saved.filename) }, bytes: fs.readFileSync(saved.filename) };
    };
    await page.goto('https://www.patreon.com/collection/500');
    await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Collection export formats"]');
    const combined = await nativeDownload(() => startCollectionDownload(frame, 'Single PDF'));
    // CDP-managed Brave downloads can rename extension blobs; controller fixtures
    // assert the requested title filename. Validate the actual saved PDF bytes here.
    expect(combined.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const combinedDoc = await inspectPdf(combined.bytes);
    expect(combinedDoc.pages).toHaveLength(3);
    expect(combinedDoc.pages[1].text).toContain('Ḫ ḫ Ṭ ṭ Ḥ ḥ');
    expect(combinedDoc.pages[1].text).toContain('𒀭'); expect(combinedDoc.pages[1].text.replace(/\s/g, '')).toContain('天地玄黃');
    expect(combinedDoc.pages[2].text).toContain('Ḫ ḫ Ṭ ṭ Ḥ ḥ');
    expect(combinedDoc.pages[2].text).toContain('𒀭'); expect(combinedDoc.pages[2].text.replace(/\s/g, '')).toContain('天地玄黃');
    await expect(frame.locator("#download-collection")).toBeEnabled();
    const zip = await nativeDownload(() => startCollectionDownload(frame, 'PDF'));
    const entries = readZip(zip.bytes);
    expect(entries.map(x => x.name)).toEqual(['001 - Installed extension test.pdf', '002 - Installed extension test.pdf']);
    for (const entry of entries) {
      const text = (await inspectPdf(entry.data)).pages[0].text;
      expect(text).toContain('Ḫ ḫ Ṭ ṭ Ḥ ḥ'); expect(text).toContain('𒀭'); expect(text.replace(/\s/g, '')).toContain('天地玄黃');
    }
    // Native download results are delivered through the existing report path.
    await expect(page.locator('.download-report')).toContainText('completed');
    const worker = context.serviceWorkers().find(x => x.url().startsWith(`chrome-extension://${id}/`));
    expect(worker).toBeTruthy();
    // Exercise the real extension runtime bridge with input above the old cap.
    const large = require('./helpers/large-pdf.cjs').largePdfFixture();
    const largeResult = await worker.evaluate(async ({ chapters, book }) => {
      const inputBytes = new TextEncoder().encode(JSON.stringify({ chapters, book })).length;
      const bytes = await PatreonPdfRenderService.render(chapters, book);
      return { inputBytes, outputBytes: bytes.length, header: new TextDecoder().decode(bytes.subarray(0, 5)) };
    }, large);
    expect(largeResult.inputBytes).toBeGreaterThan(24 * 1024 * 1024);
    expect(largeResult.inputBytes).toBeLessThan(48 * 1024 * 1024);
    expect(largeResult.header).toBe('%PDF-');
    expect(largeResult.outputBytes).toBeGreaterThan(0);
    expect(largeResult.outputBytes).toBeLessThan(40 * 1024 * 1024);
    await expect.poll(() => popup.evaluate(() => chrome.offscreen.hasDocument())).toBe(false);
    console.log('Native large PDF:', largeResult);

  } finally { await context.close(); }
});
