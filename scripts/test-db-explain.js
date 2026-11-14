#!/usr/bin/env node
/**
 * test-db-explain.js - tests for scripts/db-explain.js (hot-path EXPLAIN gate).
 *
 *   node scripts/test-db-explain.js                 every expected index exists in migrations/postgres; formatting
 *   node scripts/test-db-explain.js --pglite <dir>  also: 0001 + 0002 on Postgres in memory, every hot path uses its
 *                                                   index at scale (@electric-sql/pglite resolved from <dir>)
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('./db-explain');
const m = require('./db-migrate');

const args = process.argv.slice(2);
const pgliteIdx = args.indexOf('--pglite');
const pgliteDir = pgliteIdx >= 0 ? args[pgliteIdx + 1] : null;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (err) { results.push([false, name, err]); }
}

(async () => {
  const dir = path.join(__dirname, '..', 'migrations', 'postgres');
  const sql = ['0001_initial_schema.up.sql', '0002_constraints.up.sql'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

  await test('every expected index is created by 0001 / 0002 (a renamed index fails here, not on Neon)', () => {
    const names = new Set([...sql.matchAll(/(?:index if not exists|constraint) "([a-z0-9_]+)"/g)].map(x => x[1]));
    const missing = E.HOT_PATHS.flatMap(p => p.expect).filter(i => !names.has(i));
    assert.deepStrictEqual(missing, []);
  });

  await test('hot paths use made-up ids only and are reads', () => {
    for (const p of E.HOT_PATHS) {
      assert.match(p.sql, /^select /, p.name);
      assert.doesNotMatch(p.sql, /\$\d/, `${p.name}: literals, not parameters (EXPLAIN text must be self-contained)`);
    }
    assert.strictEqual(new Set(E.HOT_PATHS.map(p => p.name)).size, E.HOT_PATHS.length, 'unique names');
  });

  await test('summary + markdown: ok / alt / FAIL; FAIL names the whole-table read, alt lists the index used', () => {
    const fake = [
      { name: 'a', action: 'x', expect: ['idx_a'], sql: 'select 1', scalePlan: 'Index Scan using idx_a on t', todayPlan: 'Seq Scan on t\nExecution Time: 0.012 ms',
        missing: [], seqScans: [], status: 'ok', execution_ms: 0.012 },
      { name: 'b', action: 'y', expect: ['idx_b'], sql: 'select 2', scalePlan: 'Seq Scan on t', todayPlan: 'Seq Scan on t',
        missing: ['idx_b'], seqScans: ['t'], status: 'FAIL', execution_ms: null },
      { name: 'c', action: 'z', expect: ['idx_c'], sql: 'select 3', scalePlan: 'Index Scan using uq_t_other on t', todayPlan: 'Seq Scan on t',
        missing: ['idx_c'], seqScans: [], status: 'alt', execution_ms: null }
    ];
    const s = E.formatSummary(fake);
    assert.match(s, /FAIL {2}b .*full read of: t/);
    assert.match(s, /alt {3}c .*another index for: idx_c/);
    assert.match(s, /2\/3 hot paths can use an index at scale \(1 chose another/);
    const md = E.formatMarkdown(fake, { date: '2026-11-15', target: 'test', counts: 'tickets 0' });
    assert.match(md, /\| 1 \| a \| `x` \| `idx_a` \| ok \| Seq Scan on t \| 0\.012 \|/);
    assert.match(md, /\| 2 \| b .*\*\*FAIL\*\*/);
    assert.match(md, /\*\*c\*\*: named `idx_c`; the planner used `uq_t_other`/);
    assert.strictEqual(E.topNode('Limit\n  ->  Index Scan'), 'Limit');
  });

  await test('parseArgs: options, unknown option refused', () => {
    assert.deepStrictEqual(E.parseArgs(['--no-write', '--out', 'x.md']).write, false);
    assert.throws(() => E.parseArgs(['--bogus']), /unknown option/);
  });

  if (pgliteDir) {
    await test('PGlite: 0001 + 0002, every hot path uses its index at scale; the transaction is rolled back', async () => {
      const from = path.resolve(pgliteDir);
      const { PGlite } = require(require.resolve('@electric-sql/pglite', { paths: [from] }));
      const { pg_trgm } = require(require.resolve('@electric-sql/pglite/contrib/pg_trgm', { paths: [from] }));
      const db = new PGlite({ extensions: { pg_trgm } });
      const client = {
        query: (text, params) => db.query(text, params),
        exec: text => db.exec(text.replace(/create extension if not exists pgcrypto;\r?\n/, ''))
      };
      await m.runCommand(client, m.listMigrations(), { command: 'up', out: () => {} });
      const out = await E.runExplain(client);
      const failed = out.filter(r => r.status === 'FAIL').map(r => `${r.name}: full read of ${r.seqScans.join(', ')}\n${r.scalePlan}`);
      assert.deepStrictEqual(failed, []);
      assert.ok(out.filter(r => r.status === 'ok').length >= out.length / 2, 'most paths use the index named for them');
      assert.ok(out.every(r => r.execution_ms !== null), 'ANALYZE gave an execution time');
      const setting = (await db.query('show enable_seqscan')).rows[0].enable_seqscan;
      assert.strictEqual(setting, 'on', 'set local ended with the rollback');
    });
  }

  let failed = 0;
  for (const [ok, name, err] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) { failed += 1; console.log(`      ${String(err && err.message).split('\n').join('\n      ')}`); }
  }
  console.log(`\n${results.length - failed}/${results.length} passed${pgliteDir ? ' (with PGlite)' : ''}`);
  process.exit(failed ? 1 : 0);
})();
