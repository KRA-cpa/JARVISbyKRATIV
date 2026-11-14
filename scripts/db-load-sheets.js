#!/usr/bin/env node
/**
 * db-load-sheets.js v1.0 (14 Nov 2026, migration step 0.8) — load the CLEAN rows of a Sheets export
 * (appscript_files/EXPORT_ForPostgres_v1.0_*.txt → daloy-export-<stamp>.json) into Neon `dev`.
 *
 * Usage (npm run db:load-sheets -- <export.json> <options>):
 *   (no option)            check only, no database: copied / skipped per table + the skip report next to the export file
 *   --check-db             also run the load on the database inside a transaction, run the 0002 preflight, then ROLL BACK
 *   --apply                load for real (one transaction: all rows or none), then verify (row counts + 10 tickets)
 *   --replace --yes        with --apply / --check-db: empty the loaded tables first (dev only; refused with --allow-non-dev)
 *   --secret / --project / --allow-non-dev   as scripts/db-migrate.js (default: secret daloy-db-dev-url); DATABASE_URL wins
 *
 * User rule (14 Nov 2026: "get unbroken data only", "seed data is ok"): copy clean rows only; nothing in the Sheet changes.
 * A row is skipped when:
 *   - a required value is missing (the primary key, or a column the schema marks NOT NULL), or its id repeats another
 *     row's id with different values (an exact copy is dropped, the first kept);
 *   - a value can't be read as its column type (boolean, whole number, amount, date, date-time) - this also catches
 *     shifted columns (a date under is_active, text under created_at);
 *   - it points at a row that does not exist or was skipped (every foreign key of migrations 0002, plus
 *     custom_field_values → its ticket / user profile / role); skipping repeats until nothing changes, so a broken ticket
 *     takes its history, logs, fields, links and participants with it.
 * Kept as is (counted in the report): JSON columns holding plain text become a JSON string; text date-times written before
 * Script Property TS_UTC_SINCE are moved back 8 hours (pre-v9.4 getCurrentTimestamp added 8 h - PLAN_Migration §7) except
 * the role-assignment dates (REAL_UTC_COLUMNS - always real UTC); the few other writers that already wrote real UTC text
 * then end up 8 h early - accepted, counted per column. Date cells use the
 * export's instant ($d) or, for calendar days, its local date ($l). Seed data is loaded like any other data.
 * Every company joins one default organization (D9): `org_default` "Default organization" (rename later).
 * Companies get repairCompanyLocks on the copy (the Sheet stays as it is): a pre-v9.1 date in code_locked is cleared
 * instead of skipping the company, ticket_count is recounted from the copied tickets, a company with tickets is locked.
 *
 * Privacy: the export and the report hold company data - both must be OUTSIDE the repo (refused otherwise). The console
 * shows counts and reasons only, no row values. The connection string is never printed (db-migrate.js).
 * Test: node scripts/test-db-load-sheets.js [--pglite <dir>]
 * Exit: 0 = done, 1 = refused or failed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const gen = require('./gen-ddl');
const RULES = require('./db/ddl-rules');
const migrate = require('./db-migrate');
const { redact, strictSsl } = require('../api/_lib/db');

const ROOT = path.resolve(__dirname, '..');
const PREFLIGHT_FILE = path.join(ROOT, 'migrations', 'postgres', '0002_constraints.preflight.sql');
const DEFAULT_ORG = Object.freeze({ id: 'org_default', name: 'Default organization', code: 'DEFAULT' });
const SHIFT_MS = 8 * 60 * 60 * 1000;
const MAX_PARAMS = 30000; // per INSERT (Postgres allows 65535)
const SAMPLE_TICKETS = 10;

/**
 * Date-time columns that were always written as real UTC text (`new Date(...).toISOString()`, not getCurrentTimestamp):
 * no -8 h correction (ddl-rules.js: "effective_start_date = toISOString(); endOfTerm keeps a time").
 */
const REAL_UTC_COLUMNS = new Set(['effective_start_date', 'effective_end_date', 'validity_end_date']);

/** custom_field_values.ticket_id is the universal entity id (no FK in the schema): its parent by entity_category. */
const ENTITY_PARENTS = { ticket: ['tickets', 'id'], user_profile: ['user_profiles', 'user_id'], role: ['roles', 'id'] };

const q = name => `"${name}"`;
const baseType = def => def.trim().split(/\s+/)[0].toLowerCase();
const isGenerated = def => /\bgenerated\s+always\b/i.test(def);
const isNotNull = def => /\bnot null\b/i.test(def);
const isBlank = v => v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const isDateTag = v => Boolean(v) && typeof v === 'object' && typeof v.$d === 'string';

/** A short description of a bad value for the report (local file only). */
function describe(raw) {
  if (isDateTag(raw)) return `date ${raw.$d}`;
  const text = typeof raw === 'string' ? `"${raw}"` : JSON.stringify(raw);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/** The UTC offset (ms) of a time zone at an instant. */
function zoneOffsetMs(utcMs, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(utcMs)).map(p => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asIfUtc - Math.floor(utcMs / 1000) * 1000;
}

/** 'YYYY-MM-DD[ HH:mm[:ss[.fff]]]' in a time zone → ISO UTC; null when it isn't a real date-time. */
function localToUtcIso(local, timeZone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h = '0', mi = '0', s = '0', ms = '0'] = m.slice(1);
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, +ms.padEnd(3, '0'));
  const check = new Date(asUtc);
  if (check.getUTCFullYear() !== +y || check.getUTCMonth() + 1 !== +mo || check.getUTCDate() !== +d || +h > 23 || +mi > 59 || +s > 59) return null;
  let t = asUtc - zoneOffsetMs(asUtc, timeZone);
  const second = zoneOffsetMs(t, timeZone); // daylight-saving edges
  t = asUtc - second;
  return new Date(t).toISOString();
}

/** The calendar day of an instant in a time zone. */
function localDay(utcMs, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * One cell → the value for its column type.
 * @param {string} type - text | boolean | integer | bigint | numeric | timestamptz | date | jsonb
 * @param {*} raw - the exported cell
 * @param {{ timeZone: string, cutoverMs: number|null, note: Function }} env - note('shifted' | 'json_text')
 * @returns {{ value: * } | { error: string }}
 */
function convertCell(type, raw, env) {
  if (isBlank(raw)) return { value: null };
  if (raw && typeof raw === 'object' && raw.$bad) return { error: `unreadable cell (${raw.$bad})` };
  if (raw && typeof raw === 'object' && !isDateTag(raw)) return { error: `unexpected value ${describe(raw)}` };
  switch (type) {
    case 'text':
      return { value: isDateTag(raw) ? raw.$d : String(raw) };
    case 'boolean': {
      if (typeof raw === 'boolean') return { value: raw };
      if (raw === 1 || raw === 0) return { value: raw === 1 };
      if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes') return { value: true };
        if (s === 'false' || s === '0' || s === 'no') return { value: false };
      }
      return { error: `not true / false: ${describe(raw)}` };
    }
    case 'integer':
    case 'bigint': {
      const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && /^-?\d+(\.0+)?$/.test(raw.trim()) ? Number(raw.trim()) : NaN);
      if (!Number.isSafeInteger(n)) return { error: `not a whole number: ${describe(raw)}` };
      if (type === 'integer' && Math.abs(n) > 2147483647) return { error: `too large: ${describe(raw)}` };
      return { value: n };
    }
    case 'numeric': {
      const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && /^-?\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw.trim()) : NaN);
      if (!Number.isFinite(n)) return { error: `not a number: ${describe(raw)}` };
      return { value: n };
    }
    case 'timestamptz': {
      if (isDateTag(raw)) return { value: raw.$d };
      if (typeof raw !== 'string') return { error: `not a date-time: ${describe(raw)}` };
      const s = raw.trim().replace(/^'/, '');
      if (/^\d{4}-\d{2}-\d{2}T.*([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
        const t = Date.parse(s);
        if (Number.isNaN(t)) return { error: `not a date-time: ${describe(raw)}` };
        if (env.cutoverMs && !env.realUtc && /[zZ]$/.test(s) && t < env.cutoverMs) {
          env.note('shifted');
          return { value: new Date(t - SHIFT_MS).toISOString() };
        }
        return { value: new Date(t).toISOString() };
      }
      const iso = localToUtcIso(s, env.timeZone);
      return iso ? { value: iso } : { error: `not a date-time: ${describe(raw)}` };
    }
    case 'date': {
      if (isDateTag(raw)) return { value: (raw.$l || '').slice(0, 10) || localDay(Date.parse(raw.$d), env.timeZone) };
      if (typeof raw !== 'string') return { error: `not a date: ${describe(raw)}` };
      const s = raw.trim().replace(/^'/, '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return localToUtcIso(s, 'UTC') ? { value: s } : { error: `not a date: ${describe(raw)}` };
      if (/^\d{4}-\d{2}-\d{2}T.*([zZ]|[+-]\d{2}:?\d{2})$/.test(s) && !Number.isNaN(Date.parse(s))) {
        return { value: localDay(Date.parse(s), env.timeZone) };
      }
      return { error: `not a date: ${describe(raw)}` };
    }
    case 'jsonb': {
      if (isDateTag(raw)) return { value: JSON.stringify(raw.$d) };
      if (typeof raw === 'number' || typeof raw === 'boolean') return { value: JSON.stringify(raw) };
      const s = String(raw).trim();
      try {
        JSON.parse(s);
        return { value: s };
      } catch (error) {
        env.note('json_text');
        return { value: JSON.stringify(String(raw)) };
      }
    }
    default:
      return { error: `unknown column type ${type}` };
  }
}

/** The DEFAULT_BY_COLUMN value as a JS value ('true' → true). */
function defaultValue(column) {
  const d = RULES.DEFAULT_BY_COLUMN[column];
  if (d === undefined) return undefined;
  if (d === 'true' || d === 'false') return d === 'true';
  return d;
}

/**
 * Decide, for every row of the export, whether it is copied or skipped (no database).
 * @param {Object} exportData - the parsed daloy-export JSON
 * @param {Object} model - gen-ddl model ({ tables })
 * @returns {{ meta, tables: Object<string, { columns: string[], rows: Array<{ n, record }>, info }>, skipped: Array }}
 */
function buildLoadPlan(exportData, model, { defaultOrg = DEFAULT_ORG } = {}) {
  if (!exportData || !exportData.meta || exportData.meta.export_version !== 1 || !exportData.tabs) {
    throw new Error('not a daloy export (meta.export_version 1 expected) - use appscript_files/EXPORT_ForPostgres_v1.0');
  }
  const meta = exportData.meta;
  const timeZone = meta.spreadsheet_time_zone;
  if (!timeZone) throw new Error('the export has no spreadsheet_time_zone');
  const cutoverMs = meta.ts_utc_since ? Date.parse(meta.ts_utc_since) : null;
  const tables = {};
  const skipped = [];

  for (const [name, def] of Object.entries(model.tables)) {
    if (def.source !== 'sheets') continue;
    const tab = exportData.tabs[name];
    const info = { tab_found: Boolean(tab), rows_in_export: tab ? tab.rows.length : 0, copied: 0, skipped: 0,
      duplicate_copies_dropped: 0, shifted_timestamps: {}, json_text_wrapped: {}, ignored_columns: [], missing_columns: [],
      duplicate_headers: [] };
    const entry = { columns: [], rows: [], info };
    tables[name] = entry;
    if (!tab) continue;

    const colDefs = new Map(def.columns.map(c => [c.name, c.def]));
    const index = new Map();
    tab.headers.forEach((h, i) => {
      if (!h) return;
      if (index.has(h)) info.duplicate_headers.push(h);
      else index.set(h, i);
    });
    info.ignored_columns = [...index.keys()].filter(h => !colDefs.has(h));
    const fromSheet = def.columns.filter(c => index.has(c.name) && !isGenerated(c.def)).map(c => c.name);
    const sheetSchema = (meta.table_schemas && meta.table_schemas[name]) || [];
    info.missing_columns = def.columns.filter(c => !index.has(c.name) && sheetSchema.includes(c.name)).map(c => c.name);
    // A NOT NULL column without a default that the tab doesn't have: every row would fail
    const missingRequired = def.columns.filter(c => !index.has(c.name) && isNotNull(c.def) && !/\bdefault\b/i.test(c.def)
      && !isGenerated(c.def) && !(name === 'companies' && c.name === 'organization_id'));
    const loaderSet = name === 'companies' ? ['organization_id'] : [];
    entry.columns = [...fromSheet, ...loaderSet.filter(c => !fromSheet.includes(c))];

    const candidates = [];
    for (const original of tab.rows) {
      const row = name === 'companies' ? repairCompanyLockCells(original, index, info) : original;
      const record = {};
      const problems = missingRequired.map(c => `${c.name}: column missing in the tab`);
      for (const column of fromSheet) {
        const colDef = colDefs.get(column);
        const env = {
          timeZone, cutoverMs, realUtc: REAL_UTC_COLUMNS.has(column),
          note: kind => {
            const bucket = kind === 'shifted' ? info.shifted_timestamps : info.json_text_wrapped;
            bucket[column] = (bucket[column] || 0) + 1;
          }
        };
        const result = convertCell(baseType(colDef), row.v[index.get(column)], env);
        if (result.error) {
          problems.push(`${column}: ${result.error}`);
          continue;
        }
        let value = result.value;
        if (value === null && defaultValue(column) !== undefined) value = defaultValue(column);
        if (value === null && isNotNull(colDef)) problems.push(`${column}: required value missing`);
        record[column] = value;
      }
      if (name === 'companies') record.organization_id = defaultOrg.id;
      if (problems.length) {
        skipped.push({ table: name, row: row.n, id: rowId(def, record), reason: problems.join('; ') });
        info.skipped += 1;
        continue;
      }
      candidates.push({ n: row.n, record, key: (def.primaryKey || []).map(c => String(record[c])).join('\u0001') });
    }

    // Repeated primary keys: an exact copy is dropped (first kept); different values = all copies skipped
    const byKey = new Map();
    candidates.forEach(c => byKey.set(c.key, [...(byKey.get(c.key) || []), c]));
    for (const group of byKey.values()) {
      if (group.length === 1) {
        entry.rows.push(group[0]);
        continue;
      }
      const same = group.every(g => JSON.stringify(g.record) === JSON.stringify(group[0].record));
      if (same) {
        entry.rows.push(group[0]);
        info.duplicate_copies_dropped += group.length - 1;
        continue;
      }
      for (const g of group) {
        skipped.push({ table: name, row: g.n, id: rowId(def, g.record),
          reason: `id repeats with different values (sheet rows ${group.map(x => x.n).join(', ')})` });
        info.skipped += 1;
      }
    }
  }

  // D9: one default organization for today's companies
  if (model.tables.organizations) {
    tables.organizations = { columns: ['id', 'name', 'code'], rows: [{ n: null, record: { ...defaultOrg } }],
      info: { tab_found: false, loader_added: true, rows_in_export: 0, copied: 0, skipped: 0 } };
  }

  cascadeOrphans(tables, model, skipped);
  repairCompanyCounts(tables);
  for (const [name, entry] of Object.entries(tables)) {
    entry.info.copied = entry.rows.length;
    entry.info.skipped = skipped.filter(s => s.table === name).length;
  }
  const summary = {
    exported_at: meta.exported_at, api_version: meta.api_version, spreadsheet_time_zone: timeZone,
    ts_utc_since: meta.ts_utc_since || null, default_organization: defaultOrg.id,
    ignored_tabs: Object.keys(exportData.tabs).filter(t => !(model.tables[t] && model.tables[t].source === 'sheets')),
    copied: Object.values(tables).reduce((s, t) => s + t.rows.length, 0), skipped: skipped.length
  };
  return { meta: summary, tables, skipped };
}

/**
 * repairCompanyLocks (AppScript v9.1+, editor-only) done on the copy instead of the Sheet (user: nothing in the Sheet
 * changes). Before v9.1 every company edit wrote created_at / updated_at into code_locked / code_locked_at, so a
 * non-boolean code_locked is a known artifact, not a broken company: it becomes false and code_locked_at is cleared.
 */
function repairCompanyLockCells(row, index, info) {
  if (!index.has('code_locked')) return row;
  const raw = row.v[index.get('code_locked')];
  const valid = raw === true || raw === false || isBlank(raw) || ['TRUE', 'FALSE'].includes(String(raw).trim().toUpperCase());
  if (valid) return row;
  const v = row.v.slice();
  v[index.get('code_locked')] = false;
  if (index.has('code_locked_at')) v[index.get('code_locked_at')] = '';
  info.repaired_code_locked = (info.repaired_code_locked || 0) + 1;
  return { ...row, v };
}

/** The second half of repairCompanyLocks: ticket_count from the copied tickets; a company with tickets is locked. */
function repairCompanyCounts(tables) {
  if (!tables.companies || !tables.tickets) return;
  const own = new Map();
  for (const { record } of tables.tickets.rows) {
    const list = own.get(String(record.company_id)) || [];
    list.push(record.created_at);
    own.set(String(record.company_id), list);
  }
  const info = tables.companies.info;
  for (const { record } of tables.companies.rows) {
    const created = own.get(String(record.id)) || [];
    if (record.ticket_count !== created.length) {
      record.ticket_count = created.length;
      info.recounted_ticket_count = (info.recounted_ticket_count || 0) + 1;
    }
    if (created.length && record.code_locked !== true) {
      const first = created.filter(Boolean).sort()[0];
      record.code_locked = true;
      record.code_locked_at = first || null;
      record.code_locked_reason = 'first_ticket_created (repair)';
      info.locked_by_repair = (info.locked_by_repair || 0) + 1;
    }
  }
  for (const column of ['ticket_count', 'code_locked', 'code_locked_at', 'code_locked_reason']) {
    if (!tables.companies.columns.includes(column)) tables.companies.columns.push(column);
  }
}

function rowId(def, record) {
  const pk = def.primaryKey || [];
  const parts = pk.map(c => record[c]).filter(v => v !== null && v !== undefined);
  return parts.length ? parts.join(' / ') : null;
}

/** Skip every row whose parent is missing or skipped, until nothing changes. */
function cascadeOrphans(tables, model, skipped) {
  const references = RULES.FOREIGN_KEYS.map(([table, column, ref, refColumn = 'id']) => ({ table, column, ref, refColumn }));
  let changed = true;
  while (changed) {
    changed = false;
    const keys = {};
    const keySet = (ref, refColumn) => {
      const k = `${ref}.${refColumn}`;
      if (!keys[k]) keys[k] = new Set(((tables[ref] && tables[ref].rows) || []).map(r => String(r.record[refColumn])));
      return keys[k];
    };
    const drop = (table, predicate) => {
      const entry = tables[table];
      if (!entry || !entry.rows.length) return;
      const keep = [];
      for (const row of entry.rows) {
        const reason = predicate(row.record);
        if (reason) {
          skipped.push({ table, row: row.n, id: rowId(model.tables[table], row.record), reason });
          changed = true;
        } else {
          keep.push(row);
        }
      }
      entry.rows = keep;
    };
    for (const { table, column, ref, refColumn } of references) {
      if (!tables[table]) continue;
      const known = keySet(ref, refColumn);
      drop(table, record => {
        const v = record[column];
        if (v === null || v === undefined) return null;
        return known.has(String(v)) ? null : `${column} → ${ref} "${v}" not found (missing or skipped)`;
      });
    }
    drop('custom_field_values', record => {
      const category = record.entity_category || 'ticket';
      const parent = ENTITY_PARENTS[category];
      if (!parent || record.ticket_id === null || record.ticket_id === undefined) return null;
      return keySet(parent[0], parent[1]).has(String(record.ticket_id)) ? null
        : `ticket_id → ${parent[0]} "${record.ticket_id}" not found (missing or skipped; entity ${category})`;
    });
  }
}

/** Multi-row INSERTs for one table, under the parameter limit. */
function insertStatements(table, entry) {
  const cols = entry.columns;
  if (!cols.length || !entry.rows.length) return [];
  const perBatch = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
  const statements = [];
  for (let i = 0; i < entry.rows.length; i += perBatch) {
    const batch = entry.rows.slice(i, i + perBatch);
    const params = [];
    const tuples = batch.map(row => `(${cols.map(c => {
      params.push(row.record[c] === undefined ? null : row.record[c]);
      return `$${params.length}`;
    }).join(', ')})`);
    statements.push({ text: `insert into ${q(table)} (${cols.map(q).join(', ')}) values ${tuples.join(', ')}`, params });
  }
  return statements;
}

/**
 * Load the plan in ONE transaction; run the 0002 preflight inside it. commit=false rolls back at the end (--check-db).
 * @param {{ query, exec }} client - db-migrate adapter (pg or PGlite)
 * @returns {Promise<{ preflight: string[], inserted: Object<string, number> }>}
 */
async function applyPlan(client, plan, { commit = true, replace = false, preflightSql = fs.readFileSync(PREFLIGHT_FILE, 'utf8'),
  out = console.log } = {}) {
  const applied = (await migrate.readApplied(client)).map(r => r.version);
  if (!applied.includes('0001')) throw new Error('migration 0001 is not applied - run npm run db:migrate -- --to 0001 first');
  if (applied.includes('0002')) throw new Error('0002 is already applied - the load must come before the constraints (or --down 0002 --yes on dev)');
  const names = Object.keys(plan.tables);
  const inserted = {};
  await client.exec('begin');
  try {
    if (replace) {
      await client.exec(`truncate table ${names.map(q).join(', ')}`);
    } else {
      const busy = [];
      for (const name of names) {
        const { rows } = await client.query(`select exists (select 1 from ${q(name)}) as busy`);
        if (rows[0] && rows[0].busy) busy.push(name);
      }
      if (busy.length) throw new Error(`these tables already have rows: ${busy.join(', ')} - add --replace --yes to empty them first (dev only)`);
    }
    for (const name of names) {
      inserted[name] = 0;
      for (const statement of insertStatements(name, plan.tables[name])) {
        await client.query(statement.text, statement.params);
        inserted[name] += statement.params.length / plan.tables[name].columns.length;
      }
    }
    const { rows } = await client.query(preflightSql);
    const preflight = migrate.preflightFailures(rows);
    if (commit && preflight.length) {
      throw new Error(`the 0002 preflight found bad rows after the load - nothing was loaded: ${preflight.join(', ')}`);
    }
    await client.exec(commit ? 'commit' : 'rollback');
    out(commit ? `loaded ${Object.values(inserted).reduce((a, b) => a + b, 0)} rows in one transaction`
      : `check-db: loaded and rolled back; 0002 preflight ${preflight.length ? `bad rows - ${preflight.join(', ')}` : 'clean'}`);
    return { preflight, inserted };
  } catch (error) {
    try {
      await client.exec('rollback');
    } catch (rollbackError) {
      // report the original error
    }
    throw error;
  }
}

/** After --apply: row counts per table + up to 10 tickets end to end (history, action logs, custom fields). */
async function verifyLoad(client, plan) {
  const problems = [];
  for (const [name, entry] of Object.entries(plan.tables)) {
    const { rows } = await client.query(`select count(*)::int as n from ${q(name)}`);
    if (Number(rows[0].n) !== entry.rows.length) problems.push(`${name}: ${rows[0].n} rows in the database, ${entry.rows.length} planned`);
  }
  const tickets = (plan.tables.tickets ? plan.tables.tickets.rows : []).map(r => String(r.record.id)).sort().slice(0, SAMPLE_TICKETS);
  const children = [['ticket_history', 'ticket_id'], ['ticket_action_logs', 'ticket_id'], ['custom_field_values', 'ticket_id']];
  for (const [table, column] of children) {
    if (!plan.tables[table] || !tickets.length) continue;
    const planned = {};
    plan.tables[table].rows.forEach(r => {
      const id = String(r.record[column]);
      const ticketScoped = table !== 'custom_field_values' || (r.record.entity_category || 'ticket') === 'ticket';
      if (ticketScoped && tickets.includes(id)) planned[id] = (planned[id] || 0) + 1;
    });
    const filter = table === 'custom_field_values' ? " and coalesce(entity_category, 'ticket') = 'ticket'" : '';
    const { rows } = await client.query(
      `select ${q(column)}::text as id, count(*)::int as n from ${q(table)} where ${q(column)} = any($1)${filter} group by 1`, [tickets]);
    const actual = Object.fromEntries(rows.map(r => [r.id, Number(r.n)]));
    for (const id of tickets) {
      if ((actual[id] || 0) !== (planned[id] || 0)) problems.push(`ticket ${id}: ${table} ${actual[id] || 0} in the database, ${planned[id] || 0} planned`);
    }
  }
  return { ok: problems.length === 0, problems, sample_tickets: tickets };
}

/** Text summary: per table, then skip reasons grouped (no row values). */
function formatSummary(plan) {
  const lines = [];
  lines.push(`Export: ${plan.meta.exported_at} (Apps Script ${plan.meta.api_version || '?'}, zone ${plan.meta.spreadsheet_time_zone}, TS_UTC_SINCE ${plan.meta.ts_utc_since || 'not set'})`);
  lines.push(`Copy: ${plan.meta.copied} rows   Skip: ${plan.meta.skipped} rows   Default organization: ${plan.meta.default_organization}`);
  lines.push('');
  lines.push(`${'table'.padEnd(32)} ${'export'.padStart(7)} ${'copy'.padStart(7)} ${'skip'.padStart(6)}  notes`);
  for (const [name, entry] of Object.entries(plan.tables).sort(([a], [b]) => a.localeCompare(b))) {
    const i = entry.info;
    const notes = [];
    if (!i.tab_found && !i.loader_added) notes.push('no tab in the Sheet');
    if (i.loader_added) notes.push('added by the loader (D9)');
    if (i.duplicate_copies_dropped) notes.push(`${i.duplicate_copies_dropped} exact copies dropped`);
    if (i.repaired_code_locked) notes.push(`code_locked repaired (pre-v9.1 date) ${i.repaired_code_locked}`);
    if (i.recounted_ticket_count) notes.push(`ticket_count recounted ${i.recounted_ticket_count}`);
    if (i.locked_by_repair) notes.push(`locked (has tickets) ${i.locked_by_repair}`);
    const shifted = Object.entries(i.shifted_timestamps || {});
    if (shifted.length) notes.push(`-8 h: ${shifted.map(([c, n]) => `${c} ${n}`).join(', ')}`);
    const wrapped = Object.entries(i.json_text_wrapped || {});
    if (wrapped.length) notes.push(`text kept as JSON: ${wrapped.map(([c, n]) => `${c} ${n}`).join(', ')}`);
    if (i.ignored_columns && i.ignored_columns.length) notes.push(`columns not in the schema: ${i.ignored_columns.join(', ')}`);
    if (i.missing_columns && i.missing_columns.length) notes.push(`missing columns: ${i.missing_columns.join(', ')}`);
    if (i.duplicate_headers && i.duplicate_headers.length) notes.push(`duplicate headers (first used): ${i.duplicate_headers.join(', ')}`);
    if (!i.rows_in_export && !i.copied && !notes.length) continue;
    lines.push(`${name.padEnd(32)} ${String(i.rows_in_export).padStart(7)} ${String(i.copied).padStart(7)} ${String(i.skipped).padStart(6)}  ${notes.join('; ')}`);
  }
  if (plan.meta.ignored_tabs.length) lines.push(`\nTabs not loaded (not in the schema): ${plan.meta.ignored_tabs.join(', ')}`);
  const reasons = {};
  plan.skipped.forEach(s => {
    reasons[`${s.table}: ${reasonKind(s.reason)}`] = (reasons[`${s.table}: ${reasonKind(s.reason)}`] || 0) + 1;
  });
  if (Object.keys(reasons).length) {
    lines.push('\nWhy rows were skipped (count):');
    Object.entries(reasons).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => lines.push(`  ${String(n).padStart(5)}  ${k}`));
  }
  return lines.join('\n');
}

/** A skip reason without any cell value or id (for the console): 'is_active: not true / false; ticket_id → tickets not found'. */
function reasonKind(reason) {
  return reason
    .replace(/"[^"]*"/g, '')
    .replace(/\s*\(sheet rows [^)]*\)/g, '')
    .replace(/(: (?:not true \/ false|not a whole number|not a number|not a date-time|not a date|too large|unexpected value|unreadable cell))[^;]*/g, '$1')
    .replace(/\s+not found \(missing or skipped(; entity \w+)?\)/g, ' not found')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** The export (and so the report) must be outside the repo: it holds company data. */
function outsideRepo(file) {
  const rel = path.relative(ROOT, path.resolve(file));
  return rel.startsWith('..') || path.isAbsolute(rel);
}

function parseArgs(argv) {
  const opts = { file: null, mode: 'check', replace: false, yes: false, secret: migrate.DEFAULT_SECRET,
    project: migrate.DEFAULT_PROJECT, allowNonDev: false };
  const value = (i, flag) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`${flag} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') opts.mode = 'apply';
    else if (arg === '--check-db') opts.mode = 'check-db';
    else if (arg === '--replace') opts.replace = true;
    else if (arg === '--yes') opts.yes = true;
    else if (arg === '--allow-non-dev') opts.allowNonDev = true;
    else if (arg === '--secret') { opts.secret = value(i, arg); i += 1; }
    else if (arg === '--project') { opts.project = value(i, arg); i += 1; }
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else if (!opts.file) opts.file = arg;
    else throw new Error(`one export file only (got ${arg})`);
  }
  if (!opts.file) throw new Error('usage: npm run db:load-sheets -- <daloy-export-....json> [--check-db | --apply] [--replace --yes]');
  if (opts.replace && !opts.yes) throw new Error('--replace empties the tables: add --yes');
  if (opts.replace && opts.allowNonDev) throw new Error('--replace is for dev databases only (not with --allow-non-dev)');
  if (opts.replace && opts.mode === 'check') throw new Error('--replace goes with --apply or --check-db');
  return opts;
}

async function main(argv) {
  const opts = parseArgs(argv);
  if (!outsideRepo(opts.file)) throw new Error('the export holds company data: move it OUTSIDE the repo folder (e.g. Downloads) first');
  if (!fs.existsSync(opts.file)) throw new Error(`${opts.file} not found`);
  const exportData = JSON.parse(fs.readFileSync(opts.file, 'utf8'));
  const { model } = gen.generate(gen.newestAppScript());
  const plan = buildLoadPlan(exportData, model);
  const summary = formatSummary(plan);
  const reportBase = opts.file.replace(/\.json$/i, '');
  fs.writeFileSync(`${reportBase}.load-report.json`, JSON.stringify({ meta: plan.meta,
    tables: Object.fromEntries(Object.entries(plan.tables).map(([n, e]) => [n, e.info])), skipped: plan.skipped }, null, 2));
  fs.writeFileSync(`${reportBase}.load-report.txt`, `${summary}\n`);
  console.log(summary);
  console.log(`\nReport (local only): ${reportBase}.load-report.txt / .json`);
  if (opts.mode === 'check') {
    console.log('Check only - nothing was loaded. Next: --check-db (load + roll back), then --apply.');
    return 0;
  }

  const { url, source } = migrate.resolveConnection(opts);
  const { Client } = require('pg');
  const client = new Client({ connectionString: strictSsl(url), connectionTimeoutMillis: 20000, application_name: 'daloy-db-load-sheets' });
  await client.connect();
  console.log(`\nConnected: ${migrate.describeTarget(url)} (${source}; password hidden)`);
  try {
    const adapter = migrate.pgAdapter(client);
    const { preflight } = await applyPlan(adapter, plan, { commit: opts.mode === 'apply', replace: opts.replace });
    if (opts.mode === 'apply') {
      const check = await verifyLoad(adapter, plan);
      console.log(check.ok ? `Verified: row counts match; ${check.sample_tickets.length} tickets end to end match`
        : `VERIFY FAILED:\n  - ${check.problems.join('\n  - ')}`);
      if (!check.ok) return 1;
      console.log('Next: npm run db:migrate (applies 0002 - its preflight was clean)');
    } else if (preflight.length) {
      return 1;
    }
  } finally {
    await client.end();
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then(code => process.exit(code))
    .catch(error => {
      console.error(`db-load-sheets: ${redact(error.message)}`);
      process.exit(1);
    });
}

module.exports = {
  convertCell, localToUtcIso, localDay, buildLoadPlan, cascadeOrphans, insertStatements, applyPlan, verifyLoad,
  formatSummary, reasonKind, outsideRepo, parseArgs, DEFAULT_ORG, ENTITY_PARENTS, REAL_UTC_COLUMNS
};
