// Usage: node appscript_files/tools/ROUTES_TEST_v10.2.js appscript_files/APPSCRIPT_v10.2_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v10.2 (docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md §8): the plan catalogue, the
// effective plan (dates in the company zone), the central gate + in-handler checks, limits, overrides, platform admins,
// the monthly usage counter, the legacy migration. Run it under TZ=UTC and TZ=Asia/Manila, plus every older suite.
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v10.2.js <APPSCRIPT file>');
  process.exit(2);
}
const { test, report } = lib.makeTestRunner();
const SECRET = 's';
const plain = v => JSON.parse(JSON.stringify(v));

/** co_ph + co_us (no plan rows yet = unassigned), tt_1 with one Manager step per company; u_req, u_mgr, u_admin, u_owner. */
function seed(options = {}) {
  const rt = lib.makeRuntime(FILE, { properties: { AUTH_MODE: 'enforce', PROXY_SECRET: SECRET, ...(options.properties || {}) } });
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (t, r) => rt.sheets.get(t).appendRow(rt.ctx.rowFromRecord(S[t], r));
  const rows = t => rt.ctx.readTable(t).records;
  add('companies', { id: 'co_ph', name: 'PH Co', code: 'PHC', is_active: true });
  add('companies', { id: 'co_us', name: 'US Co', code: 'USC', is_active: true });
  add('ticket_types', { id: 'tt_1', code: 'PR', name: 'Purchase', is_active: true });
  [['r_req', 'Requester'], ['r_mgr', 'Manager'], ['r_admin', 'System Admin']].forEach(([id, name]) => add('roles', { id, name, is_active: true }));
  ['co_ph', 'co_us'].forEach((co, i) => {
    add('workflow_steps', { id: `ws_${i}`, ticket_type_id: 'tt_1', company_id: co, name: 'Managers', status_on_reach: 'Pending',
      step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
    add('step_approvers', { step_id: `ws_${i}`, role_id: 'r_mgr' });
    rt.ctx.createUserRoleAssignment({ user_id: 'u_req', role_id: 'r_req', company_id: co });
    rt.ctx.createUserRoleAssignment({ user_id: 'u_mgr', role_id: 'r_mgr', company_id: co });
  });
  rt.ctx.createUserRoleAssignment({ user_id: 'u_admin', role_id: 'r_admin', company_id: 'co_ph' });
  ['u_req', 'u_mgr', 'u_admin', 'u_owner'].forEach(uid => add('user_profiles', { user_id: uid, display_name: uid, email: `${uid}@example.com`, status: 'active', is_active: true }));
  rt.cache.clear();
  const as = (uid, body) => rt.post({ ...body, _proxy_secret: SECRET, _auth_uid: uid });
  const asGet = (uid, params) => rt.get({ ...params, _proxy_secret: SECRET, _auth_uid: uid });
  const ok = res => { assert.strictEqual(res.success, true, res.error); return res.data; };
  const today = rt.ctx.dayIn(new Date(), 'Asia/Manila');
  const day = n => rt.ctx.shiftDay(today, n);
  /** A plan row for a company: { plan, status, start, end (day offsets from today), ... } */
  const plan = (companyId, p, extra = {}) => add('company_subscriptions', { id: `sub_${companyId}_${p}_${extra.id || ''}`, company_id: companyId, plan: p,
    status: extra.status || 'active', period_start: `'${extra.start || day(-10)}`, period_end: `'${extra.end || day(20)}`,
    grace_days: extra.grace_days === undefined ? '' : extra.grace_days, feature_overrides: extra.feature_overrides || '',
    limit_overrides: extra.limit_overrides || '', is_active: true });
  const logs = [];
  rt.ctx.console.log = (...args) => logs.push(args.join(' '));
  return { rt, add, rows, as, asGet, ok, plan, today, day, logs };
}

// --- Catalogue ------------------------------------------------------------------------------------------------------

test('getPlanCatalog: 3 plans, each includes the lower one; limits as in plan §2; every feature has its lowest plan', () => {
  const env = seed();
  const cat = env.ok(env.asGet('u_req', { action: 'getPlanCatalog' }));
  assert.deepStrictEqual(cat.plans.map(p => p.plan), ['basic', 'advanced', 'enterprise']);
  const [basic, advanced, enterprise] = cat.plans;
  assert.strictEqual(basic.features.length, 0, 'the core loop is never gated');
  assert.ok(advanced.features.every(f => enterprise.features.includes(f)));
  assert.ok(enterprise.features.includes('restricted') && !advanced.features.includes('restricted'));
  assert.deepStrictEqual(plain(basic.limits), { users: 25, ticket_types: 5, steps_per_type: 3, tickets_per_month: 500, upload_rows: 0 });
  assert.strictEqual(enterprise.limits.ticket_types, null, 'no limit');
  assert.strictEqual(cat.features.find(f => f.key === 'sla_escalation').required_plan, 'advanced');
  assert.strictEqual(cat.features.find(f => f.key === 'bulk_upload_on_behalf').required_plan, 'enterprise');
});

// --- Effective plan -------------------------------------------------------------------------------------------------

test('no plan row = Enterprise "unassigned" (nothing breaks on deploy); seedCompanySubscriptions dry run / apply / re-apply', () => {
  const env = seed();
  const view = env.ok(env.asGet('u_admin', { action: 'getCompanyPlan', company_id: 'co_ph' }));
  assert.strictEqual(view.plan, 'enterprise');
  assert.strictEqual(view.state, 'unassigned');
  const dry = env.rt.ctx.seedCompanySubscriptions();
  assert.deepStrictEqual(plain(dry.added), ['co_ph', 'co_us']);
  assert.strictEqual(env.rows('company_subscriptions').length, 0, 'the dry run writes nothing');
  env.rt.ctx.seedCompanySubscriptionsApply();
  const subs = env.rows('company_subscriptions');
  assert.strictEqual(subs.length, 2);
  assert.ok(subs.every(s => s.plan === 'enterprise' && s.status === 'active' && s.notes === 'legacy'));
  const start = env.rt.ctx.holidayDay(subs[0].period_start);
  const end = env.rt.ctx.holidayDay(subs[0].period_end);
  assert.strictEqual(env.rt.ctx.addMonthsToDay(start, 12), env.rt.ctx.shiftDay(end, 1), '12 months, the last day included');
  assert.strictEqual(env.rt.ctx.seedCompanySubscriptions({ dryRun: false }).added.length, 0, 're-running adds nothing');
  const after = env.ok(env.asGet('u_admin', { action: 'getCompanyPlan', company_id: 'co_ph' }));
  assert.strictEqual(after.state, 'active');
  assert.ok(env.rows('admin_action_logs').some(l => l.action_type === 'SEED_COMPANY_SUBSCRIPTIONS'));
});

test('state: active -> grace (14 days paid, 7 trial) -> read_only; the latest row covering today wins; a future row is not in force', () => {
  const env = seed();
  env.plan('co_ph', 'advanced', { start: env.day(-40), end: env.day(-5) });
  let view = env.rt.ctx.companyPlan('co_ph');
  assert.strictEqual(view.state, 'grace');
  assert.strictEqual(view.plan, 'advanced', 'grace keeps the full plan');
  env.plan('co_us', 'advanced', { start: env.day(-60), end: env.day(-20) });
  assert.strictEqual(env.rt.ctx.companyPlan('co_us').state, 'read_only');
  env.plan('co_us', 'basic', { id: 'next', start: env.day(5), end: env.day(100) });
  assert.strictEqual(env.rt.ctx.companyPlan('co_us').plan, 'advanced', 'the renewal starts later');
  env.plan('co_us', 'enterprise', { id: 'now', start: env.day(-1), end: env.day(30) });
  view = env.rt.ctx.companyPlan('co_us');
  assert.strictEqual(view.plan, 'enterprise');
  assert.strictEqual(view.days_left, 30);
  // a trial ended 8 days ago: 7-day trial grace is over
  const trial = seed();
  trial.plan('co_ph', 'advanced', { status: 'trial', start: trial.day(-30), end: trial.day(-8) });
  assert.strictEqual(trial.rt.ctx.companyPlan('co_ph').state, 'read_only');
  trial.plan('co_us', 'advanced', { status: 'trial', start: trial.day(-30), end: trial.day(-6) });
  assert.strictEqual(trial.rt.ctx.companyPlan('co_us').state, 'grace');
});

test('end of day in a NON-Manila company zone: 23:59 local is still the last day, 00:01 local is the next one', () => {
  const env = seed();
  env.ok(env.as('u_admin', { action: 'saveCountryCalendar', country_code: 'US', calendar_tz: 'America/New_York',
    allowed_timezones: ['America/New_York', 'America/Los_Angeles'], weekend_days: [0, 6] }));
  env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'US', timezone: 'America/Los_Angeles' }));
  env.plan('co_us', 'advanced', { start: '2026-12-01', end: '2026-12-31', grace_days: 0 });
  const at = iso => env.rt.ctx.companyPlan('co_us', new Date(iso)).state;
  assert.strictEqual(at('2027-01-01T07:59:00Z'), 'active', 'Los Angeles 23:59 on 31 Dec');
  assert.strictEqual(at('2027-01-01T08:01:00Z'), 'read_only', 'Los Angeles 00:01 on 1 Jan (no grace)');
  // Manila already on 1 Jan at 07:59Z - a PH company would have ended; the US one hasn't
  env.plan('co_ph', 'advanced', { start: '2026-12-01', end: '2026-12-31', grace_days: 0 });
  assert.strictEqual(env.rt.ctx.companyPlan('co_ph', new Date('2027-01-01T07:59:00Z')).state, 'read_only');
});

// --- Gate -----------------------------------------------------------------------------------------------------------

test('central gate on Basic: Advanced / Enterprise routes refused with PLAN_REQUIRED + feature + required / current plan', () => {
  const env = seed();
  env.plan('co_ph', 'basic');
  const cases = [
    ['createCompanySLARule', { company_id: 'co_ph', ticket_type_id: 'tt_1', step_name: 'Managers', duration: 1, unit: 'days' }, 'company_sla_rules', 'advanced'],
    ['createSLAEscalationRule', { company_id: 'co_ph', ticket_type_id: 'tt_1' }, 'sla_escalation', 'advanced'],
    ['createCompanyHoliday', { company_id: 'co_ph', date: '2026-12-01', name: 'x' }, 'company_holidays', 'advanced'],
    ['saveStepConditions', { step_id: 'ws_0', routes: [{ conditions: [] }] }, 'conditional_routing', 'advanced'],
    ['copyWorkflowSteps', { ticket_type_id: 'tt_1', source_company_id: 'co_us', target_company_id: 'co_ph' }, 'copy_workflows', 'advanced'],
    ['createTag', { company_id: 'co_ph', name: 'urgent' }, 'tags', 'advanced'],
    ['saveReportConfig', { ticket_type_id: 'tt_1', company_id: 'co_ph', columns: [] }, 'report_config', 'advanced'],
    ['saveCompanyEmailSettings', { company_id: 'co_ph', email_enabled: 'on' }, 'email_notifications', 'advanced'],
    ['exportConfiguration', { company_id: 'co_ph' }, 'config_transfer', 'enterprise'],
    ['importConfiguration', { source_company_id: 'co_us', target_company_id: 'co_ph' }, 'config_transfer', 'enterprise']
  ];
  cases.forEach(([action, body, feature, required]) => {
    const res = env.as('u_admin', { action, ...body });
    assert.strictEqual(res.code, 'PLAN_REQUIRED', `${action}: ${res.error}`);
    assert.strictEqual(res.feature, feature, action);
    assert.strictEqual(res.required_plan, required, action);
    assert.strictEqual(res.current_plan, 'basic', action);
  });
  // a gated GET read (the audit-log viewer)
  assert.strictEqual(env.asGet('u_admin', { action: 'getAdminActionLogs', company_id: 'co_ph' }).code, 'PLAN_REQUIRED');
  // turning things off / clearing is never refused
  assert.notStrictEqual(env.as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_ph', email_enabled: 'off' }).code, 'PLAN_REQUIRED');
  assert.notStrictEqual(env.as('u_admin', { action: 'saveStepConditions', step_id: 'ws_0', routes: [] }).code, 'PLAN_REQUIRED');
  // the other company (no plan row) is Enterprise
  assert.notStrictEqual(env.as('u_admin', { action: 'createTag', company_id: 'co_us', name: 'urgent' }).code, 'PLAN_REQUIRED');
});

test('in-handler checks: task / chained / SLA steps (Advanced), Restricted switch (Enterprise), date range field; Advanced allows its own', () => {
  const env = seed();
  env.plan('co_ph', 'basic');
  env.plan('co_us', 'advanced');
  const step = (co, extra) => env.as('u_admin', { action: 'createWorkflowStep', ticket_type_id: 'tt_1', company_id: co, name: 'S2',
    status_on_reach: 'Pending', step_type: 'approval', sort_order: 2, ...extra });
  assert.strictEqual(step('co_ph', { step_type: 'task' }).feature, 'task_steps');
  assert.strictEqual(step('co_ph', { next_ticket_type_id: 'tt_1' }).feature, 'chained_tickets');
  assert.strictEqual(step('co_ph', { sla_duration: 2, sla_unit: 'days' }).feature, 'step_sla');
  env.ok(step('co_us', { step_type: 'task', sla_duration: 2, sla_unit: 'days' }));
  // updating a step INTO a task step needs the plan; other edits don't
  assert.strictEqual(env.as('u_admin', { action: 'updateWorkflowStep', step_id: 'ws_0', step_type: 'task' }).code, 'PLAN_REQUIRED');
  env.ok(env.as('u_admin', { action: 'updateWorkflowStep', step_id: 'ws_0', name: 'Managers (renamed)' }));
  // ticket type switches: tags (Advanced) / Restricted (Enterprise) - tt_1 is global, so the admin's companies decide
  env.add('ticket_types', { id: 'tt_ph', code: 'PH', name: 'PH only', company_id: 'co_ph', is_active: true });
  assert.strictEqual(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_ph', enable_tags: true }).feature, 'tags');
  env.add('ticket_types', { id: 'tt_us', code: 'US', name: 'US only', company_id: 'co_us', is_active: true });
  env.ok(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_us', enable_tags: true }));
  assert.strictEqual(env.as('u_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_us', confidential_mode: 'optional' }).required_plan, 'enterprise');
  // a date range field on a Basic company's type
  const field = env.as('u_admin', { action: 'createCustomField', ticket_type_id: 'tt_ph', entityTypeId: 'tt_ph', entityCategory: 'ticket',
    name: 'when', label: 'When', type: 'date_range' });
  assert.strictEqual(field.feature, 'date_range_field', field.error);
});

test('display time zone (U8): refused when none of the user\'s companies has Advanced; blank (= company zone) always allowed', () => {
  const env = seed();
  env.plan('co_ph', 'basic');
  env.plan('co_us', 'basic');
  const save = zone => env.as('u_req', { action: 'updateUserPreferences', preferences: { display_timezone: zone } });
  assert.strictEqual(save('Asia/Tokyo').feature, 'user_timezone_display');
  env.ok(save(''));
  env.plan('co_us', 'advanced', { id: 'up', start: env.day(-1) });
  env.ok(save('Asia/Tokyo'));
});

// --- Limits ---------------------------------------------------------------------------------------------------------

test('limits at the edge: steps per type (Basic 3), tickets per month (override 2), users (override); PLAN_LIMIT with used / max', () => {
  const env = seed();
  env.plan('co_ph', 'basic', { limit_overrides: JSON.stringify({ tickets_per_month: 2, users: 3 }) });
  const step = n => env.as('u_admin', { action: 'createWorkflowStep', ticket_type_id: 'tt_1', company_id: 'co_ph', name: `S${n}`,
    status_on_reach: 'Pending', step_type: 'approval', sort_order: n });
  env.ok(step(2));
  env.ok(step(3));
  const fourth = step(4);
  assert.strictEqual(fourth.code, 'PLAN_LIMIT');
  assert.strictEqual(fourth.limit, 'steps_per_type');
  assert.strictEqual(fourth.max, 3);
  assert.strictEqual(fourth.used, 3);
  const ticket = () => env.as('u_req', { action: 'createTicket', title: 't', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_ph' });
  env.ok(ticket());
  env.ok(ticket());
  const third = ticket();
  assert.strictEqual(third.code, 'PLAN_LIMIT', third.error);
  assert.strictEqual(third.limit, 'tickets_per_month');
  const key = env.rt.ctx.ticketUsageKey('co_ph');
  assert.match(key, /^usage:co_ph:\d{6}$/);
  assert.strictEqual(Number(env.rows('sequence_counters').find(r => r.sequence_name === key).last_number), 2, 'the refused ticket is not counted');
  assert.strictEqual(env.rows('tickets').length, 2);
  // users: u_req, u_mgr, u_admin = 3 of 3 -> a new user is refused, another role for an existing user is not
  env.add('user_profiles', { user_id: 'u_new', display_name: 'n', email: 'n@example.com', status: 'active', is_active: true });
  const assign = uid => env.as('u_admin', { action: 'assignUserRole', user_id: uid, role_id: 'r_mgr', company_id: 'co_ph' });
  assert.strictEqual(assign('u_new').limit, 'users');
  env.ok(assign('u_req'));
  assert.strictEqual(env.as('u_admin', { action: 'createUserInvite', email: 'x@example.com', company_id: 'co_ph' }).limit, 'users');
});

// --- Overrides + platform admins ------------------------------------------------------------------------------------

test('setSubscriptionOverrides: platform admins only (PLATFORM_ADMIN_UIDS - empty = nobody, CR6-02), validated, logged, applied', () => {
  const env = seed({ properties: { PLATFORM_ADMIN_UIDS: 'u_owner' } });
  env.plan('co_ph', 'basic');
  const set = (uid, body) => env.as(uid, { action: 'setSubscriptionOverrides', company_id: 'co_ph', ...body });
  assert.strictEqual(set('u_admin', { feature_overrides: { tags: true } }).code, 'PLATFORM_ONLY', 'a company admin is not the platform');
  assert.match(set('u_owner', { feature_overrides: { flying: true } }).error, /Unknown feature/);
  assert.match(set('u_owner', { limit_overrides: { users: -1 } }).error, /Invalid limit/);
  assert.match(set('u_owner', { limit_overrides: { users: true } }).error, /Invalid limit/, 'CR6-14: true is not a number');
  assert.match(set('u_owner', { limit_overrides: { users: 2.5 } }).error, /Invalid limit/);
  const view = env.ok(set('u_owner', { feature_overrides: { tags: true }, limit_overrides: { users: null }, reason: 'pilot' }));
  assert.ok(view.features.includes('tags'));
  assert.strictEqual(view.limits.users, null);
  assert.notStrictEqual(env.as('u_admin', { action: 'createTag', company_id: 'co_ph', name: 'urgent' }).code, 'PLAN_REQUIRED');
  const log = env.rows('admin_action_logs').find(l => l.action_type === 'SET_SUBSCRIPTION_OVERRIDES');
  assert.match(log.details, /pilot/);
  // a feature can also be taken away
  env.ok(set('u_owner', { feature_overrides: { tags: false } }));
  assert.ok(!env.rt.ctx.companyPlan('co_ph').features.includes('tags'));
  // the log names the verified platform admin (CR6-14)
  assert.strictEqual(log.admin_user_id, 'u_owner');
  // review CR6-02: no PLATFORM_ADMIN_UIDS -> nobody, not "any admin" (and not "anyone" while no admin exists)
  const closed = seed();
  closed.plan('co_ph', 'basic');
  const refused = closed.as('u_admin', { action: 'setSubscriptionOverrides', company_id: 'co_ph', feature_overrides: { tags: true } });
  assert.strictEqual(refused.code, 'PLATFORM_ONLY');
  assert.match(refused.error, /PLATFORM_ADMIN_UIDS/);
  assert.strictEqual(closed.as('u_req', { action: 'setSubscriptionOverrides', company_id: 'co_ph', feature_overrides: {} }).code, 'PLATFORM_ONLY');
  // review CR6-03: AUTH_MODE warn refuses too
  const warn = seed({ properties: { AUTH_MODE: 'warn', PLATFORM_ADMIN_UIDS: 'u_owner' } });
  warn.plan('co_ph', 'basic');
  assert.strictEqual(warn.as('u_req', { action: 'setSubscriptionOverrides', company_id: 'co_ph', feature_overrides: { tags: true } }).code, 'PLATFORM_ONLY');
});

test('getCompanyPlan: members see their companies only; without company_id = every company of the caller', () => {
  const env = seed();
  env.plan('co_ph', 'advanced');
  env.add('companies', { id: 'co_x', name: 'X', code: 'X', is_active: true });
  assert.match(env.asGet('u_req', { action: 'getCompanyPlan', company_id: 'co_x' }).error, /not found/);
  const mine = env.ok(env.asGet('u_req', { action: 'getCompanyPlan' }));
  assert.deepStrictEqual(Object.keys(mine.companies).sort(), ['co_ph', 'co_us']);
  assert.strictEqual(mine.companies.co_ph.plan, 'advanced');
  const withUsage = env.ok(env.asGet('u_admin', { action: 'getCompanyPlan', company_id: 'co_ph', include_usage: 'true' }));
  assert.strictEqual(withUsage.usage.users, 3);
});

// --- Review CR6 (docs/planning/TODO_CodeReview_20261101_v10.2.md) - regression tests -----------------------------------

test('CR6-01: the gate takes the company from the record, never a company_id sent next to it; unknown ids are Basic', () => {
  const env = seed();
  env.plan('co_ph', 'basic');
  const ticket = env.ok(env.as('u_req', { action: 'createTicket', title: 't', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_ph' }));
  ['nope', 'co_us', 'global'].forEach(named => {
    assert.strictEqual(env.as('u_req', { action: 'shareTicket', ticket_id: ticket.id, company_id: named, shared_with_user_id: 'u_mgr' }).code,
      'PLAN_REQUIRED', `shareTicket with company_id ${named}`);
    assert.strictEqual(env.as('u_admin', { action: 'saveStepConditions', step_id: 'ws_0', company_id: named, routes: [{ conditions: [] }] }).code,
      'PLAN_REQUIRED', `saveStepConditions with company_id ${named}`);
  });
  assert.strictEqual(env.as('u_admin', { action: 'setTicketRestricted', ticket_id: ticket.id, company_id: 'nope', is_confidential: true, reason: 'x' }).code,
    'PLAN_REQUIRED');
  // a made-up company is refused as "not found" (never the Enterprise default)
  const madeUp = env.asGet('u_admin', { action: 'getAdminActionLogs', company_id: 'nope' });
  assert.strictEqual(madeUp.success, false);
  assert.match(madeUp.error, /Company nope not found/);
  assert.match(env.as('u_admin', { action: 'createTag', company_id: 'nope', name: 'x' }).error, /Company nope not found/);
  assert.strictEqual(env.rt.ctx.companyPlan('nope').plan, 'basic');
  assert.strictEqual(env.rt.ctx.companyPlan('nope').source, 'unknown_company');
});

test('CR6-04 / CR6-05: future-dated assignments count; a reactivation is checked against the users limit', () => {
  const env = seed();
  env.plan('co_ph', 'basic', { limit_overrides: JSON.stringify({ users: 4 }) });
  ['u_a', 'u_b', 'u_c'].forEach(uid => env.add('user_profiles', { user_id: uid, display_name: uid, email: `${uid}@example.com`, status: 'active', is_active: true }));
  const assign = (uid, extra = {}) => env.as('u_admin', { action: 'assignUserRole', user_id: uid, role_id: 'r_mgr', company_id: 'co_ph', ...extra });
  env.ok(assign('u_a', { effective_start_date: env.day(2) }));
  assert.strictEqual(assign('u_b', { effective_start_date: env.day(2) }).limit, 'users', 'u_a (starting later) already counts');
  // full at 4: deactivate u_mgr, add u_b, then reactivating u_mgr must be refused
  const mgr = env.rows('user_role_assignments').find(a => a.user_id === 'u_mgr' && a.company_id === 'co_ph');
  env.ok(env.as('u_admin', { action: 'updateUserRoleAssignment', assignment_id: mgr.id, is_active: false }));
  env.ok(assign('u_b'));
  const back = env.as('u_admin', { action: 'updateUserRoleAssignment', assignment_id: mgr.id, is_active: true });
  assert.strictEqual(back.code, 'PLAN_LIMIT', back.error);
  assert.strictEqual(back.limit, 'users');
});

test('CR6-06: an invite counts in every company its role grants name', () => {
  const env = seed();
  env.plan('co_us', 'basic', { limit_overrides: JSON.stringify({ users: 2 }) }); // u_req + u_mgr = full
  const res = env.as('u_admin', { action: 'createUserInvite', email: 'new@example.com', company_id: 'co_ph',
    role_grants: [{ role_id: 'r_mgr', company_id: 'co_us' }] });
  assert.strictEqual(res.code, 'PLAN_LIMIT', res.error);
  assert.strictEqual(res.company_id, 'co_us');
  env.ok(env.as('u_admin', { action: 'createUserInvite', email: 'ok@example.com', company_id: 'co_ph', role_grants: [{ role_id: 'r_mgr' }] }));
  assert.ok(env.rt.ctx.companyUserIds('co_ph').has('invite:ok@example.com'));
});

test('CR6-07: a global ticket type moved into a company is checked against its ticket types limit', () => {
  const env = seed();
  env.plan('co_ph', 'basic', { limit_overrides: JSON.stringify({ ticket_types: 0 }) });
  const created = env.ok(env.as('u_admin', { action: 'createTicketType', name: 'Global one', code: 'GL', company_id: '' }));
  const moved = env.as('u_admin', { action: 'updateTicketType', id: created.id, name: 'Global one', code: 'GL', company_id: 'co_ph' });
  assert.strictEqual(moved.code, 'PLAN_LIMIT', moved.error);
  assert.strictEqual(moved.limit, 'ticket_types');
  // CR6-15: a thrown refusal reads without the "Error:" prefix and carries only the plan fields
  const direct = env.as('u_admin', { action: 'createTicketType', name: 'Own', code: 'OW', company_id: 'co_ph' });
  assert.strictEqual(direct.code, 'PLAN_LIMIT');
  assert.ok(!/^Error:/.test(direct.error), direct.error);
  assert.strictEqual(direct.message, undefined);
});

test('CR6-08: cancelled-only rows keep the last plan read-only; a company created after the migration is Basic', () => {
  const env = seed();
  env.plan('co_ph', 'advanced', { status: 'cancelled' });
  const cancelled = env.rt.ctx.companyPlan('co_ph');
  assert.strictEqual(cancelled.plan, 'advanced');
  assert.strictEqual(cancelled.state, 'read_only');
  assert.notStrictEqual(cancelled.plan, 'enterprise');
  env.rt.ctx.seedCompanySubscriptionsApply();
  assert.ok(env.rt.props.PLAN_CUTOVER_AT, 'the migration records the cutover');
  env.add('companies', { id: 'co_new', name: 'New', code: 'NEW', is_active: true, created_at: new Date(Date.now() + 1000).toISOString() });
  const fresh = env.rt.ctx.companyPlan('co_new');
  assert.strictEqual(fresh.plan, 'basic');
  assert.strictEqual(fresh.state, 'unassigned');
});

test('CR6-09: a global type\'s switch needs the plan in every company running it; ticking Restricted on Basic is refused', () => {
  const env = seed();
  env.plan('co_ph', 'basic'); // co_us stays Enterprise (no row)
  env.rt.ctx.createUserRoleAssignment({ user_id: 'u_us_admin', role_id: 'r_admin', company_id: 'co_us' });
  env.add('user_profiles', { user_id: 'u_us_admin', display_name: 'a', email: 'usadmin@example.com', status: 'active', is_active: true });
  env.rt.cache.clear();
  const res = env.as('u_us_admin', { action: 'setTicketTypeFeatures', ticket_type_id: 'tt_1', confidential_mode: 'optional' });
  assert.strictEqual(res.code, 'PLAN_REQUIRED', 'co_ph (Basic) runs tt_1');
  assert.strictEqual(res.company_id, 'co_ph');
  env.add('ticket_types', { id: 'tt_conf', code: 'CF', name: 'Conf', company_id: 'co_ph', is_active: true, confidential_mode: 'optional' });
  env.add('workflow_steps', { id: 'ws_conf', ticket_type_id: 'tt_conf', company_id: 'co_ph', name: 'M', status_on_reach: 'Pending',
    step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
  const ticket = env.as('u_req', { action: 'createTicket', title: 't', ticket_type_id: 'tt_conf', requester_id: 'u_req', company_id: 'co_ph', is_confidential: true });
  assert.strictEqual(ticket.code, 'PLAN_REQUIRED', ticket.error);
  assert.strictEqual(ticket.feature, 'restricted');
});

test('CR6-10 / 11 / 12 / 13 / 18: email settings by id, off-switches allowed, SLA analytics gated, copy carries SLAs, plan reads by members', () => {
  const env = seed();
  env.plan('co_ph', 'basic');
  assert.strictEqual(env.as('u_admin', { action: 'saveCompanyEmailSettings', id: 'co_ph', email_enabled: 'on' }).code, 'PLAN_REQUIRED');
  assert.notStrictEqual(env.as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_ph', email_sender_name: 'X' }).code, 'PLAN_REQUIRED');
  assert.notStrictEqual(env.as('u_admin', { action: 'saveStepConditions', step_id: 'ws_0', enabled: false, routes: [{ conditions: [] }] }).code, 'PLAN_REQUIRED');
  assert.strictEqual(env.asGet('u_admin', { action: 'getSLAPerformanceByCompany', company_id: 'co_ph' }).code, 'PLAN_REQUIRED');
  // copying steps with an SLA into a company whose plan has copy_workflows but not step_sla
  env.add('companies', { id: 'co_t', name: 'T', code: 'TT', is_active: true });
  env.plan('co_t', 'advanced', { feature_overrides: JSON.stringify({ step_sla: false }) });
  env.add('step_slas', { step_id: 'ws_1', duration: 2, unit: 'days', exclude_weekends: false, is_active: true });
  const copy = env.as('u_admin', { action: 'copyWorkflowSteps', ticket_type_id: 'tt_1', source_company_id: 'co_us', target_company_id: 'co_t' });
  assert.strictEqual(copy.feature, 'step_sla', copy.error);
  // an admin of co_ph doesn't read co_us's plan
  assert.match(env.asGet('u_admin', { action: 'getCompanyPlan', company_id: 'co_us' }).error, /not found/);
});

// --- Modes, email, read budget ----------------------------------------------------------------------------------------

test('PLAN_GATE warn logs and allows; off skips every check', () => {
  const warn = seed({ properties: { PLAN_GATE: 'warn' } });
  warn.plan('co_ph', 'basic');
  assert.notStrictEqual(warn.as('u_admin', { action: 'createTag', company_id: 'co_ph', name: 'a' }).code, 'PLAN_REQUIRED');
  assert.ok(warn.logs.some(l => /PLAN warn: tags/.test(l)));
  const off = seed({ properties: { PLAN_GATE: 'off' } });
  off.plan('co_ph', 'basic', { limit_overrides: JSON.stringify({ tickets_per_month: 0 }) });
  off.ok(off.as('u_req', { action: 'createTicket', title: 't', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_ph' }));
});

test('email outbox: a Basic company\'s notices are skipped (email notifications are Advanced)', () => {
  const env = seed();
  env.plan('co_ph', 'basic');
  env.ok(env.as('u_req', { action: 'createTicket', title: 't', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_ph' }));
  const queued = env.rows('email_outbox').filter(r => r.company_id === 'co_ph');
  assert.ok(queued.length >= 1, 'the approver notice is queued');
  env.rt.ctx.drainEmailOutbox();
  const after = env.rows('email_outbox').filter(r => r.company_id === 'co_ph');
  assert.ok(after.every(r => r.status === 'skipped' && /plan/.test(r.last_error)), JSON.stringify(after.map(r => [r.status, r.last_error])));
  assert.strictEqual(env.rt.mail.sent.length, 0);
});

test('read budget (P10): the gate reads company_subscriptions at most once per request', () => {
  const env = seed();
  env.plan('co_ph', 'advanced');
  env.as('u_admin', { action: 'createTag', company_id: 'co_ph', name: 'a' });
  assert.ok((env.rt.reads().company_subscriptions || 0) <= 1, JSON.stringify(env.rt.reads()));
  env.as('u_req', { action: 'createTicket', title: 't', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_ph' });
  assert.ok((env.rt.reads().company_subscriptions || 0) <= 1, JSON.stringify(env.rt.reads()));
});

report();
