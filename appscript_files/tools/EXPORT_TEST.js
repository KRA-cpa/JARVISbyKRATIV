// Usage: node appscript_files/tools/EXPORT_TEST.js <APPSCRIPT v10.1+ file> <EXPORT_ForPostgres file>
// Offline test of the Postgres export (migration step 0.8) on the fake Sheets runtime: both files are loaded into one
// context, like the two script files of the Apps Script project (as SEED_TEST.js).
// Checks: read-only (every tab byte-identical afterwards, no lock taken), one Drive file with every tab, row numbers,
// blank rows skipped, date cells tagged with the instant + the local date-time, TS_UTC_SINCE + TABLE_SCHEMAS in meta,
// the dry run writes no file.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const lib = require('./lib/fakeSheetsRuntime');

const [MAIN, EXPORT] = process.argv.slice(2);
if (!MAIN || !EXPORT) {
  console.error('Usage: node EXPORT_TEST.js <APPSCRIPT file> <EXPORT_ForPostgres file>');
  process.exit(2);
}
const combined = path.join(os.tmpdir(), `export_test_${process.pid}.js`);
fs.writeFileSync(combined, fs.readFileSync(MAIN, 'utf8') + '\n;\n' + fs.readFileSync(EXPORT, 'utf8'));
const { test, report } = lib.makeTestRunner();

function fresh() {
  const rt = lib.makeRuntime(combined);
  const files = [];
  rt.ctx.DriveApp = {
    createFile: (name, content, mime) => {
      const file = { name, content, mime, getId: () => `file_${files.length + 1}`, getUrl: () => `https://drive.example/${name}` };
      files.push(file);
      return file;
    }
  };
  rt.props.TS_UTC_SINCE = '2026-10-30T00:00:00.000Z';
  // A date cell as Sheets returns it: midnight 25 Dec 2026 in Manila = 24 Dec 16:00 UTC
  const holiday = new Date('2026-12-24T16:00:00.000Z');
  rt.table('companies', ['id', 'name', 'code', 'is_active', 'created_at'], [
    ['co_1', 'Alpha', 'ALP', true, '2026-10-01T10:00:00.000Z'],
    ['', '', '', '', ''],
    ['co_2', 'Beta', 'BET', 'FALSE', new Date('2026-11-01T02:30:00.000Z')]
  ]);
  rt.table('company_holidays', ['id', 'company_id', 'date', 'name'], [['h1', 'co_1', holiday, 'Christmas']]);
  rt.table('empty_tab', ['id', 'name']);
  const snapshot = () => JSON.stringify([...rt.sheets.keys()].sort().map(name => [name, rt.sheets.get(name).trimmed()]));
  return { rt, files, snapshot };
}

test('export: one Drive file, every tab, nothing in the Sheet changes, no lock taken', () => {
  const { rt, files, snapshot } = fresh();
  const before = snapshot();
  const summary = rt.ctx.exportForPostgres();
  assert.strictEqual(snapshot(), before, 'the Sheet changed');
  assert.strictEqual(rt.lockLog.length, 0, 'took the script lock');
  assert.strictEqual(files.length, 1);
  assert.match(files[0].name, /^daloy-export-\d{8}-\d{4}\.json$/);
  assert.strictEqual(files[0].mime, 'application/json');
  assert.strictEqual(summary.file_name, files[0].name);
  const data = JSON.parse(files[0].content);
  assert.deepStrictEqual(Object.keys(data.tabs).sort(), ['companies', 'company_holidays', 'empty_tab']);
  assert.strictEqual(summary.rows, 3);
});

test('rows: sheet row numbers kept, blank rows skipped and counted, values as Sheets holds them', () => {
  const { rt, files } = fresh();
  rt.ctx.exportForPostgres();
  const { companies } = JSON.parse(files[0].content).tabs;
  assert.deepStrictEqual(companies.headers, ['id', 'name', 'code', 'is_active', 'created_at']);
  assert.deepStrictEqual(companies.rows.map(r => r.n), [2, 4]);
  assert.strictEqual(companies.blank_rows, 1);
  assert.deepStrictEqual(companies.rows[0].v, ['co_1', 'Alpha', 'ALP', true, '2026-10-01T10:00:00.000Z'], 'text stays text');
  assert.strictEqual(companies.rows[1].v[3], 'FALSE');
});

test('date cells: tagged with the instant and the local date-time in the spreadsheet zone', () => {
  const { rt, files } = fresh();
  rt.ctx.exportForPostgres();
  const data = JSON.parse(files[0].content);
  assert.deepStrictEqual(data.tabs.company_holidays.rows[0].v[2], { $d: '2026-12-24T16:00:00.000Z', $l: '2026-12-25T00:00:00' });
  assert.deepStrictEqual(data.tabs.companies.rows[1].v[4], { $d: '2026-11-01T02:30:00.000Z', $l: '2026-11-01T10:30:00' });
});

test('meta: export version, TS_UTC_SINCE, API version, time zone, TABLE_SCHEMAS, rows per tab', () => {
  const { rt, files } = fresh();
  rt.ctx.exportForPostgres();
  const { meta } = JSON.parse(files[0].content);
  assert.strictEqual(meta.export_version, 1);
  assert.strictEqual(meta.ts_utc_since, '2026-10-30T00:00:00.000Z');
  // top-level consts are not properties of the context object: read them inside it
  assert.strictEqual(meta.api_version, vm.runInContext('API_VERSION', rt.ctx));
  assert.strictEqual(meta.spreadsheet_time_zone, vm.runInContext('DEFAULT_TZ', rt.ctx));
  assert.ok(meta.api_version && meta.spreadsheet_time_zone);
  assert.ok(meta.table_schemas && Array.isArray(meta.table_schemas.tickets), 'TABLE_SCHEMAS included');
  assert.deepStrictEqual(meta.tabs.find(t => t.name === 'companies'), { name: 'companies', rows: 2, blank_rows: 1, columns: 5 });
  assert.ok(!JSON.stringify(meta).includes('PROXY_SECRET'), 'no Script Property other than TS_UTC_SINCE');
});

test('dry run: same counts, no file', () => {
  const { rt, files } = fresh();
  const summary = rt.ctx.exportForPostgresDryRun();
  assert.strictEqual(files.length, 0);
  assert.strictEqual(summary.rows, 3);
  assert.strictEqual(summary.file_name, null);
});

report();
fs.unlinkSync(combined);
