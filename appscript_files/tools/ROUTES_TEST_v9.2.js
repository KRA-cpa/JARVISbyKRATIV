// Usage: node appscript_files/tools/ROUTES_TEST_v9.2.js appscript_files/APPSCRIPT_v9.2_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v9.2 (conditional routing, step return along the path taken, task steps, chained
// links, reports, audit log) on the fake Sheets runtime.
// Run the older suites on the same file too:
//   node appscript_files/tools/ROUTES_TEST_v9.1.js <file>
//   node appscript_files/tools/ROUTES_AND_APPROVALS_TEST_v9.0.js <file>
//   node appscript_files/tools/CODE_REVIEW_FIXES_TEST_v8.3.js <file>
const fs = require('fs');
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v9.2.js <APPSCRIPT file>');
  process.exit(2);
}
const SRC = fs.readFileSync(FILE, 'utf8').replace(/\r/g, '');
const same = lib.same;
const { test, report } = lib.makeTestRunner();

/**
 * co_1 with two ticket types:
 *   tt_1 "Purchase": ws_1 Manager -> ws_2 Finance (24h SLA) -> ws_3 Director; fields amount, dept (dropdown), note
 *   tt_2 "Setup":    ws_t1 task (Manager) -> ws_t2 approval (Finance) that chains a tt_1 ticket
 * Users: u_mgr Manager (global role), u_fin Finance, u_dir Director, u_admin System Admin, u_req requester
 */
function seed() {
  const rt = lib.makeRuntime(FILE);
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (tableName, record) => rt.sheets.get(tableName).appendRow(rt.ctx.rowFromRecord(S[tableName], record));
  const rows = tableName => rt.ctx.readTable(tableName).records;

  add('companies', { id: 'co_1', name: 'Main Co', code: 'MYCO', is_active: true });
  add('companies', { id: 'co_2', name: 'Other Co', code: 'OTH', is_active: true });
  add('ticket_types', { id: 'tt_1', code: 'PR', name: 'Purchase', is_active: true });
  add('ticket_types', { id: 'tt_2', code: 'SU', name: 'Setup', is_active: true });
  add('roles', { id: 'r_mgr', name: 'Manager', company_id: '', is_active: true });
  add('roles', { id: 'r_fin', name: 'Finance', company_id: 'co_1', is_active: true });
  add('roles', { id: 'r_dir', name: 'Director', company_id: 'co_1', is_active: true });
  add('roles', { id: 'r_admin', name: 'System Admin', company_id: '', is_active: true });

  const step = (id, typeId, name, sort, extra = {}) => add('workflow_steps', {
    id, ticket_type_id: typeId, company_id: 'co_1', name, status_on_reach: 'Pending ' + name, step_type: 'approval',
    approver_logic: 'any', sort_order: sort, is_active: true, ...extra });
  step('ws_1', 'tt_1', 'Manager', 1);
  step('ws_2', 'tt_1', 'Finance', 2);
  step('ws_3', 'tt_1', 'Director', 3);
  step('ws_t1', 'tt_2', 'Install', 1, { step_type: 'task', external_app_url: 'https://example.com/{ticket_id}' });
  step('ws_t2', 'tt_2', 'Sign-off', 2, { next_ticket_type_id: 'tt_1' });
  [['ws_1', 'r_mgr'], ['ws_2', 'r_fin'], ['ws_3', 'r_dir'], ['ws_t1', 'r_mgr'], ['ws_t2', 'r_fin']]
    .forEach(([stepId, roleId]) => add('step_approvers', { step_id: stepId, role_id: roleId }));
  add('step_slas', { id: 'sla_2', step_id: 'ws_2', duration: '24', unit: 'hours', exclude_weekends: false, is_active: true });

  add('custom_fields', { id: 'cf_amt', ticket_type_id: 'tt_1', entity_category: 'ticket', name: 'amount', label: 'Amount',
    type: 'amount', sort_order: 1, is_active: true });
  add('custom_fields', { id: 'cf_dept', ticket_type_id: 'tt_1', entity_category: 'ticket', name: 'dept', label: 'Department',
    type: 'dropdown', dropdown_list_id: 'dl_1', sort_order: 2, is_active: true });
  add('custom_fields', { id: 'cf_note', ticket_type_id: 'tt_1', entity_category: 'ticket', name: 'note', label: 'Note',
    type: 'text', sort_order: 3, is_active: true });
  add('custom_fields', { id: 'cf_other', ticket_type_id: 'tt_2', entity_category: 'ticket', name: 'host', label: 'Host',
    type: 'text', sort_order: 1, is_active: true });
  add('dropdown_options', { id: 'opt_fin', dropdown_list_id: 'dl_1', label: 'Finance Dept', value: 'FIN' });
  add('dropdown_options', { id: 'opt_ops', dropdown_list_id: 'dl_1', label: 'Operations', value: 'OPS' });
  add('user_profiles', { user_id: 'u_req', display_name: 'Rita Requester', email: 'rita@example.com', is_active: true });

  const assign = p => {
    const res = rt.ctx.createUserRoleAssignment(p);
    assert.strictEqual(res.status, 'success', res.message);
  };
  assign({ user_id: 'u_mgr', role_id: 'r_mgr', company_id: 'co_1' });
  assign({ user_id: 'u_fin', role_id: 'r_fin', company_id: 'co_1' });
  assign({ user_id: 'u_dir', role_id: 'r_dir', company_id: 'co_1' });
  assign({ user_id: 'u_admin', role_id: 'r_admin', company_id: 'co_1' });

  const createTicket = (extra = {}) => {
    const res = rt.post({ action: 'createTicket', title: 'Laptop', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_1', ...extra });
    assert.strictEqual(res.success, true, res.error);
    return String(res.data.id);
  };
  const ticket = id => rt.ctx.getTicketById(id).data;
  const act = (ticketId, userId, decision = 'approve', extra = {}) =>
    rt.post({ action: 'submitStepApproval', ticket_id: ticketId, user_id: userId, decision, comment: 'ok', ...extra });
  const saveRoutes = (stepId, routes, extra = {}) => rt.post({ action: 'saveStepConditions', step_id: stepId, routes, user_id: 'u_admin', ...extra });
  const cond = (field, operator, value) => ({ custom_field_id: field, operator, value });
  const route = (target, conditions) => ({ target_step_id: target, conditions: { operator: 'and', conditions } });
  const fallback = target => ({ target_step_id: target, is_default: true, conditions: null });

  return { rt, add, rows, createTicket, ticket, act, saveRoutes, cond, route, fallback };
}

/** Case labels of a router function in the source. */
function routes(fnName) {
  const start = SRC.search(new RegExp(`^function ${fnName}\\(`, 'm'));
  const end = SRC.slice(start).search(/^\}\s*$/m);
  return [...SRC.slice(start, start + end).matchAll(/^\s*case '([A-Za-z0-9_]+)':/gm)].map(m => m[1]);
}

test('version 9.2 or later and the v9.2 routes: reads in doGet, writes in routePostAction', () => {
  const header = SRC.match(/^ \* Version: (\d+)\.(\d+) /m);
  assert.ok(header && (Number(header[1]) > 9 || (Number(header[1]) === 9 && Number(header[2]) >= 2)), 'Version 9.2 or later');
  const gets = ['getStepConditions', 'getReportConfig', 'getReportData', 'getAdminActionLogs', 'getTicketActionLogs'];
  const posts = ['saveStepConditions', 'saveReportConfig'];
  same(gets.filter(a => !routes('doGet').includes(a)), []);
  same(posts.filter(a => !routes('routePostAction').includes(a)), []);
});

test('conditional routing: first matching route wins, else the default route, which can end the workflow', () => {
  const { createTicket, ticket, act, saveRoutes, cond, route, fallback } = seed();
  const res = saveRoutes('ws_1', [route('ws_3', [cond('cf_amt', '>=', '5000')]), fallback('__end__')]);
  assert.strictEqual(res.success, true, res.error);

  const big = createTicket({ customData: { cf_amt: '8,000' } });
  assert.strictEqual(act(big, 'u_mgr').success, true);
  assert.strictEqual(ticket(big).current_step_id, 'ws_3');
  assert.strictEqual(ticket(big).status, 'Pending Director');

  const small = createTicket({ customData: { cf_amt: '100' } });
  const done = act(small, 'u_mgr');
  assert.strictEqual(done.success, true, done.error);
  assert.strictEqual(ticket(small).status, 'Completed');
  assert.strictEqual(ticket(small).current_step_id, '');
});

test('conditional routing: no routes, or no match and no default -> the next step by order', () => {
  const { createTicket, ticket, act, saveRoutes, cond, route } = seed();
  const plain = createTicket({ customData: { cf_amt: '9000' } });
  act(plain, 'u_mgr');
  assert.strictEqual(ticket(plain).current_step_id, 'ws_2');

  saveRoutes('ws_1', [route('ws_3', [cond('cf_amt', 'greater_than', '50000')])]);
  const below = createTicket({ customData: { cf_amt: '9000' } });
  act(below, 'u_mgr');
  assert.strictEqual(ticket(below).current_step_id, 'ws_2');
});

test('conditional routing: AND within a route; dropdown values match option id, value or label; standard fields', () => {
  const { createTicket, ticket, act, saveRoutes, cond, route } = seed();
  saveRoutes('ws_1', [route('ws_3', [cond('cf_dept', 'equals', 'finance dept'), cond('cf_amt', 'less_than', '1000')])]);

  const both = createTicket({ customData: { cf_dept: 'opt_fin', cf_amt: '500' } });
  act(both, 'u_mgr');
  assert.strictEqual(ticket(both).current_step_id, 'ws_3');

  const onlyOne = createTicket({ customData: { cf_dept: 'opt_fin', cf_amt: '5000' } });
  act(onlyOne, 'u_mgr');
  assert.strictEqual(ticket(onlyOne).current_step_id, 'ws_2');

  saveRoutes('ws_1', [route('ws_3', [cond('cf_dept', 'in', 'HR, OPS'), cond('field:priority', 'equals', 'high')])]);
  const ops = createTicket({ priority: 'high', customData: { cf_dept: 'opt_ops' } });
  act(ops, 'u_mgr');
  assert.strictEqual(ticket(ops).current_step_id, 'ws_3');
});

test('saveStepConditions refuses loops, foreign steps / fields, bad operators, values and patterns, two defaults', () => {
  const { saveRoutes, cond, route, fallback } = seed();
  const error = res => { assert.strictEqual(res.success, false); return res.error; };
  assert.match(error(saveRoutes('ws_2', [route('ws_1', [cond('cf_amt', '>', '1')])])), /later step/);
  assert.match(error(saveRoutes('ws_2', [route('ws_2', [cond('cf_amt', '>', '1')])])), /later step/);
  assert.match(error(saveRoutes('ws_1', [route('ws_t2', [cond('cf_amt', '>', '1')])])), /target step of this workflow/);
  assert.match(error(saveRoutes('ws_1', [route('ws_3', [cond('cf_other', 'equals', 'x')])])), /field of this ticket type/);
  assert.match(error(saveRoutes('ws_1', [route('ws_3', [cond('cf_amt', 'between', '1')])])), /unknown operator/);
  assert.match(error(saveRoutes('ws_1', [route('ws_3', [cond('cf_amt', 'equals', '  ')])])), /value is required/);
  assert.match(error(saveRoutes('ws_1', [route('ws_3', [cond('cf_note', 'regex_match', '([')])])), /invalid pattern/);
  assert.match(error(saveRoutes('ws_1', [route('ws_3', [])])), /at least one condition/);
  assert.match(error(saveRoutes('ws_1', [fallback('ws_2'), fallback('ws_3')])), /one default route/);
  // is_empty needs no value
  assert.strictEqual(saveRoutes('ws_1', [route('ws_3', [cond('cf_note', 'is_empty', '')])]).success, true);
});

test('getStepConditions returns the saved routes; a save replaces the old rows; enabled false clears them', () => {
  const { rt, rows, saveRoutes, cond, route, fallback } = seed();
  saveRoutes('ws_1', [route('ws_3', [cond('cf_amt', '>=', '5000'), cond('cf_note', 'contains', 'rush')]), fallback('__end__')]);
  const got = rt.get({ action: 'getStepConditions', step_id: 'ws_1' });
  assert.strictEqual(got.success, true, got.error);
  assert.strictEqual(got.data.enabled, true);
  same(got.data.routes.map(r => [r.target_step_id, r.is_default, r.conditions && r.conditions.conditions.map(c => [c.custom_field_id, c.operator, c.value])]), [
    ['ws_3', false, [['cf_amt', 'greater_than_or_equal', '5000'], ['cf_note', 'contains', 'rush']]],
    ['__end__', true, null]
  ]);

  saveRoutes('ws_1', [route('ws_2', [cond('cf_amt', '<', '10')])]);
  const active = rows('step_conditions').filter(c => c.step_id === 'ws_1' && rt.ctx.isActiveFlag(c.is_active));
  assert.strictEqual(active.length, 1);
  assert.strictEqual(rows('step_conditions').filter(c => c.deactivation_reason === 'routes_replaced').length, 3);

  const off = saveRoutes('ws_1', [route('ws_2', [cond('cf_amt', '<', '10')])], { enabled: false });
  assert.strictEqual(off.data.enabled, false);
  assert.strictEqual(rows('step_conditions').filter(c => c.step_id === 'ws_1' && rt.ctx.isActiveFlag(c.is_active)).length, 0);
});

test('a return goes back along the path the ticket took (not the step order); from the first step to the requester', () => {
  const { createTicket, ticket, act, saveRoutes, cond, route } = seed();
  saveRoutes('ws_1', [route('ws_3', [cond('cf_amt', '>=', '5000')])]);
  const id = createTicket({ customData: { cf_amt: '7000' } });
  act(id, 'u_mgr');
  assert.strictEqual(ticket(id).current_step_id, 'ws_3');

  const back = act(id, 'u_dir', 'return');
  assert.strictEqual(back.success, true, back.error);
  assert.strictEqual(ticket(id).current_step_id, 'ws_1', 'returned to the step it came from, skipping Finance');

  const toRequester = act(id, 'u_mgr', 'return');
  assert.strictEqual(toRequester.success, true, toRequester.error);
  assert.strictEqual(ticket(id).status, 'Returned to Requester');
});

test('task step: complete moves on (it closed the ticket before); only the step\'s users; refused on an approval step', () => {
  const { createTicket, ticket, act } = seed();
  const id = createTicket({ ticket_type_id: 'tt_2', title: 'New laptop setup' });
  assert.strictEqual(ticket(id).current_step_id, 'ws_t1');

  assert.strictEqual(act(id, 'u_fin', 'complete').success, false, 'not an assignee of the task');
  const done = act(id, 'u_mgr', 'complete');
  assert.strictEqual(done.success, true, done.error);
  assert.strictEqual(ticket(id).current_step_id, 'ws_t2');
  assert.strictEqual(ticket(id).status, 'Pending Sign-off');

  const wrong = act(id, 'u_fin', 'complete');
  assert.strictEqual(wrong.success, false);
  assert.match(wrong.error, /Only a task step/);
});

test('chained ticket: the child gets a chained link (company + description); getTickets shows parent and children', () => {
  const { rt, rows, createTicket, ticket, act } = seed();
  const parent = createTicket({ ticket_type_id: 'tt_2', title: 'Office setup' });
  act(parent, 'u_mgr', 'complete');
  const signed = act(parent, 'u_fin');
  assert.strictEqual(signed.success, true, signed.error);
  assert.strictEqual(ticket(parent).status, 'Completed');

  const links = rows('ticket_links');
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].link_type, 'chained');
  assert.strictEqual(links[0].company_id, 'co_1');
  assert.match(links[0].description, /Sign-off/);
  const childId = String(links[0].child_ticket_id);
  assert.strictEqual(ticket(childId).ticket_type_id, 'tt_1');

  const list = rt.get({ action: 'getTickets' }).data;
  const p = list.find(t => String(t.id) === parent);
  const c = list.find(t => String(t.id) === childId);
  same(p.chained_children.map(String), [childId]);
  assert.strictEqual(String(c.chained_parent), parent);
});

test('copyWorkflowSteps keeps an "end the workflow" route target', () => {
  const { rt, rows, saveRoutes, cond, route, fallback } = seed();
  saveRoutes('ws_1', [route('ws_3', [cond('cf_amt', '>=', '5000')]), fallback('__end__')]);
  const res = rt.post({ action: 'copyWorkflowSteps', ticket_type_id: 'tt_1', source_company_id: 'co_1', target_company_id: 'co_2', user_id: 'u_admin' });
  assert.strictEqual(res.success, true, res.error);
  const copied = rows('step_conditions').filter(c => c.company_id === 'co_2' && rt.ctx.isActiveFlag(c.is_active));
  assert.strictEqual(copied.length, 2);
  assert.ok(copied.some(c => c.next_step_id === '__end__'));
  const co2Steps = rows('workflow_steps').filter(s => s.company_id === 'co_2').map(s => String(s.id));
  assert.ok(copied.every(c => c.next_step_id === '__end__' || co2Steps.includes(String(c.next_step_id))), 'targets remapped to the new steps');
  assert.ok(copied.every(c => co2Steps.includes(String(c.step_id))));
});

test('report config: defaults, a global config, a company config that wins over it; refuses unknown / duplicate / none', () => {
  const { rt } = seed();
  const config = companyId => rt.get({ action: 'getReportConfig', ticket_type_id: 'tt_1', company_id: companyId });

  const def = config('co_1');
  assert.strictEqual(def.data.source, 'default');
  same(def.data.columns.map(c => c.field_name), ['ticket_number', 'title', 'status', 'current_step_name', 'sla_status', 'created_at', 'cf_amt', 'cf_dept', 'cf_note']);
  assert.ok(def.data.available.some(f => f.field_name === 'cf_amt' && f.field_type === 'custom'));

  const save = (companyId, columns) => rt.post({ action: 'saveReportConfig', ticket_type_id: 'tt_1', company_id: companyId, columns, user_id: 'u_admin' });
  assert.strictEqual(save('', [{ field_name: 'ticket_number' }, { field_name: 'status' }]).success, true);
  assert.strictEqual(config('co_1').data.source, 'global');

  assert.strictEqual(save('co_1', [{ field_name: 'title' }, { field_name: 'cf_amt', display_name: 'Value (PHP)' }]).success, true);
  const mine = config('co_1');
  assert.strictEqual(mine.data.source, 'company');
  same(mine.data.columns.map(c => [c.field_name, c.display_name]), [['title', 'Title'], ['cf_amt', 'Value (PHP)']]);
  assert.strictEqual(config('co_2').data.source, 'global');

  assert.match(save('co_1', [{ field_name: 'cf_other' }]).error, /Unknown report column/);
  assert.match(save('co_1', [{ field_name: 'title' }, { field_name: 'title' }]).error, /listed twice/);
  assert.match(save('co_1', []).error, /at least one column/);
});

test('report data: configured columns, display values, SLA status, filters; non-admins only see their tickets', () => {
  const { rt, createTicket, act } = seed();
  const a = createTicket({ title: 'Chairs', customData: { cf_amt: '1200', cf_dept: 'opt_ops' } });
  const b = createTicket({ title: 'Desk', requester_id: 'u_other' });
  act(a, 'u_mgr'); // a -> Finance with a 24h SLA
  rt.ctx.updateRecordFields('tickets', b, { step_due_date: new Date(Date.now() - 60 * 60 * 1000) });
  rt.post({ action: 'saveReportConfig', ticket_type_id: 'tt_1', company_id: 'co_1', user_id: 'u_admin',
    columns: ['ticket_number', 'title', 'requester_id', 'company_id', 'current_step_name', 'sla_status', 'cf_amt', 'cf_dept'].map(f => ({ field_name: f })) });

  const report = params => rt.get({ action: 'getReportData', ticket_type_id: 'tt_1', company_id: 'co_1', ...params });
  const all = report({ user_id: 'u_admin' });
  assert.strictEqual(all.success, true, all.error);
  assert.strictEqual(all.data.scope, 'all');
  same(all.data.columns.map(c => c.field_name), ['ticket_number', 'title', 'requester_id', 'company_id', 'current_step_name', 'sla_status', 'cf_amt', 'cf_dept']);
  const rowA = all.data.rows.find(r => r.ticket_id === a);
  const rowB = all.data.rows.find(r => r.ticket_id === b);
  assert.strictEqual(rowA.requester_id, 'Rita Requester');
  assert.strictEqual(rowA.company_id, 'Main Co');
  assert.strictEqual(rowA.current_step_name, 'Finance');
  assert.strictEqual(rowA.cf_amt, '1200');
  assert.strictEqual(rowA.cf_dept, 'Operations');
  assert.ok(['On Track', 'Due Today'].includes(rowA.sla_status), rowA.sla_status);
  assert.strictEqual(rowB.sla_status, 'Overdue');

  const requester = report({ user_id: 'u_req' });
  assert.strictEqual(requester.data.scope, 'mine');
  same(requester.data.rows.map(r => r.ticket_id), [a]);
  // v10.0 (decision 2): an approver role of the type + company sees all its tickets, not only the ones at its step now
  const v10 = Number(String(rt.get({ action: 'ping' }).version || '0').split('.')[0]) >= 10;
  same(report({ user_id: 'u_fin' }).data.rows.map(r => r.ticket_id).sort(), v10 ? [a, b].sort() : [a], 'Finance can approve a now');

  same(report({ user_id: 'u_admin', status: 'Pending Finance' }).data.rows.map(r => r.ticket_id), [a]);
  assert.strictEqual(report({ user_id: 'u_admin', status: 'closed' }).data.total, 0);
  assert.strictEqual(report({ user_id: 'u_admin', date_from: '2999-01-01' }).data.total, 0);
  assert.match(report({}).error, /user_id is required/);
});

test('ticketSLAStatus: Overdue, Due Today (Philippine day), On Track, No SLA, Closed', () => {
  const { rt } = seed();
  const now = new Date('2026-10-19T02:00:00Z'); // 10:00 in Manila
  const status = (due, extra = {}) => rt.ctx.ticketSLAStatus({ status: 'Pending', step_due_date: due, ...extra }, now);
  assert.strictEqual(status(new Date('2026-10-19T01:00:00Z')), 'Overdue');
  assert.strictEqual(status(new Date('2026-10-19T15:00:00Z')), 'Due Today', '23:00 Manila, same day');
  assert.strictEqual(status(new Date('2026-10-19T16:30:00Z')), 'On Track', '00:30 next day in Manila');
  assert.strictEqual(status(''), 'No SLA');
  assert.strictEqual(status(new Date('2026-10-19T01:00:00Z'), { status: 'Completed' }), 'Closed');
});

test('audit log: admins only; filters, newest first, paging; ticket system log', () => {
  const { rt, createTicket, act, saveRoutes, cond, route } = seed();
  saveRoutes('ws_1', [route('ws_3', [cond('cf_amt', '>=', '5000')])]);
  saveRoutes('ws_2', [route('ws_3', [cond('cf_amt', '>=', '9000')])]);
  const id = createTicket();
  act(id, 'u_mgr');

  const denied = rt.get({ action: 'getAdminActionLogs', user_id: 'u_req' });
  assert.strictEqual(denied.success, false);
  assert.match(denied.error, /Only admins/);

  const logs = rt.get({ action: 'getAdminActionLogs', user_id: 'u_admin', action_type: 'SAVE_STEP_CONDITIONS' });
  assert.strictEqual(logs.success, true, logs.error);
  assert.strictEqual(logs.data.total, 2);
  same(logs.data.logs.map(l => l.target_id), ['ws_2', 'ws_1'], 'newest first');
  assert.strictEqual(typeof logs.data.logs[0].details, 'object');
  assert.ok(logs.data.action_types.includes('SAVE_STEP_CONDITIONS'));

  const page = rt.get({ action: 'getAdminActionLogs', user_id: 'u_admin', action_type: 'SAVE_STEP_CONDITIONS', limit: '1', offset: '1' });
  same(page.data.logs.map(l => l.target_id), ['ws_1']);

  assert.strictEqual(rt.get({ action: 'getTicketActionLogs', user_id: 'u_mgr', ticket_id: id }).success, false);
  const ticketLogs = rt.get({ action: 'getTicketActionLogs', user_id: 'u_admin', ticket_id: id });
  assert.strictEqual(ticketLogs.success, true, ticketLogs.error);
  assert.ok(ticketLogs.data.some(l => l.action_type === 'WORKFLOW_PROGRESSION'));
});

report();
