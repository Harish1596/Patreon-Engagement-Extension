const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { render } = require('./pdf-render.cjs');
const root = path.resolve(__dirname, '../../extension');
function contentHarness(t, { html: suppliedHtml, url = "https://www.patreon.com/example/posts/test-123" } = {}) {
  const html = suppliedHtml || fs.readFileSync(path.resolve(__dirname, '../fixtures/text-image-post.html'), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; t.after(() => w.close());
  const listeners = [], downloads = [], blobs = new Map();
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.Blob = Blob;
  Object.defineProperty(w, 'crypto', { value: require('node:crypto').webcrypto });
  w.HTMLElement.prototype.getClientRects = () => [{}];
  w.URL.createObjectURL = blob => { const id = `blob:fixture-${blobs.size}`; blobs.set(id, blob); return id; };
  w.URL.revokeObjectURL = id => blobs.delete(id);
  w.HTMLAnchorElement.prototype.click = function() { if (this.download) downloads.push({ name: this.download, blob: blobs.get(this.href) }); };
  w.browser = { runtime: { id: 'fixture-extension', getURL: name => `https://fixture-extension.invalid/${name}`,
    onMessage: { addListener: fn => listeners.push(fn) }, sendMessage: async message => {
      if (message.type === 'REGISTER_POST_EXPORT') return { registered: true };
      if (message.type === 'PDF_RENDER') {
        try { return { data: Buffer.from(await render(message.chapters, message.book)).toString('base64') }; }
        catch (e) { return { error: e.message }; }
      }
      return {};
    } } };
  for (const name of ['shared/extension.js', 'shared/zip.js', 'shared/pdf.js', 'shared/pdf-client.js', 'content/patreon-dom.js', 'content/export.js']) w.eval(fs.readFileSync(path.join(root, name), 'utf8'));
  const send = (message, sender = { id: 'fixture-extension' }) => new Promise(resolve => {
    for (const listener of listeners) { const result = listener(message, sender, resolve); if (result === true) return; }
  });
  return { w, send, downloads, load: name => w.eval(fs.readFileSync(path.join(root, name), "utf8")) };
}
async function until(predicate) {
  for (let n = 0; n < 500; n++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error('PDF content did not finish');
}

module.exports = { contentHarness, until };
