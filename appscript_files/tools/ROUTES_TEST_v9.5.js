// Usage: node appscript_files/tools/ROUTES_TEST_v9.5.js appscript_files/APPSCRIPT_v9.5_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v9.5 (SLA escalation: business calendar and due dates, escalation rules, the
// escalation run, escalate_role grants, notifications, email, holidays, migration) on the fake Sheets runtime,
// with an injected `now`. The stale-cache detector is on (v9.4+ default).
// Run the older suites on the same file too: ROUTES_TEST_v9.4.js ... CODE_REVIEW_FIXES_TEST_v8.3.js
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v9.5.js <APPSCRIPT file>');
  process.exit(2);
}
const same = lib.same;
const { test, report } = lib.makeTestRunner();

// Fri 30 Oct 2026 15:00 Manila = 07:00Z
const FRI_3PM = '2026-10-30T07:00:00.000Z';
const iso = d => new Date(d).toISOString();
const hours = h => h * 60 * 60 * 1000;

/**
 * co_1, ticket type tt_1: ws_1 "Managers" (all: Manager + Lead), ws_2 "Finance". Users: u_mgr, u_lead, u_fin,
 * u_head (Head - not an approver), u_admin (admin), u_req (requester). Profiles with emails for u_mgr / u_head.
 */
function seed(options = {}) {
  const rt = lib.makeRuntime(FILE, options);
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (tableName, record) => rt.sheets.get(tableName).appendRow(rt.ctx.rowFromRecord(S[tableName], record));
  const rows = tableName => rt.ctx.readTable(tableName).records;

  add('companies', { id: 'co_1', name: 'Main Co', code: 'MYCO', is_active: true });
  add('ticket_types', { id: 'tt_1', code: 'PR', name: 'Purchase', is_active: true, sla_email: 'default' });
  [['r_mgr', 'Manager', ''], ['r_lead', 'Lead', ''], ['r_fin', 'Finance', 'co_1'], ['r_head', 'Head', 'co_1'], ['r_admin', 'System Admin', '']]
    .forEach(([id, name, company_id]) => add('roles', { id, name, company_id, is_active: true }));
  add('workflow_steps', { id: 'ws_1', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Managers', status_on_reach: 'Pending Managers',
    step_type: 'approval', approver_logic: 'all', sort_order: 1, is_active: true });
  add('workflow_steps', { id: 'ws_2', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Finance', status_on_reach: 'Pending Finance',
    step_type: 'approval', approver_logic: 'any', sort_order: 2, is_active: true });
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_mgr' });
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_lead' });
  add('step_approvers', { step_id: 'ws_2', role_id: 'r_fin' });
  [['u_mgr', 'r_mgr'], ['u_lead', 'r_lead'], ['u_fin', 'r_fin'], ['u_head', 'r_head'], ['u_admin', 'r_admin']].forEach(([user_id, role_id]) => {
    const res = rt.ctx.createUserRoleAssignment({ user_id, role_id, company_id: 'co_1' });
    assert.strictEqual(res.status, 'success', res.message);
  });
  add('user_profiles', { user_id: 'u_mgr', display_name: 'Mia Manager', email: 'mia@example.com', is_active: true });
  add('user_profiles', { user_id: 'u_lead', display_name: 'Leo Lead', email: 'leo@example.com', is_active: true });
  add('user_profiles', { user_id: 'u_head', display_name: 'Hal Head', email: 'hal@example.com', is_active: true });
  // v9.6 sign-in allow-list: the requester needs a profile (or a role) to pass AUTH_MODE enforce. No email, as before.
  add('user_profiles', { user_id: 'u_req', display_name: 'Rita Requester', is_active: true });

  const ok = res => { assert.strictEqual(res.success, true, res.error); return res.data; };
  const createTicket = () => String(ok(rt.post({ action: 'createTicket', title: 'Laptop', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_1' })).id);
  /** Put a ticket's current visit at a known start / due time. */
  const timeTicket = (id, start, due) => rt.ctx.updateRecordFields('tickets', id, { step_started_at: new Date(start), step_due_date: new Date(due) });
  const rule = extra => ok(rt.post({ action: 'createSLAEscalationRule', user_id: 'u_admin', company_id: 'co_1', ticket_type_id: 'tt_1',
    level: 1, trigger: 'percent_elapsed', trigger_value: 50, notify_current_approvers: true, ...extra }));
  const run = (now, extra = {}) => rt.ctx.runSLAEscalations({ now, ...extra }).data;
  const approve = (id, userId, decision = 'approve') => rt.post({ action: 'submitStepApproval', ticket_id: id, user_id: userId, decision, comment: 'ok' });
  return { rt, add, rows, ok, createTicket, timeTicket, rule, run, approve };
}

// --- Business calendar and due dates (D4, A17) ----------------------------------------------------------

test('business_hours: Fri 15:00 + 8h = Mon 14:00 Manila; a Monday holiday moves it to Tuesday', () => {
  const { rt, add } = seed();
  add('company_sla_rules', { id: 'csla_1', company_id: 'co_1', ticket_type_id: 'tt_1', step_name: 'managers', duration: 8, unit: 'business_hours',
    business_hours_start: '08:00', business_hours_end: '17:00', business_days: '[1,2,3,4,5]', exclude_holidays: true, is_active: true });
  const due = rt.ctx.stepDueDateFor({ company_id: 'co_1', ticket_type_id: 'tt_1' }, { id: 'ws_1', name: 'Managers' }, new Date(FRI_3PM));
  assert.strictEqual(iso(due), '2026-11-02T06:00:00.000Z');                     // Mon 2 Nov 14:00 PHT
  add('company_holidays', { id: 'hol_1', company_id: '', date: "'2026-11-02", name: 'Test holiday', is_active: true });
  const moved = rt.ctx.stepDueDateFor({ company_id: 'co_1', ticket_type_id: 'tt_1' }, { id: 'ws_1', name: 'Managers' }, new Date(FRI_3PM));
  assert.strictEqual(iso(moved), '2026-11-03T06:00:00.000Z');                   // Tue 3 Nov 14:00 PHT
});

test('the company SLA rule wins over the step SLA; without one the step SLA applies (D4)', () => {
  const { rt, add } = seed();
  add('step_slas', { id: 'sla_1', step_id: 'ws_1', duration: 24, unit: 'hours', exclude_weekends: false, is_active: true });
  const stepOnly = rt.ctx.stepDueDateFor({ company_id: 'co_1', ticket_type_id: 'tt_1' }, { id: 'ws_1', name: 'Managers' }, new Date(FRI_3PM));
  assert.strictEqual(iso(stepOnly), iso(new Date(FRI_3PM).getTime() + hours(24)));
  add('company_sla_rules', { id: 'csla_1', company_id: 'co_1', ticket_type_id: 'tt_1', step_name: 'Managers', duration: 2, unit: 'business_days',
    business_hours_start: '08:00', business_hours_end: '17:00', business_days: '[1,2,3,4,5]', is_active: true });
  const ruled = rt.ctx.stepDueDateFor({ company_id: 'co_1', ticket_type_id: 'tt_1' }, { id: 'ws_1', name: 'Managers' }, new Date(FRI_3PM));
  assert.strictEqual(iso(ruled), '2026-11-03T07:00:00.000Z');                    // 2 business days: Tue 15:00 PHT
});

test('calculateSLADueDate skips Manila weekends (not the script time zone)', () => {
  const { rt } = seed();
  const friLate = new Date('2026-10-30T15:30:00Z');                              // Fri 23:30 PHT (Fri in UTC too)
  assert.strictEqual(iso(rt.ctx.calculateSLADueDate(friLate, 1, 'days', true)), '2026-11-02T15:30:00.000Z');  // Mon 23:30 PHT
  const satEarly = new Date('2026-10-30T17:00:00Z');                             // Sat 01:00 PHT, still Fri in UTC
  assert.strictEqual(iso(rt.ctx.calculateSLADueDate(satEarly, 1, 'days', true)), '2026-11-01T17:00:00.000Z'); // Mon 01:00 PHT
  assert.strictEqual(iso(rt.ctx.calculateSLADueDate(satEarly, 3, 'hours', true)), '2026-10-30T20:00:00.000Z');
});

test('a new ticket gets step_started_at and the company rule due date (workflow start)', () => {
  const { add, createTicket, rows } = seed();
  add('company_sla_rules', { id: 'csla_1', company_id: 'co_1', ticket_type_id: 'tt_1', step_name: 'Managers', duration: 30, unit: 'minutes', is_active: true });
  const before = Date.now();
  const id = createTicket();
  const t = rows('tickets').find(r => String(r.id) === id);
  const started = new Date(t.step_started_at).getTime();
  assert.ok(started >= before - 1000 && started <= Date.now() + 1000);
  assert.strictEqual(new Date(t.step_due_date).getTime() - started, 30 * 60 * 1000);
});

// --- Rules and the run (A19) ------------------------------------------------------------------------------

test('rule validation and admin-only routes (A15)', () => {
  const { rt } = seed();
  const base = { action: 'createSLAEscalationRule', company_id: 'co_1', ticket_type_id: 'tt_1', level: 1, trigger: 'percent_elapsed', trigger_value: 50, notify_current_approvers: true };
  assert.match(rt.post({ ...base, user_id: 'u_req' }).error, /Only admins/);
  assert.match(rt.post({ ...base, user_id: 'u_admin', trigger_value: 150 }).error, /1-100/);
  assert.match(rt.post({ ...base, user_id: 'u_admin', notify_current_approvers: false }).error, /at least one recipient/);
  assert.match(rt.post({ ...base, user_id: 'u_admin', escalation_action: 'escalate_role' }).error, /escalate_role needs/);
  assert.match(rt.post({ ...base, user_id: 'u_admin', trigger: 'before_due', trigger_unit: 'business_hours' }).error, /before_due counts back/);
  assert.match(rt.post({ ...base, user_id: 'u_admin', step_id: 'ws_nope' }).error, /not in this company/);
  assert.strictEqual(rt.post({ ...base, user_id: 'u_admin' }).success, true);
  assert.match(rt.post({ ...base, user_id: 'u_admin' }).error, /Level 1 already exists/);
  const list = rt.get({ action: 'getSLAEscalationRules', company_id: 'co_1' }).data;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].notify_current_approvers, true);
});

test('percent_elapsed fires once per visit: dry run writes nothing, a second run adds nothing', () => {
  const { rt, rule, run, createTicket, timeTicket, rows } = seed();
  rule({});
  const id = createTicket();
  timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');                 // 50% = 05:00Z
  assert.strictEqual(run('2027-03-01T04:59:00Z').fired.length, 0, 'not yet');
  const snapshot = () => JSON.stringify([...rt.sheets.keys()].sort().map(n => [n, rt.sheets.get(n).trimmed()]));
  const before = snapshot();
  const dry = run('2027-03-01T05:01:00Z', { dryRun: true });
  assert.strictEqual(dry.fired.length, 1);
  assert.strictEqual(snapshot(), before, 'dry run writes nothing');
  const first = run('2027-03-01T05:01:00Z');
  assert.strictEqual(first.fired.length, 1);
  same(first.fired[0].recipients.sort(), ['u_lead', 'u_mgr']);
  assert.strictEqual(rows('notifications').length, 2);
  assert.strictEqual(rows('notifications')[0].type, 'sla_warning');
  assert.strictEqual(run('2027-03-01T06:00:00Z').fired.length, 0, 'second run: nothing new');
  assert.strictEqual(rows('sla_escalation_events').length, 1);
});

test('a return to the step is a new visit: the rule fires again', () => {
  const { rule, run, createTicket, timeTicket, approve, ok, rows } = seed();
  rule({});
  const id = createTicket();
  timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  assert.strictEqual(run('2027-03-01T06:00:00Z').fired.length, 1);
  ok(approve(id, 'u_mgr'));
  ok(approve(id, 'u_lead'));                                                       // -> ws_2
  ok(approve(id, 'u_fin', 'return'));                                               // back to ws_1: new visit
  timeTicket(id, '2027-03-02T00:00:00Z', '2027-03-02T10:00:00Z');
  assert.strictEqual(run('2027-03-02T06:00:00Z').fired.length, 1, 'fires on the new visit');
  assert.strictEqual(rows('sla_escalation_events').length, 2);
});

test('before_due and after_due fire at their times; overdue notices say so', () => {
  const { rule, run, createTicket, timeTicket, rows } = seed();
  rule({ level: 1, trigger: 'before_due', trigger_value: 2, trigger_unit: 'hours' });
  rule({ level: 2, trigger: 'after_due', trigger_value: 30, trigger_unit: 'minutes', notify_requester: true });
  const id = createTicket();
  timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  assert.strictEqual(run('2027-03-01T07:59:00Z').fired.length, 0);
  same(run('2027-03-01T08:00:00Z').fired[0].levels, [1]);
  assert.strictEqual(run('2027-03-01T10:29:00Z').fired.length, 0);
  const overdue = run('2027-03-01T10:30:00Z').fired[0];
  same(overdue.levels, [2]);
  assert.ok(overdue.recipients.includes('u_req'));
  assert.ok(rows('notifications').some(n => n.type === 'sla_overdue' && n.user_id === 'u_req'));
});

test('catch-up: two levels due at once -> both recorded, one notice per recipient (highest level)', () => {
  const { rule, run, createTicket, timeTicket, rows } = seed();
  rule({ level: 1 });
  rule({ level: 2, trigger: 'after_due', trigger_value: 1, trigger_unit: 'hours' });
  const id = createTicket();
  timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  const result = run('2027-03-01T12:00:00Z');
  same(result.fired[0].levels, [1, 2]);
  assert.strictEqual(rows('sla_escalation_events').length, 2);
  assert.strictEqual(rows('notifications').filter(n => n.user_id === 'u_mgr').length, 1);
  assert.strictEqual(rows('notifications')[0].type, 'sla_overdue');
});

test('escalate_role: the Head may act on that visit only; their approval completes the all step', () => {
  const { rt, rule, run, createTicket, timeTicket, approve, ok, rows } = seed();
  rule({ level: 1, trigger: 'after_due', trigger_value: 1, trigger_unit: 'hours', escalation_action: 'escalate_role', notify_role_ids: ['r_head'], notify_current_approvers: false });
  const id = createTicket();
  timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  const can = () => ok(rt.post({ action: 'canUserApprove', user_id: 'u_head', ticket_id: id, step_id: rt.ctx.findRecord('tickets', id).record.current_step_id }));
  assert.strictEqual(can().can_approve, false, 'not before the escalation');
  const fired = run('2027-03-01T11:30:00Z');
  same(fired.fired[0].granted_role_ids, ['r_head']);
  same(fired.fired[0].recipients, ['u_head']);
  assert.strictEqual(rows('notifications')[0].type, 'sla_escalated');
  assert.strictEqual(can().can_approve, true);
  assert.ok(ok(rt.get({ action: 'getTicketsForApproval', user_id: 'u_head' })).some(t => String(t.id) === id), 'in the Head inbox');
  ok(approve(id, 'u_head'));                                                         // alone completes the 'all' step
  const t = rows('tickets').find(r => String(r.id) === id);
  assert.strictEqual(t.current_step_id, 'ws_2');
  const approval = rows('ticket_history').filter(h => String(h.ticket_id) === id && h.action === 'APPROVED').pop();
  assert.strictEqual(JSON.parse(approval.field_changes).escalated, true);
  assert.strictEqual(can().can_approve, false, 'the grant ends with the visit');
});

test('email: off by default; per-type on; preference off; quota reserve; one digest per address', () => {
  const env = seed({ mailQuota: 100 });
  const { rt, rule, run, createTicket, timeTicket, rows, add } = env;
  rule({});
  const a = createTicket();
  const b = createTicket();
  timeTicket(a, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  timeTicket(b, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  run('2027-03-01T06:00:00Z');
  assert.strictEqual(rt.mail.sent.length, 0, 'global default off, type default');
  assert.ok(rows('notifications').every(n => n.email_status === 'none'));

  const env2 = seed({ mailQuota: 100 });
  env2.ok(env2.rt.post({ action: 'saveSLANotificationSettings', user_id: 'u_admin', ticket_types: { tt_1: 'on' } }));
  env2.add('user_preferences', { user_id: 'u_lead', email_notifications: false });
  env2.rule({});
  const c = env2.createTicket();
  const d = env2.createTicket();
  env2.timeTicket(c, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  env2.timeTicket(d, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  const result = env2.run('2027-03-01T06:00:00Z');
  assert.strictEqual(result.emails_sent, 1, 'one digest for mia');
  assert.strictEqual(env2.rt.mail.sent[0].to, 'mia@example.com');
  assert.match(env2.rt.mail.sent[0].subject, /\(2\)/, 'two tickets in one digest');
  const notices = env2.rows('notifications');
  assert.ok(notices.filter(n => n.user_id === 'u_mgr').every(n => n.email_status === 'sent'));
  assert.ok(notices.filter(n => n.user_id === 'u_lead').every(n => n.email_status === 'pref_off'));

  const env3 = seed({ mailQuota: 5 });                                                // under the reserve of 10
  env3.ok(env3.rt.post({ action: 'saveSLANotificationSettings', user_id: 'u_admin', email_default: 'on' }));
  env3.rule({});
  const e = env3.createTicket();
  env3.timeTicket(e, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  const lowQuota = env3.run('2027-03-01T06:00:00Z');
  assert.strictEqual(lowQuota.emails_sent, 0);
  assert.ok(env3.rows('notifications').some(n => n.email_status === 'quota'), 'in-app notice kept, email skipped');
  assert.ok(add);
});

test('a busy lock skips the run; the next run catches up', () => {
  const { rt, rule, run, createTicket, timeTicket } = seed();
  rule({});
  const id = createTicket();
  timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  rt.holdLock(true);
  const busy = run('2027-03-01T06:00:00Z');
  assert.strictEqual(busy.skipped, true);
  rt.holdLock(false);
  assert.strictEqual(run('2027-03-01T06:00:00Z').fired.length, 1);
  assert.strictEqual(rt.isLocked(), false, 'lock released');
});

test('a run reads each tab once (A16) and stops at 200 notices (the rest next run)', () => {
  const { rt, add, rule, run, createTicket, timeTicket, rows } = seed();
  for (let i = 0; i < 150; i++) add('user_role_assignments', { id: `ura_bulk_${i}`, user_id: `u_bulk_${i}`, role_id: 'r_head', company_id: 'co_1', is_active: true });
  rule({ notify_current_approvers: false, notify_role_ids: ['r_head'] });
  const a = createTicket();
  const b = createTicket();
  timeTicket(a, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  timeTicket(b, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  rt.post({ action: 'ping' });                                                       // reset the read counter
  const first = run('2027-03-01T06:00:00Z');
  Object.entries(rt.reads()).forEach(([tab, n]) => assert.ok(n <= 1, `${tab} read ${n} times`));
  assert.strictEqual(first.capped, true);
  assert.strictEqual(first.fired.length, 1);
  assert.strictEqual(rows('notifications').length, 151);
  assert.strictEqual(run('2027-03-01T06:05:00Z').fired.length, 1, 'the second ticket next run');
});

test('notifications: own only, unread count, mark read (ids / all)', () => {
  const { rt, rule, run, createTicket, timeTicket, ok } = seed();
  rule({});
  const id = createTicket();
  timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  run('2027-03-01T06:00:00Z');
  const mine = ok(rt.get({ action: 'getNotifications', user_id: 'u_mgr' }));
  assert.strictEqual(mine.unread_count, 1);
  assert.strictEqual(mine.items[0].link, `/tickets?ticket=${id}`);
  const leadId = ok(rt.get({ action: 'getNotifications', user_id: 'u_lead' })).items[0].id;
  assert.strictEqual(ok(rt.post({ action: 'markNotificationsRead', user_id: 'u_mgr', ids: [leadId] })).marked, 0, "can't mark someone else's");
  assert.strictEqual(ok(rt.post({ action: 'markNotificationsRead', user_id: 'u_mgr', all: true })).marked, 1);
  assert.strictEqual(ok(rt.get({ action: 'getNotifications', user_id: 'u_mgr' })).unread_count, 0);
  assert.strictEqual(ok(rt.get({ action: 'getNotifications', user_id: 'u_lead' })).unread_count, 1);
});

test('trigger install is idempotent; editor dry run', () => {
  const { rt } = seed();
  rt.ctx.installSLAEscalationTrigger();
  rt.ctx.installSLAEscalationTrigger();
  assert.strictEqual(rt.triggers.length, 1);
  assert.strictEqual(rt.triggers[0].spec.every, 15);
  assert.strictEqual(rt.ctx.removeSLAEscalationTrigger().removed, 1);
  assert.strictEqual(rt.ctx.runSLAEscalationsDryRun().data.dry_run, true);
});

test('Philippine holidays 2027 (Easter-based and last Monday of August); add is dry run first', () => {
  const { rt, ok, rows } = seed();
  const days = rt.ctx.philippineHolidays(2027).reduce((m, h) => ({ ...m, [h.name]: h.date }), {});
  assert.strictEqual(days['Maundy Thursday'], '2027-03-25');
  assert.strictEqual(days['Good Friday'], '2027-03-26');
  assert.strictEqual(days['National Heroes Day'], '2027-08-30');
  assert.strictEqual(rt.ctx.easterSunday(2026), '2026-04-05');
  const dry = ok(rt.post({ action: 'addPhilippineHolidays', user_id: 'u_admin', year: 2027 }));
  assert.strictEqual(dry.dry_run, true);
  assert.strictEqual(rows('company_holidays').length, 0);
  assert.strictEqual(ok(rt.post({ action: 'addPhilippineHolidays', user_id: 'u_admin', year: 2027, dry_run: false })).added, 16);
  assert.strictEqual(ok(rt.post({ action: 'addPhilippineHolidays', user_id: 'u_admin', year: 2027, dry_run: false })).added, 0, 'second apply adds nothing');
  assert.strictEqual(ok(rt.get({ action: 'getCompanyHolidays', company_id: 'co_1', year: '2027' })).length, 16);
  assert.match(rt.post({ action: 'addPhilippineHolidays', user_id: 'u_req', year: 2027 }).error, /Only admins/);
});

test('migrateCompanyEscalationsToRules: dry run, then apply creates levels 1 and 2 once', () => {
  const { rt, add, rows } = seed();
  add('company_sla_rules', { id: 'csla_1', company_id: 'co_1', ticket_type_id: 'tt_1', step_name: 'Managers', duration: 8, unit: 'hours',
    warning_threshold: 75, escalation_enabled: true, escalation_delay: 2, escalation_unit: 'hours', escalation_recipients: '["boss@example.com"]', is_active: true });
  const dry = rt.ctx.migrateCompanyEscalationsToRules();
  assert.strictEqual(dry.planned, 2);
  assert.strictEqual(rows('sla_escalation_rules').length, 0);
  const applied = rt.ctx.migrateCompanyEscalationsToRulesApply();
  assert.strictEqual(applied.created, 2);
  const rules = rows('sla_escalation_rules');
  same(rules.map(r => [r.level, r.trigger, String(r.step_id)]), [[1, 'percent_elapsed', 'ws_1'], [2, 'after_due', 'ws_1']]);
  assert.strictEqual(rt.ctx.migrateCompanyEscalationsToRulesApply().created, 0, 'idempotent');
});

test('export carries escalation rules; import maps step rules by step name (dry run)', () => {
  const { rt, add, rule, ok } = seed();
  rule({ step_id: 'ws_1' });
  add('companies', { id: 'co_2', name: 'Other', code: 'OTH', is_active: true });
  add('workflow_steps', { id: 'ws_9', ticket_type_id: 'tt_1', company_id: 'co_2', name: 'Managers', status_on_reach: 'P', step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
  const exported = ok(rt.post({ action: 'exportConfiguration', user_id: 'u_admin', company_id: 'co_1', ticket_type_ids: ['tt_1'], include_sla_rules: true }));
  const doc = exported.configuration || exported;
  assert.strictEqual(doc.sla_escalation_rules.length, 1);
  assert.strictEqual(doc.sla_escalation_rules[0].step_name, 'Managers');
  const preview = ok(rt.post({ action: 'importConfiguration', user_id: 'u_admin', source_company_id: 'co_1', target_company_id: 'co_2',
    ticket_type_ids: ['tt_1'], include_sla_rules: true, dry_run: true }));
  assert.ok(JSON.stringify(preview).includes('Escalation level 1'), JSON.stringify(preview).slice(0, 300));
});

// --- Review fixes (docs/planning/TODO_CodeReview_20261030.md) -------------------------------------------------------

test('CR2-01: a chained ticket keeps the parent requester under AUTH_MODE enforce', () => {
  const { rt, add, ok, rows } = seed({ properties: { AUTH_MODE: 'enforce', PROXY_SECRET: 's' } });
  add('ticket_types', { id: 'tt_2', code: 'PO', name: 'Purchase order', is_active: true });
  rt.ctx.updateRecordFields('workflow_steps', 'ws_2', { next_ticket_type_id: 'tt_2' });
  const as = (uid, body) => rt.post({ ...body, _proxy_secret: 's', _auth_uid: uid });
  // v10.0 (decision 1): in enforce, creating a ticket needs a role on its type + company
  add('roles', { id: 'r_req', name: 'Requester', is_active: true });
  rt.ctx.createUserRoleAssignment({ user_id: 'u_req', role_id: 'r_req', company_id: 'co_1', ticket_type_id: 'tt_1' });
  const id = String(ok(as('u_req', { action: 'createTicket', title: 'Laptop', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_1' })).id);
  ok(as('u_mgr', { action: 'submitStepApproval', ticket_id: id, user_id: 'u_mgr', decision: 'approve', comment: 'ok' }));
  ok(as('u_lead', { action: 'submitStepApproval', ticket_id: id, user_id: 'u_lead', decision: 'approve', comment: 'ok' }));
  ok(as('u_fin', { action: 'submitStepApproval', ticket_id: id, user_id: 'u_fin', decision: 'approve', comment: 'ok' }));
  const child = rows('tickets').find(t => t.ticket_type_id === 'tt_2');
  assert.ok(child, 'chained ticket created');
  assert.strictEqual(child.requester_id, 'u_req', 'the parent requester, not the approver');
});

test('CR2-03: events are recorded before mail, so a mail failure does not re-send next run', () => {
  const env = seed({ mailQuota: 100 });
  env.ok(env.rt.post({ action: 'saveSLANotificationSettings', user_id: 'u_admin', email_default: 'on' }));
  env.rule({});
  const id = env.createTicket();
  env.timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  env.rt.ctx.MailApp = { getRemainingDailyQuota: () => 100, sendEmail: () => { throw new Error('service down'); } };
  const first = env.run('2027-03-01T06:00:00Z');
  assert.strictEqual(first.emails_sent, 0);
  assert.strictEqual(env.rows('sla_escalation_events').length, 1, 'recorded despite the mail failure');
  assert.ok(env.rows('notifications').filter(n => n.user_id === 'u_mgr').every(n => n.email_status === 'error'));
  assert.strictEqual(env.run('2027-03-01T06:15:00Z').fired.length, 0, 'not fired again');
});

test('CR2-05: the script lock is released while mail is sent', () => {
  const env = seed({ mailQuota: 100 });
  env.ok(env.rt.post({ action: 'saveSLANotificationSettings', user_id: 'u_admin', email_default: 'on' }));
  env.rule({});
  const id = env.createTicket();
  env.timeTicket(id, '2027-03-01T00:00:00Z', '2027-03-01T10:00:00Z');
  const lockedDuringMail = [];
  env.rt.ctx.MailApp = { getRemainingDailyQuota: () => 100, sendEmail: () => { lockedDuringMail.push(env.rt.isLocked()); } };
  const result = env.run('2027-03-01T06:00:00Z');
  assert.ok(lockedDuringMail.length > 0, 'mail sent');
  assert.ok(lockedDuringMail.every(locked => locked === false), 'not under the lock');
  assert.strictEqual(result.emails_sent, lockedDuringMail.length);
  assert.ok(env.rows('notifications').filter(n => n.user_id === 'u_mgr').every(n => n.email_status === 'sent'));
});

test('CR2-04: before_due 1 day on a Friday due date fires Thursday, even with weekends excluded', () => {
  const { add, rule, run, createTicket, timeTicket } = seed();
  add('company_sla_rules', { id: 'csla_1', company_id: 'co_1', ticket_type_id: 'tt_1', step_name: 'Managers', duration: 5, unit: 'days',
    exclude_weekends: true, is_active: true });
  rule({ trigger: 'before_due', trigger_value: 1, trigger_unit: 'days' });
  const id = createTicket();
  timeTicket(id, '2027-02-22T01:00:00Z', '2027-03-05T09:00:00Z');                     // due Fri 5 Mar 17:00 PHT
  assert.strictEqual(run('2027-03-04T08:59:00Z').fired.length, 0);
  assert.strictEqual(run('2027-03-04T09:00:00Z').fired.length, 1, 'Thu 17:00 PHT');
});

test('CR2-08: an old ticket without step_started_at keeps its visit when updated_at changes', () => {
  const { rt, rule, run, createTicket, rows } = seed();
  rule({});
  const id = createTicket();
  // Pre-v9.5 shape: no step_started_at; created long before; no arrival row in the history
  rt.ctx.updateRecordFields('tickets', id, { step_started_at: '', created_at: new Date('2027-03-01T00:00:00Z'), step_due_date: new Date('2027-03-01T10:00:00Z') });
  const history = rt.sheets.get('ticket_history');
  for (let r = history.getLastRow(); r >= 2; r--) history.deleteRow(r);
  assert.strictEqual(run('2027-03-01T06:00:00Z').fired.length, 1);
  rt.ctx.updateRecordFields('tickets', id, { updated_at: new Date('2027-03-01T07:00:00Z') });   // e.g. a tag edit
  assert.strictEqual(run('2027-03-01T07:30:00Z').fired.length, 0, 'same visit - nothing re-fires');
  assert.strictEqual(rows('sla_escalation_events').length, 1);
});

test('CR2-10: a GET read sent by the proxy as POST (_via_get) reaches doGet, secret in the body', () => {
  const { rt, ok } = seed({ properties: { AUTH_MODE: 'enforce', PROXY_SECRET: 's' } });
  const viaGet = rt.post({ action: 'getDashboard', user_id: 'u_req', _via_get: true, _proxy_secret: 's', _auth_uid: 'u_req' });
  assert.ok(ok(viaGet).companies, 'doGet-only route answered');
  assert.match(rt.post({ action: 'getDashboard', _via_get: true }).error, /through the app proxy/, 'still checked');
});

test('ticket type sla_email switch and ping 9.5.0 or later', () => {
  const { rt, ok } = seed();
  assert.match(rt.post({ action: 'setTicketTypeFeatures', ticket_type_id: 'tt_1', user_id: 'u_admin', sla_email: 'maybe' }).error, /sla_email must be/);
  assert.strictEqual(ok(rt.post({ action: 'setTicketTypeFeatures', ticket_type_id: 'tt_1', user_id: 'u_admin', sla_email: 'on' })).sla_email, 'on');
  const settings = ok(rt.get({ action: 'getSLANotificationSettings' }));
  assert.strictEqual(settings.ticket_types[0].email_on, true);
  assert.ok(rt.get({ action: 'ping' }).version.localeCompare('9.5.0', undefined, { numeric: true }) >= 0);
});

report();
