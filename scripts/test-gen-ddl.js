#!/usr/bin/env node
/**
 * test-gen-ddl.js v1.0 (11 Nov 2026) — offline checks for scripts/gen-ddl.js + scripts/db/ddl-rules.js (step 0.7).
 *
 * Usage:
 *   node scripts/test-gen-ddl.js [APPSCRIPT file]
 *   node scripts/test-gen-ddl.js --pglite <dir> [APPSCRIPT file]
 *        also runs the SQL on a real Postgres engine in memory: @electric-sql/pglite resolved from <dir> (installed
 *        there, NOT a project dependency) - 0001 up twice, preflight, 0002 up twice, a sample row, the downs.
 *
 * Checks: every TABLE_SCHEMAS table and column is in the model in order (+ the extras), the typing rules (is_* boolean,
 * *_at timestamptz, the JSON columns), a primary key per table, every foreign key points at a single-column primary
 * key of the same type, bad rules fail loudly (unknown table / column, duplicate column), the helpers, deterministic
 * output, the committed migrations/postgres files are up to date, one preflight check per foreign key + unique rule.
 * Exit: 0 = all pass, 1 = a case failed.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gen = require('./gen-ddl');
const RULES = require('./db/ddl-rules');

const args = process.argv.slice(2);
const pgliteIdx = args.indexOf('--pglite');
const pgliteDir = pgliteIdx >= 0 ? args.splice(pgliteIdx, 2)[1] : null;
const appscriptFile = args[0] ? path.resolve(args[0]) : gen.newestAppScript();
const OUT_DIR = path.resolve(__dirname, '..', 'migrations', 'postgres');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (err) { results.push([false, name, err]); }
}

const clone = rules => ({ ...rules, ...JSON.parse(JSON.stringify({
  INDEXES: rules.INDEXES, UNIQUES: rules.UNIQUES, FOREIGN_KEYS: rules.FOREIGN_KEYS, NOT_NULL: rules.NOT_NULL,
  EXTRA_COLUMNS: rules.EXTRA_COLUMNS, EXTRA_TABLES: rules.EXTRA_TABLES, PRIMARY_KEYS: rules.PRIMARY_KEYS,
})) });
const baseType = def => def.split(' ')[0];

(async () => {
  const { schemas, model, files } = gen.generate(appscriptFile);
  const col = (t, c) => model.tables[t].columns.find(x => x.name === c);

  await test('every TABLE_SCHEMAS table and column is in the model, in order, plus the extras', () => {
    for (const [table, cols] of Object.entries(schemas)) {
      const t = model.tables[table];
      assert.ok(t, `missing table ${table}`);
      assert.deepStrictEqual(t.columns.slice(0, cols.length).map(c => c.name), cols, table);
      assert.strictEqual(t.columns.length, cols.length + (RULES.EXTRA_COLUMNS[table] || []).length, table);
    }
    assert.strictEqual(Object.keys(model.tables).length,
      Object.keys(schemas).length + Object.keys(RULES.EXTRA_TABLES).length);
  });

  await test('typing rules: is_/require_/enable_ boolean, *_at timestamptz, JSON columns jsonb, a type everywhere', () => {
    for (const [table, t] of Object.entries(model.tables)) {
      for (const c of t.columns) {
        assert.ok(/^(text|boolean|timestamptz|date|integer|bigint|numeric|jsonb|tsvector)\b/.test(c.def), `${table}.${c.name}: ${c.def}`);
        if (/^(is|require|enable)_/.test(c.name)) assert.strictEqual(baseType(c.def), 'boolean', `${table}.${c.name}`);
        if (/_at$/.test(c.name)) assert.strictEqual(baseType(c.def), 'timestamptz', `${table}.${c.name}`);
      }
    }
    for (const [t, c] of [['ticket_action_logs', 'details'], ['ticket_history', 'field_changes'],
      ['sla_escalation_rules', 'notify_role_ids'], ['company_subscriptions', 'feature_overrides'],
      ['country_calendars', 'weekend_days'], ['user_invites', 'role_grants']]) {
      assert.strictEqual(baseType(col(t, c).def), 'jsonb', `${t}.${c}`);
    }
    assert.strictEqual(baseType(col('tickets', 'step_due_date').def), 'timestamptz');
    assert.strictEqual(baseType(col('company_holidays', 'date').def), 'date');
    assert.strictEqual(baseType(col('role_types', 'permission_level').def), 'integer');
    assert.strictEqual(baseType(col('ticket_collaborations', 'permission_level').def), 'text');
    assert.strictEqual(baseType(col('sequence_counters', 'last_number').def), 'bigint');
    assert.ok(col('tickets', 'is_active').def.includes('default true'));
  });

  await test('a primary key per table; its columns are not null', () => {
    for (const [table, t] of Object.entries(model.tables)) {
      assert.ok(t.primaryKey && t.primaryKey.length, table);
      for (const k of t.primaryKey) assert.ok(col(table, k).def.includes('not null'), `${table}.${k}`);
    }
    assert.deepStrictEqual(model.tables.step_approvers.primaryKey, ['step_id', 'role_id']);
    assert.deepStrictEqual(model.tables.comment_requirements.primaryKey, ['id']);
  });

  await test('every foreign key points at a single-column primary key of the same type', () => {
    for (const [table, column, ref, refColumn = 'id'] of RULES.FOREIGN_KEYS) {
      assert.deepStrictEqual(model.tables[ref].primaryKey, [refColumn], `${table}.${column} -> ${ref}`);
      assert.strictEqual(baseType(col(table, column).def), baseType(col(ref, refColumn).def), `${table}.${column}`);
    }
  });

  await test('bad rules fail loudly', () => {
    const cases = [
      [r => r.INDEXES.push(['no_such_table', 'x', '(id)']), /no such table/],
      [r => r.INDEXES.push(['tickets', 'typo', '(company_idd)']), /no column "company_idd"/],
      [r => r.FOREIGN_KEYS.push(['tickets', 'company_id', 'no_such_table']), /no such table/],
      [r => r.FOREIGN_KEYS.push(['tickets', 'company_id', 'tickets', 'ticket_number']), /not the single-column primary key/],
      [r => { r.EXTRA_COLUMNS.tickets.push(['title', 'text']); }, /already exists/],
      [r => { r.NOT_NULL.tickets.push('nope'); }, /NOT_NULL tickets.nope/],
      [r => r.UNIQUES.push(['tickets', 'number', '(ticket_number)']), /appears twice/],
    ];
    for (const [mutate, message] of cases) {
      const rules = clone(RULES);
      mutate(rules);
      assert.throws(() => gen.buildModel(schemas, rules), err => err instanceof gen.DdlError && message.test(err.message), String(message));
    }
    assert.throws(() => gen.buildModel({ t: ['a', 'a'] }, clone(RULES)), /appears twice/);
    assert.throws(() => gen.loadTableSchemas('const X = 1;'), /TABLE_SCHEMAS = \{ not found/);
  });

  await test('helpers: identifiersIn, splitUnique', () => {
    assert.deepStrictEqual(gen.identifiersIn("(coalesce(company_id, ''), lower(name)) where is_active").sort(),
      ['company_id', 'is_active', 'name']);
    assert.deepStrictEqual(gen.identifiersIn('using gin (ticket_number gin_trgm_ops)'), ['ticket_number']);
    assert.deepStrictEqual(gen.identifiersIn("(head_approver_id) where current_step_id = '__head__'").sort(),
      ['current_step_id', 'head_approver_id']);
    assert.deepStrictEqual(gen.splitUnique("(a, coalesce(b, '')) where x and y"), { cols: "a, coalesce(b, '')", where: 'x and y' });
    assert.deepStrictEqual(gen.splitUnique('(a)'), { cols: 'a', where: null });
  });

  await test('output is deterministic and the committed migrations are up to date', () => {
    assert.deepStrictEqual(gen.generate(appscriptFile).files, files);
    for (const [name, text] of Object.entries(files)) {
      const p = path.join(OUT_DIR, name);
      assert.ok(fs.existsSync(p), `${name} missing - run node scripts/gen-ddl.js`);
      assert.strictEqual(fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'), text, `${name} out of date - run node scripts/gen-ddl.js`);
    }
  });

  await test('one create table per table, one preflight check per foreign key + unique rule, no FK in 0001', () => {
    const up = files['0001_initial_schema.up.sql'];
    assert.strictEqual((up.match(/^create table if not exists /gm) || []).length, Object.keys(model.tables).length);
    const code = up.split('\n').filter(l => !l.startsWith('--')).join('\n');
    assert.ok(!/foreign key|references /i.test(code), 'a foreign key in 0001');
    assert.strictEqual((files['0002_constraints.preflight.sql'].match(/as rule,/g) || []).length,
      RULES.FOREIGN_KEYS.length + RULES.UNIQUES.length);
    const code2 = files['0002_constraints.up.sql'].split('\n').filter(l => !l.startsWith('--')).join('\n');
    assert.strictEqual((code2.match(/foreign key/g) || []).length, RULES.FOREIGN_KEYS.length);
  });

  if (pgliteDir) {
    await test('PGlite: 0001 twice, preflight 0, 0002 twice, a sample row, the downs', async () => {
      const { PGlite } = require(require.resolve('@electric-sql/pglite', { paths: [path.resolve(pgliteDir)] }));
      const { pg_trgm } = require(require.resolve('@electric-sql/pglite/contrib/pg_trgm', { paths: [path.resolve(pgliteDir)] }));
      const db = new PGlite({ extensions: { pg_trgm } });
      const run = sql => db.exec(sql.replace(/create extension if not exists pgcrypto;\n/, ''));
      await run(files['0001_initial_schema.up.sql']);
      await run(files['0001_initial_schema.up.sql']);
      const pre = await db.query(files['0002_constraints.preflight.sql']);
      assert.ok(pre.rows.every(r => Number(r.bad_rows) === 0), 'preflight on an empty database');
      await run(files['0002_constraints.up.sql']);
      await run(files['0002_constraints.up.sql']);
      await db.exec(`insert into companies (id, name, code) values ('comp_1', 'Seed', 'SEED');
        insert into ticket_types (id, code, name, company_id) values ('tt_1', 'PR', 'Purchase', 'comp_1');
        insert into tickets (id, ticket_number, title, ticket_type_id, company_id, status)
          values ('1', 'SEED-PR-2026-00000001', 'Laptop', 'tt_1', 'comp_1', 'New');`);
      const hit = await db.query(`select id, version from tickets where search @@ to_tsquery('simple', 'laptop')`);
      assert.deepStrictEqual(hit.rows, [{ id: '1', version: 0 }]);
      await assert.rejects(db.exec(`insert into tickets (id, ticket_number, ticket_type_id, company_id, status)
        values ('2', 'X', 'tt_none', 'comp_1', 'New')`), /foreign key/);
      await run(files['0002_constraints.down.sql']);
      await run(files['0001_initial_schema.down.sql']);
      const left = await db.query(`select count(*)::int as n from information_schema.tables where table_schema = 'public'`);
      assert.strictEqual(left.rows[0].n, 0);
      await db.close();
    });
  }

  let failed = 0;
  for (const [ok, name, err] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) { failed++; console.log(`      ${err && err.message ? err.message.split('\n').join('\n      ') : err}`); }
  }
  console.log(`\n${results.length - failed}/${results.length} passed (${path.basename(appscriptFile)}, ${Object.keys(model.tables).length} tables)`);
  process.exit(failed ? 1 : 0);
})();
