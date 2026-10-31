<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_SLAEscalation_20261030.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 30 October 2026 UTC+8 (Philippine Standard Time) | Modified: 30 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Plan for Phase 5.2 SLA escalation (multi-level rules, in-app + email notices, company SLA rule due dates with holidays) as AppScript v9.5 + frontend | Status: Built (session 7e008704) — awaiting deploy

REVISION HISTORY:
- v1.0.0 | 30 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Initial plan (session a38297ac): context, decisions, schema, engine, routes, frontend, tests, docs, verification
- v1.1.0 | 30 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Merged with the reco plan of session 7e008704 and built: §0 lists what changed against v1.0.0 (v9.5 not v9.4, escalate_role added, email toggles, escalation_action, no ticket_history rows, tryLock)
===============================================================================
-->

# PLAN — SLA Escalation (Phase 5.2) → AppScript v9.5

## §0 v1.1 — what changed from v1.0 when it was built (session 7e008704, 30 Oct 2026)

| v1.0 | Built (v1.1) | Why |
|---|---|---|
| AppScript **v9.4** | **v9.5** (`APPSCRIPT_v9.5_20261030_0650.txt`); attachments move to **v9.6** | v9.4 became the reco quick wins (request cache, proxy auth, real UTC) that escalation relies on |
| D2: notify only | **notify + `escalate_role`** (holders of the role may approve / reject / return the step for that visit; their approval completes an `all` step) | User answer 30 Oct 2026 ("1 and 2") |
| D1: email by user preference | Email when the ticket type's `sla_email` is `on`, or `default` and the global `SLA_EMAIL_DEFAULT` is on, **and** the user's preference allows; one digest per address per run | User answer 30 Oct 2026 ("in-app first, universal or per ticket type toggle for email") |
| rule field `action` | **`escalation_action`** (column and payload) | A payload key `action` replaced the route name in the flat POST body - compliance A13, caught by the v9.5 tests |
| `ticket_history` row per escalation | **No history row**; `sla_escalation_events` + `ticket_action_logs` `SLA_ESCALATION`; TicketDetail → History shows the events | A history row arriving at the step would start a new approval visit (`visitApprovalsFromRows`) |
| engine under `withScriptLock` | `tryLock(5 s)` - **skip when busy**, the next run catches up (compliance A19) | Never queue behind user writes |
| dedup key rule + ticket + step + due date | rule + ticket + step + **visit start** (`tickets.step_started_at`, history fallback for older tickets) | A due-date change in the same visit must not re-fire |
| Admin → SLA Escalations; holidays in CompanySLAManager | Admin → **SLA Escalations** with three panels: Rules, Holidays, Email; CompanySLAManager's escalation tab points there | One screen for everything escalation |

Everything else in §1–§6 was built as written (holidays incl. `addPhilippineHolidays`, company rule wins for due dates, 200-notice cap, export / import carry the rules, migration of the old escalation fields). Tests: `appscript_files/tools/ROUTES_TEST_v9.5.js` (19), `src/utils/slaEscalation.test.js` (5).

## §1 Context

The user picked **Phase 5.2 SLA escalation** as the next major item on 30 Oct 2026. **Attachments stay last** and move from v9.4 to **v9.5**.

### What exists today (AppScript v9.3, `f211c5a`)

| Area | State | Where |
|---|---|---|
| Escalation rules UI | Mock only. Unmounted, saves with `setTimeout`, loads `DEFAULT_ESCALATION_RULES` | `src/components/admin/AdminSLAEscalationManager.js` |
| Escalation engine | Runs in the browser on mock rules; nothing on the backend | `src/utils/slaEscalation.js`, `src/components/shared/SLANotificationSystem.js` (Dashboard) |
| Escalation hooks | Return mock data (`// TODO: Replace with actual API call`) | `useSLAEscalationRules`, `useSLAEscalationMutations` in `src/hooks/useAPI.js` |
| Backend notifications | `triggerWorkflowNotifications()` only writes `Logger.log` | v9.3 :7631 |
| Header bell | Shows `mockNotifications` | `src/components/shared/Header.js`, passed from `DashboardPage` / `AdminPage` |
| Company SLA rules | Stored and shown, but **never read** for due dates; the `escalation_*` columns are unused | `company_sla_rules`, v9.3 :13923–14060; `CompanySLAManager.js` |
| Due dates | Step SLAs only (`calculateSLADueDate`, hours/days) at 3 sites | v9.3 :6821 (approval), :7015 (reopen), :11629 (workflow start) |

`docs/reference/SLA_IMPLEMENTATION.md` marks the escalation work "Phase 6 COMPLETED", but all of it is mock.

### User decisions (30 Oct 2026)

| # | Decision |
|---|---|
| D1 | **Delivery:** in-app notifications (header bell) **+ email** (MailApp, respects the user's `email_notifications` preference) |
| D2 | **Action:** notify only, with no reassign or auto-approve |
| D3 | **Rule model:** multi-level table: several timed levels per step, recipients by role / requester / current approvers / emails |
| D4 | **Due dates:** a matching company SLA rule **wins** over the step SLA. It supports business hours / business days, plus a **holiday table** with PH defaults |
| D5 | Attachments → v9.5 (still last) |

### Outcome
Escalation notices that are real, timed and multi-level, delivered in the app and by email, and due dates that follow each company's calendar.

---

## §2 Backend — `appscript_files/APPSCRIPT_v9.4_20261030_<HHMM>.txt`

A new file copied from v9.3; never overwrite older versions. It follows compliance A1–A13:
- header-driven `rowFromRecord` / `appendRecord`
- `ensureTableSheet` and `withScriptLock`
- `createDataResponse`
- no payload key `action`

`API_VERSION` = `9.4.0`, with a `Deploy description:` header line.

### Phase B1 — Schema (`TABLE_SCHEMAS` + `COLUMN_DEFAULTS`; the rebuild creates 4 tabs and 1 column)

- [ ] **`sla_escalation_rules`**
  - `id, company_id, ticket_type_id, step_id` (blank = every step of the type), `level, name`
  - `trigger`: `percent_elapsed` | `before_due` | `after_due`
  - `trigger_value, trigger_unit` (minutes / hours / days)
  - `notify_current_approvers, notify_requester, notify_role_ids` (JSON), `notify_emails` (JSON), `message`
  - `is_active` + audit columns
- [ ] **`sla_escalation_events`**: `id, rule_id, ticket_id, step_id, step_due_date, fired_at, recipient_count, email_sent, email_skipped` + audit
  - Dedup key: (rule, ticket, step, due date). A new visit to the step gets a new due date, so the rule can fire again.
- [ ] **`notifications`**
  - `id, user_id, ticket_id, type` (`sla_warning` / `sla_due` / `sla_overdue`), `title, message, link`
  - `is_read, read_at, email_status` (`sent` / `pref_off` / `no_email` / `quota` / `error`) + audit
- [ ] **`company_holidays`**: `id, company_id` (blank = all companies), `date` (yyyy-MM-dd, PH), `name` + audit
- [ ] **`tickets.step_started_at`** (new column): set at the 3 due-date sites
  - Older tickets fall back to the newest `ticket_history.to_step_id` row, then to `updated_at`.

### Phase B2 — Due dates

- [ ] `stepDueDateFor(ticket, step, start)`:
  - **company rule first**: a live `company_sla_rules` row with the same company and type, and a step name that matches ignoring case
  - otherwise `getStepSLAs` + the existing `calculateSLADueDate`
  - It replaces the 3 call sites.
- [ ] `calculateBusinessDueDate(start, rule, holidays)`:
  - covers all 5 `COMPANY_SLA_UNITS` (minutes, hours, days, business_hours, business_days)
  - honors `business_hours_start/end`, `business_days`, `exclude_weekends` and `exclude_holidays`
  - uses Asia/Manila time with UTC+8 offset math, like `phDay` (:13384), because the test runtime's `Utilities.formatDate` is a stub

### Phase B3 — Engine: `runSLAEscalations({ dry_run, now })`

- [ ] Runs under `withScriptLock`. For each live, non-terminal ticket with a `step_due_date`, it collects the matching live rules (company + type + step, or step blank).
- [ ] Fire time:
  - `percent_elapsed`: start + p% × (due − start)
  - `before_due`: due − value
  - `after_due`: due + value
- [ ] When a rule's time has come and it has no event yet, it resolves the recipients:
  - current approvers: `getUsersForStep(step, ticket)` (:6091)
  - requester
  - date-aware holders of the roles in `notify_role_ids` (company + type)
  - the listed emails
- [ ] It dedupes the recipients, then:
  - writes the `notifications` rows in one batch
  - sends an email (`MailApp.sendEmail`) when the user's `email_notifications` is on and `MailApp.getRemainingDailyQuota() > 0`, using the address from `user_profiles.email`
  - writes the event and a `ticket_action_logs` row (`SLA_ESCALATION`)
- [ ] Each run sends at most 200 notifications, which keeps it under the 6-minute Apps Script limit. The next run picks up the rest.
- [ ] Editor-only functions:
  - `installSLAEscalationTrigger()`: every 15 min; safe to run twice and removes duplicate triggers
  - `removeSLAEscalationTrigger()`
  - `runSLAEscalationsDryRun()`

### Phase B4 — Routes (doGet / doPost; admin checks via `requireAdmin` :13806)

- [ ] `getSLAEscalationRules`, `createSLAEscalationRule`, `updateSLAEscalationRule`, `deleteSLAEscalationRule` (soft delete)
  - Validation: percent between 1 and 100, value > 0, at least one recipient, and a level that is unique per (company, type, step).
- [ ] `testSLAEscalations`: admin only and always a dry run; returns the tickets × rules that would fire now.
- [ ] `getNotifications` (user_id, unread_only, limit), `markNotificationsRead` (ids or all)
- [ ] `getCompanyHolidays`, `createCompanyHoliday`, `deleteCompanyHoliday`
- [ ] `addPhilippineHolidays` (company or all, year; dry run first):
  - the fixed-date regular holidays
  - Maundy Thursday / Good Friday (computed from Easter)
  - National Heroes Day (last Monday of August)
  - Eid dates are proclaimed each year, so admins add them by hand.
- [ ] `exportConfiguration` / `importConfiguration` (:14060+) also carry the escalation rules (under `include_sla_rules`).

---

## §3 Frontend

- [ ] **`src/api/googleSheet.js`**:
  - `API.SLA.getEscalationRules / createEscalationRule / updateEscalationRule / deleteEscalationRule / testEscalations`
  - `API.Notifications.getAll / markRead`
  - `API.Holidays.getAll / create / delete / addPhilippine`
- [ ] **`src/hooks/useAPI.js`**:
  - real `useSLAEscalationRules` / `useSLAEscalationMutations`
  - a new `useNotifications(userId)` that polls every 2 min and refetches when the window regains focus
- [ ] **`AdminSLAEscalationManager.js`**: rewrite it on real data and mount it as Admin → "SLA Escalations" (`src/pages/AdminPage.js` tabs ~:214).
  - selectors: company → ticket type → step (or "all steps")
  - a list of levels, and a form for trigger, value + unit, recipient checkboxes, a roles multiselect, emails and the message
  - a **Test** button that shows what `testSLAEscalations` returns
- [ ] **`CompanySLAManager.js`**:
  - drop the unused escalation fields from the form (the columns stay, per the KEEP policy)
  - add a **Holidays** sub-tab: list / add / delete, and "Add PH holidays for year"
- [ ] **Header bell**:
  - `DashboardPage`, `AdminPage` and `TicketsPage` pass `useNotifications` data in place of `mockNotifications`
  - opening the bell marks items read, and clicking an item opens its ticket (add `?ticket=<id>` to `/tickets` if it has no selection param)
- [ ] **`SLANotificationSystem.js`**: remove the in-browser mock escalation, which would duplicate toasts. Keep the stats and show the real unread notifications.
- [ ] **`src/utils/slaEscalation.js`**: keep only the trigger / unit label constants. Delete the mock engine, its defaults, and the imports of both.
- [ ] **`scripts/api-contract-known-gaps.txt`**: remove `AdminSLAEscalationManager` (the list may only shrink).

---

## §4 Tests

- [ ] `appscript_files/tools/lib/fakeSheetsRuntime.js`: add fake `MailApp` (send log + quota) and `ScriptApp` (triggers).
- [ ] New `appscript_files/tools/ROUTES_TEST_v9.4.js`, about 14 tests:
  - a company rule beats the step SLA
  - `business_hours` across a weekend and a holiday; `business_days` with `exclude_holidays`
  - a percent trigger fires once, then again after the ticket returns to the step
  - `before_due` / `after_due`
  - recipient dedupe
  - email preference off → in-app only; quota 0 → `email_status: quota`
  - a dry run writes nothing
  - the 200 cap, with the rest sent on the next run
  - rule CRUD validation
  - notifications read / mark all
  - installing the trigger twice leaves one trigger
  - PH holiday dates for 2027
  - export / import carries the rules
- [ ] Run every older suite on v9.4: v9.3 (10), v9.2 (14), v9.1 (18), v9.0 (21), v8.3 (11), SEED (4).

---

## §5 Docs + housekeeping

- [ ] `Claude.md` v4.0: ref #7 (latest file, test list)
- [ ] Deploy guide v1.7.0:
  - 4 new tabs + `tickets.step_started_at`
  - **2 new permissions** (send mail, triggers)
  - run `installSLAEscalationTrigger()` once
  - `addPhilippineHolidays`: dry run, then apply
- [ ] `APPSCRIPT_API.md`, `docs/reference/DATABASE_SCHEMA_UPDATES.txt`
- [ ] `docs/reference/SLA_IMPLEMENTATION.md`: correct the "Phase 6 COMPLETED" claim, which was mock
- [ ] `docs/reference/DEPENDENCY_MAPPING.md`, `docs/reference/DEVELOPMENT_PLAN.md`
- [ ] `docs/planning/SUPERTHINK_TODO_ANALYSIS_2025-09-27.md`: 5.2 done, attachments → v9.5, company SLA rule precedence resolved
- [ ] Compliance guide §4 checklist ticked; `REF_SessionLog.md` row for a38297ac updated

---

## §6 Verification

1. All offline suites on the v9.4 file plus `SEED_TEST.js`, run in the background because Z: is slow. Every test must pass.
2. `npm run check:api-contract` shows 0 actions without a route, and the known gaps shrink by 1.
3. `npm run build:ci` (builds like Vercel; no ESLint warnings).
4. The mock server (`run-backend.bat`) handles the new reads, so Admin → SLA Escalations and the bell render locally.
5. `/code-review` on the batch; findings go in `docs/planning/TODO_CodeReview_20261030.md`.
6. Commit locally in one batch, and push only when the user OKs it, followed by one Vercel check.
7. User: deploy v9.4, then run `installSLAEscalationTrigger()`, then a smoke test:
   - a 1-hour company SLA rule with a 50% level
   - expect a bell notification within 15 min, plus an email if the preference is on
