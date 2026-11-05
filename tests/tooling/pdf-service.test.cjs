const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../extension');
function harness() {
  const listeners = []; let open = false; let created = 0; let closed = 0; let renders = 0; let hold; let hostMessageBytes = 0;
  const pending = new Map();
  const api = { runtime: { id: 'fixture', getURL: name => `chrome-extension://fixture/${name}`,
    onMessage: { addListener: fn => listeners.push(fn) },
    sendMessage: async message => {
      if (message.type === 'PDF_HOST_CANCEL') { pending.get(message.id)?.({ error: 'cancelled' }); return { cancelled: true }; }
      if (message.type === 'PDF_HOST_RENDER') { renders++; hostMessageBytes = Buffer.byteLength(JSON.stringify(message)); return new Promise(resolve => { pending.set(message.id, resolve); hold = (data = btoa('%PDF-fixture')) => resolve({ data }); }); }
    } }, tabs: { onRemoved: { addListener() {} } },
    offscreen: { hasDocument: async () => open, createDocument: async () => { open = true; created++; }, closeDocument: async () => { open = false; closed++; } } };
  const scope = { browser: api, TextEncoder, TextDecoder, URL, Uint8Array, atob, btoa, DOMException, AbortController,
    setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto };
  scope.globalThis = scope;
  for (const name of ['shared/pdf.js', 'background/offscreen.js', 'background/pdf-renderer.js']) vm.runInNewContext(fs.readFileSync(path.join(root, name), 'utf8'), scope);
  scope.PatreonOffscreenService = scope.PatreonOffscreen.create(api);
  const service = scope.PatreonPdfRenderer.install({ api, offscreen: scope.PatreonOffscreenService });
  const send = (message, sender = { id: 'fixture', tab: { id: 1, url: 'https://www.patreon.com/posts/123' } }) => new Promise(resolve => listeners[0](message, sender, resolve));
  return { scope, service, send, stats: () => ({ created, closed, renders }), release: data => hold(data), hostMessageBytes: () => hostMessageBytes };
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

test('PDF service forwards input above 24 MiB with room below the Chrome message ceiling', async () => {
  const h = harness(); let failure;
  const pending = h.service.render([{ ...source, body: { tag: 'p', children: ['x'.repeat(32 * 1024 * 1024)] } }])
    .catch(error => { failure = error; return null; });
  while (!h.stats().renders && !failure) await new Promise(resolve => setTimeout(resolve, 1));
  assert.ifError(failure);
  assert.ok(h.hostMessageBytes() > 24 * 1024 * 1024);
  assert.ok(h.hostMessageBytes() < 64 * 1024 * 1024);
  h.release(); await pending;
  assert.equal(h.stats().closed, 1);
});

test('PDF return transport accepts 33 MiB and rejects data above the 40 MiB output cap', async () => {
  const h = harness();
  const pending = h.service.render([source]);
  while (!h.stats().renders) await new Promise(resolve => setTimeout(resolve, 1));
  // Size validation of the response transport; actual PDF parsing is covered by
  // packaged-renderer tests, not by this deliberately synthetic byte payload.
  h.release(btoa('%PDF-'.padEnd(33 * 1024 * 1024, 'x')));
  assert.equal((await pending).length, 33 * 1024 * 1024);
  const oversized = h.service.render([source]);
  while (h.stats().renders < 2) await new Promise(resolve => setTimeout(resolve, 1));
  h.release('x'.repeat(Math.ceil(41 * 1024 * 1024 / 3) * 4));
  await assert.rejects(oversized, /invalid file/);
  assert.equal(h.stats().closed, 2);
});
