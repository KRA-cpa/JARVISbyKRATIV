/**
 * PROPOSED plan line-up (PLAN_PlanTiers_Subscriptions_20261031.md U9 / §2b, 1 Nov 2026) - shown on PREVIEW builds of the
 * public /plans page only. NOT the live catalogue: the server (AppScript v10.2 PLAN_CATALOG) still has three plans, and
 * src/config/plans.js must keep matching it (`npm run check:api-contract`). When U9 is built on the server, this file's
 * content moves into plans.js and this file is deleted.
 * Names here deliberately avoid the literals the contract check reads (TIERS, LIMITS, PLAN_ORDER).
 * Layer: config (no imports).
 */

export const PROPOSED_PLAN_ORDER = ['basic', 'basic_plus', 'advanced', 'enterprise'];

export const PROPOSED_PLAN_NAMES = { basic: 'Basic', basic_plus: 'Basic+', advanced: 'Advanced', enterprise: 'Enterprise' };

export const PROPOSED_PLAN_TAGLINES = {
  basic: 'Ready-made ticket types from the template library, set up for you',
  basic_plus: 'Basic with the Payroll and HR request packs, ready to use',
  advanced: 'Build your own workflows, SLAs, notifications and uploads - packs included, on or off',
  enterprise: 'Restricted tickets, configuration transfer and filing on behalf at scale - packs included, on or off'
};

/** Features each plan ADDS to the one before it (the live advanced / enterprise lists are reused by the page). */
export const PROPOSED_ADDED_FEATURES = {
  basic: [],
  basic_plus: ['payroll_pack', 'hr_pack'],
  advanced: ['pack_toggle'], // + the live Advanced features
  enterprise: [] // + the live Enterprise features
};

/** Feature group shown first in the comparison table. */
export const PROPOSED_PACK_GROUP = {
  area: 'Request packs',
  features: {
    payroll_pack: 'Payroll pack: leave, leave cancellation, overtime (regular day, rest day, holiday), undertime, official business, ' +
      'change of schedule, non-punching authorization, Manual DTR, payroll concern',
    hr_pack: 'HR pack: certificate of employment requests (more HR requests to come)',
    pack_toggle: 'Turn each pack on or off for a company'
  }
};

/** Basic+ limits: Basic's, with more tickets per month (proposal P4, to confirm). Pack ticket types don't count (P2). */
export const PROPOSED_BASIC_PLUS_LIMITS = { users: 25, ticket_types: 5, steps_per_type: 3, tickets_per_month: 1000, upload_rows: 0 };

/**
 * Usage add-ons (PLAN_PlanTiers U10 / §2c, proposal O1): users and tickets per month are ALLOWANCES - going over is billed
 * in blocks instead of forcing an upgrade. Ticket types: extra = paid custom type; steps / upload rows stay hard limits.
 */
export const PROPOSED_ALLOWANCE_KEYS = ['users', 'tickets_per_month'];
export const PROPOSED_ADDON_BLOCKS = {
  basic: { users: 5, tickets_per_month: 250 },
  basic_plus: { users: 5, tickets_per_month: 250 },
  advanced: { users: 5, tickets_per_month: 1000 },
  // Enterprise tickets: 50,000 / month is today's storage ceiling (Sheets) - no ticket blocks until Postgres (§2c)
  enterprise: { users: 5, tickets_per_month: null }
};

export const PROPOSED_NOTES = [
  'Users and tickets per month are allowances, not hard limits: above them you keep working and pay add-on blocks, ' +
    'without changing plan. Tickets are counted on a 3-month average, so one busy month (payroll cut-off, year-end) isn\'t ' +
    'charged on its own. You can choose to stop at the allowance or set a monthly spending cap instead.',
  'No surprises: your administrators see usage, a month-end estimate and every counted user and ticket at any time, with ' +
    'alerts at 80% and 100%. Add-on prices will be published per plan.',
  'Pack request types don\'t count toward the ticket types limit.',
  'Turning a pack off stops new requests of its types; existing requests stay readable and can finish.'
];
