#!/usr/bin/env node
/**
 * db-migrate.js v1.0 (14 Nov 2026, migration step 0.6) — apply migrations/postgres/*.up.sql to a Postgres database
 * (Neon `dev` by default) and record them in `schema_migrations`.
 *
 * Usage (npm run db:migrate -- <options>):
 *   (no option)          apply every pending migration, in version order
 *   --status             list applied / pending migrations; changes nothing
 *   --dry-run            say what would run; changes nothing
 *   --to <version>       apply pending migrations up to and including <version> (e.g. --to 0001)
 *   --down <version> --yes
 *                        undo <version> with its .down.sql; it must be the newest applied migration
 *   --secret <name>      Secret Manager secret that holds the connection string (default daloy-db-dev-url)
 *   --project <id>       Google Cloud project of the secret (default krativ-daloy)
 *   --allow-non-dev      needed for a secret whose name does not end in -dev-url (refused together with --down)
 *   --dir <folder>       migrations folder (default migrations/postgres)
 *   DATABASE_URL         in the environment, wins over --secret
 *
 * Rules:
 *   - The connection string is read with `gcloud secrets versions access` into memory: never printed, never in argv,
 *     never in an error message (redact) - compliance S2. Output names only the host and database.
 *   - One run at a time (pg_advisory_lock). Each migration runs in its own transaction together with its
 *     schema_migrations row, so a failure leaves nothing half-applied.
 *   - A migration file that changed after it was applied stops the run (sha256 checksum, line endings ignored - S6);
 *     so does a pending migration older than the newest applied one.
 *   - A migration with a <version>_<name>.preflight.sql sibling runs it first and is refused unless every bad_rows is 0
 *     (0002 constraints wait for the data load, step 0.8).
 * Test: node scripts/test-db-migrate.js [--pglite <dir>]
 * Exit: 0 = done, 1 = refused or failed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { redact, strictSsl } = require('../api/_lib/db');

const DEFAULT_DIR = path.join(__dirname, '..', 'migrations', 'postgres');
const DEFAULT_SECRET = 'daloy-db-dev-url';
const DEFAULT_PROJECT = 'krativ-daloy';
/** pg_advisory_lock key for "a migration run is in progress" (any fixed bigint; this one spells nothing). */
const LOCK_KEY = 4206140006;
const FILE_RE = /^(\d{4})_([a-z0-9_]+)\.up\.sql$/;

const TRACKING_DDL = `create table if not exists schema_migrations (
  version text primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now(),
  duration_ms integer
)`;

/** sha256 of a migration file, CRLF and LF counted the same (a Windows checkout must not look "changed"). */
function checksum(text) {
  return crypto.createHash('sha256').update(String(text).replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * The migrations in a folder, in version order.
 * @returns {Array<{ version, name, file, sql, checksum, downSql, preflightSql }>}
 */
function listMigrations(dir = DEFAULT_DIR) {
  const readIf = file => (fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), 'utf8') : null);
  const seen = new Map();
  const list = [];
  for (const file of fs.readdirSync(dir).sort()) {
    const match = FILE_RE.exec(file);
    if (!match) continue;
    const [, version, name] = match;
    if (seen.has(version)) throw new Error(`two migrations share version ${version}: ${seen.get(version)} and ${file}`);
    seen.set(version, file);
    const base = `${version}_${name}`;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    list.push({ version, name, file, sql, checksum: checksum(sql),
      downSql: readIf(`${base}.down.sql`), preflightSql: readIf(`${base}.preflight.sql`) });
  }
  return list.sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * What to apply, and what is wrong.
 * @param {Array} migrations - listMigrations()
 * @param {Array<{ version, checksum }>} applied - schema_migrations rows
 * @param {{ to?: string|null }} options
 * @returns {{ pending: Array, problems: string[] }}
 */
function planMigrations(migrations, applied, { to = null } = {}) {
  const byVersion = new Map(migrations.map(m => [m.version, m]));
  const problems = [];
  for (const row of applied) {
    const m = byVersion.get(row.version);
    if (!m) problems.push(`${row.version} is applied in the database but its file is missing`);
    else if (m.checksum !== row.checksum) {
      problems.push(`${m.file} changed after it was applied (checksum mismatch) - add a new migration instead`);
    }
  }
  if (to && !byVersion.has(to)) problems.push(`--to ${to}: no such migration`);
  const appliedVersions = new Set(applied.map(r => r.version));
  const newest = applied.map(r => r.version).sort().pop() || null;
  const pending = migrations.filter(m => !appliedVersions.has(m.version) && (!to || m.version <= to));
  for (const m of pending) {
    if (newest && m.version < newest) problems.push(`${m.version} is pending but ${newest} is already applied (out of order)`);
  }
  return { pending, problems };
}

/** Preflight rows ({ rule, bad_rows }) that are not 0, as "rule: n". */
function preflightFailures(rows) {
  return rows.filter(r => Number(r.bad_rows) !== 0).map(r => `${r.rule}: ${r.bad_rows}`);
}

/**
 * Read a Secret Manager secret into memory. Fixed arguments only (validated), so the Windows shell (needed to run
 * gcloud.cmd) gets nothing it could interpret. stdout is captured, never echoed.
 */
function readSecret(secret, project, execImpl = execFileSync) {
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(secret)) throw new Error(`invalid secret name: ${secret}`);
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error(`invalid project id: ${project}`);
  const windows = process.platform === 'win32';
  let output;
  try {
    output = execImpl('gcloud', ['secrets', 'versions', 'access', 'latest', `--secret=${secret}`, `--project=${project}`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: windows, windowsHide: true
    });
  } catch (error) {
    const detail = String(error.stderr || error.message || '').trim().split('\n').slice(-2).join(' ');
    throw new Error(`could not read secret ${secret} in ${project} (is gcloud signed in?): ${redact(detail)}`);
  }
  const value = String(output || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(value)) throw new Error(`secret ${secret} does not hold a postgres connection string`);
  return value;
}

/** Where the connection string comes from: DATABASE_URL, else the (dev) secret. */
function resolveConnection({ env = process.env, secret = DEFAULT_SECRET, project = DEFAULT_PROJECT,
  allowNonDev = false, execImpl = execFileSync } = {}) {
  if (env.DATABASE_URL) return { url: env.DATABASE_URL, source: 'DATABASE_URL' };
  if (!/-dev-url$/.test(secret) && !allowNonDev) {
    throw new Error(`secret ${secret} is not a dev database (the name does not end in -dev-url); add --allow-non-dev to use it`);
  }
  return { url: readSecret(secret, project, execImpl), source: `secret ${secret}` };
}

/** "host/database" of a connection string - never the user or password. */
function describeTarget(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}/${decodeURIComponent(parsed.pathname.replace(/^\//, '')) || '(default database)'}`;
  } catch (error) {
    return '(unparsable connection string)';
  }
}

/** The applied rows, or [] when schema_migrations does not exist yet (reading never creates it). */
async function readApplied(client) {
  const { rows } = await client.query("select to_regclass('public.schema_migrations') is not null as present");
  if (!rows[0] || !rows[0].present) return [];
  const result = await client.query('select version, name, checksum, applied_at from schema_migrations order by version');
  return result.rows;
}

const formatTime = value => (value instanceof Date ? value.toISOString() : String(value || ''));

/**
 * Run a command against a connected client.
 * @param {{ query: Function, exec: Function }} client - query(text, params) -> { rows }; exec(text) runs a whole file
 * @param {Array} migrations - listMigrations()
 * @param {Object} options - { command: 'status' | 'up' | 'down', to, dryRun, downVersion, out }
 * @returns {Promise<{ applied: string[], undone: string[] }>}
 */
async function runCommand(client, migrations, { command = 'up', to = null, dryRun = false, downVersion = null,
  out = console.log } = {}) {
  const done = { applied: [], undone: [] };

  if (command === 'status') {
    const applied = await readApplied(client);
    const { problems } = planMigrations(migrations, applied, {});
    const appliedMap = new Map(applied.map(r => [r.version, r]));
    for (const m of migrations) {
      const row = appliedMap.get(m.version);
      const state = row ? `applied ${formatTime(row.applied_at)}` : `pending${m.preflightSql ? ' (preflight gate)' : ''}`;
      out(`  ${m.version}  ${m.name.padEnd(24)} ${state}`);
    }
    problems.forEach(p => out(`  PROBLEM: ${p}`));
    out(`${applied.length} applied, ${migrations.length - applied.length} pending`);
    return done;
  }

  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    const applied = await readApplied(client);

    if (command === 'down') {
      const newest = applied.map(r => r.version).sort().pop();
      if (!newest) throw new Error('nothing is applied');
      if (downVersion !== newest) throw new Error(`--down ${downVersion}: only the newest applied migration (${newest}) can be undone`);
      const m = migrations.find(x => x.version === downVersion);
      if (!m || !m.downSql) throw new Error(`${downVersion} has no .down.sql`);
      if (dryRun) {
        out(`would undo ${m.version}_${m.name}`);
        return done;
      }
      await inTransaction(client, async () => {
        await client.exec(m.downSql);
        await client.query('delete from schema_migrations where version = $1', [m.version]);
      });
      out(`undone  ${m.version}_${m.name}`);
      done.undone.push(m.version);
      return done;
    }

    const { pending, problems } = planMigrations(migrations, applied, { to });
    if (problems.length) throw new Error(`refused:\n  - ${problems.join('\n  - ')}`);
    if (!pending.length) {
      out('nothing to apply');
      return done;
    }
    if (dryRun) {
      pending.forEach(m => out(`would apply ${m.version}_${m.name}${m.preflightSql ? ' (after its preflight passes)' : ''}`));
      return done;
    }

    await client.exec(TRACKING_DDL);
    for (const m of pending) {
      if (m.preflightSql) {
        const { rows } = await client.query(m.preflightSql);
        const failures = preflightFailures(rows);
        if (failures.length) {
          throw new Error(`stopped before ${m.version}_${m.name}: its preflight found bad rows - ${failures.join(', ')}` +
            (done.applied.length ? ` (applied in this run: ${done.applied.join(', ')})` : ''));
        }
      }
      const started = Date.now();
      await inTransaction(client, async () => {
        await client.exec(m.sql);
        await client.query('insert into schema_migrations (version, name, checksum, duration_ms) values ($1, $2, $3, $4)',
          [m.version, m.name, m.checksum, Date.now() - started]);
      });
      out(`applied ${m.version}_${m.name} (${Date.now() - started} ms)`);
      done.applied.push(m.version);
    }
    return done;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
  }
}

async function inTransaction(client, fn) {
  await client.exec('begin');
  try {
    await fn();
    await client.exec('commit');
  } catch (error) {
    try {
      await client.exec('rollback');
    } catch (rollbackError) {
      // the original error is the one worth reporting
    }
    throw error;
  }
}

function parseArgs(argv) {
  const opts = { command: 'up', to: null, dryRun: false, downVersion: null, secret: DEFAULT_SECRET,
    project: DEFAULT_PROJECT, allowNonDev: false, yes: false, dir: DEFAULT_DIR, help: false };
  const value = (i, flag) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--status') opts.command = 'status';
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--to') { opts.to = value(i, arg); i += 1; }
    else if (arg === '--down') { opts.command = 'down'; opts.downVersion = value(i, arg); i += 1; }
    else if (arg === '--secret') { opts.secret = value(i, arg); i += 1; }
    else if (arg === '--project') { opts.project = value(i, arg); i += 1; }
    else if (arg === '--dir') { opts.dir = path.resolve(value(i, arg)); i += 1; }
    else if (arg === '--allow-non-dev') opts.allowNonDev = true;
    else if (arg === '--yes') opts.yes = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`unknown option ${arg}`);
  }
  for (const v of [opts.to, opts.downVersion]) {
    if (v !== null && !/^\d{4}$/.test(v)) throw new Error(`a version is 4 digits (e.g. 0001), not ${v}`);
  }
  if (opts.command === 'down' && !opts.dryRun && !opts.yes) throw new Error('--down changes the schema: add --yes');
  if (opts.command === 'down' && opts.allowNonDev) throw new Error('--down is for dev databases only (not with --allow-non-dev)');
  return opts;
}

/** pg Client -> the { query, exec } shape runCommand uses. */
function pgAdapter(client) {
  return { query: (text, params) => client.query(text, params), exec: text => client.query(text) };
}

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    const header = fs.readFileSync(__filename, 'utf8').split('*/')[0];
    console.log(header.replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, ''));
    return 0;
  }
  const migrations = listMigrations(opts.dir);
  const { url, source } = resolveConnection(opts);
  const { Client } = require('pg');
  const client = new Client({ connectionString: strictSsl(url), connectionTimeoutMillis: 20000, application_name: 'daloy-db-migrate' });
  await client.connect();
  console.log(`Connected: ${describeTarget(url)} (${source}; password hidden)`);
  try {
    await runCommand(pgAdapter(client), migrations, opts);
  } finally {
    await client.end();
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then(code => process.exit(code))
    .catch(error => {
      console.error(`db-migrate: ${redact(error.message)}`);
      process.exit(1);
    });
}

module.exports = {
  checksum, listMigrations, planMigrations, preflightFailures, readSecret, resolveConnection, describeTarget,
  readApplied, runCommand, parseArgs, pgAdapter, TRACKING_DDL, LOCK_KEY, DEFAULT_SECRET, DEFAULT_PROJECT
};
