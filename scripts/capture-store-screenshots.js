/* Capture actual packaged extension UI on labelled, synthetic Patreon structure. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');
const { browserExecutable } = require('./browser-config');
const { readPackage, validateArchive } = require('./package-extension');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const archive = path.join(root, 'dist', `patreon-reader-${version}.zip`);
const output = path.join(root, 'store-assets/screenshots', version);
const style = `
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f5f5f3;color:#242424;font:17px/1.7 system-ui,sans-serif}
  .demo-header{padding:18px 48px;border-bottom:1px solid #ddd;background:white;font-size:14px;color:#666}
  .demo-header strong{color:#242424;margin-right:16px}main{max-width:960px;margin:32px auto;padding:30px 44px;background:white;border:1px solid #ddd;border-radius:16px}
  h1{font-size:38px;line-height:1.2;margin:10px 0 18px;letter-spacing:-1px}h2{font-size:23px;line-height:1.3}p{margin:0 0 20px}
  .byline{font-size:14px;color:#666}.actions{display:flex;gap:12px;margin:20px 0 28px;align-items:center}
  .actions button{font:inherit;font-size:14px;border:1px solid #ccc;border-radius:9px;padding:8px 14px;background:white;color:inherit}
  blockquote{margin:24px 0;padding:0 20px;border-left:2px solid #bbb}.chapters{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:28px}
  .demo_gridCard{display:block;padding:24px;border:1px solid #ddd;border-radius:12px;color:inherit;text-decoration:none;background:#fafafa}.demo_gridCard span{display:block;color:#666;font-size:14px;margin-bottom:12px}
`;
const shell = (title, content) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} | Demo Creator on Patreon</title><style>${style}</style></head><body><header class="demo-header"><strong>Patreon Reader</strong>Demo content · No private posts or account data</header>${content}</body></html>`;
const post = shell('A quieter place to read', `<main data-tag="post-card"><div class="PostBodies-module__demo__singleColumnContentWrapper"><div class="PostBodies-module__demo__singleColumnContent"><div data-testid="single-column-post-wrapper">
  <p class="byline" data-tag="post-details"><a>Demo Creator</a> · Sample public post</p><h1 data-tag="post-title">A quieter place to read</h1>
  <div class="actions" data-tag="top-engagement"><button data-tag="like-button">Like</button><button data-tag="comment-post-icon">Comment</button><button data-tag="share-post-icon">Share</button><button data-tag="more-actions-button">More</button></div>
  <div class="PostBodies-module__demo__postContent"><div class="RichText-module__demo__additionalStylesPostContentWrapper">
  <p>Some stories deserve a little more room. A comfortable font, a softer page colour and the right amount of space can make a long chapter easier to enjoy.</p>
  <h2>Make the page your own</h2><p>Adjust the reading appearance to suit you. Your preferences stay on this device and apply to supported posts as you move between chapters.</p>
  <blockquote><p>A good reading space lets the story take centre stage.</p></blockquote>
  <h2>Keep a copy for later</h2><p>Save accessible posts as PDF, EPUB or Markdown, with the creator, source and download time included. Collections can become one document or a ZIP of separate chapters.</p>
  </div></div></div></div></div></main>`);
const collection = shell('The reading collection', `<main><p class="byline">Demo Creator · Sample collection</p><h1>The reading collection</h1><p>Three sample chapters, ready for a comfortable afternoon of reading.</p><div class="chapters">${['A quieter place to read','The next page','A story to keep'].map((title,index)=>`<a class="demo_gridCard" href="/posts/${201+index}"><span>Chapter ${index+1}</span><strong>${title}</strong></a>`).join('')}</div></main>`);
async function main() {
  validateArchive(archive, readPackage(root).files);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'patreon-store-capture-'));
  let context;
  const errors = [], captures = [];
  try {
    execFileSync('unzip', ['-q', archive, '-d', temporary]);
    context = await chromium.launchPersistentContext('', { headless: true, viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', executablePath: browserExecutable('brave'),
      ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${temporary}`, `--load-extension=${temporary}`] });
    // All web content is synthetic. Do not visit a signed-in browser or live account.
    await context.route('https://www.patreon.com/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/posts') return route.fulfill({ status: 404, body: 'Demo uses DOM discovery' });
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: url.pathname.startsWith('/collection/') ? collection : post });
    });
    await context.route(/https?:\/\/(?!www\.patreon\.com\/)/, route => route.abort());
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup/popup.html`);
    await expect(popup.locator('#version')).toHaveText(`v${version}`);
    await popup.getByRole('switch', { name: 'Enable Reader Customization', exact: true }).check();
    await popup.close();
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://www.patreon.com/posts/201');
    await page.getByRole('button', { name: 'Customize reading appearance', exact: true }).click();
    await page.getByLabel('Font family', { exact: true }).selectOption('georgia');
    await page.getByRole('radio', { name: 'Sepia', exact: true }).click();
    fs.mkdirSync(output, { recursive: true });
    const capture = async name => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(output, name), animations: 'disabled' });
      const bytes = fs.readFileSync(path.join(output, name));
      if (bytes.readUInt32BE(16) !== 1280 || bytes.readUInt32BE(20) !== 800) throw new Error('Invalid screenshot size');
      captures.push({ file: name, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    };
    await capture('01-reading-appearance.png');
    await page.getByRole('button', { name: 'Close reading appearance', exact: true }).click();
    await page.getByRole('button', { name: 'Download post', exact: true }).click();
    await expect(page.frameLocator('iframe[title="Post export formats"]').getByRole('button', { name: 'EPUB', exact: true })).toBeEnabled();
    await expect(page.getByText('Files are generated locally.', { exact: true })).toBeVisible();
    await capture('02-post-downloads.png');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.frameLocator('iframe[title="Post export formats"]').getByRole('button', { name: 'Markdown', exact: true }).click()
    ]);
    const markdown = fs.readFileSync(await download.path(), 'utf8');
    if (!download.suggestedFilename().endsWith('.md') || !markdown.includes('A quieter place to read')
      || !markdown.includes('Demo Creator') || !markdown.includes('**Source:**')) throw new Error('Packaged Markdown smoke check failed');
    console.log('Installed ZIP Markdown download preserves title, creator and source.');
    await page.goto('https://www.patreon.com/collection/500');
    await page.getByRole('button', { name: 'Download Collection', exact: true }).click();
    const chooser = page.frameLocator('iframe[title="Collection export formats"]');
    await expect(chooser.getByRole('button', { name: 'Download EPUB', exact: true })).toBeEnabled();
    await chooser.getByRole('radio', { name: 'Markdown', exact: true }).check();
    await chooser.getByRole('radio', { name: 'Separate files (ZIP)', exact: true }).check();
    await expect(chooser.getByRole('button', { name: 'Download Markdown ZIP', exact: true })).toBeEnabled();
    await capture('03-collection-downloads.png');
    if (errors.length) throw new Error(`Capture page errors: ${errors.join('; ')}`);
    fs.writeFileSync(path.join(output, 'provenance.json'), JSON.stringify({ version, packageSha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
      browser: context.browser().version(), viewport: { width: 1280, height: 800 }, source: 'Actual installed release ZIP on labelled synthetic pages. No live Patreon/account content. No compositing or UI modification.', captures }, null, 2) + '\n');
    console.log(`Captured ${captures.length} screenshots from package ${version} in ${output}`);
  } finally { if (context) await context.close(); fs.rmSync(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
