#!/usr/bin/env node
/**
 * signed-in-users.js v1.0 (15 Nov 2026) - who may still be signed in to Daloy, from the server's request logs.
 * User, 15 Nov 2026: "ok if we have 12hr limit, but a check of all signed in users and force logout will still be needed".
 *
 * Usage: scripts/list-signed-in.sh (reads Cloud Logging and pipes it here), or
 *        node scripts/signed-in-users.js [--hours 12] [--idle-minutes 60] [--cutoff <ISO>] < logs.json
 * Input: the JSON array of `gcloud logging read --format=json` - entries whose jsonPayload is the per-request line of
 * api/_lib/proxyCore.js / rpcCore.js ({ user_id, signed_in_at, auth, company_id, ... }).
 * A user counts as signed in when a verified request came with a sign-in (signed_in_at) younger than the 12-hour cap
 * (MAX_SESSION_HOURS) and not before the forced sign-out cutoff (SESSIONS_VALID_AFTER). "active" = a request in the last
 * 60 minutes (the app's idle limit); "idle" = the app signs them out when they come back.
 * Prints uids only (no emails - names are in Admin → Users). Exit 0; 2 = the input isn't a JSON array.
 */

const DEFAULT_HOURS = 12;
const DEFAULT_IDLE_MINUTES = 60;

/**
 * @param {Array} entries - Cloud Logging entries
 * @param {{ nowMs, hours, idleMinutes, cutoffMs }} options
 * @returns {Array<{ uid, signedInAt, lastRequestAt, requests, companies, state }>} newest request first
 */
function signedInUsers(entries, { nowMs = Date.now(), hours = DEFAULT_HOURS, idleMinutes = DEFAULT_IDLE_MINUTES, cutoffMs = null } = {}) {
  const byUid = new Map();
  for (const entry of entries || []) {
    const p = entry && entry.jsonPayload;
    if (!p || p.auth !== 'verified' || !p.user_id || !p.signed_in_at) continue;
    const signedIn = Date.parse(p.signed_in_at);
    const at = Date.parse(entry.timestamp);
    if (Number.isNaN(signedIn) || Number.isNaN(at)) continue;
    const row = byUid.get(p.user_id) || { uid: p.user_id, signedIn: -Infinity, last: -Infinity, requests: 0, companies: new Set() };
    row.signedIn = Math.max(row.signedIn, signedIn);
    row.last = Math.max(row.last, at);
    row.requests += 1;
    if (p.company_id) row.companies.add(String(p.company_id));
    byUid.set(p.user_id, row);
  }
  return [...byUid.values()]
    .filter(r => nowMs - r.signedIn <= hours * 3600 * 1000 && (cutoffMs === null || r.signedIn >= cutoffMs))
    .sort((a, b) => b.last - a.last)
    .map(r => ({
      uid: r.uid,
      signedInAt: new Date(r.signedIn).toISOString(),
      lastRequestAt: new Date(r.last).toISOString(),
      requests: r.requests,
      companies: [...r.companies].sort(),
      state: nowMs - r.last <= idleMinutes * 60 * 1000 ? 'active' : 'idle'
    }));
}

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function main() {
  const args = process.argv.slice(2);
  const hours = Number(argValue(args, '--hours')) || DEFAULT_HOURS;
  const idleMinutes = Number(argValue(args, '--idle-minutes')) || DEFAULT_IDLE_MINUTES;
  const cutoffRaw = argValue(args, '--cutoff');
  const cutoffMs = cutoffRaw ? Date.parse(cutoffRaw) : null;
  let raw = '';
  process.stdin.on('data', d => { raw += d; }).on('end', () => {
    let entries;
    try { entries = JSON.parse(raw || '[]'); } catch (e) { entries = null; }
    if (!Array.isArray(entries)) { console.error('Input is not a JSON array of log entries.'); process.exit(2); }
    const rows = signedInUsers(entries, { hours, idleMinutes, cutoffMs: Number.isNaN(cutoffMs) ? null : cutoffMs });
    const active = rows.filter(r => r.state === 'active').length;
    console.log(`Signed in (sign-in < ${hours} h${cutoffMs ? `, after the cutoff ${cutoffRaw}` : ''}): ${rows.length} - active (request < ${idleMinutes} min): ${active}`);
    rows.forEach(r => console.log([r.state.padEnd(6), r.uid.padEnd(30), `signed in ${r.signedInAt}`, `last ${r.lastRequestAt}`,
      `${r.requests} req`, r.companies.length ? `companies ${r.companies.join(',')}` : ''].join('  ').trimEnd()));
  });
}

if (require.main === module) main();

module.exports = { signedInUsers };
