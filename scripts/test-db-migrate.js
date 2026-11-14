#!/usr/bin/env node
/**
 * test-db-migrate.js v1.0 (14 Nov 2026, migration step 0.6) — offline checks for scripts/db-migrate.js.
 *
 * Usage:
 *   node scripts/test-db-migrate.js
 *   node scripts/test-db-migrate.js --pglite <dir>
 *        also runs the real migrations/postgres files on Postgres in memory: @electric-sql/pglite resolved from <dir>
 *        (installed there, NOT a project dependency - as scripts/test-gen-ddl.js)
 *
 * Checks: the folder listing, CRLF-proof checksums, the plan (pending, --to, checksum mismatch, missing file, out of
 * order), the preflight gate, a failed migration rolls back without a schema_migrations row, status writes nothing,
 * --down only the newest, the dev-only secret rule, the fixed gcloud arguments, no connection string in any output.
 * Exit: 0 = all pass, 1 = a case failed.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const m = require('./db-migrate');
const { redact, strictSsl } = require('../api/_lib/db');

const args = process.argv.slice(2);
const pgliteIdx = args.indexOf('--pglite');
const pgliteDir = pgliteIdx >= 0 ? args[pgliteIdx + 1] : null;
const SECRET_URL = 'postgresql://neondb_owner:sup3r-secret-pw@ep-x.ap-southeast-1.aws.neon.tech/daloy?sslmode=require';

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (err) { results.push([false, name, err]); }
}

/** Synthetic migrations (no files). */
function fakeMigrations() {
  const mk = (version, name, sql, extra = {}) => ({ version, name, file: `${version}_${name}.up.sql`, sql,
    checksum: m.checksum(sql), downSql: `-- down ${version}`, preflightSql: null, ...extra });
  return [
    mk('0001', 'initial_schema', '-- up 0001'),
    mk('0002', 'constraints', '-- up 0002', { preflightSql: '-- preflight 0002' })
  ];
}

/** A client that understands only the runner's own statements and records everything. */
function fakeClient({ applied = [], preflightRows = [], failOn = null } = {}) {
  const state = { tableExists: applied.length > 0, applied: applied.map(r => ({ ...r })), log: [] };
  return {
    state,
    async query(text, params) {
      state.log.push(['query', text, params]);
      if (/pg_advisory_(un)?lock/.test(text)) return { rows: [] };
      if (/to_regclass\('public\.schema_migrations'\)/.test(text)) return { rows: [{ present: state.tableExists }] };
      if (/^select version, name, checksum/.test(text)) return { rows: state.applied.slice() };
      if (/^insert into schema_migrations/.test(text)) {
        state.pendingInsert = { version: params[0], name: params[1], checksum: params[2] };
        return { rows: [] };
      }
      if (/^delete from schema_migrations/.test(text)) {
        state.pendingDelete = params[0];
        return { rows: [] };
      }
      if (/^-- preflight/.test(text)) return { rows: preflightRows };
      throw new Error(`fake client: unexpected query ${text}`);
    },
    async exec(text) {
      state.log.push(['exec', text]);
      if (text === m.TRACKING_DDL) { state.tableExists = true; return; }
      if (text === 'begin') { state.inTx = true; state.pendingInsert = null; state.pendingDelete = null; return; }
      if (text === 'commit') {
        if (state.pendingInsert) state.applied.push(state.pendingInsert);
        if (state.pendingDelete) state.applied = state.applied.filter(r => r.version !== state.pendingDelete);
        state.inTx = false;
        return;
      }
      if (text === 'rollback') { state.inTx = false; state.pendingInsert = null; state.pendingDelete = null; state.rolledBack = true; return; }
      if (failOn && text.includes(failOn)) throw new Error('syntax error at or near "boom"');
    }
  };
}

const silent = () => {};

(async () => {
  await test('listMigrations: the repo folder has 0001 + 0002, 0002 has a preflight, both have a down', () => {
    const list = m.listMigrations();
    assert.deepStrictEqual(list.map(x => x.version), ['0001', '0002']);
    assert.strictEqual(list[0].name, 'initial_schema');
    assert.ok(list[1].preflightSql && !list[0].preflightSql);
    assert.ok(list.every(x => x.downSql));
    assert.ok(list.every(x => /^[0-9a-f]{64}$/.test(x.checksum)));
  });

  await test('checksum: CRLF and LF give the same value; any other change does not', () => {
    assert.strictEqual(m.checksum('a;\nb;\n'), m.checksum('a;\r\nb;\r\n'));
    assert.notStrictEqual(m.checksum('a;\nb;\n'), m.checksum('a;\nb; \n'));
  });

  await test('plan: fresh database -> both pending; --to 0001 -> only 0001; 0001 applied -> only 0002', () => {
    const list = fakeMigrations();
    assert.deepStrictEqual(m.planMigrations(list, []).pending.map(x => x.version), ['0001', '0002']);
    assert.deepStrictEqual(m.planMigrations(list, [], { to: '0001' }).pending.map(x => x.version), ['0001']);
    const applied = [{ version: '0001', checksum: list[0].checksum }];
    const plan = m.planMigrations(list, applied);
    assert.deepStrictEqual(plan.pending.map(x => x.version), ['0002']);
    assert.deepStrictEqual(plan.problems, []);
  });

  await test('plan: edited applied file, missing file, unknown --to and out-of-order pending are problems', () => {
    const list = fakeMigrations();
    assert.match(m.planMigrations(list, [{ version: '0001', checksum: 'x' }]).problems[0], /checksum mismatch/);
    assert.match(m.planMigrations(list.slice(1), [{ version: '0001', checksum: 'x' }]).problems.join(), /file is missing/);
    assert.match(m.planMigrations(list, [], { to: '0009' }).problems[0], /no such migration/);
    const outOfOrder = m.planMigrations(list, [{ version: '0002', checksum: list[1].checksum }]);
    assert.match(outOfOrder.problems.join(), /0001 is pending but 0002 is already applied/);
  });

  await test('up: applies in order, each in begin / commit with its schema_migrations row, under the advisory lock', async () => {
    const client = fakeClient();
    const done = await m.runCommand(client, fakeMigrations(), { command: 'up', out: silent });
    assert.deepStrictEqual(done.applied, ['0001', '0002']);
    assert.deepStrictEqual(client.state.applied.map(r => r.version), ['0001', '0002']);
    const steps = client.state.log.map(([kind, text]) => (kind === 'exec' ? text.split('\n')[0] : text.split(' ').slice(0, 3).join(' ')));
    assert.strictEqual(steps[0], 'select pg_advisory_lock($1)');
    assert.strictEqual(steps[steps.length - 1], 'select pg_advisory_unlock($1)');
    assert.ok(steps.indexOf('-- up 0001') < steps.indexOf('-- up 0002'));
    assert.ok(steps.indexOf('-- preflight 0002') < steps.indexOf('-- up 0002'), 'preflight before 0002');
  });

  await test('up: a preflight with bad rows stops before 0002; 0001 stays applied', async () => {
    const client = fakeClient({ preflightRows: [{ rule: 'fk_x', bad_rows: '0' }, { rule: 'fk_tickets_company_id', bad_rows: '3' }] });
    await assert.rejects(m.runCommand(client, fakeMigrations(), { command: 'up', out: silent }),
      /stopped before 0002_constraints: its preflight found bad rows - fk_tickets_company_id: 3 \(applied in this run: 0001\)/);
    assert.deepStrictEqual(client.state.applied.map(r => r.version), ['0001']);
    assert.ok(client.state.log.some(([, text]) => text === 'select pg_advisory_unlock($1)'), 'lock released');
  });

  await test('up: a failing migration rolls back and leaves no schema_migrations row', async () => {
    const list = fakeMigrations();
    list[0].sql = '-- up 0001\ncreate boom;';
    const client = fakeClient({ failOn: 'boom' });
    await assert.rejects(m.runCommand(client, list, { command: 'up', out: silent }), /boom/);
    assert.ok(client.state.rolledBack);
    assert.deepStrictEqual(client.state.applied, []);
  });

  await test('up: a checksum mismatch refuses before anything runs; --dry-run and --status write nothing', async () => {
    const list = fakeMigrations();
    const mismatch = fakeClient({ applied: [{ version: '0001', name: 'initial_schema', checksum: 'old' }] });
    await assert.rejects(m.runCommand(mismatch, list, { command: 'up', out: silent }), /checksum mismatch/);
    assert.ok(!mismatch.state.log.some(([kind]) => kind === 'exec'));
    for (const opts of [{ command: 'up', dryRun: true }, { command: 'status' }]) {
      const client = fakeClient();
      const lines = [];
      await m.runCommand(client, list, { ...opts, out: line => lines.push(line) });
      assert.ok(!client.state.log.some(([kind]) => kind === 'exec'), `${JSON.stringify(opts)} executed SQL`);
      assert.ok(!client.state.tableExists, `${JSON.stringify(opts)} created schema_migrations`);
      assert.ok(lines.join('\n').includes('0002'), 'mentions the pending migration');
    }
  });

  await test('down: only the newest applied migration; it runs the down file and removes the row', async () => {
    const list = fakeMigrations();
    const applied = list.map(x => ({ version: x.version, name: x.name, checksum: x.checksum }));
    await assert.rejects(m.runCommand(fakeClient({ applied }), list, { command: 'down', downVersion: '0001', out: silent }),
      /only the newest applied migration \(0002\)/);
    const client = fakeClient({ applied });
    await m.runCommand(client, list, { command: 'down', downVersion: '0002', out: silent });
    assert.deepStrictEqual(client.state.applied.map(r => r.version), ['0001']);
    assert.ok(client.state.log.some(([, text]) => text === '-- down 0002'));
  });

  await test('args: --down needs --yes and is refused with --allow-non-dev; versions are 4 digits', () => {
    assert.throws(() => m.parseArgs(['--down', '0002']), /add --yes/);
    assert.throws(() => m.parseArgs(['--down', '0002', '--yes', '--allow-non-dev']), /dev databases only/);
    assert.throws(() => m.parseArgs(['--to', '1']), /4 digits/);
    assert.throws(() => m.parseArgs(['--to']), /needs a value/);
    assert.throws(() => m.parseArgs(['--bogus']), /unknown option/);
    assert.strictEqual(m.parseArgs(['--down', '0002', '--yes']).command, 'down');
    assert.strictEqual(m.parseArgs(['--status']).command, 'status');
  });

  await test('connection: DATABASE_URL wins without gcloud; a non-dev secret needs --allow-non-dev', () => {
    let called = false;
    const exec = () => { called = true; return SECRET_URL; };
    assert.strictEqual(m.resolveConnection({ env: { DATABASE_URL: 'postgresql://a@b/c' }, execImpl: exec }).source, 'DATABASE_URL');
    assert.strictEqual(called, false);
    assert.throws(() => m.resolveConnection({ env: {}, secret: 'daloy-db-prod-url', execImpl: exec }), /not a dev database/);
    assert.strictEqual(called, false);
    const conn = m.resolveConnection({ env: {}, execImpl: exec });
    assert.strictEqual(conn.url, SECRET_URL);
    assert.strictEqual(conn.source, 'secret daloy-db-dev-url');
  });

  await test('readSecret: fixed gcloud arguments, names validated, output trimmed and checked', () => {
    const calls = [];
    const exec = (cmd, argv, options) => { calls.push({ cmd, argv, options }); return `${SECRET_URL}\r\n`; };
    assert.strictEqual(m.readSecret('daloy-db-dev-url', 'krativ-daloy', exec), SECRET_URL);
    assert.deepStrictEqual(calls[0].argv, ['secrets', 'versions', 'access', 'latest', '--secret=daloy-db-dev-url', '--project=krativ-daloy']);
    assert.strictEqual(calls[0].cmd, 'gcloud');
    assert.deepStrictEqual(calls[0].options.stdio, ['ignore', 'pipe', 'pipe'], 'stdout captured, not inherited');
    assert.throws(() => m.readSecret('x & calc', 'krativ-daloy', exec), /invalid secret name/);
    assert.throws(() => m.readSecret('daloy-db-dev-url', 'krativ-daloy" & calc', exec), /invalid project id/);
    assert.throws(() => m.readSecret('daloy-db-dev-url', 'krativ-daloy', () => 'hello'), /does not hold a postgres connection string/);
  });

  await test('strictSsl: require / prefer / verify-ca become verify-full; other parameters and URLs untouched', () => {
    assert.strictEqual(strictSsl(SECRET_URL), SECRET_URL.replace('sslmode=require', 'sslmode=verify-full'));
    assert.strictEqual(strictSsl('postgresql://a@h/d?sslmode=require&channel_binding=require'),
      'postgresql://a@h/d?sslmode=verify-full&channel_binding=require');
    assert.strictEqual(strictSsl('postgresql://a@h/d?channel_binding=require&sslmode=prefer'),
      'postgresql://a@h/d?channel_binding=require&sslmode=verify-full');
    assert.strictEqual(strictSsl('postgresql://a@h/d?sslmode=disable'), 'postgresql://a@h/d?sslmode=disable');
    assert.strictEqual(strictSsl('postgresql://a@h/d'), 'postgresql://a@h/d');
  });

  await test('no connection string in any output: redact, describeTarget, a gcloud failure message', () => {
    assert.ok(!redact(`connect failed for ${SECRET_URL}`).includes('sup3r-secret-pw'));
    assert.strictEqual(m.describeTarget(SECRET_URL), 'ep-x.ap-southeast-1.aws.neon.tech/daloy');
    const failing = () => {
      const error = new Error('Command failed');
      error.stderr = `ERROR: (gcloud.secrets.versions.access) denied for ${SECRET_URL}`;
      throw error;
    };
    assert.throws(() => m.readSecret('daloy-db-dev-url', 'krativ-daloy', failing), error => {
      assert.ok(!error.message.includes('sup3r-secret-pw'));
      assert.match(error.message, /is gcloud signed in/);
      return true;
    });
  });

  if (pgliteDir) {
    await test('PGlite: real files - status, --to 0001, re-run is a no-op, preflight on empty, 0002, edited file refused, downs', async () => {
      const from = path.resolve(pgliteDir);
      const { PGlite } = require(require.resolve('@electric-sql/pglite', { paths: [from] }));
      const { pg_trgm } = require(require.resolve('@electric-sql/pglite/contrib/pg_trgm', { paths: [from] }));
      const db = new PGlite({ extensions: { pg_trgm } });
      // PGlite has no pgcrypto; Neon does (as scripts/test-gen-ddl.js)
      const client = {
        query: (text, params) => db.query(text, params),
        exec: text => db.exec(text.replace(/create extension if not exists pgcrypto;\r?\n/, ''))
      };
      const list = m.listMigrations();
      const tables = async () => (await db.query(
        "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name <> 'schema_migrations'"
      )).rows[0].n;

      await m.runCommand(client, list, { command: 'status', out: silent });
      assert.deepStrictEqual(await m.readApplied(client), [], 'status created nothing');
      assert.deepStrictEqual((await m.runCommand(client, list, { command: 'up', to: '0001', out: silent })).applied, ['0001']);
      assert.strictEqual(await tables(), 55);
      assert.deepStrictEqual((await m.runCommand(client, list, { command: 'up', to: '0001', out: silent })).applied, []);
      assert.deepStrictEqual((await m.runCommand(client, list, { command: 'up', out: silent })).applied, ['0002']);
      const rows = await m.readApplied(client);
      assert.deepStrictEqual(rows.map(r => r.version), ['0001', '0002']);
      assert.strictEqual(rows[0].checksum, list[0].checksum);

      const edited = list.map(x => (x.version === '0001' ? { ...x, checksum: m.checksum(`${x.sql}\n-- edited`) } : x));
      await assert.rejects(m.runCommand(client, edited, { command: 'up', out: silent }), /checksum mismatch/);

      await m.runCommand(client, list, { command: 'down', downVersion: '0002', out: silent });
      await m.runCommand(client, list, { command: 'down', downVersion: '0001', out: silent });
      assert.strictEqual(await tables(), 0);
      assert.deepStrictEqual(await m.readApplied(client), []);
      await db.close();
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
