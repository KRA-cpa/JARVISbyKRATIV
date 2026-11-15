/**
 * scripts/lib/companyScope.js v1.0 (15 Nov 2026, session 461f9ea9) - every database row that belongs to one
 * organization (company), for the per-company export (T1, scripts/db-export-company.js) and delete (T2,
 * scripts/db-delete-company.js) of docs/guides/GUIDE_DataReturnDeletion_20261115.md §8.
 *
 * How the scope is found (inside the caller's transaction; a temp table `_company_scope (tbl, rid)` holds row ids):
 *   1. every table with company_id = the company (except KEEP tables);
 *   2. tables with ticket_type_id but no company_id (custom_fields, attachment rules / slots): the company's own types;
 *   3. the people who belong to this company only (their role assignments are all here): user_profiles,
 *      user_preferences, idempotency_keys;
 *   4. then, until nothing changes, every row whose foreign key points at a row already in scope (ticket children,
 *      step children, dropdown options, tag children ...).
 * A row of ANOTHER company that points at this company's data is a cross-company dependency: it is not taken, it is
 * reported, and delete refuses to run (the case needs a decision) - except link rows (ticket_links), which are taken.
 * KEEP tables are never deleted: billing / contract records (companies row = the billing anchor, company_subscriptions,
 * contract_acceptances), logs with their own retention, platform tables. A KEEP or NULLIFY table row that points at
 * scoped data gets that column set to null on delete (or is reported when the column can't be null).
 * Layer: scripts (no app imports).
 */

'use strict';

const KEEP = new Set([
  'companies', 'company_subscriptions', 'contract_acceptances', 'privacy_requests', 'privacy_acknowledgements',
  'organizations', 'organization_members', 'country_calendars', 'country_holidays', 'admin_action_logs',
  'sequence_counters', 'schema_migrations'
]);
// Not KEEP, but rows outside the scope that point at scoped rows get the column nulled instead of being taken
const NULLIFY = new Set(['user_profiles']);
// Cross-company rows that are taken with the company's data (a link to a deleted ticket means nothing)
const TAKE_ACROSS = new Set(['ticket_links']);
const USER_TABLES = ['user_profiles', 'user_preferences', 'idempotency_keys'];

const q = name => `"${String(name).replace(/"/g, '""')}"`;
const n = result => Number((result.rows[0] || {}).n || 0);

/** Public tables and their columns: { table: { column: { nullable } } }. One query. */
async function readColumns(client) {
  const { rows } = await client.query(
    "select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'public' " +
    'order by table_name, ordinal_position'
  );
  const out = {};
  rows.forEach(r => { (out[r.table_name] = out[r.table_name] || {})[r.column_name] = { nullable: r.is_nullable === 'YES' }; });
  return out;
}

/** Single-column foreign keys: [{ child, col, parent, ref }]. One query. */
async function readForeignKeys(client) {
  const { rows } = await client.query(
    'select cl.relname as child, a.attname as col, pl.relname as parent, pa.attname as ref ' +
    'from pg_constraint c join pg_class cl on cl.oid = c.conrelid join pg_class pl on pl.oid = c.confrelid ' +
    'join pg_namespace ns on ns.oid = cl.relnamespace ' +
    'join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1] ' +
    'join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1] ' +
    "where c.contype = 'f' and ns.nspname = 'public' and array_length(c.conkey, 1) = 1"
  );
  return rows.map(r => ({ child: r.child, col: r.col, parent: r.parent, ref: r.ref }));
}

/**
 * Build the scope for a company inside the current transaction.
 * @returns {Promise<{ companyId, counts: Object<string, number>, users: string[], crossCompany: Array, keepRefs: Array,
 *   order: string[], columns, fks }>} order = tables in delete order (children first)
 */
async function buildScope(client, companyId) {
  const columns = await readColumns(client);
  const fks = await readForeignKeys(client);
  const has = (t, c) => Boolean(columns[t] && columns[t][c]);
  const company = await client.query('select id from companies where id = $1', [companyId]);
  if (!company.rows[0]) throw new Error(`company ${companyId} not found`);

  await client.query('create temp table if not exists _company_scope (tbl text not null, rid tid not null)');
  await client.query('truncate _company_scope');

  // 1. company_id
  for (const t of Object.keys(columns)) {
    if (KEEP.has(t) || !has(t, 'company_id')) continue;
    await client.query(`insert into _company_scope select '${t}', ctid from ${q(t)} where company_id = $1`, [companyId]);
  }
  // 2. ticket_type_id without company_id (the company's own ticket types)
  for (const t of Object.keys(columns)) {
    if (KEEP.has(t) || has(t, 'company_id') || !has(t, 'ticket_type_id')) continue;
    await client.query(
      `insert into _company_scope select '${t}', ctid from ${q(t)} where ticket_type_id in (select id from ticket_types where company_id = $1)`,
      [companyId]
    );
  }
  // 3. people in this company only
  const users = (await client.query(
    'select distinct user_id from user_role_assignments where company_id = $1 and user_id is not null and user_id not in ' +
    '(select user_id from user_role_assignments where user_id is not null and (company_id is null or company_id <> $1))',
    [companyId]
  )).rows.map(r => String(r.user_id));
  for (const t of USER_TABLES) {
    if (!columns[t] || !has(t, 'user_id') || users.length === 0) continue;
    await client.query(`insert into _company_scope select '${t}', ctid from ${q(t)} where user_id = any($1)`, [users]);
  }

  // 4. foreign-key closure. A child row is taken only when it is this company's own: by company_id, else by its ticket
  // type, else by its ticket; a pure child (no such column: step_approvers, dropdown_options ...) follows its parent.
  // Anything else pointing at the scope stays out and is reported (another company's field using this company's
  // dropdown list must not be deleted with it).
  const ownFilter = t => {
    if (TAKE_ACROSS.has(t)) return '';
    if (has(t, 'company_id')) return ' and c.company_id = $1';
    if (has(t, 'ticket_type_id')) return ' and c.ticket_type_id in (select id from ticket_types where company_id = $1)';
    if (has(t, 'ticket_id')) return ' and c.ticket_id in (select id from tickets where company_id = $1)';
    return '';
  };
  const crossCompany = [];
  const keepRefs = [];
  for (let round = 0; round < 25; round += 1) {
    let added = 0;
    for (const fk of fks) {
      const parentRows = `select p.${q(fk.ref)} from ${q(fk.parent)} p where p.ctid in (select rid from _company_scope where tbl = '${fk.parent}')`;
      const notTaken = `not exists (select 1 from _company_scope s where s.tbl = '${fk.child}' and s.rid = c.ctid)`;
      if (KEEP.has(fk.child) || NULLIFY.has(fk.child)) continue; // handled on delete (keepRefs below)
      const crossFilter = ownFilter(fk.child);
      const ins = await client.query(
        `with ins as (insert into _company_scope select '${fk.child}', c.ctid from ${q(fk.child)} c where c.${q(fk.col)} in (${parentRows}) ` +
        `and ${notTaken}${crossFilter} returning 1) select count(*)::int as n from ins`,
        crossFilter.includes('$1') ? [companyId] : []
      );
      added += n(ins);
    }
    if (added === 0) break;
  }
  // Rows outside the scope that still point at scoped rows
  for (const fk of fks) {
    const parentRows = `select p.${q(fk.ref)} from ${q(fk.parent)} p where p.ctid in (select rid from _company_scope where tbl = '${fk.parent}')`;
    const res = await client.query(
      `select count(*)::int as n from ${q(fk.child)} c where c.${q(fk.col)} in (${parentRows}) ` +
      `and not exists (select 1 from _company_scope s where s.tbl = '${fk.child}' and s.rid = c.ctid)`
    );
    const count = n(res);
    if (!count) continue;
    if (KEEP.has(fk.child) || NULLIFY.has(fk.child)) {
      keepRefs.push({ ...fk, rows: count, nullable: columns[fk.child][fk.col].nullable });
    } else {
      crossCompany.push({ ...fk, rows: count });
    }
  }

  const countRows = (await client.query('select tbl, count(*)::int as n from _company_scope group by tbl order by tbl')).rows;
  const counts = Object.fromEntries(countRows.map(r => [r.tbl, r.n]));
  return { companyId, counts, users, crossCompany, keepRefs, order: deleteOrder(Object.keys(counts), fks), columns, fks };
}

/** Tables in delete order: a table comes before every table it references (children first). Throws on a cycle. */
function deleteOrder(tables, fks) {
  const set = new Set(tables);
  const refs = new Map(tables.map(t => [t, new Set()])); // t -> parents it references (other scoped tables)
  fks.forEach(fk => { if (set.has(fk.child) && set.has(fk.parent) && fk.child !== fk.parent) refs.get(fk.child).add(fk.parent); });
  const referencedBy = new Map(tables.map(t => [t, 0]));
  refs.forEach(parents => parents.forEach(p => referencedBy.set(p, referencedBy.get(p) + 1)));
  const order = [];
  const ready = tables.filter(t => referencedBy.get(t) === 0).sort();
  while (ready.length) {
    const t = ready.shift();
    order.push(t);
    [...refs.get(t)].sort().forEach(p => {
      referencedBy.set(p, referencedBy.get(p) - 1);
      if (referencedBy.get(p) === 0) ready.push(p);
    });
  }
  if (order.length !== tables.length) throw new Error(`foreign-key cycle between scoped tables: ${tables.filter(t => !order.includes(t)).join(', ')}`);
  return order;
}

/** The scoped rows of one table (export). */
async function scopedRows(client, table) {
  const { rows } = await client.query(`select * from ${q(table)} where ctid in (select rid from _company_scope where tbl = '${table}')`);
  return rows;
}

module.exports = { buildScope, deleteOrder, scopedRows, readColumns, readForeignKeys, KEEP, NULLIFY, TAKE_ACROSS, USER_TABLES, q };
