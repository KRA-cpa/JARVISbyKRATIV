#!/usr/bin/env node
/**
 * db-sync-sheets.js v1.1 (16 Nov 2026: the shared run in scripts/lib/syncRun.js + the advisory lock; v1.0 15 Nov 2026, session 461f9ea9) - migration step 1.1: one run of the Sheet → Postgres sync
 * from a terminal (the scheduled runs will call the same code from /api/cron/sync).
 *
 * Usage (npm run db:sync-sheets -- <options>):
 *   (no option)      dry run: read the Sheet, sync inside a transaction, ROLL BACK - prints counts only
 *   --apply          sync for real (one transaction: all or nothing)
 *   --allow-shrink   let a table lose more than 20 % of its rows (default: refuse - a bad read must not empty a table)
 *   --secret / --project / --allow-non-dev   as scripts/db-migrate.js (default: Neon dev; DATABASE_URL wins)
 * Environment: SYNC_SHEET_ID (the Sheet), TS_UTC_SINCE (the Script Property value), SHEETS_ACCESS_TOKEN (a read-only
 *   token for daloy-sheet-reader - from a terminal: gcloud auth print-access-token --impersonate-service-account=... ;
 *   on Cloud Run it is borrowed automatically). Tokens come from the environment only - never on the command line.
 * Reads the Sheet read-only; prints counts, never row values. Rows the loader calls broken are left out (the 0.8 rule).
 * Exit: 0 = done / dry run, 1 = failed or refused, 2 = bad arguments / settings.
 */

'use strict';

const migrate = require('./db-migrate');
const S = require('./lib/sheetsExport');
const { readPlan, syncOnce } = require('./lib/syncRun');
const { strictSsl, redact } = require('../api/_lib/db');

function parseArgs(argv) {
  const opts = { secret: migrate.DEFAULT_SECRET, project: migrate.DEFAULT_PROJECT, allowNonDev: false, apply: false, allowShrink: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (a === '--allow-shrink') opts.allowShrink = true;
    else if (a === '--secret') opts.secret = argv[++i];
    else if (a === '--project') opts.project = argv[++i];
    else if (a === '--allow-non-dev') opts.allowNonDev = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

async function main(argv) {
  const opts = parseArgs(argv);
  const sheetId = process.env.SYNC_SHEET_ID;
  const tsUtcSince = process.env.TS_UTC_SINCE;
  if (!sheetId) throw new Error('SYNC_SHEET_ID is not set');
  if (!tsUtcSince || Number.isNaN(Date.parse(tsUtcSince))) throw new Error('TS_UTC_SINCE is not set (the Script Property value, an ISO time)');
  const token = process.env.SHEETS_ACCESS_TOKEN || await S.sheetReaderToken();
  const started = Date.now();
  const { plan, model } = await readPlan({ sheetId, token, tsUtcSince });
  console.log(`Sheet read in ${Date.now() - started} ms: ${plan.meta.copied} clean rows, ${plan.meta.skipped} left out`);

  const { url, source } = migrate.resolveConnection(opts);
  const { Client } = require('pg');
  const client = new Client({ connectionString: strictSsl(url), connectionTimeoutMillis: 20000, application_name: 'daloy-db-sync-sheets' });
  await client.connect();
  console.log(`Connected: ${migrate.describeTarget(url)} (${source}; password hidden)`);
  try {
    const run = await syncOnce(migrate.pgAdapter(client), plan, model, { apply: opts.apply, allowShrink: opts.allowShrink });
    if (run.busy) throw new Error('another sync is running (a scheduled run?) - try again in a minute');
    const r = run.result;
    console.log(r.applied ? 'Synced:' : 'Dry run (rolled back) - would change:');
    Object.entries(r.tables).filter(([, s]) => s.inserted || s.updated || s.deleted)
      .forEach(([t, s]) => console.log(`  ${t}: +${s.inserted} new, ${s.updated} changed, -${s.deleted} removed (${s.rows} in the Sheet)`));
    console.log(`  total: +${r.totals.inserted} new, ${r.totals.updated} changed, -${r.totals.deleted} removed, ${r.totals.rows} rows in the Sheet`);
  } finally {
    await client.end();
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => process.exit(code)).catch(error => {
    console.error(`db-sync-sheets: ${redact(error.message)}`);
    process.exit(/unknown argument|is not set/.test(error.message) ? 2 : 1);
  });
}

module.exports = { readPlan, parseArgs };
