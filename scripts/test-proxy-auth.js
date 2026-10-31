#!/usr/bin/env node
/**
 * test-proxy-auth.js — the Apps Script proxy verifies the caller before forwarding (compliance F2 / F6)
 *
 * Usage: node scripts/test-proxy-auth.js
 *
 * Runs api/_lib/proxyCore.js against a local RSA key set (no network): valid / forged / expired / wrong-audience /
 * missing tokens in each AUTH_MODE, client-sent _auth_uid / _proxy_secret stripped, GET and POST forwarding.
 * Exit: 0 = all pass, 1 = a case failed.
 */

const assert = require('assert');
const { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } = require('jose');
const { createProxyHandler, firebaseAdapter } = require('../api/_lib/proxyCore');

const PROJECT = 'demo-project';
const SECRET = 's3cret';

function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

function fakeFetch() {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: 'from-gas' }) };
  };
  fn.calls = calls;
  return fn;
}

/** What the proxy sent to Apps Script (always a POST body since review CR2-10). */
function forwardedOf(call) {
  return JSON.parse(call.options.body);
}

async function main() {
  const good = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(good.publicKey)), kid: 'k1', alg: 'RS256' };
  const keySet = createLocalJWKSet({ keys: [jwk] });
  const now = Math.floor(Date.now() / 1000);
  const sign = (key, claims = {}, opts = {}) => new SignJWT({ auth_time: now - 10, email: 'u@example.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss || `https://securetoken.google.com/${PROJECT}`)
    .setAudience(opts.aud || PROJECT)
    .setSubject(opts.sub === undefined ? 'uid_123' : opts.sub)
    .setIssuedAt(opts.iat || now - 10)
    .setExpirationTime(opts.exp || now + 3600)
    .sign(key);

  const tokens = {
    valid: await sign(good.privateKey),
    forged: await sign(other.privateKey),
    expired: await sign(good.privateKey, {}, { iat: now - 7200, exp: now - 3600 }),
    wrongAudience: await sign(good.privateKey, {}, { aud: 'someone-else' }),
    none: null
  };

  const results = [];
  async function run(name, fn) {
    try { await fn(); results.push(`PASS  ${name}`); }
    catch (e) { results.push(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
  }

  async function call(mode, token, { method = 'POST', input = { action: 'getTickets' } } = {}) {
    const fetchImpl = fakeFetch();
    const logs = [];
    const handler = createProxyHandler({
      env: { AUTH_MODE: mode, PROXY_SECRET: SECRET, APPS_SCRIPT_URL: 'https://gas.example/exec', FIREBASE_PROJECT_ID: PROJECT },
      fetchImpl,
      adapters: [firebaseAdapter(PROJECT, keySet)],
      log: line => logs.push(JSON.parse(line))
    });
    const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {} };
    if (method === 'GET') req.query = input; else req.body = input;
    const res = fakeRes();
    await handler(req, res);
    return { res, fetchImpl, logs, forwarded: fetchImpl.calls[0] ? forwardedOf(fetchImpl.calls[0]) : null };
  }

  for (const mode of ['off', 'warn', 'enforce']) {
    await run(`${mode}: valid token forwards the verified uid and the secret`, async () => {
      const { res, forwarded, logs } = await call(mode, tokens.valid);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(forwarded._auth_uid, 'uid_123');
      assert.strictEqual(forwarded._proxy_secret, SECRET);
      assert.strictEqual(logs[0].auth, 'verified');
      assert.strictEqual(res.headers['X-Backend'], 'gas');
    });
    for (const bad of ['forged', 'expired', 'wrongAudience', 'none']) {
      await run(`${mode}: ${bad} token ${mode === 'enforce' ? 'is refused (401)' : 'forwards without a uid'}`, async () => {
        const { res, forwarded, fetchImpl, logs } = await call(mode, tokens[bad]);
        if (mode === 'enforce') {
          assert.strictEqual(res.statusCode, 401);
          assert.strictEqual(res.body.status, 'error');
          assert.strictEqual(fetchImpl.calls.length, 0, 'nothing forwarded');
        } else {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(forwarded._auth_uid, undefined);
          assert.strictEqual(forwarded._proxy_secret, SECRET);
        }
        assert.strictEqual(logs[0].auth, bad === 'none' ? 'none' : 'invalid');
      });
    }
  }

  await run('enforce: ping passes without a token', async () => {
    const { res } = await call('enforce', null, { input: { action: 'ping' } });
    assert.strictEqual(res.statusCode, 200);
  });

  await run('client-sent _auth_uid / _proxy_secret are stripped (POST body)', async () => {
    const { forwarded } = await call('warn', null, { input: { action: 'updateTicket', _auth_uid: 'admin_1', _proxy_secret: 'guess' } });
    assert.strictEqual(forwarded._auth_uid, undefined);
    assert.strictEqual(forwarded._proxy_secret, SECRET);
  });

  await run('a GET read is forwarded as POST with _via_get; the secret is never in the URL (CR2-10)', async () => {
    const { forwarded, fetchImpl } = await call('warn', tokens.valid, { method: 'GET', input: { action: 'getTickets', _auth_uid: 'admin_1', _via_get: 'x' } });
    assert.strictEqual(fetchImpl.calls[0].options.method, 'POST');
    assert.strictEqual(fetchImpl.calls[0].url, 'https://gas.example/exec', 'no query string');
    assert.ok(!fetchImpl.calls[0].url.includes(SECRET));
    assert.strictEqual(forwarded._via_get, true);
    assert.strictEqual(forwarded._auth_uid, 'uid_123', 'client-sent _auth_uid replaced by the verified uid');
    assert.strictEqual(forwarded.action, 'getTickets');
  });

  await run('a POST write is not marked _via_get', async () => {
    const { forwarded } = await call('warn', tokens.valid, { input: { action: 'createTicket', _via_get: true } });
    assert.strictEqual(forwarded._via_get, undefined);
  });

  await run('a token without a subject is refused', async () => {
    const { res } = await call('enforce', await sign(good.privateKey, {}, { sub: '' }));
    assert.strictEqual(res.statusCode, 401);
  });

  console.log(results.join('\n'));
  if (process.exitCode) console.error('Proxy auth test FAILED');
  else console.log(`Proxy auth test OK (${results.length} cases)`);
}

main().catch(error => { console.error(error); process.exit(1); });
