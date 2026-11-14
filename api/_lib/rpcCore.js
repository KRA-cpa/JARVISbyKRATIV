/**
 * api/_lib/rpcCore.js - the /api/rpc route (migration step 0.6, 14 Nov 2026; PLAN_Migration_NeonVercel_20261030.md §2).
 *
 *   Browser ─► /api/rpc ─┬─ action has a handler AND a database is configured ─► handler ─► Neon   (X-Backend: pg)
 *                        └─ otherwise ─► the Apps Script proxy handler, unchanged (proxyCore.js)  (X-Backend: gas)
 *
 * Same request / response contract as the proxy: { action, ...payload } in (POST body or GET query), { success, data }
 * or { success: false, status: 'error', code?, error } out. Same sign-in rules (createAuthenticator - one copy; the 401
 * codes match). Client-sent identity fields are dropped (requestInput), the acting user comes from the verified token
 * only (compliance A15 / F6). One JSON log line per request: action, duration_ms, query_count, user_id, company_id,
 * auth, mode, status, backend (Claude.md non-functional requirements).
 *
 * User ids: today ctx.user.id is the Firebase uid, which is also the users / requester id in the data (PLAN_Migration §3:
 * existing users keep their id). The auth_identities mapping arrives with Better Auth (step 1.3).
 */

const { createAuthenticator, answerCors, requestInput } = require('./proxyCore');
const { handlers: defaultHandlers } = require('./handlers');
const { redact } = require('./db');

/**
 * @param {Object} options
 * @param {Function} options.proxyHandler - the Apps Script proxy (req, res) - the fallback for every unported action
 * @param {Object|null} [options.db] - createDb() result; null = no database, every action goes to Apps Script
 * @param {Object} [options.handlers] - action -> handler (default: handlers/index.js)
 * @param {Object} [options.env] - AUTH_MODE, FIREBASE_PROJECT_ID, MAX_SESSION_HOURS (as the proxy)
 * @param {Array} [options.adapters] - identity adapters (tests inject a local key set)
 * @param {Function} [options.log] - log line sink
 * @param {Function} [options.now] - clock (tests)
 * @returns {Function} async (req, res)
 */
function createRpcHandler({ proxyHandler, db = null, handlers = defaultHandlers, env = process.env, adapters = null,
  log = console.log, now = () => new Date() } = {}) {
  if (typeof proxyHandler !== 'function') throw new Error('createRpcHandler needs the Apps Script proxy handler');
  const { mode, authenticate } = createAuthenticator({ env, adapters });

  return async function rpc(req, res) {
    if (req.method === 'OPTIONS') {
      answerCors(req, res);
      return;
    }
    const input = requestInput(req);
    const action = input.action || 'ping';
    const handler = db && Object.prototype.hasOwnProperty.call(handlers, action) ? handlers[action] : null;
    // Unported action (or no database yet): the proxy does its own auth, log line and X-Backend: gas
    if (!handler) {
      await proxyHandler(req, res);
      return;
    }

    answerCors(req, res);
    const started = Date.now();
    const reqDb = db.forRequest();
    const { uid, identity, auth, authError, refusal } = await authenticate(req.headers, action);
    const finish = (status, body, extra = {}) => {
      res.setHeader('X-Backend', 'pg');
      res.setHeader('X-Response-Time', `${Date.now() - started}ms`);
      log(JSON.stringify({
        action, duration_ms: Date.now() - started, query_count: reqDb.count(), user_id: uid,
        company_id: input.company_id || null, auth, mode, status, backend: 'pg',
        ...(authError ? { auth_error: authError } : {}), ...extra
      }));
      res.status(status).json(body);
    };

    if (refusal) {
      finish(401, { success: false, status: 'error', ...refusal });
      return;
    }

    const payload = { ...input };
    delete payload.action;
    const user = uid ? {
      id: uid,
      // the email only when Google verified it (the same rule as the proxy's _auth_email)
      email: identity.email && identity.email_verified ? String(identity.email).toLowerCase() : null
    } : null;
    const ctx = { user, db: reqDb, log, now: now() };

    try {
      const data = await handler(payload, ctx);
      finish(200, { success: true, data: data === undefined ? null : data });
    } catch (error) {
      const expected = Number.isInteger(error.status) && error.status >= 400 && error.status < 500;
      const status = expected ? error.status : 500;
      const body = expected
        ? { success: false, status: 'error', ...(error.code ? { code: error.code } : {}), error: error.message }
        : { success: false, status: 'error', error: 'Server error' };
      finish(status, body, expected ? {} : { error: redact(error.message) });
    }
  };
}

module.exports = { createRpcHandler, RPC_PATH: '/api/rpc' };
