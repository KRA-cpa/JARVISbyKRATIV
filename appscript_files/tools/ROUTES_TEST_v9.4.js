// Usage: node appscript_files/tools/ROUTES_TEST_v9.4.js appscript_files/APPSCRIPT_v9.4_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v9.4 (reco quick wins: request cache, one dropdown read, ticket id sequence,
// getDashboard, proxy auth / actorId, real UTC timestamps, S3-S5) on the fake Sheets runtime.
// The stale-cache detector is on (fakeSheetsRuntime default for v9.4+): a write without invalidateTable fails a test.
// Run the older suites on the same file too:
//   node appscript_files/tools/ROUTES_TEST_v9.3.js <file>   (and v9.2, v9.1, ROUTES_AND_APPROVALS_TEST_v9.0, CODE_REVIEW_FIXES_TEST_v8.3)
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v9.4.js <APPSCRIPT file>');
  process.exit(2);
}
const same = lib.same;
const { test, report } = lib.makeTestRunner();
const SECRET = 'test-secret';

/**
 * co_1, ticket type tt_1 with a 2-step workflow: ws_1 needs Manager AND Lead (approver_logic 'all'), ws_2 Finance.
 * Users: u_mgr Manager, u_lead Lead, u_fin Finance, u_admin System Admin, u_req requester.
 * @param {Object} properties - Script Properties (AUTH_MODE, PROXY_SECRET, CACHE_ENABLED)
 */
function seed(properties = {}) {
  const rt = lib.makeRuntime(FILE, { properties });
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (tableName, record) => rt.sheets.get(tableName).appendRow(rt.ctx.rowFromRecord(S[tableName], record));
  const rows = tableName => rt.ctx.readTable(tableName).records;

  add('companies', { id: 'co_1', name: 'Main Co', code: 'MYCO', is_active: true });
  add('ticket_types', { id: 'tt_1', code: 'PR', name: 'Purchase', is_active: true });
  add('roles', { id: 'r_mgr', name: 'Manager', company_id: '', is_active: true });
  add('roles', { id: 'r_lead', name: 'Lead', company_id: '', is_active: true });
  add('roles', { id: 'r_fin', name: 'Finance', company_id: 'co_1', is_active: true });
  add('roles', { id: 'r_admin', name: 'System Admin', company_id: '', is_active: true });
  add('workflow_steps', { id: 'ws_1', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Managers', status_on_reach: 'Pending Managers',
    step_type: 'approval', approver_logic: 'all', sort_order: 1, is_active: true });
  add('workflow_steps', { id: 'ws_2', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Finance', status_on_reach: 'Pending Finance',
    step_type: 'approval', approver_logic: 'any', sort_order: 2, is_active: true });
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_mgr' });
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_lead' });
  add('step_approvers', { step_id: 'ws_2', role_id: 'r_fin' });
  [['u_mgr', 'r_mgr'], ['u_lead', 'r_lead'], ['u_fin', 'r_fin'], ['u_admin', 'r_admin']].forEach(([user_id, role_id]) => {
    const res = rt.ctx.createUserRoleAssignment({ user_id, role_id, company_id: 'co_1' });
    assert.strictEqual(res.status, 'success', res.message);
  });
  // v9.6 sign-in allow-list: the requester needs a profile (or a role) to pass AUTH_MODE enforce
  add('user_profiles', { user_id: 'u_req', display_name: 'Rita Requester', is_active: true });
  // v10.0 (decision 1): in enforce, creating a ticket needs a role on its type + company
  add('roles', { id: 'r_req', name: 'Requester', company_id: '', is_active: true });
  rt.ctx.createUserRoleAssignment({ user_id: 'u_req', role_id: 'r_req', company_id: 'co_1', ticket_type_id: 'tt_1' });

  const ok = res => { assert.strictEqual(res.success, true, res.error); return res.data; };
  const createTicket = (extra = {}) => String(ok(rt.post({ action: 'createTicket', title: 'Laptop', ticket_type_id: 'tt_1',
    requester_id: 'u_req', company_id: 'co_1', ...extra })).id);
  const approve = (ticketId, userId, decision = 'approve', extra = {}) =>
    rt.post({ action: 'submitStepApproval', ticket_id: ticketId, user_id: userId, decision, comment: 'ok', ...extra });
  const getTicket = id => ok(rt.post({ action: 'getTicket', ticket_id: id }));
  return { rt, add, rows, ok, createTicket, approve, getTicket };
}

const sum = counts => Object.values(counts).reduce((a, b) => a + b, 0);

test('cache: every step of create -> partial all -> approve -> return -> reject -> reopen reads back fresh', () => {
  const { rt, approve, createTicket, getTicket, ok } = seed();
  const id = createTicket();
  assert.strictEqual(getTicket(id).current_step_id, 'ws_1');

  ok(approve(id, 'u_mgr'));                          // partial: 'all' still needs the Lead
  const partial = getTicket(id);
  assert.strictEqual(partial.current_step_id, 'ws_1');
  assert.strictEqual(partial.status, 'Pending Managers');

  ok(approve(id, 'u_lead'));                         // completes ws_1
  assert.strictEqual(getTicket(id).current_step_id, 'ws_2');

  ok(approve(id, 'u_fin', 'return', { comment: 'back' }));
  assert.strictEqual(getTicket(id).current_step_id, 'ws_1');

  ok(approve(id, 'u_mgr', 'reject', { comment: 'no' }));
  assert.strictEqual(getTicket(id).status, 'Rejected');

  ok(rt.post({ action: 'updateTicketStatus', id, status: 'Reopened', user_id: 'u_admin' }));
  const reopened = getTicket(id);
  assert.strictEqual(reopened.current_step_id, 'ws_1');
  assert.notStrictEqual(reopened.status, 'Rejected');
});

test('cache: the approval that completes a step reads each tab at most twice and 12 tabs in all (A16, P10)', () => {
  const measure = properties => {
    const env = seed(properties);
    env.createTicket();
    env.createTicket();
    const id = env.createTicket();
    env.ok(env.approve(id, 'u_mgr'));                 // partial ('all')
    env.ok(env.approve(id, 'u_lead'));                // completes ws_1 -> ws_2: measured
    return env.rt.reads();
  };
  const cached = measure({});
  const uncached = measure({ CACHE_ENABLED: 'false' });
  // Budget (P10): v9.3 read 18 tabs for this approval; v9.4 reads 9, v9.5 11 (escalation grants, company SLA rule)
  Object.entries(cached).forEach(([tab, n]) => assert.ok(n <= 2, `${tab} read ${n} times`));
  // v10.0: 13 - the visibility guard on the write (roles) and the participants; design PLAN_FeatureGaps_Volume §5.4 ≤ 13
  assert.ok(sum(cached) <= 13, `cached ${sum(cached)} reads (budget 13)`);
  assert.ok(sum(cached) < sum(uncached), `cached ${sum(cached)} vs uncached ${sum(uncached)} reads`);
});

test('cache: read -> write -> read in one request is fresh for every shared writer (A14 detector)', () => {
  const { rt, rows } = seed();
  const inRequest = fn => rt.ctx.withRequestScope(fn);
  // appendRecord (log writers)
  inRequest(() => {
    rt.ctx.readTable('ticket_history');
    rt.ctx.logTicketHistory('t1', 'u_req', 'Created', 'x');
    assert.strictEqual(rt.ctx.readTable('ticket_history').records.length, 1);
  });
  // updateRecordFields
  inRequest(() => {
    rt.ctx.readTable('companies');
    rt.ctx.updateRecordFields('companies', 'co_1', { name: 'Renamed' });
    assert.strictEqual(rt.ctx.findRecord('companies', 'co_1').record.name, 'Renamed');
  });
  // writeTableRow
  inRequest(() => {
    const table = rt.ctx.readTable('roles');
    const index = table.records.findIndex(r => r.id === 'r_lead');
    rt.ctx.writeTableRow(table, index, { ...table.records[index], name: 'Team Lead' });
    assert.strictEqual(rt.ctx.findRecord('roles', 'r_lead').record.name, 'Team Lead');
  });
  // nextSequenceValue (getRange().setValue) + getSheetDataAsJSON readers
  inRequest(() => {
    const first = rt.ctx.nextSequenceValue('x_seq', () => 0);
    const second = rt.ctx.nextSequenceValue('x_seq', () => 0);
    assert.strictEqual(second, first + 1);
    assert.ok(rt.ctx.getSheetDataAsJSON(rt.sheets.get('sequence_counters')).some(r => r.sequence_name === 'x_seq' && Number(r.last_number) === second));
  });
  assert.strictEqual(rows('companies')[0].name, 'Renamed');
});

test('CACHE_ENABLED=false gives the same ticket state as the cache (kill switch)', () => {
  const run = properties => {
    const env = seed(properties);
    const id = env.createTicket();
    env.ok(env.approve(id, 'u_mgr'));
    env.ok(env.approve(id, 'u_lead'));
    const t = env.getTicket(id);
    return { step: t.current_step_id, status: t.status, history: env.rows('ticket_history').map(h => h.action) };
  };
  same(run({}), run({ CACHE_ENABLED: 'false' }));
});

test('getDropdownLists reads dropdown_options once and matches numeric list ids (P3, N1)', () => {
  const { rt, add, ok } = seed();
  add('dropdown_lists', { id: 7, name: 'Numeric id list', is_active: true });
  add('dropdown_lists', { id: 'dl_b', name: 'B', is_active: true });
  add('dropdown_lists', { id: 'dl_c', name: 'C', is_active: true });
  add('dropdown_options', { id: 'o1', dropdown_list_id: 7, label: 'Seven', value: '7' });
  add('dropdown_options', { id: 'o2', dropdown_list_id: 'dl_b', label: 'Bee', value: 'b' });
  const lists = ok(rt.get({ action: 'getDropdownLists' }));
  assert.strictEqual(rt.reads().dropdown_options, 1, 'one read of the options tab');
  same(lists.find(l => String(l.id) === '7').options.map(o => o.id), ['o1']);
  same(lists.find(l => l.id === 'dl_b').options.map(o => o.id), ['o2']);
  same(lists.find(l => l.id === 'dl_c').options, []);
  // getDropdownOptions(listId) compares as strings too
  same(rt.ctx.getDropdownOptions('7').map(o => o.id), ['o1']);
});

test('ticket ids come from the sequence: no reuse after the last ticket row is deleted (P6, A18)', () => {
  const { rt, createTicket, rows } = seed();
  const a = createTicket();
  const b = createTicket();
  assert.strictEqual(Number(b), Number(a) + 1);
  const sheet = rt.sheets.get('tickets');
  sheet.deleteRow(sheet.getLastRow());               // remove ticket b
  const c = createTicket();
  assert.notStrictEqual(c, b, 'id of the deleted ticket is not reused');
  assert.strictEqual(Number(c), Number(b) + 1);
  assert.ok(rows('sequence_counters').some(r => r.sequence_name === 'ticket_id' && Number(r.last_number) === Number(c)));
});

test('the ticket_id sequence continues after existing tickets (seeded once from the highest id)', () => {
  const { add, createTicket } = seed();
  add('tickets', { id: 41, ticket_number: 'OLD-1', title: 'old', ticket_type_id: 'tt_1', company_id: 'co_1', status: 'Completed', is_active: true });
  assert.strictEqual(createTicket(), '42');
});

test('timestamps are real UTC and TS_UTC_SINCE is recorded once (S2, A17)', () => {
  const { rt } = seed();
  const before = Date.now();
  const stamp = rt.ctx.getCurrentTimestamp();
  assert.ok(Math.abs(new Date(stamp).getTime() - before) < 5000, `${stamp} is not now`);
  const since = rt.props.TS_UTC_SINCE;
  assert.ok(since, 'TS_UTC_SINCE recorded');
  rt.ctx.getCurrentTimestamp();
  assert.strictEqual(rt.props.TS_UTC_SINCE, since, 'recorded once');
  // Audit fields use it
  const audit = rt.ctx.createAuditFields('u_x');
  assert.ok(Math.abs(new Date(audit.created_at).getTime() - Date.now()) < 5000);
});

test('Manila day logic: phDay and endOfTerm use Asia/Manila (A17)', () => {
  const { rt } = seed();
  assert.strictEqual(rt.ctx.phDay(new Date('2026-10-30T17:30:00Z')), '2026-10-31');   // 01:30 PHT next day
  assert.strictEqual(rt.ctx.phDay(new Date('2026-10-30T15:59:00Z')), '2026-10-30');   // 23:59 PHT
  const manilaMidnight = new Date('2026-10-30T16:00:00Z');                            // 00:00 PHT 31 Oct
  assert.strictEqual(rt.ctx.endOfTerm(manilaMidnight).toISOString(), '2026-10-31T16:00:00.000Z', 'covers the whole day');
  const notMidnight = new Date('2026-10-31T00:00:00Z');                               // 08:00 PHT
  assert.strictEqual(rt.ctx.endOfTerm(notMidnight).toISOString(), notMidnight.toISOString());
});

test('user preferences: a missing tab is created instead of failing on null (S3, A10)', () => {
  const { rt } = seed();
  rt.ss.deleteSheet(rt.sheets.get('user_preferences'));
  const res = rt.get({ action: 'getUserPreferences', user_id: 'u_req' });
  assert.strictEqual(res.success, true, res.error);
  assert.ok(rt.sheets.get('user_preferences'), 'tab created');
});

test('log writers: header-driven rows with unique generateId ids after a deleted row (S5, A1, A18)', () => {
  const { rt, rows } = seed();
  rt.ctx.logTicketHistory('t1', 'u_req', 'Created', 'one');
  rt.ctx.logTicketHistory('t1', 'u_req', 'Updated', 'two');
  const sheet = rt.sheets.get('ticket_history');
  sheet.deleteRow(sheet.getLastRow());
  rt.ctx.logTicketHistory('t1', 'u_req', 'Updated', 'three');
  const ids = rows('ticket_history').map(h => String(h.id));
  assert.strictEqual(new Set(ids).size, ids.length, 'unique ids');
  ids.forEach(id => assert.match(id, /^th_/));
  same(rows('ticket_history').map(h => h.comment), ['one', 'three']);
  rt.ctx.logTicketAction('t1', 'u_req', 'X', { a: 1 });
  const action = rows('ticket_action_logs').pop();
  assert.match(String(action.id), /^tal_/);
  same(JSON.parse(action.details), { a: 1 });
  rt.ctx.logLogin({ userId: 'u_req', email: 'r@example.com' });
  const login = rows('admin_action_logs').pop();
  assert.match(String(login.id), /^log_/);
  assert.strictEqual(login.action_type, 'USER_LOGIN');
});

test('one getTicketActionLogs definition remains (S4, A20)', () => {
  const src = require('fs').readFileSync(FILE, 'utf8');
  assert.strictEqual((src.match(/^function getTicketActionLogs\(/gm) || []).length, 1);
});

test('AUTH_MODE enforce: no proxy secret -> refused; ping always answers (S1, A15)', () => {
  const { rt } = seed({ AUTH_MODE: 'enforce', PROXY_SECRET: SECRET });
  const denied = rt.get({ action: 'getTickets' });
  assert.strictEqual(denied.success, false);
  assert.match(denied.error, /through the app proxy/);
  assert.match(rt.post({ action: 'getTickets', _proxy_secret: 'wrong', _auth_uid: 'u_admin' }).error, /through the app proxy/);
  assert.match(rt.get({ action: 'getTickets', _proxy_secret: SECRET }).error, /Not signed in/);
  assert.strictEqual(rt.get({ action: 'ping' }).success, true);
});

test('AUTH_MODE enforce: the verified uid decides, not the payload user_id (A15)', () => {
  const { rt, rows } = seed({ AUTH_MODE: 'enforce', PROXY_SECRET: SECRET });
  const as = (uid, body) => rt.post({ ...body, _proxy_secret: SECRET, _auth_uid: uid });
  // The requester claims to be the admin: refused, because the token says u_req
  const claimed = rt.get({ action: 'getAdminActionLogs', user_id: 'u_admin', _proxy_secret: SECRET, _auth_uid: 'u_req' });
  assert.strictEqual(claimed.success, false);
  assert.match(claimed.error, /Only admins/);
  assert.strictEqual(rt.get({ action: 'getAdminActionLogs', user_id: 'u_req', _proxy_secret: SECRET, _auth_uid: 'u_admin' }).success, true);

  // A ticket created with someone else's requester_id belongs to the verified user
  const created = as('u_req', { action: 'createTicket', title: 'X', ticket_type_id: 'tt_1', requester_id: 'u_mgr', company_id: 'co_1' });
  assert.strictEqual(created.success, true, created.error);
  const ticket = rows('tickets').find(t => String(t.id) === String(created.data.id));
  assert.strictEqual(ticket.requester_id, 'u_req');

  // Approving "as u_mgr" with u_req's token is refused; with u_mgr's token it is recorded as u_mgr
  const forged = as('u_req', { action: 'submitStepApproval', ticket_id: String(created.data.id), user_id: 'u_mgr', decision: 'approve', comment: 'x' });
  assert.strictEqual(forged.success, false);
  const real = as('u_mgr', { action: 'submitStepApproval', ticket_id: String(created.data.id), user_id: 'someone', decision: 'approve', comment: 'x' });
  assert.strictEqual(real.success, true, real.error);
  assert.ok(rows('ticket_history').some(h => h.user_id === 'u_mgr' && String(h.ticket_id) === String(created.data.id)));
});

test('CR2-10: a GET read the proxy sends as POST (_via_get) is answered by doGet, identity checked', () => {
  const { rt, ok } = seed({ AUTH_MODE: 'enforce', PROXY_SECRET: SECRET });
  const res = rt.post({ action: 'getDashboard', user_id: 'u_req', _via_get: true, _proxy_secret: SECRET, _auth_uid: 'u_req' });
  assert.ok(ok(res).companies);
  assert.match(rt.post({ action: 'getDashboard', _via_get: true }).error, /through the app proxy/);
});

test('AUTH_MODE warn: the claimed id still works (rollout), and identity fields are never stored', () => {
  const { rt, rows, ok } = seed({ AUTH_MODE: 'warn', PROXY_SECRET: SECRET });
  const created = ok(rt.post({ action: 'createTicket', title: 'W', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_1',
    _proxy_secret: SECRET, _auth_uid: 'u_req' }));
  const all = JSON.stringify(rt.sheets.get('ticket_action_logs').trimmed()) + JSON.stringify(rows('tickets'));
  assert.ok(!all.includes(SECRET), 'the secret is not stored anywhere');
  assert.ok(!all.includes('_auth_uid'), 'the uid field is not stored');
  assert.strictEqual(rt.get({ action: 'getAdminActionLogs', user_id: 'u_admin' }).success, true, 'claimed admin, no token');
  assert.ok(created.id);
});

test('AUTH_MODE off: v9.3 behaviour (claimed ids, no secret needed)', () => {
  const { rt } = seed({ AUTH_MODE: 'off' });
  assert.strictEqual(rt.get({ action: 'getAdminActionLogs', user_id: 'u_admin' }).success, true);
  assert.strictEqual(rt.ctx.getCurrentUserId(), 'system_user');
});

test('getDashboard: companies, ticket types, approval inbox and counts in one call (P8, F5)', () => {
  const { rt, createTicket, ok, approve } = seed();
  createTicket();
  const id = createTicket();
  ok(approve(id, 'u_mgr'));
  ok(approve(id, 'u_lead'));                                     // now waits for Finance
  const dash = ok(rt.get({ action: 'getDashboard', user_id: 'u_fin' }));
  same(dash.companies.map(c => c.id), ['co_1']);
  same(dash.ticket_types.map(t => t.id), ['tt_1']);
  same(dash.approval_inbox.map(t => String(t.id)), [id]);
  assert.strictEqual(dash.counts.total, 2);
  assert.strictEqual(dash.counts.open, 2);
  assert.strictEqual(dash.counts.for_my_approval, 1);
  assert.strictEqual(ok(rt.get({ action: 'getDashboard', user_id: 'u_req' })).counts.mine, 2);
});

test('getTickets keeps parent / child links (links indexed once, P7)', () => {
  const { rt, createTicket, ok } = seed();
  const parent = createTicket();
  const child = createTicket();
  const linked = rt.ctx.createTicketLink(parent, child, { link_type: 'chained', company_id: 'co_1', user_id: 'u_admin' });
  assert.strictEqual(linked.status, 'success', linked.message);
  const tickets = ok(rt.get({ action: 'getTickets' }));
  const p = tickets.find(t => String(t.id) === parent);
  const c = tickets.find(t => String(t.id) === child);
  same(p.children.map(String), [child]);
  same(p.chained_children.map(String), [child]);
  assert.strictEqual(String(c.parent), parent);
  assert.strictEqual(String(c.chained_parent), parent);
});

test('ping reports the file API_VERSION (9.4.0 or later)', () => {
  const { rt } = seed();
  const apiVersion = require('fs').readFileSync(FILE, 'utf8').match(/^const API_VERSION = '([^']+)'/m)[1];
  assert.strictEqual(rt.get({ action: 'ping' }).version, apiVersion);
  assert.ok(apiVersion.localeCompare('9.4.0', undefined, { numeric: true }) >= 0);
});

report();
