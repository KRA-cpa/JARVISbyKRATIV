#!/usr/bin/env node
/**
 * check-api-contract.js — every action the frontend sends must have a backend route
 * Rule: docs/guides/GUIDE_CodeReview_Compliance.md A12 / A13
 *
 * Usage:
 *   node scripts/check-api-contract.js [APPSCRIPT file]   check (default: newest appscript_files/APPSCRIPT_v*_<YYYYMMDD>_<HHMM>.txt)
 *   node scripts/check-api-contract.js --update [file]    rewrite the known-gaps list; refuses to add entries
 *                                                         (creates the baseline when the list doesn't exist yet)
 *
 * Frontend side: makeRequest('<action>', ...) calls in src/ (tests skipped). An action is sent by GET
 * when it is in readActions (src/api/googleSheet.js), otherwise by POST.
 * Backend side: case labels inside doGet() and routePostAction().
 *
 * Gap kinds:
 *   missing             no route in doGet or doPost
 *   get-not-in-doGet    sent by GET, routed only in doPost
 *   post-not-in-doPost  sent by POST, routed only in doGet
 *   action-key          the payload has its own `action` key, which overwrites the route name in the POST body
 *   undefined-function  doGet/routePostAction calls a function the AppScript file doesn't define
 *   missing-method      API.<Group>.<method>() / <x>API.<method>() calls a client method the class (or its base
 *                       class) doesn't define (v9.0: AdminWorkflowBuilder called WorkflowSteps.updateStepApprovers)
 *   unmounted-component a src/components or src/pages file that src/index.js can't reach through imports, so no
 *                       screen shows it (v9.0: the whole ticket UI - TicketDashboard, TicketForm, TicketDetail)
 *   missing-icon        <Icons.X> / Icons.X used but not defined in src/components/shared/Icons.js - renders
 *                       undefined, React error #130 (v9.0: Icons.Trash on the profile/role type list delete buttons)
 *
 * scripts/api-contract-known-gaps.txt lists gaps that are known and not fixed yet. It may only shrink:
 * the check fails on a gap that isn't listed, and on a listed gap that is fixed (remove it from the list).
 * Exit: 0 = matches the list, 1 = new or stale gaps, 2 = usage/parse error.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const API_FILE = path.join(SRC, 'api/googleSheet.js');
const APPSCRIPT_DIR = path.join(ROOT, 'appscript_files');
const KNOWN_GAPS = path.join(__dirname, 'api-contract-known-gaps.txt');

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const fileArg = args.find(a => !a.startsWith('--'));

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}

// --- Backend ---------------------------------------------------------------

function newestAppScript() {
  const pattern = /^APPSCRIPT_v(\d+)\.(\d+)_(\d{8})_(\d{4})\.txt$/;
  const files = fs.readdirSync(APPSCRIPT_DIR)
    .map(name => ({ name, m: name.match(pattern) }))
    .filter(f => f.m)
    .sort((a, b) => (a.m[3] + a.m[4]).localeCompare(b.m[3] + b.m[4]));
  if (!files.length) fail(`no APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt in ${APPSCRIPT_DIR}`);
  return path.join(APPSCRIPT_DIR, files[files.length - 1].name);
}

/** Body of a top-level function: from its declaration to the first line that is just "}". */
function functionBody(text, name) {
  const start = text.search(new RegExp(`^function ${name}\\(`, 'm'));
  if (start === -1) fail(`function ${name}() not found in the AppScript file`);
  const end = text.slice(start).search(/^\}\s*$/m);
  if (end === -1) fail(`end of function ${name}() not found`);
  return text.slice(start, start + end);
}

function caseLabels(body) {
  return new Set([...body.matchAll(/^\s*case '([A-Za-z0-9_]+)':/gm)].map(m => m[1]));
}

// Called in a router but not defined in the file (v8.3 deleteRole called deactivateRole(), which never existed)
const NOT_FUNCTIONS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'typeof', 'new',
  'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'Error', 'JSON', 'Math', 'parseInt', 'parseFloat', 'isNaN']);

function undefinedCalls(text, bodies) {
  const defined = new Set([...text.matchAll(/^(?:function\s+([A-Za-z0-9_$]+)\s*\(|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=)/gm)]
    .map(m => m[1] || m[2]));
  const missing = new Set();
  for (const body of bodies) {
    const code = body.replace(/\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
    for (const m of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!NOT_FUNCTIONS.has(m[2]) && !defined.has(m[2])) missing.add(m[2]);
    }
  }
  return missing;
}

// --- Frontend --------------------------------------------------------------

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    if (!/\.jsx?$/.test(entry.name) || /\.test\.jsx?$/.test(entry.name) || entry.name === 'setupTests.js') return [];
    return [full];
  });
}

/** Text of the object literal starting at text[open] === '{' (string-aware brace matching). */
function objectLiteral(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}' && --depth === 0) {
      return text.slice(open, i + 1);
    }
  }
  return '';
}

/**
 * True when the object literal has a top-level `action:` key. Walks the text character by character
 * (string-aware), so a one-line literal `{ id, action: 'approve' }` is caught too - the line-based version
 * only tested keys at the start of a line (review R-09).
 */
function hasActionKey(literal) {
  let depth = 0;
  let quote = null;
  let keyStart = true; // at a position where a property key can begin
  for (let i = 0; i < literal.length; i++) {
    const c = literal[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (depth === 1 && keyStart) {
      const m = literal.slice(i).match(/^\s*['"]?action['"]?\s*:/);
      if (m) return true;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      keyStart = false;
    } else if ('{[('.includes(c)) {
      depth++;
      keyStart = depth === 1 && c === '{';
    } else if ('}])'.includes(c)) {
      depth--;
      keyStart = false;
    } else if (c === ',' && depth === 1) {
      keyStart = true;
    } else if (!/\s/.test(c)) {
      keyStart = false;
    }
  }
  return false;
}

function frontendCalls() {
  const calls = new Map(); // action -> [file:line]
  const actionKeys = new Map();
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    for (const m of text.matchAll(/makeRequest\(\s*'([A-Za-z0-9_]+)'\s*(,\s*)?/g)) {
      const where = `${rel}:${text.slice(0, m.index).split('\n').length}`;
      const action = m[1];
      if (!calls.has(action)) calls.set(action, []);
      calls.get(action).push(where);
      const after = m.index + m[0].length;
      if (m[2] && text[after] === '{' && hasActionKey(objectLiteral(text, after))) {
        if (!actionKeys.has(action)) actionKeys.set(action, []);
        actionKeys.get(action).push(where);
      }
    }
  }
  return { calls, actionKeys };
}

function readActions() {
  const text = fs.readFileSync(API_FILE, 'utf8');
  const m = text.match(/const readActions = \[([\s\S]*?)\];/);
  if (!m) fail(`readActions list not found in ${path.relative(ROOT, API_FILE)}`);
  return new Set([...m[1].replace(/\/\/.*$/gm, '').matchAll(/'([A-Za-z0-9_]+)'/g)].map(x => x[1]));
}

// --- Client methods --------------------------------------------------------

const NOT_METHODS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return']);

/** Text of `class <name>` up to the next top-level class or the API export. */
function classBody(text, name) {
  const start = text.search(new RegExp(`^(?:export\\s+)?class ${name}\\b`, 'm'));
  if (start === -1) return null;
  const rest = text.slice(start + 1);
  const end = rest.search(/^(?:export\s+)?class\s|^export const API\b/m);
  return end === -1 ? text.slice(start) : text.slice(start, start + 1 + end);
}

function classMethods(text, name, seen = new Set()) {
  if (seen.has(name)) return new Set();
  seen.add(name);
  const body = classBody(text, name);
  if (body === null) return null;
  const methods = new Set();
  for (const m of body.matchAll(/^\s+(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) {
    if (!NOT_METHODS.has(m[1])) methods.add(m[1]);
  }
  for (const m of body.matchAll(/^\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/gm)) {
    methods.add(m[1]);
  }
  const base = body.match(new RegExp(`class ${name}\\s+extends\\s+([A-Za-z_$][\\w$]*)`));
  if (base) (classMethods(text, base[1], seen) || []).forEach(x => methods.add(x));
  return methods;
}

/** Group/alias name -> method set, from `export const API = { Group: new Class() }` and `x = API.Group`. */
function apiGroups() {
  const text = fs.readFileSync(API_FILE, 'utf8').replace(/\r/g, '');
  const open = text.indexOf('{', text.search(/^export const API = \{/m));
  if (open === -1) fail(`export const API = { ... } not found in ${path.relative(ROOT, API_FILE)}`);
  const groups = new Map();
  for (const m of objectLiteral(text, open).matchAll(/([A-Za-z_$][\w$]*)\s*:\s*new\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const methods = classMethods(text, m[2]);
    if (methods === null) fail(`class ${m[2]} (API.${m[1]}) not found in ${path.relative(ROOT, API_FILE)}`);
    groups.set(`API.${m[1]}`, methods);
  }
  for (const m of text.matchAll(/^export const ([A-Za-z_$][\w$]*) = API\.([A-Za-z_$][\w$]*);/gm)) {
    if (groups.has(`API.${m[2]}`)) groups.set(m[1], groups.get(`API.${m[2]}`));
  }
  return groups;
}

function missingMethods() {
  const groups = apiGroups();
  const missing = new Map(); // "API.Group.method" -> [file:line]
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const re = /(?<![\w$.])((?:API\.[A-Za-z_$][\w$]*)|[A-Za-z_$][\w$]*API)\??\.([A-Za-z_$][\w$]*)\s*(?:\?\.)?\(/g;
    for (const m of text.matchAll(re)) {
      const methods = groups.get(m[1]);
      if (!methods || methods.has(m[2])) continue;
      const key = `${m[1]}.${m[2]}`;
      if (!missing.has(key)) missing.set(key, []);
      missing.get(key).push(`${rel}:${text.slice(0, m.index).split('\n').length}`);
    }
  }
  return missing;
}

// --- Mounted screens -------------------------------------------------------

function resolveImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** src/components and src/pages files that src/index.js can't reach through relative imports. */
function unmountedScreens() {
  const entry = path.join(SRC, 'index.js');
  if (!fs.existsSync(entry)) fail('src/index.js not found');
  const reached = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (reached.has(file)) continue;
    reached.add(file);
    if (!/\.jsx?$/.test(file)) continue;
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"](\.{1,2}\/[^'"]+)['"]/gm)) {
      const target = resolveImport(file, m[1]);
      if (target && !reached.has(target)) queue.push(target);
    }
  }
  return sourceFiles(SRC)
    .filter(file => /[\\/]src[\\/](components|pages)[\\/]/.test(file) && !reached.has(file))
    .map(file => path.relative(ROOT, file).replace(/\\/g, '/'));
}

// --- Icons -------------------------------------------------------------------

const ICONS_FILE = path.join(SRC, 'components/shared/Icons.js');

/** "Icons.X" -> [file:line] for every Icons.X used in src/ but not defined in Icons.js. */
function missingIcons() {
  if (!fs.existsSync(ICONS_FILE)) fail(`${path.relative(ROOT, ICONS_FILE)} not found`);
  const iconsText = fs.readFileSync(ICONS_FILE, 'utf8').replace(/\r/g, '');
  const defined = new Set([...iconsText.matchAll(/^\s*([A-Z][A-Za-z0-9_]*)\s*:/gm)].map(m => m[1]));
  const missing = new Map();
  for (const file of sourceFiles(SRC)) {
    if (file === ICONS_FILE) continue;
    const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    for (const m of text.matchAll(/\bIcons\.([A-Z][A-Za-z0-9_]*)\b/g)) {
      if (defined.has(m[1])) continue;
      // Skip a name inside a string or a // comment on its line (ErrorBoundary130 prints "<Icons.NonExistentIcon />")
      const before = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index);
      const inString = ["'", '"', '`'].some(q => (before.split(q).length - 1) % 2 === 1);
      if (inString || before.includes('//')) continue;
      const key = `Icons.${m[1]}`;
      if (!missing.has(key)) missing.set(key, []);
      missing.get(key).push(`${rel}:${text.slice(0, m.index).split('\n').length}`);
    }
  }
  return missing;
}

// --- Known gaps ------------------------------------------------------------

function loadKnownGaps() {
  if (!fs.existsSync(KNOWN_GAPS)) return new Set();
  return new Set(fs.readFileSync(KNOWN_GAPS, 'utf8').split('\n')
    .map(line => line.replace(/\r$/, '').replace(/#.*$/, '').trim())
    .filter(Boolean));
}

function writeKnownGaps(gaps, appscriptName) {
  const header = [
    '# Known frontend->backend contract gaps - checked by scripts/check-api-contract.js',
    '# Format: <kind> <action>. This list may only shrink: fix a gap, then remove its line',
    '# (node scripts/check-api-contract.js --update). Never add a line to silence a new gap.',
    `# Last updated against ${appscriptName}`,
    ''
  ];
  fs.writeFileSync(KNOWN_GAPS, header.concat([...gaps].sort(), ['']).join('\n'));
}

// --- Main ------------------------------------------------------------------

const appscriptFile = fileArg ? path.resolve(fileArg) : newestAppScript();
if (!fs.existsSync(appscriptFile)) fail(`${appscriptFile} not found`);
const appscript = fs.readFileSync(appscriptFile, 'utf8').replace(/\r/g, '');
const appscriptName = path.basename(appscriptFile);

const getBody = functionBody(appscript, 'doGet');
const postBody = functionBody(appscript, 'routePostAction');
const getRoutes = caseLabels(getBody);
const postRoutes = caseLabels(postBody);
const gets = readActions();
const { calls, actionKeys } = frontendCalls();

const gaps = new Set();
for (const action of calls.keys()) {
  const inGet = getRoutes.has(action);
  const inPost = postRoutes.has(action);
  if (!inGet && !inPost) gaps.add(`missing ${action}`);
  else if (gets.has(action) && !inGet) gaps.add(`get-not-in-doGet ${action}`);
  else if (!gets.has(action) && !inPost) gaps.add(`post-not-in-doPost ${action}`);
}
for (const action of actionKeys.keys()) gaps.add(`action-key ${action}`);
for (const fn of undefinedCalls(appscript, [getBody, postBody])) gaps.add(`undefined-function ${fn}`);
const methodGaps = missingMethods();
for (const call of methodGaps.keys()) gaps.add(`missing-method ${call}`);
for (const file of unmountedScreens()) gaps.add(`unmounted-component ${file}`);
const iconGaps = missingIcons();
for (const icon of iconGaps.keys()) gaps.add(`missing-icon ${icon}`);
for (const diff of planCopyDiffs()) gaps.add(`plan-copy ${diff}`);

/**
 * v10.2: the public /plans page renders src/config/plans.js (no API call), so its TIERS / LIMITS must equal the server's
 * PLAN_FEATURE_TIERS / PLAN_LIMITS in the AppScript file (the server enforces its own; F1). Each literal is evaluated as
 * plain data. Files before v10.2 have no catalogue: nothing to compare.
 * @returns {string[]} differences, e.g. "advanced.features" or "basic.limits.users"
 */
function planCopyDiffs() {
  const literal = (text, name) => {
    const start = text.indexOf(`const ${name} = {`);
    if (start === -1) return null;
    const end = text.indexOf('\n};', start);
    // eslint-disable-next-line no-new-func
    return new Function(`return ${text.slice(start + `const ${name} = `.length, end + 2)};`)();
  };
  const serverTiers = literal(appscript, 'PLAN_FEATURE_TIERS');
  if (!serverTiers) return [];
  const copyFile = path.join(SRC, 'config/plans.js');
  if (!fs.existsSync(copyFile)) return ['missing src/config/plans.js'];
  const copy = fs.readFileSync(copyFile, 'utf8').replace(/\r/g, '');
  const copyTiers = literal(copy, 'TIERS');
  const copyLimits = literal(copy, 'LIMITS');
  const serverLimits = literal(appscript, 'PLAN_LIMITS');
  if (!copyTiers || !copyLimits) return ['src/config/plans.js has no TIERS / LIMITS'];
  const diffs = [];
  const plans = [...new Set([...Object.keys(serverTiers), ...Object.keys(copyTiers)])].sort();
  plans.forEach(plan => {
    const a = JSON.stringify([...(serverTiers[plan] || [])].sort());
    const b = JSON.stringify([...(copyTiers[plan] || [])].sort());
    if (a !== b) diffs.push(`${plan}.features`);
    const keys = [...new Set([...Object.keys(serverLimits[plan] || {}), ...Object.keys(copyLimits[plan] || {})])].sort();
    keys.forEach(key => {
      if (JSON.stringify((serverLimits[plan] || {})[key]) !== JSON.stringify((copyLimits[plan] || {})[key])) diffs.push(`${plan}.limits.${key}`);
    });
  });
  return diffs;
}

/** Where a gap comes from, for the report. */
function gapWhere(gap) {
  const [kind, name] = gap.split(' ');
  if (kind === 'action-key') return actionKeys.get(name) || [];
  if (kind === 'missing-method') return methodGaps.get(name) || [];
  if (kind === 'missing-icon') return iconGaps.get(name) || [];
  if (kind === 'plan-copy') return ['src/config/plans.js vs PLAN_FEATURE_TIERS / PLAN_LIMITS'];
  return calls.get(name) || [];
}

const known = loadKnownGaps();
const added = [...gaps].filter(g => !known.has(g)).sort();
const fixed = [...known].filter(g => !gaps.has(g)).sort();

console.log(`API contract: ${calls.size} frontend actions, ${getRoutes.size} doGet + ${postRoutes.size} doPost routes (${appscriptName})`);
console.log(`Gaps: ${gaps.size} (${known.size} in known-gaps list)`);

if (UPDATE) {
  // The first run creates the baseline; after that the list may only shrink
  if (added.length && fs.existsSync(KNOWN_GAPS)) {
    console.error('Refusing to update: these gaps are not in the list (fix them; the list may only shrink):');
    added.forEach(g => console.error(`  + ${g}  (${gapWhere(g).join(', ')})`));
    process.exit(1);
  }
  writeKnownGaps(gaps, appscriptName);
  console.log(`Updated ${path.relative(ROOT, KNOWN_GAPS)}: removed ${fixed.length}, ${gaps.size} remain`);
  process.exit(0);
}

if (added.length) {
  console.error('\nNEW gaps (not in the known-gaps list):');
  for (const g of added) console.error(`  + ${g}  (${gapWhere(g).join(', ')})`);
}
if (fixed.length) {
  console.error('\nFixed gaps still in the known-gaps list (run with --update to remove them):');
  fixed.forEach(g => console.error(`  - ${g}`));
}
if (added.length || fixed.length) process.exit(1);
console.log('OK: contract matches the known-gaps list');
