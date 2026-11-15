/**
 * api/_lib/handlers/privacy.js - privacy actions on Postgres (15 Nov 2026, session 461f9ea9;
 * docs/planning/CHECK_PrivacyCompliance_20261115.md #10 / #11 / #12). Live when /api/rpc has DATABASE_URL (migration
 * Phase 4); until then every call falls through to Apps Script, which doesn't know them, and the frontend falls back.
 *
 * Rules: the acting user comes from the verified session only (ctx.user - compliance A15); company-scoped actions check
 * the actor's admin roles in that company on the server (the same rule as Apps Script isAdminUser: an active role whose
 * name contains "admin"; an admin assignment without company_id = every company); writes run in one transaction.
 *
 * Actions (query count / indexes):
 *   getMyPrivacyStatus          1 read  - idx_privacy_acknowledgements_user
 *   acknowledgePrivacyNotice    1 write - uq_privacy_acknowledgements_user_version (upsert)
 *   getOrgTermsStatus           2 reads - user_role_assignments by user + idx_contract_acceptances_company
 *   acceptOrgTerms              2 reads + 2 writes (transaction)
 *   exportMyData                4 reads - user_profiles / user_preferences pk, assignments by user, notifications by
 *                               user, tickets by requester (each capped at EXPORT_LIMIT rows)
 *   anonymizeUser               2 reads + 5 writes (transaction)
 * The user_role_assignments.user_id / notifications.user_id / tickets.requester_id lookups use the 0001 indexes
 * (docs/perf/EXPLAIN_HotPaths_<date>.md covers the hot paths).
 */

const crypto = require('crypto');
const { requireUser, badRequest, forbidden, notFound } = require('../rpcErrors');

const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,39}$/;
const DOCUMENTS = ['terms', 'dpa'];
const EXPORT_LIMIT = 500;
const REASON_MAX = 500;

const iso = value => (value instanceof Date ? value.toISOString() : value == null ? null : String(value));

function requireVersion(value, field = 'version') {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!VERSION_RE.test(v)) throw badRequest(`${field} must be 1-40 letters, digits, dots, dashes or spaces`);
  return v;
}

function requireId(value, field) {
  const v = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (!v || v.length > 200) throw badRequest(`${field} is required`);
  return v;
}

/**
 * The companies where the user is an admin today. One query.
 * @returns {{ global: boolean, ids: Set<string> }} global = an admin assignment with no company (every company)
 */
async function adminScope(db, userId, now) {
  const { rows } = await db.query(
    'select distinct a.company_id from user_role_assignments a join roles r on r.id = a.role_id ' +
    'where a.user_id = $1 and coalesce(a.is_active, true) and coalesce(r.is_active, true) ' +
    "and lower(coalesce(r.name, '')) like '%admin%' and a.deleted_at is null and a.deactivated_at is null " +
    'and (a.effective_start_date is null or a.effective_start_date <= $2) ' +
    'and (a.effective_end_date is null or a.effective_end_date > $2) ' +
    'and (a.validity_end_date is null or a.validity_end_date > $2)',
    [userId, now]
  );
  const ids = new Set(rows.filter(r => r.company_id != null).map(r => String(r.company_id)));
  return { global: rows.some(r => r.company_id == null), ids };
}

const isAdminOf = (scope, companyId) => scope.global || scope.ids.has(String(companyId));

/** "Deleted user #1a2b3c4d" - stable per user, reveals nothing about the person. */
const anonymousName = userId => `Deleted user #${crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 8)}`;

module.exports = {
  /** The Privacy Policy version this user last acknowledged. @returns {{ version: string|null, acknowledged_at: string|null }} */
  async getMyPrivacyStatus(payload, ctx) {
    const user = requireUser(ctx);
    const { rows } = await ctx.db.query(
      'select version, acknowledged_at from privacy_acknowledgements where user_id = $1 order by acknowledged_at desc limit 1',
      [user.id]
    );
    return { version: rows[0] ? rows[0].version : null, acknowledged_at: rows[0] ? iso(rows[0].acknowledged_at) : null };
  },

  /** Record that the user saw and acknowledged this Privacy Policy version (idempotent per version). */
  async acknowledgePrivacyNotice(payload, ctx) {
    const user = requireUser(ctx);
    const version = requireVersion(payload.version);
    const { rows } = await ctx.db.query(
      'insert into privacy_acknowledgements (user_id, version, acknowledged_at) values ($1, $2, $3) ' +
      'on conflict (user_id, version) do update set version = excluded.version returning version, acknowledged_at',
      [user.id, version, ctx.now]
    );
    return { version: rows[0].version, acknowledged_at: iso(rows[0].acknowledged_at) };
  },

  /** The latest acceptance of each document for a company (admins of that company). */
  async getOrgTermsStatus(payload, ctx) {
    const user = requireUser(ctx);
    const companyId = requireId(payload.company_id, 'company_id');
    if (!isAdminOf(await adminScope(ctx.db, user.id, ctx.now), companyId)) throw forbidden('Only an administrator of this organization can see this');
    const { rows } = await ctx.db.query(
      'select distinct on (document) document, version, accepted_by, accepted_by_email, accepted_at ' +
      'from contract_acceptances where company_id = $1 order by document, accepted_at desc',
      [companyId]
    );
    const byDoc = Object.fromEntries(rows.map(r => [r.document, {
      version: r.version, accepted_by: r.accepted_by, accepted_by_email: r.accepted_by_email, accepted_at: iso(r.accepted_at)
    }]));
    return { company_id: companyId, terms: byDoc.terms || null, dpa: byDoc.dpa || null };
  },

  /**
   * An organization admin accepts the General Terms and / or the DPA for a company.
   * payload: { company_id, documents: [{ document: 'terms' | 'dpa', version }] }
   */
  async acceptOrgTerms(payload, ctx) {
    const user = requireUser(ctx);
    const companyId = requireId(payload.company_id, 'company_id');
    const docs = Array.isArray(payload.documents) ? payload.documents : [];
    if (docs.length === 0 || docs.length > DOCUMENTS.length) throw badRequest('documents: one entry per document (terms, dpa)');
    const clean = docs.map(d => {
      if (!d || !DOCUMENTS.includes(d.document)) throw badRequest("document must be 'terms' or 'dpa'");
      return { document: d.document, version: requireVersion(d.version, `${d.document} version`) };
    });
    if (new Set(clean.map(d => d.document)).size !== clean.length) throw badRequest('each document only once');
    if (!isAdminOf(await adminScope(ctx.db, user.id, ctx.now), companyId)) throw forbidden('Only an administrator of this organization can accept for it');
    const company = await ctx.db.query('select id from companies where id = $1', [companyId]);
    if (!company.rows[0]) throw notFound('Company not found');

    return ctx.db.transaction(async tx => {
      const values = [];
      const params = [companyId, user.id, user.email, ctx.now];
      clean.forEach(d => {
        params.push(d.document, d.version);
        values.push(`($1, $${params.length - 1}, $${params.length}, $2, $3, $4)`);
      });
      await tx.query(
        `insert into contract_acceptances (company_id, document, version, accepted_by, accepted_by_email, accepted_at) values ${values.join(', ')}`,
        params
      );
      await tx.query(
        'insert into admin_action_logs (id, admin_user_id, action_type, target_entity, target_id, details, timestamp) ' +
        "values (gen_random_uuid()::text, $1, 'ACCEPT_ORG_TERMS', 'company', $2, $3, $4)",
        [user.id, companyId, JSON.stringify({ documents: clean }), ctx.now]
      );
      return { company_id: companyId, accepted: clean, accepted_at: iso(ctx.now) };
    });
  },

  /**
   * "Download my data": the caller's own profile, preferences, privacy acknowledgements, role assignments, notifications
   * and the tickets they requested (each list capped at EXPORT_LIMIT, newest first; `truncated` says so). Other people's
   * data and ticket contents beyond the caller's own tickets go through the organization (rights guide §3).
   */
  async exportMyData(payload, ctx) {
    const user = requireUser(ctx);
    const own = await ctx.db.query(
      'select (select row_to_json(p) from user_profiles p where p.user_id = $1) as profile, ' +
      '(select row_to_json(x) from user_preferences x where x.user_id = $1) as preferences, ' +
      "(select coalesce(json_agg(json_build_object('version', a.version, 'acknowledged_at', a.acknowledged_at) " +
      "order by a.acknowledged_at), '[]'::json) from privacy_acknowledgements a where a.user_id = $1) as privacy_acknowledgements",
      [user.id]
    );
    const roles = await ctx.db.query(
      'select a.company_id, a.role_id, r.name as role_name, a.ticket_type_id, a.is_active, a.effective_start_date, ' +
      'a.effective_end_date, a.validity_end_date from user_role_assignments a left join roles r on r.id = a.role_id ' +
      'where a.user_id = $1 order by a.created_at desc nulls last limit $2',
      [user.id, EXPORT_LIMIT + 1]
    );
    const notes = await ctx.db.query(
      'select id, company_id, ticket_id, type, title, message, is_read, read_at, created_at from notifications ' +
      'where user_id = $1 order by created_at desc nulls last limit $2',
      [user.id, EXPORT_LIMIT + 1]
    );
    const tickets = await ctx.db.query(
      'select id, ticket_number, title, status, company_id, ticket_type_id, created_at, updated_at from tickets ' +
      'where requester_id = $1 order by created_at desc nulls last limit $2',
      [user.id, EXPORT_LIMIT + 1]
    );
    const cap = rows => ({ rows: rows.slice(0, EXPORT_LIMIT), truncated: rows.length > EXPORT_LIMIT });
    const row = own.rows[0] || {};
    return {
      exported_at: iso(ctx.now),
      user_id: user.id,
      profile: row.profile || null,
      preferences: row.preferences || null,
      privacy_acknowledgements: row.privacy_acknowledgements || [],
      role_assignments: cap(roles.rows),
      notifications: cap(notes.rows),
      tickets_requested: cap(tickets.rows),
      note: 'Your own data in Daloy. Other data about you in your organization\'s tickets is held for your organization - ask its administrator.'
    };
  },

  /**
   * Erasure / blocking by anonymization (rights guide §4): the person's name, email and phone are replaced, their
   * access is ended, and every record stays linked by id (audit logs keep working). Ticket content follows the
   * organization's own instruction and is not changed here.
   * payload: { user_id, reason }. The actor must be an admin of EVERY organization the person belongs to (or a global
   * admin), and can't anonymize themselves (a request to the DPO instead).
   */
  async anonymizeUser(payload, ctx) {
    const user = requireUser(ctx);
    const targetId = requireId(payload.user_id, 'user_id');
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    if (!reason || reason.length > REASON_MAX) throw badRequest(`reason is required (up to ${REASON_MAX} characters)`);
    if (targetId === user.id) throw forbidden('You cannot anonymize your own account here - send a request to the Data Protection Officer');

    const scope = await adminScope(ctx.db, user.id, ctx.now);
    const target = await ctx.db.query(
      'select (select count(*)::int from user_profiles where user_id = $1) as profiles, ' +
      '(select coalesce(json_agg(distinct company_id), \'[]\'::json) from user_role_assignments where user_id = $1 and company_id is not null) as companies, ' +
      '(select count(*)::int from user_role_assignments where user_id = $1 and company_id is null) as global_roles',
      [targetId]
    );
    const t = target.rows[0];
    const companies = (t.companies || []).map(String);
    if (!t.profiles && companies.length === 0 && !t.global_roles) throw notFound('User not found');
    const allowed = scope.global || (companies.length > 0 && t.global_roles === 0 && companies.every(c => scope.ids.has(c)));
    if (!allowed) throw forbidden('Only an administrator of every organization this person belongs to can do this');

    const name = anonymousName(targetId);
    return ctx.db.transaction(async tx => {
      // Invites first: they are matched by the profile's email, which the next statement removes
      const invites = await tx.query(
        'update user_invites set email = null, display_name = null, updated_at = $2, updated_by = $3 ' +
        'where accepted_uid = $1 or (email is not null and lower(email) = (select lower(email) from user_profiles where user_id = $1))',
        [targetId, ctx.now, user.id]
      );
      const profile = await tx.query(
        "update user_profiles set display_name = $2, email = null, phone = null, hire_date = null, termination_date = null, " +
        "status = 'anonymized', is_active = false, deactivated_at = $3, deactivated_by = $4, deactivation_reason = $5, " +
        'updated_at = $3, updated_by = $4 where user_id = $1',
        [targetId, name, ctx.now, user.id, reason]
      );
      const outbox = await tx.query(
        'update email_outbox set recipient_email = null, updated_at = $2 where recipient_user_id = $1 and recipient_email is not null',
        [targetId, ctx.now]
      );
      const roles = await tx.query(
        'update user_role_assignments set is_active = false, deactivated_at = $2, deactivated_by = $3, deactivation_reason = $4, ' +
        'updated_at = $2, updated_by = $3 where user_id = $1 and coalesce(is_active, true)',
        [targetId, ctx.now, user.id, reason]
      );
      const counts = {
        profile: profile.rowCount ?? profile.affectedRows ?? 0,
        invites: invites.rowCount ?? invites.affectedRows ?? 0,
        outbox: outbox.rowCount ?? outbox.affectedRows ?? 0,
        role_assignments_ended: roles.rowCount ?? roles.affectedRows ?? 0
      };
      await tx.query(
        'insert into admin_action_logs (id, admin_user_id, action_type, target_entity, target_id, details, timestamp) ' +
        "values (gen_random_uuid()::text, $1, 'ANONYMIZE_USER', 'user', $2, $3, $4)",
        [user.id, targetId, JSON.stringify({ reason, companies, counts }), ctx.now]
      );
      return { user_id: targetId, display_name: name, ...counts };
    });
  }
};

// For tests; not enumerable, so the handler registry (handlers/index.js) doesn't take it for an action
Object.defineProperty(module.exports, '_internal', { value: { adminScope, anonymousName, EXPORT_LIMIT }, enumerable: false });
