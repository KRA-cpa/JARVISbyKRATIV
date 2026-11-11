#!/usr/bin/env node
/**
 * gen-ddl.js v1.0 (11 Nov 2026) — the first Postgres schema, generated from AppScript TABLE_SCHEMAS (migration step 0.7,
 * docs/planning/PLAN_Migration_Unified_20261108.md §5).
 *
 * Usage:
 *   node scripts/gen-ddl.js [APPSCRIPT file]           write migrations/postgres/0001_* and 0002_* (default: the newest
 *                                                      appscript_files/APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt)
 *   node scripts/gen-ddl.js --check [APPSCRIPT file]   exit 1 when the committed migration files differ from a fresh
 *                                                      generation (the schema or scripts/db/ddl-rules.js changed)
 *
 * Writes (all idempotent - "if not exists" / guarded blocks - so running one twice changes nothing):
 *   0001_initial_schema.up.sql      extensions, every table (TABLE_SCHEMAS + the new tables in ddl-rules.js), primary
 *                                   keys, performance indexes. Safe on any data: the load (0.8) goes in after it.
 *   0001_initial_schema.down.sql    drops every table of 0001
 *   0002_constraints.preflight.sql  read-only report: orphan rows per foreign key + duplicate groups per unique rule.
 *                                   Every count must be 0 before 0002 is applied to loaded data.
 *   0002_constraints.up.sql         business unique indexes + foreign keys
 *   0002_constraints.down.sql       drops them
 * Edit scripts/db/ddl-rules.js (types, keys, indexes, references, new tables) and regenerate - never the .sql by hand.
 * Exit: 0 = written / up to date, 1 = --check found a difference, 2 = bad input (unknown table or column in the rules,
 * duplicate column, no primary key).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RULES = require('./db/ddl-rules');

const ROOT = path.resolve(__dirname, '..');
const APPSCRIPT_DIR = path.join(ROOT, 'appscript_files');
const OUT_DIR = path.join(ROOT, 'migrations', 'postgres');

class DdlError extends Error {}

function newestAppScript() {
  const pattern = /^APPSCRIPT_v(\d+)\.(\d+)_(\d{8})_(\d{4})\.txt$/;
  const files = fs.readdirSync(APPSCRIPT_DIR)
    .map(name => ({ name, m: name.match(pattern) }))
    .filter(f => f.m)
    .sort((a, b) => (a.m[3] + a.m[4]).localeCompare(b.m[3] + b.m[4]));
  if (!files.length) throw new DdlError(`no APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt in ${APPSCRIPT_DIR}`);
  return path.join(APPSCRIPT_DIR, files[files.length - 1].name);
}

/** TABLE_SCHEMAS from an AppScript file: the object literal only, evaluated in an empty context. */
function loadTableSchemas(source) {
  const start = source.indexOf('const TABLE_SCHEMAS = {');
  if (start < 0) throw new DdlError('const TABLE_SCHEMAS = { not found');
  const end = source.indexOf('\n};', start);
  if (end < 0) throw new DdlError('end of TABLE_SCHEMAS (a line "};") not found');
  const literal = source.slice(start + 'const TABLE_SCHEMAS = '.length, end + 2);
  // JSON round trip: plain arrays of this realm (vm arrays have another Array prototype)
  const schemas = JSON.parse(JSON.stringify(vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 })));
  for (const [table, cols] of Object.entries(schemas)) {
    if (!Array.isArray(cols) || !cols.every(c => typeof c === 'string')) {
      throw new DdlError(`TABLE_SCHEMAS.${table} is not a list of column names`);
    }
  }
  return schemas;
}

const q = name => `"${name}"`;

function columnType(table, column, rules) {
  const exact = rules.TYPE_BY_TABLE_COLUMN[`${table}.${column}`] || rules.TYPE_BY_COLUMN[column];
  if (exact) return exact;
  for (const [pattern, type] of rules.TYPE_PATTERNS) if (pattern.test(column)) return type;
  return 'text';
}

/**
 * The model: { tables: { name: { columns: [{ name, def }], primaryKey: [...], source: 'sheets' | 'new' } } }.
 * Every rule that names a table or column is checked here, so a renamed column fails loudly instead of silently
 * dropping an index or a reference.
 */
function buildModel(schemas, rules = RULES) {
  const tables = {};
  const problems = [];

  for (const [table, cols] of Object.entries(schemas)) {
    const seen = new Set();
    const notNull = new Set(rules.NOT_NULL[table] || []);
    const pk = rules.PRIMARY_KEYS[table] || (cols.includes('id') ? ['id'] : null);
    const columns = [];
    for (const name of cols) {
      if (seen.has(name)) { problems.push(`${table}.${name} appears twice in TABLE_SCHEMAS`); continue; }
      seen.add(name);
      let def = columnType(table, name, rules);
      if (notNull.has(name) || (pk && pk.includes(name))) def += ' not null';
      if (rules.DEFAULT_BY_COLUMN[name] !== undefined) def += ` default ${rules.DEFAULT_BY_COLUMN[name]}`;
      columns.push({ name, def });
    }
    for (const [name, def] of rules.EXTRA_COLUMNS[table] || []) {
      if (seen.has(name)) { problems.push(`EXTRA_COLUMNS ${table}.${name} already exists in TABLE_SCHEMAS`); continue; }
      seen.add(name);
      columns.push({ name, def });
    }
    for (const name of notNull) if (!seen.has(name)) problems.push(`NOT_NULL ${table}.${name}: no such column`);
    const primaryKey = rules.PRIMARY_KEYS[table] || (seen.has('id') ? ['id'] : null);
    if (!primaryKey) problems.push(`${table}: no id column and no PRIMARY_KEYS entry`);
    tables[table] = { columns, primaryKey, source: 'sheets' };
  }

  for (const [table, cols] of Object.entries(rules.EXTRA_TABLES)) {
    if (tables[table]) { problems.push(`EXTRA_TABLES ${table} already exists in TABLE_SCHEMAS`); continue; }
    const names = cols.map(([name]) => name);
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) problems.push(`EXTRA_TABLES ${table}.${dup} appears twice`);
    const primaryKey = rules.PRIMARY_KEYS[table] || (names.includes('id') ? ['id'] : null);
    if (!primaryKey) problems.push(`${table}: no id column and no PRIMARY_KEYS entry`);
    tables[table] = { columns: cols.map(([name, def]) => ({ name, def })), primaryKey, source: 'new' };
  }

  const hasColumn = (t, c) => tables[t] && tables[t].columns.some(col => col.name === c);
  for (const table of Object.keys(rules.EXTRA_COLUMNS)) if (!schemas[table]) problems.push(`EXTRA_COLUMNS ${table}: no such table`);
  for (const key of Object.keys(rules.TYPE_BY_TABLE_COLUMN)) {
    const [t, c] = key.split('.');
    if (!hasColumn(t, c)) problems.push(`TYPE_BY_TABLE_COLUMN ${key}: no such column`);
  }
  for (const [table, pk] of Object.entries(rules.PRIMARY_KEYS)) {
    for (const c of pk) if (!hasColumn(table, c)) problems.push(`PRIMARY_KEYS ${table}.${c}: no such column`);
  }
  for (const [label, list] of [['INDEXES', rules.INDEXES], ['UNIQUES', rules.UNIQUES]]) {
    const names = new Set();
    for (const [table, suffix, def] of list) {
      if (!tables[table]) { problems.push(`${label} ${table}.${suffix}: no such table`); continue; }
      if (names.has(`${table}.${suffix}`)) problems.push(`${label} ${table}.${suffix} appears twice`);
      names.add(`${table}.${suffix}`);
      for (const ident of identifiersIn(def)) {
        if (!hasColumn(table, ident)) problems.push(`${label} ${table}.${suffix}: no column "${ident}"`);
      }
    }
  }
  for (const [table, column, ref, refColumn = 'id'] of rules.FOREIGN_KEYS) {
    if (!hasColumn(table, column)) { problems.push(`FOREIGN_KEYS ${table}.${column}: no such column`); continue; }
    if (!tables[ref]) { problems.push(`FOREIGN_KEYS ${table}.${column} -> ${ref}: no such table`); continue; }
    const pk = tables[ref].primaryKey || [];
    if (pk.length !== 1 || pk[0] !== refColumn) {
      problems.push(`FOREIGN_KEYS ${table}.${column} -> ${ref}.${refColumn}: not the single-column primary key of ${ref}`);
    }
  }

  if (problems.length) throw new DdlError(`ddl rules don't match the schema:\n  - ${problems.join('\n  - ')}`);
  return { tables };
}

const SQL_WORDS = new Set(['where', 'and', 'or', 'not', 'in', 'is', 'null', 'desc', 'asc', 'using', 'gin', 'btree',
  'gin_trgm_ops', 'true', 'false', 'nulls', 'first', 'last']);

/** Column names used in an index definition: words that are not SQL keywords, function names or string literals. */
function identifiersIn(def) {
  const out = new Set();
  const noStrings = def.replace(/'[^']*'/g, "''");
  const re = /"([a-z_][a-z0-9_]*)"|\b([a-z_][a-z0-9_]*)\b(\s*\()?/g;
  let m;
  while ((m = re.exec(noStrings))) {
    if (m[1]) { out.add(m[1]); continue; }
    if (m[3] || SQL_WORDS.has(m[2])) continue; // a function call or a keyword
    out.add(m[2]);
  }
  return [...out];
}

/** Index definition with bare column names quoted (so reserved-looking names like date / timestamp / level are safe). */
function quoteIdentifiers(def, table, model) {
  const cols = new Set(model.tables[table].columns.map(c => c.name));
  return def.replace(/'[^']*'|"[^"]*"|\b([a-z_][a-z0-9_]*)\b(?!\s*\()/g, (match, word) => {
    if (!word || !cols.has(word) || SQL_WORDS.has(word)) return match;
    return q(word);
  });
}

function header(title, sourceName, lines) {
  return [
    `-- ${title}`,
    `-- GENERATED by scripts/gen-ddl.js from TABLE_SCHEMAS in appscript_files/${sourceName} + scripts/db/ddl-rules.js.`,
    '-- Do not edit by hand: change ddl-rules.js (or the AppScript schema) and run `node scripts/gen-ddl.js`.',
    ...lines.map(l => `-- ${l}`),
    '',
  ].join('\n');
}

function renderSql(model, sourceName, rules = RULES) {
  const names = Object.keys(model.tables).sort();
  const files = {};

  // 0001 up
  const up = [header('0001 initial schema (migration step 0.7)', sourceName, [
    `${names.length} tables: ${names.filter(n => model.tables[n].source === 'sheets').length} from TABLE_SCHEMAS, ` +
      `${names.filter(n => model.tables[n].source === 'new').length} new. Timestamps timestamptz (UTC); ids text.`,
    'No foreign keys / business uniques here - they are 0002, applied after the data load (0.8).',
  ])];
  for (const ext of rules.EXTENSIONS) up.push(`create extension if not exists ${ext};`);
  up.push('');
  for (const name of names) {
    const t = model.tables[name];
    const lines = t.columns.map(c => `  ${q(c.name)} ${c.def}`);
    lines.push(`  constraint ${q(`pk_${name}`)} primary key (${t.primaryKey.map(q).join(', ')})`);
    up.push(`create table if not exists ${q(name)} (\n${lines.join(',\n')}\n);\n`);
  }
  for (const [table, suffix, def] of rules.INDEXES) {
    up.push(`create index if not exists ${q(`idx_${table}_${suffix}`)} on ${q(table)} ${quoteIdentifiers(def, table, model)};`);
  }
  files['0001_initial_schema.up.sql'] = up.join('\n') + '\n';

  // 0001 down
  files['0001_initial_schema.down.sql'] = header('0001 initial schema - rollback (drops every table of 0001)', sourceName, [])
    + names.slice().reverse().map(n => `drop table if exists ${q(n)} cascade;`).join('\n') + '\n';

  // 0002 preflight (read-only)
  const checks = [];
  for (const [table, column, ref, refColumn = 'id'] of rules.FOREIGN_KEYS) {
    checks.push(`select 'fk_${table}_${column}' as rule, count(*) as bad_rows from ${q(table)} t\n` +
      `  where t.${q(column)} is not null and not exists (select 1 from ${q(ref)} r where r.${q(refColumn)} = t.${q(column)})`);
  }
  for (const [table, suffix, def] of rules.UNIQUES) {
    const { cols, where } = splitUnique(quoteIdentifiers(def, table, model));
    checks.push(`select 'uq_${table}_${suffix}' as rule, count(*) as bad_rows from (select 1 from ${q(table)}` +
      `${where ? ` where ${where}` : ''} group by ${cols} having count(*) > 1) d`);
  }
  files['0002_constraints.preflight.sql'] = header('0002 preflight - orphan rows per foreign key, duplicate groups per unique rule',
    sourceName, ['Read-only. Every bad_rows must be 0 before 0002_constraints.up.sql runs on loaded data.'])
    + checks.join('\nunion all\n') + '\norder by 2 desc, 1;\n';

  // 0002 up
  const up2 = [header('0002 constraints - business uniques + foreign keys', sourceName,
    ['Apply after 0002_constraints.preflight.sql reports 0 everywhere. Re-running it changes nothing.'])];
  for (const [table, suffix, def] of rules.UNIQUES) {
    up2.push(`create unique index if not exists ${q(`uq_${table}_${suffix}`)} on ${q(table)} ${quoteIdentifiers(def, table, model)};`);
  }
  up2.push('');
  for (const [table, column, ref, refColumn = 'id'] of rules.FOREIGN_KEYS) {
    const name = `fk_${table}_${column}`;
    up2.push(`do $$ begin\n  if not exists (select 1 from pg_constraint where conname = '${name}') then\n` +
      `    alter table ${q(table)} add constraint ${q(name)} foreign key (${q(column)}) references ${q(ref)} (${q(refColumn)});\n` +
      '  end if;\nend $$;');
  }
  files['0002_constraints.up.sql'] = up2.join('\n') + '\n';

  // 0002 down
  const down2 = [header('0002 constraints - rollback', sourceName, [])];
  for (const [table, column] of rules.FOREIGN_KEYS.slice().reverse()) {
    down2.push(`alter table if exists ${q(table)} drop constraint if exists ${q(`fk_${table}_${column}`)};`);
  }
  for (const [table, suffix] of rules.UNIQUES) down2.push(`drop index if exists ${q(`uq_${table}_${suffix}`)};`);
  files['0002_constraints.down.sql'] = down2.join('\n') + '\n';

  return files;
}

/** "(a, coalesce(b, '')) where x" -> { cols: "a, coalesce(b, '')", where: "x" } (outer parentheses only). */
function splitUnique(def) {
  if (!def.startsWith('(')) throw new DdlError(`unique definition must start with "(": ${def}`);
  let depth = 0;
  for (let i = 0; i < def.length; i++) {
    if (def[i] === '(') depth++;
    else if (def[i] === ')' && --depth === 0) {
      const rest = def.slice(i + 1).trim();
      return { cols: def.slice(1, i), where: rest.replace(/^where\s+/, '') || null };
    }
  }
  throw new DdlError(`unbalanced parentheses: ${def}`);
}

function generate(appscriptFile, rules = RULES) {
  const schemas = loadTableSchemas(fs.readFileSync(appscriptFile, 'utf8'));
  const model = buildModel(schemas, rules);
  return { schemas, model, files: renderSql(model, path.basename(appscriptFile), rules) };
}

function main(argv) {
  const check = argv.includes('--check');
  const fileArg = argv.find(a => !a.startsWith('--'));
  const appscriptFile = fileArg ? path.resolve(fileArg) : newestAppScript();
  const { model, files } = generate(appscriptFile);
  if (check) {
    const stale = Object.entries(files).filter(([name, text]) => {
      const p = path.join(OUT_DIR, name);
      return !fs.existsSync(p) || fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') !== text;
    }).map(([name]) => name);
    if (stale.length) {
      console.error(`Out of date (run node scripts/gen-ddl.js): ${stale.join(', ')}`);
      return 1;
    }
    console.log(`migrations/postgres is up to date with ${path.basename(appscriptFile)} (${Object.keys(model.tables).length} tables).`);
    return 0;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(OUT_DIR, name), text);
  console.log(`Wrote ${Object.keys(files).length} files to migrations/postgres from ${path.basename(appscriptFile)} ` +
    `(${Object.keys(model.tables).length} tables).`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    if (err instanceof DdlError) { console.error(`ERROR: ${err.message}`); process.exit(2); }
    throw err;
  }
}

module.exports = { loadTableSchemas, buildModel, renderSql, generate, identifiersIn, splitUnique, newestAppScript, DdlError };
