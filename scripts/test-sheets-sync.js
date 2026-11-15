#!/usr/bin/env node
/**
 * test-sheets-sync.js - scripts/lib/sheetsSync.js (migration 1.1, the write half) on real Postgres in memory.
 * Usage: node scripts/test-sheets-sync.js --pglite <dir>   (<dir> has @electric-sql/pglite - not a project dependency)
 * Without --pglite only the offline cases run. Exit 0 = pass.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gen = require('./gen-ddl');
const RULES = require('./db/ddl-rules');
const m = require('./db-migrate');
const L = require('./db-load-sheets');
const S = require('./lib/sheetsExport');
const { syncPlan, stableSurrogates, upsertStatements } = require('./lib/sheetsSync');

const args = process.argv.slice(2);
const pgliteDir = args.indexOf('--pglite') >= 0 ? args[args.indexOf('--pglite') + 1] : null;
const schemas = gen.loadTableSchemas(fs.readFileSync(gen.newestAppScript(), 'utf8'));
const model = gen.buildModel(schemas, RULES);

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`); } catch (e) { results.push(`FAIL  ${name}\n      ${String(e.message || e).split('\n').filter(Boolean).slice(0, 12).join('\n      ')}`); process.exitCode = 1; }
}
const cell = v => (typeof v === 'boolean' ? { effectiveValue: { boolValue: v } } : typeof v === 'number' ? { effectiveValue: { numberValue: v } }
  : v === '' ? {} : { effectiveValue: { stringValue: v } });
const sheet = (title, rows) => ({ properties: { title }, data: [{ rowData: rows.map(r => ({ values: r.map(cell) })) }] });

/** A small Sheet: companies, ticket types, tickets, comment requirements (no id in the Sheet). */
function planFor({ companies, tickets, requirements = [['tt1', true]] }) {
  const ss = {
    properties: { timeZone: 'Asia/Manila' },
    sheets: [
      sheet('companies', [['id', 'name', 'code', 'is_active'], ...companies]),
      sheet('ticket_types', [['id', 'name', 'code', 'company_id', 'is_active'], ['tt1', 'Leave', 'LV', 'c1', true]]),
      sheet('tickets', [['id', 'ticket_number', 'title', 'ticket_type_id', 'status', 'company_id'], ...tickets]),
      sheet('comment_requirements', [['ticket_type_id', 'require_on_approve'], ...requirements])
    ]
  };
  const e = S.exportFromSpreadsheet(ss, { tsUtcSince: '2026-10-31T08:13:50.821Z', tableSchemas: schemas });
  return stableSurrogates(L.buildLoadPlan(e, model), model, schemas);
}
const TICKETS = [['t1', 'ACME-LV-2026-00000001', 'Leave Dec', 'tt1', 'open', 'c1'], ['t2', 'ACME-LV-2026-00000002', 'Leave Jan', 'tt1', 'open', 'c1']];
const COMPANIES = [['c1', 'Acme', 'ACME', true], ['c2', 'Beta', 'BETA', true]];

(async () => {
  await test('stable ids: the same row gets the same surrogate id on every run; a changed row a new one', async () => {
    const a = planFor({ companies: COMPANIES, tickets: TICKETS }).tables.comment_requirements.rows[0].record.id;
    const b = planFor({ companies: COMPANIES, tickets: TICKETS }).tables.comment_requirements.rows[0].record.id;
    const c = planFor({ companies: COMPANIES, tickets: TICKETS, requirements: [['tt1', false]] }).tables.comment_requirements.rows[0].record.id;
    assert.ok(a && a === b && a !== c, `${a} ${b} ${c}`);
    const two = planFor({ companies: COMPANIES, tickets: TICKETS, requirements: [['tt1', true], ['tt1', true]] }).tables.comment_requirements.rows;
    assert.ok(two.length < 2 || two[0].record.id !== two[1].record.id, 'identical rows do not collide');
  });

  await test('upsert statement: updates only when a value differs; key-only tables do nothing on conflict', async () => {
    const s = upsertStatements('companies', { columns: ['id', 'name'], rows: [{ record: { id: 'c1', name: 'A' } }] }, ['id'])[0];
    assert.match(s.text, /on conflict \("id"\) do update set "name" = excluded\."name" where \(t\."name"\) is distinct from/);
    const k = upsertStatements('step_approvers', { columns: ['step_id', 'role_id'], rows: [{ record: { step_id: 's', role_id: 'r' } }] }, ['step_id', 'role_id'])[0];
    assert.match(k.text, /do nothing/);
  });

  if (pgliteDir) {
    const from = path.resolve(pgliteDir);
    const { PGlite } = require(require.resolve('@electric-sql/pglite', { paths: [from] }));
    const { pg_trgm } = require(require.resolve('@electric-sql/pglite/contrib/pg_trgm', { paths: [from] }));
    const pg = new PGlite({ extensions: { pg_trgm } });
    const client = { query: (t, p) => pg.query(t, p), exec: t => pg.exec(t.replace(/create extension if not exists pgcrypto;\r?\n/, '')) };
    await m.runCommand(client, m.listMigrations(), { command: 'up', out: () => {} });
    const count = async t => (await pg.query(`select count(*)::int as n from "${t}"`)).rows[0].n;

    await test('first run: dry run changes nothing; apply inserts in foreign-key order with the constraints on', async () => {
      const plan = planFor({ companies: COMPANIES, tickets: TICKETS });
      const dry = await syncPlan(client, plan, model);
      assert.strictEqual(dry.applied, false);
      assert.strictEqual(await count('tickets'), 0);
      const r = await syncPlan(client, plan, model, { apply: true });
      assert.deepStrictEqual([r.tables.companies.inserted, r.tables.tickets.inserted, r.tables.comment_requirements.inserted], [2, 2, 1]);
      assert.strictEqual(await count('tickets'), 2);
      assert.strictEqual((await pg.query("select organization_id from companies where id = 'c1'")).rows[0].organization_id, 'org_default');
    });

    await test('second run with the same Sheet: nothing inserted, updated or removed', async () => {
      const r = await syncPlan(client, planFor({ companies: COMPANIES, tickets: TICKETS }), model, { apply: true });
      const moved = Object.entries(r.tables).filter(([, s]) => s.inserted || s.updated || s.deleted).map(([t, s]) => `${t} +${s.inserted} ~${s.updated} -${s.deleted}`);
      assert.deepStrictEqual(moved, []);
    });

    await test('a row with an old random id (the one-time 0.8 load) is replaced by its stable id without a unique clash', async () => {
      await pg.query("update comment_requirements set id = 'cr_00000000000000000000000000000000'");
      const r = await syncPlan(client, planFor({ companies: COMPANIES, tickets: TICKETS }), model, { apply: true });
      assert.deepStrictEqual([r.tables.comment_requirements.inserted, r.tables.comment_requirements.deleted], [1, 1]);
      assert.strictEqual(await count('comment_requirements'), 1);
      const again = await syncPlan(client, planFor({ companies: COMPANIES, tickets: TICKETS }), model, { apply: true });
      assert.deepStrictEqual([again.totals.inserted, again.totals.updated, again.totals.deleted], [0, 0, 0]);
    });

    await test('an edit, a new row and a removed row: exactly those change; rows the Sheet does not own stay', async () => {
      await pg.query("insert into privacy_acknowledgements (user_id, version) values ('u1', 'v1')");
      const tickets = [['t1', 'ACME-LV-2026-00000001', 'Leave Dec (moved)', 'tt1', 'open', 'c1'], ['t3', 'ACME-LV-2026-00000003', 'Leave Feb', 'tt1', 'open', 'c1']];
      const r = await syncPlan(client, planFor({ companies: COMPANIES, tickets }), model, { apply: true });
      assert.deepStrictEqual([r.tables.tickets.inserted, r.tables.tickets.updated, r.tables.tickets.deleted], [1, 1, 1]);
      assert.strictEqual((await pg.query("select title from tickets where id = 't1'")).rows[0].title, 'Leave Dec (moved)');
      assert.strictEqual(await count('privacy_acknowledgements'), 1);
    });

    await test('a bad read is refused: a table losing most of its rows rolls the whole run back', async () => {
      const many = Array.from({ length: 12 }, (_, i) => [`m${i}`, `ACME-LV-2026-1${String(i).padStart(7, '0')}`, 'x', 'tt1', 'open', 'c1']);
      await syncPlan(client, planFor({ companies: COMPANIES, tickets: many }), model, { apply: true, allowShrink: true });
      assert.strictEqual(await count('tickets'), 12);
      await assert.rejects(syncPlan(client, planFor({ companies: [...COMPANIES, ['c3', 'Gamma', 'GAMMA', true]], tickets: many.slice(0, 2) }), model, { apply: true }), /refused: tickets would lose 10 of 12/);
      assert.strictEqual(await count('tickets'), 12, 'rolled back');
      assert.strictEqual(await count('companies'), 2, 'the new company was rolled back too');
      const ok = await syncPlan(client, planFor({ companies: COMPANIES, tickets: many.slice(0, 2) }), model, { apply: true, allowShrink: true });
      assert.strictEqual(ok.tables.tickets.deleted, 10);
    });

    await test('a tab missing from the read deletes nothing in that table', async () => {
      const plan = planFor({ companies: COMPANIES, tickets: [] });
      plan.tables.tickets.info.tab_found = false;
      const r = await syncPlan(client, plan, model, { apply: true });
      assert.strictEqual(r.tables.tickets.deleted, 0);
      assert.strictEqual(await count('tickets'), 2);
    });
    await pg.close();
  }

  console.log(results.join('\n'));
  console.log(process.exitCode ? 'sheets-sync test FAILED' : `sheets-sync test OK (${results.length} cases${pgliteDir ? ', with PGlite' : ' - offline only'})`);
})();
