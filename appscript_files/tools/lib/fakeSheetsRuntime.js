// In-memory fake of the Apps Script runtime (SpreadsheetApp / LockService / ContentService / PropertiesService /
// Utilities) for offline tests. Shared by every appscript_files/tools/*_TEST_*.js.
// makeRuntime(appscriptPath, options) loads the AppScript file into a vm context and returns helpers to seed and
// inspect tabs. Options (v9.4):
//   detectStaleCache  throw when the v9.4 request cache serves a tab that was written after it was cached
//                     (a write without invalidateTable - compliance A14). Default: on when the file has the cache
//   properties        initial Script Properties ({ AUTH_MODE: 'enforce', PROXY_SECRET: 'x' })
//   noCacheService    (v9.6) leave CacheService undefined, like an Apps Script project without the service
// Per request (post / get), reads() returns how many full-tab reads (getDataRange().getValues()) each tab had.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function makeRuntime(appscriptPath, options = {}) {
  const sheets = new Map();
  let lockHeld = false;
  const lockLog = [];
  const props = { ...(options.properties || {}) };
  let readCounts = {};
  // v9.5: MailApp / ScriptApp fakes - sent mail and installed triggers are recorded; options.mailQuota sets the quota
  const mail = { sent: [], quota: options.mailQuota === undefined ? 100 : options.mailQuota };
  const triggers = [];
  // v9.6: CacheService.getScriptCache() fake - entries { value, expires } (ms, fake clock = Date.now()); tests inspect cache
  const cache = new Map();
  const scriptCache = {
    get: key => { const e = cache.get(key); if (!e) return null; if (e.expires <= Date.now()) { cache.delete(key); return null; } return e.value; },
    put: (key, value, ttl = 600) => { cache.set(key, { value: String(value), expires: Date.now() + Math.min(Number(ttl) || 600, 21600) * 1000 }); },
    remove: key => { cache.delete(key); }
  };

  class Range {
    constructor(sheet, r, c, nr, nc, isDataRange = false) { Object.assign(this, { sheet, r, c, nr: nr || 1, nc: nc || 1, isDataRange }); }
    getSheet() { return this.sheet; }
    getValues() {
      if (this.isDataRange) {
        // A full-tab read: counted, and the tab is no longer "written since the last read"
        readCounts[this.sheet.name] = (readCounts[this.sheet.name] || 0) + 1;
        this.sheet.dirty = false;
      }
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = [];
        for (let j = 0; j < this.nc; j++) {
          const v = (this.sheet.rows[this.r - 1 + i] || [])[this.c - 1 + j];
          row.push(v === undefined ? '' : v);
        }
        out.push(row);
      }
      return out;
    }
    setValues(values) {
      assert.strictEqual(values.length, this.nr, 'setValues row count');
      values.forEach((row, i) => {
        assert.strictEqual(row.length, this.nc, 'setValues col count');
        row.forEach((v, j) => this.sheet.set(this.r + i, this.c + j, v));
      });
      return this;
    }
    setValue(v) { this.sheet.set(this.r, this.c, v); return this; }
    clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.set(this.r + i, this.c + j, ''); return this; }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
  }

  class Sheet {
    constructor(name) { this.name = name; this.rows = []; this.maxCols = 26; }
    getName() { return this.name; }
    setName(n) { sheets.delete(this.name); this.name = n; sheets.set(n, this); return this; }
    set(r, c, v) {
      // Columns 0 and below don't exist in Sheets - getRange(row, 0) throws there too
      if (c < 1 || r < 1) throw new Error(`Range out of bounds: row ${r}, column ${c}`);
      this.dirty = true;
      while (this.rows.length < r) this.rows.push([]);
      const row = this.rows[r - 1];
      while (row.length < c) row.push('');
      row[c - 1] = v;
      if (c > this.maxCols) this.maxCols = c;
    }
    trimmed() {
      const rows = this.rows.map(r => r.slice());
      while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop();
      return rows;
    }
    getLastRow() { return this.trimmed().length; }
    getLastColumn() { return this.trimmed().reduce((m, r) => { let n = r.length; while (n && r[n - 1] === '') n--; return Math.max(m, n); }, 0); }
    getMaxColumns() { return this.maxCols; }
    insertColumnsAfter(after, n) { this.maxCols += n; }
    getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1), true); }
    getRange(r, c, nr, nc) {
      if (c < 1 || r < 1) throw new Error(`Range out of bounds: row ${r}, column ${c}`);
      return new Range(this, r, c, nr, nc);
    }
    appendRow(row) { this.rows = this.trimmed(); this.rows.push(row.slice()); this.dirty = true; }
    deleteRow(r) { this.rows.splice(r - 1, 1); this.dirty = true; }
    clearContents() { this.rows = []; this.dirty = true; }
    clear() { this.rows = []; this.dirty = true; }
    setFrozenRows() {}
    autoResizeColumns() {}
    copyTo() { const s = new Sheet('copy'); s.rows = this.rows.map(r => r.slice()); sheets.set('copy', s); return s; }
  }

  const ss = {
    getSheetByName: name => sheets.get(name) || null,
    insertSheet: name => { if (sheets.has(name)) throw new Error(`sheet ${name} exists`); const s = new Sheet(name); sheets.set(name, s); return s; },
    deleteSheet: s => sheets.delete(s.name),
    getSheets: () => [...sheets.values()]
  };

  const context = {
    console: { log() {}, error() {} },
    Logger: { log() {} },
    SpreadsheetApp: { openById: () => ss },
    Session: { getActiveUser: () => ({ getEmail: () => 'admin@example.com' }) },
    Utilities: { formatDate },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => (Object.prototype.hasOwnProperty.call(props, key) ? props[key] : null),
        setProperty: (key, value) => { props[key] = String(value); },
        deleteProperty: key => { delete props[key]; },
        getProperties: () => ({ ...props })
      })
    },
    ContentService: {
      MimeType: { JSON: 'json', TEXT: 'text' },
      createTextOutput: text => ({ text, getContent() { return this.text; }, setMimeType() { return this; } })
    },
    LockService: {
      getScriptLock: () => ({
        // Non-reentrant on purpose: a second waitLock in the same execution must never happen
        waitLock() { if (lockHeld) throw new Error('LOCK ALREADY HELD (would deadlock)'); lockHeld = true; lockLog.push('acquire'); },
        // tryLock: false when another holder has it (tests set runtime.holdLock(true) to simulate a busy lock)
        tryLock() { if (lockHeld) return false; lockHeld = true; lockLog.push('acquire'); return true; },
        releaseLock() { lockHeld = false; lockLog.push('release'); }
      })
    },
    MailApp: {
      getRemainingDailyQuota: () => mail.quota,
      sendEmail: message => { if (mail.quota <= 0) throw new Error('quota exceeded'); mail.quota--; mail.sent.push(message); }
    },
    ...(options.noCacheService ? {} : { CacheService: { getScriptCache: () => scriptCache } }),
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: trigger => { const i = triggers.indexOf(trigger); if (i !== -1) triggers.splice(i, 1); },
      newTrigger: handler => {
        const spec = { handler, every: null };
        const builder = {
          timeBased: () => builder,
          everyMinutes: n => { spec.every = n; return builder; },
          create: () => { const t = { getHandlerFunction: () => handler, spec }; triggers.push(t); return t; }
        };
        return builder;
      }
    }
  };
  vm.createContext(context);
  const src = fs.readFileSync(appscriptPath, 'utf8');
  vm.runInContext(src + '\n;this.__TABLE_SCHEMAS = TABLE_SCHEMAS; this.__SHEETS = SHEETS;', context);

  // v9.4 (A14): a cached tab that was written after it was cached means a write without invalidateTable()
  // On by default for files that have the cache (v9.4+), so every older suite run on a new file checks it too
  const hasCache = typeof context.sheetValues === 'function' && typeof context.TABLE_CACHE === 'object';
  if (options.detectStaleCache === true && !hasCache) {
    throw new Error('detectStaleCache needs AppScript v9.4+ (sheetValues / TABLE_CACHE)');
  }
  if (options.detectStaleCache !== false && hasCache) {
    const staleCheck = (sheet, where) => {
      if (sheet && context.TABLE_CACHE[sheet.getName()] && sheet.dirty) {
        throw new Error(`STALE CACHE in ${where}: ${sheet.getName()} was written after it was cached (missing invalidateTable)`);
      }
    };
    for (const fn of ['sheetValues', 'sheetHeaders']) {
      const original = context[fn];
      context[fn] = sheet => { staleCheck(sheet, fn); return original(sheet); };
    }
  }

  const table = (name, headers, rows = []) => {
    const s = ss.insertSheet(name);
    s.rows = [headers.slice(), ...rows.map(r => r.slice())];
    return s;
  };
  const json = name => {
    const rows = sheets.get(name).trimmed();
    const [h, ...rest] = rows;
    return rest.map(r => Object.fromEntries(h.map((k, i) => [k, r[i] === undefined ? '' : r[i]])));
  };
  const post = body => { readCounts = {}; return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).text); };
  const get = params => { readCounts = {}; return JSON.parse(context.doGet({ parameter: { ...params } }).text); };
  return { ctx: context, ss, sheets, table, json, post, get, lockLog, isLocked: () => lockHeld, props, reads: () => ({ ...readCounts }),
    mail, triggers, cache, holdLock: held => { lockHeld = held; } };
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Utilities.formatDate for the patterns the AppScript files use, in the given time zone (Intl). 'yyyy' keeps the
 * fixed '2026' older tests expect in ticket numbers; other unknown patterns return the old fixed stamp.
 */
function formatDate(date, timeZone, pattern) {
  if (pattern === 'yyyy') return '2026';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23', weekday: 'short'
  }).formatToParts(new Date(date)).map(p => [p.type, p.value]));
  const known = {
    'yyyy-MM-dd': `${parts.year}-${parts.month}-${parts.day}`,
    'HH:mm:ss': `${parts.hour}:${parts.minute}:${parts.second}`,
    'HH:mm': `${parts.hour}:${parts.minute}`,
    'HH': parts.hour,
    'u': String(WEEKDAYS.indexOf(parts.weekday) + 1)
  };
  return Object.prototype.hasOwnProperty.call(known, pattern) ? known[pattern] : '20261017_151000';
}

const same = (a, b, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg);

function makeTestRunner() {
  const results = [];
  function test(name, fn) {
    try { fn(); results.push(`PASS  ${name}`); }
    catch (e) { results.push(`FAIL  ${name}\n      ${e.stack.split('\n').slice(0, 3).join('\n      ')}`); process.exitCode = 1; }
  }
  return { test, report: () => console.log(results.join('\n')) };
}

module.exports = { makeRuntime, same, makeTestRunner };
