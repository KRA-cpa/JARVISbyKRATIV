// Usage: node appscript_files/tools/ROUTES_TEST_v9.7.js appscript_files/APPSCRIPT_v9.7_<YYYYMMDD>_<HHMM>.txt
// Offline tests for APPSCRIPT v9.7 (attachment link rules: allowed hosts - Script Property LINK_ALLOWED_HOSTS, default
// docs.google.com,drive.google.com, https, exact host - and the required link name), AUTH_MODE enforce.
// Run the older suites on the same file too (ROUTES_TEST_v9.6.js ... v8.3, with TZ=Asia/Manila).
const assert = require('assert');
const lib = require('./lib/fakeSheetsRuntime');

const FILE = process.argv[2];
if (!FILE) {
  console.error('Usage: node ROUTES_TEST_v9.7.js <APPSCRIPT file>');
  process.exit(2);
}
const { test, report } = lib.makeTestRunner();
const SECRET = 's';

/** co_1, tt_1 (step ws_1, approvers Manager); u_req (profile) is the requester; u_admin is admin. */
function seed(properties = {}) {
  const rt = lib.makeRuntime(FILE, { properties: { AUTH_MODE: 'enforce', PROXY_SECRET: SECRET, ...properties } });
  rt.ctx.rebuildAllTablesApply();
  const S = rt.ctx.__TABLE_SCHEMAS;
  const add = (t, r) => rt.sheets.get(t).appendRow(rt.ctx.rowFromRecord(S[t], r));
  add('companies', { id: 'co_1', name: 'Main Co', code: 'MYCO', is_active: true });
  add('ticket_types', { id: 'tt_1', code: 'PR', name: 'Purchase', is_active: true });
  add('roles', { id: 'r_mgr', name: 'Manager', is_active: true });
  add('roles', { id: 'r_admin', name: 'System Admin', is_active: true });
  add('workflow_steps', { id: 'ws_1', ticket_type_id: 'tt_1', company_id: 'co_1', name: 'Managers', status_on_reach: 'Pending',
    step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true });
  add('step_approvers', { step_id: 'ws_1', role_id: 'r_mgr' });
  rt.ctx.createUserRoleAssignment({ user_id: 'u_admin', role_id: 'r_admin', company_id: 'co_1' });
  add('user_profiles', { user_id: 'u_req', display_name: 'Rita', email: 'rita@example.com', status: 'active', is_active: true });
  const as = (uid, body) => rt.post({ ...body, _proxy_secret: SECRET, _auth_uid: uid });
  const asGet = (uid, params) => rt.get({ ...params, _proxy_secret: SECRET, _auth_uid: uid });
  const ok = res => { assert.strictEqual(res.success, true, res.error); return res.data; };
  const id = String(ok(as('u_req', { action: 'createTicket', title: 'T', ticket_type_id: 'tt_1', requester_id: 'u_req', company_id: 'co_1' })).id);
  const addLink = (url, name = 'Doc') => as('u_req', { action: 'addTicketAttachmentLink', ticket_id: id, file_url: url, file_name: name });
  return { rt, add, as, asGet, ok, id, addLink };
}

test('default: https docs.google.com and drive.google.com are accepted (host case-insensitive, :443 ok)', () => {
  const { addLink, ok } = seed();
  ['https://docs.google.com/document/d/abc/edit', 'https://drive.google.com/file/d/xyz/view?usp=sharing',
    'https://DOCS.GOOGLE.COM/spreadsheets/d/1', 'https://docs.google.com:443/presentation/d/2', 'https://drive.google.com']
    .forEach(url => ok(addLink(url)));
});

test('default: other hosts, http and lookalikes are refused', () => {
  const { addLink } = seed();
  ['https://evil.com/docs.google.com', 'https://docs.google.com.evil.com/x', 'https://docs.google.com@evil.com/x',
    'https://evil.com?u=https://docs.google.com', 'http://docs.google.com/document/d/abc', 'https://sites.google.com/x',
    'https://google.com/docs', 'https://docs.google.com:8443/x', 'javascript:alert(1)', 'https:// docs.google.com/x']
    .forEach(url => {
      const res = addLink(url);
      assert.strictEqual(res.success, false, url);
    });
  assert.match(addLink('https://evil.com/x').error, /Only links to docs\.google\.com, drive\.google\.com can be added/);
});

test('LINK_ALLOWED_HOSTS changes the list without a redeploy; * = any http(s) host (the v9.6 rule)', () => {
  const custom = seed({ LINK_ALLOWED_HOSTS: 'docs.google.com, sharepoint.example.com' });
  custom.ok(custom.addLink('https://sharepoint.example.com/sites/a'));
  assert.strictEqual(custom.addLink('https://drive.google.com/file/d/x').success, false, 'drive not in the custom list');
  const any = seed({ LINK_ALLOWED_HOSTS: '*' });
  any.ok(any.addLink('http://intranet.example.com/a'));
  assert.strictEqual(any.addLink('ftp://x/y').success, false);
});

test('the link name is required on add and on fix (blank / spaces refused, trimmed)', () => {
  const { addLink, as, ok } = seed();
  assert.match(addLink('https://docs.google.com/d/1', '').error, /name is required/);
  assert.match(addLink('https://docs.google.com/d/1', '   ').error, /name is required/);
  const link = ok(addLink('https://docs.google.com/d/1', '  Quote  '));
  assert.strictEqual(link.file_name, 'Quote');
  ok(as('u_req', { action: 'reportAttachmentLinkBroken', attachment_id: link.id, note: '404' }));
  assert.match(as('u_req', { action: 'updateAttachmentLink', attachment_id: link.id, file_url: 'https://docs.google.com/d/2', file_name: ' ' }).error, /name is required/);
  assert.match(as('u_req', { action: 'updateAttachmentLink', attachment_id: link.id, file_url: 'https://evil.com/d/2', file_name: 'Quote' }).error, /Only links to/);
  const fixed = ok(as('u_req', { action: 'updateAttachmentLink', attachment_id: link.id, file_url: 'https://drive.google.com/file/d/2', file_name: 'Quote v2' }));
  assert.strictEqual(fixed.file_name, 'Quote v2');
  assert.strictEqual(fixed.link_status, 'ok');
});

test('a link saved before on another host is listed with link_allowed: false (shown as plain text)', () => {
  const { add, asGet, ok, id, addLink } = seed();
  add('ticket_attachments', { id: 'att_old', ticket_id: id, uploader_id: 'u_req', file_name: 'Old', file_url: 'https://old.example.com/a',
    file_type: 'link', company_id: 'co_1', is_active: true, link_status: 'ok', created_at: new Date().toISOString() });
  ok(addLink('https://docs.google.com/d/1'));
  const list = ok(asGet('u_req', { action: 'getTicketAttachments', ticket_id: id })).attachments;
  assert.strictEqual(list.find(a => a.id === 'att_old').link_allowed, false);
  assert.strictEqual(list.find(a => a.id !== 'att_old').link_allowed, true);
});

test('ping reports 9.7.0', () => {
  const { rt } = seed();
  assert.strictEqual(rt.get({ action: 'ping' }).version, '9.7.0');
});

report();
