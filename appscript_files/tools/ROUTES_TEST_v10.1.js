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
  return { rt, add, rows, as, asGet, ok, usCalendar };
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

report();
