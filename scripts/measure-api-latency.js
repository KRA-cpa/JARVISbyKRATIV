#!/usr/bin/env node
/**
 * measure-api-latency.js — time backend actions through the proxy, for the reco baseline (v9.3) vs v9.4
 * (docs/planning/REVIEW_AppScriptReco_20261030.md §5, Claude.md non-functional targets)
 *
 * Usage:
 *   ID_TOKEN=<Firebase ID token> node scripts/measure-api-latency.js [--url <proxy url>] [--runs 5] [--user <uid>]
 *   node scripts/measure-api-latency.js --writes --company <seed company id> --ticket-type <seed type id> --approver <uid>
 *
 * Reads only by default: getTickets, getDropdownLists, getTicketsForApproval, getReportData, getDashboard (v9.4+).
 * --writes also creates a ticket per run and approves it (use seed data - SEED_TestData - never real companies).
 * With AUTH_MODE=enforce set ID_TOKEN in the environment (copy it from the browser:
 * await firebase.auth().currentUser.getIdToken()). Never on the command line - compliance S2 (review CR2-09).
 * Prints median / worst per action and the X-Response-Time the proxy reports. Exit 1 when every call failed.
 */

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const URL_BASE = option('url', process.env.API_URL || 'https://jarvis-by-erp.vercel.app/api/appscript-proxy');
const RUNS = Number(option('runs', 5)) || 5;
const USER = option('user', process.env.API_USER || '');
const TOKEN = process.env.ID_TOKEN || '';
if (flag('token') || args.some(a => a.startsWith('--token'))) {
  console.error('--token is not accepted (it would show in the process list and shell history): set ID_TOKEN instead');
  process.exit(2);
}

const headers = { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

async function call(method, action, payload = {}) {
  const started = Date.now();
  let response;
  if (method === 'GET') {
    const query = new URLSearchParams({ action, ...payload });
    response = await fetch(`${URL_BASE}?${query}`, { headers });
  } else {
    response = await fetch(URL_BASE, { method: 'POST', headers, body: JSON.stringify({ action, ...payload }) });
  }
  const body = await response.json().catch(() => ({}));
  return { ms: Date.now() - started, server: response.headers.get('x-response-time'), ok: response.ok && body.success !== false, body };
}

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : NaN;
};

async function measure(label, fn) {
  const times = [];
  let failures = 0;
  let lastError = '';
  let server = '';
  for (let i = 0; i < RUNS; i++) {
    try {
      const result = await fn(i);
      if (result.ok) { times.push(result.ms); server = result.server || server; } else { failures++; lastError = result.body.error || 'failed'; }
    } catch (error) {
      failures++;
      lastError = error.message;
    }
  }
  const row = { action: label, median_ms: median(times), worst_ms: times.length ? Math.max(...times) : NaN, ok: times.length, failed: failures, proxy_time: server };
  console.log(`${label.padEnd(24)} median ${String(row.median_ms).padStart(6)} ms  worst ${String(row.worst_ms).padStart(6)} ms  ok ${row.ok}/${RUNS}${failures ? `  (${lastError})` : ''}`);
  return row;
}

async function main() {
  console.log(`Proxy: ${URL_BASE}  runs: ${RUNS}  user: ${USER || '(none)'}  token: ${TOKEN ? 'yes' : 'no'}`);
  const ping = await call('GET', 'ping');
  console.log(`Backend API_VERSION: ${ping.body.version || 'unknown'}\n`);

  const rows = [];
  rows.push(await measure('getTickets', () => call('GET', 'getTickets')));
  rows.push(await measure('getDropdownLists', () => call('GET', 'getDropdownLists')));
  if (USER) {
    rows.push(await measure('getTicketsForApproval', () => call('GET', 'getTicketsForApproval', { user_id: USER })));
    rows.push(await measure('getReportData', () => call('GET', 'getReportData', { user_id: USER })));
    rows.push(await measure('getDashboard', () => call('GET', 'getDashboard', { user_id: USER })));
  } else {
    console.log('(--user not given: skipped getTicketsForApproval, getReportData, getDashboard)');
  }

  if (flag('writes')) {
    const company = option('company');
    const ticketType = option('ticket-type');
    const approver = option('approver', USER);
    if (!company || !ticketType || !USER) {
      console.error('--writes needs --company, --ticket-type and --user (seed data only)');
      process.exit(2);
    }
    const created = [];
    rows.push(await measure('createTicket', async i => {
      const result = await call('POST', 'createTicket', { title: `Latency run ${i + 1}`, ticket_type_id: ticketType, company_id: company, requester_id: USER });
      if (result.ok) created.push(String(result.body.data.id));
      return result;
    }));
    rows.push(await measure('submitStepApproval', i => call('POST', 'submitStepApproval',
      { ticket_id: created[i], user_id: approver, decision: 'approve', comment: 'latency run' })));
  }

  console.log('\nMarkdown row for REVIEW_AppScriptReco_20261030.md §5:');
  rows.forEach(r => console.log(`| ${r.action} | ${r.median_ms} | ${r.worst_ms} |`));
  if (rows.every(r => r.ok === 0)) process.exit(1);
}

main().catch(error => { console.error(error); process.exit(1); });
