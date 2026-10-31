#!/usr/bin/env node
/**
 * check-code-rules.js — static checks for the "should-be" code rules
 * Rules: docs/guides/GUIDE_CodeReview_Compliance.md A14-A18, A20, A21 (AppScript) and F3-F4 (frontend)
 *
 * Usage:
 *   node scripts/check-code-rules.js [APPSCRIPT file]   check (default: newest appscript_files/APPSCRIPT_v*_<YYYYMMDD>_<HHMM>.txt)
 *   node scripts/check-code-rules.js --update [file]    rewrite the known-gaps list; refuses to add entries
 *                                                       (creates the baseline when the list doesn't exist yet)
 *   node scripts/check-code-rules.js --self-test        run the built-in fixtures for every check
 *
 * AppScript checks run per top-level function (from `function name(` to the first line that is just "}"):
 *   A14  the function mutates a sheet (appendRow / setValue(s) / deleteRow(s) / insertRow(s) / clear*) but never
 *        calls invalidateTable(), so a later read in the same request can serve a stale cached table
 *   A15  a permission check (isAdminUser / requireAdmin / checkUserCanApproveStep) gets a user id that is neither
 *        actorId(...), a variable assigned from actorId(...), nor a parameter of the function (pass-through helpers
 *        are checked at their callers) - the request body would decide who the caller is
 *   A16  a sheet read (getDataRange / getValues / getDisplayValues / openById / readTable / getSheetDataAsJSON /
 *        findRecord) inside a loop or an array callback - read once and build a lookup map
 *   A17  hour arithmetic on dates (8 * 60 * 60, getTime() + 8) or a weekday / hour from the script time zone
 *        (getDay / getHours / setHours) - store real UTC, use Asia/Manila through Utilities.formatDate
 *   A18  an id from the row count (getLastRow() > 0 ? x.getLastRow() ...) or from max(id) + 1
 *   A20  two top-level functions with the same name (Apps Script keeps the last one)
 *   A21  (v10.0) a route that returns tickets (getTickets, getTicket*, search*Ticket*, getReportData, getDashboard,
 *        getStepApprovals, ...) reaches no visibility check - neither its case nor the handler it calls uses
 *        ticketReadGuard / canViewTicket / requestScope / buildActorScope / mayReadTicket (or an admin-only check)
 * Frontend checks run per file in src/ (tests skipped):
 *   F3   hour arithmetic for Philippine time (8 * 60 * 60) - format with Intl and timeZone 'Asia/Manila'
 *   F4   a fake save: `await new Promise(resolve => setTimeout(resolve, N))` or `TODO: Replace with actual API call`
 *
 * A deliberate exception carries `code-rules-allow <RULE> <reason>` on the same line or the line above.
 *
 * scripts/code-rules-known-gaps.txt lists violations that are known and not fixed yet (format: <RULE> <function|file>).
 * It may only shrink: the check fails on a violation that isn't listed, and on a listed one that is fixed.
 * Exit: 0 = matches the list, 1 = new or stale violations, 2 = usage/parse error.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const APPSCRIPT_DIR = path.join(ROOT, 'appscript_files');
const KNOWN_GAPS = path.join(__dirname, 'code-rules-known-gaps.txt');

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const SELF_TEST = args.includes('--self-test');
const fileArg = args.find(a => !a.startsWith('--'));

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

function newestAppScript() {
  const pattern = /^APPSCRIPT_v(\d+)\.(\d+)_(\d{8})_(\d{4})\.txt$/;
  const files = fs.readdirSync(APPSCRIPT_DIR)
    .map(name => ({ name, m: name.match(pattern) }))
    .filter(f => f.m)
    .sort((a, b) => (a.m[3] + a.m[4]).localeCompare(b.m[3] + b.m[4]));
  if (!files.length) fail(`no APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt in ${APPSCRIPT_DIR}`);
  return path.join(APPSCRIPT_DIR, files[files.length - 1].name);
}

// --- Shared helpers ----------------------------------------------------------

/** Text with comments and string contents blanked (same length, newlines kept), so patterns only see code. */
function codeOnly(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (quote) {
      if (c === '\\') { out += '  '; i++; continue; }
      if (c === quote) { quote = null; out += c; continue; }
      out += c === '\n' ? '\n' : ' ';
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') { out += ' '; i++; }
      if (i < text.length) out += '\n';
      continue;
    }
    if (c === '/' && next === '*') {
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) { out += text[i] === '\n' ? '\n' : ' '; i++; }
      out += '  ';
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
  }
  return out;
}

/** True when `code-rules-allow <rule>` is on the line of `index` or the line above (searched in the raw text). */
function allowed(raw, index, rule) {
  const lineStart = raw.lastIndexOf('\n', index - 1) + 1;
  const prevStart = raw.lastIndexOf('\n', Math.max(lineStart - 2, 0)) + 1;
  const lineEnd = raw.indexOf('\n', index);
  const window = raw.slice(prevStart, lineEnd === -1 ? raw.length : lineEnd);
  return new RegExp(`code-rules-allow\\s+${rule}\\b`).test(window);
}

/**
 * Character offsets inside a loop body or an array callback. A `for` / `while` header's following block, and the
 * argument list of .forEach / .map / .filter / .some / .every / .find / .findIndex / .reduce / .flatMap, count.
 * @returns {Function} offset => boolean
 */
function loopRanges(code) {
  const ranges = [];
  const stack = []; // { kind: 'loop' | 'head' | 'plain', open }
  let pendingLoopBlock = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '(' || c === '{' || c === '[') {
      const before = code.slice(Math.max(0, i - 40), i);
      let kind = 'plain';
      if (c === '(' && /\b(for|while)\s*$/.test(before)) kind = 'head';
      else if (c === '(' && /\.(forEach|map|filter|some|every|find|findIndex|reduce|flatMap)\s*$/.test(before)) kind = 'loop';
      else if (c === '{' && pendingLoopBlock) kind = 'loop';
      if (c === '{') pendingLoopBlock = false;
      stack.push({ kind, open: i });
    } else if (c === ')' || c === '}' || c === ']') {
      const top = stack.pop();
      if (!top) continue;
      if (top.kind === 'loop') ranges.push([top.open, i]);
      if (top.kind === 'head') pendingLoopBlock = true;
    } else if (pendingLoopBlock && !/\s/.test(c)) {
      pendingLoopBlock = false; // single-statement loop without braces: not tracked
    }
  }
  return offset => ranges.some(([a, b]) => offset > a && offset < b);
}

// --- AppScript ---------------------------------------------------------------

/** Top-level functions: [{ name, params, start, raw, code }]. */
function topLevelFunctions(text) {
  const code = codeOnly(text);
  const functions = [];
  const re = /^function\s+(\w+)\s*\(([^)]*)\)/gm;
  let m;
  while ((m = re.exec(code))) {
    const start = m.index;
    const endRel = code.slice(start).search(/^\}\s*$/m);
    const end = endRel === -1 ? code.length : start + endRel + 1;
    functions.push({
      name: m[1],
      params: m[2].split(',').map(p => p.replace(/=.*$/, '').trim()).filter(Boolean),
      start,
      raw: text.slice(start, end),
      code: code.slice(start, end)
    });
  }
  return functions;
}

const MUTATION = /\.(appendRow|setValues?|deleteRows?|insertRows?|insertRowsAfter|insertRowsBefore|clearContents?|clear)\s*\(/g;
const PERMISSION_CALL = /\b(isAdminUser|requireAdmin|checkUserCanApproveStep)\s*\(\s*([^,)]*)/g;
const SHEET_READ = /(\.(getDataRange|getValues|getDisplayValues)\s*\(|\bSpreadsheetApp\.openById\s*\(|\b(readTable|getSheetDataAsJSON|findRecord)\s*\()/g;
const HOUR_SHIFT = /8\s*\*\s*60\s*\*\s*60|getTime\(\)\s*[+-]\s*\(?\s*8\b/g;
const SCRIPT_TZ = /\.(getDay|getHours|setHours)\s*\(/g;
const ROW_COUNT_ID = /getLastRow\(\)\s*>\s*0\s*\?\s*[\w.]*getLastRow\(\)|\bid\s*:\s*[^,\n]*getLastRow\(\)|Math\.max\(\.\.\.\w+\)\s*:\s*0\)\s*\+\s*1/g;

/** The cache layer and the time helpers are where the raw calls belong. */
const A14_EXEMPT = new Set(['invalidateTable', 'resetRequestCache']);
const A16_EXEMPT = new Set(['ss', 'readTable', 'sheetValues', 'readRawTable', 'findRecord', 'liveRecords', 'recordsById',
  'getSheetDataAsJSON', 'readHeaders']);
const A17_EXEMPT = new Set([]);

function each(re, code, fn) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(code))) fn(m);
}

function appscriptViolations(text) {
  const violations = new Map(); // "<RULE> <name>" -> detail
  const add = (rule, name, detail) => { if (!violations.has(`${rule} ${name}`)) violations.set(`${rule} ${name}`, detail); };
  const functions = topLevelFunctions(text);

  const seen = new Map();
  for (const f of functions) {
    if (seen.has(f.name)) add('A20', f.name, `defined twice (offsets ${seen.get(f.name)} and ${f.start})`);
    else seen.set(f.name, f.start);
  }

  for (const f of functions) {
    const local = { raw: f.raw, code: f.code };
    const lineOf = idx => text.slice(0, f.start + idx).split('\n').length;

    // A14 - mutation without invalidation
    if (!A14_EXEMPT.has(f.name) && !/\binvalidateTable\s*\(/.test(local.code)) {
      each(MUTATION, local.code, m => {
        if (!allowed(local.raw, m.index, 'A14')) add('A14', f.name, `line ${lineOf(m.index)} .${m[1]}() without invalidateTable()`);
      });
    }

    // A15 - permission check on a request-supplied id
    each(PERMISSION_CALL, local.code, m => {
      const arg = m[2].trim();
      if (!arg || allowed(local.raw, m.index, 'A15')) return;
      if (/^actorId\s*\(/.test(arg)) return;
      if (f.params.includes(arg)) return;
      if (/^\w+$/.test(arg) && new RegExp(`\\b${arg}\\s*=\\s*actorId\\s*\\(`).test(local.code)) return;
      add('A15', f.name, `line ${lineOf(m.index)} ${m[1]}(${arg})`);
    });

    // A16 - read inside a loop
    if (!A16_EXEMPT.has(f.name)) {
      const inLoop = loopRanges(local.code);
      each(SHEET_READ, local.code, m => {
        if (inLoop(m.index) && !allowed(local.raw, m.index, 'A16')) add('A16', f.name, `line ${lineOf(m.index)} ${m[0].trim()} inside a loop`);
      });
    }

    // A17 - hour arithmetic / script time zone
    if (!A17_EXEMPT.has(f.name)) {
      each(HOUR_SHIFT, local.code, m => {
        if (!allowed(local.raw, m.index, 'A17')) add('A17', f.name, `line ${lineOf(m.index)} hour shift`);
      });
      each(SCRIPT_TZ, local.code, m => {
        if (!allowed(local.raw, m.index, 'A17')) add('A17', f.name, `line ${lineOf(m.index)} .${m[1]}() uses the script time zone`);
      });
    }

    // A18 - id from the row count or max + 1
    each(ROW_COUNT_ID, local.code, m => {
      if (!allowed(local.raw, m.index, 'A18')) add('A18', f.name, `line ${lineOf(m.index)} id from row count / max+1`);
    });
  }

  // A21 - a route that returns tickets checks visibility (v10.0, design ST-3)
  const byName = new Map(functions.map(f => [f.name, f]));
  for (const f of functions.filter(fn => ROUTER_FUNCTIONS.has(fn.name))) {
    const lineOf = idx => text.slice(0, f.start + idx).split('\n').length;
    const cases = [];
    each(CASE_LABEL, f.raw, m => cases.push({ action: m[1], index: m.index }));
    cases.forEach((c, i) => {
      if (!isTicketReadRoute(c.action) || allowed(f.raw, c.index, 'A21')) return;
      const body = f.code.slice(c.index, i + 1 < cases.length ? cases[i + 1].index : f.code.length);
      if (VISIBILITY_CALL.test(body)) return;
      const callees = [...body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map(m => m[1]).filter(n => byName.has(n) && !ROUTER_FUNCTIONS.has(n));
      if (callees.some(n => VISIBILITY_CALL.test(byName.get(n).code))) return;
      add('A21', c.action, `line ${lineOf(c.index)} returns tickets without a visibility check (canViewTicket)`);
    });
  }
  return violations;
}

const ROUTER_FUNCTIONS = new Set(['doGet', 'doPost', 'routePostAction']);
const CASE_LABEL = /case\s+'(\w+)'\s*:/g;
const VISIBILITY_CALL = /\b(ticketReadGuard|ticketReadView|canViewTicket|requestScope|buildActorScope|mayReadTicket|isAdminUser|requireAdmin)\s*\(/;
const TICKET_READ_ROUTES = new Set(['getReportData', 'getDashboard', 'getStepApprovals']);

/** Does the route return ticket data? get* / search* routes that name tickets (not ticket types / numbers), plus a list. */
function isTicketReadRoute(action) {
  if (TICKET_READ_ROUTES.has(action)) return true;
  return /^(get|search)/.test(action) && /Ticket/.test(action) && !/TicketTypes?$|TicketNumber|Dependencies/.test(action);
}

// --- Frontend ----------------------------------------------------------------

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name) && entry.name !== 'setupTests.js') {
      out.push(full);
    }
  }
  return out;
}

const FAKE_SAVE = /await\s+new\s+Promise\s*\(\s*\(?\s*resolve\s*\)?\s*=>\s*setTimeout\s*\(\s*resolve\s*,\s*\d+\s*\)\s*\)/g;
const FAKE_TODO = /TODO:\s*Replace with actual API call/g;

function frontendViolations(files, readFile) {
  const violations = new Map();
  for (const file of files) {
    const raw = readFile(file);
    const code = codeOnly(raw);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const lineOf = idx => raw.slice(0, idx).split('\n').length;
    each(HOUR_SHIFT, code, m => {
      if (!allowed(raw, m.index, 'F3') && !violations.has(`F3 ${rel}`)) violations.set(`F3 ${rel}`, `line ${lineOf(m.index)} hour shift`);
    });
    each(FAKE_SAVE, code, m => {
      if (!allowed(raw, m.index, 'F4') && !violations.has(`F4 ${rel}`)) violations.set(`F4 ${rel}`, `line ${lineOf(m.index)} setTimeout save`);
    });
    each(FAKE_TODO, raw, m => { // a comment, so match the raw text
      if (!allowed(raw, m.index, 'F4') && !violations.has(`F4 ${rel}`)) violations.set(`F4 ${rel}`, `line ${lineOf(m.index)} "TODO: Replace with actual API call"`);
    });
  }
  return violations;
}

// --- Self-test -----------------------------------------------------------------

function selfTest() {
  const cases = [
    ['A14 flags a write without invalidation', 'function w(s) {\n  s.appendRow([1]);\n}\n', ['A14 w']],
    ['A14 passes with invalidation', 'function w(s) {\n  s.appendRow([1]);\n  invalidateTable(s.getName());\n}\n', []],
    ['A14 allow comment', 'function w(s) {\n  s.clear(); // code-rules-allow A14 editor reset\n}\n', []],
    ['A15 flags a payload id', 'function r(data) {\n  if (!isAdminUser(data.user_id)) return 1;\n}\n', ['A15 r']],
    ['A15 passes actorId(...)', 'function r(data) {\n  if (!isAdminUser(actorId(data.user_id))) return 1;\n}\n', []],
    ['A15 passes a variable from actorId', 'function r(data) {\n  const who = actorId(data.user_id);\n  return requireAdmin(who, "x");\n}\n', []],
    ['A15 passes a parameter (checked at callers)', 'function requireX(userId) {\n  return isAdminUser(userId);\n}\n', []],
    ['A16 flags a read in forEach', 'function l(ids) {\n  ids.forEach(id => findRecord("t", id));\n}\n', ['A16 l']],
    ['A16 flags a read in a for block', 'function l(ids) {\n  for (let i = 0; i < 3; i++) {\n    readTable("t");\n  }\n}\n', ['A16 l']],
    ['A16 passes a read before the loop', 'function l(ids) {\n  const t = readTable("t");\n  ids.forEach(id => t.records.find(r => r.id === id));\n}\n', []],
    ['A17 flags +8h', 'function t() {\n  return new Date(Date.now() + 8 * 60 * 60 * 1000);\n}\n', ['A17 t']],
    ['A17 flags getDay', 'function t(d) {\n  return d.getDay() === 0;\n}\n', ['A17 t']],
    ['A17 ignores strings and comments', 'function t() {\n  // 8 * 60 * 60\n  return "getDay()";\n}\n', []],
    ['A18 flags getLastRow as id', 'function g(s) {\n  s.appendRow([(s.getLastRow() > 0 ? s.getLastRow() : 1), 2]);\n  invalidateTable();\n}\n', ['A18 g']],
    ['A18 flags max + 1', 'function g(ids) {\n  return (ids.length ? Math.max(...ids) : 0) + 1;\n}\n', ['A18 g']],
    ['A20 flags a duplicate', 'function d(a) {\n  return a;\n}\nfunction d(b) {\n  return b;\n}\n', ['A20 d']],
    ['A21 flags a ticket route without a check', "function doGet(e) {\n  switch (a) {\n    case 'getTicketFoo':\n      return foo(p);\n  }\n}\nfunction foo(p) {\n  return readTable('tickets');\n}\n", ['A21 getTicketFoo']],
    ['A21 passes a guard in the case', "function doGet(e) {\n  switch (a) {\n    case 'getTicketFoo':\n      return ticketReadGuard(p, id, 'x') || foo(p);\n  }\n}\n", []],
    ['A21 passes a check in the handler', "function doGet(e) {\n  switch (a) {\n    case 'getTickets':\n      return foo(p);\n  }\n}\nfunction foo(p) {\n  const s = requestScope(p.user_id, 'x');\n  return s;\n}\n", []],
    ['A21 ignores ticket types and allow comments', "function doGet(e) {\n  switch (a) {\n    case 'getTicketTypes':\n      return t();\n    // code-rules-allow A21 own inbox\n    case 'getTicketsForApproval':\n      return i();\n  }\n}\n", []]
  ];
  let failed = 0;
  for (const [name, src, expected] of cases) {
    const got = [...appscriptViolations(src).keys()].sort();
    const ok = JSON.stringify(got) === JSON.stringify(expected.slice().sort());
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)})`}`);
  }
  const frontCases = [
    ['F3 flags +8h', 'const t = new Date(d.getTime() + (8 * 60 * 60 * 1000));', ['F3 src/x.js']],
    ['F4 flags a setTimeout save', 'async function s() {\n  await new Promise(resolve => setTimeout(resolve, 500));\n}', ['F4 src/x.js']],
    ['F4 flags the TODO marker', '// TODO: Replace with actual API call\n', ['F4 src/x.js']],
    ['F4 allow comment', '// code-rules-allow F4 minimum spinner time\nawait new Promise(resolve => setTimeout(resolve, 600));', []]
  ];
  for (const [name, src, expected] of frontCases) {
    const got = [...frontendViolations([path.join(SRC, 'x.js')], () => src).keys()];
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)})`}`);
  }
  if (failed) { console.error(`${failed} self-test case(s) failed`); process.exit(1); }
  console.log('Self-test OK');
  process.exit(0);
}

// --- Known gaps ----------------------------------------------------------------

function loadKnownGaps() {
  if (!fs.existsSync(KNOWN_GAPS)) return new Set();
  return new Set(fs.readFileSync(KNOWN_GAPS, 'utf8').split('\n')
    .map(line => line.replace(/\r$/, '').replace(/#.*$/, '').trim())
    .filter(Boolean));
}

function writeKnownGaps(gaps, appscriptName) {
  const header = [
    '# Known code-rule violations - checked by scripts/check-code-rules.js',
    '# Format: <RULE> <function|file>. This list may only shrink: fix a violation, then remove its line',
    '# (node scripts/check-code-rules.js --update). Never add a line to silence a new violation.',
    `# Last updated against ${appscriptName}`,
    ''
  ];
  fs.writeFileSync(KNOWN_GAPS, header.concat([...gaps].sort(), ['']).join('\n'));
}

// --- Main ----------------------------------------------------------------------

if (SELF_TEST) selfTest();

const appscriptFile = fileArg ? path.resolve(fileArg) : newestAppScript();
if (!fs.existsSync(appscriptFile)) fail(`${appscriptFile} not found`);
const appscript = fs.readFileSync(appscriptFile, 'utf8').replace(/\r/g, '');
const appscriptName = path.basename(appscriptFile);

const violations = new Map([
  ...appscriptViolations(appscript),
  ...frontendViolations(sourceFiles(SRC), file => fs.readFileSync(file, 'utf8').replace(/\r/g, ''))
]);

const known = loadKnownGaps();
const added = [...violations.keys()].filter(v => !known.has(v)).sort();
const fixed = [...known].filter(v => !violations.has(v)).sort();

const byRule = {};
for (const v of violations.keys()) byRule[v.split(' ')[0]] = (byRule[v.split(' ')[0]] || 0) + 1;
console.log(`Code rules: ${appscriptName} + src/ - ${violations.size} violations (${Object.entries(byRule).sort().map(([r, n]) => `${r} ${n}`).join(', ') || 'none'}), ${known.size} in known-gaps list`);

if (UPDATE) {
  if (added.length && fs.existsSync(KNOWN_GAPS)) {
    console.error('Refusing to update: these violations are not in the list (fix them; the list may only shrink):');
    added.forEach(v => console.error(`  + ${v}  (${violations.get(v)})`));
    process.exit(1);
  }
  writeKnownGaps(violations.keys(), appscriptName);
  console.log(`Updated ${path.relative(ROOT, KNOWN_GAPS)}: removed ${fixed.length}, ${violations.size} remain`);
  process.exit(0);
}

if (added.length) {
  console.error('\nNEW violations (not in the known-gaps list):');
  for (const v of added) console.error(`  + ${v}  (${violations.get(v)})`);
}
if (fixed.length) {
  console.error('\nFixed violations still in the known-gaps list (run with --update to remove them):');
  fixed.forEach(v => console.error(`  - ${v}`));
}
if (added.length || fixed.length) process.exit(1);
console.log('OK: code rules match the known-gaps list');
