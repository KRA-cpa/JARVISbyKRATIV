/**
 * scripts/lib/sheetsExport.js v1.0 (15 Nov 2026, session 461f9ea9) - migration step 1.1, the READ half of the sync:
 * the platform Google Sheet through the Sheets API (read-only) as the same "export v1" structure that
 * appscript_files/EXPORT_ForPostgres_v1.0 writes, so scripts/db-load-sheets.js (buildLoadPlan: clean rows only) takes it
 * unchanged. User, 15 Nov 2026: option A - a read-only service account instead of a new Apps Script route.
 *
 * Access: service account daloy-sheet-reader@krativ-daloy.iam.gserviceaccount.com (no keys, no project roles; the Sheet
 * is shared with it as VIEWER). Cloud Run's own identity borrows it (IAM Credentials generateAccessToken, scope
 * spreadsheets.readonly) - sheetReaderToken(). Nothing in the Sheet can be changed with that scope.
 *
 * Differences from the Apps Script export, by design:
 *   - TS_UTC_SINCE is a Script Property the Sheets API can't read → passed in (env TS_UTC_SINCE, the value in the 0.8
 *     export's meta); table_schemas come from the repo's newest APPSCRIPT file (gen-ddl loadTableSchemas).
 *   - A date cell arrives as a serial number + a DATE / TIME / DATE_TIME number format; it becomes the same
 *     { $d: instant, $l: local wall clock } tag (the wall clock is in the spreadsheet's time zone).
 * Layer: scripts (uses db-load-sheets' time helper only).
 */

'use strict';

const { localToUtcIso } = require('../db-load-sheets');

const READER = 'daloy-sheet-reader@krativ-daloy.iam.gserviceaccount.com';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const FIELDS = 'properties(timeZone),sheets(properties(title),data(rowData(values(effectiveValue,effectiveFormat(numberFormat(type))))))';
const DATE_TYPES = new Set(['DATE', 'TIME', 'DATE_TIME']);
const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n, w = 2) => String(n).padStart(w, '0');

/** A Sheets serial date (days since 30 Dec 1899, wall clock) → 'yyyy-MM-ddTHH:mm:ss'. */
function serialToLocal(serial) {
  const d = new Date(SERIAL_EPOCH_MS + Math.round(serial * DAY_MS / 1000) * 1000);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** One API cell → the export's cell (as encodePostgresExportCell_). */
function encodeCell(cell, timeZone) {
  const v = cell && cell.effectiveValue;
  if (!v) return '';
  if (v.errorValue) return { $bad: `cell error ${v.errorValue.type || ''}`.trim() };
  if (typeof v.boolValue === 'boolean') return v.boolValue;
  if (typeof v.stringValue === 'string') return v.stringValue;
  if (typeof v.numberValue === 'number') {
    const type = cell.effectiveFormat && cell.effectiveFormat.numberFormat && cell.effectiveFormat.numberFormat.type;
    if (!DATE_TYPES.has(type)) return v.numberValue;
    const local = serialToLocal(v.numberValue);
    const instant = localToUtcIso(local, timeZone);
    return instant ? { $d: instant, $l: local } : { $bad: 'invalid date' };
  }
  return '';
}

const isBlank = c => c === '' || c === null || c === undefined;

/**
 * @param {Object} spreadsheet - spreadsheets.get answer (fields = FIELDS, includeGridData)
 * @param {{ tsUtcSince?: string|null, tableSchemas?: Object|null, apiVersion?: string|null, now?: Date }} options
 * @returns {{ meta, tabs }} export v1 (scripts/db-load-sheets.js buildLoadPlan)
 */
function exportFromSpreadsheet(spreadsheet, { tsUtcSince = null, tableSchemas = null, apiVersion = null, now = new Date() } = {}) {
  const timeZone = spreadsheet && spreadsheet.properties && spreadsheet.properties.timeZone;
  if (!timeZone) throw new Error('the spreadsheet answer has no time zone (properties.timeZone)');
  const tabs = {};
  const tabSummary = [];
  for (const sheet of spreadsheet.sheets || []) {
    const name = sheet.properties.title;
    const rowData = (sheet.data && sheet.data[0] && sheet.data[0].rowData) || [];
    const grid = rowData.map(r => (r.values || []).map(c => encodeCell(c, timeZone)));
    const width = grid.reduce((w, r) => Math.max(w, r.length), 0);
    grid.forEach(r => { while (r.length < width) r.push(''); });
    const headers = (grid[0] || []).map(h => (isBlank(h) || typeof h === 'object' ? '' : String(h).trim()));
    const rows = [];
    let blankRows = 0;
    for (let i = 1; i < grid.length; i += 1) {
      if (grid[i].every(isBlank)) { blankRows += 1; continue; }
      rows.push({ n: i + 1, v: grid[i] });
    }
    tabs[name] = { headers, rows, blank_rows: blankRows };
    tabSummary.push({ name, rows: rows.length, blank_rows: blankRows, columns: headers.filter(Boolean).length });
  }
  return {
    meta: {
      export_version: 1, exported_at: now.toISOString(), api_version: apiVersion, spreadsheet_time_zone: timeZone,
      ts_utc_since: tsUtcSince || null, table_schemas: tableSchemas, tabs: tabSummary, source: 'sheets-api'
    },
    tabs
  };
}

/**
 * A short-lived read-only token for the reader account, on Cloud Run (metadata server → IAM Credentials).
 * The token is returned to the caller only - never logged.
 */
async function sheetReaderToken({ fetchImpl = fetch, reader = READER } = {}) {
  const own = await fetchImpl('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } });
  if (!own.ok) throw new Error(`metadata server answered ${own.status} (not on Cloud Run?)`);
  const { access_token: ownToken } = await own.json();
  const res = await fetchImpl(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(reader)}:generateAccessToken`, {
    method: 'POST', headers: { Authorization: `Bearer ${ownToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: [SCOPE], lifetime: '600s' })
  });
  if (!res.ok) throw new Error(`could not borrow ${reader}: HTTP ${res.status}`);
  return (await res.json()).accessToken;
}

/** Read the whole spreadsheet (values + number formats). spreadsheetId: 20+ letters / digits / - / _. */
async function fetchSpreadsheet(spreadsheetId, token, { fetchImpl = fetch } = {}) {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(String(spreadsheetId || ''))) throw new Error('invalid spreadsheet id');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&fields=${encodeURIComponent(FIELDS)}`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 403 || res.status === 404) {
    throw new Error(`the Sheet can't be read (HTTP ${res.status}) - is it shared with ${READER} as Viewer?`);
  }
  if (!res.ok) throw new Error(`Sheets API answered ${res.status}`);
  return res.json();
}

module.exports = { exportFromSpreadsheet, encodeCell, serialToLocal, sheetReaderToken, fetchSpreadsheet, READER, SCOPE, FIELDS };
