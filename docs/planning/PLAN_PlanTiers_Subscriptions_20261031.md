<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_PlanTiers_Subscriptions_20261031.md | Author: Kenneth R. Advento | Version: 1.3.1
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: AppScript v10.2 - Basic / Advanced / Enterprise plans per company: feature + limit catalogue, server gate, subscription lifecycle (trial end, grace, read-only), invoices without payment, owner template library for Basic, ticket uploader | Status: Approved (session ff4c803f), not built
REVISION HISTORY:
- v1.3.1 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §2c: waivers / deductions as a discount or a credit memo (user)
- v1.3.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §2c: usage visible to company + organization admins (user: "so there will be no bill shock"); what can be measured today; Daloy meters + issues a usage statement, invoices come from a billing / accounting system; O6 = monthly active users; O7-O8
- v1.2.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | U10 (user): usage above the plan's allowance is billed as add-ons (users per block, tickets above the average) - no forced upgrade; §2c rules, guardrails, build impact; O1-O6 open
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | U9 (user, session 017zmKf6): four plans - Basic, **Basic+** (Basic + Payroll pack + HR pack), Advanced, Enterprise; packs on / off per company / organization on Advanced and Enterprise; §2b packs + build impact (P1 was built with three plans)
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created from plan ~/.claude/plans/create-a-plan-how-soft-comet.md Part B (session ff4c803f)
===============================================================================
-->

# PLAN — Plans + subscriptions per company (AppScript v10.2)

## Context
JARVIS is multi-tenant, but every company gets every feature with no limits. The user wants three **sellable levels per company**, Basic, Advanced and Enterprise, with a subscription lifecycle and **no payment integration yet**.

The design depends on:
- v10.0: visibility, `getCreatableTicketTypes`, `email_outbox`;
- v10.1: `companyClock` for every date (`docs/planning/PLAN_CountryCalendars_TimeZones_20261031.md`).

There is no tier, plan or feature-flag concept in the code today. The closest pattern is the per-ticket-type switches (`setTicketTypeFeatures`, locked once used).

**User decisions (31 Oct 2026, session ff4c803f):**

| # | Decision |
|---|---|
| U1 | Plans are sellable, with a lifecycle; billing records only, no payment gateway |
| U2 | Plans set **features + limits**; per-company overrides by the platform admin |
| U3 | A downgrade takes effect **at plan end**; until then the current plan runs |
| U4 | Period end without renewal → **14-day grace → company read-only** |
| U5 | Basic ticket types: **owner templates + light edits**, and **owner-managed setup**; custom types are a **paid add-on** |
| U6 | Ticket uploader: **Advanced = own tickets, Enterprise = on behalf** |
| U7 | **Settable trial end** |
| U8 | Per-user display time zone is **Advanced and up** (built in v10.1, gated here) |
| U10 | *(1 Nov 2026)* **Usage-based add-ons instead of forced upgrades:** going over a plan's **users** or **tickets** allowance is billed as add-ons (users per block of X, tickets above the average use) - the company keeps its plan. Features still need the higher plan - §2c |
| U9 | *(1 Nov 2026)* **Four plans:** Basic · **Basic+** (= Basic + **Payroll pack** + **HR pack**) · Advanced · Enterprise. Advanced and Enterprise include both packs and can **turn each pack on or off** for a company (and, once organizations exist, an organization) that doesn't need it - §2b |

**Version line:** v10.0 → v10.1 calendars / zones → **v10.2 = this plan** → v10.3 head approval / delegation / bulk → v10.4 comments and the rest. The Advanced features in v10.3 / v10.4 ship already gated.

---

## §1 Principles
- **The server decides (F1).** The catalogue lives in AppScript, and the frontend copy is for display only.
- **Never gated:** sign-in, allow-list, invites, audit logs, code lock, visibility, Restricted masking once it's on.
- **Never break a live ticket.** A downgrade, grace or read-only never stops a moving ticket. It only blocks new use and config edits.
- **Higher plans include everything in lower ones.**

---

## §2 Plan catalogue: `PLAN_CATALOG` (proposal, editable before the build)

| Area | Basic | Advanced | Enterprise |
|---|---|---|---|
| Ticket types: adopt owner templates + light edits (§2a); owner-managed setup; paid custom types | ✓ | ✓ | ✓ |
| Build your own types / fields / steps (`type_builder`) | – | ✓ | ✓ |
| Core loop: custom fields (text / paragraph / date / amount / dropdown), single-level dropdowns, approval steps any / all, cancel / return / reject / reopen, dashboard, paging + search, visibility, who-can-create, comment requirements, attachment links, in-app bell, standard report + CSV, company time zone + country calendar | ✓ | ✓ | ✓ |
| Per-user display time zone (`user_timezone_display`) | – | ✓ | ✓ |
| Conditional routing, chained tickets, task steps, copy workflows, dependent dropdowns, `date_range` field | – | ✓ | ✓ |
| Step SLAs, company SLA rules, company holidays, SLA escalation, SLA analytics | – | ✓ | ✓ |
| Email notifications (outbox) + company email settings | – | ✓ | ✓ |
| Tags + sharing, report configuration, expiring-assignments view | – | ✓ | ✓ |
| Ticket uploader, self (`bulk_upload`, ≤ 200 rows per upload) | – | ✓ | ✓ |
| Head approval, delegation, bulk approve (v10.3); comments / mentions / watchers, drafts (v10.4) | – | ✓ | ✓ |
| Ticket uploader, on behalf (`bulk_upload_on_behalf`, ≤ 2,000 rows, saved mappings, scheduled / API import later) | – | – | ✓ |
| Restricted tickets + fields, config export / import / backup, cross-company links, admin audit-log viewer, user profile / role types with custom fields, webhooks + task callback (v10.4) | – | – | ✓ |
| **Limits:** active users / ticket types / steps per type / tickets per month | 25 / 5 / 3 / 500 | 200 / 25 / 10 / 5,000 | 2,000 / ∞ / 30 / 50,000 (Sheets ceiling, `PLAN_FeatureGaps_Volume_20261031.md` §5.5) |
| Trial (§4a) | – | default: Advanced, `trial_end` set by the platform admin | if the platform admin picks it |

Keys are stable strings (`conditional_routing`, `sla_escalation`, `restricted`, `type_builder`, `bulk_upload`, …). Limit keys: `users`, `ticket_types` (adopted + own), `steps_per_type`, `tickets_per_month`.

### §2a Basic ticket types come from the software owner (U5)
- **Template library:** a company flagged `companies.is_template_library = true`. Only platform admins can edit it, and `createTicket` refuses it.
  - Its ticket types, custom fields, workflow steps, comment requirements and dropdowns are the templates.
  - Each template carries `ticket_types.template_min_plan`, computed from the features it uses (a template with conditions is Advanced).
  - Each also carries `template_visibility` (`public` | `private:<company_id>`).
- **Adopt (self-serve):** `adoptTemplate({ company_id, template_ticket_type_id })`.
  - It wraps the v9.3 `importConfiguration` (library → company, dry run first), so there's no new copy logic.
  - Refused when the template's `min_plan` is above the company's plan, or at the `ticket_types` limit.
  - The copy is independent (the spec's workflow independence). `adopted_from_template_id` + `adopted_at` record where it came from. "Update from template" is not planned.
- **Basic light edits** (`type_builder` off). Allowed:
  - type name / description;
  - field label, `is_hidden`, `sort_order`;
  - step name;
  - `setStepApprovers` (roles);
  - comment requirements;
  - users / roles / assignments.

  Refused (`PLAN_REQUIRED: type_builder`):
  - `createTicketType`, `createCustomField`, `deleteCustomField`, `createWorkflowStep`, `deleteWorkflowStep`, `copyWorkflowSteps`, `saveStepConditions`;
  - field type / dropdown changes.

  Handled by an `ALLOWED_FIELDS_WHEN_NO_BUILDER` map per update route.
- **Managed setup:** a platform admin can do any company-admin action in any company (adopt, map roles, assign users, invite), logged with `acting_as_platform: true` + `company_id`.
  - The plan gate still applies inside the company, so a Basic company can't hold Advanced config through the back door.
- **Paid custom type (add-on):** built in the library as `template_visibility = private:<company_id>` (at or below the company's plan). It's adopted the same way and invoiced as a line item (§3).
- **Advanced and up** have `type_builder`: the full builder, and they can adopt public templates too.
- **Screens:**
  - Admin → Ticket Types → **Template gallery**: preview fields / steps, adopt.
  - Platform → **Template library**: the normal builders opened on the library company, plus publish / private-to.

### §2b Ticket uploader (U6)
- **Flow:** CSV / XLSX parsed in the browser (no new dependency unless `docs/reference/PRODUCTION_REQUIREMENTS.md` is updated first).
  1. Company + ticket type (`getCreatableTicketTypes`, v10.0).
  2. Column mapping to title + custom fields (dropdowns match label or value).
  3. Preview with per-row validation from `validateBulkTickets` (server dry run, writes nothing).
  4. Create.
- **`bulkCreateTickets({ company_id, ticket_type_id, rows (max 25 per call), on_behalf, upload_id })`:**
  - Each row runs the normal `createTicket` path: `canCreateTicket`, required / comment rules, numbering inside the lock, head snapshot, routing, participants, notifications batched.
  - Each row is its own all-or-nothing unit, and the response is `{ results: [{ row, success, ticket_number | error }] }`.
  - One `withScriptLock` per call, with the cache shared across rows and writes batched per tab.
  - A 4-minute guard returns the rest as `not_processed`. Same pattern as bulk approve (`PLAN_FeatureGaps_Volume_20261031.md` §4.7).
  - The frontend sends chunks of 25, shows progress, and offers the failed rows as a CSV download.
- **Idempotent:** `tickets.bulk_upload_ref` = `upload_id:row`; a re-sent chunk skips rows already created.
- **On behalf (Enterprise):**
  - `requester_email` must be an active user who could create that type themselves (`canCreateTicket` for **them**).
  - `requester_id` = them, `created_by` = the actor, plus a history line "Filed on behalf by …".
  - The head snapshot and the Restricted chain follow the requester.
  - Only admins or holders of a role flagged `roles.can_file_on_behalf` on that type + company can do it.
- **Limits:** rows per upload by plan (200 / 2,000). Every row counts toward `tickets_per_month`; the rows past the limit are refused up front.
- **Saved mappings (Enterprise):** `bulk_upload_mappings` (`id`, `company_id`, `ticket_type_id`, `name`, `mapping` json, audit).
- **Screen:** Tickets → **Upload tickets** (`<PlanGate feature="bulk_upload">`), with the on-behalf switch behind `bulk_upload_on_behalf`.

---

## §2b Packs (U9)
A **pack** is a set of owner templates for one business area, sold as a feature:
| Pack | Templates | Source |
|---|---|---|
| **Payroll pack** (`payroll_pack`) | Leave, Leave cancellation, Overtime (regular / rest day / holiday), Undertime, Official business, Change of schedule, Non-punching authorization, Manual DTR, Payroll concern | `docs/design/TEMPLATES_PayrollRequests_20261101.md` |
| **HR pack** (`hr_pack`) | Certificate of Employment (CE + CB, or one conditional CE on Advanced+), more to come | `docs/design/TEMPLATES_HRRequests_20261101.md` |

| | Basic | **Basic+** | Advanced | Enterprise |
|---|---|---|---|---|
| Payroll pack | – | ✓ always on | ✓ **on / off** | ✓ **on / off** |
| HR pack | – | ✓ always on | ✓ **on / off** | ✓ **on / off** |
| Everything else | Basic column of §2 | **same as Basic** | §2 | §2 |
| Limits | 25 / 5 / 3 / 500 | 25 / 5 / 3 / 500 **+ pack types don't count** toward `ticket_types` (P2) | §2 | §2 |

**Rules (proposed)**
- **P1 - Toggle:** a company setting per pack (`pack_payroll`, `pack_hr`: on / off), default **on**, editable by the
  company admin on Advanced / Enterprise. With organizations (`PLAN_ServerCore_OrgSheetBridge_20261101.md`), the
  organization setting is the default for its companies and a company can turn a pack **off** but not on when the
  organization has it off.
- **P2 - Limits:** pack ticket types **don't count** toward the `ticket_types` limit (the pack is what Basic+ pays
  for). Other limits unchanged; `tickets_per_month` for Basic+ = open (P4).
- **P3 - Turning a pack off:** its templates can't be adopted; adopted pack ticket types are **deactivated for new
  tickets** (existing tickets stay readable, in reports and exports, and can finish their workflow); turning it on
  again reactivates them. No data is deleted.
- **P4 - Basic+ ticket volume:** payroll / HR requests add volume (25 users × several a month). Proposed: Basic+
  `tickets_per_month` = **1,000** (Basic 500) - to confirm.
- **P5 - Shapes:** Basic+ gets the pack templates in their **no-condition shape** (e.g. HR CE + CB as two types);
  Advanced+ may adopt the conditional shape.
- **P6 - Packs on Basic as add-ons:** not offered - Basic+ *is* Basic with the packs.

**Build impact (P1 of this plan was built with three plans)**
| Where | Change |
|---|---|
| `PLAN_ORDER`, `PLAN_FEATURE_TIERS`, `PLAN_LIMITS`, `normalizePlan` (AppScript v10.2) | add `basic_plus` between basic and advanced; feature keys `payroll_pack`, `hr_pack` in `basic_plus` (inherited upward) |
| `src/config/plans.js` + `/plans` page | four columns; `npm run check:api-contract` (plan-copy) must pass |
| `company_subscriptions.plan` | accepts `basic_plus`; existing rows unchanged |
| Gate | `requireFeature(company, 'payroll_pack')` **and** the company toggle; adoption refuses an off pack; ticket creation refuses a deactivated pack type |
| `ticket_types` | a `pack` column (`payroll` / `hr` / empty) so the limit and the toggle know which types belong to a pack |
| Template library | `template_min_plan` = `basic_plus` for pack templates; conditional shapes = `advanced` |
| Tests | `ROUTES_TEST_v10.2.js`: Basic refused a pack, Basic+ allowed, Advanced toggle off → adoption refused + creation refused + old ticket readable; limit ignores pack types |

## §2c Usage add-ons (U10)
Today `requireLimit` **refuses** the next user / ticket at the limit ("upgrade or ask the platform admin"). U10 turns
the **quantity** limits into **allowances**: above them the company keeps working and pays for what it uses, without
changing plan. **Features** (conditional routing, SLAs, Restricted...) still come only with the higher plan.

| Limit | Becomes | Billed as (proposal) |
|---|---|---|
| `users` (active users) | allowance | **blocks of X users** (O1: X = 5) above the allowance, on the **peak** active users of the month |
| `tickets_per_month` | allowance | **blocks of N tickets** (O1: N = 250 on Basic / Basic+, 1,000 on Advanced, 5,000 on Enterprise) above the allowance, on the **3-month rolling average** (O2) |
| `ticket_types` | stays a limit | extra types = the existing **paid custom type** add-on (U5) |
| `steps_per_type`, `upload_rows` | stay hard | structural / per-upload caps |
| Technical ceilings (Sheets volume: 50,000 tickets / month; a Sheet organization's 10M cells) | stay **hard** | never sold past - platform storage / Postgres instead |

**"Above average use" (O2):** ticket volume for payroll / HR requests spikes around cut-offs and year-end. Billing
tickets on the **3-month rolling average** (this month + the two before) charges sustained growth, not one busy
month. A company that is over in one month and under in the next two pays nothing extra. Users are billed on the
month's peak (seats are not seasonal).

**Guardrails (customer trust)**
- **G1 - Choice per company:** `overage_mode` = **allow** (keep working, billed) or **stop** (today's refusal at the
  allowance). Set at onboarding; the company admin can change it (O3: default).
- **G2 - Spend cap:** with `allow`, an optional monthly cap (amount or blocks); at the cap it behaves like `stop`
  until next month or until the admin raises it.
- **G3 - Warnings:** bell + email to company admins at **80 %** and **100 %** of an allowance and at every new block;
  *Plan & usage* shows allowance, used, blocks so far and the estimated add-on amount.
- **G4 - Upgrade hint, never forced:** when the add-ons would cost more than the next plan, *Plan & usage* says so
  ("Advanced would cost ₱X less this month") - the company decides.
- **G5 - Prices:** none set yet (website decision W2: no prices). Block prices live in one table per plan
  (`ADDON_PRICES`), set by the platform admin; per-company overrides as for limits (U2).

**Usage visible to the admins - no bill shock (user, 1 Nov 2026)**
A *Usage & charges* page, always current, for:
- **company admins** - their company;
- **organization admins** (once organizations exist, `PLAN_ServerCore_OrgSheetBridge_20261101.md`) - every company
  of the organization **and the organization total** (the billing level, ServerCore O3);
- platform admins - everyone.

| On the page | Detail |
|---|---|
| **This month so far** | per allowance: used / included, a bar, add-on blocks started, the amount so far |
| **Month-end projection** | run rate (used ÷ days elapsed × days in month) → projected blocks and amount, labelled as an estimate |
| **Tickets: the 3-month average** | the three months used for billing, so a busy month is visibly not charged on its own |
| **What counts** | plain rules ("users who signed in this month", "tickets created, incl. cancelled") next to each number |
| **The detail behind every number** | the list of counted users / tickets for the month, downloadable (CSV) - the admin can check every unit |
| **Settings** | `overage_mode` (allow / stop), the spend cap, alert levels (default 80 % / 100 % / each block) |
| **History** | 12 months: usage, blocks, statement amounts |
| **Upgrade hint** | G4 - only when the next plan would cost less; never automatic |

**Alerts:** bell + email to the company admins (and the organization admins for the organization total) at each alert
level, at every new block, and when the projection crosses the cap; a **weekly digest** while any allowance is above
80 %. Nothing is ever charged that the page didn't show first.

**What can be measured today (v10.2 code, 1 Nov 2026)**
| Measure | Today | Needed |
|---|---|---|
| Tickets per month | ✅ `usage:<company>:<YYYYMM>` counter (company calendar month), incremented in `createTicket`'s lock - cancelled, uploaded and chained tickets included | billable-rule decision (O7); backfill months before the v10.2 deploy from `tickets.created_at`; the 3-month average needs no new data |
| Users | ⚠️ point-in-time only (`companyUserIds`: counting roles **+ pending invites**); a user with roles in two companies counts in both | a **monthly active users** record (who signed in in the month) or a daily seat snapshot; pending invites never billed; count once per organization when billing moves there |
| Prices, blocks, mode, cap | ❌ | new settings / tables |

**Metering vs invoicing (recommendation)**
- **Daloy meters and states:** counters, the add-on calculation (blocks × price), the *Usage & charges* page, and a
  monthly **usage statement** per company / organization, exported (CSV / API).
- **A billing / accounting system issues the invoice:** VAT / non-VAT, BIR rules (since the EOPT Act a
  computer-generated invoice must come from a BIR-registered system - confirm with the tax adviser), credit notes,
  payments, collections, 2307 withholding. Daloy's own record stays a *statement*, not an official invoice.
- Unpaid charges follow the normal grace → read-only rules (U4).
- **Waivers / deductions** (platform owner, Terms §6.5): given as a **discount** on the invoice or a **credit memo**
  issued to the customer from the billing / accounting system; Daloy's statement shows them and links the memo.
- **Where it is built:** the cloud server (`PLAN_ServerCore` - the Apps Script feature freeze). Until then: limits run
  in `stop` mode, or the platform team reviews overages by hand from the counters.
- Trials: no add-ons; a trial at its allowance behaves like `stop` (O5).

**Build impact**
| Where | Change |
|---|---|
| `requireLimit` (AppScript v10.2) | for `users` / `tickets_per_month`: with `overage_mode = allow` and under the spend cap and the technical ceiling → allow and log `PLAN_OVERAGE`; otherwise refuse as today |
| Usage | `usage:<company>:<YYYYMM>` (tickets, exists) + a **peak users** counter `usage_users:<company>:<YYYYMM>` updated on activation / invite acceptance |
| `company_subscriptions` | `overage_mode`, `overage_cap`; invoice line kinds `addon_users`, `addon_tickets` |
| Catalogue copy / `/plans` | each plan card: "Need more? Users in blocks of 5, tickets in blocks of 250 - billed only when used" (`check:api-contract` plan-copy extends to block sizes) |
| Plan & usage screen | allowance vs used, blocks, estimate, mode + cap setting, upgrade hint |
| Tests | allow / stop / cap; rolling average (over one month, under two → no charge); peak users; trial = stop; ceiling stays hard |

**Open (O1-O8)**
| # | Question | Proposed default |
|---|---|---|
| O1 | Block sizes | Users: 5. Tickets: 250 (Basic / Basic+), 1,000 (Advanced), 5,000 (Enterprise) |
| O2 | Tickets on the month or the 3-month rolling average | **Rolling average** (seasonal payroll / HR spikes) |
| O3 | Default `overage_mode` for new companies | **allow, with a cap agreed at onboarding** (no surprise refusals; no surprise bills) |
| O4 | Do add-ons apply on every plan? | Yes - Basic, Basic+, Advanced, Enterprise |
| O5 | Trials | No add-ons; `stop` at the allowance |
| O6 | Who counts as a billable user | **Monthly active users** (signed in at least once in the month) - fair for occasional requesters (the requester one-pager); needs the sign-in record |
| O7 | Which tickets are billable | Requester-created tickets incl. cancelled and uploaded; **not** workflow-chained tickets |
| O8 | Who sees *Usage & charges* | Company admins (own company), organization admins (all its companies + total), platform admins |

## §3 Schema (v10.2 rebuild apply via `ensureTableSheet`; `rowFromRecord`; `requireColumns`)
- **`company_subscriptions`:** `id`, `company_id`, `plan` (`basic|advanced|enterprise`), `status` (`trial|active|converted|cancelled`), `period_start`, `period_end`, `trial_end` (for trial rows `period_end` = `trial_end`), `trial_extended_count`, `grace_days` (14 paid / 7 trial), `scheduled_plan`, `scheduled_reason`, `feature_overrides` (json), `limit_overrides` (json), `billing_reference`, `notes`, plus audit columns.
  - One row per period, so the history is kept.
  - The in-force row is the one whose period covers now, otherwise the latest one.
- **`subscription_invoices`:** `id`, `invoice_number` (`INV-YYYY-#####` via `sequence_counters`, A18; the year from the platform's country calendar), `company_id`, `subscription_id`, `plan`, `period_start`, `period_end`, `lines` (json `[{ kind: plan|custom_type|setup, description, amount }]`), `amount` (= the sum), `currency` (PHP default; per company later), `status` (`issued|paid|void`), `issued_at`, `paid_at`, `paid_reference`, `recorded_by`, plus audit columns. Payment is recorded by hand.
- **`subscription_events`:** `id`, `company_id`, `subscription_id`, `event` (`trial_reminder_7|3|1|0`, `reminder_30|7|1`, `grace_started`, `read_only`, `renewed`, `upgraded`, `downgraded`, `converted`), `sent_at`. This is the reminder idempotency key (A19).
- **`bulk_upload_mappings`** (§2b).
- **Columns:** `companies.is_template_library` (false), `companies.trial_used` (false); `ticket_types.template_min_plan`, `template_visibility` (`public`), `adopted_from_template_id`, `adopted_at`; `tickets.bulk_upload_ref`; `roles.can_file_on_behalf` (false).
- **Usage counter:** `sequence_counters` row `usage:<company_id>:<YYYYMM>` (month from the company's country calendar, v10.1), incremented inside `createTicket`'s lock. O(1), with no tickets scan.
- **Migration** `seedCompanySubscriptions()` (dry run / apply, JARVIS Admin, idempotent): every existing company gets **Enterprise, active, 12 months, note "legacy"**. Nothing breaks on deploy.

---

## §4 Effective state (computed from dates per request; every date is **end of day in the company time zone** via `companyClock`)
`trial|active` → `period_end` → **grace** (full plan, banner + reminders) → **read_only** → a renewal makes it `active` again.

- **Upgrade:** immediate. It closes the current row and opens a new period.
- **Downgrade:** sets `scheduled_plan`, which applies at `period_end`. The renewal row gets the new plan.
- **After a downgrade:**
  - higher-level config is kept but read-only;
  - tickets in flight finish on their current path (routes, SLA, head step);
  - new use is refused with `PLAN_REQUIRED`;
  - over a limit, nothing is deleted, but creating more is refused until usage is under the limit.
- **read_only:** every write is refused with `COMPANY_READ_ONLY`, except `READ_ONLY_ALLOWED`:
  - finishing in-flight tickets: `submitStepApproval` (approve / return / reject), cancel;
  - `recordLogin`, `markNotificationsRead`, `updateUserPreferences`, link report.
  - Reads and CSV export still work.

### §4a Trial end (U7)
- **`startTrial({ company_id, plan: advanced|enterprise, trial_end })`** (platform only): default today + 30 days, end of day in the company zone. One trial per company (`companies.trial_used`); a second is refused, and the current one can be extended instead.
- **`setTrialEnd({ company_id, trial_end, reason })`** (platform only):
  - not before today; extend or shorten;
  - `trial_extended_count` +1, `admin_action_logs` `TRIAL_END_SET` (from → to, reason);
  - setting it during the trial grace reopens the trial.
- **Convert during the trial:** `setCompanyPlan` opens a paid period starting the day after `trial_end`, so the remaining trial days are kept; the trial row becomes `converted`. A plan below the trial's level also starts after `trial_end` (same rule as a downgrade).
- **When `trial_end` passes without converting:** a **7-day trial grace** (full trial features, banner "Trial ended on …, choose a plan") → **read_only** until a plan is set. Nothing is deleted. Config made during the trial follows the downgrade rule once a lower plan is chosen.
- **Reminders:** 7 / 3 / 1 / 0 days before `trial_end`, grace start, read-only. Sent once each (A19), at a local morning hour in the company zone, to the company admins + platform admins.
- **UI:**
  - a header chip "Trial: N days left" for company admins;
  - Platform → Plans: the trial end, "Extend trial" (date + reason), "Convert";
  - Company → Plan & usage: the trial end date.

---

## §5 Gate (AppScript)
- **`companyPlan(companyId)`** reads `company_subscriptions` once per request (A16, cached): `{ plan, state, features, limits, period_end, trial_end, days_left }`, with the overrides merged in.
- **Central gate in `doPost`**, after `authenticateRequest` and the v9.6 admin check: `checkPlanGate(action, data)`, driven by `PLAN_GATED_ACTIONS` (`action → { feature, company: 'payload' | 'ticket' | 'ticket_type+company' }`).
  - Refusals: `{ success: false, status: 'error', code: 'PLAN_REQUIRED', feature, required_plan, current_plan, error }` / `{ code: 'COMPANY_READ_ONLY' }`.
  - For global config (`company_id` blank), the gate uses the company of the action's context.
- **In-handler `requireFeature(companyId, key)`** where the feature depends on a field:
  - steps with `step_type = task`, `next_ticket_type_id` or conditions;
  - `date_range` / dependent fields;
  - `setTicketTypeFeatures` switches (tags / sharing / Restricted / head);
  - `on_behalf`;
  - a `display_timezone` save.
- **Limits** checked on create: a user added to the company (invite / profile / role assignment), a type created / adopted, a step created / copied, a ticket created / uploaded. Counts come from tabs already in the request cache.
- **Platform admin** (company admins must not self-serve plans):
  - Script Property `PLATFORM_ADMIN_UIDS` and `isPlatformAdmin(actorId(...))`;
  - `PLATFORM_ONLY_ACTIONS` next to `ADMIN_ONLY_ACTIONS`;
  - bootstrap while the property is empty: any active admin, logged `PLATFORM_BOOTSTRAP` (the v9.6 stance).
- **Routes:**
  - reads: `getCompanyPlan` (own companies; platform admin: any), `getPlanCatalog`, `getSubscriptionHistory`, `getInvoices`, `getTemplates`;
  - platform writes: `startTrial`, `setTrialEnd`, `setCompanyPlan` (upgrade now / schedule downgrade / cancel the schedule / convert a trial), `renewSubscription`, `setSubscriptionOverrides`, `issueInvoice`, `markInvoicePaid`, `voidInvoice`, `publishTemplate`;
  - company writes: `adoptTemplate`, `validateBulkTickets` (read-only), `bulkCreateTickets`, mapping CRUD.
  - Every write goes through `logAdminAction` + `requireColumns`.
- **Reminders:** `runSubscriptionReminders` on the existing 15-minute trigger (bounded, A19), going out through the v10.0 `email_outbox` and the company email settings.
- **Checks:**
  - `check:code-rules`: every `PLAN_GATED_ACTIONS` key is routed; every `requireFeature` key exists in `PLAN_CATALOG`.
  - `check:api-contract`: frontend plan keys ⊆ server catalogue keys.

---

## §6 Frontend
- **`src/config/plans.js`:** plan names, feature labels, "Available on Advanced". Display only.
- **`UserContext`** loads `getCompanyPlan` with the user data (no extra call per screen, F5), exposed as `usePlan(companyId)` → `hasFeature`, `limit`, `usage`, `state`, `trialEnd`.
- **`<PlanGate feature companyId>`** wraps the gated UI: workflow builder (conditions / task / chain), SLA screens, tags / sharing, Restricted switches, export / import, report config, uploader, display time zone. It shows a locked card instead of the control; the server still refuses on its own.
- **Banners:** trial (days left), grace (amber), read-only (red). `googleSheet.js` maps `PLAN_REQUIRED` / `COMPANY_READ_ONLY` to toasts.
- **Screens** (mounted, A12 / P5; added to `docs/reference/DEPENDENCY_MAPPING.md` / `docs/reference/DEVELOPMENT_PLAN.md`):
  - **Platform → Plans & subscriptions**: company list with plan / state / period / trial / usage vs limits; change plan, renew, extend trial, overrides;
  - **Platform → Invoices**: issue with lines / mark paid / void / print view;
  - **Platform → Template library**;
  - **Admin → Company → Plan & usage** (read-only, with the company's invoices);
  - **Ticket Types → Template gallery**;
  - **Tickets → Upload tickets**.

---

## §7 Postgres (goes into the migration plan)
- The same tables.
- Indexes `company_subscriptions(company_id, period_end desc)` and `subscription_invoices(company_id, issued_at desc)`.
- The plan is resolved inside the existing scope query (`PLAN_FeatureGaps_Volume_20261031.md` §6.3), so it adds 0 to the query budget.
- The usage counter takes a row lock on `sequence_counters` in the create transaction.

---

## §8 Tests: `appscript_files/tools/ROUTES_TEST_v10.2.js`
Enforce mode, fake clock, run in `TZ=UTC` and `TZ=Asia/Manila`.

- **Gate and limits:** the gate matrix (each plan × each gated action and in-handler check); limits at the edge (N allowed, N+1 refused) and overrides.
- **State machine:** trial → active → grace → read_only → renew. The downgrade applies only at `period_end`. An in-flight ticket on a gated route / SLA / head step still finishes after a downgrade and in read-only. The read-only allow-list.
- **Trial:**
  - default +30 days; set / extend / shorten (not before today) logged from → to;
  - a second trial refused;
  - conversion starts the day after `trial_end`;
  - 7-day grace → read_only; setting `trial_end` again in grace reopens it;
  - reminders sent once;
  - end of day in a **non-Manila** company zone (fake clock at 23:59 / 00:01 local).
- **Templates:**
  - a Basic company adopts a public Basic template (copied and independent);
  - an Advanced template on Basic is refused;
  - a private template is visible only to its company;
  - the library refuses tickets;
  - light edits allowed, builder routes / field-type changes refused;
  - managed setup logged and still gated.
- **Uploader:**
  - Basic refused, Advanced self only, Enterprise on behalf;
  - the dry run writes nothing;
  - a 25-row chunk with one bad row: 24 created, 1 error;
  - a re-sent chunk creates no duplicates;
  - the time guard;
  - an on-behalf requester without a role is refused;
  - head / Restricted follow the requester;
  - the monthly limit at the edge.
- **Other:**
  - a `user_timezone_display` save is refused on Basic;
  - invoice lines sum to `amount`, and the invoice sequence;
  - migration dry run / apply / re-apply adds nothing;
  - the platform-only actions and the bootstrap;
  - read-count assert: the gate adds ≤ 1 tab read.
- All older suites on the new file. Existing companies are seeded Enterprise, so they keep passing.
- **Then:** `check:api-contract`, `check:code-rules`, `build:ci`, `/code-review` on the v10.1 → v10.2 diff (P7), logged in `docs/planning/TODO_CodeReview_<YYYYMMDD>.md`.

---

## §9 Deploy (deploy guide "v10.2" section)
1. Rebuild dry run → apply.
2. `seedCompanySubscriptions` dry run → apply.
3. Set the Script Property `PLATFORM_ADMIN_UIDS`.
4. Create the template library company and publish the first templates.
5. Redeploy (ping `10.2.0`), then the frontend from the same commit, then the Vercel check.
6. Set each real company's plan from Platform → Plans.

## §10 Open defaults (can change before the build)
- Catalogue mapping and limit numbers (§2).
- Trial: default Advanced, +30 days, 7-day trial grace, one per company.
- Paid grace: 14 days.
- PHP currency; `INV-YYYY-#####`.
- Legacy companies → Enterprise for 12 months.
- Uploader caps: 200 / 2,000 rows.
- Platform bootstrap = any active admin while `PLATFORM_ADMIN_UIDS` is empty.
