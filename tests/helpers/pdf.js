const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../extension');
async function pdfWorkerFixture(page) {
  await page.route('https://www.patreon.com/pdf-assets/**', route => {
    const name = new URL(route.request().url()).pathname.replace('/pdf-assets/', '');
    return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, name)) });
  });
  await page.addScriptTag({ path: path.join(root, 'shared/pdf.js') });
  await page.addScriptTag({ path: path.join(root, 'export/pdf-host.js') });
  await page.evaluate(() => {
    globalThis.pdfFixtureRender = (chapters, book, signal) => PatreonPdfHost.render(chapters, book, signal,
      'https://www.patreon.com/pdf-assets/export/pdf-worker.js');
  });
}
async function inspectPdf(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false }).promise;
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      pages.push({ text: (await page.getTextContent()).items.map(x => x.str).join(' ').replace(/\s+/g, ' '),
        annotations: await page.getAnnotations(), operators: (await page.getOperatorList()).fnArray });
    }
    return { pages, metadata: await doc.getMetadata(), outline: await doc.getOutline() };
  } finally { await doc.destroy(); }
}
module.exports = { pdfWorkerFixture, inspectPdf };
