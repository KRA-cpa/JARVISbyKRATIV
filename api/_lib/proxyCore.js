// Apps Script proxy core (compliance F2 / F6, AppScript v9.4+)
// Verifies who is calling, then forwards the request to the Apps Script web app with the verified uid and a
// shared secret. Apps Script refuses calls without the secret (Script Property AUTH_MODE = enforce), so the
// public /exec URL can't be used to act as another user. Kept free of Vercel specifics so
// scripts/test-proxy-auth.js can run it in plain Node.
// v9.6: forwards the Google-verified email (_auth_email, for invites) and refuses sign-ins older than
// MAX_SESSION_HOURS (default 12) - the "fresh sign-in daily" cap. 401s carry a code the app reacts to.
// 14 Nov 2026 (migration 0.6): the sign-in rules moved into createAuthenticator() so /api/rpc (rpcCore.js) shares them;
// the proxy's behaviour is unchanged (scripts/test-proxy-auth.js).

const { createRemoteJWKSet, jwtVerify } = require('jose');

// Used when the APPS_SCRIPT_URL env var isn't set (deployments made before v9.4)
const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyeSHLU8sW3S87yEZ7BAGJWBdaMEvJfkz3OzjPjE8XaP0pOjmGxxYQWmUwvgoIvMQArXA/exec';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
// Fields only the proxy may set: anything a client sends under these names is dropped
const IDENTITY_FIELDS = ['_auth_uid', '_auth_email', '_proxy_secret', '_via_get'];
const AUTH_MODES = ['off', 'warn', 'enforce'];
const DEFAULT_MAX_SESSION_HOURS = 12;

/**
 * Identity adapter for Firebase ID tokens (the app's sign-in today). Checks signature (Google's securetoken
 * keys), issuer, audience, expiry and subject.
 * @param {string} projectId - Firebase project id
 * @param {Function} keySet - jose key set (tests pass a local one)
 * @returns {{ name: string, verify: Function }} verify(token) -> { uid, provider, email, email_verified, auth_time }
 *   (auth_time = seconds since epoch of the sign-in, null when the token has none)
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
      return { uid: payload.sub, provider: 'firebase', email: payload.email || null,
        email_verified: payload.email_verified === true, auth_time: typeof payload.auth_time === 'number' ? payload.auth_time : null };
    }
  };
}

/**
 * Who is calling: the first adapter that accepts the bearer token. A second provider (Auth.js / Better Auth
 * after the Neon migration) is another { name, verify } entry; its uid maps to the same user id through
 * auth_identities (docs/planning/PLAN_Migration_NeonVercel_20261030.md §3).
 * v9.6: `expired` is true when an adapter rejected the token only because it expired (jose ERR_JWT_EXPIRED) - the
 * one failure that means "sign in again". Others (bad signature, wrong audience, key fetch failure, missing
 * config) must not sign people out: a JWKS outage would otherwise end every session.
 * @returns {Promise<{ identity: Object|null, error: string|null, expired: boolean }>}
 */
async function identify(token, adapters) {
  if (!token) return { identity: null, error: null, expired: false };
  const errors = [];
  let expired = false;
  for (const adapter of adapters) {
    try {
      return { identity: await adapter.verify(token), error: null, expired: false };
    } catch (error) {
      if (error.code === 'ERR_JWT_EXPIRED') expired = true;
      errors.push(`${adapter.name}: ${error.code || error.message}`);
    }
  }
  return { identity: null, error: errors.join('; ') || 'no identity adapter', expired };
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

/** env MAX_SESSION_HOURS as a positive number of hours (default 12; 0 or invalid -> the default). */
function maxSessionHours(env) {
  const hours = Number(env.MAX_SESSION_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_MAX_SESSION_HOURS;
}

/**
 * Is the sign-in behind this identity older than the cap? A token without auth_time can't be judged and passes
 * (Firebase always sets it).
 */
function sessionTooOld(identity, hours, nowMs = Date.now()) {
  if (!identity || !identity.auth_time) return false;
  return nowMs - identity.auth_time * 1000 > hours * 60 * 60 * 1000;
}

/** env AUTH_MODE as one of AUTH_MODES (default 'warn'). */
function authMode(env) {
  const value = String(env.AUTH_MODE || '').toLowerCase();
  return AUTH_MODES.includes(value) ? value : 'warn';
}

/**
 * The sign-in rules shared by the Apps Script proxy and /api/rpc (migration 0.6) - one copy, so both answer the same
 * 401 codes (compliance F6).
 * @param {Object} options - { env, adapters }
 * @returns {{ mode: string, capHours: number, authenticate: Function }} authenticate(headers, action) ->
 *   { uid, identity, auth ('verified' | 'max_age' | 'invalid' | 'none'), authError, refusal (null or { code, error }) }
 *   refusal is set only in enforce mode, for a request without a valid identity, except `ping`
 */
function createAuthenticator({ env = process.env, adapters = null } = {}) {
  const mode = authMode(env);
  const projectId = env.FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID || '';
  const capHours = maxSessionHours(env);
  let identityAdapters = adapters;

  async function authenticate(headers, action) {
    // Created on first use, so a cold start that only answers OPTIONS doesn't build the key set
    identityAdapters = identityAdapters || [firebaseAdapter(projectId)];
    const token = bearerToken(headers);
    const { identity: verifiedIdentity, error: authError, expired } = await identify(token, identityAdapters);
    // v9.6: a sign-in older than MAX_SESSION_HOURS counts as no identity
    const tooOld = sessionTooOld(verifiedIdentity, capHours);
    const identity = tooOld ? null : verifiedIdentity;
    const uid = identity ? identity.uid : null;
    const auth = uid ? 'verified' : (tooOld ? 'max_age' : (token ? 'invalid' : 'none'));
    let refusal = null;
    if (mode === 'enforce' && !uid && action !== 'ping') {
      refusal = tooOld
        ? { code: 'SESSION_MAX_AGE', error: `Your session reached ${capHours} hours. Please sign in again.` }
        : !token ? { code: 'NOT_SIGNED_IN', error: 'Not signed in' }
          : expired ? { code: 'SESSION_EXPIRED', error: 'Session expired: sign in again' }
            : { code: 'TOKEN_REJECTED', error: 'Your sign-in could not be verified right now. Try again.' };
    }
    return { uid, identity, auth, authError, refusal };
  }

  return { mode, capHours, authenticate };
}

/** CORS headers for the API routes; true when the request was a preflight that is now answered. */
function answerCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Build the Vercel handler.
 * @param {Object} options - { env, fetchImpl, adapters, log }
 * @returns {Function} async (req, res)
 */
function createProxyHandler({ env = process.env, fetchImpl = globalThis.fetch, adapters = null, log = console.log } = {}) {
  const appsScriptUrl = env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL;
  const secret = env.PROXY_SECRET || '';
  const { mode, authenticate } = createAuthenticator({ env, adapters });

  return async function handler(req, res) {
    if (answerCors(req, res)) return;

    const started = Date.now();
    const input = requestInput(req);
    const action = input.action || 'ping';
    const { uid, identity, auth, authError, refusal } = await authenticate(req.headers, action);
    const finish = (status, body) => {
      res.setHeader('X-Backend', 'gas');
      res.setHeader('X-Response-Time', `${Date.now() - started}ms`);
      log(JSON.stringify({
        action, duration_ms: Date.now() - started, user_id: uid, company_id: input.company_id || null,
        auth, mode, status, backend: 'gas',
        ...(authError ? { auth_error: authError } : {})
      }));
      res.status(status).json(body);
    };

    if (refusal) {
      finish(401, { success: false, status: 'error', ...refusal });
      return;
    }

    const forwarded = { ...input };
    if (uid) forwarded._auth_uid = uid;
    // v9.6: the email only when Google verified it (invite acceptance trusts it)
    if (uid && identity.email && identity.email_verified) forwarded._auth_email = String(identity.email).toLowerCase();
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

module.exports = {
  createProxyHandler, createAuthenticator, answerCors, authMode, firebaseAdapter, identify, bearerToken, requestInput,
  sessionTooOld, maxSessionHours, IDENTITY_FIELDS
};
