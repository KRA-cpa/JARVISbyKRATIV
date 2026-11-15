#!/usr/bin/env node
/** test-signed-in-users.js - scripts/signed-in-users.js (who may still be signed in, from request logs). Exit 0 = pass. */
const assert = require('assert');
const { signedInUsers } = require('./signed-in-users');

const NOW = Date.parse('2026-11-15T12:00:00Z');
const at = (min) => new Date(NOW - min * 60 * 1000).toISOString();
const line = (uid, minAgo, signedInMinAgo, extra = {}) => ({
  timestamp: at(minAgo),
  jsonPayload: { user_id: uid, auth: 'verified', signed_in_at: at(signedInMinAgo), company_id: 'c1', ...extra }
});

const results = [];
function run(name, fn) {
  try { fn(); results.push(`PASS  ${name}`); } catch (e) { results.push(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}

run('groups by user, newest request first, active vs idle', () => {
  const rows = signedInUsers([
    line('u1', 5, 120), line('u1', 30, 120, { company_id: 'c2' }),
    line('u2', 90, 200)
  ], { nowMs: NOW });
  assert.deepStrictEqual(rows.map(r => [r.uid, r.state, r.requests]), [['u1', 'active', 2], ['u2', 'idle', 1]]);
  assert.deepStrictEqual(rows[0].companies, ['c1', 'c2']);
  assert.strictEqual(rows[0].lastRequestAt, at(5));
});

run('leaves out sign-ins older than the 12-hour cap, before the cutoff, and unverified / anonymous lines', () => {
  const rows = signedInUsers([
    line('old', 10, 13 * 60),
    line('revoked', 10, 120),
    line('fresh', 10, 20),
    { timestamp: at(1), jsonPayload: { user_id: null, auth: 'none' } },
    { timestamp: at(1), jsonPayload: { user_id: 'x', auth: 'revoked', signed_in_at: at(5) } },
    { timestamp: at(1), jsonPayload: { user_id: 'nosignin', auth: 'verified' } },
    { textPayload: 'not json' }
  ], { nowMs: NOW, cutoffMs: NOW - 60 * 60 * 1000 });
  assert.deepStrictEqual(rows.map(r => r.uid), ['fresh']);
});

run('a user who signed in again keeps the newest sign-in', () => {
  const rows = signedInUsers([line('u', 400, 13 * 60), line('u', 5, 10)], { nowMs: NOW });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].signedInAt, at(10));
});

console.log(results.join('\n'));
console.log(process.exitCode ? 'signed-in-users test FAILED' : `signed-in-users test OK (${results.length} cases)`);
