/**
 * Plans per company (AppScript v10.2, docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md) - DISPLAY COPY ONLY.
 * The server decides what a company may do (compliance F1): PLAN_CATALOG in the AppScript file. This file holds the
 * names, labels and the area grouping the screens show, and a copy of the catalogue (PLAN_CATALOG_COPY) that the PUBLIC
 * /plans page renders without any API call (no sign-in needed).
 * TIERS / LIMITS / PLAN_ORDER / LIMIT_KEYS / PAID_GRACE_DAYS / TRIAL_GRACE_DAYS / TRIAL_DEFAULT_DAYS below must equal
 * the server's constants of the same meaning: `npm run check:api-contract` fails (gap "plan-copy ...") when they differ.
 * Layer: config (no imports).
 */

export const PLAN_ORDER = ['basic', 'advanced', 'enterprise'];

export const PLAN_NAMES = { basic: 'Basic', advanced: 'Advanced', enterprise: 'Enterprise' };

export const PLAN_TAGLINES = {
  basic: 'Ready-made ticket types from the template library, set up for you',
  advanced: 'Build your own workflows, SLAs, notifications and uploads',
  enterprise: 'Restricted tickets, configuration transfer and filing on behalf at scale'
};

/** What the core loop includes on every plan (never gated on the server). */
export const CORE_FEATURES = [
  'Ticket types from owner templates, with light edits (names, labels, approvers, comment rules)',
  'Custom fields: text, paragraph, date, amount, dropdown',
  'Approval steps (any / all approvers); cancel, return, reject, reopen',
  'Dashboard, paged lists and search, ticket visibility, who can create',
  'Attachment links, in-app notifications, the standard report + CSV',
  'Company time zone and country calendar'
];

/** Gated features by area, in display order: key -> label. */
export const PLAN_FEATURE_GROUPS = [
  { area: 'Ticket types and workflows', features: {
    type_builder: 'Build your own ticket types, fields and steps',
    conditional_routing: 'Conditional routing',
    chained_tickets: 'Chained tickets',
    task_steps: 'Task steps (external apps)',
    copy_workflows: 'Copy workflows between companies',
    dependent_dropdowns: 'Dependent dropdowns',
    date_range_field: 'Date range fields'
  } },
  { area: 'SLA', features: {
    step_sla: 'Step SLAs',
    company_sla_rules: 'Company SLA rules',
    company_holidays: 'Company holidays',
    sla_escalation: 'SLA escalation',
    sla_analytics: 'SLA analytics'
  } },
  { area: 'Collaboration and notifications', features: {
    email_notifications: 'Email notifications + company email settings',
    tags: 'Ticket tags',
    sharing: 'Ticket sharing',
    comments: 'Comments, mentions and watchers (v10.4)',
    drafts: 'Drafts (v10.4)'
  } },
  { area: 'Approvals', features: {
    head_approval: 'Immediate head approval (v10.3)',
    delegation: 'Delegation (v10.3)',
    bulk_approve: 'Bulk approve (v10.3)'
  } },
  { area: 'Reports and people', features: {
    report_config: 'Report configuration',
    expiring_assignments: 'Expiring role assignments view',
    user_timezone_display: 'Personal display time zone',
    audit_log_viewer: 'Admin audit-log viewer',
    entity_types: 'User profile / role types with custom fields'
  } },
  { area: 'Ticket uploader', features: {
    bulk_upload: 'Upload your own tickets (CSV / XLSX)',
    bulk_upload_on_behalf: 'Upload on behalf of others, saved mappings'
  } },
  { area: 'Security and integration', features: {
    restricted: 'Restricted tickets and fields',
    config_transfer: 'Configuration export / import / backup',
    cross_company_links: 'Links between companies',
    webhooks: 'Webhooks + task callback (v10.4)'
  } }
];

export const PLAN_FEATURE_LABELS = PLAN_FEATURE_GROUPS.reduce((all, group) => ({ ...all, ...group.features }), {});

export const PLAN_LIMIT_LABELS = {
  users: 'Active users',
  ticket_types: 'Ticket types',
  steps_per_type: 'Workflow steps per ticket type',
  tickets_per_month: 'Tickets per month',
  upload_rows: 'Rows per ticket upload'
};

export const PLAN_STATE_LABELS = {
  trial: 'Trial',
  active: 'Active',
  grace: 'Grace period',
  read_only: 'Read-only',
  unassigned: 'No plan set'
};

/** Copy of the server catalogue (getPlanCatalog shape) for the public /plans page - display only. */
const TIERS = {
  basic: [],
  advanced: ['type_builder', 'user_timezone_display', 'conditional_routing', 'chained_tickets', 'task_steps', 'copy_workflows',
    'dependent_dropdowns', 'date_range_field', 'step_sla', 'company_sla_rules', 'company_holidays', 'sla_escalation', 'sla_analytics',
    'email_notifications', 'tags', 'sharing', 'report_config', 'expiring_assignments', 'bulk_upload',
    'head_approval', 'delegation', 'bulk_approve', 'comments', 'drafts'],
  enterprise: ['bulk_upload_on_behalf', 'restricted', 'config_transfer', 'cross_company_links', 'audit_log_viewer', 'entity_types',
    'webhooks']
};
const LIMITS = {
  basic: { users: 25, ticket_types: 5, steps_per_type: 3, tickets_per_month: 500, upload_rows: 0 },
  advanced: { users: 200, ticket_types: 25, steps_per_type: 10, tickets_per_month: 5000, upload_rows: 200 },
  enterprise: { users: 2000, ticket_types: null, steps_per_type: 30, tickets_per_month: 50000, upload_rows: 2000 }
};

const LIMIT_KEYS = ['users', 'ticket_types', 'steps_per_type', 'tickets_per_month', 'upload_rows'];
const PAID_GRACE_DAYS = 14;
const TRIAL_GRACE_DAYS = 7;
const TRIAL_DEFAULT_DAYS = 30;

export const PLAN_CATALOG_COPY = {
  plans: PLAN_ORDER.map((plan, index) => ({
    plan,
    name: PLAN_NAMES[plan],
    features: PLAN_ORDER.slice(0, index + 1).flatMap(p => TIERS[p]),
    limits: { ...LIMITS[plan] }
  })),
  features: PLAN_ORDER.flatMap(plan => TIERS[plan].map(key => ({ key, required_plan: plan }))),
  limit_keys: LIMIT_KEYS.slice(),
  grace_days: { paid: PAID_GRACE_DAYS, trial: TRIAL_GRACE_DAYS },
  trial_default_days: TRIAL_DEFAULT_DAYS
};

/** A limit for display: null = no limit. */
export const formatPlanLimit = value => {
  if (value === null || value === undefined) return 'No limit';
  if (Number(value) === 0) return '—';
  // thousands separators by hand (compliance F3 v3: no toLocale* outside src/utils/dateTime.js)
  return String(Math.floor(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
