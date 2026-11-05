const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { Worker: Thread } = require('node:worker_threads');
function host() {
  let terminated = 0;
  class Worker {
    constructor() {
      this.thread = new Thread(path.resolve(__dirname, '../helpers/pdf-node-worker.cjs'));
      this.thread.on('message', data => this.onmessage?.({ data }));
      this.thread.on('error', error => this.onerror?.(error));
    }
    postMessage(value) { this.thread.postMessage(value); }
    terminate() { terminated++; this.thread.terminate(); }
  }
  const scope = { Worker, Uint8Array, TextEncoder, URL, DOMException, setTimeout, clearTimeout }; scope.globalThis = scope;
  for (const name of ['shared/pdf.js', 'export/pdf-host.js']) vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../extension', name), 'utf8'), scope);
  return { render: scope.PatreonPdfHost.render, terminated: () => terminated };
}
const source = { version: 1, title: 'Worker PDF', author: 'Creator', sourceUrl: 'https://www.patreon.com/posts/123', language: 'en', assets: [], body: { tag: 'p', children: ['Worker content'] } };
test('PDF host renders with the packaged worker and always disposes it', async () => {
  const h = host();
  const bytes = await h.render([source]);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
  assert.equal(h.terminated(), 1);
});
test('PDF host cancellation terminates real workers and refuses concurrent overload', async () => {
  const h = host(), first = new AbortController(), second = new AbortController();
  const a = h.render([source], undefined, first.signal).catch(e => e.name);
  const b = h.render([source], undefined, second.signal).catch(e => e.name);
  await assert.rejects(h.render([source]), /already rendering/);
  first.abort(); second.abort();
  assert.equal(await a, 'AbortError'); assert.equal(await b, 'AbortError'); assert.equal(h.terminated(), 2);
});
