#!/usr/bin/env node
/**
 * db-retention.js v1.0 (15 Nov 2026, session 461f9ea9) - the retention clean-up (Data Privacy Act Sec. 11(e): kept only
 * as long as needed; docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md §5; Privacy Manual §3).
 *
 * Usage:
 *   node scripts/db-retention.js                 dry run: how many rows each rule would remove (nothing changed)
 *   node scripts/db-retention.js --apply         remove them, one transaction
 *   --outbox-days <n>   (default 90)  email_outbox rows sent / failed / cancelled more than n days ago
 *   --login-days <n>    (default 365) sign-in rows (admin_action_logs USER_LOGIN) older than n days
 *   --secret / --project / --allow-non-dev   as scripts/db-migrate.js (DATABASE_URL wins when set)
 * Reads and prints counts only - never row contents (the analytics / jobs rule, CHECK_PrivacyCompliance §4).
 * Ticket data, ticket audit logs and admin change logs are NOT touched here: they follow the customer's retention and
 * the off-boarding tools. Run monthly (Cloud Scheduler job, migration Phase 4).
 * Exit: 0 = done / dry run, 1 = error, 2 = bad arguments.
 */

'use strict';

const migrate = require('./db-migrate');
const { strictSsl, redact } = require('../api/_lib/db');

const DAY_MS = 24 * 60 * 60 * 1000;

/** The rules: name, table, where (with $1 = cutoff), days option. */
const RULES = [
  { name: 'email_outbox (sent / failed / cancelled)', table: 'email_outbox', days: 'outboxDays',
    where: "status in ('sent', 'failed', 'cancelled') and coalesce(sent_at, updated_at, created_at) < $1" },
  { name: 'sign-in log rows (USER_LOGIN)', table: 'admin_action_logs', days: 'loginDays',
    where: "action_type = 'USER_LOGIN' and timestamp < $1" }
];

function parseArgs(argv) {
  const opts = { secret: migrate.DEFAULT_SECRET, project: migrate.DEFAULT_PROJECT, allowNonDev: false, apply: false, outboxDays: 90, loginDays: 365 };
  const days = v => {
    const x = Number(v);
    if (!Number.isInteger(x) || x < 30 || x > 3650) throw new Error('days must be a whole number from 30 to 3650');
    return x;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (a === '--outbox-days') opts.outboxDays = days(argv[++i]);
    else if (a === '--login-days') opts.loginDays = days(argv[++i]);
    else if (a === '--secret') opts.secret = argv[++i];
    else if (a === '--project') opts.project = argv[++i];
    else if (a === '--allow-non-dev') opts.allowNonDev = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

/**
 * @returns {Promise<{ applied: boolean, rules: Array<{ name, table, cutoff, rows }> }>}
 */
async function runRetention(client, { apply = false, outboxDays = 90, loginDays = 365, now = new Date() } = {}) {
  await client.query('begin');
  try {
    const out = [];
    for (const r of RULES) {
      const cutoff = new Date(now.getTime() - ({ outboxDays, loginDays })[r.days] * DAY_MS);
      const sql = apply
        ? `with d as (delete from ${r.table} where ${r.where} returning 1) select count(*)::int as n from d`
        : `select count(*)::int as n from ${r.table} where ${r.where}`;
      const res = await client.query(sql, [cutoff]);
      out.push({ name: r.name, table: r.table, cutoff: cutoff.toISOString(), rows: Number(res.rows[0].n) });
    }
    await client.query(apply ? 'commit' : 'rollback');
    return { applied: apply, rules: out };
  } catch (error) {
    try { await client.query('rollback'); } catch (e) { /* closed */ }
    throw error;
  }
}

async function main(argv) {
  const opts = parseArgs(argv);
  const { url, source } = migrate.resolveConnection(opts);
  const { Client } = require('pg');
  const client = new Client({ connectionString: strictSsl(url), connectionTimeoutMillis: 20000, application_name: 'daloy-db-retention' });
  await client.connect();
  console.log(`Connected: ${migrate.describeTarget(url)} (${source}; password hidden)`);
  try {
    const r = await runRetention(migrate.pgAdapter(client), opts);
    console.log(r.applied ? 'Removed:' : 'Dry run (nothing changed) - would remove:');
    r.rules.forEach(x => console.log(`  ${x.name}: ${x.rows} (older than ${x.cutoff})`));
  } finally {
    await client.end();
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => process.exit(code)).catch(error => {
    console.error(`db-retention: ${redact(error.message)}`);
    process.exit(/unknown argument|days must/.test(error.message) ? 2 : 1);
  });
}

module.exports = { runRetention, parseArgs, RULES };
