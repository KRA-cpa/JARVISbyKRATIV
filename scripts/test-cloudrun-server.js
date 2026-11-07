#!/usr/bin/env node
/**
 * test-cloudrun-server.js — the Cloud Run server (server/app.js) serves the same proxy as Vercel, the React build
 * and nothing it shouldn't.
 *
 * Usage: node scripts/test-cloudrun-server.js
 *
 * Starts server/app.js on a random local port with a temporary build folder and the REAL api/_lib/proxyCore.js
 * (fake Apps Script fetch, no network). Checks: health, POST / GET forwarding with the secret and identity fields
 * stripped, OPTIONS, unknown API paths, static caching, the SPA fallback (incl. '/'), path traversal, the 4.5 MB body
 * limit, security / no-store headers, API-only mode.
 * Exit: 0 = all pass, 1 = a case failed.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/app');
const { createProxyHandler } = require('../api/_lib/proxyCore');

function fakeFetch() {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: 'from-gas' }) };
  };
  fn.calls = calls;
  return fn;
}

function makeBuildDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daloy-build-'));
  fs.mkdirSync(path.join(dir, 'static', 'js'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Daloy</title><div id="root"></div>');
  fs.writeFileSync(path.join(dir, 'static', 'js', 'main.abc123.js'), 'console.log("app")');
  fs.writeFileSync(path.join(dir, 'manifest.json'), '{"short_name":"Daloy"}');
  return dir;
}

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function main() {
  const buildDir = makeBuildDir();
  const fetchImpl = fakeFetch();
  const env = { AUTH_MODE: 'warn', APPS_SCRIPT_URL: 'https://gas.example/exec', PROXY_SECRET: 's3cret', FIREBASE_PROJECT_ID: 'demo' };
  const proxyHandler = createProxyHandler({ env, fetchImpl, log: () => {} });
  const { server, base } = await listen(createApp({ env, buildDir, proxyHandler }));
  const { server: apiOnly, base: apiBase } = await listen(createApp({ env, buildDir: null, proxyHandler }));

  const cases = [];
  const test = (name, fn) => cases.push({ name, fn });

  test('healthz answers 200 JSON', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { ok: true });
  });

  test('POST to the proxy forwards the action with the secret; client identity fields are dropped', async () => {
    const before = fetchImpl.calls.length;
    const res = await fetch(`${base}/api/appscript-proxy`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'getCompanies', _auth_uid: 'forged', _proxy_secret: 'forged' })
    });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { success: true, data: 'from-gas' });
    assert.strictEqual(res.headers.get('x-backend'), 'gas');
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    const call = fetchImpl.calls[before];
    assert.strictEqual(call.url, 'https://gas.example/exec');
    const sent = JSON.parse(call.options.body);
    assert.strictEqual(sent.action, 'getCompanies');
    assert.strictEqual(sent._proxy_secret, 's3cret');
    assert.strictEqual(sent._auth_uid, undefined, 'no token -> no uid, and the forged one is gone');
  });

  test('POST with a JSON content type is read the same way', async () => {
    const before = fetchImpl.calls.length;
    const res = await fetch(`${base}/api/appscript-proxy`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getRoles' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(JSON.parse(fetchImpl.calls[before].options.body).action, 'getRoles');
  });

  test('GET to the proxy passes the query and is marked _via_get', async () => {
    const before = fetchImpl.calls.length;
    const res = await fetch(`${base}/api/appscript-proxy?action=ping&company_id=c1`);
    assert.strictEqual(res.status, 200);
    const sent = JSON.parse(fetchImpl.calls[before].options.body);
    assert.strictEqual(sent.action, 'ping');
    assert.strictEqual(sent.company_id, 'c1');
    assert.strictEqual(sent._via_get, true);
  });

  test('OPTIONS preflight answers 200 with the CORS headers, without calling Apps Script', async () => {
    const before = fetchImpl.calls.length;
    const res = await fetch(`${base}/api/appscript-proxy`, { method: 'OPTIONS' });
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('access-control-allow-headers') || '', /Authorization/);
    assert.strictEqual(fetchImpl.calls.length, before);
  });

  test('enforce mode refuses a request without a token (401 NOT_SIGNED_IN)', async () => {
    const strict = createProxyHandler({ env: { ...env, AUTH_MODE: 'enforce' }, fetchImpl, log: () => {} });
    const { server: s, base: b } = await listen(createApp({ env, buildDir: null, proxyHandler: strict }));
    try {
      const res = await fetch(`${b}/api/appscript-proxy`, { method: 'POST', body: JSON.stringify({ action: 'getTickets' }) });
      assert.strictEqual(res.status, 401);
      assert.strictEqual((await res.json()).code, 'NOT_SIGNED_IN');
    } finally {
      s.close();
    }
  });

  test('unknown API path answers 404 JSON, not index.html', async () => {
    const res = await fetch(`${base}/api/nope`, { method: 'POST' });
    assert.strictEqual(res.status, 404);
    assert.strictEqual((await res.json()).success, false);
  });

  test('hashed bundle is served with a one-year immutable cache', async () => {
    const res = await fetch(`${base}/static/js/main.abc123.js`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('cache-control') || '', /immutable/);
    assert.match(res.headers.get('cache-control') || '', /max-age=31536000/);
  });

  test("'/' and deep links get index.html with no-cache", async () => {
    for (const url of ['/', '/tickets/123', '/plans']) {
      const res = await fetch(`${base}${url}`);
      assert.strictEqual(res.status, 200, url);
      assert.match(await res.text(), /<div id="root">/, url);
      assert.strictEqual(res.headers.get('cache-control'), 'no-cache', url);
    }
  });

  test('path traversal does not leave the build folder', async () => {
    for (const url of ['/..%2f..%2fpackage.json', '/static/..%2f..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/package.json']) {
      const res = await fetch(`${base}${url}`);
      const text = await res.text();
      assert.ok(!text.includes('"dependencies"'), `${url} leaked a file outside the build`);
    }
  });

  test('a body over 4.5 MB is refused with 413 JSON', async () => {
    const res = await fetch(`${base}/api/appscript-proxy`, { method: 'POST', body: 'x'.repeat(5 * 1024 * 1024) });
    assert.strictEqual(res.status, 413);
    assert.strictEqual((await res.json()).error, 'Request too large');
  });

  test('security headers: nosniff, no X-Powered-By', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-powered-by'), null);
  });

  test('API-only mode (no build folder): the site paths answer 404 JSON, the proxy still works', async () => {
    const page = await fetch(`${apiBase}/`);
    assert.strictEqual(page.status, 404);
    const proxy = await fetch(`${apiBase}/api/appscript-proxy?action=ping`);
    assert.strictEqual(proxy.status, 200);
  });

  let failed = 0;
  for (const { name, fn } of cases) {
    try {
      await fn();
      console.log(`PASS  ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${name}\n      ${error.message}`);
    }
  }
  server.close();
  apiOnly.close();
  fs.rmSync(buildDir, { recursive: true, force: true });
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
