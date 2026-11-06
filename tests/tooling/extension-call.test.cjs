const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../extension/shared/extension.js'), 'utf8');
const reloadMessage = /extension.*(?:updated|reloaded).*refresh.*Patreon page/i;
function harness(namespace, target) {
  const context = vm.createContext({ [namespace]: target });
  vm.runInContext(source, context);
  return context.PatreonExtension;
}
for (const namespace of ['browser', 'chrome']) {
  test(`${namespace} API throws become handled reload guidance without escaping call()`, async () => {
    const api = { runtime: { sendMessage() { throw new Error('Extension context invalidated.'); } } };
    const { call } = harness(namespace, api);
    let pending;
    assert.doesNotThrow(() => { pending = call(api.runtime, 'sendMessage', { type: 'UNREGISTER_EXPORTABLE_POST_TAB' }); });
    await assert.rejects(pending, reloadMessage);
    // The content route observer already attaches this rejection handler.
    await call(api.runtime, 'sendMessage', {}).catch(() => {});
  });
  test(`${namespace} permission requests are invoked synchronously to preserve user activation`, async () => {
    let invoked = false;
    const api = { runtime: {}, permissions: { request(options, callback) {
      invoked = true; assert.deepEqual(options, { origins: ['https://media.example/*'] });
      if (callback) callback(true); else return Promise.resolve(true);
    } } };
    const { call } = harness(namespace, api);
    const pending = call(api.permissions, 'request', { origins: ['https://media.example/*'] });
    assert.equal(invoked, true);
    assert.equal(await pending, true);
  });
}
test('browser promise rejection preserves ordinary errors and explains invalidation', async () => {
  const api = { runtime: { sendMessage: () => Promise.reject(new Error('Extension context invalidated.')) } };
  const { call } = harness('browser', api);
  await assert.rejects(call(api.runtime, 'sendMessage'), reloadMessage);
  const ordinary = new Error('The message port closed.');
  api.runtime.sendMessage = () => Promise.reject(ordinary);
  await assert.rejects(call(api.runtime, 'sendMessage'), error => error === ordinary);
});
test('Chrome callback lastError is read during the callback and failures reject consistently', async () => {
  let inCallback = false;
  const api = { runtime: { sendMessage(_message, callback) {
    queueMicrotask(() => { inCallback = true; callback(); inCallback = false; });
  } } };
  Object.defineProperty(api.runtime, 'lastError', { get() {
    assert.equal(inCallback, true);
    return { message: 'Extension context invalidated.' };
  } });
  const { call } = harness('chrome', api);
  await assert.rejects(call(api.runtime, 'sendMessage', {}), reloadMessage);
});
