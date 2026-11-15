/**
 * scripts/lib/syncRun.js v1.0 (16 Nov 2026, session 461f9ea9) - migration step 1.1: ONE run of the Sheet → Postgres
 * sync, shared by the terminal command (scripts/db-sync-sheets.js) and the scheduled endpoint on Cloud Run
 * (server/cronSync.js → POST /api/cron/sync), so both run exactly the same code.
 *
 *   readPlan   the Sheet (read-only token) → export v1 → clean rows (buildLoadPlan) with stable ids
 *   syncOnce   one connection, a session advisory lock (never two runs at once - a terminal run and a scheduled run
 *              included), syncPlan (one transaction), unlock
 *
 * TABLE_SCHEMAS: from the newest APPSCRIPT file in the repo, or - on Cloud Run, where the Apps Script source is not in
 * the image - from server/table-schemas.json (written by scripts/deploy-cloudrun.sh; loadSchemas()).
 * Returns counts only, never row values. Layer: scripts.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const gen = require('../gen-ddl');
const RULES = require('../db/ddl-rules');
const L = require('../db-load-sheets');
const S = require('./sheetsExport');
const { syncPlan, stableSurrogates } = require('./sheetsSync');

/** pg_try_advisory_lock key for "a Sheet sync is running" (fixed bigint, distinct from db-migrate's). */
const SYNC_LOCK_KEY = 4206140011;
const SCHEMAS_JSON = path.join(__dirname, '..', '..', 'server', 'table-schemas.json');

/**
 * TABLE_SCHEMAS: the given JSON file (the Cloud Run image passes SCHEMAS_JSON), else the newest APPSCRIPT file (terminal:
 * always the repo's newest, never a JSON left over from an older deploy).
 */
function loadSchemas({ jsonFile = null } = {}) {
  if (jsonFile && fs.existsSync(jsonFile)) return JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  return gen.loadTableSchemas(fs.readFileSync(gen.newestAppScript(), 'utf8'));
}

/** Read the Sheet and build the plan of clean rows with stable ids. */
async function readPlan({ sheetId, token, tsUtcSince, schemas = loadSchemas(), fetchImpl = fetch }) {
  const model = gen.buildModel(schemas, RULES);
  const spreadsheet = await S.fetchSpreadsheet(sheetId, token, { fetchImpl });
  const exported = S.exportFromSpreadsheet(spreadsheet, { tsUtcSince, tableSchemas: schemas });
  const plan = stableSurrogates(L.buildLoadPlan(exported, model), model, schemas);
  return { plan, model };
}

/**
 * Sync a plan under the advisory lock.
 * @param {{ query }} client - one connected client (the lock is per session)
 * @returns {Promise<{ busy: true } | { busy: false, result }>} busy = another run holds the lock (nothing done)
 */
async function syncOnce(client, plan, model, { apply = false, allowShrink = false } = {}) {
  const got = (await client.query('select pg_try_advisory_lock($1) as ok', [SYNC_LOCK_KEY])).rows[0];
  if (!got || !got.ok) return { busy: true };
  try {
    return { busy: false, result: await syncPlan(client, plan, model, { apply, allowShrink }) };
  } finally {
    try { await client.query('select pg_advisory_unlock($1)', [SYNC_LOCK_KEY]); } catch (e) { /* the session ends anyway */ }
  }
}

module.exports = { loadSchemas, readPlan, syncOnce, SYNC_LOCK_KEY, SCHEMAS_JSON };
