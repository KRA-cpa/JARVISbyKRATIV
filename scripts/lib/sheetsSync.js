/**
 * scripts/lib/sheetsSync.js v1.0 (15 Nov 2026, session 461f9ea9) - migration step 1.1, the WRITE half of the sync:
 * make Postgres equal to the clean rows of the Sheet, again and again (Sheets stays the source of truth until the
 * write cutover, Phase 2). Input: a load plan from scripts/db-load-sheets.js buildLoadPlan (clean rows only).
 *
 * One transaction per run (all or nothing), with the 0002 constraints in place:
 *   1. upsert every table, parents before children (foreign-key order): insert new rows, update rows whose values
 *      changed (unchanged rows are not rewritten);
 *   2. delete rows that are no longer in the Sheet, children before parents.
 * Safety: a table is never emptied or shrunk by a bad read - deletes are skipped for a tab that wasn't in the read, and
 * the run REFUSES (nothing changed) when a table would lose more than SHRINK_LIMIT of its rows (and more than
 * SHRINK_MIN rows) unless allowShrink. Tables the Sheet doesn't have (privacy records, platform tables) are untouched.
 * Stable ids: a key the Sheet never had (comment_requirements.id, random in the one-time load) becomes a hash of the
 * row's values - the same row keeps its id from run to run (stableSurrogates).
 * Prints nothing itself; returns counts only (no row values).
 * Layer: scripts.
 */

'use strict';

const crypto = require('crypto');
const { readForeignKeys, deleteOrder, q } = require('./companyScope');

const SHRINK_LIMIT = 0.2;
const SHRINK_MIN = 5;
const SURROGATE_RE = /\bdefault\s*\(\s*'([a-z0-9_]*)'\s*\|\|\s*replace\(\s*gen_random_uuid\(\)/i;
const n = r => Number((r.rows[0] || {}).n || 0);

/** Replace the random surrogate keys of a plan with a hash of each row's other values (duplicates get a counter). */
function stableSurrogates(plan, model, sheetSchemas = {}) {
  for (const [name, entry] of Object.entries(plan.tables)) {
    const def = model.tables[name];
    const cols = def.columns.filter(c => !(sheetSchemas[name] || []).includes(c.name) && SURROGATE_RE.test(c.def));
    for (const col of cols) {
      const prefix = SURROGATE_RE.exec(col.def)[1];
      const generated = new RegExp(`^${prefix}[0-9a-f]{32}$`);
      const seen = new Map();
      // The tab may have no such column at all (then the database default would make a new random id on every run)
      if (!entry.columns.includes(col.name) && entry.rows.length) entry.columns.push(col.name);
      for (const row of entry.rows) {
        // A real id typed into the Sheet is kept; only a missing or loader-made (random) one is replaced
        const current = row.record[col.name];
        if (current !== null && current !== undefined && !generated.test(String(current))) continue;
        // Only what the Sheet itself holds: values the loader fills in (a created_at of "now") would change the id every run
        const own = entry.columns.filter(c => c !== col.name && (sheetSchemas[name] || []).includes(c));
        const rest = own.map(c => row.record[c] === undefined ? null : row.record[c]);
        const base = crypto.createHash('sha256').update(name + '\u0001' + JSON.stringify(rest)).digest('hex').slice(0, 32);
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        row.record[col.name] = prefix + (count ? crypto.createHash('sha256').update(base + count).digest('hex').slice(0, 32) : base);
      }
    }
  }
  return plan;
}

/** Upsert statements for one table (batched): returns inserted / updated counts through `xmax = 0`. */
function upsertStatements(table, entry, pk, maxParams = 30000) {
  const cols = entry.columns;
  if (!cols.length || !entry.rows.length) return [];
  const rest = cols.filter(c => !pk.includes(c));
  const perBatch = Math.max(1, Math.floor(maxParams / cols.length));
  const out = [];
  for (let i = 0; i < entry.rows.length; i += perBatch) {
    const params = [];
    const tuples = entry.rows.slice(i, i + perBatch).map(row => `(${cols.map(c => {
      params.push(row.record[c] === undefined ? null : row.record[c]);
      return `$${params.length}`;
    }).join(', ')})`);
    const action = rest.length
      ? `do update set ${rest.map(c => `${q(c)} = excluded.${q(c)}`).join(', ')} ` +
        `where (${rest.map(c => `t.${q(c)}`).join(', ')}) is distinct from (${rest.map(c => `excluded.${q(c)}`).join(', ')})`
      : 'do nothing';
    out.push({
      text: `with up as (insert into ${q(table)} as t (${cols.map(q).join(', ')}) values ${tuples.join(', ')} ` +
        `on conflict (${pk.map(q).join(', ')}) ${action} returning (xmax = 0) as inserted) ` +
        'select count(*) filter (where inserted)::int as ins, count(*) filter (where not inserted)::int as upd from up',
      params
    });
  }
  return out;
}

/**
 * @param {{ query }} client - one connection
 * @param {Object} plan - buildLoadPlan result (after stableSurrogates)
 * @param {Object} model - gen-ddl model
 * @param {{ apply?: boolean, allowShrink?: boolean }} options - apply false = dry run (rolled back)
 * @returns {Promise<{ applied, tables: Object<string, { inserted, updated, deleted, rows }>, totals }>}
 */
async function syncPlan(client, plan, model, { apply = false, allowShrink = false } = {}) {
  const names = Object.keys(plan.tables);
  const fks = (await readForeignKeys(client)).filter(f => names.includes(f.child) && names.includes(f.parent));
  // A cycle is only between optional links (companies <-> connections); order by the links that have rows to respect
  const used = fks.filter(f => f.child !== f.parent && plan.tables[f.child].columns.includes(f.col) &&
    plan.tables[f.child].rows.some(r => r.record[f.col] !== null && r.record[f.col] !== undefined));
  const childrenFirst = deleteOrder(names, used);
  const parentsFirst = childrenFirst.slice().reverse();
  const stats = Object.fromEntries(names.map(t => [t, { inserted: 0, updated: 0, deleted: 0, rows: plan.tables[t].rows.length }]));

  // Tables no other table points at: their removed rows go BEFORE the upserts, so a row whose key changed (e.g. a random
  // id from the one-time 0.8 load becoming its stable id) can't clash with its old self on a unique rule. Every other
  // table deletes after the upserts, children first, so foreign keys stay valid throughout.
  const referenced = new Set(fks.filter(f => f.child !== f.parent).map(f => f.parent));
  const leaves = childrenFirst.filter(t => !referenced.has(t));

  const removeGone = async t => {
    const entry = plan.tables[t];
    if (!entry.info || !entry.info.tab_found) return; // the tab wasn't read: never delete on that
    const pk = model.tables[t].primaryKey;
    const keys = pk.map(c => entry.rows.map(r => String(r.record[c])));
    const before = n(await client.query(`select count(*)::int as n from ${q(t)}`));
    const res = await client.query(
      `with d as (delete from ${q(t)} where (${pk.map(c => `${q(c)}::text`).join(', ')}) not in ` +
      `(select * from unnest(${pk.map((c, i) => `$${i + 1}::text[]`).join(', ')})) returning 1) select count(*)::int as n from d`,
      keys
    );
    stats[t].deleted = n(res);
    if (!allowShrink && stats[t].deleted > SHRINK_MIN && stats[t].deleted > before * SHRINK_LIMIT) {
      throw new Error(`refused: ${t} would lose ${stats[t].deleted} of ${before} rows - a bad read? (allow with --allow-shrink)`);
    }
  };

  await client.query('begin');
  try {
    for (const t of leaves) await removeGone(t);
    for (const t of parentsFirst) {
      for (const s of upsertStatements(t, plan.tables[t], model.tables[t].primaryKey)) {
        const r = (await client.query(s.text, s.params)).rows[0];
        stats[t].inserted += Number(r.ins);
        stats[t].updated += Number(r.upd);
      }
    }
    for (const t of childrenFirst) if (!leaves.includes(t)) await removeGone(t);
    await client.query(apply ? 'commit' : 'rollback');
  } catch (error) {
    try { await client.query('rollback'); } catch (e) { /* closed */ }
    throw error;
  }
  const totals = Object.values(stats).reduce((a, s) => ({
    inserted: a.inserted + s.inserted, updated: a.updated + s.updated, deleted: a.deleted + s.deleted, rows: a.rows + s.rows
  }), { inserted: 0, updated: 0, deleted: 0, rows: 0 });
  return { applied: apply, tables: stats, totals };
}

module.exports = { syncPlan, stableSurrogates, upsertStatements, SHRINK_LIMIT, SHRINK_MIN };
