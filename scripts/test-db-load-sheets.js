#!/usr/bin/env node
/**
 * test-db-load-sheets.js v1.0 (14 Nov 2026, migration step 0.8) — offline checks for scripts/db-load-sheets.js.
 *
 * Usage:
 *   node scripts/test-db-load-sheets.js
 *   node scripts/test-db-load-sheets.js --pglite <dir>
 *        also loads a synthetic export into Postgres in memory (@electric-sql/pglite from <dir>, as test-gen-ddl.js):
 *        0001 → check-db (rolled back) → apply → verify → a second apply refused → --replace → 0002 applies cleanly;
 *        a duplicate company code stops the load before anything is written.
 *
 * Checks: the cell conversions (booleans, numbers, date-times incl. the TS_UTC_SINCE -8 h rule and the real-UTC role
 * dates, local date-times, calendar days, JSON text), the skip rules (missing id, shifted column, bad value, conflicting
 * duplicate, exact copy, orphans + the cascade, custom-field entities), the default organization, the console summary
 * without row values, INSERT batching, the repo-path and argument guards.
 * Exit: 0 = all pass, 1 = a case failed.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const gen = require('./gen-ddl');
const L = require('./db-load-sheets');
const migrate = require('./db-migrate');

const args = process.argv.slice(2);
const pgliteIdx = args.indexOf('--pglite');
const pgliteDir = pgliteIdx >= 0 ? args[pgliteIdx + 1] : null;
const { schemas, model } = gen.generate(gen.newestAppScript());
const TZ = 'Asia/Manila';
const CUTOVER = '2026-10-30T00:00:00.000Z';

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (err) { results.push([false, name, err]); }
}

/** A synthetic export: rows given as objects, laid out with the real TABLE_SCHEMAS headers. */
function makeExport(tables, { tsUtcSince = CUTOVER } = {}) {
  const tabs = {};
  for (const [name, rows] of Object.entries(tables)) {
    const headers = schemas[name];
    tabs[name] = { headers, blank_rows: 0, rows: rows.map((r, i) => ({ n: i + 2, v: headers.map(h => (h in r ? r[h] : '')) })) };
  }
  return { meta: { export_version: 1, exported_at: '2026-11-14T14:30:00.000Z', api_version: '10.2.0',
    spreadsheet_time_zone: TZ, ts_utc_since: tsUtcSince, table_schemas: schemas, tabs: [] }, tabs };
}

const holidayCell = { $d: '2026-12-24T16:00:00.000Z', $l: '2026-12-25T00:00:00' };

function sampleExport() {
  return makeExport({
    companies: [
      { id: 'co_1', name: 'Secret Co', code: 'SEC', is_active: true, created_at: '2026-10-01T10:00:00.000Z' },
      { id: 'co_2', name: 'Shifted', code: 'SHF', is_active: '2026-10-01T10:00:00.000Z' },   // a date under is_active
      { id: 'co_3', name: 'Gamma', code: 'GAM', is_active: '' },                           // blank is_active → true
      { id: 'co_4', name: 'Old', code: 'OLD', code_locked: { $d: '2025-09-22T02:00:00.000Z', $l: '2025-09-22T10:00:00' },
        code_locked_at: '2025-09-22T02:00:00.000Z', ticket_count: 7 },                     // pre-v9.1: dates in the lock columns
      { id: 'co_dup', name: 'Copy', code: 'CPY', is_active: 'TRUE' },
      { id: 'co_dup', name: 'Copy', code: 'CPY', is_active: 'TRUE' },                      // exact copy
      { id: 'co_x', name: 'X one', code: 'XO' },
      { id: 'co_x', name: 'X two', code: 'XT' },                                            // same id, other values
      { id: '', name: 'No id', code: 'NOID' }
    ],
    ticket_types: [
      { id: 'tt_1', code: 'PR', name: 'Purchase', company_id: 'co_1', is_active: true },
      { id: 'tt_2', code: 'LV', name: 'Leave', company_id: 'co_2', is_active: true },      // its company is skipped
      { id: 'tt_g', code: 'GL', name: 'Global', company_id: '', is_active: true }
    ],
    workflow_steps: [
      { id: 'ws_1', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Manager', sort_order: 1 },
      { id: 'ws_2', ticket_type_id: 'tt_2', company_id: 'co_1', name: 'HR', sort_order: '1' }
    ],
    custom_fields: [{ id: 'cf_1', ticket_type_id: 'tt_1', name: 'amount', type: 'amount' }],
    tickets: [
      { id: 1, ticket_number: 'SEC-PR-2026-00000001', title: 'Laptop', ticket_type_id: 'tt_1', company_id: 'co_1', status: 'New',
        created_at: '2026-10-01T18:00:00.000Z' },                                          // pre-cutover text: -8 h
      { id: 2, ticket_number: 'SEC-LV-2026-00000001', title: 'Leave', ticket_type_id: 'tt_2', company_id: 'co_1', status: 'New' },
      { id: 3, ticket_number: 'NON-PR-2026-00000001', title: 'Lost', ticket_type_id: 'tt_1', company_id: 'co_none', status: 'New' },
      { id: 4, ticket_number: 'SEC-PR-2026-00000004', title: 'Bad due', ticket_type_id: 'tt_1', company_id: 'co_1', status: 'New',
        step_due_date: 'next week' },
      { id: 5, ticket_number: 'SEC-PR-2026-00000005', title: 'Dated', ticket_type_id: 'tt_1', company_id: 'co_1', status: 'New',
        created_at: { $d: '2026-11-01T02:30:00.000Z', $l: '2026-11-01T10:30:00' } },
      { id: 6, ticket_number: '', title: 'No number', ticket_type_id: 'tt_1', company_id: 'co_1', status: 'New' }
    ],
    ticket_history: [
      { id: 'h1', ticket_id: 1, action: 'created', timestamp: { $d: '2026-11-01T02:30:00.000Z', $l: '2026-11-01T10:30:00' } },
      { id: 'h2', ticket_id: 2, action: 'created' },
      { id: 'h3', ticket_id: 3, action: 'created' },
      { id: 'h4', ticket_id: 1, action: 'approved', field_changes: '{"status":["New","Done"]}' }
    ],
    custom_field_values: [
      { id: 'v1', ticket_id: 1, entity_category: 'ticket', custom_field_id: 'cf_1', number_value: '1500.50' },
      { id: 'v2', ticket_id: 2, entity_category: '', custom_field_id: 'cf_1', number_value: 3 },
      { id: 'v3', ticket_id: 'r_none', entity_category: 'role', custom_field_id: 'cf_1', text_value: 'x' }
    ],
    company_holidays: [
      { id: 'hd1', company_id: 'co_1', date: holidayCell, name: 'Christmas' },
      { id: 'hd2', company_id: 'co_1', date: "'2026-06-12", name: 'Independence Day' },
      { id: 'hd3', company_id: 'co_1', date: '2026-02-30', name: 'Not a day' }
    ],
    admin_action_logs: [
      { id: 'a1', action_type: 'USER_LOGIN', details: 'User logged in', timestamp: '2026-09-01T08:00:00.000Z' },
      { id: 'a2', action_type: 'UPDATE', details: '{"field":"name"}', timestamp: '2026-11-02T08:00:00.000Z' }
    ],
    user_role_assignments: [
      { id: 'ura1', user_id: 'u1', role_id: '', company_id: 'co_1', effective_start_date: '2026-10-01T00:00:00.000Z' }
    ],
    not_a_table: [],
  });
}

// makeExport lays rows out by TABLE_SCHEMAS; an unknown tab needs its own headers
function withExtraTab(data) {
  data.tabs.not_a_table = { headers: ['a'], rows: [], blank_rows: 0 };
  return data;
}

(async () => {
  const env = { timeZone: TZ, cutoverMs: Date.parse(CUTOVER), note: () => {} };

  await test('convertCell: booleans, whole numbers, amounts, blanks', () => {
    const c = (type, raw) => L.convertCell(type, raw, env);
    assert.deepStrictEqual([c('boolean', true), c('boolean', 'FALSE'), c('boolean', 'yes'), c('boolean', 1)].map(r => r.value), [true, false, true, true]);
    assert.match(c('boolean', '2026-10-01').error, /not true \/ false/);
    assert.strictEqual(c('integer', '12').value, 12);
    assert.match(c('integer', 1.5).error, /whole number/);
    assert.strictEqual(c('numeric', '1500.50').value, 1500.5);
    assert.match(c('numeric', 'ten').error, /not a number/);
    assert.strictEqual(c('text', 7).value, '7');
    assert.strictEqual(c('integer', '  ').value, null);
    assert.match(c('text', { odd: 1 }).error, /unexpected value/);
  });

  await test('convertCell: date-times - date cells as is, pre-cutover text -8 h (not role dates), local text in the zone', () => {
    const notes = [];
    const e = { ...env, note: k => notes.push(k) };
    assert.strictEqual(L.convertCell('timestamptz', { $d: '2026-01-01T00:00:00.000Z', $l: 'x' }, e).value, '2026-01-01T00:00:00.000Z');
    assert.strictEqual(L.convertCell('timestamptz', '2026-10-01T18:00:00.000Z', e).value, '2026-10-01T10:00:00.000Z');
    assert.strictEqual(L.convertCell('timestamptz', '2026-11-01T18:00:00.000Z', e).value, '2026-11-01T18:00:00.000Z', 'after the cutover');
    assert.strictEqual(L.convertCell('timestamptz', '2026-10-01T18:00:00.000Z', { ...e, realUtc: true }).value, '2026-10-01T18:00:00.000Z');
    assert.strictEqual(L.convertCell('timestamptz', '2026-10-01T18:00:00.000Z', { ...e, cutoverMs: null }).value, '2026-10-01T18:00:00.000Z');
    assert.strictEqual(L.convertCell('timestamptz', '2026-11-14 08:00', e).value, '2026-11-14T00:00:00.000Z', 'Manila local');
    assert.match(L.convertCell('timestamptz', 'next week', e).error, /not a date-time/);
    assert.match(L.convertCell('timestamptz', 45231, e).error, /not a date-time/);
    assert.deepStrictEqual(notes, ['shifted']);
  });

  await test('convertCell: calendar days (date cell local day, apostrophe text, ISO instant → local day, impossible days) and JSON', () => {
    assert.strictEqual(L.convertCell('date', holidayCell, env).value, '2026-12-25');
    assert.strictEqual(L.convertCell('date', "'2026-06-12", env).value, '2026-06-12');
    assert.strictEqual(L.convertCell('date', '2026-12-24T16:00:00.000Z', env).value, '2026-12-25');
    assert.match(L.convertCell('date', '2026-02-30', env).error, /not a date/);
    const notes = [];
    assert.strictEqual(L.convertCell('jsonb', '{"a":1}', { ...env, note: k => notes.push(k) }).value, '{"a":1}');
    assert.strictEqual(L.convertCell('jsonb', 'plain words', { ...env, note: k => notes.push(k) }).value, '"plain words"');
    assert.deepStrictEqual(notes, ['json_text']);
    assert.strictEqual(L.localToUtcIso('2026-02-29', 'UTC'), null);
  });

  const plan = L.buildLoadPlan(withExtraTab(sampleExport()), model);
  const ids = table => plan.tables[table].rows.map(r => String(r.record.id));
  const skippedIds = table => plan.skipped.filter(s => s.table === table).map(s => s.id);

  await test('plan: companies - shifted column, conflicting duplicate and missing id skipped; exact copy kept once; blank is_active = true', () => {
    assert.deepStrictEqual(ids('companies'), ['co_1', 'co_3', 'co_4', 'co_dup']);
    assert.deepStrictEqual(skippedIds('companies').sort(), [null, 'co_2', 'co_x', 'co_x'].sort());
    assert.strictEqual(plan.tables.companies.info.duplicate_copies_dropped, 1);
    assert.strictEqual(plan.tables.companies.rows.find(r => r.record.id === 'co_3').record.is_active, true);
    assert.ok(plan.tables.companies.rows.every(r => r.record.organization_id === 'org_default'), 'default organization');
    assert.deepStrictEqual(plan.tables.organizations.rows.map(r => r.record), [L.DEFAULT_ORG]);
  });

  await test('plan: repairCompanyLocks on the copy - pre-v9.1 lock dates cleared, ticket_count recounted, companies with tickets locked', () => {
    const company = id => plan.tables.companies.rows.find(r => r.record.id === id).record;
    const old = company('co_4');
    assert.deepStrictEqual([old.code_locked, old.code_locked_at, old.ticket_count], [false, null, 0]);
    const co1 = company('co_1');
    assert.deepStrictEqual([co1.ticket_count, co1.code_locked, co1.code_locked_at, co1.code_locked_reason],
      [2, true, '2026-10-01T10:00:00.000Z', 'first_ticket_created (repair)'], 'tickets 1 + 5; the first one sets the lock time');
    const info = plan.tables.companies.info;
    assert.deepStrictEqual([info.repaired_code_locked, info.locked_by_repair], [1, 1]);
    assert.ok(['ticket_count', 'code_locked', 'code_locked_at', 'code_locked_reason'].every(c => plan.tables.companies.columns.includes(c)));
    assert.match(L.formatSummary(plan), /code_locked repaired \(pre-v9\.1 date\) 1/);
  });

  await test('plan: the cascade - a skipped company takes its ticket type, step, tickets, history and custom-field values', () => {
    assert.deepStrictEqual(ids('ticket_types'), ['tt_1', 'tt_g']);
    assert.deepStrictEqual(ids('workflow_steps'), ['ws_1']);
    assert.deepStrictEqual(ids('tickets'), ['1', '5']);
    assert.deepStrictEqual(skippedIds('tickets').sort(), ['2', '3', '4', '6']);
    assert.deepStrictEqual(ids('ticket_history'), ['h1', 'h4']);
    assert.deepStrictEqual(ids('custom_field_values'), ['v1']);
    const v3 = plan.skipped.find(s => s.id === 'v3');
    assert.match(v3.reason, /roles "r_none" not found .*entity role/);
    assert.match(plan.skipped.find(s => s.table === 'tickets' && s.id === '6').reason, /ticket_number: required value missing/);
  });

  await test('plan: conversions land in the records (-8 h, date cells, JSON text, role dates untouched, calendar days)', () => {
    const t1 = plan.tables.tickets.rows.find(r => r.record.id === '1').record;
    assert.strictEqual(t1.created_at, '2026-10-01T10:00:00.000Z');
    assert.strictEqual(plan.tables.tickets.info.shifted_timestamps.created_at, 1);
    assert.strictEqual(plan.tables.tickets.rows.find(r => r.record.id === '5').record.created_at, '2026-11-01T02:30:00.000Z');
    assert.deepStrictEqual(plan.tables.company_holidays.rows.map(r => r.record.date), ['2026-12-25', '2026-06-12']);
    assert.deepStrictEqual(skippedIds('company_holidays'), ['hd3']);
    const logs = plan.tables.admin_action_logs.rows.map(r => r.record);
    assert.deepStrictEqual(logs.map(r => r.details), ['"User logged in"', '{"field":"name"}']);
    assert.strictEqual(logs[0].timestamp, '2026-09-01T00:00:00.000Z', 'pre-cutover log time -8 h');
    assert.strictEqual(plan.tables.user_role_assignments.rows[0].record.effective_start_date, '2026-10-01T00:00:00.000Z', 'role date not shifted');
    assert.strictEqual(plan.tables.custom_field_values.rows[0].record.number_value, 1500.5);
  });

  await test('plan: meta - unknown tabs listed, totals add up; tables without a tab are noted', () => {
    assert.deepStrictEqual(plan.meta.ignored_tabs, ['not_a_table']);
    assert.strictEqual(plan.meta.copied, Object.values(plan.tables).reduce((s, t) => s + t.rows.length, 0));
    assert.strictEqual(plan.meta.skipped, plan.skipped.length);
    assert.strictEqual(plan.tables.ticket_links.info.tab_found, false);
  });

  await test('summary + reasonKind: counts and reasons, never a row value or id', () => {
    const text = L.formatSummary(plan);
    for (const secret of ['Secret Co', 'Laptop', 'r_none', 'co_none', 'next week', '2026-02-30', 'X two']) {
      assert.ok(!text.includes(secret), `summary shows "${secret}"`);
    }
    assert.match(text, /companies: is_active: not true \/ false/);
    assert.match(text, /tickets: company_id → companies not found/);
    assert.strictEqual(L.reasonKind('step_due_date: not a date-time: "next week"'), 'step_due_date: not a date-time');
  });

  await test('insertStatements: batches stay under the parameter limit, every row once', () => {
    const entry = { columns: ['a', 'b', 'c'], rows: Array.from({ length: 25000 }, (_, i) => ({ record: { a: i, b: 'x', c: null } })) };
    const statements = L.insertStatements('t', entry);
    assert.ok(statements.length > 1);
    assert.ok(statements.every(s => s.params.length <= 30000));
    assert.strictEqual(statements.reduce((n, s) => n + s.params.length, 0), 75000);
    assert.match(statements[0].text, /^insert into "t" \("a", "b", "c"\) values \(\$1, \$2, \$3\), /);
  });

  await test('guards: the export must be outside the repo; --replace needs --yes, a mode, and dev', () => {
    assert.strictEqual(L.outsideRepo(path.join(__dirname, '..', 'export.json')), false);
    assert.strictEqual(L.outsideRepo(path.join(__dirname, '..', '..', 'export.json')), true);
    assert.throws(() => L.parseArgs([]), /usage/);
    assert.throws(() => L.parseArgs(['x.json', '--apply', '--replace']), /add --yes/);
    assert.throws(() => L.parseArgs(['x.json', '--replace', '--yes']), /goes with --apply/);
    assert.throws(() => L.parseArgs(['x.json', '--apply', '--replace', '--yes', '--allow-non-dev']), /dev databases only/);
    assert.strictEqual(L.parseArgs(['x.json', '--check-db']).mode, 'check-db');
    assert.throws(() => L.buildLoadPlan({ meta: {}, tabs: {} }, model), /not a daloy export/);
  });

  if (pgliteDir) {
    await test('PGlite: 0001, check-db rolls back, apply + verify, second apply refused, --replace, 0002 applies; a duplicate code stops the load', async () => {
      const from = path.resolve(pgliteDir);
      const { PGlite } = require(require.resolve('@electric-sql/pglite', { paths: [from] }));
      const { pg_trgm } = require(require.resolve('@electric-sql/pglite/contrib/pg_trgm', { paths: [from] }));
      const db = new PGlite({ extensions: { pg_trgm } });
      const client = {
        query: (text, params) => db.query(text, params),
        exec: text => db.exec(text.replace(/create extension if not exists pgcrypto;\r?\n/, ''))
      };
      const silent = () => {};
      const migrations = migrate.listMigrations();
      await migrate.runCommand(client, migrations, { command: 'up', to: '0001', out: silent });
      const count = async t => Number((await db.query(`select count(*)::int as n from "${t}"`)).rows[0].n);

      const checked = await L.applyPlan(client, plan, { commit: false, out: silent });
      assert.deepStrictEqual(checked.preflight, []);
      assert.strictEqual(await count('companies'), 0, 'check-db rolled back');

      await L.applyPlan(client, plan, { out: silent });
      assert.strictEqual(await count('companies'), 4);
      const locked = (await db.query(`select code_locked, ticket_count from companies where id = 'co_1'`)).rows[0];
      assert.deepStrictEqual([locked.code_locked, locked.ticket_count], [true, 2]);
      assert.strictEqual(await count('organizations'), 1);
      const verify = await L.verifyLoad(client, plan);
      assert.ok(verify.ok, verify.problems.join('; '));
      assert.deepStrictEqual(verify.sample_tickets, ['1', '5']);
      const t1 = (await db.query(`select created_at, version, search is not null as has_search from tickets where id = '1'`)).rows[0];
      assert.strictEqual(new Date(t1.created_at).toISOString(), '2026-10-01T10:00:00.000Z');
      assert.strictEqual(t1.version, 0);
      const log = (await db.query(`select details from admin_action_logs where id = 'a1'`)).rows[0];
      assert.strictEqual(log.details, 'User logged in', 'plain text kept as a JSON string');

      await assert.rejects(L.applyPlan(client, plan, { out: silent }), /already have rows/);
      await L.applyPlan(client, plan, { replace: true, out: silent });
      assert.strictEqual(await count('tickets'), 2, '--replace: same rows, no doubles');

      const done = await migrate.runCommand(client, migrations, { command: 'up', out: silent });
      assert.deepStrictEqual(done.applied, ['0002'], '0002 applies on the loaded data');

      // A fresh database: two active companies with the same code fail the 0002 preflight - nothing is loaded
      const db2 = new PGlite({ extensions: { pg_trgm } });
      const client2 = { query: (t, p) => db2.query(t, p), exec: t => db2.exec(t.replace(/create extension if not exists pgcrypto;\r?\n/, '')) };
      await migrate.runCommand(client2, migrations, { command: 'up', to: '0001', out: silent });
      const clash = L.buildLoadPlan(makeExport({ companies: [
        { id: 'c1', name: 'One', code: 'SAME', is_active: true }, { id: 'c2', name: 'Two', code: 'same', is_active: true }] }), model);
      await assert.rejects(L.applyPlan(client2, clash, { out: silent }), /preflight found bad rows .*uq_companies_code: 1/);
      assert.strictEqual(Number((await db2.query('select count(*)::int as n from companies')).rows[0].n), 0);
      await db.close();
      await db2.close();
    });
  }

  let failed = 0;
  for (const [ok, name, err] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) { failed++; console.log(`      ${err && err.message ? err.message.split('\n').join('\n      ') : err}`); }
  }
  console.log(`\n${results.length - failed}/${results.length} passed${pgliteDir ? ' (with PGlite)' : ''}`);
  process.exit(failed ? 1 : 0);
})();
