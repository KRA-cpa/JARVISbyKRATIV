<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_PlatformManager_20261106.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 6 November 2026 UTC+8 (Philippine Standard Time) | Modified: 6 November 2026 UTC+8 (Philippine Standard Time)
Purpose: One plan for the Platform manager - the software owner's console (KRATIV / platform admins): customers, plans + subscriptions, usage + statements, prices, leads, template library, health, support access, platform admins, audit | Status: Draft (cloud session 017zmKfA) - decisions PM-D1..D10 open, not built
REVISION HISTORY:
- v1.0.0 | 6 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "Plan the platform manager". Collects the "Platform → ..." screens scattered over PLAN_PlanTiers_Subscriptions (§2a, §2c, §4a, §6), PLAN_PlatformWebsite (W2, W3), PLAN_ServerCore_OrgSheetBridge (§2, §4a, §6a, §6b) and PLAN_CountryCalendars (§4), and adds what none of them covers (support access, platform roles, re-auth, the coexistence with the Apps Script gate)
===============================================================================
-->

# PLAN — Platform manager (the software owner's console)

## Context

"Platform → Plans", "Platform → Invoices", "Platform → Template library", "Platform → Leads", "Platform → Country
calendars" are promised in four different plans, but no plan says **what the Platform area is as a whole, who may use
it, where it runs, or in what order it is built**. Today the platform owner works through:

| Need | Today (v10.2 live) |
|---|---|
| Who is a platform admin | Script Property `PLATFORM_ADMIN_UIDS` (empty = nobody, CR6-02 fix) |
| Set a company's plan / trial | **No route.** `seedCompanySubscriptions` (editor) gave every company Enterprise for 12 months; anything else = a hand-written `company_subscriptions` row in the Sheet |
| Exceptions | `setSubscriptionOverrides` (the only `PLATFORM_ONLY_ACTIONS` route) - no screen |
| See all companies' plans | `getCompanyPlan { all: true }` - no screen |
| Usage | `usage:<company>:<YYYYMM>` counters in `sequence_counters`; no monthly-active-users record |
| Prices | `src/config/plans.js` + `src/config/promo.js` (frontend copy, preview builds only) |
| Leads | `mailto:` (website W1) |
| Ops | JARVIS Admin menu in the Sheet (ADMIN_Tools v1.4), the public `/status` page |

**Constraints this plan works inside (already decided):**
1. **Apps Script feature freeze** (`PLAN_ServerCore_OrgSheetBridge_20261101.md` v1.1): no new feature routes in the
   Apps Script backend; new logic goes into the cloud server (`api/_lib/`).
2. **Billing lives in the platform store**, never in a customer's store (ServerCore §6a).
3. **Daloy meters and issues usage statements; an accounting system issues the official invoice** (PlanTiers §2c,
   EOPT / BIR-registered system - to confirm with the tax adviser).
4. **Interim one-customer rule** while admin rights are global (ServerCore §2).
5. Compliance A1–A22 / F1–F6 and the `Claude.md` non-functional targets apply to the server code as they do to Apps
   Script (A15 = actor from the verified session, every write audited, paginated lists).

---

## §1 What the Platform manager is

A section of the app at **`/platform`**, for **platform admins only** (KRATIV staff), separate from a company's
**Admin** area:

| | Admin (`/admin`) | Platform (`/platform`) |
|---|---|---|
| Who | company / organization admins (customers) | platform admins (KRATIV) |
| Reach | their company / organization | every customer |
| Typical work | ticket types, roles, users, SLA, email settings | plans, trials, usage, statements, prices, leads, templates, health, support |
| Data | Customer Data | KRATIV's records (contracts, usage, billing) + read-only views of customer metadata |

**Principles**
- **P-1 The server decides (F1).** Every Platform route checks `isPlatformAdmin` (and the platform role, §3) on the
  server; the `/platform` screens only hide what the server would refuse anyway.
- **P-2 Platform admins are not customer admins.** Seeing a customer's **tickets or field values** is not a platform
  right; it needs a support grant (§5). Customer **metadata** (company name, plan, usage counts, health) is.
- **P-3 Every platform write has a reason and an audit row** (who, when, what, from → to, reason), append-only.
- **P-4 Nothing the customer is charged for is invisible to them** (PlanTiers §2c "no bill shock"): every number on a
  statement is on the customer's *Usage & charges* page first.
- **P-5 Never break a live ticket** (PlanTiers §1): no platform action deletes customer data; suspensions and
  downgrades only stop new use.

---

## §2 Modules

| # | Module | Screens / actions | Source plan | Phase |
|---|---|---|---|---|
| M1 | **Overview** | Customers by plan / state; trials ending in 7 days; grace / read-only; statements overdue; new leads; unhealthy stores; last 20 platform actions | new | PM1 |
| M2 | **Customers** | List (search, filter by plan / state / country / storage), customer page: companies, admins (names + emails only), plan, usage, health, notes, history. Before organizations exist a customer = one company | ServerCore O2 | PM1 (companies), PM4 (organizations) |
| M3 | **Plans & subscriptions** | Start trial, set / extend trial end (reason), change plan (upgrade now / schedule downgrade / cancel the schedule / convert a trial), renew, cancel, overrides (features / limits), packs on / off (U9), overage mode + spend cap (U10 G1 / G2); subscription history | PlanTiers §4, §4a, §2b, §2c | PM1 |
| M4 | **Usage & statements** | Monthly usage per customer (tickets on the 3-month average, peak / monthly active users), add-on blocks, the monthly **usage statement** (lines in USD + BSP rate + PHP, setup fees in PHP, penalty lines, discounts / credit-memo references), statement status (draft → issued → paid / disputed / void), payments recorded by hand, CSV / API export for the accounting system | PlanTiers §2c, General Terms §5.1a / §5.3b / §6.5 | PM2 |
| M5 | **Price book** | Plan prices (USD / month, yearly), add-on block prices, one-time setup fees (PHP), promotions (founding-customer price: who, until when, how many seats left), effective dates; feeds the public `/plans` (W3) and new statements | PlatformWebsite §8, PROPOSAL_Pricing, `src/config/promo.js` | PM2 |
| M6 | **Exchange rates** | One row per month: BSP weighted average rate, source, entered by; the rate a statement used is frozen on the statement | PlanTiers §2c | PM2 |
| M7 | **Leads** | List, filter, mark contacted / discarded, **Convert** → customer + company + region + trial + invite to the contact | PlatformWebsite W2 | PM3 |
| M8 | **Template library + packs** | The library company opened in the normal builders; publish / private-to-a-customer; `template_min_plan`; Payroll / HR packs | PlanTiers §2a, §2b, TEMPLATES_* | PM3 |
| M9 | **Health & incidents** | Per customer store: last ping, down at / back at, cause (store unavailable vs provider outage); open incidents; banner control; goodwill-credit hours | ServerCore §6a, §6b | PM4 |
| M10 | **Support access** | Grants from customers, open sessions, break-glass log (§5) | new | PM4 |
| M11 | **Reference data** | Country calendars + holiday packs (today in Admin → Country Calendars: they are global, so they move here), plan catalogue (read-only view of `PLAN_CATALOG`) | CountryCalendars §4 | PM1 (move), PM2 |
| M12 | **Contract records** | Per customer: accepted General Terms / DPA versions + acceptance record, tax profile (withholding agent, CWT rate, Form 2307 received), notices sent (price changes need [[30]] days' notice - Terms §5.1b) | General Terms §0a, §5.1b; DPA | PM2 |
| M13 | **Platform team** | Platform admins and their roles (§3), last sign-in, audit log of platform actions | new (replaces the Script Property) | PM1 |

Not in scope: payment gateway (U1), the official invoice (accounting system), customer-facing *Usage & charges* page
(PlanTiers §2c - built alongside M4, but it is a company / organization screen, not a Platform one).

---

## §3 Who may do what (platform roles)

One person runs the platform today; roles cost little now and avoid a rewrite when a second person joins.

| Role | May | May not |
|---|---|---|
| `owner` | everything, incl. the platform team and price book | - |
| `billing` | M3 plan changes, M4 statements / payments, M5 / M6, M12 | support access, platform team |
| `support` | M2 read, M7 leads, M8 templates, M9 health, request support access (§5) | plan / price / statement changes |
| `viewer` | read every Platform screen | any write |

- Stored in the platform store (`platform_admins`: uid, email, role, added_by, added_at, removed_at). The Script
  Property `PLATFORM_ADMIN_UIDS` stays the Apps Script side's copy until the gate moves to the server (§6).
- **Re-authentication for sensitive actions** (plan change, override, statement issue / void, price change, platform
  team change, break-glass): the Firebase ID token's `auth_time` must be ≤ 15 minutes old, else the API answers
  `REAUTH_REQUIRED` and the screen asks the admin to sign in again. Checked at the proxy / server, not in the browser.
- **Account hygiene:** platform admins sign in with a KRATIV Workspace account with 2-step verification enforced by
  the Workspace admin (Firebase alone can't enforce MFA on Google sign-in).
- **Separation:** a platform admin who is also a member of a customer company acts there as that company's user, not
  as platform (no implicit elevation).

---

## §4 Data (platform store - Neon Postgres)

| Table | Holds |
|---|---|
| `platform_admins` | §3 |
| `customers` | id, name, country, status (`prospect` / `active` / `suspended` / `ended`), billing contact, notes. Becomes `organizations` in PM4 (same id) |
| `customer_companies` | customer_id → Apps Script `company_id` (+ name / code mirrored for search) |
| `subscriptions` | PlanTiers §3 `company_subscriptions` columns + `customer_id`, `overage_mode`, `overage_cap`, `packs` |
| `subscription_events` | trial / renewal reminders sent (A19 key), grace started, read-only, upgraded, downgraded, converted |
| `usage_monthly` | customer, company, month (company calendar), tickets_created, tickets_billable, peak_users, active_users, source (counter / backfill), computed_at |
| `price_book`, `promotions` | M5, with `effective_from` / `effective_to` |
| `fx_rates` | M6 (month, rate, source, entered_by) |
| `statements`, `statement_lines` | M4; `statement_number` from a platform sequence (not a BIR invoice number); each line keeps USD, rate, PHP |
| `payments`, `credit_memo_refs` | recorded by hand; references to the accounting system's documents |
| `leads` | PlatformWebsite §4 `website_leads` columns |
| `support_grants`, `support_sessions` | §5 |
| `store_health`, `incidents` | ServerCore §6a / §6b |
| `contract_records`, `tax_profiles`, `customer_notices` | M12 |
| `platform_audit_log` | every platform write (actor, role, action, target, before, after, reason, request id); append-only (no update / delete grants for the app role) |

Query budgets (Claude.md): list screens paginated (50 / 100), indexed on `(status, plan)`, `(customer_id, month)`,
`(period_end)`; the Overview is one query per tile, ≤ 6 queries, ≤ 300 ms p95.

---

## §5 Support access to customer data (new)

Platform admins sometimes need to see a customer's tickets (a bug report, managed setup for Basic - PlanTiers §2a).
Today any admin sees everything (global admin, ServerCore §2), which the DPA's processor role doesn't support.

- **Grant by the customer:** an organization / company admin turns on *Allow Daloy support access* for N days (default
  7) with a scope (`metadata` / `configuration` / `tickets`). Shown on their Admin screen with an end date and a
  *Revoke* button.
- **Session:** a support admin starts a session against a grant (reason required); every request in it carries
  `acting_as_platform: true` + the grant id in the audit log; the customer's admins see the sessions list.
- **Break-glass** (no grant; security incident or legal order): `owner` only, reason required, re-auth, the customer's
  admins are notified within 24 h unless the law forbids it.
- **Managed setup** (PlanTiers §2a) = a `configuration` grant made at onboarding; the plan gate still applies inside
  the company.
- Until PM4: support work follows the interim rule (one outside customer) and is logged by hand.

---

## §6 Where it runs, and how it coexists with the Apps Script gate (decision PM-D1)

The Platform manager is **KRATIV's data** (contracts, usage, billing), so it belongs in the platform store from day one
(§6a) - it does not have to wait for the customer data migration. The catch: until the cloud server takes over, the
**plan gate runs in Apps Script** and reads the `company_subscriptions` tab of the platform Sheet.

| Option | How the gate learns about a plan change | Apps Script change | Risk |
|---|---|---|---|
| **A (recommended)** Neon is the source of truth; the server **projects** each subscription change into the platform Sheet's `company_subscriptions` tab through the **Sheets API** (a KRATIV service account, editor on KRATIV's own Sheet) | the projected row, read by the existing `companyPlan` | **none** (freeze kept) | writes outside the Apps Script lock (A5): only the projection writes that tab, rows are written by header name, and no rebuild runs while it is on (maintenance rule); a failed projection is retried and shown on M1 |
| B: small Apps Script platform routes (`setCompanyPlan`, `startTrial`, ...) and the UI calls them | the tab, written by Apps Script | P2 routes in Apps Script (breaks the freeze; ported again later) | two implementations of the lifecycle |
| C: wait for ServerCore O1 (gate on the server) | - | none | months with no plan / trial tooling; plans changed by hand in the Sheet |

**Recommendation: A.** It keeps the freeze, puts billing where §6a says it lives, and the projection is deleted the day
the gate moves to the server (O1). The reverse direction (usage counters, companies, sign-ins) is a **read** of the same
Sheet through the Sheets API (`sequence_counters` `usage:*` rows, `companies`, `admin_action_logs` login rows for
monthly active users), cached per request. Creating a company or sending an invite on **Convert** (M7) calls the
**existing** Apps Script routes (`createCompany`, `setCompanyRegion`, `createUserInvite`) through the proxy as the
platform admin, so there is still no new Apps Script code (those are `ADMIN_ONLY_ACTIONS`: the platform admin's uid
needs an active admin role on the Apps Script side until the gate moves to the server).

Projection rules (A):
- Rows written by header name (A1) in the exact v10.2 format: days as text `yyyy-MM-dd` (`holidayDay` reads them),
  `feature_overrides` / `limit_overrides` as JSON text, `is_active` boolean.
- Idempotent: keyed by the Neon subscription id = the row's `id`; re-running writes the same row.
- After each write the server reads the company's plan back through `getCompanyPlan` and compares plan / state /
  period - a mismatch fails the action and alerts M1.
- `PLATFORM_ADMIN_UIDS` is updated by hand when M13 changes (the server shows a reminder) - it gates only
  `setSubscriptionOverrides`, which the Platform manager no longer needs (overrides are projected too).

**Prerequisites (from the migration plan, needed by every option except C):** Neon Phase 0 (database, migrations,
`/api/rpc` handler registry, plain-Node handlers - O11 recommendation A), Vercel **Pro** before paying customers
(Hobby is non-commercial), a mail provider for platform notices (ServerCore §6), Vercel Cron for reminders.

---

## §7 Phases

| Phase | Content | Needs | Done when |
|---|---|---|---|
| **PM0** (now, no code) | Runbook for the interim: set `PLATFORM_ADMIN_UIDS`; how to add a trial / plan row by hand in `company_subscriptions` (columns, text days, overrides JSON) and check it with `getCompanyPlan`; usage = read the counters | - | runbook in `docs/guides/` |
| **PM1** | Server foundation for platform routes (handler registry, `isPlatformAdmin` + roles, re-auth check, `platform_audit_log`); `/platform` layout (lazy chunk, `noindex`); **M1 Overview**, **M2 Customers** (companies), **M3 Plans & subscriptions** (lifecycle of PlanTiers §4 / §4a incl. CR6-14c overrides carried to the next period, CR6-19 valid `period_end`, CR6-20 read-only), the §6 projection; **M13**; M11 country calendars moved under Platform | Neon Phase 0, PM-D1, PM-D3, PM-D4 | a trial started on `/platform` is enforced by the live Apps Script gate; trial reminders sent once (A19); route tests: non-platform caller refused, `billing` can't change the team, stale token → `REAUTH_REQUIRED` |
| **PM2** | **M4 Usage & statements** + the customer *Usage & charges* page, **M5 Price book** (+ public `getPlanPrices` for `/plans`, W3), **M6 Exchange rates**, **M12 Contract records**; monthly active users from login rows; backfill of months before v10.2 | PM1, PM-D2, PM-D5..D8 | a month closes into statements whose every line is visible on the customer's page; CSV export loads into the chosen accounting system |
| **PM3** | **M7 Leads** (W2: public `submitLead`, rate limit + captcha at the proxy, convert), **M8 Template library + packs** (adopt, `type_builder` gate - needs the gate on the server or a projection like §6) | PM1 | lead → trial customer with an invite in one action; Basic adopts a template |
| **PM4** | With ServerCore O1 / O2: customers become **organizations**, billing at the organization level (O3), **M9 Health & incidents**, **M10 Support access** (§5), the §6 projection removed | ServerCore O1 / O2 | admin rights scoped (interim rule lifted); support sessions logged and visible to customers |

Effort (rough, S = 1 … XL = 5): PM1 L (3) once Neon Phase 0 exists, PM2 L (3), PM3 M (2), PM4 M (2) on top of O1 / O2.
**Progress doc:** the plan screens (2 pts) and lifecycle (2 pts) are already in PROGRESS area "Plans + subscriptions";
support access, statements / FX / price book and contract records are new scope - proposed **+3 pts** (PM-D10).

---

## §8 Tests and checks

- Route tests for every Platform action: platform admin of the right role allowed; other role, company admin, plain
  user and unsigned caller refused with the same codes (`PLATFORM_ONLY`, `PLATFORM_ROLE`, `REAUTH_REQUIRED`).
- Lifecycle tests carried over from PlanTiers §8 (trial → active → grace → read_only → renew, downgrade at period end,
  end of day in a non-Manila company zone), run in `TZ=UTC` and `TZ=Asia/Manila`.
- Projection contract test: the row the server writes, read by the real `companyPlan` on the fake Sheets runtime
  (`appscript_files/tools/lib/fakeSheetsRuntime.js`), gives the same plan / state / days as the server computed.
- Statement tests: 3-month average (over one month, under two → no charge), peak users, USD → PHP at the frozen rate,
  penalty not charged on disputed / waived / withheld amounts, void keeps the number.
- Audit: every write leaves exactly one `platform_audit_log` row with a reason; the app's DB role can't update or
  delete that table.
- `check:code-rules`: Platform handlers import no Vercel modules (O11 portability); every Platform route is in the
  platform route list with a role.

---

## §9 Open decisions (proposed defaults)

| # | Question | Proposed default |
|---|---|---|
| PM-D1 | Coexistence with the Apps Script gate (§6) | **A**: Neon source of truth + Sheets-API projection; no Apps Script change |
| PM-D2 | Daloy "invoices" (PlanTiers §3 `subscription_invoices`, `INV-YYYY-#####`) vs statements (§2c) | **Statements only** in Daloy (`STM-YYYY-#####`); the official invoice / official receipt from a BIR-registered accounting system; PlanTiers §3 updated to match |
| PM-D3 | Where the console lives | **Same app at `/platform`** (lazy-loaded, `noindex`, server-gated); a separate subdomain only if a customer's security review asks for it |
| PM-D4 | Platform roles | `owner` / `billing` / `support` / `viewer` (§3); one `owner` today |
| PM-D5 | Which accounting system receives the statements | Open - user / tax adviser (affects only the export format) |
| PM-D6 | Billing level before organizations exist | A customer = one company now; switches to the organization in PM4 (ServerCore O3) |
| PM-D7 | Monthly active users definition (PlanTiers §2c O6) | Signed in at least once in the company calendar month; pending invites never billed |
| PM-D8 | Statement cycle | Calendar month in the platform's zone (`DEFAULT_TZ`), issued on day 3 after the BSP rate is in; due in [[15]] days |
| PM-D9 | Support access default (§5) | Off; customer grants per need, 7 days, scope chosen by the customer; break-glass `owner` only |
| PM-D10 | Progress scope | +3 pts (statements / FX / price book 1, support access 1, contract records + platform roles 1): roadmap 154 → 157 |

---

## §10 Risks

- **Two writers for the subscription tab (PM-D1 A):** mitigated by "only the projection writes it" and the read-back
  check; the rebuild (`rebuildAllTablesApply`) must not run while a projection is in flight (deploy guide note).
- **Neon Phase 0 is a dependency that isn't started:** PM1 can't ship before it. If it slips, PM0 (hand-written rows)
  stays the way plans are changed - acceptable only under the one-customer rule.
- **Legal / tax specifics** (EOPT invoicing, CWT, penalties) are drafts in the General Terms; M4 / M12 must follow
  the final texts, so PM2 waits for the tax adviser's answer on PM-D2 / PM-D5.
- **Scope creep:** M9 / M10 depend on organizations and the bridge; keep them in PM4 and don't pull them earlier.
