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
  const rt = lib.makeRuntime(FILE, { properties: { AUTH_MODE: options.mode || 'enforce', PROXY_SECRET: SECRET, LINK_ALLOWED_HOSTS: '*',
    ...(options.properties || {}) }, ...(options.mailQuota !== undefined ? { mailQuota: options.mailQuota } : {}) });
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

// --- M3: paging + search ------------------------------------------------------------------------------------------

/** n tickets of tt_collab by u_req, created a minute apart (oldest first); returns their ids. */
function manyTickets(env, n, titleOf = i => `Ticket ${i}`) {
  const base = Date.now() - n * 60 * 1000;
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = String(env.ok(env.as('u_req', { action: 'createTicket', title: titleOf(i), ticket_type_id: 'tt_collab',
      requester_id: 'u_req', company_id: 'co_1' })).id);
    env.rt.ctx.updateRecordFields('tickets', id, { created_at: new Date(base + i * 60 * 1000) });
    ids.push(id);
  }
  return ids;
}

test('M3 paging: newest first, limit pages, no gaps or duplicates while new tickets are created between pages', () => {
  const env = seed();
  const ids = manyTickets(env, 7);
  const page = (cursor, limit = 3) => env.ok(env.asGet('u_peer', { action: 'getTickets', limit, ...(cursor ? { cursor } : {}) }));
  const p1 = page();
  assert.deepStrictEqual(p1.items.map(t => String(t.id)), [ids[6], ids[5], ids[4]]);
  assert.strictEqual(p1.has_more, true);
  manyTickets(env, 1); // a new ticket (newest) arrives between pages: it must not shift the next page
  const p2 = page(p1.next_cursor);
  assert.deepStrictEqual(p2.items.map(t => String(t.id)), [ids[3], ids[2], ids[1]]);
  const p3 = page(p2.next_cursor);
  assert.deepStrictEqual(p3.items.map(t => String(t.id)), [ids[0]]);
  assert.strictEqual(p3.has_more, false);
  assert.strictEqual(p3.next_cursor, null);
  assert.ok(!('total' in p1), 'no total count (design §4.3)');
  // same created_at: the id breaks the tie, still no duplicates across pages
  const tied = new Date('2026-10-01T00:00:00Z');
  ids.forEach(id => env.rt.ctx.updateRecordFields('tickets', id, { created_at: tied }));
  const seen = [];
  let cursor = null;
  do {
    const p = env.ok(env.asGet('u_peer', { action: 'getTickets', limit: 2, filters: JSON.stringify({ date_to: '2026-10-02' }), ...(cursor ? { cursor } : {}) }));
    p.items.forEach(t => seen.push(String(t.id)));
    cursor = p.next_cursor;
  } while (cursor);
  assert.deepStrictEqual(seen.slice().sort(), ids.slice().sort());
  assert.strictEqual(new Set(seen).size, seen.length, 'no duplicates');
});

test('M3 limit: default 50, max 100; a bad cursor starts from the top', () => {
  const env = seed();
  manyTickets(env, 3);
  assert.strictEqual(env.ok(env.asGet('u_req', { action: 'getTickets', limit: 'x' })).items.length, 3);
  assert.strictEqual(env.ok(env.asGet('u_req', { action: 'getTickets', limit: 500, cursor: 'garbage' })).items.length, 3);
  const source = fs.readFileSync(FILE, 'utf8');
  assert.match(source, /const TICKET_PAGE_DEFAULT = 50;/);
  assert.match(source, /const TICKET_PAGE_MAX = 100;/);
});

test('M3 filters + search: status (open / closed / exact), company, type, mine, involved, dates, q', () => {
  const env = seedFlow();
  const [a, b] = manyTickets(env, 2, i => ['Laptop for Ana', 'Office chairs'][i]);
  const priv = env.createTicket('tt_priv', 'u_peer');
  env.decide('u_mgr', priv, 'reject');
  const ids = (uid, filters) => env.ok(env.asGet(uid, { action: 'getTickets', limit: 50, filters: JSON.stringify(filters) })).items.map(t => String(t.id)).sort();
  assert.deepStrictEqual(ids('u_mgr', { status: ['closed'] }), [priv]);
  assert.deepStrictEqual(ids('u_mgr', { status: 'open' }), [a, b].sort());
  assert.deepStrictEqual(ids('u_mgr', { status: ['Rejected'] }), [priv]);
  assert.deepStrictEqual(ids('u_mgr', { ticket_type_id: 'tt_priv' }), [priv]);
  assert.deepStrictEqual(ids('u_mgr', { company_id: 'co_2' }), []);
  assert.deepStrictEqual(ids('u_peer', { mine: true }), [priv]);
  assert.deepStrictEqual(ids('u_mgr', { involved: true }), [priv], 'u_mgr acted on it');
  assert.deepStrictEqual(ids('u_mgr', { q: 'laptop' }), [a]);
  assert.deepStrictEqual(ids('u_mgr', { q: 'chairs office' }), [b], 'every word, any order');
  const number = env.rows('tickets').find(t => String(t.id) === priv).ticket_number;
  assert.deepStrictEqual(ids('u_mgr', { q: number.slice(0, 8).toLowerCase() }).includes(priv), true, 'ticket number prefix');
  assert.deepStrictEqual(ids('u_mgr', { date_from: '2999-01-01' }), []);
  // top-level keys work too (POST bodies), and the visibility filter still applies to pages
  assert.deepStrictEqual(env.ok(env.as('u_req', { action: 'getTickets', limit: 10, status: 'closed' })).items, []);
  assert.deepStrictEqual(ids('u_far', {}), []);
});

test('M3 compat: without limit the old array answer stays for v10.0 (logged DEPRECATED); links only for the page', () => {
  const env = seed();
  const [a, b] = manyTickets(env, 2);
  env.add('ticket_links', { id: 'lk_c', parent_ticket_id: a, child_ticket_id: b, link_type: 'chained', company_id: 'co_1', is_active: true });
  const old = env.ok(env.asGet('u_req', { action: 'getTickets' }));
  assert.ok(Array.isArray(old));
  assert.ok(env.logs.some(l => /DEPRECATED getTickets without limit/.test(l)));
  const page = env.ok(env.asGet('u_req', { action: 'getTickets', limit: 1 })).items;
  assert.deepStrictEqual(page.map(t => String(t.id)), [b]);
  assert.strictEqual(String(page[0].chained_parent), a, 'the page item still carries its links');
});

test('M3 read budget (P10): a page reads each tab once and at most 10 tabs (design §5.4 + shares + escalation grants)', () => {
  const env = seed();
  manyTickets(env, 5);
  const ask = () => env.asGet('u_peer', { action: 'getTickets', limit: 2, filters: JSON.stringify({ involved: true, q: 'ticket' }) });
  ask(); // warms the v9.6 allow-list cache (CacheService allow:<uid>), as for every request after a user's first
  ask();
  const reads = env.rt.reads();
  Object.entries(reads).forEach(([tab, n]) => assert.ok(n <= 1, `${tab} read ${n} times`));
  assert.ok(Object.keys(reads).length <= 10, JSON.stringify(reads));
});

// --- M4: Restricted tickets + fields ------------------------------------------------------------------------------

const SECRET_TITLE = 'TOPSECRET-TITLE';
const SECRET_VALUE = 'SECRET-123456';
const STUB_KEYS = ['company_id', 'confidential', 'created_at', 'id', 'status', 'ticket_number', 'ticket_type_id'];

/**
 * seed() + tt_sec (Restricted optional, sharing on, collaborative): steps ws_s1 (Manager) -> ws_s2 (Finance: u_fin);
 * fields cf_salary (Restricted) and cf_note; report columns title + both fields. u_mgr2 gets Manager later (per test).
 */
function seedSecret(options = {}) {
  const env = seed(options);
  env.add('ticket_types', { id: 'tt_sec', code: 'HR', name: 'HR case', is_active: true, enable_sharing: true, visibility: 'collaborative',
    confidential_mode: options.mode || 'optional', confidential_admin_access: options.adminAccess || 'reveal_with_reason' });
  env.add('roles', { id: 'r_fin', name: 'Finance', is_active: true });
  env.add('workflow_steps', { id: 'ws_s1', ticket_type_id: 'tt_sec', company_id: 'co_1', name: 'Managers', status_on_reach: 'Pending Managers',
    step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
  env.add('workflow_steps', { id: 'ws_s2', ticket_type_id: 'tt_sec', company_id: 'co_1', name: 'Finance', status_on_reach: 'Pending Finance',
    step_type: 'approval', approver_logic: 'any', sort_order: 2, is_active: true });
  env.add('step_approvers', { step_id: 'ws_s1', role_id: 'r_mgr' });
  env.add('step_approvers', { step_id: 'ws_s2', role_id: 'r_fin' });
  env.rt.ctx.createUserRoleAssignment({ user_id: 'u_req', role_id: 'r_req', company_id: 'co_1', ticket_type_id: 'tt_sec' });
  env.rt.ctx.createUserRoleAssignment({ user_id: 'u_fin', role_id: 'r_fin', company_id: 'co_1' });
  env.add('custom_fields', { id: 'cf_salary', ticket_type_id: 'tt_sec', entity_category: 'ticket', name: 'salary', label: 'Salary', type: 'text',
    is_active: true, is_confidential: true, sort_order: 1 });
  env.add('custom_fields', { id: 'cf_note', ticket_type_id: 'tt_sec', entity_category: 'ticket', name: 'note', label: 'Note', type: 'text',
    is_active: true, is_confidential: false, sort_order: 2 });
  ['u_fin', 'u_mgr2', 'u_old'].forEach(uid =>
    env.add('user_profiles', { user_id: uid, display_name: uid, email: `${uid}@example.com`, status: 'active', is_active: true }));
  env.rt.cache.clear();
  env.ok(env.as('u_admin', { action: 'saveReportConfig', ticket_type_id: 'tt_sec', company_id: 'co_1',
    columns: ['ticket_number', 'title', 'status', 'cf_salary', 'cf_note'].map(f => ({ field_name: f })) }));
  const create = (restricted, title = SECRET_TITLE) => String(env.ok(env.as('u_req', { action: 'createTicket', title, ticket_type_id: 'tt_sec',
    requester_id: 'u_req', company_id: 'co_1', is_confidential: restricted, customData: { cf_salary: SECRET_VALUE, cf_note: 'plain note' } })).id);
  /** Everything the uid can read about a ticket, as one JSON text. */
  const everything = (uid, id) => JSON.stringify([
    env.asGet(uid, { action: 'getTickets', limit: 50 }),
    env.asGet(uid, { action: 'getTickets' }),
    env.as(uid, { action: 'getTicket', ticket_id: id }),
    env.asGet(uid, { action: 'getTicketHistory', ticket_id: id }),
    env.as(uid, { action: 'getStepApprovals', ticket_id: id, step_id: 'ws_s1' }),
    env.asGet(uid, { action: 'getTicketLinks' }),
    env.asGet(uid, { action: 'getTicketAttachments', ticket_id: id }),
    env.asGet(uid, { action: 'getReportData', ticket_type_id: 'tt_sec', company_id: 'co_1', user_id: uid }),
    env.asGet(uid, { action: 'getTickets', limit: 50, filters: JSON.stringify({ q: SECRET_TITLE.toLowerCase() }) }),
    env.asGet(uid, { action: 'getDashboard' }),
    env.asGet(uid, { action: 'getTicketActionLogs', ticket_id: id })
  ]);
  const view = (uid, id) => {
    const res = env.as(uid, { action: 'getTicket', ticket_id: id });
    if (!res.success) return 'none';
    return res.data.confidential === true && !('title' in res.data) ? 'stub' : 'full';
  };
  const decide = (uid, id, decision = 'approve') => env.ok(env.as(uid, { action: 'submitStepApproval', ticket_id: id, user_id: uid, decision, comment: 'ok' }));
  return { ...env, create, everything, view, decide };
}

test('M4 Restricted ticket: outsiders in scope get the exact stub everywhere; the title and Restricted values appear nowhere', () => {
  const env = seedSecret();
  const id = env.create(true);
  assert.strictEqual(env.view('u_req', id), 'full', 'requester');
  assert.strictEqual(env.view('u_mgr', id), 'full', 'the current step pool');
  ['u_peer', 'u_fin', 'u_admin'].forEach(uid => {
    assert.strictEqual(env.view(uid, id), 'stub', uid);
    const text = env.everything(uid, id);
    assert.ok(!text.includes(SECRET_TITLE), `${uid}: the title leaked`);
    assert.ok(!text.includes(SECRET_VALUE), `${uid}: the Restricted value leaked`);
  });
  const stub = env.ok(env.as('u_peer', { action: 'getTicket', ticket_id: id }));
  assert.deepStrictEqual(Object.keys(stub).sort(), STUB_KEYS);
  const listed = env.ok(env.asGet('u_peer', { action: 'getTickets', limit: 50 })).items.find(t => String(t.id) === id);
  assert.deepStrictEqual(Object.keys(listed).sort(), STUB_KEYS);
  assert.strictEqual(env.asGet('u_peer', { action: 'getTicketHistory', ticket_id: id }).code, 'RESTRICTED');
  assert.strictEqual(env.view('u_far', id), 'none', 'outside the normal scope: nothing at all');
  assert.ok(!env.everything('u_far', id).includes(SECRET_TITLE));
  // search: the stub matches its ticket number only, never the title
  const number = stub.ticket_number;
  const search = q => env.ok(env.asGet('u_peer', { action: 'getTickets', limit: 50, filters: JSON.stringify({ q }) })).items.map(t => String(t.id));
  assert.deepStrictEqual(search(SECRET_TITLE.toLowerCase()), []);
  assert.deepStrictEqual(search(number.slice(0, 6).toLowerCase()).includes(id), true);
  // report: a stub row, no values
  const row = env.ok(env.asGet('u_peer', { action: 'getReportData', ticket_type_id: 'tt_sec', company_id: 'co_1', user_id: 'u_peer' })).rows[0];
  assert.strictEqual(row.restricted, true);
  assert.strictEqual(row.ticket_number, number);
  assert.strictEqual(row.title, '•••••• Restricted');
});

test('M4 chain: the pool joins when the ticket reaches its step and keeps access; a role got after the step passed does not', () => {
  const env = seedSecret();
  const old = env.rt.ctx.createUserRoleAssignment({ user_id: 'u_old', role_id: 'r_mgr', company_id: 'co_1' });
  const id = env.create(true);
  assert.strictEqual(env.view('u_fin', id), 'stub', 'Finance before the ticket reaches Finance');
  env.decide('u_mgr', id);
  assert.strictEqual(env.view('u_fin', id), 'full', 'Finance once it is at their step');
  assert.strictEqual(env.view('u_mgr', id), 'full', 'the approver who acted');
  assert.strictEqual(env.view('u_old', id), 'full', 'a pool member of the passed step who did not act');
  // u_old loses the role afterwards: still in the chain (held it during the window)
  // ISO text, not a Date: a Date from this (test) realm isn't instanceof the runtime's Date and would lose its ms
  env.rt.ctx.updateRecordFields('user_role_assignments', old.data.id, { is_active: false, deactivated_at: new Date().toISOString() });
  assert.strictEqual(env.view('u_old', id), 'full');
  // u_mgr2 gets Manager after the step passed: in scope (approver of the type), not in the chain
  const pool = env.rows('ticket_participants').filter(p => p.reason === 'pool' && p.step_id === 'ws_s1');
  pool.forEach(p => env.rt.ctx.updateRecordFields('ticket_participants', p.id, { window_start: new Date(Date.now() - 2 * 3600e3), window_end: new Date(Date.now() - 3600e3) }));
  env.rt.ctx.createUserRoleAssignment({ user_id: 'u_mgr2', role_id: 'r_mgr', company_id: 'co_1' });
  assert.strictEqual(env.view('u_mgr2', id), 'stub');
  // a return reopens the Managers window: u_mgr2 is in the pool now
  env.decide('u_fin', id, 'return');
  assert.strictEqual(env.view('u_mgr2', id), 'full', 'a revisit after a return');
});

test('M4 admin access: reveal_with_reason = stub + logged reveal; never = refused; always = full', () => {
  const env = seedSecret();
  const id = env.create(true);
  assert.strictEqual(env.view('u_admin', id), 'stub');
  assert.match(env.as('u_admin', { action: 'revealConfidential', ticket_id: id }).error, /reason/);
  assert.strictEqual(env.as('u_peer', { action: 'revealConfidential', ticket_id: id, reason: 'audit check' }).success, false, 'admins only');
  const revealed = env.ok(env.as('u_admin', { action: 'revealConfidential', ticket_id: id, reason: 'audit check' }));
  assert.strictEqual(revealed.ticket.title, SECRET_TITLE);
  assert.strictEqual(revealed.field_values.cf_salary, SECRET_VALUE);
  assert.ok(env.rows('admin_action_logs').some(l => l.action_type === 'REVEAL_RESTRICTED' && String(l.target_id) === id && /audit check/.test(l.details)));
  env.ok(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_sec', confidential_admin_access: 'never' }));
  assert.match(env.as('u_admin', { action: 'revealConfidential', ticket_id: id, reason: 'audit check' }).error, /can't open Restricted content/);
  env.ok(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_sec', confidential_admin_access: 'always' }));
  assert.strictEqual(env.view('u_admin', id), 'full');
});

test('M4 sharing: refused on a Restricted ticket; turning Restricted on later revokes every share (not restored when off)', () => {
  const env = seedSecret();
  const restricted = env.create(true);
  assert.match(env.as('u_req', { action: 'shareTicket', ticket_id: restricted, shared_with_user_id: 'u_far', permission_level: 'view' }).error,
    /Restricted tickets can't be shared/);
  const id = env.create(false, 'Ordinary case');
  env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_far', permission_level: 'view' }));
  env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: id, shared_with_company_id: 'co_2', permission_level: 'view' }));
  assert.strictEqual(env.view('u_far', id), 'full');
  assert.match(env.as('u_admin', { action: 'setTicketRestricted', ticket_id: id, is_confidential: true }).error, /reason/);
  const on = env.ok(env.as('u_admin', { action: 'setTicketRestricted', ticket_id: id, is_confidential: true, reason: 'HR asked' }));
  assert.strictEqual(on.shares_revoked, 2);
  assert.strictEqual(env.view('u_far', id), 'none', 'a shared-only user gets nothing');
  assert.strictEqual(env.view('u_peer', id), 'stub', 'an in-scope user gets the stub');
  assert.ok(env.rows('ticket_collaborations').every(c => c.revocation_reason === 'restricted'));
  assert.ok(!env.rows('ticket_participants').some(p => String(p.ticket_id) === id && p.reason === 'shared' && p.is_active === true));
  assert.ok(!env.ok(env.asGet('u_far', { action: 'getSharedTickets' })).some(t => String(t.id) === id));
  env.ok(env.as('u_admin', { action: 'setTicketRestricted', ticket_id: id, is_confidential: false, reason: 'closed case' }));
  assert.strictEqual(env.view('u_far', id), 'none', 'turning it off does not restore shares');
  assert.strictEqual(env.as('u_req', { action: 'setTicketRestricted', ticket_id: id, is_confidential: true, reason: 'x' }).code, 'ADMIN_ONLY');
});

test('M4 modes: off refuses the tick, optional takes it, always forces it and restricts the existing tickets', () => {
  const env = seedSecret({ mode: 'off' });
  assert.match(env.as('u_req', { action: 'createTicket', title: 'x', ticket_type_id: 'tt_sec', requester_id: 'u_req', company_id: 'co_1',
    is_confidential: true }).error, /doesn't allow Restricted tickets/);
  const before = env.create(false, 'Before always');
  env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: before, shared_with_user_id: 'u_far', permission_level: 'view' }));
  const saved = env.ok(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_sec', confidential_mode: 'always' }));
  assert.strictEqual(saved.confidential_mode, 'always');
  assert.strictEqual(saved.restricted_existing.tickets, 1);
  assert.strictEqual(saved.restricted_existing.shares_revoked, 1);
  assert.strictEqual(env.view('u_peer', before), 'stub');
  const after = env.create(false, 'After always');
  assert.strictEqual(env.view('u_peer', after), 'stub', 'always forces it even without the tick');
  assert.match(env.as('u_admin', { action: 'setTicketRestricted', ticket_id: after, is_confidential: false, reason: 'try' }).error, /mode "always"/);
  assert.match(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_sec', confidential_mode: 'secret' }).error, /confidential_mode must be/);
});

test('M4 Restricted field on an ordinary ticket: masked in reports and system logs outside the chain; the chain sees it', () => {
  const env = seedSecret();
  const id = env.create(false, 'Ordinary with salary');
  const report = uid => env.ok(env.asGet(uid, { action: 'getReportData', ticket_type_id: 'tt_sec', company_id: 'co_1', user_id: uid }));
  const peerRow = report('u_peer').rows.find(r => r.ticket_id === id);
  assert.strictEqual(peerRow.title, 'Ordinary with salary', 'the ticket itself is visible (collaborative)');
  assert.strictEqual(peerRow.cf_salary, '•••••• Restricted');
  assert.strictEqual(peerRow.cf_note, 'plain note');
  assert.ok(!JSON.stringify(report('u_peer')).includes(SECRET_VALUE));
  assert.strictEqual(report('u_req').rows.find(r => r.ticket_id === id).cf_salary, SECRET_VALUE, 'the requester (chain)');
  assert.strictEqual(report('u_mgr').rows.find(r => r.ticket_id === id).cf_salary, SECRET_VALUE, 'the current pool');
  // admin: the system log keeps the create payload, masked unless access is 'always'
  const logs = () => JSON.stringify(env.ok(env.asGet('u_admin', { action: 'getTicketActionLogs', ticket_id: id })));
  assert.ok(!logs().includes(SECRET_VALUE));
  assert.ok(logs().includes('plain note'));
  env.ok(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_sec', confidential_admin_access: 'always' }));
  assert.ok(logs().includes(SECRET_VALUE));
});

test('M4 field switch: Restricted only for ticket fields; turning it off on a field with values is logged', () => {
  const env = seedSecret();
  env.create(false, 'x');
  env.ok(env.as('u_admin', { action: 'updateCustomField', field_id: 'cf_salary', is_confidential: false }));
  assert.ok(env.rows('admin_action_logs').some(l => l.action_type === 'RESTRICTED_FIELD_OFF' && l.target_id === 'cf_salary'));
  env.ok(env.as('u_admin', { action: 'updateCustomField', field_id: 'cf_note', is_confidential: true }));
  assert.strictEqual(env.rows('custom_fields').find(f => f.id === 'cf_note').is_confidential, true);
  env.add('custom_fields', { id: 'cf_prof', ticket_type_id: 'pt_1', entity_category: 'user_profile', name: 'p', label: 'P', type: 'text', is_active: true });
  assert.match(env.as('u_admin', { action: 'updateCustomField', field_id: 'cf_prof', is_confidential: true }).error, /Only ticket fields/);
});

test('createCustomField reads the frontend keys (entityTypeId / entityCategory) and keeps the Restricted switch', () => {
  const env = seedSecret();
  const made = env.ok(env.as('u_admin', { action: 'createCustomField', entityTypeId: 'tt_sec', entityCategory: 'ticket', ticket_type_id: 'tt_sec',
    name: 'ssn', label: 'SSN', type: 'text', is_confidential: true }));
  const row = env.rows('custom_fields').find(f => f.name === 'ssn');
  assert.strictEqual(row.ticket_type_id, 'tt_sec', 'the field belongs to its ticket type');
  assert.strictEqual(row.is_confidential, true);
  env.ok(env.as('u_admin', { action: 'createCustomField', entityTypeId: 'pt_1', entityCategory: 'user_profile', name: 'badge', label: 'Badge',
    type: 'text', is_confidential: true }));
  const profileField = env.rows('custom_fields').find(f => f.name === 'badge');
  assert.strictEqual(profileField.entity_category, 'user_profile');
  assert.notStrictEqual(profileField.is_confidential, true, 'only ticket fields can be Restricted');
  assert.ok(made);
});

test('M4 chained child of a Restricted parent: its own type decides; the parent title is not copied', () => {
  const env = seedSecret();
  env.add('ticket_types', { id: 'tt_child', code: 'CH', name: 'Follow-up', is_active: true });
  env.rt.ctx.updateRecordFields('workflow_steps', 'ws_s2', { next_ticket_type_id: 'tt_child' });
  const id = env.create(true);
  env.decide('u_mgr', id);
  env.decide('u_fin', id);
  const child = env.rows('tickets').find(t => t.ticket_type_id === 'tt_child');
  assert.ok(child, 'chained child created');
  assert.ok(!String(child.title).includes(SECRET_TITLE), child.title);
  assert.notStrictEqual(child.is_confidential, true, 'the child follows its own type (off)');
});

// --- M5: workflow notifications + email outbox --------------------------------------------------------------------

/** seed() + company email on (unless options.emailOff); notices / outbox rows; a run of the 15-minute trigger. */
function seedNotify(options = {}) {
  const env = seed(options);
  if (!options.emailOff) env.rt.ctx.updateRecordFields('companies', 'co_1', { email_enabled: 'on' });
  const notes = uid => env.ok(env.asGet(uid, { action: 'getNotifications' })).items;
  const outbox = () => env.rows('email_outbox');
  const run = () => env.rt.ctx.runSLAEscalations({});
  const decide = (uid, id, decision) => env.ok(env.as(uid, { action: 'submitStepApproval', ticket_id: id, user_id: uid, decision, comment: 'ok' }));
  return { ...env, notes, outbox, run, decide };
}

test('M5 events: create -> awaiting_approval to the step approvers (not the actor); decisions -> the requester', () => {
  const env = seedNotify();
  const id = env.createTicket('tt_collab');
  assert.deepStrictEqual(env.notes('u_mgr').map(n => n.type), ['awaiting_approval']);
  assert.deepStrictEqual(env.notes('u_req'), [], 'the actor (requester) is not told about their own ticket');
  const subject = env.outbox().find(m => m.recipient_user_id === 'u_mgr').subject;
  assert.ok(!subject.includes('tt_collab ticket'), 'no title in the subject');
  assert.match(subject, /^\[JARVIS\] .+ needs your action$/);
  env.decide('u_mgr', id, 'approve');
  assert.deepStrictEqual(env.notes('u_req').map(n => n.type), ['completed']);
  assert.ok(!env.notes('u_mgr').some(n => n.type === 'completed'), 'the approver who acted is not told');

  const second = env.createTicket('tt_collab');
  env.decide('u_mgr', second, 'reject');
  assert.ok(env.notes('u_req').some(n => n.type === 'rejected'));
  const third = env.createTicket('tt_collab');
  env.decide('u_mgr', third, 'return');
  assert.ok(env.notes('u_req').some(n => n.type === 'returned'));
  const fourth = env.createTicket('tt_collab');
  env.ok(env.as('u_admin', { action: 'updateTicketStatus', ticket_id: fourth, status: 'Cancelled', reason: 'dup', user_id: 'u_admin' }));
  assert.ok(env.notes('u_req').some(n => n.type === 'cancelled' && String(n.ticket_id) === fourth));
});

test('M5 fan-out: a role with more than 25 eligible users gets one role notification; each user reads it on their own', () => {
  const env = seedNotify();
  for (let i = 0; i < 26; i++) env.rt.ctx.createUserRoleAssignment({ user_id: `u_m${i}`, role_id: 'r_mgr', company_id: 'co_1' });
  for (let i = 0; i < 2; i++) env.add('user_profiles', { user_id: `u_m${i}`, display_name: `m${i}`, email: `m${i}@example.com`, status: 'active', is_active: true });
  env.rt.cache.clear();
  const before = env.rows('notifications').length;
  env.createTicket('tt_collab');
  const added = env.rows('notifications').slice(before);
  assert.strictEqual(added.length, 1, 'one row for the whole role');
  assert.strictEqual(added[0].recipient_role_id, 'r_mgr');
  assert.strictEqual(added[0].user_id, '');
  assert.strictEqual(env.notes('u_m0').length, 1);
  assert.strictEqual(env.notes('u_far').length, 0, 'no role in that company: nothing');
  env.ok(env.as('u_m0', { action: 'markNotificationsRead', all: true }));
  assert.strictEqual(env.ok(env.asGet('u_m0', { action: 'getNotifications' })).unread_count, 0);
  assert.strictEqual(env.ok(env.asGet('u_m1', { action: 'getNotifications' })).unread_count, 1, 'still unread for another holder');
  assert.strictEqual(env.outbox().length, 0, 'role notifications are in-app only');
});

test('M5 Restricted ticket: notices and emails never carry the title', () => {
  const env = seedSecret();
  env.rt.ctx.updateRecordFields('companies', 'co_1', { email_enabled: 'on' });
  const id = env.create(true);
  env.decide('u_mgr', id);
  const text = JSON.stringify([env.rows('notifications'), env.rows('email_outbox')]);
  assert.ok(text.length > 50);
  assert.ok(!text.includes(SECRET_TITLE));
  assert.ok(!text.includes(SECRET_VALUE));
});

test('M5 outbox drain: one digest per address, sent once; preference off / no address / company off are skipped', () => {
  const env = seedNotify();
  env.add('user_preferences', { user_id: 'u_peer', email_notifications: false });
  env.rt.ctx.updateRecordFields('user_profiles', 'u_admin', { email: '' }, 'user_id');
  env.createTicket('tt_collab');
  env.createTicket('tt_collab'); // two notices for u_mgr -> one digest
  env.ok(env.as('u_req', { action: 'shareTicket', ticket_id: env.createTicket('tt_priv'), shared_with_user_id: 'u_peer', permission_level: 'view' }));
  const first = env.run().data.outbox;
  const toMgr = env.rt.mail.sent.filter(m => m.to === 'u_mgr@example.com');
  assert.strictEqual(toMgr.length, 1, 'one digest');
  assert.match(toMgr[0].subject, /3 ticket updates/);
  assert.ok(first.skipped >= 1, JSON.stringify(first));
  assert.ok(env.outbox().filter(m => m.recipient_user_id === 'u_peer').every(m => m.status === 'skipped'), 'preference off');
  assert.ok(env.outbox().filter(m => m.recipient_user_id === 'u_mgr').every(m => m.status === 'sent'));
  const sentBefore = env.rt.mail.sent.length;
  env.run();
  assert.strictEqual(env.rt.mail.sent.length, sentBefore, 'a second run sends nothing (A19)');

  const off = seedNotify({ emailOff: true });
  off.rt.ctx.updateRecordFields('companies', 'co_1', { email_enabled: 'off' });
  off.createTicket('tt_collab');
  off.run();
  assert.strictEqual(off.rt.mail.sent.length, 0);
  assert.ok(off.outbox().every(m => m.status === 'skipped'));
});

test('M5 outbox drain: quota guard defers the rest; errors retry then fail; a stale sending row is never resent; kill switch', () => {
  const env = seedNotify({ mailQuota: 12 }); // 80 % = 9, and sendCompanyEmail keeps 10 in reserve
  for (let i = 0; i < 4; i++) {
    env.rt.ctx.createUserRoleAssignment({ user_id: `u_a${i}`, role_id: 'r_mgr', company_id: 'co_1' });
    env.add('user_profiles', { user_id: `u_a${i}`, display_name: `a${i}`, email: `a${i}@example.com`, status: 'active', is_active: true });
  }
  env.rt.cache.clear();
  env.createTicket('tt_collab');
  const result = env.run().data.outbox;
  assert.ok(result.deferred > 0, JSON.stringify(result));
  assert.ok(env.outbox().some(m => m.status === 'pending'), 'the rest waits for the next run');
  env.rt.mail.quota = 100;
  env.run();
  assert.ok(env.outbox().every(m => m.status === 'sent'), JSON.stringify(env.outbox().map(m => m.status)));

  const bad = seedNotify();
  bad.createTicket('tt_collab');
  bad.rt.ctx.MailApp = { getRemainingDailyQuota: () => 100, sendEmail: () => { throw new Error('service down'); } };
  bad.run();
  bad.run();
  assert.ok(bad.outbox().every(m => m.status === 'pending' && /service down/.test(m.last_error)));
  bad.run();
  assert.ok(bad.outbox().every(m => m.status === 'failed'), 'failed after 3 attempts');

  const stale = seedNotify();
  stale.createTicket('tt_collab');
  stale.outbox().forEach(m => stale.rt.ctx.updateRecordFields('email_outbox', m.id, { status: 'sending', updated_at: new Date(Date.now() - 3600e3).toISOString() }));
  stale.run();
  assert.strictEqual(stale.rt.mail.sent.length, 0, 'never sent twice');
  assert.ok(stale.outbox().every(m => m.status === 'failed'));

  const killed = seedNotify({ properties: { EMAIL_OUTBOX_ENABLED: 'false' } });
  killed.createTicket('tt_collab');
  assert.strictEqual(killed.run().data.outbox.disabled, true);
  assert.strictEqual(killed.rt.mail.sent.length, 0);
  assert.ok(killed.outbox().every(m => m.status === 'pending'));
});

test('M5 getNotifications: paged (limit + cursor); reads notifications + assignments only (P10)', () => {
  const env = seedNotify();
  for (let i = 0; i < 3; i++) env.createTicket('tt_collab');
  const p1 = env.ok(env.asGet('u_mgr', { action: 'getNotifications', limit: 2 }));
  assert.strictEqual(p1.items.length, 2);
  assert.strictEqual(p1.has_more, true);
  const p2 = env.ok(env.asGet('u_mgr', { action: 'getNotifications', limit: 2, cursor: p1.next_cursor }));
  assert.strictEqual(p2.items.length, 1);
  assert.strictEqual(new Set(p1.items.concat(p2.items).map(n => n.id)).size, 3);
  env.asGet('u_mgr', { action: 'getNotifications' });
  const reads = env.rt.reads();
  assert.deepStrictEqual(Object.keys(reads).sort(), ['notifications', 'user_role_assignments']);
});

// --- v10.0 close: volume ops (design §5.3, §5.5, §7) --------------------------------------------------------------

test('volume: one [perf] line per request with action, duration, tab reads, user, company and status', () => {
  const env = seed();
  env.createTicket('tt_collab');
  env.asGet('u_req', { action: 'getTickets', limit: 10 });
  env.as('u_far', { action: 'createTicket', title: 'x', ticket_type_id: 'tt_priv', requester_id: 'u_far', company_id: 'co_1' });
  const perf = env.logs.filter(l => l.indexOf('[perf] ') === 0).map(l => JSON.parse(l.slice(7)));
  const page = perf.find(p => p.action === 'getTickets');
  assert.ok(page && page.method === 'GET' && page.user_id === 'u_req' && page.status === 'ok' && page.tab_reads > 0, JSON.stringify(page));
  assert.ok(typeof page.duration_ms === 'number');
  const refused = perf.filter(p => p.action === 'createTicket').pop();
  assert.strictEqual(refused.status, 'error');
  assert.strictEqual(refused.company_id, 'co_1');
});

test('volume: size report (cells per tab, migrate signals) and outbox status', () => {
  const env = seed();
  const report = env.rt.ctx.spreadsheetSizeReport();
  assert.ok(report.total_cells > 0 && report.limit === 10000000);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(report.migrate)), []);
  const big = env.rt.sheets.get('ticket_history');
  for (let i = 0; i < 20001; i++) big.rows.push(['h' + i]);
  big.dirty = true;
  assert.ok(env.rt.ctx.spreadsheetSizeReport().migrate.some(m => /ticket_history has 20001 rows/.test(m)));
  env.rt.ctx.updateRecordFields('companies', 'co_1', { email_enabled: 'on' });
  env.createTicket('tt_collab');
  const status = env.rt.ctx.emailOutboxStatus();
  assert.strictEqual(status.by_status.pending, 1);
  assert.strictEqual(status.sending_enabled, true);
});

test('volume: archiveOldLogs moves old read notifications / logs (dry run first, idempotent, needs the archive id)', () => {
  const env = seed();
  assert.match(env.rt.ctx.archiveOldLogs({ dryRun: true }).message, /ARCHIVE_SPREADSHEET_ID/);
  env.rt.props.ARCHIVE_SPREADSHEET_ID = 'archive_1';
  const old = new Date(Date.now() - 400 * 24 * 3600e3).toISOString();
  env.add('notifications', { id: 'n_old', user_id: 'u_req', type: 'completed', is_read: true, is_active: true, created_at: old });
  env.add('notifications', { id: 'n_unread', user_id: 'u_req', type: 'completed', is_read: false, is_active: true, created_at: old });
  env.add('notifications', { id: 'n_new', user_id: 'u_req', type: 'completed', is_read: true, is_active: true, created_at: new Date().toISOString() });
  env.add('admin_action_logs', { id: 'al_old', admin_user_id: 'u_admin', action_type: 'X', timestamp: old });
  const dry = env.rt.ctx.archiveOldLogs({ dryRun: true });
  assert.strictEqual(dry.moved.notifications, 1);
  assert.strictEqual(dry.moved.admin_action_logs, 1);
  assert.ok(env.rows('notifications').some(n => n.id === 'n_old'), 'dry run moved nothing');
  env.rt.ctx.archiveOldLogs({ dryRun: false });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(env.rows('notifications').map(n => n.id).sort())), ['n_new', 'n_unread']);
  assert.ok(env.rt.ctx.readTable('archive_notifications').records.some(n => n.id === 'n_old'), 'kept in the archive');
  // the same row again (a run that died after copying) is not copied twice
  env.add('notifications', { id: 'n_old', user_id: 'u_req', type: 'completed', is_read: true, is_active: true, created_at: old });
  env.rt.ctx.archiveOldLogs({ dryRun: false });
  assert.strictEqual(env.rt.ctx.readTable('archive_notifications').records.filter(n => n.id === 'n_old').length, 1);
});

// --- v10.0 review (docs/planning/TODO_CodeReview_20261101.md, CR4-01 .. CR4-10) ----------------------------------

test('CR4-01/02: escalations and every ticket write answer like a missing ticket for someone who can\'t see it', () => {
  const env = seedSecret();
  const id = env.create(false, 'Private-ish');
  env.rt.ctx.updateRecordFields('ticket_types', 'tt_sec', { visibility: 'private' });
  const missing = '999999';
  const same = (uid, body, get) => {
    const call = ticketId => (get ? env.asGet(uid, { ...body, ticket_id: ticketId }) : env.as(uid, { ...body, ticket_id: ticketId, id: ticketId, entity_id: ticketId }));
    const strip = res => JSON.stringify(res).split(id).join('<id>').split(missing).join('<id>');
    assert.strictEqual(strip(call(id)), strip(call(missing)), JSON.stringify(body));
  };
  same('u_peer', { action: 'getSLAEscalationEvents' }, true);
  same('u_peer', { action: 'updateTicket', title: 'hacked' });
  same('u_peer', { action: 'assignTags', tag_ids: ['t1'] });
  same('u_peer', { action: 'removeTags', tag_ids: ['t1'] });
  same('u_peer', { action: 'updateTicketStatus', status: 'Cancelled', reason: 'x' });
  same('u_peer', { action: 'submitStepApproval', decision: 'approve', comment: 'x' });
  same('u_peer', { action: 'setCustomFieldValue', field_id: 'cf_note', value: 'x' });
  assert.strictEqual(env.rows('tickets').find(t => String(t.id) === id).title, 'Private-ish', 'nothing changed');
  // a Restricted field is written only by the chain, even by someone who can see the ticket
  env.rt.ctx.updateRecordFields('ticket_types', 'tt_sec', { visibility: 'collaborative' });
  assert.match(env.as('u_peer', { action: 'setCustomFieldValue', entity_id: id, field_id: 'cf_salary', value: 'x' }).error, /approval chain/);
  env.ok(env.as('u_req', { action: 'setCustomFieldValue', entity_id: id, field_id: 'cf_salary', value: 'changed' }));
});

test('CR4-03: a report with only date_from is capped at 1 year too', () => {
  const env = seed();
  assert.match(env.asGet('u_admin', { action: 'getReportData', ticket_type_id: 'tt_priv', user_id: 'u_admin', date_from: '2015-01-01' }).error, /at most 1 year/);
});

test('CR4-04 + CR4-10: old role notifications are archived (not only their read markers); deletes run in ranges', () => {
  const env = seed();
  env.rt.props.ARCHIVE_SPREADSHEET_ID = 'archive_1';
  const old = new Date(Date.now() - 200 * 24 * 3600e3).toISOString();
  env.add('notifications', { id: 'n_role', user_id: '', recipient_role_id: 'r_mgr', company_id: 'co_1', type: 'awaiting_approval', is_read: false, is_active: true, created_at: old });
  env.add('notifications', { id: 'n_mark', user_id: 'u_mgr', type: 'read_marker', link: 'n_role', is_read: true, is_active: true, created_at: old });
  for (let i = 0; i < 5; i++) env.add('admin_action_logs', { id: `al_${i}`, admin_user_id: 'u_admin', action_type: 'X', timestamp: new Date(Date.now() - 400 * 24 * 3600e3).toISOString() });
  env.rt.ctx.archiveOldLogs({ dryRun: false });
  assert.ok(!env.rows('notifications').some(n => n.id === 'n_role'), 'the role notification went too');
  assert.strictEqual(env.rows('admin_action_logs').filter(l => /^al_/.test(l.id)).length, 0);
  assert.ok((env.rt.sheets.get('admin_action_logs').deleteRowsCalls || 0) <= 2, 'one call per contiguous run');
});

test('CR4-05: links and children / parent never carry the id or text of a ticket the caller can\'t see', () => {
  const env = seed();
  const mine = env.createTicket('tt_priv');
  const hidden = env.createTicket('tt_priv', 'u_peer');
  env.add('ticket_links', { id: 'lk_h', parent_ticket_id: mine, child_ticket_id: hidden, link_type: 'related', description: 'SECRET-LINK-NOTE', company_id: 'co_1', is_active: true });
  const links = env.ok(env.asGet('u_req', { action: 'getTicketLinks' }));
  assert.strictEqual(links[0].child_ticket_id, '');
  assert.ok(!JSON.stringify(links).includes(hidden) || links.every(l => l.child_ticket_id !== hidden));
  assert.ok(!JSON.stringify(links).includes('SECRET-LINK-NOTE'));
  const page = env.ok(env.asGet('u_req', { action: 'getTickets', limit: 10 })).items.find(t => String(t.id) === mine);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(page.children)), [], 'the hidden child is not listed');
  // the requester of the hidden ticket still sees the link to their own ticket's parent... they can't see `mine`
  assert.strictEqual(env.ok(env.asGet('u_mgr', { action: 'getTicketLinks' }))[0].child_ticket_id, hidden, 'an approver sees both sides');
});

test('CR4-06: the SLA / priority filters run on the server over every page; stubs never match them', () => {
  const env = seed();
  const late = env.createTicket('tt_collab');
  env.rt.ctx.updateRecordFields('tickets', late, { step_due_date: new Date(Date.now() - 3600e3).toISOString(), priority: 'high',
    created_at: new Date(Date.now() - 10 * 24 * 3600e3).toISOString() });
  for (let i = 0; i < 3; i++) env.createTicket('tt_collab');
  const ids = filters => env.ok(env.asGet('u_mgr', { action: 'getTickets', limit: 2, filters: JSON.stringify(filters) })).items.map(t => String(t.id));
  assert.deepStrictEqual(ids({ sla: 'overdue' }), [late], 'found although it is older than the first page');
  assert.deepStrictEqual(ids({ priority: 'high' }), [late]);
});

test('CR4-08: an assignment without a company is a global role - it creates and sees in every company', () => {
  const env = seed();
  env.add('user_role_assignments', { id: 'ura_g', user_id: 'u_glob', role_id: 'r_mgr', company_id: '', ticket_type_id: '', is_active: true,
    effective_start_date: new Date(Date.now() - 3600e3).toISOString(), created_at: new Date(Date.now() - 3600e3).toISOString() });
  env.add('user_profiles', { user_id: 'u_glob', display_name: 'g', email: 'g@example.com', status: 'active', is_active: true });
  env.rt.cache.clear();
  const id = env.createTicket('tt_priv');
  assert.deepStrictEqual(env.visibleIds('u_glob'), [id], 'approver of the type everywhere');
  env.createTicket('tt_collab', 'u_glob');
});

test('CR4-09: the requester\'s own ticket read builds no actor scope (no participants / steps / shares read)', () => {
  const env = seed();
  const id = env.createTicket('tt_priv');
  const read = () => env.asGet('u_req', { action: 'getTicketHistory', ticket_id: id });
  read();
  read();
  const tabs = Object.keys(env.rt.reads());
  ['ticket_participants', 'workflow_steps', 'step_approvers', 'ticket_collaborations', 'sla_escalation_events'].forEach(tab =>
    assert.ok(!tabs.includes(tab), `${tab} read: ${tabs.join(', ')}`));
});

test('ping reports 10.0.0 or later = header Version; the file has one definition of each new helper (A20)', () => {
  const env = seed();
  const version = env.rt.get({ action: 'ping' }).version;
  assert.ok(version.localeCompare('10.0.0', undefined, { numeric: true }) >= 0, version);
  const source = fs.readFileSync(FILE, 'utf8');
  assert.ok(source.includes(`* Version: ${version.replace(/\.0$/, '')} `), `header Version = ${version}`);
  ['buildActorScope', 'canViewTicket', 'canCreateTicket', 'ticketReadGuard', 'getCreatableTicketTypes', 'mayReadTicket'].forEach(name =>
    assert.strictEqual((source.match(new RegExp(`^function ${name}\\(`, 'gm')) || []).length, 1, name));
  assert.ok(!/function canSeeTicketLinks\(/.test(source), 'the v9.6 interim rule is gone (C2)');
});

report();
