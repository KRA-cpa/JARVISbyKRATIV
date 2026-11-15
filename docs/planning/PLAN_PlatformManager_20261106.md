<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_PlatformManager_20261106.md | Author: Kenneth R. Advento | Version: 2.0.0
Created: 6 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: The Platform manager (platform admin console) - KRAtiv's console for customers, plans, usage + statements, prices, leads, templates, sessions, security notices, announcements, privacy desk, team and audit: modules, roles, security, data, API, screens, phases | Status: FINAL design (defaults approved 15 Nov 2026); open items with the defaults in use: OPEN_PlatformManager_20261115.md; not built
REVISION HISTORY:
- v2.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | FINAL (session 461f9ea9; user: "finalize design of platform admin", "create separate list of open items", "use defaults, but create a doc so i can go back to it"). Decisions closed (§0, PM-D1..D19); open items moved to OPEN_PlatformManager_20261115.md with their defaults applied here. Changes: no Sheet projection - built on the server after the migration (old §6 option A dropped); Vercel removed (not a Daloy platform); M16 Privacy desk; nav groups; permission matrix; security (guard, bootstrap, re-auth, audit); API list; screens; phases aligned with the migration plan
- v1.2.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | M9 banner control = announcements A3 (PLAN_Announcements_20261115.md); until then `public/announcements.json` + `firebase deploy --only hosting`
- v1.1.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Session 461f9ea9: M14 Security notices (user: "security notices should be available historically in platform admin and for all admin users" - the customer side built now: Admin → Security Notices) and M15 Sessions (user: "might need forced logged out in platform admin for breaches" + "a check of all signed in users and force logout will still be needed" - interim built now: scripts/list-signed-in.sh, scripts/revoke-sessions.sh, server cutoff SESSIONS_VALID_AFTER); §4 tables, §7 PM1, PM-D11 / PM-D12
- v1.0.0 | 6 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "Plan the platform manager". Collects the "Platform → ..." screens scattered over PLAN_PlanTiers_Subscriptions (§2a, §2c, §4a, §6), PLAN_PlatformWebsite (W2, W3), PLAN_ServerCore_OrgSheetBridge (§2, §4a, §6a, §6b) and PLAN_CountryCalendars (§4), and adds what none of them covers (support access, platform roles, re-auth, the coexistence with the Apps Script gate)
===============================================================================
-->

# PLAN — Platform manager (the software owner's console) — FINAL

> **Status:** final design, defaults approved 15 Nov 2026. Not built. **Open items** (each with the default this
> design uses until you answer): [`OPEN_PlatformManager_20261115.md`](OPEN_PlatformManager_20261115.md). Changing an
> answer there → Claude applies it here.

## Context

"Platform → Plans / Invoices / Template library / Leads / Country calendars" were promised in four plans, with no plan
for the Platform area as a whole. Today the platform owner works through Script Properties (`PLATFORM_ADMIN_UIDS`),
hand-written `company_subscriptions` rows, the JARVIS Admin menu in the Sheet, scripts (`list-signed-in.sh`,
`revoke-sessions.sh`, `db-export-company.js`, `db-delete-company.js`, `db-retention.js`), static files
(`src/config/notices.js`, `public/announcements.json`) and the public `/status` page. This plan replaces all of that
with one console, built on the new server.

**Constraints (decided elsewhere):**
1. **Apps Script is frozen** (fixes only) - every console action is an `/api/rpc` handler on Postgres
   (`PLAN_Migration_Unified_20261108.md`).
2. **Billing lives in the platform store**, never in a customer's store (ServerCore §6a).
3. **Daloy meters and issues usage statements; an accounting system issues the official invoice** (PlanTiers §2c).
4. **Servers in Asia; Vercel is not a Daloy platform** (internal previews on test data only).
5. Compliance A1–A22 / F1–F6 and the `Claude.md` non-functional targets apply (A15 actor from the verified session,
   every write audited, paginated lists, query budgets).
6. **Privacy** (`docs/planning/CHECK_PrivacyCompliance_20261115.md`): platform admins see customer **metadata**, not
   content; analytics / usage jobs read counts only (CHECK §4).

---

## §0 Decisions (final)

| # | Decision | Final |
|---|---|---|
| PM-D1 | Coexistence with the Apps Script plan gate | **Built on the server, no projection into the Sheet.** PM1 needs only `/api/rpc` + Neon in production; plan / subscription modules (PM2) ship with migration 4.1, when the gate runs on Postgres. Until then PM0 (runbook, hand rows) - acceptable while there are no paying customers |
| PM-D2 | Invoices vs statements | **Statements only** in Daloy (`STM-YYYY-#####`); the official invoice / receipt from the accounting system; PlanTiers §3 `subscription_invoices` → statements |
| PM-D3 | Where | **Same app at `/platform`** - lazy-loaded chunk, `noindex`, every action checked on the server |
| PM-D4 | Roles | `owner` / `billing` / `support` / `viewer` (§3); one `owner` today |
| PM-D5 | Accounting system for the statement export | Default in use: a generic CSV (OPEN O1) |
| PM-D6 | Billing level | A customer = one company now; the organization from migration Phase 5 (ServerCore O3) |
| PM-D7 | Monthly active users | Signed in at least once in the company's calendar month; counted from sign-in records - ids and timestamps only (privacy CHECK §4); pending invites never billed |
| PM-D8 | Statement cycle | Calendar month in `DEFAULT_TZ`; issued on day 3 (after the BSP rate is in); due in 15 days (OPEN O2) |
| PM-D9 | Support access | Off by default; the customer grants per need for 7 days with a scope (OPEN O8); break-glass `owner` only, the customer told within 24 h |
| PM-D10 | Progress scope | +5 pts: statements / FX / price book 1, support access 1, contract records + roles 1, security ops (M14 / M15 / announcements) 1, privacy desk (M16) 1 - roadmap 154 → 159 |
| PM-D11 | Sessions (M15) | Cutoffs for everyone / an organization / a user; `owner` only, reason + re-auth; list from `user_sessions` (no write per request); the env `SESSIONS_VALID_AFTER` stays the break-glass for everyone; the 12-hour cap and 60-minute idle sign-out stay |
| PM-D12 | Security notices (M14) | In the platform store from PM1, served per user by the server; `src/config/notices.js` until then (no customer names in texts) |
| PM-D13 | Privacy desk (M16) | One module: rights-request log, deletion cases with T1 / T2 runs, retention runs, PIA / manual / access-review due dates |
| PM-D14 | Who is a platform admin | Table `platform_admins`; the **first owner** from the Cloud Run env `PLATFORM_OWNER_UIDS`, read only while the table has no active owner (bootstrap); afterwards M13. Apps Script `PLATFORM_ADMIN_UIDS` retires with the gate (4.1) |
| PM-D15 | API shape | Handler group `platform` (`api/_lib/handlers/platform/*.js`, actions named `platform<Verb><Thing>`); each action declared through one guard `platformAction({ roles, reauth, write })`; `check:code-rules` fails a platform handler without it |
| PM-D16 | Re-auth | Sensitive actions need a sign-in no older than 15 minutes (OPEN O6) → else `REAUTH_REQUIRED`; `rpcCore.js` passes `user.auth_time` in ctx |
| PM-D17 | Audit | `platform_audit_log` append-only (the app's DB role may insert / select only); every write has a reason, before / after JSON, request id |
| PM-D18 | Alerts | Email from the KRAtiv mailbox to the owner (OPEN O7) + the M1 "Needs attention" list: trials ending in 7 days, failed jobs, overdue statements, open breach clocks (24 h to customers / 72 h NPC), rights requests due in 3 days, access review due |
| PM-D19 | Look | The app's design system (UI refresh decisions - OPEN O11); denser tables; no separate brand |

---

## §1 What the Platform manager is

A section of the app at **`/platform`**, for **platform admins only** (KRAtiv staff), separate from a company's
**Admin** area:

| | Admin (`/admin`) | Platform (`/platform`) |
|---|---|---|
| Who | organization / company admins (customers) | platform admins (KRAtiv) |
| Reach | their company / organization | every customer |
| Typical work | ticket types, roles, users, SLA, email, security notices (own), organization terms | customers, plans, usage, statements, prices, leads, templates, sessions, notices, announcements, privacy desk, team |
| Data | Customer Data | KRAtiv's records + read-only customer **metadata** |

**Principles**
- **P-1 The server decides (F1).** Every platform action checks the platform role on the server; screens only hide what
  the server would refuse.
- **P-2 Platform admins are not customer admins.** Tickets and field values need a support grant (M10); metadata
  (company name, plan, usage counts, health, session counts) does not.
- **P-3 Every platform write has a reason and an audit row** (PM-D17).
- **P-4 No bill shock:** every number on a statement is on the customer's *Usage & charges* page first.
- **P-5 Never break a live ticket:** suspensions and downgrades stop new use only; deleting a customer's data is the
  off-boarding process (M16 → `GUIDE_DataReturnDeletion_20261115.md`), never a single click.

---

## §2 Modules

Navigation groups (left rail): **Operate** · **Commercial** · **Content** · **Governance**.

| # | Module | Group | Screens / actions | Data | Phase |
|---|---|---|---|---|---|
| M1 | **Overview** | Operate | Tiles: customers by plan / state, trials ending in 7 days, read-only / grace, statements overdue, new leads, signed in now, open incidents / notices, open rights requests; **Needs attention** list (PM-D18); last 20 platform actions | reads of the tables below | PM1 (ops tiles), PM2-PM3 (commercial tiles) |
| M2 | **Customers** | Operate | List (search; filter by plan / state / country / storage); customer page: companies, admins (names + emails), plan, usage, health, sessions count, notices sent, contract acceptances, notes, history | `customers`, `customer_companies` | PM2 (companies), PM5 (organizations) |
| M15 | **Sessions** | Operate | Who is signed in: per user - organization(s), sign-in time, last request, active (< 60 min) / idle; filter by organization; **Force sign-out**: everyone / an organization / a user (owner, reason, re-auth); cutoff history | `user_sessions`, `session_cutoffs` | PM1 |
| M9 | **Health, incidents & announcements** | Operate | Announcements (maintenance / outage / info: create, schedule, end - replaces editing `public/announcements.json`, which stays the break-glass); incidents (open / resolved, timeline); per-store health (PM5) | `announcements`, `incidents`, `store_health` | PM1 (announcements, incidents), PM5 (health per store) |
| M14 | **Security notices** | Operate | All notices, all organizations: template, organizations addressed, posted, banner end (A 3 days, B / B2 7), status, timeline (internal entries marked), public flag + published at, PE sent at; editor for A / B / B2 / P / PE with the breach-template wording; post / update / resolve / publish (reason, audit; publish needs re-auth) | `security_notices`, `security_notice_events` | PM1 |
| M10 | **Support access** | Operate | Grants from customers, open support sessions, break-glass log | `support_grants`, `support_sessions` | PM5 |
| M3 | **Plans & subscriptions** | Commercial | Start trial, set / extend trial end, change plan (upgrade now / schedule downgrade / cancel / convert), renew, cancel, overrides (features / limits), packs on / off, overage mode + spend cap; history | `subscriptions`, `subscription_events` | PM2 (with migration 4.1) |
| M4 | **Usage & statements** | Commercial | Monthly usage (tickets on the 3-month average, peak / monthly active users), add-on blocks; statements draft → issued → paid / disputed / void; payments by hand; CSV export (OPEN O1) | `usage_monthly`, `statements`, `statement_lines`, `payments`, `credit_memo_refs` | PM3 |
| M5 | **Price book** | Commercial | Plan prices (USD / month, yearly), add-on block prices, setup fees (PHP), promotions; effective dates; feeds `/plans` and new statements (OPEN O4) | `price_book`, `promotions` | PM3 |
| M6 | **Exchange rates** | Commercial | One BSP rate per month; the rate a statement used is frozen on it | `fx_rates` | PM3 |
| M7 | **Leads** | Commercial | List, filter, contacted / discarded, **Convert** → customer + company + region + trial + invite | `leads` | PM4 |
| M8 | **Template library + packs** | Content | Library company in the normal builders; publish / private to a customer; `template_min_plan`; Payroll / HR packs | existing ticket-type tables + flags | PM4 |
| M11 | **Reference data** | Content | Country calendars + holidays (moved from Admin), plan catalogue (read-only) | `country_calendars`, `country_holidays` | PM2 |
| M12 | **Contract records** | Governance | Per customer: Terms / DPA acceptances (from `contract_acceptances` - Admin → Organization Terms), tax profile (withholding agent, CWT rate, Form 2307 received - OPEN O3), notices sent (price changes need 30 days) | `contract_acceptances` (exists), `tax_profiles`, `customer_notices` | PM3 |
| M16 | **Privacy desk** | Governance | Rights requests (`privacy_requests`: due dates, forwarded to, outcome); deletion cases C1-C5 (dates, T1 export / T2 dry run / apply records, confirmation sent); retention runs (`db-retention` results - counts only); due dates: PIA review, manual review, quarterly access review, training | `privacy_requests` (exists), `deletion_cases`, `job_runs`, `compliance_dates` | PM1 |
| M13 | **Team & audit** | Governance | Platform admins + roles, last sign-in, 2-step-verification attested date; the platform audit log (filter by actor / action / target / date) | `platform_admins`, `platform_audit_log` | PM1 |

Not in scope: a payment gateway; the official invoice (accounting system); the customer's own *Usage & charges* page
(a company screen, built with M4).

---

## §3 Roles and permissions

`V` view · `W` write · `R` write that needs re-auth (sign-in ≤ 15 min) · `-` none. `owner` has everything.

| Module | owner | billing | support | viewer |
|---|---|---|---|---|
| M1 Overview | V | V | V | V |
| M2 Customers (notes) | W | V | W | V |
| M15 Sessions - list | V | - | V | - |
| M15 Sessions - force sign-out | R | - | - | - |
| M9 Announcements / incidents | W | - | W | V |
| M14 Security notices - draft / update | W | - | W | V |
| M14 Security notices - post / publish public | R | - | - | - |
| M10 Support access - start a session on a grant | W | - | W | - |
| M10 Break-glass | R | - | - | - |
| M3 Plans & subscriptions | R | R | V | V |
| M4 Statements - issue / void | R | R | - | V |
| M4 Payments | W | W | - | V |
| M5 Price book / M6 Exchange rates | R | R (M6: W) | - | V |
| M7 Leads | W | V | W | V |
| M8 Templates | W | - | W | V |
| M11 Reference data | W | - | W | V |
| M12 Contract records | W | W | V | V |
| M16 Privacy desk - log / cases | W | - | W | V |
| M16 Deletion case - mark T2 applied | R | - | - | - |
| M13 Team - change admins / roles | R | - | - | - |
| M13 Audit log | V | V | V | V |

- **Separation:** a platform admin who is also a member of a customer company acts there as that company's user
  (no implicit elevation).
- **Account hygiene:** KRAtiv Workspace accounts with 2-step verification (privacy checklist D1); M13 records the
  attested date.

---

## §4 Security

- **One guard (PM-D15):** `platformAction({ roles, reauth = false, write = false }, handler)` →
  1. `requireUser` (verified session, A15);
  2. platform role from `platform_admins` (active row) - else `PLATFORM_ONLY` (403); role not in `roles` →
     `PLATFORM_ROLE` (403);
  3. `reauth` → `ctx.user.auth_time` within 15 minutes, else `REAUTH_REQUIRED` (401, the app asks to sign in again and
     returns to the page - `src/utils/returnPath.js`);
  4. `write` → `reason` required (1-500 characters) → the handler runs in one transaction with its
     `platform_audit_log` row.
- **Bootstrap (PM-D14):** while no active `owner` exists, a uid listed in `PLATFORM_OWNER_UIDS` (Cloud Run env) is
  treated as `owner` and the first M13 save writes its row; once an owner row exists the env is ignored. The env
  value is a uid, not a secret (OPEN O5).
- **Audit (PM-D17):** `platform_audit_log` - actor, role, action, target type / id, reason, before / after (JSON),
  request id, time. DB grants: the server role has insert + select only.
- **Customer data rule:** platform actions return metadata (counts, names of companies and admins, plan, dates).
  Ticket content, field values and comments only inside a support session on a customer grant (M10), every request
  logged with the grant id.
- **Privacy rule for metrics:** M1 tiles, M4 usage and M15 counts are computed from ids and timestamps; no content,
  no sensitive information (CHECK §4).
- **Alerts (PM-D18):** a daily job (Cloud Scheduler → `/api/rpc` job action, idempotent - A19) fills the Needs
  attention list and emails the owner when something new appears.

---

## §5 Data (platform store - Neon Postgres)

**Already exist (migration 0003, 15 Nov 2026):** `privacy_acknowledgements`, `contract_acceptances`, `privacy_requests`.

| Table | Holds | Phase |
|---|---|---|
| `platform_admins` | uid, email, role, added_by, added_at, removed_at, mfa_attested_at | PM1 |
| `platform_audit_log` | §4 | PM1 |
| `user_sessions` | uid, auth_time (the sign-in), first_seen, last_seen (written at most once per 5 min per session), company ids seen, user agent family; rows older than 12 h + 1 day removed daily | PM1 |
| `session_cutoffs` | scope (`all` / `organization` / `user`), target id, valid_after, reason, by, at - read by the authenticator with a 60-second cache | PM1 |
| `security_notices`, `security_notice_events` | the notice (texts, public texts, template, company_ids, posted_at, days, resolved_at, public, published_at, pe_sent_at) + timeline entries (internal flag) | PM1 |
| `announcements` | id, kind, title, message, starts_at, ends_at, show_from, company_ids, link, read_only, created_by, ended_at (served with `public/announcements.json`) | PM1 |
| `incidents` | reference, title, opened_at, closed_at, severity, notice ids, record link | PM1 |
| `deletion_cases` | case id, case type C1-C5, company / user, opened / due / applied / confirmed dates, T1 / T2 run records (counts only), notes | PM1 |
| `job_runs` | job, started / finished, result counts (no row contents), error | PM1 |
| `compliance_dates` | item (PIA review, manual review, access review, training), due, done, by | PM1 |
| `customers`, `customer_companies` | customer (→ organization in PM5), company links (+ name / code mirrored) | PM2 |
| `subscriptions`, `subscription_events` | PlanTiers §3 columns + customer_id, overage_mode, overage_cap, packs; reminders sent (A19 key), grace, read-only, changes | PM2 |
| `usage_monthly` | customer, company, month (company calendar), tickets_created, tickets_billable, peak_users, active_users, source, computed_at | PM3 |
| `price_book`, `promotions`, `fx_rates` | M5 / M6 | PM3 |
| `statements`, `statement_lines`, `payments`, `credit_memo_refs` | M4; `statement_number` from a platform sequence | PM3 |
| `tax_profiles`, `customer_notices` | M12 | PM3 |
| `leads` | PlatformWebsite §4 columns | PM4 |
| `support_grants`, `support_sessions`, `store_health` | M10, M9 | PM5 |

Indexes: every list action has one (`(status, plan)`, `(customer_id, month)`, `(period_end)`, `(last_seen)`,
`(due_at)` ...); `EXPLAIN` for the hot paths in `docs/perf/`. Lists paginated 50 / 100.

---

## §6 API (`/api/rpc`, handler group `platform`)

Budget per action: read ≤ 3 queries, list ≤ 5 (paginated), write ≤ 10 in one transaction (+ the audit row).
`R` = re-auth. Roles as in §3.

| Phase | Actions |
|---|---|
| PM1 | `platformGetOverview`; `platformListAdmins`, `platformSaveAdmin` (R), `platformRemoveAdmin` (R), `platformListAudit`; `platformListSessions`, `platformListCutoffs`, `platformForceSignOut` (R; scope all / organization / user); `platformListNotices`, `platformGetNotice`, `platformSaveNotice`, `platformPostNotice` (R), `platformResolveNotice`, `platformPublishNotice` (R), `platformRecordPeSent`; `platformListAnnouncements`, `platformSaveAnnouncement`, `platformEndAnnouncement`; `platformListIncidents`, `platformSaveIncident`; `platformListRequests`, `platformSaveRequest`; `platformListDeletionCases`, `platformSaveDeletionCase`, `platformMarkDeletionApplied` (R); `platformListJobRuns`; `platformListComplianceDates`, `platformSaveComplianceDate` |
| PM2 | `platformListCustomers`, `platformGetCustomer`, `platformSaveCustomerNote`; `platformStartTrial` (R), `platformSetTrialEnd` (R), `platformChangePlan` (R), `platformCancelScheduled` (R), `platformRenew` (R), `platformCancelSubscription` (R), `platformSetOverrides` (R); `platformSaveCountryCalendar`, `platformImportHolidays` |
| PM3 | `platformListUsage`, `platformComputeMonth` (job), `platformListStatements`, `platformIssueStatement` (R), `platformVoidStatement` (R), `platformRecordPayment`, `platformExportStatements`; `platformSavePrice` (R), `platformSavePromotion` (R), `platformSaveFxRate`; `platformSaveTaxProfile`, `platformRecordCustomerNotice` |
| PM4 | `platformListLeads`, `platformUpdateLead`, `platformConvertLead`; `platformPublishTemplate`, `platformSetTemplatePlan` |
| PM5 | `platformListGrants`, `platformStartSupportSession`, `platformEndSupportSession`, `platformBreakGlass` (R); `platformGetStoreHealth` |

The served side for users: `getMyNotices` (M14), `getAnnouncements` (M9, merged with the file), session cutoffs inside
the authenticator (M15) - not platform actions.

---

## §7 Screens

Layout: the app header; a left rail with the four groups; the module on the right (title, filters, table, side panel
for details / editing). Every write opens a small dialog with **Reason** (required); `R` actions say "Sign in again
to continue" when the sign-in is older than 15 minutes.

```
Overview
┌ Needs attention (4) ─────────────────────────────────────────────┐
│ ● Breach clock: INC-2026-003 - notify customers within 6 h        │
│ ● Rights request DSR-2026-002 due in 2 days                       │
│ ● Trial ends in 3 days: Acme (Basic)                              │
│ ● Retention job failed last night                                 │
└───────────────────────────────────────────────────────────────────┘
[Customers 12 · trial 3 · read-only 0] [Signed in now 41 · active 17]
[Open notices 1] [Open requests 2] [Statements overdue 0] [Leads 4]
Last platform actions: 15 Nov 19:40 owner - Force sign-out (Acme) "INC-2026-003" ...
```

```
Sessions                                   [Force sign-out ▾ everyone | organization | user]
Filter: organization [all ▾]  state [active ▾]
User            Organization   Signed in        Last request   State
Deleted user …  Acme           15 Nov 08:02     19:31          active
…
Cutoffs: 15 Nov 19:40 Acme (organization) by owner - "INC-2026-003"
Dialog: Force sign-out of Acme (23 signed in) · Reason [________] · [Cancel] [Sign everyone out]
```

```
Security notice editor - INC-2026-003      Template [A | B | B2]   Status Ongoing
Addressed to: [All organizations ▾ / pick]  Banner: 7 days from [posting]
Title / sections (template wording, blanks highlighted)
Timeline  [+ entry]  (internal ☐)
Public version (template P) [ready]   PE sent: —   [Publish public] (R, only after PE)
[Save draft] [Post] (R)
```

```
Customer page - Acme
Plan Basic · trial ends 18 Nov · companies 2 · admins 3 · users 23 · tickets this month 140
Terms v0.16 accepted 15 Nov by ann@… · DPA v0.4 accepted 15 Nov
Notices sent: INC-2026-003 (B) · Sessions: 23 signed in · Requests: 1 open
History (subscription events, platform actions)
```

```
Privacy desk
Requests: DSR-2026-002 access · due 18 Nov · forwarded to Acme admin 15 Nov · [Done]
Deletion cases: DEL-2026-001 C1 Beta · day 12 of 30 · T1 export ✓ · T2 dry run — · [Record run]
Retention: last run 1 Nov - outbox 12, sign-in rows 40 removed
Due: access review 15 Feb 2027 · PIA review 15 Nov 2027 · training (owner) 15 Nov 2027
```

---

## §8 Phases (aligned with `PLAN_Migration_Unified_20261108.md`)

| Phase | Content | Needs | Done when |
|---|---|---|---|
| **PM0** (now, no code) | Runbook in `docs/guides/`: plans by hand rows (until 4.1), sign-in tools (`list-signed-in.sh`, `revoke-sessions.sh`), notices (`src/config/notices.js`), announcements (`public/announcements.json`), privacy tools (T1 / T2 / retention) | - | the runbook exists |
| **PM1** | Foundation: guard, bootstrap, re-auth, audit; `/platform` shell; **M13**, **M1** (ops tiles + Needs attention), **M15**, **M14**, **M9** announcements + incidents, **M16**; served sides (`getMyNotices`, announcements merge, cutoffs in the authenticator) | migration Phase 1 done (`/api/rpc` + Neon in production); OPEN O5, O7, O10, O11 | a forced sign-out of one organization works end to end; a notice posted from M14 reaches the banner; route tests (below) pass |
| **PM2** | **M2** customers, **M3** plans & subscriptions (the lifecycle of PlanTiers §4 / §4a on Postgres), **M11** reference data | migration 4.1 | a trial started on `/platform` is enforced by the gate; reminders sent once (A19) |
| **PM3** | **M4**, **M5**, **M6**, **M12** | migration 4.2-4.3; OPEN O1-O4 | a month closes into statements whose every line is on the customer's page; CSV loads into the accounting system |
| **PM4** | **M7** leads (website W2), **M8** templates + packs | migration 4.4-4.5 | lead → trial customer with an invite in one action; Basic adopts a template |
| **PM5** | organizations; **M10** support access; **M9** health per store | migration Phase 5 | support sessions logged and visible to customers |

Effort (S 1 … XL 5): PM1 L (3), PM2 L (3), PM3 L (3), PM4 M (2), PM5 M (2).

---

## §9 Tests and checks

- **Guard:** every platform action - the right role allowed; another role, a company admin, a plain user and an
  unsigned caller refused with `PLATFORM_ONLY` / `PLATFORM_ROLE` / `NOT_SIGNED_IN`; `R` actions with an old sign-in →
  `REAUTH_REQUIRED`; a write without a reason → `BAD_REQUEST`; each write leaves exactly one audit row (PGlite, like
  `scripts/test-privacy-db.js`).
- **Bootstrap:** env owner works only while no owner row exists; removing the last owner is refused.
- **Sessions:** a cutoff for one organization refuses only its users' older sign-ins; everyone / user scopes; the
  authenticator's 60-second cache; the env cutoff still wins (proxy auth tests).
- **Notices / announcements:** served only to the organizations addressed; public version only after `public` +
  PE recorded; internal timeline entries never in the public view.
- **Lifecycle** (PlanTiers §8) and **statements** (3-month average, peak users, USD → PHP at the frozen rate, void
  keeps the number) - PM2 / PM3.
- **Audit table:** the app role can't update or delete it.
- **`check:code-rules`:** every handler in `handlers/platform/` goes through `platformAction`; no Vercel modules.
- **`check:api-contract`:** platform calls are `rpcRequest` actions with handlers (`rpc-missing`).

---

## §10 Risks

- **Migration Phase 1 is a dependency:** PM1 can't ship before `/api/rpc` has the database in production. If it slips,
  PM0 (scripts, static files, hand rows) stays - fine while there are no paying customers.
- **Bootstrap env:** a wrong uid in `PLATFORM_OWNER_UIDS` gives nobody (or the wrong person) the owner role while the
  table is empty - set it once, check M13, then the env is ignored.
- **Guard coverage:** one unguarded platform handler would expose every customer's metadata - the code-rules check and
  the route tests cover every action.
- **Legal / tax specifics** (EOPT, CWT, penalties) - M4 / M12 follow the final texts (OPEN O2, O3).
- **Scope creep:** M10 and per-store health depend on organizations - keep them in PM5.
