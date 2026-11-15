#!/usr/bin/env node
/**
 * test-sheets-export.js - scripts/lib/sheetsExport.js (migration 1.1, the read half of the sync): a Sheets API answer
 * becomes the export v1 that scripts/db-load-sheets.js loads. Offline (fake fetch). Exit 0 = pass.
 */
'use strict';

const assert = require('assert');
const S = require('./lib/sheetsExport');
const L = require('./db-load-sheets');
const gen = require('./gen-ddl');
const RULES = require('./db/ddl-rules');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`); } catch (e) { results.push(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}
const str = s => ({ effectiveValue: { stringValue: s } });
const num = n => ({ effectiveValue: { numberValue: n } });
const bool = b => ({ effectiveValue: { boolValue: b } });
const date = (serial, type = 'DATE_TIME') => ({ effectiveValue: { numberValue: serial }, effectiveFormat: { numberFormat: { type } } });
const sheet = (title, rows) => ({ properties: { title }, data: [{ rowData: rows.map(values => ({ values })) }] });

(async () => {
  await test('serial dates: wall clock in the sheet zone → instant + local tag', async () => {
    // 46341 = 15 Nov 2026; .5 = 12:00
    assert.strictEqual(S.serialToLocal(46341.5), '2026-11-15T12:00:00');
    assert.strictEqual(S.serialToLocal(46341.5 + 1.234 / 86400), '2026-11-15T12:00:01.234', 'milliseconds kept');
    assert.deepStrictEqual(S.encodeCell(date(46341.5), 'Asia/Manila'), { $d: '2026-11-15T04:00:00.000Z', $l: '2026-11-15T12:00:00' });
    assert.deepStrictEqual(S.encodeCell(date(46341, 'DATE'), 'Asia/Manila').$l, '2026-11-15T00:00:00');
    assert.strictEqual(S.encodeCell(num(46341.5), 'Asia/Manila'), 46341.5, 'a plain number stays a number');
  });

  await test('cells: text, numbers, booleans, empty, errors', async () => {
    assert.strictEqual(S.encodeCell(str('abc'), 'UTC'), 'abc');
    assert.strictEqual(S.encodeCell(bool(false), 'UTC'), false);
    assert.strictEqual(S.encodeCell({}, 'UTC'), '');
    assert.strictEqual(S.encodeCell(undefined, 'UTC'), '');
    assert.ok(S.encodeCell({ effectiveValue: { errorValue: { type: 'REF' } } }, 'UTC').$bad);
  });

  await test('tabs: headers trimmed, ragged rows padded, blank rows skipped with sheet row numbers kept', async () => {
    const e = S.exportFromSpreadsheet({
      properties: { timeZone: 'Asia/Manila' },
      sheets: [sheet('companies', [[str(' id '), str('name'), str('code')], [str('c1'), str('Acme')], [], [str('c2'), str('Beta'), str('BETA')]])]
    }, { tsUtcSince: '2026-10-30T00:00:00Z', now: new Date('2026-11-15T00:00:00Z') });
    const t = e.tabs.companies;
    assert.deepStrictEqual(t.headers, ['id', 'name', 'code']);
    assert.deepStrictEqual(t.rows, [{ n: 2, v: ['c1', 'Acme', ''] }, { n: 4, v: ['c2', 'Beta', 'BETA'] }]);
    assert.strictEqual(t.blank_rows, 1);
    assert.strictEqual(e.meta.export_version, 1);
    assert.strictEqual(e.meta.ts_utc_since, '2026-10-30T00:00:00Z');
    assert.throws(() => S.exportFromSpreadsheet({ sheets: [] }), /time zone/);
  });

  await test('the loader takes it: clean rows copied, a broken row skipped', async () => {
    const schemas = gen.loadTableSchemas(require('fs').readFileSync(gen.newestAppScript(), 'utf8'));
    const model = gen.buildModel(schemas, RULES);
    const e = S.exportFromSpreadsheet({
      properties: { timeZone: 'Asia/Manila' },
      sheets: [sheet('companies', [
        [str('id'), str('name'), str('code'), str('is_active'), str('created_at')],
        [str('c1'), str('Acme'), str('ACME'), bool(true), date(46341.5)],
        [str('c2'), str('Beta'), str(''), bool(true), date(46341.5)]
      ])]
    }, { tableSchemas: schemas, tsUtcSince: '2026-10-30T00:00:00Z' });
    const plan = L.buildLoadPlan(e, model);
    assert.strictEqual(plan.tables.companies.rows.length, 1, 'c2 has no code (required) → skipped');
    assert.strictEqual(plan.tables.companies.rows[0].record.created_at, '2026-11-15T04:00:00.000Z');
  });

  await test('token + fetch: borrows the reader with the read-only scope; a 403 says how to fix it; no token in errors', async () => {
    const calls = [];
    const fakeFetch = async (url, options = {}) => {
      calls.push({ url, options });
      if (url.includes('metadata.google.internal')) return { ok: true, json: async () => ({ access_token: 'own-secret' }) };
      if (url.includes('iamcredentials')) return { ok: true, json: async () => ({ accessToken: 'reader-secret' }) };
      return { ok: false, status: 403, json: async () => ({}) };
    };
    const token = await S.sheetReaderToken({ fetchImpl: fakeFetch });
    assert.strictEqual(token, 'reader-secret');
    assert.deepStrictEqual(JSON.parse(calls[1].options.body).scope, ['https://www.googleapis.com/auth/spreadsheets.readonly']);
    await assert.rejects(S.fetchSpreadsheet('1AbCdEfGhIjKlMnOpQrStUvWxYz012345', token, { fetchImpl: fakeFetch }),
      e => /shared with daloy-sheet-reader@.* as Viewer/.test(e.message) && !e.message.includes('reader-secret'));
    await assert.rejects(S.fetchSpreadsheet('../etc', token, { fetchImpl: fakeFetch }), /invalid spreadsheet id/);
  });

  console.log(results.join('\n'));
  console.log(process.exitCode ? 'sheets-export test FAILED' : `sheets-export test OK (${results.length} cases)`);
})();
