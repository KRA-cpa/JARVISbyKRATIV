// Usage: node appscript_files/tools/ROUTES_TEST_v10.0.js appscript_files/APPSCRIPT_v10.0_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v10.0 (docs/planning/PLAN_v10.0_Build_20261031.md) on the fake Sheets runtime, AUTH_MODE
// enforce with the proxy's identity fields. M1: ticket visibility per ticket type (private / collaborative), who can
// create, getCreatableTicketTypes, every ticket read path filtered (a hidden ticket answers like a missing one), the
// visibility switch, D1 (warn without an actor = unfiltered, logged), report dates, one read per tab (A16).
// Run the older suites on the same file too (ROUTES_TEST_v9.7.js ... CODE_REVIEW_FIXES_TEST_v8.3.js, SEED_TEST.js,
// ADMIN_TOOLS_TEST.js) with TZ=Asia/Manila.
const assert = require('assert');
const fs = require('fs');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v10.0.js <APPSCRIPT file>');
  process.exit(2);
}
const { test, report } = lib.makeTestRunner();
const SECRET = 's';

/**
 * co_1 + co_2. Ticket types: tt_priv (private, sharing on) and tt_collab (collaborative), one Manager step each in co_1.
 * Users (all with profiles):
 *   u_req   Requester on tt_priv + tt_collab in co_1 (creates the tickets)
 *   u_peer  Requester in co_1 with no ticket type (= every type) - another requester
 *   u_mgr   Manager in co_1 (approver of both steps)
 *   u_admin System Admin
 *   u_far   Requester in co_2 only
 * options.mode: AUTH_MODE (default enforce)
 */
function seed(options = {}) {
  const rt = lib.makeRuntime(FILE, { properties: { AUTH_MODE: options.mode || 'enforce', PROXY_SECRET: SECRET, LINK_ALLOWED_HOSTS: '*' } });
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (tableName, record) => rt.sheets.get(tableName).appendRow(rt.ctx.rowFromRecord(S[tableName], record));
  const rows = tableName => rt.ctx.readTable(tableName).records;

  add('companies', { id: 'co_1', name: 'Main Co', code: 'MYCO', is_active: true });
  add('companies', { id: 'co_2', name: 'Far Co', code: 'FARC', is_active: true });
  add('ticket_types', { id: 'tt_priv', code: 'PR', name: 'Purchase', is_active: true, enable_sharing: true, enable_tags: true });
  add('ticket_types', { id: 'tt_collab', code: 'IT', name: 'IT Request', is_active: true, visibility: 'collaborative' });
  add('roles', { id: 'r_req', name: 'Requester', is_active: true });
  add('roles', { id: 'r_mgr', name: 'Manager', is_active: true });
  add('roles', { id: 'r_admin', name: 'System Admin', is_active: true });
  ['tt_priv', 'tt_collab'].forEach((type, i) => {
    add('workflow_steps', { id: `ws_${i + 1}`, ticket_type_id: type, company_id: 'co_1', name: 'Managers', status_on_reach: 'Pending',
      step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
    add('step_approvers', { step_id: `ws_${i + 1}`, role_id: 'r_mgr' });
  });
  const grant = (user_id, role_id, company_id, ticket_type_id = '') => {
    const res = rt.ctx.createUserRoleAssignment({ user_id, role_id, company_id, ticket_type_id });
    assert.strictEqual(res.status, 'success', res.message);
  };
  grant('u_req', 'r_req', 'co_1', 'tt_priv');
  grant('u_req', 'r_req', 'co_1', 'tt_collab');
  grant('u_peer', 'r_req', 'co_1');
  grant('u_mgr', 'r_mgr', 'co_1');
  grant('u_admin', 'r_admin', 'co_1');
  grant('u_far', 'r_req', 'co_2');
  ['u_req', 'u_peer', 'u_mgr', 'u_admin', 'u_far'].forEach(uid =>
    add('user_profiles', { user_id: uid, display_name: uid, email: `${uid}@example.com`, status: 'active', is_active: true }));
  rt.cache.clear();

  const as = (uid, body) => rt.post({ ...body, _proxy_secret: SECRET, _auth_uid: uid });
  const asGet = (uid, params) => rt.get({ ...params, _proxy_secret: SECRET, _auth_uid: uid });
  const ok = res => { assert.strictEqual(res.success, true, res.error); return res.data; };
  const createTicket = (type, uid = 'u_req', company = 'co_1') => String(ok(as(uid, { action: 'createTicket', title: `${type} ticket`,
    ticket_type_id: type, requester_id: uid, company_id: company })).id);
  const visibleIds = uid => ok(asGet(uid, { action: 'getTickets' })).map(t => String(t.id)).sort();
  const logs = [];
  rt.ctx.console.log = (...args) => logs.push(args.join(' '));
  return { rt, add, rows, as, asGet, ok, createTicket, visibleIds, logs };
}

/** Every one-ticket read path, as uid, for a ticket id. */
function readPaths(env, uid, id) {
  const { as, asGet } = env;
  return {
    getTicket: as(uid, { action: 'getTicket', ticket_id: id }),
    getTicketHistory: asGet(uid, { action: 'getTicketHistory', ticket_id: id }),
    getStepApprovals: as(uid, { action: 'getStepApprovals', ticket_id: id, step_id: 'ws_1' }),
    getTicketTags: asGet(uid, { action: 'getTicketTags', ticket_id: id }),
    getTicketShares: asGet(uid, { action: 'getTicketShares', ticket_id: id }),
    getTicketAttachments: asGet(uid, { action: 'getTicketAttachments', ticket_id: id })
  };
}

// --- Visibility matrix ------------------------------------------------------------------------------------------

test('private type: the requester, the approver role and an admin see it; another requester and another company do not', () => {
  const env = seed();
  const id = env.createTicket('tt_priv');
  ['u_req', 'u_mgr', 'u_admin'].forEach(uid => {
    assert.deepStrictEqual(env.visibleIds(uid), [id], uid);
    Object.entries(readPaths(env, uid, id)).forEach(([path, res]) => assert.strictEqual(res.success, true, `${uid} ${path}: ${res.error}`));
  });
  ['u_peer', 'u_far'].forEach(uid => {
    assert.deepStrictEqual(env.visibleIds(uid), [], uid);
    Object.entries(readPaths(env, uid, id)).forEach(([path, res]) => assert.strictEqual(res.success, false, `${uid} ${path} must be hidden`));
  });
});

test('collaborative type: any role on the type + company sees it (another requester too); another company does not', () => {
  const env = seed();
  const id = env.createTicket('tt_collab');
  ['u_req', 'u_peer', 'u_mgr', 'u_admin'].forEach(uid => assert.deepStrictEqual(env.visibleIds(uid), [id], uid));
  assert.deepStrictEqual(env.visibleIds('u_far'), []);
  assert.strictEqual(env.as('u_peer', { action: 'getTicket', ticket_id: id }).success, true);
  assert.strictEqual(env.as('u_far', { action: 'getTicket', ticket_id: id }).success, false);
});

test('a hidden ticket answers exactly like a missing one on every read path (no existence leak)', () => {
  const env = seed();
  const id = env.createTicket('tt_priv');
  const missing = '999999';
  const hidden = readPaths(env, 'u_peer', id);
  const absent = readPaths(env, 'u_peer', missing);
  Object.keys(hidden).forEach(path => {
    const strip = res => JSON.stringify(res).split(id).join('<id>').split(missing).join('<id>');
    assert.strictEqual(strip(hidden[path]), strip(absent[path]), path);
  });
});

test('lists: getTickets, getDashboard counts, searchTicketsByTags, getTicketLinks and getReportData show only visible tickets', () => {
  const env = seed();
  const mine = env.createTicket('tt_priv');
  const peers = env.createTicket('tt_priv', 'u_peer');
  const shared = env.createTicket('tt_collab', 'u_peer');
  assert.deepStrictEqual(env.visibleIds('u_req'), [mine, shared].sort());
  assert.deepStrictEqual(env.visibleIds('u_mgr'), [mine, peers, shared].sort());

  const counts = env.ok(env.asGet('u_req', { action: 'getDashboard' })).counts;
  assert.strictEqual(counts.total, 2);
  assert.strictEqual(counts.mine, 1);
  assert.strictEqual(env.ok(env.asGet('u_admin', { action: 'getDashboard' })).counts.total, 3);

  const search = env.ok(env.asGet('u_req', { action: 'searchTicketsByTags', exclude_tag_ids: 'tag_none' })).ticket_ids.sort();
  assert.deepStrictEqual(search, [mine, shared].sort());

  // a link shows when one side is visible; the hidden side carries no details
  env.add('ticket_links', { id: 'lk_1', parent_ticket_id: mine, child_ticket_id: peers, link_type: 'related', company_id: 'co_1', is_active: true });
  env.add('ticket_links', { id: 'lk_2', parent_ticket_id: peers, child_ticket_id: '424242', link_type: 'related', company_id: 'co_1', is_active: true });
  const links = env.ok(env.asGet('u_req', { action: 'getTicketLinks' }));
  assert.deepStrictEqual(links.map(l => l.id), ['lk_1']);
  assert.strictEqual(links[0].child_title, '', 'the hidden child shows no title');
  assert.strictEqual(links[0].child_ticket_number, '');
  assert.ok(links[0].parent_title, 'the visible parent shows its title');

  const reportFor = uid => env.ok(env.asGet(uid, { action: 'getReportData', ticket_type_id: 'tt_priv', company_id: 'co_1', user_id: uid }));
  assert.deepStrictEqual(reportFor('u_req').rows.map(r => r.ticket_id), [mine]);
  assert.deepStrictEqual(reportFor('u_mgr').rows.map(r => r.ticket_id).sort(), [mine, peers].sort());
  assert.strictEqual(reportFor('u_admin').scope, 'all');
});

test('shares, participants and escalate_role grants make a private ticket visible; a revoked share hides it again', () => {
  const env = seed();
  const id = env.createTicket('tt_priv');
  const share = env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_far', permission_level: 'view' }));
  assert.deepStrictEqual(env.visibleIds('u_far'), [id]);
  env.ok(env.as('u_req', { action: 'revokeTicketShare', collaboration_id: share.id }));
  assert.deepStrictEqual(env.visibleIds('u_far'), []);
  // a company share reaches everyone with a role in that company
  env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: id, shared_with_company_id: 'co_2', permission_level: 'view' }));
  assert.deepStrictEqual(env.visibleIds('u_far'), [id]);

  const other = env.createTicket('tt_priv');
  env.add('ticket_participants', { id: 'tp_1', ticket_id: other, user_id: 'u_peer', reason: 'acted', company_id: 'co_1',
    ticket_type_id: 'tt_priv', created_at: new Date().toISOString(), is_active: true });
  assert.ok(env.visibleIds('u_peer').includes(other), 'participant row');
  env.add('ticket_participants', { id: 'tp_2', ticket_id: other, user_id: 'u_far', reason: 'acted', is_active: false });
  assert.ok(!env.visibleIds('u_far').includes(other), 'an inactive participant row gives nothing');

  env.add('roles', { id: 'r_head', name: 'Head', is_active: true });
  env.rt.ctx.createUserRoleAssignment({ user_id: 'u_far', role_id: 'r_head', company_id: 'co_1', ticket_type_id: 'tt_collab' });
  env.add('sla_escalation_events', { id: 'ev_1', ticket_id: other, company_id: 'co_1', step_id: 'ws_1', escalation_action: 'escalate_role',
    granted_role_ids: JSON.stringify(['r_head']), is_active: true });
  assert.ok(env.visibleIds('u_far').includes(other), 'escalate_role grant');
});

// --- Who can create -----------------------------------------------------------------------------------------------

test('createTicket: a role on the type + company is needed (enforce refuses; a role without a type covers every type)', () => {
  const env = seed();
  const refused = env.as('u_far', { action: 'createTicket', title: 'x', ticket_type_id: 'tt_priv', requester_id: 'u_far', company_id: 'co_1' });
  assert.strictEqual(refused.success, false);
  assert.match(refused.error, /You can't create Purchase tickets in Main Co/);
  assert.ok(!env.rows('tickets').some(t => t.requester_id === 'u_far'), 'nothing written');
  env.createTicket('tt_priv', 'u_peer'); // no ticket type on the assignment = every type
  env.createTicket('tt_collab', 'u_admin'); // admins always
  // the claimed requester does not decide in enforce: u_far can't create as u_req
  const forged = env.as('u_far', { action: 'createTicket', title: 'x', ticket_type_id: 'tt_priv', requester_id: 'u_req', company_id: 'co_1' });
  assert.strictEqual(forged.success, false);
});

test('createTicket in warn: refused creates are logged and continue (rollout, as the v9.6 admin gate)', () => {
  const env = seed({ mode: 'warn' });
  const res = env.rt.post({ action: 'createTicket', title: 'x', ticket_type_id: 'tt_priv', requester_id: 'u_far', company_id: 'co_1' });
  assert.strictEqual(res.success, true, res.error);
  assert.ok(env.logs.some(l => /AUTH warn: createTicket by u_far without a role on ticket type tt_priv in company co_1/.test(l)), env.logs.join('\n'));
});

test('getCreatableTicketTypes: the types the user may create, with the companies where they may', () => {
  const env = seed();
  const list = uid => env.ok(env.asGet(uid, { action: 'getCreatableTicketTypes' }));
  const req = list('u_req');
  assert.deepStrictEqual(req.map(t => t.id).sort(), ['tt_collab', 'tt_priv']);
  req.forEach(t => assert.deepStrictEqual(t.creatable_company_ids, ['co_1']));
  assert.strictEqual(req.find(t => t.id === 'tt_priv').visibility, 'private');
  assert.deepStrictEqual(list('u_far').map(t => t.creatable_company_ids), [['co_2'], ['co_2']]);
  assert.deepStrictEqual(list('u_admin').find(t => t.id === 'tt_priv').creatable_company_ids, ['co_1', 'co_2']);
  assert.deepStrictEqual(env.ok(env.asGet('u_far', { action: 'getCreatableTicketTypes', company_id: 'co_1' })), []);
  env.add('ticket_types', { id: 'tt_off', code: 'OFF', name: 'Old', is_active: false });
  assert.ok(!list('u_admin').some(t => t.id === 'tt_off'), 'inactive types are not offered');
});

// --- Visibility switch --------------------------------------------------------------------------------------------

test('setTicketTypeFeatures visibility: admin switches private <-> collaborative (no lock); bad values refused; blank = private', () => {
  const env = seed();
  const id = env.createTicket('tt_priv');
  assert.deepStrictEqual(env.visibleIds('u_peer'), []);
  const saved = env.ok(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_priv', visibility: 'collaborative' }));
  assert.strictEqual(saved.visibility, 'collaborative');
  assert.deepStrictEqual(env.visibleIds('u_peer'), [id]);
  env.ok(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_priv', visibility: 'private' }));
  assert.deepStrictEqual(env.visibleIds('u_peer'), []);
  assert.match(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_priv', visibility: 'public' }).error, /visibility must be one of private, collaborative/);
  assert.strictEqual(env.as('u_req', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_priv', visibility: 'collaborative' }).code, 'ADMIN_ONLY');
  env.add('ticket_types', { id: 'tt_blank', code: 'BL', name: 'Blank', is_active: true });
  assert.strictEqual(env.rt.ctx.ticketTypeVisibility(env.rows('ticket_types').find(t => t.id === 'tt_blank')), 'private');
});

test('the rebuild defaults existing ticket types to private (D2) and adds the v10.0 tabs and columns', () => {
  const env = seed();
  const S = env.rt.ctx.__TABLE_SCHEMAS;
  ['visibility', 'require_immediate_head_approval', 'confidential_mode', 'confidential_admin_access'].forEach(c => assert.ok(S.ticket_types.includes(c), c));
  ['head_approver_id', 'head_backup_id', 'is_confidential'].forEach(c => assert.ok(S.tickets.includes(c), c));
  assert.ok(S.custom_fields.includes('is_confidential'));
  assert.ok(S.notifications.includes('recipient_role_id'));
  assert.ok(env.rt.sheets.get('ticket_participants') && env.rt.sheets.get('email_outbox'), 'new tabs');
  // an old ticket_types tab without the column: the rebuild fills private
  const sheet = env.rt.sheets.get('ticket_types');
  const i = S.ticket_types.indexOf('visibility');
  sheet.rows = sheet.rows.map(r => r.filter((_, c) => c !== i));
  sheet.dirty = true;
  env.rt.ctx.rebuildAllTablesApply();
  // the column is filled with private for every existing type (tt_collab loses its value with the dropped column)
  assert.ok(env.rows('ticket_types').every(t => t.visibility === 'private'), JSON.stringify(env.rows('ticket_types').map(t => t.visibility)));
});

// --- D1, reports, reads -------------------------------------------------------------------------------------------

test('D1 warn mode: a claimed id is filtered; no actor at all is unfiltered and logged "unscoped"', () => {
  const env = seed({ mode: 'warn' });
  const id = String(env.ok(env.rt.post({ action: 'createTicket', title: 'x', ticket_type_id: 'tt_priv', requester_id: 'u_req', company_id: 'co_1' })).id);
  assert.deepStrictEqual(env.ok(env.rt.get({ action: 'getTickets', user_id: 'u_peer' })).map(t => String(t.id)), []);
  assert.deepStrictEqual(env.ok(env.rt.get({ action: 'getTickets' })).map(t => String(t.id)), [id]);
  assert.ok(env.logs.some(l => /AUTH warn: unscoped getTickets/.test(l)), env.logs.join('\n'));
});

test('reports: the last 90 days without dates; a range over 1 year is refused; truncated is reported', () => {
  const env = seed();
  const recent = env.createTicket('tt_priv');
  const old = env.createTicket('tt_priv');
  env.rt.ctx.updateRecordFields('tickets', old, { created_at: new Date(Date.now() - 200 * 24 * 3600 * 1000) });
  const report = params => env.asGet('u_admin', { action: 'getReportData', ticket_type_id: 'tt_priv', user_id: 'u_admin', ...params });
  const def = env.ok(report({}));
  assert.deepStrictEqual(def.rows.map(r => r.ticket_id), [recent]);
  assert.strictEqual(def.truncated, false);
  assert.ok(def.date_from, 'the default start is reported');
  const longAgo = new Date(Date.now() - 300 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  assert.deepStrictEqual(env.ok(report({ date_from: longAgo })).rows.map(r => r.ticket_id).sort(), [old, recent].sort());
  assert.match(report({ date_from: '2020-01-01', date_to: '2026-01-01' }).error, /at most 1 year/);
});

test('A16: getTickets and getDashboard read each tab at most once (scope included)', () => {
  const env = seed();
  env.createTicket('tt_priv');
  env.createTicket('tt_collab');
  ['getTickets', 'getDashboard'].forEach(action => {
    env.asGet('u_peer', { action });
    const reads = env.rt.reads();
    Object.entries(reads).forEach(([tab, n]) => assert.ok(n <= 1, `${action} read ${tab} ${n} times`));
  });
});

// --- M2: participants ---------------------------------------------------------------------------------------------

/** seed() + a second step on tt_priv (ws_1b, Finance: u_fin) and u_boss as u_req's immediate head (opt-in). */
function seedFlow(options = {}) {
  const env = seed(options);
  env.add('roles', { id: 'r_fin', name: 'Finance', is_active: true });
  env.add('workflow_steps', { id: 'ws_1b', ticket_type_id: 'tt_priv', company_id: 'co_1', name: 'Finance', status_on_reach: 'Pending Finance',
    step_type: 'approval', approver_logic: 'any', sort_order: 2, is_active: true });
  env.add('step_approvers', { step_id: 'ws_1b', role_id: 'r_fin' });
  env.rt.ctx.createUserRoleAssignment({ user_id: 'u_fin', role_id: 'r_fin', company_id: 'co_1' });
  env.add('user_profiles', { user_id: 'u_fin', display_name: 'u_fin', email: 'u_fin@example.com', status: 'active', is_active: true });
  env.add('user_profiles', { user_id: 'u_boss', display_name: 'u_boss', email: 'u_boss@example.com', status: 'active', is_active: true });
  if (options.head) env.rt.ctx.updateRecordFields('user_profiles', 'u_req', { immediate_approver_id: 'u_boss', backup_approver_id: 'u_fin' }, 'user_id');
  env.rt.cache.clear();
  // JSON round trip: arrays made inside the runtime belong to its VM realm (deepStrictEqual compares prototypes)
  const plain = value => JSON.parse(JSON.stringify(value));
  const live = () => env.rows('ticket_participants').filter(p => String(p.is_active).toUpperCase() !== 'FALSE' && p.is_active !== false);
  const users = id => plain(live().filter(p => String(p.ticket_id) === id && p.reason !== 'pool').map(p => `${p.user_id}:${p.reason}`).sort());
  const pools = id => plain(live().filter(p => String(p.ticket_id) === id && p.reason === 'pool')
    .map(p => `${p.role_id}@${p.step_id}:${p.window_end ? 'closed' : 'open'}`));
  const decide = (uid, id, decision) => env.ok(env.as(uid, { action: 'submitStepApproval', ticket_id: id, user_id: uid, decision, comment: 'ok' }));
  return { ...env, live, users, pools, decide };
}

/** Participant rows as comparable keys (no ids or exact times). */
function participantKeys(rows) {
  return JSON.parse(JSON.stringify(participantKeyList(rows)));
}

function participantKeyList(rows) {
  return rows.filter(p => String(p.is_active).toUpperCase() !== 'FALSE' && p.is_active !== false)
    .map(p => (p.reason === 'pool' ? `${p.ticket_id}|pool|${p.role_id}|${p.step_id}|${p.window_end ? 'closed' : 'open'}` : `${p.ticket_id}|${p.user_id}|${p.reason}`))
    .sort();
}

test('M2 participants: create writes requester + head + the first pool; approve / return / reject move the windows', () => {
  const env = seedFlow({ head: true });
  const id = env.createTicket('tt_priv');
  const ticket = env.rows('tickets').find(t => String(t.id) === id);
  assert.strictEqual(ticket.head_approver_id, 'u_boss', 'head snapshot');
  assert.strictEqual(ticket.head_backup_id, 'u_fin', 'backup snapshot');
  assert.deepStrictEqual(env.users(id), ['u_boss:head', 'u_req:requester'], 'the backup gets no row until they act');
  assert.deepStrictEqual(env.pools(id), ['r_mgr@ws_1:open']);
  assert.deepStrictEqual(env.visibleIds('u_boss'), [id], 'the immediate head sees the ticket');

  env.decide('u_mgr', id, 'approve');
  assert.deepStrictEqual(env.users(id), ['u_boss:head', 'u_mgr:acted', 'u_req:requester']);
  assert.deepStrictEqual(env.pools(id), ['r_mgr@ws_1:closed', 'r_fin@ws_1b:open']);
  env.decide('u_fin', id, 'return');
  assert.deepStrictEqual(env.pools(id), ['r_mgr@ws_1:closed', 'r_fin@ws_1b:closed', 'r_mgr@ws_1:open'], 'a return opens a new window');
  env.decide('u_mgr', id, 'approve'); // the same user again: no second acted row
  env.decide('u_fin', id, 'reject');
  assert.deepStrictEqual(env.users(id), ['u_boss:head', 'u_fin:acted', 'u_mgr:acted', 'u_req:requester']);
  assert.ok(env.pools(id).every(p => p.endsWith('closed')), 'rejected: every window closed');
});

test('M2 participants: cancel closes the window; a reopen to the same step opens a new one (R-06)', () => {
  const env = seedFlow();
  const id = env.createTicket('tt_priv');
  env.ok(env.as('u_req', { action: 'updateTicketStatus', ticket_id: id, status: 'Cancelled', reason: 'no longer needed', user_id: 'u_req' }));
  assert.deepStrictEqual(env.pools(id), ['r_mgr@ws_1:closed']);
  env.ok(env.as('u_admin', { action: 'updateTicketStatus', ticket_id: id, status: 'Reopened', step_id: 'ws_1', user_id: 'u_admin' }));
  assert.deepStrictEqual(env.pools(id), ['r_mgr@ws_1:closed', 'r_mgr@ws_1:open']);
});

test('M2 participants: a user share adds a shared row, revoke ends it; the row alone never grants access (expiry wins)', () => {
  const env = seedFlow();
  const id = env.createTicket('tt_priv');
  const share = env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_far', permission_level: 'view' }));
  assert.ok(env.users(id).includes('u_far:shared'));
  env.ok(env.as('u_req', { action: 'revokeTicketShare', collaboration_id: share.id }));
  assert.ok(!env.users(id).includes('u_far:shared'), 'revoked: the row is ended (soft)');

  const again = env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_far', permission_level: 'view',
    expiration_date: '2999-01-01' }));
  assert.deepStrictEqual(env.visibleIds('u_far'), [id]);
  env.rt.ctx.updateRecordFields('ticket_collaborations', again.id, { expiration_date: '2020-01-01' });
  assert.ok(env.users(id).includes('u_far:shared'), 'the row is still there');
  assert.deepStrictEqual(env.visibleIds('u_far'), [], 'but an expired share gives no access');
});

test('M2 head snapshot: a head set before the v10.0 rebuild is refused loudly (C4), not dropped', () => {
  const env = seedFlow({ head: true });
  const sheet = env.rt.sheets.get('tickets');
  const S = env.rt.ctx.__TABLE_SCHEMAS.tickets;
  const keep = S.map((c, i) => (['head_approver_id', 'head_backup_id', 'is_confidential'].includes(c) ? -1 : i)).filter(i => i >= 0);
  sheet.rows = sheet.rows.map(r => keep.map(i => r[i]));
  sheet.dirty = true;
  const res = env.as('u_req', { action: 'createTicket', title: 'x', ticket_type_id: 'tt_priv', requester_id: 'u_req', company_id: 'co_1' });
  assert.strictEqual(res.success, false);
  assert.match(res.error, /no head_approver_id, head_backup_id column/);
});

test('M2 backfill: dry run writes nothing; apply rebuilds what the live writers wrote; a second apply adds nothing', () => {
  const env = seedFlow({ head: true });
  const a = env.createTicket('tt_priv');
  env.decide('u_mgr', a, 'approve');
  env.decide('u_fin', a, 'return');
  const b = env.createTicket('tt_collab', 'u_peer');
  env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: a, shared_with_user_id: 'u_far', permission_level: 'view' }));
  const liveKeys = participantKeys(env.rows('ticket_participants'));

  const sheet = env.rt.sheets.get('ticket_participants');
  sheet.rows = sheet.rows.slice(0, 1); // header only: as before v10.0
  sheet.dirty = true;
  const dry = env.rt.ctx.backfillTicketParticipants({ dryRun: true });
  assert.strictEqual(dry.written, 0);
  assert.strictEqual(env.rows('ticket_participants').length, 0, 'dry run wrote nothing');
  assert.ok(dry.planned.pool > 0 && dry.planned.acted === 2 && dry.planned.shared === 1, JSON.stringify(dry.planned));
  const applied = env.rt.ctx.backfillTicketParticipants({ dryRun: false });
  assert.strictEqual(applied.written, dry.planned.requester + dry.planned.head + dry.planned.acted + dry.planned.shared + dry.planned.pool);
  assert.deepStrictEqual(participantKeys(env.rows('ticket_participants')), liveKeys, 'backfill = live writers');
  assert.ok(String(b).length > 0);
  const second = env.rt.ctx.backfillTicketParticipants({ dryRun: false });
  assert.strictEqual(second.written, 0, 'idempotent');
});

test('M2 backfill on the SEED data matches a history replay of the live writers', () => {
  const dir = require('path').dirname(FILE);
  const seeds = fs.readdirSync(dir).filter(n => /^SEED_TestData_v\d+\.\d+_\d{8}_\d{4}\.txt$/.test(n)).sort((x, y) => x.slice(-17).localeCompare(y.slice(-17)));
  if (!seeds.length) { console.log('      (no SEED_TestData file next to the AppScript file - skipped)'); return; }
  const combined = require('path').join(require('os').tmpdir(), `v10_seed_${process.pid}.js`);
  fs.writeFileSync(combined, fs.readFileSync(FILE, 'utf8') + '\n;\n' + fs.readFileSync(require('path').join(dir, seeds[seeds.length - 1]), 'utf8'));
  const rt = lib.makeRuntime(combined);
  rt.ctx.rebuildAllTablesApply();
  rt.ctx.seedTestDataApply('');
  const rows = () => rt.ctx.readTable('ticket_participants').records;
  const liveKeys = participantKeys(rows());
  assert.ok(liveKeys.length > 20, `the seed drives tickets through the engine (${liveKeys.length} rows)`);
  const sheet = rt.sheets.get('ticket_participants');
  sheet.rows = sheet.rows.slice(0, 1);
  sheet.dirty = true;
  rt.ctx.backfillTicketParticipants({ dryRun: false });
  assert.deepStrictEqual(participantKeys(rows()), liveKeys);
  rt.ctx.removeSeedDataApply();
  assert.strictEqual(rows().length, 0, 'seed removal takes its participants too (SEED v1.1)');
});

test('ping reports 10.0.0 = header Version; the file has one definition of each new helper (A20)', () => {
  const env = seed();
  assert.strictEqual(env.rt.get({ action: 'ping' }).version, '10.0.0');
  const source = fs.readFileSync(FILE, 'utf8');
  assert.match(source, /\* Version: 10\.0 /);
  ['buildActorScope', 'canViewTicket', 'canCreateTicket', 'ticketReadGuard', 'getCreatableTicketTypes', 'mayReadTicket'].forEach(name =>
    assert.strictEqual((source.match(new RegExp(`^function ${name}\\(`, 'gm')) || []).length, 1, name));
  assert.ok(!/function canSeeTicketLinks\(/.test(source), 'the v9.6 interim rule is gone (C2)');
});

report();
