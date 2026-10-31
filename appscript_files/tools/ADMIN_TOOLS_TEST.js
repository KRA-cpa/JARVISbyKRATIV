// Usage: node appscript_files/tools/ADMIN_TOOLS_TEST.js <APPSCRIPT file v9.5+> <ADMIN_Tools file>
// Offline test of the "JARVIS Admin" Sheet menu (second script file): the menu is built, every item calls a
// function that exists, apply items show the dry run and change nothing when the answer is No.
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
    prompt: (title, text) => { dialogs.push({ title, text }); return { getSelectedButton: () => 'OK', getResponseText: () => promptText }; }
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

report();
fs.unlinkSync(combined);
