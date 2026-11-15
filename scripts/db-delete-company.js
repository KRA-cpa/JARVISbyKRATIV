#!/usr/bin/env node
/**
 * db-delete-company.js v1.0 (15 Nov 2026, session 461f9ea9) - tool T2: delete ONE organization's (company's) data,
 * docs/guides/GUIDE_DataReturnDeletion_20261115.md §4.1 / §4.2. One transaction: all or nothing.
 *
 * Usage:
 *   node scripts/db-delete-company.js --company <id>                      dry run: counts per table, nothing changed
 *   node scripts/db-delete-company.js --company <id> --apply --case <id>  delete (the case id goes into the log row)
 *   --secret / --project / --allow-non-dev   as scripts/db-migrate.js (DATABASE_URL wins when set)
 *
 * What goes: every row in scope (scripts/lib/companyScope.js) - the company's tickets and their children, workflows,
 * roles and assignments, dropdowns, SLA rules, notifications, outbox, invites, participants, links, attachment rows,
 * connections, and the profiles / preferences of people who belong to this company only.
 * What stays (guide §4.5): the companies row as the billing anchor (name, code) with its contact settings cleared and
 * marked inactive; company_subscriptions; contract_acceptances; admin / security logs (own retention).
 * Refuses to apply when another company's rows point at this company's data (cross-company references) - the dry run
 * lists them; or when a kept table's reference can't be cleared (column not nullable).
 * After apply it builds the scope again and expects 0 rows. Prints counts only.
 * Exit: 0 = done / dry run, 1 = error or refused, 2 = bad arguments.
 */

'use strict';

const migrate = require('./db-migrate');
const { strictSsl, redact } = require('../api/_lib/db');
const { buildScope, q } = require('./lib/companyScope');

const CASE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,40}$/;

function parseArgs(argv) {
  const opts = { secret: migrate.DEFAULT_SECRET, project: migrate.DEFAULT_PROJECT, allowNonDev: false, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--company') opts.company = argv[++i];
    else if (a === '--apply') opts.apply = true;
    else if (a === '--case') opts.caseId = argv[++i];
    else if (a === '--secret') opts.secret = argv[++i];
    else if (a === '--project') opts.project = argv[++i];
    else if (a === '--allow-non-dev') opts.allowNonDev = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!opts.company) throw new Error('--company <id> is required');
  if (opts.apply && !CASE_RE.test(opts.caseId || '')) throw new Error('--apply needs --case <case id> (the deletion case record, guide §7)');
  return opts;
}

const affected = r => Number(r.rowCount ?? r.affectedRows ?? 0);

/**
 * @param {Object} client - query(text, params) on one connection
 * @param {{ apply?: boolean, caseId?: string, now?: Date }} options
 * @returns {Promise<{ applied: boolean, counts, deleted?, nulled?, crossCompany, keepRefs, users: number, remaining? }>}
 */
async function runDelete(client, companyId, { apply = false, caseId = '', now = new Date() } = {}) {
  await client.query('begin');
  try {
    const scope = await buildScope(client, companyId);
    const blockedKeep = scope.keepRefs.filter(r => !r.nullable);
    const summary = {
      applied: false, counts: scope.counts, users: scope.users.length,
      crossCompany: scope.crossCompany.map(({ child, col, parent, rows }) => ({ child, col, parent, rows })),
      keepRefs: scope.keepRefs.map(({ child, col, parent, rows, nullable }) => ({ child, col, parent, rows, nullable }))
    };
    if (!apply) {
      await client.query('rollback');
      return summary;
    }
    if (scope.crossCompany.length) throw new Error(`refused: ${scope.crossCompany.length} cross-company reference(s) - see the dry run`);
    if (blockedKeep.length) throw new Error(`refused: kept table reference(s) that can't be cleared: ${blockedKeep.map(r => `${r.child}.${r.col}`).join(', ')}`);

    // Clear kept tables' references first (e.g. companies.drive_connection_id, user_profiles of people in other companies)
    const nulled = {};
    for (const r of scope.keepRefs) {
      const res = await client.query(
        `update ${q(r.child)} set ${q(r.col)} = null where ${q(r.col)} in (select p.${q(r.ref)} from ${q(r.parent)} p ` +
        `where p.ctid in (select rid from _company_scope where tbl = '${r.parent}'))`
      );
      nulled[`${r.child}.${r.col}`] = affected(res);
    }
    const deleted = {};
    for (const t of scope.order) {
      const res = await client.query(`delete from ${q(t)} where ctid in (select rid from _company_scope where tbl = '${t}')`);
      deleted[t] = affected(res);
    }
    // The billing anchor stays; its contact settings go
    const anchorCols = ['email_sender_name', 'email_reply_to', 'email_cc', 'email_footer'].filter(c => scope.columns.companies && scope.columns.companies[c]);
    await client.query(
      `update companies set ${anchorCols.map(c => `${q(c)} = null`).concat(['is_active = false', 'deactivated_at = $2', "deactivation_reason = $3"]).join(', ')} where id = $1`,
      [companyId, now, `data deleted - case ${caseId}`]
    );
    await client.query(
      'insert into admin_action_logs (id, admin_user_id, action_type, target_entity, target_id, details, timestamp) ' +
      "values (gen_random_uuid()::text, 'script:db-delete-company', 'DELETE_COMPANY_DATA', 'company', $1, $2, $3)",
      [companyId, JSON.stringify({ case: caseId, deleted, nulled, users: scope.users.length }), now]
    );
    const after = await buildScope(client, companyId);
    const remaining = Object.values(after.counts).reduce((a, b) => a + b, 0);
    if (remaining !== 0) throw new Error(`check failed: ${remaining} row(s) still in scope after delete - rolled back`);
    await client.query('commit');
    return { ...summary, applied: true, deleted, nulled, remaining };
  } catch (error) {
    try { await client.query('rollback'); } catch (e) { /* already closed */ }
    throw error;
  }
}

async function main(argv) {
  const opts = parseArgs(argv);
  const { url, source } = migrate.resolveConnection(opts);
  const { Client } = require('pg');
  const client = new Client({ connectionString: strictSsl(url), connectionTimeoutMillis: 20000, application_name: 'daloy-db-delete-company' });
  await client.connect();
  console.log(`Connected: ${migrate.describeTarget(url)} (${source}; password hidden)`);
  try {
    const r = await runDelete(migrate.pgAdapter(client), opts.company, { apply: opts.apply, caseId: opts.caseId });
    console.log(r.applied ? `Deleted - company ${opts.company}, case ${opts.caseId}` : `Dry run - company ${opts.company} (nothing changed)`);
    Object.entries(r.applied ? r.deleted : r.counts).forEach(([t, c]) => console.log(`  ${t}: ${c}`));
    console.log(`  people only in this company: ${r.users}`);
    if (r.keepRefs.length) r.keepRefs.forEach(k => console.log(`  kept ${k.child}.${k.col}: ${k.rows} reference(s) ${k.nullable ? 'cleared on apply' : 'BLOCK apply'}`));
    if (r.crossCompany.length) r.crossCompany.forEach(c => console.log(`  CROSS-COMPANY ${c.child}.${c.col} -> ${c.parent}: ${c.rows} row(s) - apply refused`));
    if (r.applied) console.log('  check: 0 rows left in scope');
  } finally {
    await client.end();
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => process.exit(code)).catch(error => {
    console.error(`db-delete-company: ${redact(error.message)}`);
    process.exit(/required|unknown argument|needs --case/.test(error.message) ? 2 : 1);
  });
}

module.exports = { runDelete, parseArgs };
