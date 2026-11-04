const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../extension');
function harness() {
  const listeners = []; let open = false; let created = 0; let closed = 0; let renders = 0; let hold;
  const pending = new Map();
  const api = { runtime: { id: 'fixture', getURL: name => `chrome-extension://fixture/${name}`,
    onMessage: { addListener: fn => listeners.push(fn) },
    sendMessage: async message => {
      if (message.type === 'PDF_HOST_CANCEL') { pending.get(message.id)?.({ error: 'cancelled' }); return { cancelled: true }; }
      if (message.type === 'PDF_HOST_RENDER') { renders++; return new Promise(resolve => { pending.set(message.id, resolve); hold = () => resolve({ data: btoa('%PDF-fixture') }); }); }
    } }, tabs: { onRemoved: { addListener() {} } },
    offscreen: { hasDocument: async () => open, createDocument: async () => { open = true; created++; }, closeDocument: async () => { open = false; closed++; } } };
  const scope = { browser: api, TextEncoder, TextDecoder, URL, Uint8Array, atob, btoa, DOMException, AbortController,
    setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto };
  scope.globalThis = scope;
  for (const name of ['shared/pdf.js', 'background/offscreen.js', 'background/pdf-renderer.js']) vm.runInNewContext(fs.readFileSync(path.join(root, name), 'utf8'), scope);
  scope.PatreonOffscreenService = scope.PatreonOffscreen.create(api);
  const service = scope.PatreonPdfRenderer.install({ api, offscreen: scope.PatreonOffscreenService });
  const send = (message, sender = { id: 'fixture', tab: { id: 1, url: 'https://www.patreon.com/posts/123' } }) => new Promise(resolve => listeners[0](message, sender, resolve));
  return { scope, service, send, stats: () => ({ created, closed, renders }), release: () => hold() };
}
const id = '11111111-1111-4111-8111-111111111111';
const source = { version: 1, title: 'Post', author: 'Creator', sourceUrl: 'https://www.patreon.com/posts/123', language: 'en', assets: [], body: { tag: 'p', children: ['Text'] } };
test('offscreen leases preserve archive downloads while PDF jobs finish', async () => {
  const h = harness();
  await h.scope.PatreonOffscreenService.acquire('archive');
  const result = h.service.render([source]);
  while (!h.stats().renders) await new Promise(resolve => setTimeout(resolve, 1));
  h.release(); assert.equal(new TextDecoder().decode(await result), '%PDF-fixture');
  assert.deepEqual(h.stats(), { created: 1, closed: 0, renders: 1 });
  await h.scope.PatreonOffscreenService.release('archive');
  assert.equal(h.stats().closed, 1);
});
test('PDF requests reject foreign senders and cancellation from another tab', async () => {
  const h = harness();
  assert.match((await h.send({ type: 'PDF_RENDER', id, chapters: [source] }, { id: 'other' })).error, /Patreon/);
  const pending = h.send({ type: 'PDF_RENDER', id, chapters: [source] });
  while (!h.stats().renders) await new Promise(resolve => setTimeout(resolve, 1));
  assert.match((await h.send({ type: 'PDF_CANCEL', id }, { id: 'fixture', tab: { id: 2, url: 'https://www.patreon.com/posts/124' } })).error, /another tab/);
  await h.send({ type: 'PDF_CANCEL', id });
  assert.match((await pending).error, /cancel/i);
  assert.equal(h.stats().closed, 1);
});
test('cancel arriving before render rejects late work without opening a document', async () => {
  const h = harness();
  await h.send({ type: 'PDF_CANCEL', id });
  assert.match((await h.send({ type: 'PDF_RENDER', id, chapters: [source] })).error, /cancelled/);
  assert.equal(h.stats().created, 0);
});
test('PDF rendering waits for archive restoration before acquiring offscreen lifetime', async () => {
  const h = harness(); let restored;
  h.scope.PatreonArchiveService = { ready: new Promise(resolve => { restored = resolve; }) };
  const result = h.service.render([source]);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(h.stats().created, 0, 'Archive leases must be restored before PDF render lifetime begins');
  await h.scope.PatreonOffscreenService.acquire('restored-archive'); restored();
  while (!h.stats().renders) await new Promise(resolve => setTimeout(resolve, 1));
  h.release(); await result;
  assert.equal(h.stats().closed, 0);
  await h.scope.PatreonOffscreenService.release('restored-archive');
  assert.equal(h.stats().closed, 1);
});
