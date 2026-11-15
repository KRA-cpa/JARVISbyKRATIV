/**
 * server/cronSync.js v1.0 (16 Nov 2026, session 461f9ea9) - migration step 1.1: POST /api/cron/sync on Cloud Run, called
 * by 2 Cloud Scheduler jobs (Asia/Manila: hourly always + every 5 min Mon-Fri 07:00-20:00). One run = read the platform
 * Sheet (read-only, borrowed account daloy-sheet-reader) and make Neon production equal to its clean rows
 * (scripts/lib/syncRun.js - the same code as `npm run db:sync-sheets`).
 *
 * Who may call: ONLY a Google-signed OIDC token (Cloud Scheduler's `--oidc-service-account-email`) whose
 *   email = CRON_INVOKER (verified) and audience = CRON_AUDIENCE (the service URL). Everything else → 401 / 403.
 *   The service allows unauthenticated requests (the app checks Firebase tokens itself), so this check is the gate.
 * Environment: SYNC_DATABASE_URL (Secret Manager daloy-db-prod-url - deliberately NOT DATABASE_URL, so /api/rpc keeps
 *   answering from Apps Script until the read cutover, 1.2), SYNC_SHEET_ID, TS_UTC_SINCE, CRON_INVOKER, CRON_AUDIENCE.
 *   Any one missing → 503 (not configured), nothing read.
 * Answers: 200 { synced | busy (another run holds the lock) }, 500 failed / refused (a bad read) - Cloud Scheduler shows the
 *   job as failed; the next slot tries again. One JSON log line per run (counts and times only - never row values).
 * Layer: server (uses scripts/lib/syncRun.js).
 */

'use strict';

const { createRemoteJWKSet, jwtVerify } = require('jose');

const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const REQUIRED_ENV = ['SYNC_DATABASE_URL', 'SYNC_SHEET_ID', 'TS_UTC_SINCE', 'CRON_INVOKER', 'CRON_AUDIENCE'];

/** Verifier for Google-signed OIDC tokens (Cloud Scheduler). Returns the token's email, or throws with .status. */
function createGoogleOidcVerifier({ audience, invoker, jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS)) }) {
  return async authorization => {
    const match = /^Bearer\s+(\S+)$/i.exec(String(authorization || ''));
    if (!match) throw Object.assign(new Error('no token'), { status: 401 });
    let payload;
    try {
      ({ payload } = await jwtVerify(match[1], jwks, { issuer: GOOGLE_ISSUERS, audience }));
    } catch (e) {
      throw Object.assign(new Error('invalid token'), { status: 401 });
    }
    if (payload.email !== invoker || payload.email_verified !== true) {
      throw Object.assign(new Error('caller not allowed'), { status: 403 });
    }
    return payload.email;
  };
}

/** The real run: token for the reader, read the Sheet, one client, syncOnce under the lock. */
function createDefaultRun(env) {
  let schemas = null;
  return async () => {
    const { loadSchemas, readPlan, syncOnce, SCHEMAS_JSON } = require('../scripts/lib/syncRun');
    const { sheetReaderToken } = require('../scripts/lib/sheetsExport');
    const { strictSsl } = require('../api/_lib/db');
    const { Client } = require('pg');
    if (!schemas) schemas = loadSchemas({ jsonFile: SCHEMAS_JSON });
    const t0 = Date.now();
    const token = await sheetReaderToken();
    const { plan, model } = await readPlan({ sheetId: env.SYNC_SHEET_ID, token, tsUtcSince: env.TS_UTC_SINCE, schemas });
    const readMs = Date.now() - t0;
    const client = new Client({ connectionString: strictSsl(env.SYNC_DATABASE_URL), connectionTimeoutMillis: 20000,
      application_name: 'daloy-cron-sync' });
    await client.connect();
    try {
      const run = await syncOnce({ query: (t, p) => client.query(t, p) }, plan, model, { apply: true });
      return { ...run, readMs, copied: plan.meta.copied, skipped: plan.meta.skipped };
    } finally {
      await client.end().catch(() => {});
    }
  };
}

/**
 * @param {{ env?: Object, verify?: Function, run?: Function, log?: Function, now?: Function }} options - tests inject
 *   verify / run / log
 * @returns {Function} (req, res) => Promise
 */
function createCronSyncHandler({ env = process.env, verify = null, run = null, log = line => console.log(JSON.stringify(line)),
  now = () => Date.now() } = {}) {
  const missing = REQUIRED_ENV.filter(k => !env[k]);
  const check = verify || (missing.length ? null : createGoogleOidcVerifier({ audience: env.CRON_AUDIENCE, invoker: env.CRON_INVOKER }));
  const doRun = run || createDefaultRun(env);
  let running = false; // same instance: refuse a second run before touching the database

  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ success: false, status: 'error', error: 'POST only' });
    if (missing.length) {
      return res.status(503).json({ success: false, status: 'error', error: 'sync not configured' });
    }
    try {
      await check(req.headers.authorization);
    } catch (e) {
      return res.status(e.status || 401).json({ success: false, status: 'error', error: e.status === 403 ? 'Forbidden' : 'Unauthorized' });
    }
    const started = now();
    if (running) {
      log({ event: 'cron_sync', status: 'busy', duration_ms: 0 });
      return res.status(200).json({ success: true, data: { busy: true } });
    }
    running = true;
    try {
      const r = await doRun();
      const line = { event: 'cron_sync', status: r.busy ? 'busy' : 'synced', duration_ms: now() - started, read_ms: r.readMs,
        rows: r.copied, left_out: r.skipped };
      if (!r.busy) Object.assign(line, r.result.totals, { changed_tables: Object.entries(r.result.tables)
        .filter(([, s]) => s.inserted || s.updated || s.deleted).map(([t]) => t) });
      log(line);
      return res.status(200).json({ success: true, data: r.busy ? { busy: true } : { totals: r.result.totals, read_ms: r.readMs } });
    } catch (error) {
      const { redact } = require('../api/_lib/db');
      const message = redact(error.message).slice(0, 300);
      log({ event: 'cron_sync', status: /^refused:/.test(message) ? 'refused' : 'failed', duration_ms: now() - started, error: message, severity: 'ERROR' });
      return res.status(500).json({ success: false, status: 'error', error: /^refused:/.test(message) ? message : 'Sync failed' });
    } finally {
      running = false;
    }
  };
}

module.exports = { createCronSyncHandler, createGoogleOidcVerifier, REQUIRED_ENV, CRON_SYNC_PATH: '/api/cron/sync' };
