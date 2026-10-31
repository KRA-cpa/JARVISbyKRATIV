// Usage: node appscript_files/tools/ADMIN_TOOLS_TEST.js <APPSCRIPT file v9.5+> <ADMIN_Tools file>
// Offline test of the "JARVIS Admin" Sheet menu (second script file): the menu is built, every item calls a
// function that exists, apply items show the dry run and change nothing when the answer is No.
// v1.1 (AppScript v9.6+): the "4. Users & access" cases run only when the menu file has adminMakeUserAdmin.
// v1.2: the "5. Testing (temporary)" cases run only when the menu file has testSetupMyAdmin.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const [MAIN, ADMIN] = process.argv.slice(2);
if (!MAIN || !ADMIN) {
  console.error('Usage: node ADMIN_TOOLS_TEST.js <APPSCRIPT file> <ADMIN_Tools file>');
  process.exit(2);
}
const combined = path.join(os.tmpdir(), `admin_test_${process.pid}.js`);
fs.writeFileSync(combined, fs.readFileSync(MAIN, 'utf8') + '\n;\n' + fs.readFileSync(ADMIN, 'utf8'));
const { test, report } = lib.makeTestRunner();

/** A runtime with a fake SpreadsheetApp.getUi(): records menus and dialogs, answers YES / NO / prompt text. */
function fresh({ answer = 'YES', promptText = '' } = {}) {
  const rt = lib.makeRuntime(combined);
  const dialogs = [];
  const menus = [];
  const makeMenu = name => {
    const menu = { name, items: [], subMenus: [] };
    const api = {
      addItem: (label, fn) => { menu.items.push({ label, fn }); return api; },
      addSeparator: () => api,
      addSubMenu: sub => { menu.subMenus.push(sub.__menu); return api; },
      addToUi: () => { menus.push(menu); return api; },
      __menu: menu
    };
    return api;
  };
  const ui = {
    ButtonSet: { OK: 'OK', YES_NO: 'YES_NO', OK_CANCEL: 'OK_CANCEL' },
    Button: { YES: 'YES', NO: 'NO', OK: 'OK', CANCEL: 'CANCEL' },
    createMenu: makeMenu,
    alert: (title, text, buttons) => { dialogs.push({ title, text, buttons }); return buttons === 'YES_NO' ? answer : 'OK'; },
    prompt: (title, text) => {
      dialogs.push({ title, text });
      // promptText may be a list: one answer per prompt, in order (v1.1 asks uid, then company code)
      const reply = Array.isArray(promptText) ? (promptText.shift() || '') : promptText;
      return { getSelectedButton: () => 'OK', getResponseText: () => reply };
    }
  };
  rt.ctx.SpreadsheetApp.getUi = () => ui;
  return { rt, dialogs, menus };
}

const snapshot = rt => JSON.stringify([...rt.sheets.keys()].sort().map(name => [name, rt.sheets.get(name).trimmed()]));

test('onOpen builds the JARVIS Admin menu; every item calls a defined function', () => {
  const { rt, menus } = fresh();
  rt.ctx.onOpen();
  assert.strictEqual(menus.length, 1);
  assert.strictEqual(menus[0].name, 'JARVIS Admin');
  const items = menus[0].items.concat(...menus[0].subMenus.map(m => m.items));
  assert.ok(items.length >= 10, `${items.length} items`);
  items.forEach(item => assert.strictEqual(typeof rt.ctx[item.fn], 'function', `${item.label} -> ${item.fn}`));
});

test('Check tables (dry run) on an empty Sheet lists what to create and changes nothing', () => {
  const { rt, dialogs } = fresh();
  const before = snapshot(rt);
  rt.ctx.adminRebuildDryRun();
  assert.strictEqual(snapshot(rt), before);
  assert.match(dialogs[0].text, /to create: .*tickets/);
});

test('Repair tables: No changes nothing, Yes applies', () => {
  const no = fresh({ answer: 'NO' });
  const before = snapshot(no.rt);
  no.rt.ctx.adminRebuildApply();
  assert.strictEqual(snapshot(no.rt), before, 'No -> nothing written');
  const yes = fresh({ answer: 'YES' });
  yes.rt.ctx.adminRebuildApply();
  assert.ok(yes.rt.sheets.get('tickets'), 'tables created');
  assert.match(yes.dialogs.pop().title, /done/);
});

test('Status shows auth and trigger state without the secret', () => {
  const { rt, dialogs } = fresh();
  rt.props.PROXY_SECRET = 'very-secret-value';
  rt.ctx.adminStatus();
  assert.match(dialogs[0].text, /PROXY_SECRET: set/);
  assert.ok(!dialogs[0].text.includes('very-secret-value'));
  assert.match(dialogs[0].text, /SLA escalation trigger: NOT installed/);
  rt.ctx.adminInstallSLATrigger();
  rt.ctx.adminStatus();
  assert.match(dialogs.pop().text, /trigger: installed \(1\)/);
});

test('SLA preview and migrate run on a rebuilt Sheet', () => {
  const { rt, dialogs } = fresh();
  rt.ctx.rebuildAllTablesApply();
  rt.ctx.adminSLADryRun();
  assert.match(dialogs.pop().title, /preview/);
  rt.ctx.adminMigrateEscalations();
  assert.match(dialogs.pop().text, /Nothing to migrate/);
});

test('Set AUTH_MODE: refuses enforce without a secret, accepts warn, rejects junk', () => {
  const noSecret = fresh({ promptText: 'enforce' });
  noSecret.rt.ctx.rebuildAllTablesApply();
  noSecret.rt.ctx.adminSetAuthMode();
  assert.strictEqual(noSecret.rt.props.AUTH_MODE, undefined);
  assert.match(noSecret.dialogs.pop().text, /PROXY_SECRET is not set/);
  const warn = fresh({ promptText: 'Warn' });
  warn.rt.ctx.rebuildAllTablesApply();
  warn.rt.ctx.adminSetAuthMode();
  assert.strictEqual(warn.rt.props.AUTH_MODE, 'warn');
  const junk = fresh({ promptText: 'maybe' });
  junk.rt.ctx.adminSetAuthMode();
  assert.strictEqual(junk.rt.props.AUTH_MODE, undefined);
});

// --- v1.1: 4. Users & access (AppScript v9.6+) ---------------------------------------------------------------
const hasV11 = fs.readFileSync(ADMIN, 'utf8').includes('function adminMakeUserAdmin');

if (hasV11) {
  /** A rebuilt Sheet with one company, an admin role and a signed-in (logged) user. */
  const seeded = (options) => {
    const env = fresh(options);
    env.rt.ctx.rebuildAllTablesApply();
    const S = env.rt.ctx.__TABLE_SCHEMAS;
    const add = (t, r) => env.rt.sheets.get(t).appendRow(env.rt.ctx.rowFromRecord(S[t], r));
    add('companies', { id: 'co_1', name: 'Main Co', code: 'MAIN', is_active: true });
    add('admin_action_logs', { id: 'log_1', admin_user_id: 'uid_first', action_type: 'USER_LOGIN', target_entity: 'USER', target_id: 'uid_first',
      details: JSON.stringify({ email: 'first@example.com' }), timestamp: new Date().toISOString() });
    return { ...env, add };
  };

  test('v1.1 Status says "No admin yet - bootstrap open" until an admin exists', () => {
    const { rt, dialogs } = seeded();
    rt.ctx.adminStatus();
    assert.match(dialogs.pop().text, /No admin yet - bootstrap open/);
  });

  test('v1.1 Recent sign-ins lists the uid and email', () => {
    const { rt, dialogs } = seeded();
    rt.ctx.adminRecentSignIns();
    assert.match(dialogs.pop().text, /uid_first\s+first@example\.com/);
  });

  test('v1.1 Make a user admin: No changes nothing; Yes creates System Admin + the assignment and closes bootstrap', () => {
    const no = seeded({ answer: 'NO', promptText: ['uid_first'] });
    const before = snapshot(no.rt);
    no.rt.ctx.adminMakeUserAdmin();
    assert.strictEqual(snapshot(no.rt), before);
    const yes = seeded({ answer: 'YES', promptText: ['uid_first'] });
    yes.rt.ctx.adminMakeUserAdmin();
    assert.match(yes.dialogs.pop().text, /uid_first is now an admin/);
    assert.ok(yes.rt.ctx.isAdminUser('uid_first'));
    assert.strictEqual(yes.rt.ctx.adminBootstrapOpen(), false);
    assert.ok(yes.rt.ctx.readTable('admin_action_logs').records.some(r => r.action_type === 'MAKE_USER_ADMIN'));
    yes.rt.ctx.adminStatus();
    assert.match(yes.dialogs.pop().text, /Admins: 1 \(uid_first\)/);
  });

  test('v1.1 Make a user admin: an unknown email changes nothing; Pending invites lists invites', () => {
    const { rt, dialogs, add } = seeded({ promptText: ['nobody@example.com'] });
    rt.ctx.adminMakeUserAdmin();
    assert.match(dialogs.pop().text, /No user profile has the email/);
    add('user_invites', { id: 'inv_1', email: 'new@example.com', company_id: 'co_1', status: 'pending',
      expires_at: new Date(Date.now() + 86400000).toISOString(), is_active: true });
    rt.ctx.adminListInvites();
    assert.match(dialogs.pop().text, /1 pending:\n- new@example\.com/);
  });
}

// --- v1.2: 5. Testing (temporary) ---------------------------------------------------------------------------
const hasV12 = fs.readFileSync(ADMIN, 'utf8').includes('function testSetupMyAdmin');

if (hasV12) {
  /** A rebuilt Sheet: one company, Manager + Finance roles, no admin yet. */
  const testing = (options) => {
    const env = fresh(options);
    env.rt.ctx.rebuildAllTablesApply();
    const S = env.rt.ctx.__TABLE_SCHEMAS;
    const add = (t, r) => env.rt.sheets.get(t).appendRow(env.rt.ctx.rowFromRecord(S[t], r));
    add('companies', { id: 'co_1', name: 'Main Co', code: 'MAIN', is_active: true });
    add('roles', { id: 'r_mgr', name: 'Manager', company_id: '', is_active: true });
    add('roles', { id: 'r_fin', name: 'Finance', company_id: 'co_1', is_active: true });
    add('ticket_types', { id: 'tt_1', code: 'PR', name: 'Purchase', is_active: true });
    const live = uid => env.rt.ctx.readTable('user_role_assignments').records
      .filter(a => a.user_id === uid && env.rt.ctx.isAssignmentActive(a, new Date()));
    return { ...env, add, live };
  };
  const setUp = () => {
    const env = testing({ answer: 'YES', promptText: ['uid_me', 'Ken Tester, Ken@Example.com'] });
    env.rt.ctx.testSetupMyAdmin();
    return env;
  };

  test('v1.2 Set up my admin access: remembers the uid, admin role, profile row, placeholder admin', () => {
    const { rt, dialogs, live } = setUp();
    assert.match(dialogs.pop().text, /Admin role: added[\s\S]*Profile row: added[\s\S]*placeholder admin: added/);
    assert.strictEqual(rt.props.TEST_MY_UID, 'uid_me');
    assert.ok(rt.ctx.isAdminUser('uid_me'));
    assert.ok(rt.ctx.isAdminUser('placeholder_admin'));
    const profile = rt.ctx.readTable('user_profiles').records.find(p => p.user_id === 'uid_me');
    assert.strictEqual(profile.email, 'ken@example.com');
    assert.strictEqual(profile.display_name, 'Ken Tester');
    assert.strictEqual(live('uid_me').length, 1);
    // No -> nothing written
    const no = testing({ answer: 'NO', promptText: ['uid_me', 'Ken, ken@example.com'] });
    const before = snapshot(no.rt);
    no.rt.ctx.testSetupMyAdmin();
    assert.strictEqual(snapshot(no.rt), before);
  });

  test('v1.2 Give me a test role: TEST-tagged, temporary until tonight (Manila); listed; removed without touching admin', () => {
    const env = setUp();
    env.rt.ctx.SpreadsheetApp.getUi().prompt = (() => {
      const answers = ['Manager', 'PR, 1'];
      return (title, text) => { env.dialogs.push({ title, text }); const r = answers.shift() || ''; return { getSelectedButton: () => 'OK', getResponseText: () => r }; };
    })();
    env.rt.ctx.testGiveMeRole();
    assert.match(env.dialogs.pop().text, /You now hold Manager in MAIN for PR until the end of \d{4}-\d{2}-\d{2}/);
    const test = env.live('uid_me').find(a => a.role_id === 'r_mgr');
    assert.ok(test && String(test.assignment_notes).startsWith('TEST'));
    assert.strictEqual(test.assignment_type, 'temporary');
    assert.strictEqual(test.ticket_type_id, 'tt_1');
    env.rt.ctx.testListMyRoles();
    assert.match(env.dialogs.pop().text, /Manager in MAIN  \[TEST\]/);
    env.rt.ctx.testRemoveMyTestRoles();
    assert.ok(!env.live('uid_me').some(a => a.role_id === 'r_mgr'), 'test role gone');
    assert.ok(env.rt.ctx.isAdminUser('uid_me'), 'admin kept');
  });

  test('v1.2 Test as non-admin: refused without the placeholder; removes admin with it; Restore gives it back', () => {
    const env = setUp();
    env.rt.ctx.testDropMyAdmin();
    assert.ok(!env.rt.ctx.isAdminUser('uid_me'));
    assert.strictEqual(env.rt.ctx.adminBootstrapOpen(), false, 'placeholder keeps the bootstrap closed');
    env.rt.ctx.testRestoreMyAdmin();
    assert.ok(env.rt.ctx.isAdminUser('uid_me'));
    // without the placeholder: refused
    const bare = testing({ answer: 'YES' });
    bare.rt.props.TEST_MY_UID = 'uid_me';
    bare.rt.ctx.adminGrantAdmin_('uid_me', { id: 'co_1' }, 'x');
    bare.rt.ctx.testDropMyAdmin();
    assert.match(bare.dialogs.pop().text, /placeholder admin is missing/);
    assert.ok(bare.rt.ctx.isAdminUser('uid_me'));
  });

  test('v1.2 Clean up: removes TEST roles; keeps the placeholder while it is the only admin, removes it otherwise', () => {
    const env = setUp();
    env.rt.ctx.createUserRoleAssignment({ user_id: 'uid_me', role_id: 'r_fin', company_id: 'co_1', assignment_notes: 'TEST: x' });
    env.rt.ctx.testCleanUp();
    assert.ok(!env.live('uid_me').some(a => a.role_id === 'r_fin'));
    assert.strictEqual(env.live('placeholder_admin').length, 0, 'removed: uid_me is another admin');
    const only = setUp();
    only.rt.ctx.testDropMyAdmin();
    only.rt.ctx.testCleanUp();
    assert.strictEqual(only.live('placeholder_admin').length, 1, 'kept: the only admin');
    assert.match(only.dialogs.pop().text, /placeholder admin stays/);
  });

  test('v1.2 items need the setup first', () => {
    const { rt, dialogs } = testing();
    rt.ctx.testGiveMeRole();
    assert.match(dialogs.pop().text, /Set up my admin access" first/);
  });
}

// v1.3 (AppScript v10.0): "6. Volume (v10.0)" - only when the menu file has it and the main file is v10.0+
if (/function adminBackfillParticipants\(/.test(fs.readFileSync(ADMIN, 'utf8')) && /function backfillTicketParticipants\(/.test(fs.readFileSync(MAIN, 'utf8'))) {
  /** A rebuilt Sheet with one ticket (requester row missing as before v10.0: participants cleared). */
  const volume = options => {
    const env = fresh(options);
    env.rt.ctx.rebuildAllTablesApply();
    const S = env.rt.ctx.__TABLE_SCHEMAS;
    env.rt.sheets.get('companies').appendRow(env.rt.ctx.rowFromRecord(S.companies, { id: 'co_1', name: 'Co', code: 'CO', is_active: true }));
    env.rt.sheets.get('ticket_types').appendRow(env.rt.ctx.rowFromRecord(S.ticket_types, { id: 'tt_1', code: 'T', name: 'T', is_active: true }));
    env.rt.ctx.createTicket({ title: 'x', ticket_type_id: 'tt_1', company_id: 'co_1', requester_id: 'u_r' });
    const p = env.rt.sheets.get('ticket_participants');
    p.rows = p.rows.slice(0, 1);
    p.dirty = true;
    return env;
  };

  test('v1.3 Backfill participants: No changes nothing, Yes adds the rows, a second run has nothing to do', () => {
    const no = volume({ answer: 'NO' });
    no.rt.ctx.adminBackfillParticipants();
    assert.strictEqual(no.rt.ctx.readTable('ticket_participants').records.length, 0);
    assert.match(no.dialogs.pop().text, /Would add: 1 requester/);
    const yes = volume({ answer: 'YES' });
    yes.rt.ctx.adminBackfillParticipants();
    assert.match(yes.dialogs.pop().text, /1 participant row\(s\) added/);
    yes.rt.ctx.adminBackfillParticipants();
    assert.match(yes.dialogs.pop().text, /Nothing to add/);
  });

  test('v1.3 Outbox status / send, spreadsheet size, archive (needs the archive id); Status shows them', () => {
    const env = volume({ answer: 'YES' });
    env.rt.ctx.adminOutboxStatus();
    assert.match(env.dialogs.pop().text, /Sending: on/);
    env.rt.ctx.adminSendOutbox();
    assert.match(env.dialogs.pop().text, /Nothing pending/);
    env.rt.ctx.adminSpreadsheetSize();
    assert.match(env.dialogs.pop().text, /cells \(/);
    env.rt.ctx.adminArchiveLogs();
    assert.match(env.dialogs.pop().text, /ARCHIVE_SPREADSHEET_ID/);
    env.rt.props.ARCHIVE_SPREADSHEET_ID = 'arch';
    env.rt.ctx.adminArchiveLogs();
    assert.match(env.dialogs.pop().text, /Nothing old enough/);
    env.rt.ctx.adminStatus();
    assert.match(env.dialogs.pop().text, /Email outbox: 0 pending[\s\S]*Spreadsheet: \d+ cells/);
  });
}

// v1.4 (AppScript v10.1): "7. Regions (v10.1)" - only when the menu file has it and the main file is v10.1+
if (/function adminMigrateCountryCalendars\(/.test(fs.readFileSync(ADMIN, 'utf8')) && /function migrateCountryCalendars\(/.test(fs.readFileSync(MAIN, 'utf8'))) {
  const regions = options => {
    const env = fresh(options);
    env.rt.ctx.rebuildAllTablesApply();
    const S = env.rt.ctx.__TABLE_SCHEMAS;
    env.rt.sheets.get('companies').appendRow(env.rt.ctx.rowFromRecord(S.companies, { id: 'co_1', name: 'Co', code: 'CO', is_active: true, country_code: '', timezone: '' }));
    return env;
  };

  test('v1.4 Migrate to country calendars: No changes nothing, Yes applies, a second run has nothing to do; Status line', () => {
    const no = regions({ answer: 'NO' });
    no.rt.ctx.adminMigrateCountryCalendars();
    assert.match(no.dialogs.pop().text, /Companies without a region \(would become Philippines \/ Asia\/Manila\): 1/);
    assert.strictEqual(no.rt.ctx.readTable('country_calendars').records.length, 0);
    no.rt.ctx.adminStatus();
    assert.match(no.dialogs.pop().text, /Regions: migration NOT done \(1 compan/);

    const env = regions();
    env.rt.ctx.adminMigrateCountryCalendars();
    assert.match(env.dialogs.pop().text, /1 compan\(ies\) set to Philippines \/ Asia\/Manila/);
    assert.strictEqual(env.rt.ctx.readTable('companies').records[0].country_code, 'PH');
    env.rt.ctx.adminMigrateCountryCalendars();
    assert.match(env.dialogs.pop().text, /already migrated/);
    env.rt.ctx.adminStatus();
    assert.match(env.dialogs.pop().text, /Regions: migrated/);
    env.rt.ctx.adminRegions();
    assert.match(env.dialogs.pop().text, /PH [\s\S]*zone Asia\/Manila[\s\S]*- CO: PH \/ Asia\/Manila/);
  });

  test('v1.4 dates use the company zone (no MANILA_TZ left - the v10.1 main file removed it)', () => {
    const source = fs.readFileSync(ADMIN, 'utf8');
    assert.ok(!/MANILA_TZ/.test(source.replace(/^ \*.*$/gm, '')), 'MANILA_TZ only in the header notes');
    assert.strictEqual(fresh().rt.ctx.adminTz_(''), 'Asia/Manila');
  });
}

report();
fs.unlinkSync(combined);
