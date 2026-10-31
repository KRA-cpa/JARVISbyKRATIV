// Usage: node appscript_files/tools/ROUTES_TEST_v9.3.js appscript_files/APPSCRIPT_v9.3_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v9.3 (dropdown company access, company SLA rules, configuration export / import /
// backup, per-ticket-type tags / sharing switches, tags, sharing) on the fake Sheets runtime.
// Run the older suites on the same file too:
//   node appscript_files/tools/ROUTES_TEST_v9.2.js <file>
//   node appscript_files/tools/ROUTES_TEST_v9.1.js <file>
//   node appscript_files/tools/ROUTES_AND_APPROVALS_TEST_v9.0.js <file>
//   node appscript_files/tools/CODE_REVIEW_FIXES_TEST_v8.3.js <file>
const fs = require('fs');
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v9.3.js <APPSCRIPT file>');
  process.exit(2);
}
const SRC = fs.readFileSync(FILE, 'utf8').replace(/\r/g, '');
const same = lib.same;
const { test, report } = lib.makeTestRunner();

/**
 * co_1 / co_2, ticket type tt_1 with a 2-step co_1 workflow (Manager global role -> Finance co_1 role),
 * dropdown lists dl_old (pre-v9.3, no assignments) and dl_new, a custom field using dl_new.
 * Users: u_mgr Manager, u_fin Finance (co_1), u_admin System Admin, u_req requester, u_two a role in co_2.
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
  add('roles', { id: 'r_mgr', name: 'Manager', company_id: '', is_active: true });
  add('roles', { id: 'r_fin', name: 'Finance', company_id: 'co_1', is_active: true });
  add('roles', { id: 'r_staff2', name: 'Staff', company_id: 'co_2', is_active: true });
  add('roles', { id: 'r_admin', name: 'System Admin', company_id: '', is_active: true });
  add('workflow_steps', { id: 'ws_1', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Manager', status_on_reach: 'Pending Manager',
    step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
  add('workflow_steps', { id: 'ws_2', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Finance', status_on_reach: 'Pending Finance',
    step_type: 'approval', approver_logic: 'any', sort_order: 2, is_active: true });
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_mgr' });
  add('step_approvers', { step_id: 'ws_2', role_id: 'r_fin' });
  add('dropdown_lists', { id: 'dl_old', name: 'Old list', company_id: '', is_active: true });
  add('dropdown_lists', { id: 'dl_new', name: 'Departments', company_id: '', is_active: true });
  add('dropdown_options', { id: 'opt_1', dropdown_list_id: 'dl_new', label: 'Ops', value: 'OPS' });
  add('custom_fields', { id: 'cf_dept', ticket_type_id: 'tt_1', entity_category: 'ticket', name: 'dept', label: 'Department',
    type: 'dropdown', dropdown_list_id: 'dl_new', sort_order: 1, is_active: true });
  add('user_profiles', { user_id: 'u_two', display_name: 'Tess Two', is_active: true });

  const assign = p => {
    const res = rt.ctx.createUserRoleAssignment(p);
    assert.strictEqual(res.status, 'success', res.message);
  };
  assign({ user_id: 'u_mgr', role_id: 'r_mgr', company_id: 'co_1' });
  assign({ user_id: 'u_fin', role_id: 'r_fin', company_id: 'co_1' });
  assign({ user_id: 'u_admin', role_id: 'r_admin', company_id: 'co_1' });
  assign({ user_id: 'u_two', role_id: 'r_staff2', company_id: 'co_2' });

  const createTicket = (extra = {}) => {
    const res = rt.post({ action: 'createTicket', title: 'Laptop', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_1', ...extra });
    assert.strictEqual(res.success, true, res.error);
    return String(res.data.id);
  };
  const ok = res => { assert.strictEqual(res.success, true, res.error); return res.data; };
  const fails = (res, pattern) => { assert.strictEqual(res.success, false, 'expected an error'); assert.match(res.error, pattern); };
  /** Every tab's rows as JSON, to prove a call wrote nothing. */
  const snapshot = () => JSON.stringify([...rt.sheets.keys()].sort().map(name => [name, rt.sheets.get(name).trimmed()]));
  const features = (extra) => rt.post({ action: 'setTicketTypeFeatures', ticket_type_id: 'tt_1', user_id: 'u_admin', ...extra });

  return { rt, add, rows, createTicket, ok, fails, snapshot, features };
}

/** Case labels of a router function in the source. */
function routes(fnName) {
  const start = SRC.search(new RegExp(`^function ${fnName}\\(`, 'm'));
  const end = SRC.slice(start).search(/^\}\s*$/m);
  return [...SRC.slice(start, start + end).matchAll(/^\s*case '([A-Za-z0-9_]+)':/gm)].map(m => m[1]);
}

test('version 9.3 or later and the v9.3 routes; the old Phase 11 code is gone', () => {
  const header = SRC.match(/^ \* Version: (\d+)\.(\d+) /m);
  assert.ok(header && (Number(header[1]) > 9 || (Number(header[1]) === 9 && Number(header[2]) >= 3)), 'Version 9.3 or later');
  const gets = ['getDropdownCompanyAssignments', 'getCompanySLARules', 'getTags', 'getTicketTags', 'searchTicketsByTags',
    'getTicketShares', 'getSharedTickets'];
  const posts = ['assignDropdownToCompany', 'assignDropdownGlobally', 'removeDropdownCompanyAssignment',
    'updateDropdownCompanyAssignments', 'createCompanySLARule', 'updateCompanySLARule', 'deleteCompanySLARule',
    'exportConfiguration', 'createConfigurationBackup', 'importConfiguration', 'setTicketTypeFeatures',
    'createTag', 'updateTag', 'deleteTag', 'assignTags', 'removeTags', 'shareTicket', 'revokeTicketShare'];
  same(gets.filter(a => !routes('doGet').includes(a)), []);
  same(posts.filter(a => !routes('routePostAction').includes(a)), []);
  assert.ok(!/^function handleTagsCollaborationAPI\(/m.test(SRC), 'old dispatcher removed');
  assert.ok(!/^const TAG_SHEETS\b/m.test(SRC), 'old TAG_SHEETS removed');
  assert.ok(!routes('routePostAction').includes('runCompleteAPITest') && !routes('doGet').includes('runCompleteAPITest'), 'runCompleteAPITest is editor-only');
});

test('dropdown access: a list without assignments keeps its old meaning; assignments decide after that', () => {
  const { rt, rows, ok } = seed();
  const listsFor = company => ok(rt.get({ action: 'getDropdownLists', company_id: company })) || [];
  const ids = lists => lists.map(l => l.id).sort();
  same(ids(listsFor('co_2')), ['dl_new', 'dl_old'], 'legacy: both global');

  ok(rt.post({ action: 'updateDropdownCompanyAssignments', dropdown_list_id: 'dl_new', assignments: [{ company_id: 'co_1' }], user_id: 'u_admin' }));
  same(ids(listsFor('co_1')), ['dl_new', 'dl_old']);
  same(ids(listsFor('co_2')), ['dl_old'], 'only co_1 can use dl_new now');

  const all = ok(rt.get({ action: 'getDropdownLists' }));
  const dlNew = all.find(l => l.id === 'dl_new');
  assert.strictEqual(dlNew.availability.mode, 'companies');
  same(dlNew.assignments.map(a => a.company_id), ['co_1']);

  ok(rt.post({ action: 'assignDropdownGlobally', dropdown_list_id: 'dl_new', user_id: 'u_admin' }));
  same(ids(listsFor('co_2')), ['dl_new', 'dl_old']);
  const already = rt.post({ action: 'assignDropdownToCompany', dropdown_list_id: 'dl_new', company_id: 'co_2', user_id: 'u_admin' });
  assert.match(already.message || '', /all companies/);

  ok(rt.post({ action: 'updateDropdownCompanyAssignments', dropdown_list_id: 'dl_new', assignments: [], user_id: 'u_admin' }));
  same(ids(listsFor('co_1')), ['dl_old'], 'draft: no company sees it');
  assert.strictEqual(ok(rt.get({ action: 'getDropdownLists' })).find(l => l.id === 'dl_new').availability.mode, 'draft');
  assert.ok(rows('dropdown_company_assignments').length >= 2, 'removed access is deactivated, not deleted');
  same(ok(rt.get({ action: 'getDropdownCompanyAssignments', dropdown_list_id: 'dl_new' })), []);

  ok(rt.post({ action: 'assignDropdownToCompany', dropdown_list_id: 'dl_new', company_id: 'co_2', user_id: 'u_admin' }));
  ok(rt.post({ action: 'assignDropdownToCompany', dropdown_list_id: 'dl_new', company_id: 'co_1', user_id: 'u_admin' }));
  ok(rt.post({ action: 'removeDropdownCompanyAssignment', dropdown_list_id: 'dl_new', company_id: 'co_2', user_id: 'u_admin' }));
  same(ok(rt.get({ action: 'getDropdownCompanyAssignments', dropdown_list_id: 'dl_new' })).map(a => a.company_id), ['co_1']);
  assert.strictEqual(rt.post({ action: 'updateDropdownCompanyAssignments', dropdown_list_id: 'dl_new', assignments: [{ company_id: 'co_9' }] }).success, false);
});

test('company SLA rules: create / validate / read / update / soft delete', () => {
  const { rt, rows, ok, fails } = seed();
  const create = extra => rt.post({ action: 'createCompanySLARule', company_id: 'co_1', ticket_type_id: 'tt_1', step_name: 'Manager',
    duration: 24, unit: 'hours', escalation_recipients: ['a@x.com', 'b@x.com'], business_days: [1, 2, 3, 4, 5], user_id: 'u_admin', ...extra });
  const rule = ok(create());
  same(rule.escalation_recipients, ['a@x.com', 'b@x.com']);
  same(rule.business_days, [1, 2, 3, 4, 5]);
  assert.strictEqual(rule.warning_threshold, 75);
  fails(create(), /already a rule/);
  fails(create({ step_name: 'Finance', unit: 'weeks' }), /unit must be/);
  fails(create({ step_name: 'Finance', duration: 0 }), /positive/);
  fails(create({ step_name: 'Finance', warning_threshold: 150 }), /warning_threshold/);
  fails(create({ company_id: 'co_9' }), /not found/);

  const listed = ok(rt.get({ action: 'getCompanySLARules', company_id: 'co_1', ticket_type_id: 'tt_1' }));
  assert.strictEqual(listed.length, 1);
  const updated = ok(rt.post({ action: 'updateCompanySLARule', rule_id: rule.id, duration: 48, user_id: 'u_admin' }));
  assert.strictEqual(updated.duration, 48);
  assert.strictEqual(updated.unit, 'hours', 'unsent fields kept');
  ok(rt.post({ action: 'deleteCompanySLARule', rule_id: rule.id, user_id: 'u_admin' }));
  same(ok(rt.get({ action: 'getCompanySLARules', company_id: 'co_1' })), []);
  assert.strictEqual(rows('company_sla_rules').length, 1, 'soft delete keeps the row');
});

test('exportConfiguration: admins only, read-only, one company\'s configuration', () => {
  const { rt, ok, fails, snapshot } = seed();
  fails(rt.post({ action: 'exportConfiguration', company_id: 'co_1', user_id: 'u_mgr' }), /Only admins/);
  const before = snapshot();
  const doc = ok(rt.post({ action: 'exportConfiguration', company_id: 'co_1', ticket_type_ids: ['tt_1'], user_id: 'u_admin' }));
  assert.strictEqual(snapshot(), before, 'export writes nothing');
  assert.strictEqual(doc.format, 'jarvis-config');
  same(doc.workflow_steps.map(s => s.id), ['ws_1', 'ws_2']);
  same(doc.step_approvers.map(a => a.role_id), ['r_mgr', 'r_fin']);
  same(doc.roles.map(r => r.id).sort(), ['r_admin', 'r_fin', 'r_mgr'], 'global + own roles, not co_2\'s');
  assert.ok(doc.dropdown_lists.some(l => l.id === 'dl_new'), 'list used by a field');
  same(doc.custom_fields.map(f => f.id), ['cf_dept']);
  assert.strictEqual(doc.counts.workflow_steps, 2);

  const noWorkflows = ok(rt.post({ action: 'exportConfiguration', company_id: 'co_1', include_workflows: false, user_id: 'u_admin' }));
  assert.strictEqual(noWorkflows.workflow_steps, undefined);
});

test('createConfigurationBackup: admins only; the export goes to a Drive file', () => {
  const { rt, ok, fails } = seed();
  const files = [];
  rt.ctx.DriveApp = { createFile: (name, content, mime) => {
    files.push({ name, content, mime });
    return { getId: () => 'file_1', getUrl: () => 'https://drive.example/file_1' };
  } };
  fails(rt.post({ action: 'createConfigurationBackup', company_id: 'co_1', backup_name: 'x', user_id: 'u_fin' }), /Only admins/);
  const result = ok(rt.post({ action: 'createConfigurationBackup', company_id: 'co_1', backup_name: 'pre import/1', user_id: 'u_admin' }));
  assert.strictEqual(result.file_id, 'file_1');
  assert.strictEqual(files.length, 1);
  assert.match(files[0].name, /^jarvis-config-MYCO-pre import_1-.*\.json$/);
  assert.strictEqual(JSON.parse(files[0].content).company.id, 'co_1');
  assert.strictEqual(files[0].mime, 'application/json');
});

test('importConfiguration: dry run changes nothing; apply copies workflow (roles switched), SLA rules, dropdown access', () => {
  const { rt, rows, ok, snapshot } = seed();
  ok(rt.post({ action: 'createCompanySLARule', company_id: 'co_1', ticket_type_id: 'tt_1', step_name: 'Manager', duration: 24, unit: 'hours', user_id: 'u_admin' }));
  ok(rt.post({ action: 'updateDropdownCompanyAssignments', dropdown_list_id: 'dl_new', assignments: [{ company_id: 'co_1' }], user_id: 'u_admin' }));
  const request = extra => rt.post({ action: 'importConfiguration', source_company_id: 'co_1', target_company_id: 'co_2',
    ticket_type_ids: ['tt_1'], user_id: 'u_admin', ...extra });

  assert.strictEqual(request({ user_id: 'u_mgr' }).success, false, 'admins only');
  const before = snapshot();
  const plan = ok(request({}));
  assert.strictEqual(plan.dry_run, true, 'dry run by default');
  assert.strictEqual(snapshot(), before, 'dry run writes nothing');
  same(plan.actions.filter(a => a.action === 'copy').map(a => a.area).sort(), ['dropdowns', 'roles', 'sla_rules', 'workflows']);

  const applied = ok(request({ dry_run: false }));
  assert.strictEqual(applied.dry_run, false);
  const co2Steps = rows('workflow_steps').filter(s => s.company_id === 'co_2' && rt.ctx.isActiveFlag(s.is_active));
  assert.strictEqual(co2Steps.length, 2);
  const co2Roles = rows('roles').filter(r => r.company_id === 'co_2' && r.name === 'Finance');
  assert.strictEqual(co2Roles.length, 1, 'Finance role copied to co_2');
  const approverRoles = rows('step_approvers').filter(a => co2Steps.some(s => s.id === a.step_id)).map(a => a.role_id).sort();
  same(approverRoles, [co2Roles[0].id, 'r_mgr'].sort(), 'co_1 Finance switched to the co_2 Finance role; global Manager kept');
  assert.strictEqual(ok(rt.get({ action: 'getCompanySLARules', company_id: 'co_2' })).length, 1);
  assert.ok(ok(rt.get({ action: 'getDropdownLists', company_id: 'co_2' })).some(l => l.id === 'dl_new'));

  const again = ok(request({ dry_run: false }));
  assert.ok(again.actions.some(a => a.area === 'workflows' && a.action === 'skip'), 'target has a workflow now');
  assert.ok(again.actions.some(a => a.area === 'sla_rules' && a.action === 'skip'));
});

test('importConfiguration overwrite: refused while a target ticket is on the old steps, else replaces them', () => {
  const { rt, rows, ok, createTicket } = seed();
  const request = extra => ok(rt.post({ action: 'importConfiguration', source_company_id: 'co_1', target_company_id: 'co_2',
    ticket_type_ids: 'tt_1', include_roles: false, user_id: 'u_admin', dry_run: false, ...extra }));
  request({});
  createTicket({ company_id: 'co_2' });
  const refused = request({ overwrite_existing: true });
  assert.ok(refused.actions.some(a => a.area === 'workflows' && a.action === 'refused'));

  rt.ctx.updateRecordFields('tickets', '1', { status: 'Cancelled' });
  const replaced = request({ overwrite_existing: true });
  assert.ok(replaced.actions.some(a => a.area === 'workflows' && a.action === 'replace'));
  const live = rows('workflow_steps').filter(s => s.company_id === 'co_2' && rt.ctx.isActiveFlag(s.is_active) && !s.deactivated_at);
  assert.strictEqual(live.length, 2, 'old steps retired, new ones live');
  assert.ok(rows('workflow_steps').some(s => s.deactivation_reason === 'replaced_by_import'));
  assert.ok(replaced.actions.some(a => /still belong to the source company/.test(a.detail)), 'warns about co_1 roles without include_roles');
});

test('tags / sharing switches: off by default; on is free; off is refused once in use; getTicketType reports it', () => {
  const { rt, createTicket, ok, fails, features } = seed();
  const id = createTicket();
  const tag = ok(rt.post({ action: 'createTag', name: 'Urgent', user_id: 'u_admin' }));
  fails(rt.post({ action: 'assignTags', ticket_id: id, tag_ids: [tag.id], user_id: 'u_req' }), /Tags are turned off/);

  ok(features({ enable_tags: true, enable_sharing: true }));
  ok(features({ enable_sharing: false }));
  ok(features({ enable_sharing: true }));

  ok(rt.post({ action: 'assignTags', ticket_id: id, tag_ids: [tag.id], user_id: 'u_req' }));
  const type = ok(rt.get({ action: 'getTicketType', ticket_type_id: 'tt_1' }));
  // Only the switches this suite owns: later versions add fields (v9.5 sla_email)
  const { enable_tags, enable_sharing, tags_locked, sharing_locked } = type.features;
  same({ enable_tags, enable_sharing, tags_locked, sharing_locked }, { enable_tags: true, enable_sharing: true, tags_locked: true, sharing_locked: false });
  fails(features({ enable_tags: false }), /Tags are in use/);
  ok(features({ enable_sharing: false }));

  // Removing the tag frees the switch again (nothing left to orphan)
  ok(rt.post({ action: 'removeTags', ticket_id: id, tag_ids: tag.id, user_id: 'u_req' }));
  ok(features({ enable_tags: false }));
});

test('tags: unique per scope, company scoping, assign / remove / usage count, search AND / OR / exclude', () => {
  const { rt, createTicket, ok, fails, features } = seed();
  ok(features({ enable_tags: true }));
  const t1 = createTicket();
  const t2 = createTicket();
  const urgent = ok(rt.post({ action: 'createTag', name: 'Urgent', color: '#FF0000', user_id: 'u_admin' }));
  const it = ok(rt.post({ action: 'createTag', name: 'IT', company_id: 'co_1', user_id: 'u_admin' }));
  const other = ok(rt.post({ action: 'createTag', name: 'Theirs', company_id: 'co_2', user_id: 'u_admin' }));
  fails(rt.post({ action: 'createTag', name: 'urgent', company_id: 'co_1', user_id: 'u_admin' }), /already exists/);
  fails(rt.post({ action: 'createTag', name: 'Bad', color: 'red', user_id: 'u_admin' }), /Color/);
  same(ok(rt.get({ action: 'getTags', company_id: 'co_1' })).map(t => t.name), ['IT', 'Urgent']);

  fails(rt.post({ action: 'assignTags', ticket_id: t1, tag_ids: [other.id], user_id: 'u_req' }), /another company/);
  ok(rt.post({ action: 'assignTags', ticket_id: t1, tag_ids: [urgent.id, it.id], user_id: 'u_req' }));
  ok(rt.post({ action: 'assignTags', ticket_id: t2, tag_ids: `${urgent.id}`, user_id: 'u_req' }));
  const again = ok(rt.post({ action: 'assignTags', ticket_id: t1, tag_ids: [urgent.id], user_id: 'u_req' }));
  assert.strictEqual(again.length, 2, 'no duplicate assignment');
  same(ok(rt.get({ action: 'getTicketTags', ticket_id: t1 })).map(t => t.name).sort(), ['IT', 'Urgent']);
  assert.strictEqual(ok(rt.get({ action: 'getTags' })).find(t => t.id === urgent.id).usage_count, 2);

  const search = params => ok(rt.get({ action: 'searchTicketsByTags', ...params })).ticket_ids.sort();
  same(search({ tag_ids: `${urgent.id},${it.id}`, operator: 'AND' }), [t1]);
  same(search({ tag_ids: `${urgent.id},${it.id}`, operator: 'OR' }), [t1, t2].sort());
  same(search({ tag_ids: urgent.id, exclude_tag_ids: it.id }), [t2]);

  ok(rt.post({ action: 'removeTags', ticket_id: t1, tag_ids: [it.id], user_id: 'u_req' }));
  same(ok(rt.get({ action: 'getTicketTags', ticket_id: t1 })).map(t => t.name), ['Urgent']);
  ok(rt.post({ action: 'deleteTag', tag_id: urgent.id, user_id: 'u_admin' }));
  same(ok(rt.get({ action: 'getTicketTags', ticket_id: t1 })), [], 'a deleted tag no longer shows');
});

test('sharing: requester or admin shares view / comment with a user or company; expiry; revoke', () => {
  const { rt, rows, createTicket, ok, fails, features } = seed();
  const id = createTicket();
  fails(rt.post({ action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_two', user_id: 'u_req' }), /Sharing is turned off/);
  ok(features({ enable_sharing: true }));

  fails(rt.post({ action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_two', user_id: 'u_mgr' }), /requester or an admin/);
  fails(rt.post({ action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_two', permission_level: 'edit', user_id: 'u_req' }), /approving stays/);
  fails(rt.post({ action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_two', shared_with_company_id: 'co_2', user_id: 'u_req' }), /one user or one company/);
  fails(rt.post({ action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_two', expiration_date: '2000-01-01', user_id: 'u_req' }), /future/);

  const share = ok(rt.post({ action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_two', permission_level: 'comment', user_id: 'u_req' }));
  assert.strictEqual(share.can_comment, true);
  assert.strictEqual(share.shared_with_user_name, 'Tess Two');
  fails(rt.post({ action: 'shareTicket', ticket_id: id, shared_with_user_id: 'u_two', user_id: 'u_admin' }), /already shared/);
  assert.strictEqual(rows('collaboration_notifications').length, 1);

  same(ok(rt.get({ action: 'getSharedTickets', user_id: 'u_two' })).map(t => [String(t.id), t.share.via]), [[id, 'user']]);
  same(ok(rt.get({ action: 'getTicketShares', ticket_id: id })).map(s => s.id), [share.id]);

  // A company share reaches users with a role in force in that company
  const id2 = createTicket({ title: 'Chairs' });
  ok(rt.post({ action: 'shareTicket', ticket_id: id2, shared_with_company_id: 'co_2', user_id: 'u_admin' }));
  same(ok(rt.get({ action: 'getSharedTickets', user_id: 'u_two' })).map(t => String(t.id)).sort(), [id, id2].sort());
  same(ok(rt.get({ action: 'getSharedTickets', user_id: 'u_fin' })), []);

  // Expired shares are not in force
  rt.ctx.updateRecordFields('ticket_collaborations', share.id, { expiration_date: new Date(Date.now() - 2 * 86400000) });
  same(ok(rt.get({ action: 'getSharedTickets', user_id: 'u_two' })).map(t => String(t.id)), [id2]);

  fails(rt.post({ action: 'revokeTicketShare', collaboration_id: share.id, user_id: 'u_two' }), /Only the person/);
  const companyShare = ok(rt.get({ action: 'getTicketShares', ticket_id: id2 }))[0];
  ok(rt.post({ action: 'revokeTicketShare', collaboration_id: companyShare.id, user_id: 'u_admin', reason: 'done' }));
  same(ok(rt.get({ action: 'getSharedTickets', user_id: 'u_two' })), []);
  assert.ok(rows('ticket_collaborations').some(c => c.revocation_reason === 'done'), 'revoked, not deleted');
});

report();
