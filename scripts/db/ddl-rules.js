/**
 * ddl-rules.js v1.2 (15 Nov 2026; v1.0 11 Nov) - v1.2: companies.email_enabled is text (default | on | off), not
 * boolean - found by the first real export (step 0.8). v1.1: mail_connections + organizations / companies mail columns (D13 E7). — the hand-tuning that turns AppScript TABLE_SCHEMAS into the first Postgres schema.
 *
 * Read by scripts/gen-ddl.js (migration step 0.7, docs/planning/PLAN_Migration_Unified_20261108.md §5). The column
 * lists themselves come from TABLE_SCHEMAS in the newest AppScript file - nothing here repeats them; this file only says
 * how to TYPE them, which keys / indexes / references they get, and which columns + tables the Sheets backend never had.
 *
 * Sources: PLAN_Migration_NeonVercel_20261030.md §4 (types, keys, day-one indexes) + §5 (version, idempotency) + §12;
 * PLAN_FeatureGaps_Volume_20261031.md §4.6 / §4.8 / §6.1-§6.2 (delegation, comments, v10 indexes);
 * PLAN_ServerCore_OrgSheetBridge_20261101.md §1 / §6 + unified plan D9 (organizations);
 * PLAN_Attachments_ClientDrive_20261109.md §4 (D11, reserved in this first schema).
 *
 * Decisions taken here (safe defaults - say "no" to change):
 *  - Ids stay `text` primary keys (no reference rewrite at the load). tickets.id too: new ids keep coming from the
 *    `ticket_id` row of sequence_counters inside the create transaction (same as v9.4+), not an identity column.
 *  - Timestamps are `timestamptz` (UTC). Calendar days (holidays, custom-field dates, plan periods, hire dates) are
 *    `date`. Role-assignment and share expiry stay `timestamptz` because Sheets stores full instants there
 *    (effective_start_date = toISOString(); endOfTerm keeps a time).
 *  - Foreign keys and business UNIQUE rules go in migration 0002, applied AFTER the data load (0.8) once its orphan /
 *    duplicate report is clean - Sheets data was never checked by a database, and the load must not stop half-way.
 *    A fresh install applies 0001 + 0002 together.
 *  - User-id columns (requester_id, user_id, *_by ...) get no foreign key: they hold sign-in uids, 'system', or ids of
 *    people without a profile row yet (invites). custom_field_values.ticket_id is the universal entity id (ticket, user
 *    profile, role) - no foreign key either. tickets.current_step_id holds '__head__' for the head step - no FK.
 *  - Organizations: `companies.organization_id` (+ organization_members). Every other company-scoped table reaches its
 *    organization through company_id (Claude.md: every company-scoped query filters by company_id).
 */

'use strict';

// --- Types --------------------------------------------------------------------------------------------------------

/** Exact column-name types that win over the name patterns below (any table). */
const TYPE_BY_COLUMN = {
  // jsonb (JSON-in-text cells in Sheets)
  details: 'jsonb', field_changes: 'jsonb', notify_role_ids: 'jsonb', notify_emails: 'jsonb',
  escalation_recipients: 'jsonb', business_days: 'jsonb', recipient_user_ids: 'jsonb', granted_role_ids: 'jsonb',
  role_grants: 'jsonb', feature_overrides: 'jsonb', limit_overrides: 'jsonb', allowed_timezones: 'jsonb',
  weekend_days: 'jsonb', default_business_hours: 'jsonb', dashboard_layout: 'jsonb',
  // booleans whose names don't start with is_ / require_ / enable_ / can_ / has_
  code_locked: 'boolean', dark_mode: 'boolean', email_notifications: 'boolean', desktop_notifications: 'boolean',
  auto_refresh: 'boolean', exclude_weekends: 'boolean', exclude_holidays: 'boolean', escalation_enabled: 'boolean',
  approval_required: 'boolean', requires_certification: 'boolean', enforce_blocking_rules: 'boolean',
  notify_current_approvers: 'boolean', notify_requester: 'boolean',
  notify_on_update: 'boolean', email_status: 'text',
  // not a boolean: companies.email_enabled is default | on | off (v9.6 COMPANY_EMAIL_MODES; blank = default)
  email_enabled: 'text',
  // instants that don't end in _at
  timestamp: 'timestamptz', step_due_date: 'timestamptz', step_started_at: 'timestamptz',
  upload_timestamp: 'timestamptz', access_timestamp: 'timestamptz', last_tag_update: 'timestamptz',
  window_start: 'timestamptz', window_end: 'timestamptz', visit_started_at: 'timestamptz', due_at: 'timestamptz',
  effective_start_date: 'timestamptz', effective_end_date: 'timestamptz', validity_end_date: 'timestamptz',
  expiration_date: 'timestamptz',
  // calendar days
  date: 'date', date_value: 'date', start_date_value: 'date', end_date_value: 'date', hire_date: 'date',
  termination_date: 'date', period_start: 'date', period_end: 'date', trial_end: 'date',
  // whole numbers
  ticket_count: 'integer', sort_order: 'integer', level: 'integer', attempts: 'integer', send_count: 'integer',
  usage_count: 'integer', collaboration_count: 'integer', tag_count: 'integer', notification_count: 'integer',
  items_per_page: 'integer', refresh_interval: 'integer', auto_expire_days: 'integer', trial_extended_count: 'integer',
  grace_days: 'integer', year: 'integer', condition_group: 'integer', last_number: 'bigint', file_size: 'bigint',
  // amounts / durations (may be fractional: 1.5 hours, 80.5 %)
  duration: 'numeric', trigger_value: 'numeric', escalation_delay: 'numeric', warning_threshold: 'numeric',
  max_approval_amount: 'numeric', number_value: 'numeric',
};

/** Per-table exceptions (same column name, different meaning). */
const TYPE_BY_TABLE_COLUMN = {
  'role_types.permission_level': 'integer',         // 1..3
  'ticket_collaborations.permission_level': 'text', // view | comment | edit
  'collaboration_requests.permission_level': 'text',
  'company_holidays.overrides_country': 'text',     // add | remove
};

/** Name patterns, checked in order after the exact maps. Everything else is text. */
const TYPE_PATTERNS = [
  [/^(is|require|enable|can|has)_/, 'boolean'],
  [/_at$/, 'timestamptz'],
];

/** Column defaults (Sheets COLUMN_DEFAULTS intent: blank is_active = active). */
const DEFAULT_BY_COLUMN = { is_active: 'true' };

// --- Keys ---------------------------------------------------------------------------------------------------------

/** Primary keys for tables whose first column is not `id`. Tables with an `id` column get `primary key (id)`. */
const PRIMARY_KEYS = {
  step_approvers: ['step_id', 'role_id'],
  sequence_counters: ['sequence_name'],
  user_preferences: ['user_id'],
  user_profiles: ['user_id'],
  country_calendars: ['country_code'],
};

// --- Columns + tables the Sheets backend never had ------------------------------------------------------------------

const AUDIT = [
  ['is_active', 'boolean not null default true'], ['created_at', 'timestamptz not null default now()'],
  ['created_by', 'text'], ['updated_at', 'timestamptz'], ['updated_by', 'text'],
  ['deactivated_at', 'timestamptz'], ['deactivated_by', 'text'], ['deactivation_reason', 'text'],
];

/** Extra columns on TABLE_SCHEMAS tables: [column, full definition]. */
const EXTRA_COLUMNS = {
  // comment_requirements has no id in Sheets (one row per type + company); a surrogate key for the API / FKs
  comment_requirements: [['id', "text not null default ('cr_' || replace(gen_random_uuid()::text, '-', ''))"]],
  companies: [
    ['organization_id', 'text'],                                   // D9 (set to the default organization at the load)
    ['drive_setting', "text not null default 'inherit'"],          // D11: inherit | on_own_connection | off
    ['drive_connection_id', 'text'],
    ['mail_setting', "text not null default 'inherit'"],           // D13: inherit | on_own_connection | off
    ['mail_connection_id', 'text'],
  ],
  tickets: [
    ['version', 'integer not null default 0'],                     // optimistic lock (one transition per approval)
    ['search', "tsvector generated always as (to_tsvector('simple', coalesce(ticket_number, '') || ' ' || coalesce(title, ''))) stored"],
  ],
  ticket_attachments: [                                            // D11 §4
    ['storage', "text not null default 'link'"],                   // link | drive
    ['slot_id', 'text'], ['drive_connection_id', 'text'], ['root_folder_id', 'text'], ['drive_file_id', 'text'],
    ['display_name', 'text'], ['drive_name', 'text'], ['md5', 'text'],
    ['upload_status', "text not null default 'ok'"],               // pending | ok | missing | removed
  ],
  ticket_history: [['on_behalf_of', 'text']],                      // delegation (§4.6): user_id = delegate
  ticket_action_logs: [['on_behalf_of', 'text']],
};

/** New tables: { name: [[column, definition], ...] }; primary key = id unless PRIMARY_KEYS says otherwise. */
const EXTRA_TABLES = {
  organizations: [                                                 // D9 / PLAN_ServerCore §1, §6
    ['id', 'text not null'], ['name', 'text not null'], ['code', 'text'],
    ['storage', "text not null default 'platform'"],               // platform | sheet
    ['bridge_url', 'text'], ['bridge_secret_ref', 'text'],         // Sheet organizations (Phase 5); a secret NAME, never the value
    ['drive_attachments_enabled', 'boolean not null default false'], ['drive_mode', 'text'], ['drive_connection_id', 'text'],
    ['mail_connection_id', 'text'],                                // D13: null = no notification email (E3)
    ...AUDIT,
  ],
  organization_members: [                                          // O4: one identity, several organizations
    ['id', 'text not null'], ['organization_id', 'text not null'], ['user_id', 'text not null'],
    ['member_role', "text not null default 'member'"],             // admin | member (organization admin scope, §2)
    ...AUDIT,
  ],
  approval_delegations: [                                          // FeatureGaps §4.6
    ['id', 'text not null'], ['approver_id', 'text not null'], ['delegate_id', 'text not null'],
    ['company_id', 'text'], ['ticket_type_ids', 'jsonb'],          // null / [] = all types
    ['start_date', 'date not null'], ['end_date', 'date not null'], ['set_by', 'text'],
    ...AUDIT,
  ],
  ticket_comments: [                                               // FeatureGaps §4.8
    ['id', 'text not null'], ['ticket_id', 'text not null'], ['user_id', 'text not null'], ['body', 'text not null'],
    ['mentions', 'jsonb'], ['created_at', 'timestamptz not null default now()'], ['edited_at', 'timestamptz'],
    ['is_active', 'boolean not null default true'],
  ],
  idempotency_keys: [                                              // NeonVercel §5: a retried write returns the first response
    ['key', 'text not null'], ['user_id', 'text not null'], ['action', 'text not null'], ['response', 'jsonb'],
    ['created_at', 'timestamptz not null default now()'],
  ],
  drive_connections: [                                             // D11 §4
    ['id', 'text not null'], ['organization_id', 'text not null'], ['company_id', 'text'],
    ['kind', 'text not null'],                                     // oauth_role_account | service_account
    ['connected_email', 'text'], ['token_ciphertext', 'text'], ['service_account_email', 'text'],
    ['roots', "jsonb not null default '[]'::jsonb"],
    ['status', "text not null default 'ok'"],                      // ok | broken | disconnected
    ['last_checked_at', 'timestamptz'],
    ...AUDIT,
  ],
  mail_connections: [                                              // D13 (unified plan §1, E1-E7): the client's own mail
    ['id', 'text not null'], ['organization_id', 'text not null'], ['company_id', 'text'], // company_id null = organization level
    ['kind', 'text not null'],                                     // google_oauth | google_service_account | microsoft365 | smtp
    ['mailbox_email', 'text'],                                     // the sender (e.g. daloy@client.com)
    ['token_ciphertext', 'text'],                                  // OAuth refresh token (google_oauth / microsoft365), encrypted
    ['service_account_email', 'text'],                             // google_service_account (domain-wide delegation, gmail.send)
    ['smtp_host', 'text'], ['smtp_port', 'integer'], ['smtp_username', 'text'], ['smtp_secret_ciphertext', 'text'],
    ['status', "text not null default 'ok'"],                      // ok | broken | disconnected
    ['last_checked_at', 'timestamptz'], ['last_error', 'text'],
    ...AUDIT,
  ],
  ticket_type_attachment_rules: [
    ['ticket_type_id', 'text not null'], ['allow_attachments', 'boolean not null default true'],
    ['max_files', 'integer'], ['max_mb', 'numeric'], ['accepted_formats', 'jsonb'],
    ...AUDIT,
  ],
  ticket_type_attachment_slots: [
    ['id', 'text not null'], ['ticket_type_id', 'text not null'], ['label', 'text not null'],
    ['required_on_create', 'boolean not null default false'], ['allow_multiple', 'boolean not null default false'],
    ['max_files', 'integer'], ['accepted_formats', 'jsonb'], ['sort_order', 'integer'],
    ...AUDIT,
  ],
  workflow_step_required_slots: [
    ['step_id', 'text not null'], ['slot_id', 'text not null'], ['company_id', 'text'],
    ...AUDIT,
  ],
};

Object.assign(PRIMARY_KEYS, {
  idempotency_keys: ['key'],
  ticket_type_attachment_rules: ['ticket_type_id'],
  workflow_step_required_slots: ['step_id', 'slot_id'],
});

/** NOT NULL on loaded columns (only where every Sheets row has a value; blank → NULL would break the load otherwise). */
const NOT_NULL = {
  tickets: ['ticket_number', 'ticket_type_id', 'company_id', 'status'],
  ticket_history: ['ticket_id'],
  companies: ['name', 'code'],
};

// --- Indexes (0001: performance only, safe to build on any data) -----------------------------------------------------

/** [table, name suffix, definition after "on <table>"] - names become idx_<table>_<suffix>. */
const INDEXES = [
  // NeonVercel §4 day-one
  ['tickets', 'company_status', '(company_id, status)'],
  ['tickets', 'open_due', "(step_due_date) where status not in ('Completed', 'Rejected', 'Cancelled')"],
  ['tickets', 'open_step', "(current_step_id) where status not in ('Completed', 'Rejected', 'Cancelled')"],
  ['ticket_history', 'ticket_time', '(ticket_id, "timestamp")'],
  ['user_role_assignments', 'user', '(user_id)'],
  ['user_role_assignments', 'company_role', '(company_id, role_id)'],
  ['step_approvers', 'step', '(step_id)'],
  ['step_approvers', 'role', '(role_id)'],
  ['custom_field_values', 'entity', '(ticket_id, entity_category)'],
  ['workflow_steps', 'type_company_order', '(ticket_type_id, company_id, sort_order)'],
  ['admin_action_logs', 'time', '("timestamp")'],
  ['notifications', 'user_unread', '(user_id, is_read, created_at desc)'],
  // FeatureGaps §6.2
  ['tickets', 'company_type_created', '(company_id, ticket_type_id, created_at desc, id desc)'],
  ['tickets', 'requester_created', '(requester_id, created_at desc, id desc)'],
  ['tickets', 'head_inbox', "(head_approver_id) where current_step_id = '__head__'"],
  ['tickets', 'search', 'using gin (search)'],
  ['tickets', 'number_trgm', 'using gin (ticket_number gin_trgm_ops)'],
  ['ticket_participants', 'user_ticket', '(user_id, ticket_id)'],
  ['ticket_participants', 'pool', '(role_id, step_id) where user_id is null'],
  ['approval_delegations', 'delegate_window', '(delegate_id, start_date, end_date) where is_active'],
  ['notifications', 'role', '(recipient_role_id, created_at desc) where recipient_role_id is not null'],
  ['email_outbox', 'pending', "(status, created_at) where status = 'pending'"],
  ['ticket_comments', 'ticket_time', '(ticket_id, created_at)'],
  // lookups the handlers make on every request
  ['ticket_action_logs', 'ticket_time', '(ticket_id, "timestamp")'],
  ['ticket_attachments', 'ticket_status', '(ticket_id, upload_status)'],
  ['ticket_attachments', 'cleanup', '(upload_status, created_at)'],
  ['ticket_links', 'parent', '(parent_ticket_id)'],
  ['ticket_links', 'child', '(child_ticket_id)'],
  ['ticket_tag_assignments', 'ticket', '(ticket_id)'],
  ['ticket_collaborations', 'ticket', '(ticket_id)'],
  ['ticket_collaborations', 'shared_with', '(shared_with_user_id) where is_active'],
  ['custom_fields', 'type_order', '(ticket_type_id, entity_category, sort_order)'],
  ['dropdown_options', 'list', '(dropdown_list_id)'],
  ['step_conditions', 'step', '(step_id, condition_group)'],
  ['step_slas', 'step', '(step_id)'],
  ['sla_escalation_rules', 'scope', '(company_id, ticket_type_id, step_id, level)'],
  ['sla_escalation_events', 'ticket', '(ticket_id)'],
  ['company_holidays', 'company_date', '(company_id, date)'],
  ['country_holidays', 'country_date', '(country_code, date)'],
  ['company_subscriptions', 'company', '(company_id, period_start desc)'],
  ['user_invites', 'email', '(lower(email)) where is_active'],
  ['user_profiles', 'email', '(lower(email))'],
  ['organization_members', 'user', '(user_id) where is_active'],
  ['companies', 'organization', '(organization_id)'],
  ['mail_connections', 'owner', '(organization_id, company_id) where is_active'],
  ['idempotency_keys', 'created', '(created_at)'],
];

// --- 0002: business uniques + foreign keys (after the load's orphan / duplicate report is clean) -------------------------

/** [table, name suffix, definition] for unique indexes - names become uq_<table>_<suffix>. */
const UNIQUES = [
  ['tickets', 'number', '(ticket_number)'],
  ['companies', 'code', '(upper(code)) where is_active'],
  ['ticket_types', 'company_name', "(coalesce(company_id, ''), lower(name)) where is_active"],
  ['comment_requirements', 'type_company', "(ticket_type_id, coalesce(company_id, '')) where is_active"],
  ['user_role_assignments', 'grant', "(user_id, role_id, coalesce(ticket_type_id, ''), coalesce(company_id, ''), effective_start_date) where is_active"],
  ['ticket_tags', 'company_name', "(coalesce(company_id, ''), lower(name)) where is_active"],
  ['sla_escalation_rules', 'level', "(company_id, ticket_type_id, coalesce(step_id, ''), level) where is_active"],
  ['sla_escalation_events', 'visit', '(ticket_id, step_id, visit_started_at, rule_id)'],
  ['company_holidays', 'day', '(company_id, date) where is_active'],
  ['country_holidays', 'day', '(country_code, date) where is_active'],
  ['ticket_participants', 'reason', "(ticket_id, user_id, reason) where is_active and user_id is not null"],
  ['organization_members', 'member', '(organization_id, user_id) where is_active'],
  ['organizations', 'code', '(upper(code)) where is_active and code is not null'],
];

/** [table, column, referenced table, referenced column = id] - names become fk_<table>_<column>. */
const FOREIGN_KEYS = [
  ['companies', 'organization_id', 'organizations'],
  ['companies', 'country_code', 'country_calendars', 'country_code'],
  ['companies', 'drive_connection_id', 'drive_connections'],
  ['organization_members', 'organization_id', 'organizations'],
  ['organizations', 'drive_connection_id', 'drive_connections'],
  ['drive_connections', 'organization_id', 'organizations'],
  ['drive_connections', 'company_id', 'companies'],
  ['companies', 'mail_connection_id', 'mail_connections'],
  ['organizations', 'mail_connection_id', 'mail_connections'],
  ['mail_connections', 'organization_id', 'organizations'],
  ['mail_connections', 'company_id', 'companies'],
  ['roles', 'company_id', 'companies'],
  ['roles', 'role_type_id', 'role_types'],
  ['role_types', 'company_id', 'companies'],
  ['user_profile_types', 'company_id', 'companies'],
  ['user_profiles', 'user_profile_type_id', 'user_profile_types'],
  ['ticket_types', 'company_id', 'companies'],
  ['comment_requirements', 'ticket_type_id', 'ticket_types'],
  ['comment_requirements', 'company_id', 'companies'],
  ['workflow_steps', 'ticket_type_id', 'ticket_types'],
  ['workflow_steps', 'company_id', 'companies'],
  ['workflow_steps', 'next_ticket_type_id', 'ticket_types'],
  ['step_approvers', 'step_id', 'workflow_steps'],
  ['step_approvers', 'role_id', 'roles'],
  ['step_slas', 'step_id', 'workflow_steps'],
  ['step_conditions', 'step_id', 'workflow_steps'],
  ['step_conditions', 'custom_field_id', 'custom_fields'],
  ['step_conditions', 'next_step_id', 'workflow_steps'],
  ['user_role_assignments', 'role_id', 'roles'],
  ['user_role_assignments', 'ticket_type_id', 'ticket_types'],
  ['user_role_assignments', 'company_id', 'companies'],
  ['dropdown_lists', 'company_id', 'companies'],
  ['dropdown_options', 'dropdown_list_id', 'dropdown_lists'],
  ['dropdown_options', 'parent_option_id', 'dropdown_options'],
  ['dropdown_company_assignments', 'dropdown_list_id', 'dropdown_lists'],
  ['dropdown_company_assignments', 'company_id', 'companies'],
  ['custom_fields', 'dropdown_list_id', 'dropdown_lists'],
  ['custom_fields', 'depends_on_field_id', 'custom_fields'],
  ['custom_field_values', 'custom_field_id', 'custom_fields'],
  ['custom_field_values', 'dropdown_option_id', 'dropdown_options'],
  ['tickets', 'ticket_type_id', 'ticket_types'],
  ['tickets', 'company_id', 'companies'],
  ['ticket_history', 'ticket_id', 'tickets'],
  ['ticket_action_logs', 'ticket_id', 'tickets'],
  ['ticket_attachments', 'ticket_id', 'tickets'],
  ['ticket_attachments', 'slot_id', 'ticket_type_attachment_slots'],
  ['ticket_attachments', 'drive_connection_id', 'drive_connections'],
  ['ticket_links', 'parent_ticket_id', 'tickets'],
  ['ticket_links', 'child_ticket_id', 'tickets'],
  ['ticket_comments', 'ticket_id', 'tickets'],
  ['ticket_participants', 'ticket_id', 'tickets'],
  ['ticket_tags', 'parent_tag_id', 'ticket_tags'],
  ['ticket_tags', 'company_id', 'companies'],
  ['ticket_tag_assignments', 'ticket_id', 'tickets'],
  ['ticket_tag_assignments', 'tag_id', 'ticket_tags'],
  ['tag_usage_statistics', 'tag_id', 'ticket_tags'],
  ['ticket_collaborations', 'ticket_id', 'tickets'],
  ['collaboration_requests', 'ticket_id', 'tickets'],
  ['collaboration_notifications', 'collaboration_id', 'ticket_collaborations'],
  ['shared_ticket_access_logs', 'ticket_id', 'tickets'],
  ['report_configurations', 'ticket_type_id', 'ticket_types'],
  ['company_sla_rules', 'company_id', 'companies'],
  ['company_sla_rules', 'ticket_type_id', 'ticket_types'],
  ['sla_escalation_rules', 'company_id', 'companies'],
  ['sla_escalation_rules', 'ticket_type_id', 'ticket_types'],
  ['sla_escalation_rules', 'step_id', 'workflow_steps'],
  ['sla_escalation_events', 'rule_id', 'sla_escalation_rules'],
  ['sla_escalation_events', 'ticket_id', 'tickets'],
  ['notifications', 'ticket_id', 'tickets'],
  ['email_outbox', 'ticket_id', 'tickets'],
  ['company_holidays', 'company_id', 'companies'],
  ['country_holidays', 'country_code', 'country_calendars', 'country_code'],
  ['company_subscriptions', 'company_id', 'companies'],
  ['user_invites', 'company_id', 'companies'],
  ['approval_delegations', 'company_id', 'companies'],
  ['ticket_type_attachment_rules', 'ticket_type_id', 'ticket_types'],
  ['ticket_type_attachment_slots', 'ticket_type_id', 'ticket_types'],
  ['workflow_step_required_slots', 'step_id', 'workflow_steps'],
  ['workflow_step_required_slots', 'slot_id', 'ticket_type_attachment_slots'],
  ['workflow_step_required_slots', 'company_id', 'companies'],
];

/** Postgres extensions the schema needs (Neon supports both). */
const EXTENSIONS = ['pgcrypto', 'pg_trgm'];

module.exports = {
  TYPE_BY_COLUMN, TYPE_BY_TABLE_COLUMN, TYPE_PATTERNS, DEFAULT_BY_COLUMN, PRIMARY_KEYS, EXTRA_COLUMNS, EXTRA_TABLES,
  NOT_NULL, INDEXES, UNIQUES, FOREIGN_KEYS, EXTENSIONS,
};
