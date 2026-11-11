const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function load() {
  const c = vm.createContext({ URL, Request, Response, AbortController, setTimeout, clearTimeout, TextEncoder, TextDecoder, Date });
  for (const name of ['extension/shared/telemetry-schema.js', 'relay/worker.js']) {
    if (fs.existsSync(path.join(root, name))) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), c);
  }
  assert.ok(c.PatreonAnalyticsRelay, 'relay must implement the minimal analytics contract');
  return c;
}
const id = '11111111-1111-4111-8111-111111111111';
const now = Date.now();
const body = (events = [{ name: 'pr_reader_used', occurred_at_ms: now }]) => ({ schema_version: 1, client_id: id, extension_version: '1.2.1', events });
const env = { GA_MEASUREMENT_ID: 'G-EXAMPLE123', GA_API_SECRET: 'test-only-secret' };
const request = value => new Request('https://relay.invalid/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
test('relay forwards only approved fields, preserving original occurrence time and denying ads', async () => {
  const c = load(); const sent = [];
  const res = await c.PatreonAnalyticsRelay.handle(request(body()), env, async (url, options) => {
    sent.push({ url, options }); return new Response(null, { status: 204 });
  });
  assert.equal(res.status, 202);
  const value = JSON.parse(sent[0].options.body);
  assert.equal(value.client_id, id);
  assert.equal(value.timestamp_micros, now * 1000);
  assert.equal(value.events[0].name, 'pr_reader_used');
  assert.equal(value.events[0].params.extension_version, '1.2.1');
  assert.equal(value.consent.ad_user_data, 'DENIED');
  assert.equal(value.consent.ad_personalization, 'DENIED');
  assert.equal(value.ip_override, undefined);
  assert.equal(value.user_id, undefined);
  assert.equal(sent[0].options.redirect, 'error');
});
test('relay rejects arbitrary page data, unknown events, invalid timestamps and oversized batches before forwarding', async () => {
  const c = load();
  for (const value of [
    { ...body(), url: 'https://www.patreon.com/posts/123' },
    body([{ name: 'pr_reader_used', occurred_at_ms: now, title: 'private' }]),
    body([{ name: 'pr_download_started', occurred_at_ms: now, scope: 'post', format: 'pdf' }]),
    body([{ name: 'pr_problem_reported', occurred_at_ms: now }]),
    body([{ name: 'pr_reader_used', occurred_at_ms: now - 86400001 }]),
    body([{ name: 'pr_reader_used', occurred_at_ms: now + 600000 }]),
    body(Array(21).fill({ name: 'pr_reader_used', occurred_at_ms: now })),
    { ...body(), client_id: 'user@example.com' }
  ]) {
    const res = await c.PatreonAnalyticsRelay.handle(request(value), env, () => { throw Error('must not forward'); });
    assert.equal(res.status, 400);
  }
});
test('relay separates timestamps and does not echo upstream errors or credentials', async () => {
  const c = load(); const times = [];
  const value = body([{ name: 'pr_reader_used', occurred_at_ms: now - 1000 }, { name: 'pr_download_started', occurred_at_ms: now, scope: 'collection' }]);
  const res = await c.PatreonAnalyticsRelay.handle(request(value), env, async (_url, opts) => {
    times.push(JSON.parse(opts.body).timestamp_micros); return new Response(null, { status: 204 });
  });
  assert.equal(res.status, 202); assert.deepEqual(times, [(now - 1000) * 1000, now * 1000]);
  const failed = await c.PatreonAnalyticsRelay.handle(request(body()), env, async () => { throw Error(env.GA_API_SECRET); });
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /test-only-secret/);
  assert.equal((await c.PatreonAnalyticsRelay.handle(request(body()), {}, () => {})).status, 503);
});
test('relay health checks and invalid requests never create analytics traffic', async () => {
  const c = load(); const never = () => { throw Error('must not forward'); };
  assert.equal((await c.PatreonAnalyticsRelay.handle(new Request('https://relay.invalid/health'), env, never)).status, 200);
  assert.equal((await c.PatreonAnalyticsRelay.handle(new Request('https://relay.invalid/health'), {}, never)).status, 503);
  assert.equal((await c.PatreonAnalyticsRelay.handle(new Request('https://relay.invalid/events'), env, never)).status, 405);
  assert.equal((await c.PatreonAnalyticsRelay.handle(new Request('https://relay.invalid/other'), env, never)).status, 404);
  const oversized = new Request('https://relay.invalid/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ' '.repeat(65537) });
  assert.equal((await c.PatreonAnalyticsRelay.handle(oversized, env, never)).status, 400);
});
test('dashboard bundle executes the same validated relay entry point without imports', async () => {
  const script = path.join(root, 'scripts/build-analytics-relay.js');
  assert.ok(fs.existsSync(script), 'single-file deployment builder must exist');
  const { build } = require(script);
  const os = require('node:os');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-bundle-'));
  try {
    const target = path.join(directory, 'worker.mjs');
    build(target);
    const { pathToFileURL } = require('node:url');
    const worker = await import(pathToFileURL(target).href);
    const res = await worker.default.fetch(new Request('https://relay.invalid/health'), env);
    assert.equal(res.status, 200);
    const rejected = await worker.default.fetch(request({ ...body(), title: 'private' }), env);
    assert.equal(rejected.status, 400);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
