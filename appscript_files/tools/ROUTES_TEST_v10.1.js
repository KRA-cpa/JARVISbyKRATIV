// Usage: node appscript_files/tools/ROUTES_TEST_v10.1.js appscript_files/APPSCRIPT_v10.1_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v10.1 (docs/planning/PLAN_CountryCalendars_TimeZones_20261031.md): zone math (DST-safe),
// country calendars + company clock, the ticket YEAR from the country calendar, holidays (country + company add / remove),
// the region rules, the PH migration. Run it under TZ=UTC and TZ=Asia/Manila (host-zone leaks), plus every older suite.
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v10.1.js <APPSCRIPT file>');
  process.exit(2);
}
const { test, report } = lib.makeTestRunner();
const SECRET = 's';
const plain = v => JSON.parse(JSON.stringify(v));

/** co_ph (no region yet), co_us; tt_1 with one Manager step; u_req (role), u_mgr (approver), u_admin. */
function seed(options = {}) {
  const rt = lib.makeRuntime(FILE, { properties: { AUTH_MODE: 'enforce', PROXY_SECRET: SECRET, ...(options.properties || {}) } });
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (t, r) => rt.sheets.get(t).appendRow(rt.ctx.rowFromRecord(S[t], r));
  const rows = t => rt.ctx.readTable(t).records;
  add('companies', { id: 'co_ph', name: 'PH Co', code: 'PHC', is_active: true, country_code: '', timezone: '' });
  add('companies', { id: 'co_us', name: 'US Co', code: 'USC', is_active: true, country_code: '', timezone: '' });
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
  ['u_req', 'u_mgr', 'u_admin'].forEach(uid => add('user_profiles', { user_id: uid, display_name: uid, email: `${uid}@example.com`, status: 'active', is_active: true }));
  rt.cache.clear();
  const as = (uid, body) => rt.post({ ...body, _proxy_secret: SECRET, _auth_uid: uid });
  const asGet = (uid, params) => rt.get({ ...params, _proxy_secret: SECRET, _auth_uid: uid });
  const ok = res => { assert.strictEqual(res.success, true, res.error); return res.data; };
  const usCalendar = () => ok(as('u_admin', { action: 'saveCountryCalendar', country_code: 'US', name: 'United States', calendar_tz: 'America/New_York',
    allowed_timezones: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'], weekend_days: [0, 6] }));
  const logs = [];
  rt.ctx.console.log = (...args) => logs.push(args.join(' '));
  return { rt, add, rows, as, asGet, ok, usCalendar, logs };
}

// --- T1: zone math --------------------------------------------------------------------------------------------------

test('zone math: offsets per moment (Manila fixed, New York with DST); zoneAt / startOfDayIn / endOfDayIn', () => {
  const { rt } = seed();
  const c = rt.ctx;
  assert.strictEqual(c.zoneOffsetMinutes('Asia/Manila', new Date('2026-07-01T00:00:00Z')), 480);
  assert.strictEqual(c.zoneOffsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z')), -300);
  assert.strictEqual(c.zoneOffsetMinutes('America/New_York', new Date('2026-07-15T12:00:00Z')), -240);
  assert.strictEqual(c.zoneAt('2026-11-01', '08:00', 'Asia/Manila').toISOString(), '2026-11-01T00:00:00.000Z');
  assert.strictEqual(c.zoneAt('2026-07-04', '09:00', 'America/New_York').toISOString(), '2026-07-04T13:00:00.000Z');
  assert.strictEqual(c.zoneAt('2026-12-04', '09:00', 'America/New_York').toISOString(), '2026-12-04T14:00:00.000Z');
  // the DST day in New York (8 Mar 2026) has 23 hours
  const start = c.startOfDayIn('America/New_York', new Date('2026-03-08T15:00:00Z'));
  const end = c.endOfDayIn('America/New_York', new Date('2026-03-08T15:00:00Z'));
  assert.strictEqual((end - start) / 3600e3, 23);
  assert.strictEqual(c.dayIn(new Date('2026-12-31T20:00:00Z'), 'Asia/Manila'), '2027-01-01');
  assert.strictEqual(c.weekdayOfDay('2026-11-01', 'Asia/Manila'), 0, 'a Sunday');
  assert.strictEqual(c.validTimeZone('Asia/Singapore'), true);
  assert.strictEqual(c.validTimeZone('Mars/Olympus'), false);
  assert.strictEqual(c.validTimeZone('+08:00'), false);
});

// --- T1: calendars, clock, year, holidays -------------------------------------------------------------------------

test('companyClock: no region = Philippines / Manila; a country calendar + an allowed zone decide; a foreign zone falls back', () => {
  const env = seed();
  const ph = env.rt.ctx.companyClock('co_ph');
  assert.deepStrictEqual(plain(ph), { country: 'PH', tz: 'Asia/Manila', calendarTz: 'Asia/Manila', weekendDays: [0, 6],
    businessHours: { start: '08:00', end: '17:00' } });
  env.usCalendar();
  env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'US', timezone: 'America/Los_Angeles' }));
  const us = env.rt.ctx.companyClock('co_us');
  assert.strictEqual(us.tz, 'America/Los_Angeles');
  assert.strictEqual(us.calendarTz, 'America/New_York');
  env.rt.ctx.updateRecordFields('companies', 'co_us', { timezone: 'Asia/Tokyo' });
  assert.strictEqual(env.rt.ctx.companyClock('co_us').tz, 'America/New_York', 'not a US zone -> the country calendar zone');
});

test('calendarYear: the year of the company\'s COUNTRY calendar (not its own zone, not the script zone)', () => {
  const env = seed();
  env.usCalendar();
  env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'US', timezone: 'America/Los_Angeles' }));
  const at = new Date('2027-01-01T03:30:00Z'); // Manila 11:30 on 1 Jan; New York 22:30 on 31 Dec; LA 19:30 on 31 Dec
  assert.strictEqual(env.rt.ctx.calendarYear('co_ph', at), '2027');
  assert.strictEqual(env.rt.ctx.calendarYear('co_us', at), '2026');
  const late = new Date('2027-01-01T05:30:00Z'); // New York 00:30 on 1 Jan, LA still 21:30 on 31 Dec -> the country year
  assert.strictEqual(env.rt.ctx.calendarYear('co_us', late), '2027');
});

test('saveCountryCalendar: validation (zone, weekend days, hours) and admins only; changes are logged', () => {
  const env = seed();
  assert.match(env.as('u_admin', { action: 'saveCountryCalendar', country_code: 'X', calendar_tz: 'Asia/Manila' }).error, /2-letter/);
  assert.match(env.as('u_admin', { action: 'saveCountryCalendar', country_code: 'SG', calendar_tz: 'Mars/Base' }).error, /not a time zone/);
  assert.match(env.as('u_admin', { action: 'saveCountryCalendar', country_code: 'SG', calendar_tz: 'Asia/Singapore', weekend_days: [7] }).error, /weekend_days/);
  assert.strictEqual(env.as('u_req', { action: 'saveCountryCalendar', country_code: 'SG', calendar_tz: 'Asia/Singapore' }).code, 'ADMIN_ONLY');
  const ae = env.ok(env.as('u_admin', { action: 'saveCountryCalendar', country_code: 'ae', name: 'UAE', calendar_tz: 'Asia/Dubai', weekend_days: [5, 6] }));
  assert.deepStrictEqual(plain(ae.weekend_days), [5, 6]);
  assert.deepStrictEqual(plain(ae.allowed_timezones), ['Asia/Dubai']);
  assert.ok(env.rows('admin_action_logs').some(l => l.action_type === 'CREATE_COUNTRY_CALENDAR' && l.target_id === 'AE'));
  assert.ok(env.ok(env.asGet('u_req', { action: 'getCountryCalendars' })).some(c => c.country_code === 'PH'), 'PH is always there');
});

test('setCompanyRegion: the zone must belong to the country; a country change after the first ticket needs a reason', () => {
  const env = seed();
  env.usCalendar();
  assert.match(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'US', timezone: 'Asia/Manila' }).error, /isn't a zone of US/);
  assert.match(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'ZZ' }).error, /No calendar for ZZ/);
  env.ok(env.as('u_req', { action: 'createTicket', title: 'x', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_ph' }));
  assert.match(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_ph', country_code: 'US' }).error, /give a reason/);
  env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_ph', country_code: 'US', reason: 'moved HQ' }));
  const log = env.rows('admin_action_logs').find(l => l.action_type === 'SET_COMPANY_REGION');
  assert.match(log.details, /moved HQ/);
  assert.strictEqual(env.as('u_req', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'US' }).code, 'ADMIN_ONLY');
});

test('holidays: the country\'s days + company adds - company removes; Fri / Sat weekends; isBusinessDay', () => {
  const env = seed();
  env.ok(env.as('u_admin', { action: 'addPhilippineHolidays', year: 2026, dry_run: false })); // the alias -> country PH
  const ph = env.rows('country_holidays').filter(h => h.country_code === 'PH');
  assert.ok(ph.length >= 10, `${ph.length} PH holidays`);
  assert.ok(env.rt.ctx.companyHolidayDays('co_ph').has('2026-12-25'));
  env.add('company_holidays', { id: 'h_add', company_id: 'co_ph', date: "'2026-11-03", name: 'Founders day', is_active: true, overrides_country: 'add' });
  env.add('company_holidays', { id: 'h_rm', company_id: 'co_ph', date: "'2026-12-25", name: 'We work', is_active: true, overrides_country: 'remove' });
  const days = env.rt.ctx.companyHolidayDays('co_ph');
  assert.ok(days.has('2026-11-03') && !days.has('2026-12-25'));
  assert.ok(env.rt.ctx.companyHolidayDays('co_us').has('2026-12-25'), 'another PH company still has it');
  env.ok(env.as('u_admin', { action: 'saveCountryCalendar', country_code: 'AE', calendar_tz: 'Asia/Dubai', weekend_days: [5, 6] }));
  env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'AE', timezone: 'Asia/Dubai' }));
  assert.strictEqual(env.rt.ctx.isBusinessDay('co_us', new Date('2026-11-06T08:00:00Z')), false, 'a Friday in Dubai');
  assert.strictEqual(env.rt.ctx.isBusinessDay('co_us', new Date('2026-11-08T08:00:00Z')), true, 'a Sunday in Dubai');
  const imported = env.ok(env.as('u_admin', { action: 'importCountryHolidays', country_code: 'AE', dry_run: false,
    rows: [{ date: '2026-12-02', name: 'National Day' }, { date: 'bad', name: 'x' }] }));
  assert.strictEqual(imported.added, 1);
  assert.strictEqual(imported.errors.length, 1);
  assert.strictEqual(env.rt.ctx.isBusinessDay('co_us', new Date('2026-12-02T08:00:00Z')), false);
});

test('migrateCountryCalendars: dry run writes nothing; apply = PH row, every company PH / Manila, all-company days -> PH; idempotent', () => {
  const env = seed();
  env.add('company_holidays', { id: 'h_all', company_id: '', date: "'2026-12-30", name: 'Rizal Day', is_active: true });
  env.add('company_holidays', { id: 'h_co', company_id: 'co_ph', date: "'2026-11-03", name: 'Founders', is_active: true });
  const dry = env.rt.ctx.migrateCountryCalendars({ dryRun: true });
  assert.deepStrictEqual(plain(dry), { dryRun: true, calendar_added: true, companies: 2, holidays_moved: 1 });
  assert.strictEqual(env.rows('country_calendars').length, 0);
  env.rt.ctx.migrateCountryCalendars({ dryRun: false });
  assert.strictEqual(env.rows('country_calendars')[0].country_code, 'PH');
  assert.ok(env.rows('companies').every(c => c.country_code === 'PH' && c.timezone === 'Asia/Manila'));
  assert.ok(env.rows('country_holidays').some(h => h.name === 'Rizal Day'));
  assert.strictEqual(env.rows('company_holidays').find(h => h.id === 'h_all').is_active, false, 'moved, kept (soft)');
  assert.notStrictEqual(env.rows('company_holidays').find(h => h.id === 'h_co').is_active, false, 'company days stay');
  assert.ok(env.rt.ctx.companyHolidayDays('co_ph').has('2026-12-30'), 'same holidays as before');
  const again = env.rt.ctx.migrateCountryCalendars({ dryRun: false });
  assert.strictEqual(again.companies + again.holidays_moved + (again.calendar_added ? 1 : 0), 0, JSON.stringify(again));
});

// --- T2: call sites on the company clock --------------------------------------------------------------------------

/** co_us becomes a Dubai company: AE calendar (Fri / Sat weekend), zone Asia/Dubai. */
function dubai(env) {
  env.ok(env.as('u_admin', { action: 'saveCountryCalendar', country_code: 'AE', name: 'UAE', calendar_tz: 'Asia/Dubai', weekend_days: [5, 6] }));
  env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'AE', timezone: 'Asia/Dubai' }));
}

test('T2 step SLA: days skip the COMPANY country\'s weekend in its zone (Dubai Fri / Sat), Manila Sat / Sun stays the default', () => {
  const env = seed();
  dubai(env);
  env.add('step_slas', { id: 'sla_ae', step_id: 'ws_1', duration: 1, unit: 'days', exclude_weekends: true, is_active: true });
  env.add('step_slas', { id: 'sla_ph', step_id: 'ws_0', duration: 1, unit: 'days', exclude_weekends: true, is_active: true });
  const start = '2026-11-05T06:00:00.000Z'; // Thursday: 10:00 in Dubai, 14:00 in Manila
  const ae = env.rt.ctx.stepDueDateFor({ company_id: 'co_us', ticket_type_id: 'tt_1' }, { id: 'ws_1', name: 'Managers' }, start);
  assert.strictEqual(ae.toISOString(), '2026-11-08T06:00:00.000Z', 'Fri + Sat skipped -> Sunday 10:00 Dubai');
  const ph = env.rt.ctx.stepDueDateFor({ company_id: 'co_ph', ticket_type_id: 'tt_1' }, { id: 'ws_0', name: 'Managers' }, start);
  assert.strictEqual(ph.toISOString(), '2026-11-06T06:00:00.000Z', 'Friday is a working day in Manila');
  // the old 4-argument call (no clock) keeps the v9.5 Manila answer
  assert.strictEqual(env.rt.ctx.calculateSLADueDate(start, 1, 'days', true).toISOString(), '2026-11-06T06:00:00.000Z');
});

test('T2 company SLA rule: business hours on the country\'s working days (Sun-Thu in Dubai) and its hours', () => {
  const env = seed();
  dubai(env);
  const cal = env.rt.ctx.slaCalendar({ business_days: '', business_hours_start: '', business_hours_end: '' }, new Set(), env.rt.ctx.companyClock('co_us'));
  assert.deepStrictEqual(plain(cal.business_days), [0, 1, 2, 3, 4], 'default = the AE working days');
  assert.strictEqual(cal.tz, 'Asia/Dubai');
  // Thursday 15:00 Dubai + 4 business hours: 2 h Thursday, Fri / Sat closed, 2 h on Sunday -> 10:00
  const due = env.rt.ctx.addSlaTime('2026-11-05T11:00:00.000Z', 4, 'business_hours', cal);
  assert.strictEqual(due.toISOString(), '2026-11-08T06:00:00.000Z');
});

test('T2 holidays in SLA time: a country holiday is skipped; a company "remove" makes it a working day again', () => {
  const env = seed();
  env.ok(env.as('u_admin', { action: 'importCountryHolidays', country_code: 'PH', dry_run: false, rows: [{ date: '2026-11-04', name: 'Test day' }] }));
  const calFor = () => env.rt.ctx.slaCalendar({ exclude_holidays: true }, env.rt.ctx.companyHolidayDays('co_ph'), env.rt.ctx.companyClock('co_ph'));
  const start = '2026-11-03T02:00:00.000Z'; // Tuesday 10:00 Manila
  assert.strictEqual(env.rt.ctx.addSlaTime(start, 1, 'business_days', calFor()).toISOString(), '2026-11-05T02:00:00.000Z', 'Wed skipped');
  env.add('company_holidays', { id: 'h_rm', company_id: 'co_ph', date: "'2026-11-04", name: 'We work', is_active: true, overrides_country: 'remove' });
  assert.strictEqual(env.rt.ctx.addSlaTime(start, 1, 'business_days', calFor()).toISOString(), '2026-11-04T02:00:00.000Z', 'Wed counts again');
});

test('T2 ticket number: peek and create use the country calendar year (generateTicketNumber gets the company)', () => {
  const env = seed();
  dubai(env);
  const year = env.rt.ctx.calendarYear('co_us');
  const peek = env.ok(env.asGet('u_req', { action: 'getNextTicketNumber', company_id: 'co_us', ticket_type_id: 'tt_1' }));
  assert.strictEqual(peek.ticket_number, `USC-PR-${year}-00000001`);
  const created = env.ok(env.as('u_req', { action: 'createTicket', title: 'x', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_us' }));
  assert.strictEqual(created.ticket_number, `USC-PR-${year}-00000001`);
  const source = require('fs').readFileSync(FILE, 'utf8');
  const calls = source.split('\n').filter(l => /generateTicketNumber\(/.test(l) && !/^function |^\s*\*/.test(l));
  assert.ok(calls.length >= 2, calls.join('\n'));
  calls.forEach(l => assert.match(l, /generateTicketNumber\([^,]+,[^,]+,[^,)]+\)/, `passes the company id: ${l.trim()}`));
});

test('T2 getTickets: no limit = one page of 50 ({ items, next_cursor, has_more }), no DEPRECATED log (D6)', () => {
  const env = seed();
  env.ok(env.as('u_req', { action: 'createTicket', title: 'a', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_ph' }));
  const page = env.ok(env.asGet('u_req', { action: 'getTickets' }));
  assert.ok(!Array.isArray(page) && Array.isArray(page.items));
  assert.strictEqual(page.items.length, 1);
  assert.strictEqual(page.has_more, false);
  assert.ok('next_cursor' in page);
  assert.ok(!env.logs.some(l => /DEPRECATED getTickets/.test(l)));
});

test('T2 date filters: a yyyy-MM-dd day is the asked company\'s day (Dubai vs Manila); no company = the default zone', () => {
  const env = seed();
  dubai(env);
  const make = co => {
    const id = String(env.ok(env.as('u_req', { action: 'createTicket', title: co, ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: co })).id);
    env.rt.ctx.updateRecordFields('tickets', id, { created_at: '2026-10-01T21:00:00.000Z' }); // Dubai 2 Oct 01:00; Manila 2 Oct 05:00
    return id;
  };
  const us = make('co_us');
  const ph = make('co_ph');
  const ids = filters => env.ok(env.asGet('u_req', { action: 'getTickets', limit: 50, filters: JSON.stringify(filters) })).items.map(t => String(t.id));
  assert.deepStrictEqual(ids({ company_id: 'co_us', date_from: '2026-10-02', date_to: '2026-10-02' }), [us]);
  assert.deepStrictEqual(ids({ company_id: 'co_ph', date_from: '2026-10-02', date_to: '2026-10-02' }), [ph]);
  env.rt.ctx.updateRecordFields('tickets', us, { created_at: '2026-10-01T19:30:00.000Z' }); // Dubai 1 Oct 23:30, Manila 2 Oct 03:30
  assert.deepStrictEqual(ids({ company_id: 'co_us', date_from: '2026-10-02' }), [], 'still 1 Oct in Dubai');
  assert.deepStrictEqual(ids({ company_id: 'co_us', date_to: '2026-10-01' }), [us]);
  assert.deepStrictEqual(ids({ date_from: '2026-10-02', date_to: '2026-10-02' }).sort(), [us, ph].sort(), 'no company: Manila days');
});

test('T2 SLA status: "Due Today" is the company\'s today', () => {
  const env = seed();
  dubai(env);
  const now = new Date('2026-11-05T19:30:00.000Z'); // Dubai Thu 23:30; Manila Fri 03:30
  const due = '2026-11-05T20:30:00.000Z'; // Dubai Fri 00:30; Manila Fri 04:30
  assert.strictEqual(env.rt.ctx.ticketSLAStatus({ status: 'Pending', company_id: 'co_us', step_due_date: due }, now), 'On Track');
  assert.strictEqual(env.rt.ctx.ticketSLAStatus({ status: 'Pending', company_id: 'co_ph', step_due_date: due }, now), 'Due Today');
});

test('CR5-02 setCompanyRegion without a timezone keeps the company zone when the country allows it', () => {
  const env = seed();
  env.usCalendar();
  env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'US', timezone: 'America/Los_Angeles' }));
  const again = env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'US' }));
  assert.strictEqual(again.timezone, 'America/Los_Angeles');
  env.ok(env.as('u_admin', { action: 'saveCountryCalendar', country_code: 'AE', calendar_tz: 'Asia/Dubai', weekend_days: [5, 6] }));
  const moved = env.ok(env.as('u_admin', { action: 'setCompanyRegion', company_id: 'co_us', country_code: 'AE' }));
  assert.strictEqual(moved.timezone, 'Asia/Dubai', 'a zone of the old country falls back to the new reference zone');
});

// --- T3: holidays + SLA rule zone from the app ----------------------------------------------------------------------

test('T3 createCompanyHoliday: "remove" = the company works a country holiday (needs a company); listed and counted', () => {
  const env = seed();
  env.ok(env.as('u_admin', { action: 'importCountryHolidays', country_code: 'PH', dry_run: false, rows: [{ date: '2026-11-04', name: 'Test day' }] }));
  assert.match(env.as('u_admin', { action: 'createCompanyHoliday', date: '2026-11-04', name: 'x', overrides_country: 'remove' }).error, /needs a company/);
  const saved = env.ok(env.as('u_admin', { action: 'createCompanyHoliday', company_id: 'co_ph', date: '2026-11-04', name: 'Working day', overrides_country: 'remove' }));
  assert.strictEqual(saved.overrides_country, 'remove');
  assert.ok(!env.rt.ctx.companyHolidayDays('co_ph').has('2026-11-04'), 'worked');
  assert.ok(env.rt.ctx.companyHolidayDays('co_us').has('2026-11-04'), 'only this company');
  const listed = env.ok(env.asGet('u_admin', { action: 'getCompanyHolidays', company_id: 'co_ph', year: 2026 }));
  assert.ok(listed.some(h => h.source === 'company' && h.overrides_country === 'remove' && h.date === '2026-11-04'));
  assert.ok(!listed.some(h => h.source === 'country' && h.date === '2026-11-04'), 'the country row is hidden for this company');
  const plain = env.ok(env.as('u_admin', { action: 'createCompanyHoliday', company_id: 'co_ph', date: '2026-11-10', name: 'Founders' }));
  assert.strictEqual(plain.overrides_country, 'add');
});

test('T3 company SLA rule: no timezone defaulted any more (the company clock decides)', () => {
  const env = seed();
  const rule = env.ok(env.as('u_admin', { action: 'createCompanySLARule', company_id: 'co_ph', ticket_type_id: 'tt_1', step_name: 'Managers',
    duration: 4, unit: 'business_hours' }));
  assert.strictEqual(String(rule.timezone || ''), '');
});

// --- T3: display zone -----------------------------------------------------------------------------------------------

test('T3 preferences: display_timezone blank = company zone, a real zone is kept, a bad one refused; written by header', () => {
  const env = seed();
  assert.strictEqual(env.ok(env.asGet('u_req', { action: 'getUserPreferences' })).display_timezone, '');
  env.ok(env.as('u_req', { action: 'updateUserPreferences', preferences: { language: 'fil' } }));
  const saved = env.ok(env.as('u_req', { action: 'updateUserPreferences', preferences: { display_timezone: 'Asia/Singapore' } }));
  assert.strictEqual(saved.display_timezone, 'Asia/Singapore');
  assert.strictEqual(saved.language, 'fil', 'other preferences kept');
  const bad = env.as('u_req', { action: 'updateUserPreferences', preferences: { display_timezone: 'Mars/Base' } });
  assert.strictEqual(bad.success, false);
  assert.match(bad.error, /not a time zone/);
  const row = env.rows('user_preferences').find(r => r.user_id === 'u_req');
  assert.strictEqual(row.display_timezone, 'Asia/Singapore', 'the column after updated_at is written (the positional row dropped it)');
  assert.strictEqual(env.rows('user_preferences').length, 1);
  env.ok(env.as('u_req', { action: 'updateUserPreferences', preferences: { display_timezone: '' } }));
  assert.strictEqual(env.ok(env.asGet('u_req', { action: 'getUserPreferences' })).display_timezone, '');
});

test('T3 profile: each company carries its country + zone, the user their display zone; server answers do not depend on it', () => {
  const env = seed();
  dubai(env);
  const profile = () => env.ok(env.as('u_req', { action: 'getUserProfile', user_id: 'u_req' }));
  const before = profile();
  const byId = Object.fromEntries(before.companies.map(c => [c.id, c]));
  assert.deepStrictEqual([byId.co_ph.country_code, byId.co_ph.timezone], ['PH', 'Asia/Manila']);
  assert.deepStrictEqual([byId.co_us.country_code, byId.co_us.timezone], ['AE', 'Asia/Dubai']);
  assert.strictEqual(before.display_timezone, '');
  const id = String(env.ok(env.as('u_req', { action: 'createTicket', title: 'z', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_us' })).id);
  const read = () => JSON.stringify(env.ok(env.as('u_req', { action: 'getTicket', ticket_id: id })));
  const first = read();
  env.ok(env.as('u_req', { action: 'updateUserPreferences', preferences: { display_timezone: 'America/New_York' } }));
  assert.strictEqual(profile().display_timezone, 'America/New_York');
  assert.strictEqual(read(), first, 'the display zone only changes the display');
});

report();
