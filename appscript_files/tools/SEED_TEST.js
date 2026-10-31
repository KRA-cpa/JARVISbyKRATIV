// Usage: node appscript_files/tools/SEED_TEST.js <APPSCRIPT v9.3+ file> <SEED_TestData file>
// Offline test of the test-data seed on the fake Sheets runtime: both files are loaded into one context, like
// the two script files of the Apps Script project.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const [MAIN, SEED] = process.argv.slice(2);
if (!MAIN || !SEED) {
  console.error('Usage: node SEED_TEST.js <APPSCRIPT file> <SEED_TestData file>');
  process.exit(2);
}
const combined = path.join(os.tmpdir(), `seed_test_${process.pid}.js`);
fs.writeFileSync(combined, fs.readFileSync(MAIN, 'utf8') + '\n;\n' + fs.readFileSync(SEED, 'utf8'));
const same = lib.same;
const { test, report } = lib.makeTestRunner();

/** A rebuilt sheet with one ordinary (non-seed) company + ticket that the seed must never touch. */
function fresh() {
  const rt = lib.makeRuntime(combined);
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (tableName, record) => rt.sheets.get(tableName).appendRow(rt.ctx.rowFromRecord(S[tableName], record));
  add('companies', { id: 'co_real', name: 'Real Co', code: 'REAL', is_active: true });
  add('ticket_types', { id: 'tt_real', code: 'RQ', name: 'Real request', is_active: true });
  const created = rt.ctx.createTicket({ title: 'Real ticket', ticket_type_id: 'tt_real', company_id: 'co_real', requester_id: 'u_real' });
  /** Every tab's rows as JSON. */
  const snapshot = () => JSON.stringify([...rt.sheets.keys()].sort().map(name => [name, rt.sheets.get(name).trimmed()]));
  const rows = name => rt.ctx.readTable(name).records;
  return { rt, rows, snapshot, realTicketId: String(created.id) };
}

test('dry run writes nothing and lists what it would add', () => {
  const { rt, snapshot } = fresh();
  const before = snapshot();
  const result = rt.ctx.seedTestData('me_uid');
  assert.strictEqual(snapshot(), before);
  assert.strictEqual(result.apply, false);
  assert.strictEqual(result.master.companies, 2);
  assert.strictEqual(result.tickets.length, 12);
});

test('apply: master data, and tickets driven through the engine end where the script says', () => {
  const { rt, rows } = fresh();
  const result = rt.ctx.seedTestDataApply('me_uid');
  same(result.warnings, []);
  const status = title => result.tickets.find(t => t.title.indexOf(title) === 0).status;
  assert.strictEqual(status('Office chairs'), 'Pending Manager Approval');
  assert.strictEqual(status('Server rack'), 'Pending Finance Review');
  assert.strictEqual(status('Delivery van'), 'Procurement In Progress');
  assert.strictEqual(status('Printer toner'), 'Procurement In Progress', 'under 50k skips Finance (routing)');
  assert.strictEqual(status('Laptop for new hire'), 'Completed');
  assert.strictEqual(status('Conference booth'), 'Returned to Requester');
  assert.strictEqual(status('Espresso machine'), 'Rejected');
  assert.strictEqual(status('Team shirts'), 'Cancelled');

  const tickets = rows('tickets').filter(t => String(t.company_id).indexOf('seed_') === 0);
  assert.strictEqual(tickets.length, 13, '12 + the chained IT ticket');
  const chained = rows('ticket_links').filter(l => l.link_type === 'chained');
  assert.strictEqual(chained.length, 1);
  assert.strictEqual(tickets.find(t => String(t.id) === String(chained[0].child_ticket_id)).ticket_type_id, 'seed_tt_it');
  const overdue = tickets.find(t => t.title.indexOf('Backup drives') === 0);
  assert.ok(new Date(overdue.step_due_date) < new Date(), 'overdue ticket is past due');
  assert.strictEqual(rows('ticket_tag_assignments').length, 2);
  assert.strictEqual(rows('ticket_collaborations').length, 1);
  assert.ok(rows('user_role_assignments').some(a => a.user_id === 'me_uid' && a.role_id === 'seed_r_admin'), 'your uid gets the admin role');
  assert.strictEqual(rt.ctx.isAdminUser('me_uid'), true);
  const inbox = rt.ctx.getTicketsForApproval('me_uid').data.map(t => t.title);
  assert.ok(inbox.some(t => t.indexOf('Office chairs') === 0), 'you can approve the waiting tickets');
});

test('a second run adds nothing', () => {
  const { rt, snapshot } = fresh();
  rt.ctx.seedTestDataApply('me_uid');
  const after = snapshot();
  const again = rt.ctx.seedTestDataApply('me_uid');
  same(again.master, {});
  same(again.tickets, []);
  assert.strictEqual(snapshot(), after);
});

test('removal: dry run deletes nothing; apply removes every seed row and keeps the real data', () => {
  const { rt, rows, snapshot, realTicketId } = fresh();
  const before = snapshot();
  rt.ctx.seedTestDataApply('me_uid');
  const seeded = snapshot();

  const dry = rt.ctx.removeSeedData();
  assert.strictEqual(snapshot(), seeded, 'dry run');
  assert.strictEqual(dry.removed.tickets, 13);

  rt.ctx.removeSeedDataApply();
  const leftovers = [];
  for (const name of rt.sheets.keys()) {
    if (name === 'admin_action_logs') continue; // the audit trail is kept on purpose
    rt.ctx.readTable(name).records.forEach(r => {
      if (Object.values(r).some(v => /^(seed_|opt_seed_|SEEDA-|SEEDB-)/.test(String(v)))) leftovers.push(`${name}: ${JSON.stringify(r).slice(0, 80)}`);
    });
  }
  same(leftovers, []);
  assert.ok(rows('tickets').some(t => String(t.id) === realTicketId), 'the real ticket is still there');
  assert.ok(rows('companies').some(c => c.id === 'co_real'));
  // Everything but the audit log is back to how it was. v9.4: the shared 'ticket_id' sequence (A18) keeps counting -
  // ids are never reused after a removal - so that one counter row is left out of the comparison
  const strip = json => JSON.stringify(JSON.parse(json)
    .filter(([name]) => name !== 'admin_action_logs')
    .map(([name, rows]) => [name, name === 'sequence_counters' ? rows.filter(r => r[0] !== 'ticket_id') : rows]));
  assert.strictEqual(strip(snapshot()), strip(before));
});

report();
fs.unlinkSync(combined);
