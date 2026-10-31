// Usage: node appscript_files/tools/CODE_REVIEW_FIXES_TEST_v8.3.js appscript_files/APPSCRIPT_v8.3_20261017_1510.txt
// Runs the AppScript file against an in-memory fake of SpreadsheetApp/LockService (no Google access needed).
// Fake Google Sheets runtime for APPSCRIPT v8.3 - exercises the code review fixes CR-01..CR-07
// Shared fake runtime: ./lib/fakeSheetsRuntime.js (also used by ROUTES_AND_APPROVALS_TEST_v9.0.js)
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const makeRuntime = () => lib.makeRuntime(process.argv[2]);
const same = lib.same;
const { test, report } = lib.makeTestRunner();

// Old (pre-rebuild) headers: custom_fields / custom_field_values without entity_category
const OLD_CF = ['id', 'ticket_type_id', 'name', 'label', 'type', 'is_required', 'is_hidden', 'sort_order',
  'dropdown_list_id', 'depends_on_field_id', 'is_active', 'created_at', 'created_by', 'updated_at', 'updated_by',
  'deactivated_at', 'deactivated_by', 'deactivation_reason'];
const OLD_CFV = ['id', 'ticket_id', 'custom_field_id', 'text_value', 'number_value', 'date_value', 'start_date_value',
  'end_date_value', 'dropdown_option_id', 'is_active', 'created_at', 'created_by', 'updated_at', 'updated_by',
  'deleted_at', 'deleted_by', 'deletion_reason'];

test('CR-02 rebuild back-fills entity_category = ticket and getCustomFields still finds old fields', () => {
  const rt = makeRuntime();
  rt.table('custom_fields', OLD_CF, [['cf_1', 'tt_1', 'amount', 'Amount', 'amount', false, false, 1, '', '', true, 't', 'u', 't', 'u', '', '', '']]);
  rt.table('custom_field_values', OLD_CFV, [['cfv_1', 7, 'cf_1', 'hello', '', '', '', '', '', true, 't', 'u', 't', 'u', '', '', '']]);
  const dry = rt.ctx.rebuildAllTables(true);
  const entry = dry.report.find(e => e.table === 'custom_fields');
  // entity_category is back-filled (v10.0 also defaults its new is_confidential column)
  assert.ok(entry.defaulted.includes('entity_category'), JSON.stringify(entry.defaulted));
  assert.strictEqual(rt.json('custom_fields')[0].entity_category, undefined, 'dry run must not change data');

  const res = rt.ctx.rebuildAllTablesApply();
  assert.strictEqual(res.success, true, JSON.stringify(res.errors));
  assert.strictEqual(rt.json('custom_fields')[0].entity_category, 'ticket');
  assert.strictEqual(rt.json('custom_field_values')[0].entity_category, 'ticket');
  assert.strictEqual(rt.json('custom_field_values')[0].custom_field_id, 'cf_1');
  const found = rt.ctx.getCustomFields('tt_1', 'ticket');
  assert.strictEqual(found.data.length, 1);
  assert.strictEqual(rt.isLocked(), false, 'lock released');
  same(rt.lockLog, ['acquire', 'release']);
});

test('CR-02 re-running the rebuild is a no-op', () => {
  const rt = makeRuntime();
  rt.table('custom_fields', OLD_CF, [['cf_1', 'tt_1', 'n', 'L', 'text', false, false, 1, '', '', true, '', '', '', '', '', '', '']]);
  rt.ctx.rebuildAllTablesApply();
  const second = rt.ctx.rebuildAllTables(true);
  same(second.repaired, []);
});

function seedTicketTables(rt) {
  rt.ctx.rebuildAllTablesApply(); // creates every tab with TABLE_SCHEMAS headers
  rt.sheets.get('companies').appendRow(rt.ctx.rowFromRecord(rt.ctx.__TABLE_SCHEMAS.companies, { id: 'co_1', name: 'Co', code: 'MYCO' }));
  rt.sheets.get('ticket_types').appendRow(rt.ctx.rowFromRecord(rt.ctx.__TABLE_SCHEMAS.ticket_types, { id: 'tt_1', code: 'PR', name: 'Purchase' }));
}

test('CR-01 + CR-03 createTicket via doPost: values aligned by header, ticket numbering re-enters the lock', () => {
  const rt = makeRuntime();
  seedTicketTables(rt);
  rt.lockLog.length = 0;
  const res = rt.post({ action: 'createTicket', payload: { title: 'T', ticket_type_id: 'tt_1', requester_id: 'u1', company_id: 'co_1', customData: { cf_amount: 'abc', cf_qty: 5 } } });
  assert.strictEqual(res.success, true, res.error);
  assert.match(res.data.ticketNumber, /^MYCO-PR-2026-00000001$/);
  same(res.data.customFieldErrors, []);
  same(rt.lockLog, ['acquire', 'release'], 'one lock for the whole write');
  const values = rt.json('custom_field_values');
  assert.strictEqual(values.length, 2);
  same(values.map(v => [v.entity_category, v.custom_field_id]), [['ticket', 'cf_amount'], ['ticket', 'cf_qty']]);
  assert.strictEqual(values[0].text_value, 'abc');
  assert.strictEqual(values[1].number_value, 5);
});

test('CR-03 a doPost write fails (not lost) while the rebuild holds the lock', () => {
  const rt = makeRuntime();
  seedTicketTables(rt);
  rt.ctx.LockService.getScriptLock().waitLock(); // simulate the rebuild in another execution
  const res = rt.post({ action: 'createCompany', payload: { name: 'X', code: 'XX' } });
  assert.strictEqual(res.success, false);
  assert.match(res.error, /LOCK ALREADY HELD/);
});

test('CR-03 read-only doPost actions skip the lock', () => {
  const rt = makeRuntime();
  seedTicketTables(rt);
  rt.lockLog.length = 0;
  assert.strictEqual(rt.post({ action: 'ping' }).success, true);
  assert.strictEqual(rt.post({ action: 'getCompanies' }).success, true);
  same(rt.lockLog, []);
});

test('CR-01 createCustomFieldValue / update / delete keep entity_category and extra columns', () => {
  const rt = makeRuntime();
  rt.table('custom_field_values', [...rt.ctx.__TABLE_SCHEMAS.custom_field_values, 'my_extra']);
  const created = rt.ctx.createCustomFieldValue({ ticket_id: 't1', custom_field_id: 'cf_1', text_value: 'a' });
  assert.strictEqual(created.status, 'success', created.error);
  const s = rt.sheets.get('custom_field_values');
  s.set(2, s.rows[0].length, 'keep me');
  let v = rt.json('custom_field_values')[0];
  same([v.entity_category, v.custom_field_id, v.text_value], ['ticket', 'cf_1', 'a']);

  v.is_active = true; // sheets would turn 'TRUE' into a boolean
  s.set(2, rt.ctx.__TABLE_SCHEMAS.custom_field_values.indexOf('is_active') + 1, true);
  const updated = rt.ctx.updateCustomFieldValue(v.id, { text_value: 'b' });
  assert.strictEqual(updated.status, 'success', updated.error);
  v = rt.json('custom_field_values')[0];
  same([v.entity_category, v.custom_field_id, v.text_value, v.is_active, v.my_extra], ['ticket', 'cf_1', 'b', true, 'keep me']);

  const deleted = rt.ctx.deleteCustomFieldValue(v.id);
  assert.strictEqual(deleted.status, 'success', deleted.error);
  v = rt.json('custom_field_values')[0];
  same([v.entity_category, v.custom_field_id, v.text_value, v.is_active, v.my_extra], ['ticket', 'cf_1', 'b', 'FALSE', 'keep me']);
});

test('CR-04 every initialize*Sheet() writes the TABLE_SCHEMAS header row', () => {
  const rt = makeRuntime();
  const S = rt.ctx.__SHEETS;
  const fns = {
    initializeTicketsSheet: S.TICKETS, initializeTicketHistorySheet: S.TICKET_HISTORY,
    initializeCustomFieldsSheet: S.CUSTOM_FIELDS, initializeCustomFieldValuesSheet: S.CUSTOM_FIELD_VALUES,
    initializeWorkflowStepsSheet: S.WORKFLOW_STEPS, initializeUserRoleAssignmentsSheet: S.USER_ROLE_ASSIGNMENTS,
    initializeStepSLAsSheet: S.STEP_SLAS, initializeStepApproversSheet: S.STEP_APPROVERS,
    initializeCompaniesSheet: S.COMPANIES, initializeUserProfilesSheet: S.USER_PROFILES
  };
  Object.entries(fns).forEach(([fn, tableName]) => {
    rt.ctx[fn]();
    same(rt.sheets.get(tableName).rows[0], rt.ctx.__TABLE_SCHEMAS[tableName], fn);
  });
  // After a reset the rebuild has nothing to repair
  same(rt.ctx.rebuildAllTables(true).repaired, []);
});

test('CR-04 cleanResetAllTables recreates tabs with TABLE_SCHEMAS headers', () => {
  const rt = makeRuntime();
  rt.ctx.rebuildAllTablesApply();
  const res = rt.ctx.cleanResetAllTables();
  assert.strictEqual(res.success, true, JSON.stringify(res.errors));
  same(rt.ctx.rebuildAllTables(true).repaired, []);
});

test('CR-05 completeUserManagementSetup twice keeps data and seeds once', () => {
  const rt = makeRuntime();
  rt.ctx.rebuildAllTablesApply();
  rt.table('custom_fields_dummy', ['x']);
  const first = rt.post({ action: 'completeUserManagementSetup' });
  assert.strictEqual(first.success, true, first.error);
  const typesAfterFirst = rt.json('user_profile_types').length;
  const rolesAfterFirst = rt.json('role_types').length;
  assert.strictEqual(typesAfterFirst, 2);
  assert.strictEqual(rolesAfterFirst, 2);
  const second = rt.post({ action: 'completeUserManagementSetup' });
  assert.strictEqual(second.success, true, second.error);
  assert.strictEqual(second.data.testData.skipped, true);
  assert.strictEqual(rt.json('user_profile_types').length, 2);
  assert.strictEqual(rt.json('role_types').length, 2);
  // Workflow init no longer wipes data
  rt.sheets.get('workflow_steps').appendRow(['ws_1']);
  rt.ctx.initializeWorkflowStepsSheet();
  assert.strictEqual(rt.json('workflow_steps').length, 1);
});

test('CR-06 logAdminAction: both call forms land in the right columns', () => {
  const rt = makeRuntime();
  rt.ctx.rebuildAllTablesApply();
  rt.ctx.logAdminAction('CREATE_COMPANY', 'co_1', { a: 1 });
  rt.ctx.logAdminAction('user_9', 'CREATE_ROLE_TYPE', 'role_type', 'rt_1', { b: 2 });
  const [a, b] = rt.json('admin_action_logs');
  same([a.admin_user_id, a.action_type, a.target_entity, a.target_id], ['admin@example.com', 'CREATE_COMPANY', 'ENTITY', 'co_1']);
  same([b.admin_user_id, b.action_type, b.target_entity, b.target_id, b.details], ['user_9', 'CREATE_ROLE_TYPE', 'role_type', 'rt_1', '{"b":2}']);
});

test('CR-07 delete with unknown id -> success:false; frontend key + numeric id work', () => {
  const rt = makeRuntime();
  rt.ctx.rebuildAllTablesApply();
  const bad = rt.post({ action: 'deleteUserProfileType', user_profile_type_id: 'nope' });
  assert.strictEqual(bad.success, false);
  assert.strictEqual(bad.status, 'error');
  assert.match(bad.error, /not found/);

  rt.sheets.get('user_profile_types').appendRow(rt.ctx.rowFromRecord(rt.ctx.__TABLE_SCHEMAS.user_profile_types, { id: 42, name: 'N', is_active: true }));
  const ok = rt.post({ action: 'deleteUserProfileType', user_profile_type_id: '42' }); // as the frontend sends it
  assert.strictEqual(ok.success, true, ok.error);
  const row = rt.json('user_profile_types')[0];
  assert.strictEqual(row.is_active, 'FALSE');
  const log = rt.json('admin_action_logs').pop();
  same([log.action_type, log.target_entity, log.target_id], ['DEACTIVATE_USER_PROFILE_TYPES', 'user_profile_types', '42']);
});

report();
