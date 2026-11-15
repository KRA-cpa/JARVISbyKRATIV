#!/usr/bin/env node
/**
 * test-cron-sync.js - POST /api/cron/sync (server/cronSync.js) + the shared run's lock (scripts/lib/syncRun.js),
 * migration 1.1. Offline: tokens are signed with a local key (jose), the run and the database are fakes.
 * Checks: only POST; not configured → 503 before any check; no / bad / foreign-audience token → 401; another account
 * or an unverified email → 403; the scheduler's token → the run; busy (lock held or a run in flight) → 200 busy;
 * the log line has counts only; a failure → 500 without the connection string; a refused run says why; the route is
 * mounted in server/app.js; syncOnce takes and releases the advisory lock and does nothing when it is held.
 * Usage: node scripts/test-cron-sync.js   Exit: 0 = pass.
 */
'use strict';

const assert = require('assert');
const { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } = require('jose');
const { createCronSyncHandler, createGoogleOidcVerifier, REQUIRED_ENV } = require('../server/cronSync');
const { syncOnce, SYNC_LOCK_KEY } = require('./lib/syncRun');
const { createApp } = require('../server/app');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`); } catch (e) { results.push(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

const INVOKER = 'daloy-scheduler@krativ-daloy.iam.gserviceaccount.com';
const AUDIENCE = 'https://daloy-abc.asia-southeast1.run.app';
const ENV = { SYNC_DATABASE_URL: 'postgresql://u:pw@ep-x.neon.tech/daloy', SYNC_SHEET_ID: 'x', TS_UTC_SINCE: '2026-10-31T08:13:50.821Z',
  CRON_INVOKER: INVOKER, CRON_AUDIENCE: AUDIENCE };

function fakeRes() {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return res;
}
const req = (authorization, method = 'POST') => ({ method, headers: authorization ? { authorization } : {} });
const TOTALS = { inserted: 1, updated: 2, deleted: 0, rows: 322 };
const okRun = async () => ({ busy: false, readMs: 900, copied: 322, skipped: 28,
  result: { totals: TOTALS, tables: { tickets: { inserted: 1, updated: 2, deleted: 0, rows: 13 }, roles: { inserted: 0, updated: 0, deleted: 0, rows: 5 } } } });

(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims, { iss = 'https://accounts.google.com', aud = AUDIENCE, key = privateKey } = {}) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(iss).setAudience(aud)
      .setIssuedAt().setExpirationTime('5m').sign(key);
  const verify = createGoogleOidcVerifier({ audience: AUDIENCE, invoker: INVOKER, jwks });
  const good = `Bearer ${await sign({ email: INVOKER, email_verified: true })}`;

  await test('not configured: 503 before anything is checked; GET is refused', async () => {
    for (const k of REQUIRED_ENV) {
      const env = { ...ENV, [k]: '' };
      let ran = false;
      const res = fakeRes();
      await createCronSyncHandler({ env, verify, run: async () => { ran = true; }, log: () => {} })(req(good), res);
      assert.strictEqual(res.statusCode, 503, k);
      assert.ok(!ran);
    }
    const res = fakeRes();
    await createCronSyncHandler({ env: ENV, verify, run: okRun, log: () => {} })(req(good, 'GET'), res);
    assert.strictEqual(res.statusCode, 405);
  });

  await test('caller check: no token / garbage / wrong audience / wrong issuer / other key → 401; other account or unverified → 403', async () => {
    const otherKey = (await generateKeyPair('RS256')).privateKey;
    const cases = [
      [null, 401], ['Bearer abc.def.ghi', 401],
      [`Bearer ${await sign({ email: INVOKER, email_verified: true }, { aud: 'https://evil.example' })}`, 401],
      [`Bearer ${await sign({ email: INVOKER, email_verified: true }, { iss: 'https://evil.example' })}`, 401],
      [`Bearer ${await sign({ email: INVOKER, email_verified: true }, { key: otherKey })}`, 401],
      [`Bearer ${await sign({ email: 'someone@example.com', email_verified: true })}`, 403],
      [`Bearer ${await sign({ email: INVOKER, email_verified: false })}`, 403]
    ];
    for (const [auth, status] of cases) {
      let ran = false;
      const res = fakeRes();
      await createCronSyncHandler({ env: ENV, verify, run: async () => { ran = true; return okRun(); }, log: () => {} })(req(auth), res);
      assert.strictEqual(res.statusCode, status, `${String(auth).slice(0, 30)} → ${res.statusCode}`);
      assert.ok(!ran, 'the run must not start');
    }
  });

  await test("the scheduler's token runs the sync; the log line has counts and table names only", async () => {
    const lines = [];
    const res = fakeRes();
    await createCronSyncHandler({ env: ENV, verify, run: okRun, log: l => lines.push(l) })(req(good), res);
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body.data.totals, TOTALS);
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].status, 'synced');
    assert.deepStrictEqual(lines[0].changed_tables, ['tickets']);
    assert.ok(!JSON.stringify(lines[0]).includes('pw@'), 'no connection string');
  });

  await test('busy: the lock held elsewhere, or a run already in flight on this instance → 200 busy, no second run', async () => {
    const res = fakeRes();
    await createCronSyncHandler({ env: ENV, verify, run: async () => ({ busy: true }), log: () => {} })(req(good), res);
    assert.deepStrictEqual([res.statusCode, res.body.data.busy], [200, true]);
    let release;
    let calls = 0;
    const handler = createCronSyncHandler({ env: ENV, verify, log: () => {},
      run: () => { calls += 1; return new Promise(r => { release = () => r(okRun()); }); } });
    const first = fakeRes();
    const p = handler(req(good), first);
    await new Promise(r => setTimeout(r, 20));
    const second = fakeRes();
    await handler(req(good), second);
    assert.deepStrictEqual([second.statusCode, second.body.data.busy, calls], [200, true, 1]);
    release();
    await p;
    assert.strictEqual(first.statusCode, 200);
  });

  await test('failure → 500 without the connection string; a refused run (bad read) says why', async () => {
    const lines = [];
    const res = fakeRes();
    await createCronSyncHandler({ env: ENV, verify, log: l => lines.push(l),
      run: async () => { throw new Error('connect failed postgresql://u:pw@ep-x.neon.tech/daloy'); } })(req(good), res);
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.error, 'Sync failed');
    assert.ok(!JSON.stringify(lines).includes('pw@'), 'redacted in the log');
    assert.strictEqual(lines[0].severity, 'ERROR');
    const refused = fakeRes();
    await createCronSyncHandler({ env: ENV, verify, log: () => {},
      run: async () => { throw new Error('refused: tickets would lose 10 of 12 rows - a bad read? (allow with --allow-shrink)'); } })(req(good), refused);
    assert.match(refused.body.error, /^refused: tickets/);
  });

  await test('server/app.js mounts /api/cron/sync (not the API 404)', async () => {
    let hit = false;
    const app = createApp({ env: {}, buildDir: null, proxyHandler: (q, r) => r.status(200).json({}), db: null,
      cronSyncHandler: (q, r) => { hit = true; r.status(204).end(); } });
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/cron/sync`, { method: 'POST' });
      assert.strictEqual(res.status, 204);
      assert.ok(hit);
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    } finally { server.close(); }
  });

  await test('syncOnce: takes and releases the advisory lock; held → busy and nothing synced', async () => {
    const seen = [];
    const client = held => ({ query: async (text, params) => {
      seen.push([text, params && params[0]]);
      if (/pg_try_advisory_lock/.test(text)) return { rows: [{ ok: !held }] };
      throw new Error('syncPlan must not run'); // the plan below is empty but readForeignKeys would query
    } });
    assert.deepStrictEqual(await syncOnce(client(true), { tables: {} }, { tables: {} }), { busy: true });
    assert.strictEqual(seen.length, 1);
    assert.strictEqual(seen[0][1], SYNC_LOCK_KEY);
    seen.length = 0;
    await assert.rejects(syncOnce(client(false), { tables: {} }, { tables: {} }), /must not run/);
    assert.ok(seen.some(([t]) => /pg_advisory_unlock/.test(t)), 'unlocked even when the sync fails');
  });

  console.log(results.join('\n'));
  console.log(process.exitCode ? 'cron-sync test FAILED' : `cron-sync test OK (${results.length} cases)`);
})();
