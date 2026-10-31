// Usage: node appscript_files/tools/ROUTES_AND_APPROVALS_TEST_v9.0.js appscript_files/APPSCRIPT_v9.0_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v9.0 (API contract routes, roles & approvals) on the fake Sheets runtime.
// Run the v8.3 suite on the same file too: node appscript_files/tools/CODE_REVIEW_FIXES_TEST_v8.3.js <file>
const fs = require('fs');
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_AND_APPROVALS_TEST_v9.0.js <APPSCRIPT file>');
  process.exit(2);
}
const SRC = fs.readFileSync(FILE, 'utf8').replace(/\r/g, '');
const makeRuntime = () => lib.makeRuntime(FILE);
const same = lib.same;
const { test, report } = lib.makeTestRunner();

const DAY = 24 * 60 * 60 * 1000;
const iso = ms => new Date(Date.now() + ms).toISOString();
// Today's date in local (script) time, as a date-only string - not toISOString(), which is UTC
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Two companies, one ticket type, a 2-step workflow for co_1 (Manager -> Finance), users and assignments:
 *   u_mgr: Manager in co_1      u_fin: Finance in co_1      u_other: Manager in co_2 only
 *   u_req: profile only (requester)
 */
function seed() {
  const rt = makeRuntime();
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (tableName, record) => rt.sheets.get(tableName).appendRow(rt.ctx.rowFromRecord(S[tableName], record));

  add('companies', { id: 'co_1', name: 'Co', code: 'MYCO', is_active: true });
  add('companies', { id: 'co_2', name: 'Other', code: 'OTH', is_active: true });
  add('ticket_types', { id: 'tt_1', code: 'PR', name: 'Purchase', is_active: true });
  // Global role (blank company): u_other may hold it in co_2. v9.1 refuses a company-specific role in
  // another company (review R-10), so a co_1 role here would fail the seed instead of testing eligibility.
  add('roles', { id: 'r_mgr', name: 'Manager', company_id: '', is_active: true });
  add('roles', { id: 'r_fin', name: 'Finance', company_id: 'co_1', is_active: true });
  add('workflow_steps', { id: 'ws_1', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Manager Approval',
    status_on_reach: 'Pending Manager', step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
  add('workflow_steps', { id: 'ws_2', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Finance Approval',
    status_on_reach: 'Pending Finance', step_type: 'approval', approver_logic: 'any', sort_order: 2, is_active: true });
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_mgr' });
  add('step_approvers', { step_id: 'ws_2', role_id: 'r_fin' });
  add('step_slas', { id: 'sla_2', step_id: 'ws_2', duration: '24', unit: 'hours', exclude_weekends: false, is_active: true });
  add('user_profiles', { user_id: 'u_mgr', display_name: 'Mia Manager', email: 'mia@example.com', is_active: true });
  add('user_profiles', { user_id: 'u_fin', display_name: 'Finn Finance', email: 'finn@example.com', is_active: true });
  add('user_profiles', { user_id: 'u_req', display_name: 'Rex Requester', email: 'rex@example.com', is_active: true });
  add('user_profiles', { user_id: 'u_other', display_name: 'Otto Other', email: 'otto@example.com', is_active: true });

  const assign = p => {
    const res = rt.ctx.createUserRoleAssignment(p);
    assert.strictEqual(res.status, 'success', res.message);
    return res.data;
  };
  assign({ user_id: 'u_mgr', role_id: 'r_mgr', company_id: 'co_1' });
  assign({ user_id: 'u_fin', role_id: 'r_fin', company_id: 'co_1' });
  assign({ user_id: 'u_other', role_id: 'r_mgr', company_id: 'co_2' });

  const createTicket = () => {
    const res = rt.post({ action: 'createTicket', payload: { title: 'Laptop', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_1' } });
    assert.strictEqual(res.success, true, res.error);
    return String(res.data.ticketId);
  };
  const ticket = id => rt.ctx.getTicketById(id).data;
  const approve = (ticketId, userId, decision = 'approve', extra = {}) =>
    rt.post({ action: 'submitStepApproval', ticket_id: ticketId, user_id: userId, decision, comment: 'ok', ...extra });

  return { rt, add, assign, createTicket, ticket, approve };
}

// Case labels of a router function in the source
function routes(fnName) {
  const start = SRC.search(new RegExp(`^function ${fnName}\\(`, 'm'));
  const end = SRC.slice(start).search(/^\}\s*$/m);
  return [...SRC.slice(start, start + end).matchAll(/^\s*case '([A-Za-z0-9_]+)':/gm)].map(m => m[1]);
}

test('version: ping reports API_VERSION and it matches the header Version line', () => {
  const rt = makeRuntime();
  const header = SRC.match(/^ \* Version: (\d+\.\d+)/m)[1];
  const apiVersion = SRC.match(/^const API_VERSION = '([^']+)'/m)[1];
  assert.ok(apiVersion.startsWith(header + '.'), `API_VERSION ${apiVersion} vs header ${header}`);
  assert.strictEqual(rt.get({ action: 'ping' }).version, apiVersion);
  assert.strictEqual(rt.post({ action: 'ping' }).version, apiVersion);
  assert.match(SRC, new RegExp(`Deploy description: v${header.replace('.', '\\.')} \\d{8}_\\d{4} - `));
});

test('loud errors: unknown actions and handler failures return status error (doGet and doPost)', () => {
  const rt = makeRuntime();
  for (const res of [rt.get({ action: 'nope' }), rt.post({ action: 'nope' })]) {
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'error');
    assert.match(res.error, /Unknown action/);
  }
  // No workflow_steps tab -> the handler returns { status: 'error' }; before v9.0 doGet said success: true
  const missing = rt.get({ action: 'getWorkflowSteps', ticket_type_id: 'tt_1' });
  assert.strictEqual(missing.success, false);
  assert.strictEqual(missing.status, 'error');
});

test('every routed action dispatches to a defined function (no "is not defined", no "Unknown action")', () => {
  const { rt } = seed();
  const failures = [];
  for (const action of routes('routePostAction')) {
    let res;
    try { res = rt.post({ action }); } catch (e) { failures.push(`${action}: threw ${e.message}`); continue; }
    if (res.error && /is not defined|Unknown action/.test(res.error)) failures.push(`POST ${action}: ${res.error}`);
  }
  for (const action of routes('doGet')) {
    const res = rt.get({ action });
    if (res.error && /is not defined|Unknown action/.test(res.error)) failures.push(`GET ${action}: ${res.error}`);
  }
  same(failures, []);
});

test('createTicket starts the workflow at the first step (status, current step, WORKFLOW_STARTED history)', () => {
  const { rt, createTicket, ticket } = seed();
  const id = createTicket();
  const t = ticket(id);
  same([t.status, t.current_step_id, t.is_active], ['Pending Manager', 'ws_1', true]);
  const started = rt.json('ticket_history').filter(h => String(h.ticket_id) === id && h.action === 'WORKFLOW_STARTED');
  assert.strictEqual(started.length, 1);
  assert.strictEqual(started[0].to_step_id, 'ws_1');
});

test('approval path (any): eligibility per company, approve moves step by step to Completed with SLA', () => {
  const { rt, createTicket, ticket, approve } = seed();
  const id = createTicket();

  const can = (user, step) => rt.post({ action: 'canUserApprove', user_id: user, step_id: step, ticket_id: id }).data.can_approve;
  same([can('u_mgr', 'ws_1'), can('u_fin', 'ws_1'), can('u_other', 'ws_1'), can('u_mgr', 'ws_2')], [true, false, false, false]);

  const denied = approve(id, 'u_other');
  assert.strictEqual(denied.success, false, 'Manager of another company must not approve');
  // v10.0+: a user of another company can't even see the ticket, so the write answers like a missing ticket
  assert.match(denied.error, /permission|Ticket not found/);

  const first = approve(id, 'u_mgr');
  assert.strictEqual(first.success, true, first.error);
  same([first.data.new_status, first.data.next_step.id], ['Pending Finance', 'ws_2']);
  const due = new Date(ticket(id).step_due_date);
  const hours = (due - Date.now()) / 3600000;
  assert.ok(hours > 23 && hours <= 24.01, `SLA due in ~24h (string duration), got ${hours}`);

  const done = approve(id, 'u_fin');
  assert.strictEqual(done.success, true, done.error);
  same([ticket(id).status, ticket(id).current_step_id], ['Completed', '']);
  assert.strictEqual(approve(id, 'u_fin').success, false, 'closed tickets take no more approvals');

  const approvals = rt.post({ action: 'getStepApprovals', ticket_id: id, step_id: 'ws_1' }).data;
  same(approvals.map(a => [a.user_name, a.action]), [['Mia Manager', 'approve']]);
});

test('approval path: a stale step_id is refused; the payload key is decision (action would be the route)', () => {
  const { rt, createTicket, approve, ticket } = seed();
  const id = createTicket();
  const stale = approve(id, 'u_mgr', 'approve', { step_id: 'ws_2' });
  assert.strictEqual(stale.success, false);
  assert.match(stale.error, /moved to another step/);
  assert.strictEqual(ticket(id).current_step_id, 'ws_1');

  // The pre-v9.0 frontend body: { action: 'approve' } replaced the route name
  const old = rt.post({ action: 'approve', ticket_id: id, user_id: 'u_mgr' });
  assert.strictEqual(old.status, 'error');
});

test("approver_logic 'all': partial approval stays on the step, no double approval, last role advances", () => {
  const { rt, add, createTicket, ticket, approve } = seed();
  // Step 1 needs Manager AND Finance
  const steps = rt.sheets.get('workflow_steps');
  const logicCol = rt.ctx.__TABLE_SCHEMAS.workflow_steps.indexOf('approver_logic') + 1;
  steps.set(2, logicCol, 'all');
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_fin' });

  const id = createTicket();
  const first = approve(id, 'u_mgr');
  assert.strictEqual(first.success, true, first.error);
  assert.strictEqual(first.data.partial, true);
  assert.strictEqual(ticket(id).current_step_id, 'ws_1');

  const again = approve(id, 'u_mgr');
  assert.strictEqual(again.success, false);
  assert.match(again.error, /already approved/);
  assert.strictEqual(rt.post({ action: 'canUserApprove', user_id: 'u_mgr', step_id: 'ws_1', ticket_id: id }).data.can_approve, false);

  const second = approve(id, 'u_fin');
  assert.strictEqual(second.success, true, second.error);
  assert.strictEqual(second.data.partial, false);
  assert.strictEqual(ticket(id).current_step_id, 'ws_2');
});

test("approver_logic 'all': a return resets the visit - earlier partial approvals don't count", () => {
  const { rt, add, createTicket, ticket, approve } = seed();
  const steps = rt.sheets.get('workflow_steps');
  const logicCol = rt.ctx.__TABLE_SCHEMAS.workflow_steps.indexOf('approver_logic') + 1;
  steps.set(3, logicCol, 'all'); // ws_2 needs Finance AND Manager
  add('step_approvers', { step_id: 'ws_2', role_id: 'r_mgr' });

  const id = createTicket();
  assert.strictEqual(approve(id, 'u_mgr').success, true);           // ws_1 -> ws_2
  assert.strictEqual(approve(id, 'u_fin').data.partial, true);      // ws_2 partial (Finance)
  assert.strictEqual(approve(id, 'u_mgr', 'return').success, true); // back to ws_1
  assert.strictEqual(approve(id, 'u_mgr').success, true);           // ws_1 -> ws_2 again
  const res = approve(id, 'u_mgr');                                 // only Manager this visit
  assert.strictEqual(res.data.partial, true, 'Finance approval from the previous visit must not count');
  assert.strictEqual(ticket(id).current_step_id, 'ws_2');
});

test('date-aware assignments: future start and past end are not eligible; a date-only end covers that day', () => {
  const { rt, assign } = seed();
  const ctx = rt.ctx;
  assign({ user_id: 'u_future', role_id: 'r_mgr', company_id: 'co_1', effective_start_date: iso(2 * DAY) });
  assign({ user_id: 'u_today', role_id: 'r_mgr', company_id: 'co_1', effective_end_date: localToday() });
  // Sheets returns a typed date as a local-midnight Date: that also covers the whole day
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  assert.strictEqual(ctx.isAssignmentActive({ is_active: true, effective_end_date: midnight }, now), true);
  assert.strictEqual(ctx.isAssignmentActive({ is_active: true, effective_end_date: new Date(midnight.getTime() - DAY) }, now), false);
  rt.sheets.get('user_role_assignments').appendRow(ctx.rowFromRecord(ctx.__TABLE_SCHEMAS.user_role_assignments,
    { id: 'ura_past', user_id: 'u_past', role_id: 'r_mgr', company_id: 'co_1', is_active: true,
      effective_start_date: iso(-10 * DAY), effective_end_date: iso(-DAY) }));

  const eligible = ctx.getUsersForStep('ws_1', { company_id: 'co_1', ticket_type_id: 'tt_1' }).data.map(u => u.user_id);
  assert.ok(eligible.includes('u_mgr') && eligible.includes('u_today'), JSON.stringify(eligible));
  assert.ok(!eligible.includes('u_future') && !eligible.includes('u_past') && !eligible.includes('u_other'), JSON.stringify(eligible));

  const bad = ctx.createUserRoleAssignment({ user_id: 'u_x', role_id: 'r_mgr', company_id: 'co_1',
    effective_start_date: iso(DAY), effective_end_date: iso(-DAY) });
  assert.strictEqual(bad.status, 'error');
  const dup = ctx.createUserRoleAssignment({ user_id: 'u_mgr', role_id: 'r_mgr', company_id: 'co_1' });
  assert.match(dup.message, /already has this role/);
});

test('expiry: processPendingExpirations soft-deletes past-due rows (deleted_*), keeps current ones, holds the lock', () => {
  const { rt } = seed();
  const ctx = rt.ctx;
  rt.sheets.get('user_role_assignments').appendRow(ctx.rowFromRecord(ctx.__TABLE_SCHEMAS.user_role_assignments,
    { id: 'ura_old', user_id: 'u_old', role_id: 'r_mgr', company_id: 'co_1', is_active: true,
      effective_start_date: iso(-40 * DAY), auto_expire_days: 30 }));

  const soon = ctx.getExpiringAssignments(30).data.map(a => a.id);
  assert.ok(!soon.includes('ura_old'), 'already expired is not "expiring"');

  rt.lockLog.length = 0;
  const res = ctx.processPendingExpirations();
  assert.strictEqual(res.status, 'success', res.message);
  same(res.data.expired_assignments.map(a => a.id), ['ura_old']);
  same(rt.lockLog, ['acquire', 'release']);
  const row = rt.json('user_role_assignments').find(a => a.id === 'ura_old');
  assert.strictEqual(row.is_active, false);
  assert.ok(row.deleted_at && row.deleted_by === 'system_auto_expire');
  assert.strictEqual(rt.json('user_role_assignments').filter(a => a.is_active === true).length, 3);
});

test('user roles routes: assign (with dates), list with names, remove; bulk/replace by email', () => {
  const { rt } = seed();
  const added = rt.post({ action: 'assignUserRole', userId: 'u_req', roleId: 'r_fin', companyId: 'co_1', assignment_type: 'temporary', effective_end_date: iso(5 * DAY) });
  assert.strictEqual(added.success, true, added.error);
  assert.strictEqual(added.data.assignment_type, 'temporary');

  const list = rt.post({ action: 'getUserRoles', userId: 'u_req' }).data;
  same(list.map(r => r.role_name), ['Finance']);

  const removed = rt.post({ action: 'removeUserRole', userId: 'u_req', roleId: 'r_fin', companyId: 'co_1' });
  assert.strictEqual(removed.success, true, removed.error);
  same(rt.post({ action: 'getUserRoles', userId: 'u_req' }).data, []);
  assert.strictEqual(rt.post({ action: 'removeUserRole', userId: 'u_req', roleId: 'r_fin' }).success, false);

  const bulk = rt.post({ action: 'bulkAssignRole', user_email: 'REX@example.com', company_id: 'co_1', role_id: 'r_mgr' });
  assert.strictEqual(bulk.success, true, bulk.error);
  const replaced = rt.post({ action: 'replaceUserRoles', user_email: 'rex@example.com', company_id: 'co_1', role_id: 'r_fin' });
  assert.strictEqual(replaced.success, true, replaced.error);
  same(rt.post({ action: 'getUserRoles', userId: 'u_req' }).data.map(r => r.role_id), ['r_fin']);
  assert.strictEqual(rt.post({ action: 'bulkAssignRole', user_email: 'nobody@example.com', company_id: 'co_1', role_id: 'r_mgr' }).success, false);
});

test('getUserProfile: profile + roles + companies + general role (UserContext shape); unknown user -> null', () => {
  const { rt } = seed();
  const profile = rt.post({ action: 'getUserProfile', userId: 'u_mgr' }).data;
  same([profile.display_name, profile.roles.map(r => r.name), profile.companies.map(c => c.code), profile.general_role],
    ['Mia Manager', ['Manager'], ['MYCO'], 'approver']);
  assert.strictEqual(rt.post({ action: 'getUserProfile', userId: 'ghost' }).data, null);
  assert.strictEqual(rt.post({ action: 'getUsers' }).data.length, 4);
});

test('getUserGeneralRole: approver / maker / both / viewer', () => {
  const { rt, add, assign } = seed();
  add('roles', { id: 'r_staff', name: 'Staff', company_id: 'co_1', is_active: true });
  assign({ user_id: 'u_fin', role_id: 'r_staff', company_id: 'co_1' });
  const role = userId => rt.post({ action: 'getUserGeneralRole', userId }).data.general_role;
  same([role('u_mgr'), role('u_req'), role('u_fin'), role('ghost')], ['approver', 'maker', 'both', 'viewer']);

  // getUsers classifies everyone in one pass with the same rule
  const users = rt.post({ action: 'getUsers' }).data;
  const byId = Object.fromEntries(users.map(u => [u.id, u]));
  same([byId.u_mgr.general_role, byId.u_req.general_role, byId.u_fin.general_role], ['approver', 'maker', 'both']);
  same([byId.u_mgr.name, byId.u_fin.roles.map(r => r.name).sort()], ['Mia Manager', ['Finance', 'Staff']]);
  same(rt.post({ action: 'getUsers', company_id: 'co_2' }).data.map(u => u.id), ['u_other']);
});

test('deleteUserRoleAssignment removes one assignment only; updateUserRoleAssignment changes dates', () => {
  const { rt, add, assign } = seed();
  add('ticket_types', { id: 'tt_2', code: 'LV', name: 'Leave', is_active: true });
  const a1 = assign({ user_id: 'u_req', role_id: 'r_fin', company_id: 'co_1', ticket_type_id: 'tt_1' });
  assign({ user_id: 'u_req', role_id: 'r_fin', company_id: 'co_1', ticket_type_id: 'tt_2' });

  const upd = rt.post({ action: 'updateUserRoleAssignment', assignment_id: a1.id, effective_end_date: '2099-12-31', assignment_notes: 'extended' });
  assert.strictEqual(upd.success, true, upd.error);
  same(Object.keys(upd.data.changes).sort(), ['assignment_notes', 'effective_end_date']);

  const del = rt.post({ action: 'deleteUserRoleAssignment', assignment_id: a1.id });
  assert.strictEqual(del.success, true, del.error);
  same(rt.post({ action: 'getUserRoles', userId: 'u_req' }).data.map(r => r.ticket_type_id), ['tt_2']);
  assert.strictEqual(rt.post({ action: 'deleteUserRoleAssignment', assignment_id: 'nope' }).success, false);
});

test('setStepApprovers replaces the set; getStepApprovers / getWorkflowStep / getWorkflowSteps routes', () => {
  const { rt } = seed();
  const res = rt.post({ action: 'setStepApprovers', step_id: 'ws_1', role_ids: ['r_fin', 'r_fin'] });
  assert.strictEqual(res.success, true, res.error);
  same([res.data.added, res.data.removed], [1, 1]);
  same(rt.post({ action: 'getStepApprovers', step_id: 'ws_1' }).data.map(a => a.role_id), ['r_fin']);
  assert.strictEqual(rt.post({ action: 'getWorkflowStep', step_id: 'ws_2' }).data.name, 'Finance Approval');
  same(rt.get({ action: 'getWorkflowSteps', ticket_type_id: 'tt_1', company_id: 'co_1' }).data.map(s => s.id), ['ws_1', 'ws_2']);
});

test('tickets: getTicket, updateTicket (header-driven), updateTicketStatus cancel / reopen to the rejected step', () => {
  const { rt, createTicket, ticket, approve } = seed();
  const id = createTicket();
  assert.strictEqual(rt.post({ action: 'getTicket', ticketId: id }).data.title, 'Laptop');

  const upd = rt.post({ action: 'updateTicket', id, title: 'Laptop Pro', priority: 'High', user_id: 'u_req' });
  assert.strictEqual(upd.success, true, upd.error);
  same([ticket(id).title, ticket(id).priority, ticket(id).current_step_id], ['Laptop Pro', 'High', 'ws_1']);

  assert.strictEqual(approve(id, 'u_mgr').success, true);
  assert.strictEqual(approve(id, 'u_fin', 'reject').success, true);
  assert.strictEqual(ticket(id).status, 'Rejected');
  const bad = rt.post({ action: 'updateTicketStatus', id, status: 'Completed' });
  assert.strictEqual(bad.success, false);
  // From v9.1 only an admin reopens (review R-05): give 'admin' a global admin role (v9.0 ignores it)
  rt.sheets.get('roles').appendRow(rt.ctx.rowFromRecord(rt.ctx.__TABLE_SCHEMAS.roles,
    { id: 'r_admin', name: 'System Admin', company_id: '', is_active: true }));
  assert.strictEqual(rt.ctx.createUserRoleAssignment({ user_id: 'admin', role_id: 'r_admin', company_id: 'co_1' }).status, 'success');
  const reopened = rt.post({ action: 'updateTicketStatus', id, status: 'Reopened', user_id: 'admin' });
  assert.strictEqual(reopened.success, true, reopened.error);
  same([ticket(id).status, ticket(id).current_step_id], ['Pending Finance', 'ws_2']);

  const cancelled = rt.post({ action: 'updateTicketStatus', id, status: 'Cancelled', comment: 'not needed', user_id: 'u_req' });
  assert.strictEqual(cancelled.success, true, cancelled.error);
  same([ticket(id).status, ticket(id).cancellation_reason], ['Cancelled', 'not needed']);
});

test('is_active writable for user profile / role types; include_inactive lists them; reactivation works', () => {
  const rt = makeRuntime();
  rt.ctx.rebuildAllTablesApply();
  const created = rt.post({ action: 'createUserProfileType', name: 'Intern', code: 'INT', is_active: false });
  assert.strictEqual(created.success, true, created.error);
  const id = created.data.data.id;
  assert.strictEqual(rt.get({ action: 'getUserProfileTypes' }).data.data.length, 0);
  assert.strictEqual(rt.get({ action: 'getUserProfileTypes', include_inactive: 'true' }).data.data.length, 1);

  const on = rt.post({ action: 'updateUserProfileType', user_profile_type_id: id, is_active: true });
  assert.strictEqual(on.success, true, on.error);
  assert.strictEqual(rt.get({ action: 'getUserProfileTypes' }).data.data.length, 1);

  const rtCreated = rt.post({ action: 'createRoleType', name: 'Approvers', code: 'APR' });
  const off = rt.post({ action: 'updateRoleType', role_type_id: rtCreated.data.data.id, is_active: false });
  assert.strictEqual(off.success, true, off.error);
  assert.strictEqual(rt.get({ action: 'getRoleTypes' }).data.data.length, 0);
  assert.strictEqual(rt.json('role_types')[0].deactivation_reason, 'admin_request');
});

test('roles: header-driven create with role_type_id; deleteRole soft-deactivates (deactivateRole never existed)', () => {
  const rt = makeRuntime();
  rt.ctx.rebuildAllTablesApply();
  const created = rt.post({ action: 'createRole', name: 'Auditor', company_id: 'global', role_type_id: 'rt_1' });
  assert.strictEqual(created.success, true, created.error);
  const row = rt.json('roles')[0];
  same([row.name, row.company_id, row.role_type_id, row.is_active], ['Auditor', '', 'rt_1', true]);

  const del = rt.post({ action: 'deleteRole', id: created.data.id });
  assert.strictEqual(del.success, true, del.error);
  assert.strictEqual(rt.get({ action: 'getRoles' }).data.length, 0);
  assert.strictEqual(rt.get({ action: 'getRoles', include_inactive: 'true' }).data.length, 1);
  assert.strictEqual(rt.post({ action: 'deleteRole', id: 'nope' }).success, false);
});

test('deleteTicketType / deleteDropdownList soft-deactivate (their deactivate* helpers never existed)', () => {
  const { rt, add } = seed();
  add('dropdown_lists', { id: 'dl_1', name: 'Cost centers', is_active: true });
  const tt = rt.post({ action: 'deleteTicketType', id: 'tt_1', reason: 'retired' });
  assert.strictEqual(tt.success, true, tt.error);
  assert.strictEqual(rt.json('ticket_types')[0].is_active, 'FALSE');
  const dl = rt.post({ action: 'deleteDropdownList', id: 'dl_1' });
  assert.strictEqual(dl.success, true, dl.error);
  same([rt.json('dropdown_lists')[0].is_active, rt.json('dropdown_lists')[0].deactivation_reason], ['FALSE', 'admin_request']);
  assert.strictEqual(rt.post({ action: 'deleteTicketType', id: 'nope' }).success, false);
});

test('rebuild: roles gains the v9.0 columns and existing rows default to is_active = true', () => {
  const rt = makeRuntime();
  rt.table('roles', ['id', 'name', 'company_id', 'created_at', 'updated_at'], [['role_1', 'Old', 'co_1', 't', 't']]);
  const res = rt.ctx.rebuildAllTablesApply();
  assert.strictEqual(res.success, true, JSON.stringify(res.errors));
  const row = rt.json('roles')[0];
  same([row.id, row.name, row.is_active], ['role_1', 'Old', true]);
  same(rt.ctx.rebuildAllTables(true).repaired, []);
});

test('read-only v9.0 POST actions skip the lock; writes take it once', () => {
  const { rt, createTicket } = seed();
  const id = createTicket();
  rt.lockLog.length = 0;
  rt.post({ action: 'getUserProfile', userId: 'u_mgr' });
  rt.post({ action: 'canUserApprove', user_id: 'u_mgr', step_id: 'ws_1', ticket_id: id });
  same(rt.lockLog, []);
  rt.post({ action: 'submitStepApproval', ticket_id: id, user_id: 'u_mgr', decision: 'approve' });
  same(rt.lockLog, ['acquire', 'release']);
});

report();
