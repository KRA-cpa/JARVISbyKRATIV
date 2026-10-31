// Usage: node appscript_files/tools/ROUTES_TEST_v9.6.js appscript_files/APPSCRIPT_v9.6_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v9.6 (admin-only routes + bootstrap, sign-in allow-list, invites, attachment links with
// broken-link reports, company email settings, preferences on actorId) on the fake Sheets runtime, in AUTH_MODE
// enforce with the proxy's identity fields (_proxy_secret / _auth_uid / _auth_email). Stale-cache detector on.
// Run the older suites on the same file too: ROUTES_TEST_v9.5.js ... CODE_REVIEW_FIXES_TEST_v8.3.js, SEED_TEST.js
// (run them with TZ=Asia/Manila: the v9.0 date-only end test assumes Manila local midnight).
const assert = require('assert');
const fs = require('fs');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v9.6.js <APPSCRIPT file>');
  process.exit(2);
}
const { test, report } = lib.makeTestRunner();
const SECRET = 's';

/**
 * co_1 + tt_1 with one step ws_1 (approvers: Manager). Users: u_admin (System Admin role, profile), u_mgr (Manager
 * role, no profile), u_req (profile, no role), u_out (profile + Staff role in co_1 - not involved in the ticket),
 * u_far (profile, no role anywhere - can't see co_1 tickets' links).
 * options.noAdmin: no admin assignment (bootstrap open). options.mode: AUTH_MODE (default enforce).
 */
function seed(options = {}) {
  const rt = lib.makeRuntime(FILE, { properties: { AUTH_MODE: options.mode || 'enforce', PROXY_SECRET: SECRET,
    // v9.7+ only allows docs / drive.google.com links; '*' keeps the v9.6 rule these link tests were written for
    LINK_ALLOWED_HOSTS: '*', ...(options.properties || {}) } });
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (tableName, record) => rt.sheets.get(tableName).appendRow(rt.ctx.rowFromRecord(S[tableName], record));
  const rows = tableName => rt.ctx.readTable(tableName).records;

  add('companies', { id: 'co_1', name: 'Main Co', code: 'MYCO', is_active: true, email_enabled: 'default' });
  // v10.0: collaborative keeps this suite's v9.6 rule (any role in the company sees the ticket); private is v10's default
  add('ticket_types', { id: 'tt_1', code: 'PR', name: 'Purchase', is_active: true, sla_email: 'default', visibility: 'collaborative' });
  add('roles', { id: 'r_mgr', name: 'Manager', company_id: '', is_active: true });
  add('roles', { id: 'r_admin', name: 'System Admin', company_id: '', is_active: true });
  add('roles', { id: 'r_staff', name: 'Staff', company_id: '', is_active: true });
  add('workflow_steps', { id: 'ws_1', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Managers', status_on_reach: 'Pending Managers',
    step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_mgr' });
  const grants = [['u_mgr', 'r_mgr'], ['u_out', 'r_staff']].concat(options.noAdmin ? [] : [['u_admin', 'r_admin']]);
  grants.forEach(([user_id, role_id]) => {
    const res = rt.ctx.createUserRoleAssignment({ user_id, role_id, company_id: 'co_1' });
    assert.strictEqual(res.status, 'success', res.message);
  });
  // v10.0 (decision 1): creating a ticket needs a role on its type + company (Requester, on tt_1 only)
  add('roles', { id: 'r_req', name: 'Requester', company_id: '', is_active: true });
  const reqGrant = rt.ctx.createUserRoleAssignment({ user_id: 'u_req', role_id: 'r_req', company_id: 'co_1', ticket_type_id: 'tt_1' });
  assert.strictEqual(reqGrant.status, 'success', reqGrant.message);
  add('user_profiles', { user_id: 'u_admin', display_name: 'Ada Admin', email: 'ada@example.com', status: 'active', is_active: true });
  add('user_profiles', { user_id: 'u_req', display_name: 'Rita Requester', email: 'rita@example.com', status: 'active', is_active: true });
  add('user_profiles', { user_id: 'u_out', display_name: 'Otto Outsider', email: 'otto@example.com', status: 'active', is_active: true });
  add('user_profiles', { user_id: 'u_far', display_name: 'Fay Far', email: 'fay@example.com', status: 'active', is_active: true });
  rt.cache.clear();

  /** A request through the proxy as uid (with a verified email when given). */
  const as = (uid, body, email) => rt.post({ ...body, _proxy_secret: SECRET, _auth_uid: uid, ...(email ? { _auth_email: email } : {}) });
  const asGet = (uid, params, email) => rt.get({ ...params, _proxy_secret: SECRET, _auth_uid: uid, ...(email ? { _auth_email: email } : {}) });
  const ok = res => { assert.strictEqual(res.success, true, res.error); return res.data; };
  const createTicket = (uid = 'u_req') => String(ok(as(uid, { action: 'createTicket', title: 'Laptop', ticket_type_id: 'tt_1',
    requester_id: uid, company_id: 'co_1' })).id);
  const logs = [];
  rt.ctx.console.log = (...args) => logs.push(args.join(' '));
  return { rt, add, rows, as, asGet, ok, createTicket, logs };
}

// --- Admin-only routes (S1 part 3) ----------------------------------------------------------------------------

test('admin-only: a non-admin is refused (ADMIN_ONLY), an admin passes; the body user_id does not decide', () => {
  const { as, ok, rows } = seed();
  const refused = as('u_req', { action: 'createCompany', name: 'Evil', code: 'EVIL', user_id: 'u_admin' });
  assert.strictEqual(refused.success, false);
  assert.strictEqual(refused.code, 'ADMIN_ONLY');
  assert.match(refused.error, /Only admins can createCompany/);
  assert.ok(!rows('companies').some(c => c.code === 'EVIL'), 'nothing written');
  // a manager (approver, not admin) can't assign roles either
  assert.strictEqual(as('u_mgr', { action: 'assignUserRole', user_id: 'u_mgr', role_id: 'r_admin', company_id: 'co_1' }).code, 'ADMIN_ONLY');
  ok(as('u_admin', { action: 'createCompany', name: 'Second Co', code: 'SECO' }));
  assert.ok(rows('companies').some(c => c.code === 'SECO'));
});

test('admin-only: open routes stay open (tickets, tags, preferences, approvals)', () => {
  const { as, ok, createTicket } = seed();
  const id = createTicket();
  ok(as('u_req', { action: 'updateUserPreferences', preferences: { dark_mode: true } }));
  ok(as('u_mgr', { action: 'submitStepApproval', ticket_id: id, user_id: 'u_mgr', decision: 'approve', comment: 'ok' }));
});

test('every admin write leaves an admin log row: a generic one when the handler logs nothing', () => {
  const { rt, as, ok, rows } = seed();
  // a handler that writes without logging (most v9.x admin handlers log themselves)
  rt.ctx.setStepApprovers = (stepId, roleIds) => ({ status: 'success', data: { step_id: stepId, role_ids: roleIds } });
  const before = rows('admin_action_logs').length;
  ok(as('u_admin', { action: 'setStepApprovers', step_id: 'ws_1', role_ids: ['r_mgr', 'r_admin'] }));
  const added = rows('admin_action_logs').slice(before);
  assert.strictEqual(added.length, 1, JSON.stringify(added));
  assert.strictEqual(added[0].action_type, 'setStepApprovers');
  assert.strictEqual(added[0].admin_user_id, 'u_admin');
  assert.strictEqual(added[0].target_id, 'ws_1');
  const details = JSON.parse(added[0].details);
  lib.same(details.keys, ['role_ids', 'step_id']);
  assert.ok(!added[0].details.includes('r_admin'), 'keys only, not values');
  // a handler that logs itself gets no second row
  const n = rows('admin_action_logs').length;
  ok(as('u_admin', { action: 'createCompany', name: 'Third', code: 'THRD' }));
  assert.strictEqual(rows('admin_action_logs').slice(n).filter(r => r.action_type === 'createCompany').length, 0);
  assert.ok(rows('admin_action_logs').length > n);
  // a refused or failed call logs nothing
  const m = rows('admin_action_logs').length;
  rt.ctx.setStepApprovers = () => ({ status: 'error', message: 'role_ids must be an array' });
  as('u_admin', { action: 'setStepApprovers', step_id: 'ws_1', role_ids: 'not-an-array' });
  assert.strictEqual(rows('admin_action_logs').length, m);
});

test('logAdminAction writes by header (A1): a reordered tab still lands each value in its column', () => {
  const { rt, rows } = seed();
  const sheet = rt.sheets.get('admin_action_logs');
  sheet.rows = [['timestamp', 'details', 'target_id', 'target_entity', 'action_type', 'admin_user_id', 'id']];
  rt.ctx.logAdminAction('u_admin', 'TEST_ACTION', 'thing', 't_1', { a: 1 });
  const row = rows('admin_action_logs')[0];
  assert.strictEqual(row.action_type, 'TEST_ACTION');
  assert.strictEqual(row.admin_user_id, 'u_admin');
  assert.strictEqual(row.target_id, 't_1');
});

test('bootstrap: with no admin, a verified user may run admin routes (logged); closed once an admin exists', () => {
  const { as, ok, rows } = seed({ noAdmin: true });
  ok(as('u_first', { action: 'createCompany', name: 'Boot Co', code: 'BOOT' }));
  assert.ok(rows('admin_action_logs').some(r => r.action_type === 'ADMIN_BOOTSTRAP' && r.target_id === 'createCompany' && r.admin_user_id === 'u_first'));
  ok(as('u_first', { action: 'assignUserRole', user_id: 'u_first', role_id: 'r_admin', company_id: 'co_1' }));
  // closed now: another user is refused, and u_first (role-only) still gets in
  assert.strictEqual(as('u_other', { action: 'createCompany', name: 'Late', code: 'LATE' }).code, 'NOT_INVITED');
  assert.strictEqual(as('u_req', { action: 'createCompany', name: 'Late', code: 'LATE' }).code, 'ADMIN_ONLY');
  ok(as('u_first', { action: 'createCompany', name: 'Admin Co', code: 'ADCO' }));
});

test('warn mode: a non-admin admin call is logged and continues (rollout); off mode does not check', () => {
  const warn = seed({ mode: 'warn' });
  warn.ok(warn.as('u_req', { action: 'createCompany', name: 'Warned', code: 'WARN' }));
  assert.ok(warn.logs.some(l => /AUTH warn: createCompany by non-admin u_req/.test(l)), warn.logs.join('\n'));
  // unknown user in warn: logged, served
  warn.ok(warn.as('u_stranger', { action: 'getCompanies' }));
  assert.ok(warn.logs.some(l => /u_stranger - NOT_INVITED/.test(l)));
  const off = seed({ mode: 'off' });
  off.ok(off.rt.post({ action: 'createCompany', name: 'Off', code: 'OFFC' }));
});

// --- Sign-in allow-list + invites (plan §4.12) -------------------------------------------------------------

test('allow-list: profile passes, role-only passes, unknown user NOT_INVITED (GET and POST); ping always answers', () => {
  const { as, asGet, ok, rt } = seed();
  ok(asGet('u_req', { action: 'getCompanies' }));
  ok(asGet('u_mgr', { action: 'getCompanies' }));             // assignments, no profile row
  const refused = asGet('u_stranger', { action: 'getCompanies' }, 'stranger@example.com');
  assert.strictEqual(refused.code, 'NOT_INVITED');
  assert.match(refused.error, /Ask your administrator for an invite/);
  assert.strictEqual(as('u_stranger', { action: 'createTicket', title: 'x', ticket_type_id: 'tt_1', requester_id: 'u_stranger', company_id: 'co_1' }).code, 'NOT_INVITED');
  assert.strictEqual(as('u_stranger', { action: 'getTickets', _via_get: true }).code, 'NOT_INVITED');
  assert.strictEqual(asGet('u_stranger', { action: 'ping' }).success, true);
  assert.ok(rt.cache.get('allow:u_req') && !rt.cache.get('allow:u_stranger'));
});

test('allow-list cache: the second request reads no user_profiles; a deactivated profile is refused at once', () => {
  const { as, asGet, ok, rt } = seed();
  ok(asGet('u_req', { action: 'getCompanies' }));
  assert.ok(rt.reads().user_profiles >= 1, 'first request checks the profile');
  ok(asGet('u_req', { action: 'getCompanies' }));
  assert.strictEqual(rt.reads().user_profiles || 0, 0, JSON.stringify(rt.reads()));
  ok(as('u_admin', { action: 'updateUserProfile', user_id: 'u_req', status: 'inactive' }));
  const refused = asGet('u_req', { action: 'getCompanies' });
  assert.strictEqual(refused.code, 'ACCOUNT_DISABLED');
  // a removed role drops the cache too (role-only user)
  ok(asGet('u_mgr', { action: 'getCompanies' }));
  ok(as('u_admin', { action: 'removeUserRole', user_id: 'u_mgr', role_id: 'r_mgr', company_id: 'co_1' }));
  assert.strictEqual(asGet('u_mgr', { action: 'getCompanies' }).code, 'NOT_INVITED');
});

test('allow-list works without CacheService (editor / missing service)', () => {
  const rt = lib.makeRuntime(FILE, { properties: { AUTH_MODE: 'enforce', PROXY_SECRET: SECRET }, noCacheService: true });
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  rt.sheets.get('roles').appendRow(rt.ctx.rowFromRecord(S.roles, { id: 'r_admin', name: 'Admin', is_active: true }));
  rt.ctx.createUserRoleAssignment({ user_id: 'u_admin', role_id: 'r_admin', company_id: 'co_1' });
  assert.strictEqual(rt.get({ action: 'getCompanies', _proxy_secret: SECRET, _auth_uid: 'u_admin' }).success, true);
  assert.strictEqual(rt.get({ action: 'getCompanies', _proxy_secret: SECRET, _auth_uid: 'u_x' }).code, 'NOT_INVITED');
});

test('invite: created + emailed (company sender), accepted on the first verified sign-in with that email', () => {
  const { as, asGet, ok, rows, rt } = seed();
  ok(as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_1', email_sender_name: 'Main Co Helpdesk', email_reply_to: 'help@main.co' }));
  const invite = ok(as('u_admin', { action: 'createUserInvite', email: 'New.Person@Example.com', display_name: 'New Person', company_id: 'co_1',
    role_grants: [{ role_id: 'r_mgr' }], immediate_approver_id: 'u_mgr' }));
  assert.strictEqual(invite.status, 'pending');
  assert.strictEqual(invite.email, 'new.person@example.com');
  assert.strictEqual(invite.email_status, 'sent');
  const mail = rt.mail.sent.pop();
  assert.strictEqual(mail.to, 'new.person@example.com');
  assert.strictEqual(mail.name, 'Main Co Helpdesk');
  assert.strictEqual(mail.replyTo, 'help@main.co');
  assert.match(mail.body, /jarvis-by-erp\.vercel\.app/);
  assert.ok(!/token|code=/i.test(mail.body.replace('No password or link code is needed', '')), 'no token in the link');
  assert.ok(rows('admin_action_logs').some(r => r.action_type === 'INVITE_CREATED'));

  const list = ok(asGet('u_admin', { action: 'getUserInvites' }));
  assert.strictEqual(list.length, 1);
  assert.strictEqual(asGet('u_req', { action: 'getUserInvites' }).success, false, 'admins only');

  // first sign-in: profile + role written with the real uid, invite accepted, request served
  const first = asGet('u_new', { action: 'getCompanies' }, 'new.person@example.com');
  assert.strictEqual(first.success, true, first.error);
  const profile = rows('user_profiles').find(p => p.user_id === 'u_new');
  assert.ok(profile && profile.display_name === 'New Person' && profile.immediate_approver_id === 'u_mgr');
  assert.ok(rows('user_role_assignments').some(a => a.user_id === 'u_new' && a.role_id === 'r_mgr' && a.company_id === 'co_1'));
  const accepted = rows('user_invites')[0];
  assert.strictEqual(accepted.status, 'accepted');
  assert.strictEqual(accepted.accepted_uid, 'u_new');
  assert.ok(rows('admin_action_logs').some(r => r.action_type === 'INVITE_ACCEPTED'));
  // second request: from the cache, no tab reads for the allow-list
  ok(asGet('u_new', { action: 'getCompanies' }, 'new.person@example.com'));
  const reads = rt.reads();
  assert.strictEqual((reads.user_profiles || 0) + (reads.user_invites || 0), 0, JSON.stringify(reads));
  // the same invite can't be used twice by another account
  assert.strictEqual(asGet('u_new2', { action: 'getCompanies' }, 'new.person@example.com').code, 'NOT_INVITED');
});

test('invite refused: expired, revoked, wrong email, no verified email; duplicates and existing users', () => {
  const { as, asGet, ok, rt } = seed();
  const a = ok(as('u_admin', { action: 'createUserInvite', email: 'a@example.com', company_id: 'co_1', send_email: false }));
  assert.strictEqual(a.email_status, 'not_sent');
  assert.match(as('u_admin', { action: 'createUserInvite', email: 'a@example.com', company_id: 'co_1' }).error, /already has a pending invite/);
  assert.match(as('u_admin', { action: 'createUserInvite', email: 'rita@example.com', company_id: 'co_1' }).error, /already has a user profile/);
  assert.match(as('u_admin', { action: 'createUserInvite', email: 'not-an-email', company_id: 'co_1' }).error, /valid email/);
  assert.match(as('u_admin', { action: 'createUserInvite', email: 'z@example.com', company_id: 'co_1', role_grants: [{ role_id: 'r_nope' }] }).error, /Role r_nope not found/);

  assert.strictEqual(asGet('u_b', { action: 'getCompanies' }, 'b@example.com').code, 'NOT_INVITED', 'wrong email');
  assert.strictEqual(asGet('u_a', { action: 'getCompanies' }).code, 'NOT_INVITED', 'no verified email forwarded');
  rt.ctx.updateRecordFields('user_invites', a.id, { expires_at: new Date(Date.now() - 1000) });
  assert.strictEqual(asGet('u_a', { action: 'getCompanies' }, 'a@example.com').code, 'NOT_INVITED', 'expired');
  assert.strictEqual(ok(asGet('u_admin', { action: 'getUserInvites', status: 'expired' })).length, 1);
  // resend gives it 14 more days; revoke ends it
  const resent = ok(as('u_admin', { action: 'resendUserInvite', invite_id: a.id }));
  assert.strictEqual(resent.status, 'pending');
  assert.ok(new Date(resent.expires_at) > new Date(Date.now() + 13 * 24 * 3600 * 1000));
  ok(as('u_admin', { action: 'revokeUserInvite', invite_id: a.id, reason: 'left' }));
  assert.strictEqual(asGet('u_a', { action: 'getCompanies' }, 'a@example.com').code, 'NOT_INVITED', 'revoked');
  assert.match(as('u_admin', { action: 'resendUserInvite', invite_id: a.id }).error, /revoked/);
  assert.strictEqual(as('u_req', { action: 'createUserInvite', email: 'q@example.com', company_id: 'co_1' }).code, 'ADMIN_ONLY');
});

test('identity fields (_auth_email too) are stripped and never stored', () => {
  const { as, ok, rt } = seed();
  ok(as('u_req', { action: 'createTicket', title: 'T', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_1', _auth_email: 'x@evil.com' }));
  const all = JSON.stringify([...rt.sheets.values()].map(s => s.trimmed()));
  assert.ok(!all.includes('x@evil.com') && !all.includes('_auth_email') && !all.includes('_proxy_secret'));
});

// --- Attachment links + broken-link reports (plan §4.13) ---------------------------------------------------

test('links: requester adds (http(s) only), anyone lists, outsider cannot add or remove, requester removes (soft)', () => {
  const { as, asGet, ok, rows, createTicket } = seed();
  const id = createTicket();
  const link = ok(as('u_req', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: 'https://drive.example.com/q.pdf', file_name: 'Quote' }));
  assert.strictEqual(link.file_type, 'link');
  assert.strictEqual(link.link_status, 'ok');
  ['javascript:alert(1)', 'ftp://x/y', 'drive.example.com/q', ''].forEach(url =>
    assert.strictEqual(as('u_req', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: url, file_name: 'x' }).success, false, url));
  assert.match(as('u_out', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: 'https://x.example.com', file_name: 'x' }).error, /Only the requester/);
  ok(as('u_mgr', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: 'http://intranet.example.com/a', file_name: 'Approver link' }));
  const seen = ok(asGet('u_out', { action: 'getTicketAttachments', ticket_id: id }));
  assert.strictEqual(seen.attachments.length, 2);
  assert.strictEqual(seen.can_manage, false);
  assert.strictEqual(ok(asGet('u_req', { action: 'getTicketAttachments', ticket_id: id })).can_manage, true);
  assert.match(as('u_out', { action: 'removeTicketAttachment', attachment_id: link.id }).error, /Only the requester/);
  // review: someone with no role in the ticket's company can't read or report its links
  // v10.0: a ticket you can't see answers "Ticket not found"
  assert.match(asGet('u_far', { action: 'getTicketAttachments', ticket_id: id }).error, /can't see this ticket|not found/);
  assert.match(as('u_far', { action: 'reportAttachmentLinkBroken', attachment_id: link.id, note: 'x' }).error, /can't see this ticket|not found/);
  ok(as('u_req', { action: 'removeTicketAttachment', attachment_id: link.id, reason: 'wrong file' }));
  assert.strictEqual(ok(asGet('u_req', { action: 'getTicketAttachments', ticket_id: id })).attachments.length, 1);
  const removed = rows('ticket_attachments').find(a => a.id === link.id);
  assert.strictEqual(String(removed.is_active).toUpperCase(), 'FALSE');
  assert.ok(rows('ticket_history').some(h => h.action === 'LINK_ADDED') && rows('ticket_history').some(h => h.action === 'LINK_REMOVED'));
});

test('broken link: viewer reports (bell to adder + requester), edit refused while ok, approver fixes in place, report cleared', () => {
  const { as, ok, rows, createTicket } = seed();
  const id = createTicket();
  const link = ok(as('u_mgr', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: 'https://old.example.com/a', file_name: 'Spec' }));
  assert.match(as('u_mgr', { action: 'updateAttachmentLink', attachment_id: link.id, file_url: 'https://new.example.com/a' }).error, /Only a link reported broken/);
  const reported = ok(as('u_out', { action: 'reportAttachmentLinkBroken', attachment_id: link.id, note: '404' }));
  assert.strictEqual(reported.link_status, 'reported_broken');
  assert.strictEqual(reported.reported_by, 'u_out');
  const bells = rows('notifications').filter(n => n.type === 'link_reported');
  lib.same(bells.map(n => n.user_id).sort(), ['u_mgr', 'u_req']);
  ok(as('u_out', { action: 'reportAttachmentLinkBroken', attachment_id: link.id, note: 'still 404' }));
  assert.strictEqual(rows('notifications').filter(n => n.type === 'link_reported').length, 2, 'a second report only updates the note');
  assert.match(as('u_out', { action: 'updateAttachmentLink', attachment_id: link.id, file_url: 'https://new.example.com/a' }).error, /Only the requester/);
  assert.match(as('u_mgr', { action: 'updateAttachmentLink', attachment_id: link.id, file_url: 'mailto:x@y.z' }).error, /http/);
  const fixed = ok(as('u_mgr', { action: 'updateAttachmentLink', attachment_id: link.id, file_url: 'https://new.example.com/a', file_name: 'Spec v2' }));
  assert.strictEqual(fixed.link_status, 'ok');
  assert.strictEqual(fixed.report_note, '');
  assert.strictEqual(fixed.id, link.id, 'in place');
  assert.strictEqual(rows('ticket_attachments').filter(a => String(a.ticket_id) === id).length, 1);
  const log = rows('ticket_action_logs').find(l => l.action_type === 'LINK_FIXED');
  const changes = JSON.parse(log.details).changes;
  lib.same(changes.find(c => c.field === 'file_url'), { field: 'file_url', from: 'https://old.example.com/a', to: 'https://new.example.com/a' });
  assert.ok(changes.some(c => c.field === 'file_name' && c.to === 'Spec v2'));
  assert.ok(rows('ticket_history').some(h => h.action === 'LINK_FIXED'));
});

test('closed ticket: fixing a reported link is allowed and logged; adding is admin-only', () => {
  const { as, ok, rows, createTicket } = seed();
  const id = createTicket();
  const link = ok(as('u_req', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: 'https://a.example.com', file_name: 'A' }));
  ok(as('u_req', { action: 'updateTicketStatus', id, status: 'cancelled', comment: 'not needed' }));
  assert.match(as('u_req', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: 'https://b.example.com', file_name: 'B' }).error, /closed/);
  ok(as('u_admin', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: 'https://b.example.com', file_name: 'B' }));
  ok(as('u_out', { action: 'reportAttachmentLinkBroken', attachment_id: link.id }));
  ok(as('u_req', { action: 'updateAttachmentLink', attachment_id: link.id, file_url: 'https://a2.example.com', file_name: 'A' }));
  const log = rows('ticket_action_logs').find(l => l.action_type === 'LINK_FIXED');
  assert.strictEqual(JSON.parse(log.details).closed_ticket, true);
});

// --- Company email settings -------------------------------------------------------------------------------

test('company email settings: validation, save, test email with name / Reply-To / CC / footer', () => {
  const { as, asGet, ok, rt } = seed();
  assert.match(as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_1', email_enabled: 'maybe' }).error, /default, on or off/);
  assert.match(as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_1', email_reply_to: 'a@b.c, d@e.f' }).error, /one email/);
  assert.match(as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_1', email_cc: 'a@b.co, nope' }).error, /"nope"/);
  assert.match(as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_1', email_sender_name: 'Bad\nName' }).error, /Sender name/);
  assert.strictEqual(as('u_req', { action: 'saveCompanyEmailSettings', company_id: 'co_1', email_enabled: 'on' }).code, 'ADMIN_ONLY');
  const saved = ok(as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_1', email_enabled: 'on', email_sender_name: 'Main Co',
    email_reply_to: 'Help@Main.co', email_cc: 'audit@main.co; boss@main.co', email_footer: 'Main Co, Makati' }));
  assert.strictEqual(saved.email_reply_to, 'help@main.co');
  assert.strictEqual(saved.email_cc, 'audit@main.co, boss@main.co');
  const read = ok(asGet('u_admin', { action: 'getCompanyEmailSettings', company_id: 'co_1' }));
  assert.strictEqual(read.email_enabled, 'on');
  assert.strictEqual(asGet('u_req', { action: 'getCompanyEmailSettings', company_id: 'co_1' }).success, false);

  const sent = ok(as('u_admin', { action: 'sendCompanyTestEmail', company_id: 'co_1' }, 'ada@example.com'));
  assert.strictEqual(sent.to, 'ada@example.com');
  const mail = rt.mail.sent.pop();
  assert.strictEqual(mail.name, 'Main Co');
  assert.strictEqual(mail.replyTo, 'help@main.co');
  assert.strictEqual(mail.cc, 'audit@main.co,boss@main.co');
  assert.match(mail.body, /--\nMain Co, Makati$/);
  rt.mail.quota = 5;
  assert.match(as('u_admin', { action: 'sendCompanyTestEmail', company_id: 'co_1', to: 'x@example.com' }).error, /quota/);
});

test('SLA email: company on overrides the type default (global off) and uses the sender settings; company off wins over type on', () => {
  const env = seed();
  const { rt, as, ok, add } = env;
  add('user_profiles', { user_id: 'u_mgr', display_name: 'Mia', email: 'mia@example.com', is_active: true });
  ok(as('u_admin', { action: 'createSLAEscalationRule', company_id: 'co_1', ticket_type_id: 'tt_1', level: 1, trigger: 'percent_elapsed',
    trigger_value: 50, notify_current_approvers: true }));
  const id = env.createTicket();
  rt.ctx.updateRecordFields('tickets', id, { step_started_at: new Date('2027-03-01T00:00:00Z'), step_due_date: new Date('2027-03-01T10:00:00Z') });
  rt.ctx.updateRecordFields('companies', 'co_1', { email_enabled: 'on', email_sender_name: 'Main Co SLA', email_reply_to: 'sla@main.co', email_footer: 'Footer' });
  rt.ctx.runSLAEscalations({ now: '2027-03-01T05:01:00Z' });
  assert.strictEqual(rt.mail.sent.length, 1);
  assert.strictEqual(rt.mail.sent[0].to, 'mia@example.com');
  assert.strictEqual(rt.mail.sent[0].name, 'Main Co SLA');
  assert.strictEqual(rt.mail.sent[0].replyTo, 'sla@main.co');
  assert.match(rt.mail.sent[0].body, /Footer$/);
  assert.ok(env.rows('notifications').some(n => n.user_id === 'u_mgr' && n.email_status === 'sent'));

  const off = seed();
  off.add('user_profiles', { user_id: 'u_mgr', display_name: 'Mia', email: 'mia@example.com', is_active: true });
  off.ok(off.as('u_admin', { action: 'createSLAEscalationRule', company_id: 'co_1', ticket_type_id: 'tt_1', level: 1, trigger: 'percent_elapsed',
    trigger_value: 50, notify_current_approvers: true }));
  const id2 = off.createTicket();
  off.rt.ctx.updateRecordFields('tickets', id2, { step_started_at: new Date('2027-03-01T00:00:00Z'), step_due_date: new Date('2027-03-01T10:00:00Z') });
  off.rt.ctx.updateRecordFields('ticket_types', 'tt_1', { sla_email: 'on' });
  off.rt.ctx.updateRecordFields('companies', 'co_1', { email_enabled: 'off' });
  off.rt.ctx.runSLAEscalations({ now: '2027-03-01T05:01:00Z' });
  assert.strictEqual(off.rt.mail.sent.length, 0);
});

// --- Preferences on actorId, schema, version ----------------------------------------------------------------

test('preferences act on the verified user, whatever user_id says (A15)', () => {
  const { as, asGet, ok, rows } = seed();
  ok(as('u_req', { action: 'updateUserPreferences', user_id: 'u_admin', preferences: { language: 'fil' } }));
  const stored = rows('user_preferences');
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].user_id, 'u_req');
  const read = ok(asGet('u_req', { action: 'getUserPreferences', user_id: 'u_admin' }));
  assert.strictEqual(read.user_id, 'u_req');
  assert.strictEqual(read.language, 'fil');
});

test('schema: user_invites tab, 4 link columns, 5 company email columns with defaults; rebuild apply is clean', () => {
  const { rt } = seed();
  const S = rt.ctx.__TABLE_SCHEMAS;
  assert.ok(S.user_invites.includes('role_grants') && S.user_invites.includes('accepted_uid'));
  lib.same(S.ticket_attachments.slice(-4), ['link_status', 'reported_by', 'reported_at', 'report_note']);
  lib.same(S.companies.slice(-5), ['email_enabled', 'email_sender_name', 'email_reply_to', 'email_cc', 'email_footer']);
  // an old companies tab gets email_enabled = default on rebuild
  const old = lib.makeRuntime(FILE, {});
  old.table('companies', S.companies.slice(0, -5), [['co_9', 'Old', 'OLD']]);
  old.ctx.rebuildAllTablesApply();
  assert.strictEqual(old.ctx.readTable('companies').records[0].email_enabled, 'default');
  assert.strictEqual(old.ctx.rebuildAllTables(true).repaired.length, 0);
});

test('every ADMIN_ONLY action is routed in doPost; ping reports 9.6.0 = header Version', () => {
  const { rt } = seed();
  const src = fs.readFileSync(FILE, 'utf8');
  const route = src.slice(src.indexOf('function routePostAction('), src.indexOf('function doOptions('));
  const missing = require('vm').runInContext('ADMIN_ONLY_ACTIONS', rt.ctx).filter(a => !route.includes(`case '${a}':`));
  lib.same(missing, []);
  const header = src.match(/\* Version: (\d+\.\d+)/)[1];
  assert.strictEqual(rt.get({ action: 'ping' }).version, `${header}.0`);
  assert.ok(rt.get({ action: 'ping' }).version.localeCompare('9.6.0', undefined, { numeric: true }) >= 0);
});

// --- Review fixes (docs/planning/TODO_CodeReview_20261031.md) ------------------------------------------------

test('review: a parallel first-sign-in request that lost the race is let in, not NOT_INVITED', () => {
  const { as, asGet, ok, rt, rows } = seed();
  ok(as('u_admin', { action: 'createUserInvite', email: 'race@example.com', company_id: 'co_1', role_grants: [{ role_id: 'r_mgr' }], send_email: false }));
  const S = rt.ctx.__TABLE_SCHEMAS;
  const original = rt.ctx.withScriptLock;
  let simulated = false;
  rt.ctx.withScriptLock = (fn, timeout) => {
    if (!simulated) {
      // the other request of the same sign-in got the lock first and accepted the invite (raw writes: another execution)
      simulated = true;
      const invites = rt.sheets.get('user_invites');
      const header = invites.rows[0];
      invites.rows[1][header.indexOf('status')] = 'accepted';
      invites.dirty = true;
      rt.sheets.get('user_profiles').appendRow(rt.ctx.rowFromRecord(S.user_profiles, { user_id: 'u_race', email: 'race@example.com', status: 'active', is_active: true }));
    }
    return original(fn, timeout);
  };
  const res = asGet('u_race', { action: 'getCompanies' }, 'race@example.com');
  assert.strictEqual(res.success, true, res.error);
  assert.strictEqual(rows('user_profiles').filter(p => p.user_id === 'u_race').length, 1, 'not accepted twice');
});

test('review: handler codes reach the top level (ADMIN_ONLY on an admin read)', () => {
  const { asGet } = seed();
  const res = asGet('u_req', { action: 'getUserInvites' });
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.code, 'ADMIN_ONLY');
});

test('review: before the v9.6 rebuild, company email and link reports refuse (SCHEMA_OUTDATED) instead of pretending', () => {
  const { as, ok, rt, createTicket } = seed();
  const id = createTicket();
  const link = ok(as('u_req', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: 'https://a.example.com', file_name: 'A' }));
  const S = rt.ctx.__TABLE_SCHEMAS;
  const drop = (name, n) => { const sh = rt.sheets.get(name); sh.rows = sh.rows.map(r => r.slice(0, S[name].length - n)); sh.dirty = true; };
  drop('companies', 5);
  drop('ticket_attachments', 4);
  const email = as('u_admin', { action: 'saveCompanyEmailSettings', company_id: 'co_1', email_enabled: 'on' });
  assert.strictEqual(email.code, 'SCHEMA_OUTDATED');
  assert.match(email.error, /Repair tables/);
  assert.strictEqual(as('u_out', { action: 'reportAttachmentLinkBroken', attachment_id: link.id }).code, 'SCHEMA_OUTDATED');
});

test('review: resend refuses when a newer pending invite or a profile exists for the email', () => {
  const { as, ok, rt, add } = seed();
  const a = ok(as('u_admin', { action: 'createUserInvite', email: 'dup@example.com', company_id: 'co_1', send_email: false }));
  rt.ctx.updateRecordFields('user_invites', a.id, { expires_at: new Date(Date.now() - 1000) });
  ok(as('u_admin', { action: 'createUserInvite', email: 'dup@example.com', company_id: 'co_1', send_email: false }));
  assert.match(as('u_admin', { action: 'resendUserInvite', invite_id: a.id }).error, /newer pending invite/);
  const c = ok(as('u_admin', { action: 'createUserInvite', email: 'joined@example.com', company_id: 'co_1', send_email: false }));
  add('user_profiles', { user_id: 'u_joined', email: 'joined@example.com', status: 'active', is_active: true });
  assert.match(as('u_admin', { action: 'resendUserInvite', invite_id: c.id }).error, /already has a user profile/);
});

report();
