// Apps Script proxy core (compliance F2 / F6, AppScript v9.4+)
// Verifies who is calling, then forwards the request to the Apps Script web app with the verified uid and a
// shared secret. Apps Script refuses calls without the secret (Script Property AUTH_MODE = enforce), so the
// public /exec URL can't be used to act as another user. Kept free of Vercel specifics so
// scripts/test-proxy-auth.js can run it in plain Node.

const { createRemoteJWKSet, jwtVerify } = require('jose');

// Used when the APPS_SCRIPT_URL env var isn't set (deployments made before v9.4)
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyeSHLU8sW3S87yEZ7BAGJWBdaMEvJfkz3OzjPjE8XaP0pOjmGxxYQWmUwvgoIvMQArXA/exec';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
// Fields only the proxy may set: anything a client sends under these names is dropped
const IDENTITY_FIELDS = ['_auth_uid', '_proxy_secret', '_via_get'];
const AUTH_MODES = ['off', 'warn', 'enforce'];

/**
 * Identity adapter for Firebase ID tokens (the app's sign-in today). Checks signature (Google's securetoken
 * keys), issuer, audience, expiry and subject.
 * @param {string} projectId - Firebase project id
 * @param {Function} keySet - jose key set (tests pass a local one)
 * @returns {{ name: string, verify: Function }} verify(token) -> { uid, provider, email }
 */
function firebaseAdapter(projectId, keySet = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL))) {
  return {
    name: 'firebase',
    async verify(token) {
      if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not set');
      const { payload } = await jwtVerify(token, keySet, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        algorithms: ['RS256']
      });
      if (!payload.sub) throw new Error('token has no subject');
      if (payload.auth_time && payload.auth_time * 1000 > Date.now() + 60 * 1000) throw new Error('auth_time is in the future');
      return { uid: payload.sub, provider: 'firebase', email: payload.email || null };
    }
  };
}

/**
 * Who is calling: the first adapter that accepts the bearer token. A second provider (Auth.js / Better Auth
 * after the Neon migration) is another { name, verify } entry; its uid maps to the same user id through
 * auth_identities (docs/planning/PLAN_Migration_NeonVercel_20261030.md §3).
 * @returns {Promise<{ identity: Object|null, error: string|null }>}
 */
async function identify(token, adapters) {
  if (!token) return { identity: null, error: null };
  const errors = [];
  for (const adapter of adapters) {
    try {
      return { identity: await adapter.verify(token), error: null };
    } catch (error) {
      errors.push(`${adapter.name}: ${error.code || error.message}`);
    }
  }
  return { identity: null, error: errors.join('; ') || 'no identity adapter' };
}

function bearerToken(headers = {}) {
  const value = headers.authorization || headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(value));
  return match ? match[1].trim() : null;
}

/** The request's parameters (GET query or POST body) without any client-sent identity fields. */
function requestInput(req) {
  let input;
  if (req.method === 'GET') {
    input = { ...(req.query || {}) };
  } else if (typeof req.body === 'string') {
    try {
      input = req.body ? JSON.parse(req.body) : {};
    } catch (error) {
      input = {};
    }
  } else {
    input = { ...(req.body || {}) };
  }
  IDENTITY_FIELDS.forEach(field => delete input[field]);
  return input;
}

/**
 * Build the Vercel handler.
 * @param {Object} options - { env, fetchImpl, adapters, log }
 * @returns {Function} async (req, res)
 */
function createProxyHandler({ env = process.env, fetchImpl = globalThis.fetch, adapters = null, log = console.log } = {}) {
  const mode = AUTH_MODES.includes(String(env.AUTH_MODE || '').toLowerCase()) ? String(env.AUTH_MODE).toLowerCase() : 'warn';
  const appsScriptUrl = env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL;
  const secret = env.PROXY_SECRET || '';
  const projectId = env.FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID || '';
  let identityAdapters = adapters;

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const started = Date.now();
    const input = requestInput(req);
    const action = input.action || 'ping';
    // Created on first use, so a cold start that only answers OPTIONS doesn't build the key set
    identityAdapters = identityAdapters || [firebaseAdapter(projectId)];
    const token = bearerToken(req.headers);
    const { identity, error: authError } = await identify(token, identityAdapters);
    const uid = identity ? identity.uid : null;
    const finish = (status, body) => {
      res.setHeader('X-Backend', 'gas');
      res.setHeader('X-Response-Time', `${Date.now() - started}ms`);
      log(JSON.stringify({
        action, duration_ms: Date.now() - started, user_id: uid, company_id: input.company_id || null,
        auth: uid ? 'verified' : (token ? 'invalid' : 'none'), mode, status, backend: 'gas',
        ...(authError ? { auth_error: authError } : {})
      }));
      res.status(status).json(body);
    };

    if (mode === 'enforce' && !uid && action !== 'ping') {
      finish(401, { success: false, status: 'error', error: token ? 'Session expired: sign in again' : 'Not signed in' });
      return;
    }

    const forwarded = { ...input };
    if (uid) forwarded._auth_uid = uid;
    if (secret) forwarded._proxy_secret = secret;

    try {
      // Always POST to Apps Script: the shared secret must never travel in a URL query (logs, e.queryString).
      // A GET read is marked _via_get, and doPost hands it to doGet (AppScript v9.4+) - review CR2-10
      if (req.method === 'GET') forwarded._via_get = true;
      const response = await fetchImpl(appsScriptUrl, { method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(forwarded) });
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch (error) {
        body = { success: false, status: 'error', error: 'Invalid JSON response from Apps Script', raw: text.slice(0, 500) };
      }
      finish(response.ok ? 200 : response.status, body);
    } catch (error) {
      finish(502, { success: false, status: 'error', error: 'Proxy request failed', details: error.message });
    }
  };
}

module.exports = { createProxyHandler, firebaseAdapter, identify, bearerToken, requestInput, IDENTITY_FIELDS };
