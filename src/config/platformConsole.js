/**
 * The Platform manager console - module map and WIREFRAME sample data (docs/planning/PLAN_PlatformManager_20261106.md
 * v2.0.0, final design; not built). User, 15 Nov 2026: "create login button for platform admin and wireframe homepage
 * of platform i can access".
 * Everything on /platform today is a wireframe with made-up sample data - no API call, no customer data. The real
 * modules arrive in phases PM1-PM5 (the `phase` of each module) on /api/rpc.
 * Layer: config (no imports).
 */

export const PLATFORM_PATH = '/platform';
/** The staff sign-in page of the console (src/pages/PlatformLoginPage.js). */
export const PLATFORM_LOGIN_PATH = '/platform/login';

export const PLATFORM_GROUPS = ['Operate', 'Commercial', 'Content', 'Governance'];

/** M1-M16 in the order of the left rail (design §2). */
export const PLATFORM_MODULES = [
  { id: 'overview', code: 'M1', group: 'Operate', name: 'Overview', phase: 'PM1',
    summary: 'Tiles for customers, trials, sessions, notices and requests, the Needs attention list and the last platform actions.' },
  { id: 'customers', code: 'M2', group: 'Operate', name: 'Customers', phase: 'PM2',
    summary: 'Every customer with its companies, admins, plan, usage, sessions, notices sent, terms accepted and history.' },
  { id: 'sessions', code: 'M15', group: 'Operate', name: 'Sessions', phase: 'PM1',
    summary: 'Who is signed in now, per organization; force sign-out of everyone, one organization or one user (owner, reason, sign in again first).' },
  { id: 'health', code: 'M9', group: 'Operate', name: 'Health, incidents & announcements', phase: 'PM1',
    summary: 'Maintenance / outage / info announcements to signed-in users, incidents with their timelines; per-store health later (PM5).' },
  { id: 'notices', code: 'M14', group: 'Operate', name: 'Security notices', phase: 'PM1',
    summary: 'Every security notice to every organization; the A / B / B2 / P / PE editor with the timeline; post, resolve, publish.' },
  { id: 'support', code: 'M10', group: 'Operate', name: 'Support access', phase: 'PM5',
    summary: 'Access grants from customers, support sessions, the break-glass log.' },
  { id: 'plans', code: 'M3', group: 'Commercial', name: 'Plans & subscriptions', phase: 'PM2',
    summary: 'Trials, plan changes, renewals, cancellations, overrides, packs, spend caps - with their history.' },
  { id: 'usage', code: 'M4', group: 'Commercial', name: 'Usage & statements', phase: 'PM3',
    summary: 'Monthly usage, statements (draft, issued, paid, disputed, void), payments, export for the accounting system.' },
  { id: 'prices', code: 'M5', group: 'Commercial', name: 'Price book', phase: 'PM3',
    summary: 'Plan and add-on prices, setup fees and promotions with effective dates.' },
  { id: 'fx', code: 'M6', group: 'Commercial', name: 'Exchange rates', phase: 'PM3',
    summary: 'The BSP rate per month; each statement keeps the rate it used.' },
  { id: 'leads', code: 'M7', group: 'Commercial', name: 'Leads', phase: 'PM4',
    summary: 'Website enquiries; convert a lead into a customer with a trial and an invite in one step.' },
  { id: 'templates', code: 'M8', group: 'Content', name: 'Templates & packs', phase: 'PM4',
    summary: 'The owner template library and the Payroll / HR packs.' },
  { id: 'reference', code: 'M11', group: 'Content', name: 'Reference data', phase: 'PM2',
    summary: 'Country calendars and holidays, the plan catalogue.' },
  { id: 'contracts', code: 'M12', group: 'Governance', name: 'Contract records', phase: 'PM3',
    summary: 'Terms and DPA acceptances per customer, tax profile, notices sent.' },
  { id: 'privacy', code: 'M16', group: 'Governance', name: 'Privacy desk', phase: 'PM1',
    summary: 'Rights requests with due dates, deletion cases with their export / delete runs, retention runs, review dates.' },
  { id: 'team', code: 'M13', group: 'Governance', name: 'Team & audit', phase: 'PM1',
    summary: 'Platform admins and their roles, 2-step verification check dates, the platform audit log.' }
];

/** WIREFRAME sample data for the Overview - invented, no real customer. */
export const WIREFRAME_OVERVIEW = {
  attention: [
    { tone: 'red', text: 'Breach clock: INC-2026-003 - notify the organizations concerned within 6 h' },
    { tone: 'amber', text: 'Rights request DSR-2026-002 is due in 2 days' },
    { tone: 'amber', text: 'Trial ends in 3 days: Sample Co (Basic)' },
    { tone: 'gray', text: 'Retention job failed last night - see Privacy desk' }
  ],
  tiles: [
    { label: 'Customers', value: '12', detail: '3 on trial · 0 read-only', module: 'customers' },
    { label: 'Signed in now', value: '41', detail: '17 active in the last hour', module: 'sessions' },
    { label: 'Open security notices', value: '1', detail: 'INC-2026-003 (B), ongoing', module: 'notices' },
    { label: 'Announcements', value: '1', detail: 'Maintenance 1 Dec, 21:00-23:00', module: 'health' },
    { label: 'Open rights requests', value: '2', detail: '1 due this week', module: 'privacy' },
    { label: 'Statements overdue', value: '0', detail: 'November closes on 3 Dec', module: 'usage' },
    { label: 'New leads', value: '4', detail: 'this week', module: 'leads' },
    { label: 'Platform team', value: '1', detail: 'owner · 2-step verification checked', module: 'team' }
  ],
  lastActions: [
    { at: '15 Nov 19:40', who: 'owner', what: 'Force sign-out - organization "Sample Co"', reason: 'INC-2026-003' },
    { at: '15 Nov 18:05', who: 'owner', what: 'Posted security notice INC-2026-003 (B)', reason: 'provider incident' },
    { at: '15 Nov 09:12', who: 'owner', what: 'Extended trial - Sample Co to 18 Nov', reason: 'onboarding call moved' }
  ]
};
