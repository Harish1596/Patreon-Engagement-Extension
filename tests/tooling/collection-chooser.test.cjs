const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../../extension/export');
function fixture({ grant = true } = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'collection-chooser.html'), 'utf8'), {
    url: 'https://extension.invalid/collection-chooser.html#test-token', runScripts: 'outside-only'
  });
  const w = dom.window, messages = [], calls = [];
  w.ResizeObserver = class { observe() {} };
  w.postMessage = message => messages.push(message);
  w.browser = { runtime: { sendMessage: async message => { calls.push(message); return { origins: ['https://images.example/*'] }; } },
    permissions: { request: options => { calls.push({ type: 'permission', ...options }); return Promise.resolve(grant); } } };
  w.eval(fs.readFileSync(path.join(root, 'collection-chooser.js'), 'utf8'));
  const send = (data, origin = 'https://www.patreon.com', source = w.parent) => w.dispatchEvent(new w.MessageEvent('message', {
    source, origin, data: { token: 'test-token', ...data }
  }));
  const ready = () => send({ source: 'patreon-reader-collection-sized', height: 4, revision: messages.filter(x => x.source === 'patreon-reader-collection-size').at(-1)?.revision || 0 });
  const select = (name, value) => {
    const input = w.document.querySelector(`input[name="${name}"][value="${value}"]`);
    assert.ok(input, `${name} ${value} exists`); input.click(); ready();
  };
  return { dom, w, messages, calls, send, ready, select, action: () => w.document.querySelector('#download-collection') };
}
for (const format of ['epub', 'pdf', 'markdown']) for (const packaging of ['single', 'zip']) {
  test(`${format}/${packaging} selects without downloading and sends the existing format once`, t => {
    const f = fixture(); t.after(() => f.dom.window.close());
    assert.ok(f.action(), 'one download action exists');
    assert.equal(f.action().disabled, true);
    f.send({ source: 'patreon-reader-collection-sized', height: 4 }, 'https://wrong.invalid');
    assert.equal(f.action().disabled, true);
    f.ready(); f.select('format', format); f.select('packaging', packaging);
    assert.equal(f.messages.filter(x => x.source === 'patreon-reader-collection-export').length, 0);
    assert.deepEqual(f.calls, [], 'selection performs no worker reads');
    const label = format === 'markdown' ? 'Markdown' : format.toUpperCase();
    assert.equal(f.action().textContent.trim(), `Download ${label}${packaging === 'zip' ? ' ZIP' : ''}`);
    assert.match(f.w.document.querySelector('#selection-description').textContent, packaging === 'zip' ? /ZIP/ : /one/i);
    f.action().click(); f.action().click(); f.ready(); f.action().click();
    assert.equal(f.messages.filter(x => x.source === 'patreon-reader-collection-export').length, 1);
    assert.equal(f.messages.find(x => x.source === 'patreon-reader-collection-export').format,
      format + (packaging === 'single' ? '-book' : ''));
    assert.equal(f.action().disabled, true);
    assert.ok([...f.w.document.querySelectorAll('input')].every(input => input.disabled));
  });
}
for (const grant of [true, false]) test(`image approval uses explicit gesture and guarded current request; granted=${grant}`, async t => {
  const f = fixture({ grant }); t.after(() => f.dom.window.close()); f.ready(); f.action().click();
  const request = { source: 'patreon-reader-collection-permission', requestId: 'image-request' };
  f.send(request, 'https://wrong.invalid'); f.send(request, undefined, {});
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(f.calls, []);
  f.send(request);

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.w.document.querySelector('#formats').hidden, true);
  assert.equal(f.w.document.querySelector('#image-permission').hidden, false);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].type, 'GET_COLLECTION_EXPORT_REQUEST');
  f.w.document.querySelector('#allow-images').click();
  assert.equal(f.calls[1].type, 'permission', 'permission API is called synchronously in the click');
  assert.deepEqual(Array.from(f.calls[1].origins), ['https://images.example/*']);
  await new Promise(resolve => setImmediate(resolve));
  const result = f.messages.find(x => x.source === 'patreon-reader-collection-permission-result');
  assert.equal(result.requestId, 'image-request'); assert.equal(result.granted, grant);
});

test('an older same-height acknowledgement cannot unlock a newer selection layout', t => {
  const f = fixture(); t.after(() => f.dom.window.close()); f.ready();
  f.w.document.querySelector('input[value="pdf"]').click();
  const older = f.messages.filter(x => x.source === 'patreon-reader-collection-size').at(-1);
  f.w.document.querySelector('input[value="markdown"]').click();
  f.send({ source: 'patreon-reader-collection-sized', height: 4, revision: older.revision });
  assert.equal(f.action().getAttribute('aria-disabled'), 'true');
  assert.equal(f.action().disabled, false, 'layout wait remains keyboard focusable');
  f.ready(); assert.equal(f.action().getAttribute('aria-disabled'), 'false');
});
