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
 * 14 Nov 2026 (migration 0.6): /api/rpc - no database -> Apps Script; unported action -> Apps Script; a ported action
 * from Postgres (X-Backend pg, query_count in the log); enforce 401; requireUser; identity fields stripped; 500 without
 * the message; RpcError status / code; OPTIONS; the handler registry; createDb counting + transactions (fake pool).
 * Exit: 0 = all pass, 1 = a case failed.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/app');
const { createProxyHandler } = require('../api/_lib/proxyCore');
const { createRpcHandler } = require('../api/_lib/rpcCore');
const { createDb } = require('../api/_lib/db');
const { badRequest } = require('../api/_lib/rpcErrors');
const { handlers, mergeHandlers } = require('../api/_lib/handlers');

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

  // ---- /api/rpc (migration 0.6) ----
  const fakeAdapter = {
    name: 'fake',
    async verify(token) {
      if (token !== 'good') throw new Error('bad token');
      return { uid: 'u1', provider: 'fake', email: 'Ann@Example.com', email_verified: true, auth_time: Math.floor(Date.now() / 1000) };
    }
  };
  const fakeDb = () => {
    const seen = [];
    return {
      seen,
      forRequest() {
        let count = 0;
        return {
          query: async text => {
            count += 1;
            seen.push(text);
            return { rows: [{ server_version: '18.0', db_time: new Date('2026-11-14T00:00:00Z'), has_migrations: false }] };
          },
          transaction: async fn => fn({ query: async () => { count += 1; return { rows: [] }; } }),
          count: () => count
        };
      }
    };
  };
  async function withRpc({ db = fakeDb(), mode = 'warn', handlers } = {}, fn) {
    const lines = [];
    const rpcEnv = { ...env, AUTH_MODE: mode };
    const rpcHandler = createRpcHandler({ env: rpcEnv, db, proxyHandler, adapters: [fakeAdapter],
      log: line => lines.push(JSON.parse(line)), ...(handlers ? { handlers } : {}) });
    const { server: s, base: b } = await listen(createApp({ env: rpcEnv, buildDir: null, proxyHandler, rpcHandler }));
    try {
      await fn(b, lines, db);
    } finally {
      s.close();
    }
  }
  const rpcPost = (b, body, token) => fetch(`${b}/api/rpc`, { method: 'POST',
    headers: { 'Content-Type': 'text/plain', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

  test('rpc without DATABASE_URL (the default app): every action goes to Apps Script, X-Backend gas', async () => {
    const before = fetchImpl.calls.length;
    const res = await fetch(`${base}/api/rpc`, { method: 'POST', body: JSON.stringify({ action: 'dbHealth' }) });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-backend'), 'gas');
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    assert.strictEqual(JSON.parse(fetchImpl.calls[before].options.body).action, 'dbHealth');
  });

  test('rpc with a database: an unported action still goes to Apps Script', async () => {
    await withRpc({}, async b => {
      const before = fetchImpl.calls.length;
      const res = await rpcPost(b, { action: 'getTickets' }, 'good');
      assert.strictEqual(res.headers.get('x-backend'), 'gas');
      assert.strictEqual(fetchImpl.calls.length, before + 1);
    });
  });

  test('rpc dbHealth: answered from Postgres - X-Backend pg, one log line with query_count, no Apps Script call', async () => {
    await withRpc({}, async (b, lines) => {
      const before = fetchImpl.calls.length;
      const res = await rpcPost(b, { action: 'dbHealth', company_id: 'c1' }, 'good');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-backend'), 'pg');
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.db, 'ok');
      assert.strictEqual(body.data.server_version, '18.0');
      assert.strictEqual(body.data.latest_migration, null);
      assert.strictEqual(fetchImpl.calls.length, before);
      assert.strictEqual(lines.length, 1);
      const line = lines[0];
      assert.deepStrictEqual([line.action, line.query_count, line.user_id, line.company_id, line.backend, line.status, line.auth],
        ['dbHealth', 1, 'u1', 'c1', 'pg', 200, 'verified']);
      assert.ok(Number.isFinite(line.duration_ms));
    });
  });

  test('rpc enforce: a ported action without a token is 401 NOT_SIGNED_IN (same code as the proxy), no query', async () => {
    await withRpc({ mode: 'enforce' }, async (b, lines, db) => {
      const res = await rpcPost(b, { action: 'dbHealth' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.headers.get('x-backend'), 'pg');
      assert.strictEqual((await res.json()).code, 'NOT_SIGNED_IN');
      assert.strictEqual(db.seen.length, 0);
      assert.strictEqual(lines[0].query_count, 0);
    });
  });

  test('rpc warn: the handler itself refuses an anonymous call (requireUser -> 401)', async () => {
    await withRpc({ mode: 'warn' }, async (b, lines, db) => {
      const res = await rpcPost(b, { action: 'dbHealth' }, 'forged');
      assert.strictEqual(res.status, 401);
      assert.strictEqual((await res.json()).code, 'NOT_SIGNED_IN');
      assert.strictEqual(db.seen.length, 0);
      assert.strictEqual(lines[0].auth, 'invalid');
    });
  });

  test('rpc: client identity fields never reach a handler; ctx.user comes from the token (email lower-cased)', async () => {
    let got = null;
    const handlers = { whoAmI: async (payload, ctx) => { got = { payload, user: ctx.user }; return { ok: true }; } };
    await withRpc({ handlers }, async b => {
      const res = await rpcPost(b, { action: 'whoAmI', note: 'x', _auth_uid: 'forged', _auth_email: 'boss@x.com', _proxy_secret: 'f' }, 'good');
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(got.payload, { note: 'x' });
      assert.deepStrictEqual(got.user, { id: 'u1', email: 'ann@example.com' });
    });
  });

  test('rpc: an unexpected handler error is a 500 "Server error" - the message (and any URL) only in the redacted log', async () => {
    const handlers = { explode: async () => { throw new Error('connect failed postgresql://u:pw@host/db'); } };
    await withRpc({ handlers }, async (b, lines) => {
      const res = await rpcPost(b, { action: 'explode' }, 'good');
      assert.strictEqual(res.status, 500);
      const text = await res.text();
      assert.ok(!text.includes('pw@') && !text.includes('connect failed'), text);
      assert.strictEqual(JSON.parse(text).error, 'Server error');
      assert.ok(!lines[0].error.includes('pw@'), lines[0].error);
    });
  });

  test('rpc: an RpcError keeps its status and code', async () => {
    const handlers = { strict: async () => { throw badRequest('title is required'); } };
    await withRpc({ handlers }, async b => {
      const res = await rpcPost(b, { action: 'strict' }, 'good');
      assert.strictEqual(res.status, 400);
      assert.deepStrictEqual(await res.json(), { success: false, status: 'error', code: 'BAD_REQUEST', error: 'title is required' });
    });
  });

  test('rpc: OPTIONS preflight answers 200 with CORS headers, nothing called', async () => {
    await withRpc({}, async (b, lines) => {
      const before = fetchImpl.calls.length;
      const res = await fetch(`${b}/api/rpc`, { method: 'OPTIONS' });
      assert.strictEqual(res.status, 200);
      assert.match(res.headers.get('access-control-allow-headers') || '', /Authorization/);
      assert.strictEqual(fetchImpl.calls.length, before);
      assert.strictEqual(lines.length, 0);
    });
  });

  test('handler registry: dbHealth is registered; a duplicate action name is refused (A20)', () => {
    assert.strictEqual(typeof handlers.dbHealth, 'function');
    assert.throws(() => mergeHandlers({ a: { x: async () => 1 }, b: { x: async () => 2 } }), /defined in both/);
    assert.throws(() => mergeHandlers({ a: { x: 'nope' } }), /not a function/);
  });

  test('createDb: no connection string -> null; queries and transaction statements are counted per request', async () => {
    assert.strictEqual(createDb({ connectionString: '' }), null);
    const issued = [];
    const fakeClient = { query: async text => { issued.push(text); return { rows: [] }; }, release: () => issued.push('release') };
    const db = createDb({ connectionString: 'postgresql://x', poolFactory: () => ({
      query: async text => { issued.push(text); return { rows: [] }; }, connect: async () => fakeClient, end: async () => {}
    }) });
    const one = db.forRequest();
    const two = db.forRequest();
    await one.query('select 1');
    await one.transaction(async tx => { await tx.query('update a'); await tx.query('update b'); });
    await assert.rejects(two.transaction(async tx => { await tx.query('update c'); throw new Error('nope'); }), /nope/);
    assert.strictEqual(one.count(), 3);
    assert.strictEqual(two.count(), 1);
    assert.deepStrictEqual(issued, ['select 1', 'begin', 'update a', 'update b', 'commit', 'release', 'begin', 'update c', 'rollback', 'release']);
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
