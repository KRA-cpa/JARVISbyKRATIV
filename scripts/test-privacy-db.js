#!/usr/bin/env node
/**
 * test-privacy-db.js v1.0 (15 Nov 2026, session 461f9ea9) - the privacy handlers (api/_lib/handlers/privacy.js) and the
 * per-company export / delete / retention tools (scripts/db-export-company.js, db-delete-company.js, db-retention.js)
 * on real Postgres in memory.
 *
 * Usage: node scripts/test-privacy-db.js --pglite <dir>
 *   <dir> has @electric-sql/pglite installed (NOT a project dependency - as scripts/test-db-migrate.js). Without
 *   --pglite only the offline checks run.
 * Migrations 0001-0003 are applied with scripts/db-migrate.js, then a two-company fixture is loaded.
 * Exit: 0 = all pass, 1 = a case failed.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const m = require('./db-migrate');
const privacy = require('../api/_lib/handlers/privacy');
const { handlers } = require('../api/_lib/handlers');
const { deleteOrder } = require('./lib/companyScope');
const { runExport, safeOutPath } = require('./db-export-company');
const { runDelete, parseArgs: deleteArgs } = require('./db-delete-company');
const { runRetention } = require('./db-retention');

const args = process.argv.slice(2);
const pgliteIdx = args.indexOf('--pglite');
const pgliteDir = pgliteIdx >= 0 ? args[pgliteIdx + 1] : null;
const NOW = new Date('2026-11-15T04:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (err) { results.push([false, name, err]); }
}
const silent = () => {};

// --- offline -----------------------------------------------------------------------------------------------------
async function offline() {
  await test('registry: the privacy actions are listed, the test helper is not', async () => {
    ['getMyPrivacyStatus', 'acknowledgePrivacyNotice', 'getOrgTermsStatus', 'acceptOrgTerms', 'exportMyData', 'anonymizeUser']
      .forEach(a => assert.strictEqual(typeof handlers[a], 'function', a));
    assert.strictEqual(handlers._internal, undefined);
  });
  await test('anonymous name is stable and reveals nothing', async () => {
    const a = privacy._internal.anonymousName('uid_alice');
    assert.match(a, /^Deleted user #[0-9a-f]{8}$/);
    assert.strictEqual(a, privacy._internal.anonymousName('uid_alice'));
    assert.ok(!a.includes('alice'));
  });
  await test('delete order: children before parents; a cycle is refused', async () => {
    const fks = [{ child: 'tickets', parent: 'ticket_types' }, { child: 'ticket_history', parent: 'tickets' }];
    const order = deleteOrder(['ticket_types', 'tickets', 'ticket_history'], fks);
    assert.ok(order.indexOf('ticket_history') < order.indexOf('tickets') && order.indexOf('tickets') < order.indexOf('ticket_types'));
    assert.throws(() => deleteOrder(['a', 'b'], [{ child: 'a', parent: 'b' }, { child: 'b', parent: 'a' }]), /cycle/);
  });
  await test('export path must be outside the repository; apply needs a case id', async () => {
    assert.throws(() => safeOutPath(path.join(__dirname, 'x.json')), /outside the repository/);
    assert.ok(safeOutPath(path.join(path.resolve(__dirname, '..', '..'), 'outside.json')));
    assert.throws(() => deleteArgs(['--company', 'c1', '--apply']), /needs --case/);
    assert.strictEqual(deleteArgs(['--company', 'c1', '--apply', '--case', 'DEL-2026-001']).caseId, 'DEL-2026-001');
  });
}

// --- PGlite ------------------------------------------------------------------------------------------------------
async function withDb() {
  const from = path.resolve(pgliteDir);
  const { PGlite } = require(require.resolve('@electric-sql/pglite', { paths: [from] }));
  const { pg_trgm } = require(require.resolve('@electric-sql/pglite/contrib/pg_trgm', { paths: [from] }));
  const pg = new PGlite({ extensions: { pg_trgm } });
  const client = {
    query: (text, params) => pg.query(text, params),
    exec: text => pg.exec(text.replace(/create extension if not exists pgcrypto;\r?\n/, ''))
  };
  const applied = await m.runCommand(client, m.listMigrations(), { command: 'up', out: silent });
  return { pg, client, applied: applied.applied };
}

/** ctx for a handler: counts queries; transaction = BEGIN / COMMIT on the same PGlite. */
function ctxFor(pg, userId, email = null) {
  let count = 0;
  const query = async (text, params) => { count += 1; return pg.query(text, params); };
  return {
    user: userId ? { id: userId, email } : null,
    now: NOW,
    log: () => {},
    db: {
      query,
      transaction: async fn => {
        await pg.query('begin');
        try { const r = await fn({ query }); await pg.query('commit'); return r; } catch (e) { await pg.query('rollback'); throw e; }
      }
    },
    count: () => count
  };
}

async function fixture(pg) {
  const old = d => new Date(NOW.getTime() - d * DAY);
  const sql = [
    "insert into companies (id, name, code, email_reply_to, email_footer) values ('c1', 'Acme', 'ACME', 'hr@acme.test', 'Acme HR'), ('c2', 'Beta', 'BETA', null, null)",
    "insert into roles (id, name, company_id) values ('r_admin1', 'Company Admin', 'c1'), ('r_user1', 'Requester', 'c1'), ('r_admin2', 'Admin', 'c2'), ('r_user2', 'Requester', 'c2'), ('r_g', 'Platform Admin', null)",
    "insert into user_role_assignments (id, user_id, role_id, company_id) values ('a1', 'admin1', 'r_admin1', 'c1'), ('a2', 'alice', 'r_user1', 'c1'), ('a3', 'bob', 'r_user1', 'c1'), ('a4', 'bob', 'r_user2', 'c2'), ('a5', 'gadmin', 'r_g', null), ('a6', 'admin2', 'r_admin2', 'c2')",
    "insert into user_profiles (user_id, display_name, email, phone, is_active) values ('admin1', 'Ann Admin', 'ann@acme.test', null, true), ('alice', 'Alice Example', 'alice@acme.test', '+63 900 000 0000', true), ('bob', 'Bob Both', 'bob@beta.test', null, true), ('gadmin', 'G Admin', 'g@krativ.test', null, true)",
    "insert into user_preferences (user_id, dark_mode) values ('alice', true)",
    "insert into user_invites (id, email, display_name, company_id, accepted_uid) values ('i1', 'alice@acme.test', 'Alice Example', 'c1', 'alice')",
    "insert into ticket_types (id, name, code, company_id) values ('tt1', 'Leave', 'LV', 'c1'), ('tt2', 'Purchase', 'PR', 'c2')",
    "insert into tickets (id, ticket_number, ticket_type_id, status, company_id, requester_id, title, created_at) values ('t1', 'ACME-LV-2026-00000001', 'tt1', 'open', 'c1', 'alice', 'Leave Dec', now()), ('t2', 'BETA-PR-2026-00000001', 'tt2', 'open', 'c2', 'bob', 'Laptop', now())",
    "insert into ticket_history (id, ticket_id, user_id, action) values ('h1', 't1', 'alice', 'created')",
    "insert into custom_fields (id, ticket_type_id, name, label, type) values ('cf1', 'tt1', 'reason', 'Reason', 'text')",
    "insert into custom_field_values (id, ticket_id, custom_field_id, text_value) values ('v1', 't1', 'cf1', 'family')",
    "insert into workflow_steps (id, ticket_type_id, company_id, name) values ('s1', 'tt1', 'c1', 'Manager')",
    "insert into step_approvers (step_id, role_id) values ('s1', 'r_admin1')",
    "insert into notifications (id, user_id, company_id, ticket_id, title) values ('n1', 'alice', 'c1', 't1', 'Your leave')",
    "insert into ticket_links (id, parent_ticket_id, child_ticket_id, company_id) values ('l1', 't2', 't1', 'c2')",
    "insert into organizations (id, name) values ('o1', 'Acme Group')",
    "insert into drive_connections (id, organization_id, company_id, kind) values ('dc1', 'o1', 'c1', 'shared_drive')",
    "update companies set drive_connection_id = 'dc1' where id = 'c1'",
    "insert into company_subscriptions (id, company_id, plan, status) values ('cs1', 'c1', 'basic', 'active')"
  ];
  for (const s of sql) await pg.query(s);
  await pg.query("insert into email_outbox (id, recipient_user_id, recipient_email, company_id, status, sent_at, created_at) values ('o1', 'alice', 'alice@acme.test', 'c1', 'sent', $1, $1), ('o2', 'admin2', 'x@beta.test', 'c2', 'sent', $1, $1), ('o3', 'alice', 'alice@acme.test', 'c1', 'pending', null, $2)", [old(200), old(1)]);
  await pg.query("insert into admin_action_logs (id, admin_user_id, action_type, timestamp) values ('al1', 'alice', 'USER_LOGIN', $1), ('al2', 'alice', 'USER_LOGIN', $2), ('al3', 'admin1', 'UPDATE_ROLE', $1)", [old(400), old(3)]);
}

async function online() {
  const { pg, applied } = await withDb();
  await test('migrations 0001-0003 apply on PGlite', async () => assert.deepStrictEqual(applied, ['0001', '0002', '0003']));
  let loaded = false;
  await test('fixture loads (two companies)', async () => { await fixture(pg); loaded = true; });
  if (!loaded) { await pg.close(); return; }

  await test('privacy notice: none yet → acknowledge (1 query) → status; idempotent per version', async () => {
    let ctx = ctxFor(pg, 'alice');
    assert.deepStrictEqual(await handlers.getMyPrivacyStatus({}, ctx), { version: null, acknowledged_at: null });
    ctx = ctxFor(pg, 'alice');
    const r = await handlers.acknowledgePrivacyNotice({ version: '2026-11-15' }, ctx);
    assert.strictEqual(r.version, '2026-11-15');
    assert.strictEqual(ctx.count(), 1);
    await handlers.acknowledgePrivacyNotice({ version: '2026-11-15' }, ctxFor(pg, 'alice'));
    const n = (await pg.query("select count(*)::int as n from privacy_acknowledgements where user_id = 'alice'")).rows[0].n;
    assert.strictEqual(n, 1);
    assert.strictEqual((await handlers.getMyPrivacyStatus({}, ctxFor(pg, 'alice'))).version, '2026-11-15');
    // never creates or activates a profile (the sign-in allow-list)
    await handlers.acknowledgePrivacyNotice({ version: 'v1' }, ctxFor(pg, 'stranger'));
    assert.strictEqual((await pg.query("select count(*)::int as n from user_profiles where user_id = 'stranger'")).rows[0].n, 0);
    await assert.rejects(handlers.acknowledgePrivacyNotice({ version: '<script>' }, ctxFor(pg, 'alice')), e => e.status === 400);
    await assert.rejects(handlers.getMyPrivacyStatus({}, ctxFor(pg, null)), e => e.status === 401);
  });

  await test('org terms: only an admin of that company (or a global admin); latest per document', async () => {
    await assert.rejects(handlers.acceptOrgTerms({ company_id: 'c1', documents: [{ document: 'terms', version: '0.16' }] }, ctxFor(pg, 'alice')), e => e.status === 403);
    await assert.rejects(handlers.acceptOrgTerms({ company_id: 'c1', documents: [{ document: 'terms', version: '0.16' }] }, ctxFor(pg, 'admin2')), e => e.status === 403);
    await assert.rejects(handlers.acceptOrgTerms({ company_id: 'c1', documents: [{ document: 'nda', version: '1' }] }, ctxFor(pg, 'admin1')), e => e.status === 400);
    const ctx = ctxFor(pg, 'admin1', 'ann@acme.test');
    const r = await handlers.acceptOrgTerms({ company_id: 'c1', documents: [{ document: 'terms', version: '0.16' }, { document: 'dpa', version: '0.4' }] }, ctx);
    assert.strictEqual(r.accepted.length, 2);
    assert.ok(ctx.count() <= 4, `queries ${ctx.count()}`);
    const s = await handlers.getOrgTermsStatus({ company_id: 'c1' }, ctxFor(pg, 'gadmin'));
    assert.strictEqual(s.terms.version, '0.16');
    assert.strictEqual(s.dpa.accepted_by_email, 'ann@acme.test');
    const log = (await pg.query("select count(*)::int as n from admin_action_logs where action_type = 'ACCEPT_ORG_TERMS' and target_id = 'c1'")).rows[0].n;
    assert.strictEqual(log, 1);
    await assert.rejects(handlers.acceptOrgTerms({ company_id: 'nope', documents: [{ document: 'terms', version: '1' }] }, ctxFor(pg, 'gadmin')), e => e.status === 404);
  });

  await test('exportMyData: only the caller\'s own data, 4 queries', async () => {
    const ctx = ctxFor(pg, 'alice');
    const d = await handlers.exportMyData({}, ctx);
    assert.strictEqual(ctx.count(), 4);
    assert.strictEqual(d.profile.email, 'alice@acme.test');
    assert.strictEqual(d.preferences.dark_mode, true);
    assert.deepStrictEqual(d.tickets_requested.rows.map(t => t.id), ['t1']);
    assert.deepStrictEqual(d.notifications.rows.map(n => n.id), ['n1']);
    assert.strictEqual(d.privacy_acknowledgements.length, 1);
    assert.ok(!JSON.stringify(d).includes('bob@beta.test'), 'no one else\'s data');
  });

  await test('anonymizeUser: admin of every company the person is in; name / email / phone gone; access ended; audit row', async () => {
    await assert.rejects(handlers.anonymizeUser({ user_id: 'bob', reason: 'request' }, ctxFor(pg, 'admin1')), e => e.status === 403, 'bob is also in c2');
    await assert.rejects(handlers.anonymizeUser({ user_id: 'admin1', reason: 'x' }, ctxFor(pg, 'admin1')), e => e.status === 403, 'not yourself');
    await assert.rejects(handlers.anonymizeUser({ user_id: 'alice' }, ctxFor(pg, 'admin1')), e => e.status === 400, 'reason required');
    await assert.rejects(handlers.anonymizeUser({ user_id: 'ghost', reason: 'x' }, ctxFor(pg, 'gadmin')), e => e.status === 404);
    const ctx = ctxFor(pg, 'admin1');
    const r = await handlers.anonymizeUser({ user_id: 'alice', reason: 'DSR-2026-001 erasure' }, ctx);
    assert.ok(ctx.count() <= 8, `queries ${ctx.count()}`);
    assert.match(r.display_name, /^Deleted user #/);
    const p = (await pg.query("select display_name, email, phone, is_active, status from user_profiles where user_id = 'alice'")).rows[0];
    assert.deepStrictEqual([p.email, p.phone, p.is_active, p.status], [null, null, false, 'anonymized']);
    const dump = JSON.stringify((await pg.query("select * from user_invites where id = 'i1'")).rows) +
      JSON.stringify((await pg.query("select * from email_outbox where recipient_user_id = 'alice'")).rows) +
      JSON.stringify((await pg.query("select * from user_profiles where user_id = 'alice'")).rows);
    assert.ok(!dump.includes('alice@acme.test') && !dump.includes('Alice Example') && !dump.includes('+63'), 'no name / email / phone left');
    assert.strictEqual((await pg.query("select count(*)::int as n from user_role_assignments where user_id = 'alice' and coalesce(is_active, true)")).rows[0].n, 0);
    assert.strictEqual((await pg.query("select count(*)::int as n from tickets where requester_id = 'alice'")).rows[0].n, 1, 'records stay linked');
    assert.strictEqual((await pg.query("select count(*)::int as n from admin_action_logs where action_type = 'ANONYMIZE_USER'")).rows[0].n, 1);
  });

  await test('retention: dry run counts only; apply removes old sent outbox + old sign-in rows only', async () => {
    const dry = await runRetention({ query: (t, p) => pg.query(t, p) }, { now: NOW });
    assert.deepStrictEqual(dry.rules.map(r => r.rows), [2, 1]);
    assert.strictEqual((await pg.query('select count(*)::int as n from email_outbox')).rows[0].n, 3, 'dry run changed nothing');
    const done = await runRetention({ query: (t, p) => pg.query(t, p) }, { now: NOW, apply: true });
    assert.deepStrictEqual(done.rules.map(r => r.rows), [2, 1]);
    assert.deepStrictEqual((await pg.query('select id from email_outbox order by id')).rows.map(r => r.id), ['o3']);
    assert.deepStrictEqual((await pg.query('select id from admin_action_logs where action_type = \'USER_LOGIN\'')).rows.map(r => r.id), ['al2']);
  });

  const client = { query: (t, p) => pg.query(t, p) };
  await test('T1 export: the company\'s rows only, read-only', async () => {
    const before = (await pg.query('select count(*)::int as n from tickets')).rows[0].n;
    const e = await runExport(client, 'c1', NOW);
    assert.deepStrictEqual(e.tables.tickets.map(r => r.id), ['t1']);
    assert.deepStrictEqual(e.tables.ticket_history.map(r => r.id), ['h1']);
    assert.deepStrictEqual(e.tables.custom_field_values.map(r => r.id), ['v1']);
    assert.deepStrictEqual(e.tables.step_approvers.length, 1);
    assert.deepStrictEqual(e.tables.companies.map(r => r.id), ['c1']);
    assert.deepStrictEqual(e.tables.company_subscriptions.map(r => r.id), ['cs1']);
    assert.ok(!JSON.stringify(e.tables).includes('BETA-PR'), 'no other company\'s tickets');
    assert.ok(e.tables.ticket_links.some(l => l.id === 'l1'), 'the link to its ticket');
    assert.strictEqual((await pg.query('select count(*)::int as n from tickets')).rows[0].n, before);
  });

  await test('T2 delete: a cross-company reference refuses apply; dry run lists it', async () => {
    await pg.query("insert into dropdown_lists (id, name, company_id) values ('dl1', 'Leave kinds', 'c1')");
    await pg.query("insert into custom_fields (id, ticket_type_id, name, label, type, dropdown_list_id) values ('cf2', 'tt2', 'kind', 'Kind', 'dropdown', 'dl1')");
    const dry = await runDelete(client, 'c1', { now: NOW });
    assert.strictEqual(dry.applied, false);
    assert.ok(dry.crossCompany.some(c => c.child === 'custom_fields' && c.parent === 'dropdown_lists'), JSON.stringify(dry.crossCompany));
    await assert.rejects(runDelete(client, 'c1', { apply: true, caseId: 'DEL-2026-001', now: NOW }), /cross-company/);
    assert.strictEqual((await pg.query("select count(*)::int as n from tickets where company_id = 'c1'")).rows[0].n, 1, 'rolled back');
    await pg.query("update custom_fields set dropdown_list_id = null where id = 'cf2'");
  });

  await test('T2 delete: apply removes everything in scope, keeps billing anchor + other company, check = 0', async () => {
    const r = await runDelete(client, 'c1', { apply: true, caseId: 'DEL-2026-001', now: NOW });
    assert.strictEqual(r.applied, true);
    assert.strictEqual(r.remaining, 0);
    const count = async s => (await pg.query(s)).rows[0].n;
    assert.strictEqual(await count("select count(*)::int as n from tickets where company_id = 'c1'"), 0);
    assert.strictEqual(await count("select count(*)::int as n from custom_field_values where id = 'v1'"), 0);
    assert.strictEqual(await count("select count(*)::int as n from step_approvers where step_id = 's1'"), 0);
    assert.strictEqual(await count("select count(*)::int as n from ticket_links where id = 'l1'"), 0, 'link to a deleted ticket');
    assert.strictEqual(await count("select count(*)::int as n from user_profiles where user_id in ('admin1', 'alice')"), 0, 'people only in c1');
    assert.strictEqual(await count("select count(*)::int as n from user_profiles where user_id = 'bob'"), 1, 'bob is also in c2');
    assert.strictEqual(await count("select count(*)::int as n from user_role_assignments where user_id = 'bob'"), 1, 'only his c2 role stays');
    assert.strictEqual(await count("select count(*)::int as n from tickets where company_id = 'c2'"), 1);
    assert.strictEqual(await count("select count(*)::int as n from custom_fields where id = 'cf2'"), 1);
    const c1 = (await pg.query("select is_active, email_reply_to, email_footer, drive_connection_id from companies where id = 'c1'")).rows[0];
    assert.deepStrictEqual([c1.is_active, c1.email_reply_to, c1.email_footer, c1.drive_connection_id], [false, null, null, null]);
    assert.strictEqual(await count("select count(*)::int as n from company_subscriptions where id = 'cs1'"), 1, 'billing kept');
    assert.strictEqual(await count("select count(*)::int as n from contract_acceptances where company_id = 'c1'"), 2, 'contract record kept');
    assert.strictEqual(await count("select count(*)::int as n from admin_action_logs where action_type = 'DELETE_COMPANY_DATA'"), 1);
    const again = await runDelete(client, 'c1', { now: NOW });
    assert.strictEqual(Object.values(again.counts).reduce((a, b) => a + b, 0), 0, 'a second dry run finds nothing');
  });

  await pg.close();
}

(async () => {
  await offline();
  if (pgliteDir) await online();
  let failed = 0;
  for (const [ok, name, err] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) { failed += 1; console.log(`      ${err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n      ') : err}`); }
  }
  console.log(`\n${results.length - failed}/${results.length} passed${pgliteDir ? ' (with PGlite)' : ' (offline only - add --pglite <dir> for the database cases)'}`);
  process.exit(failed ? 1 : 0);
})();
