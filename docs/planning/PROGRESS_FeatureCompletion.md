<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PROGRESS_FeatureCompletion.md | Author: Kenneth R. Advento | Version: 1.3.0
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Living record of how complete JARVISbyERP is - against the original spec and against the full roadmap - recalculated at every version close | Status: Active (living document, not dated)
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created from PLAN_FeatureGaps_Volume_20261031.md §10 (session 2d369f00); method carried over from session 7e008704 (30 Oct 2026)
- v1.1.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Scope +2 (user onboarding / invites in v9.6): roadmap total 138 → 140, figures recalculated
- v1.2.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | v9.6 deployed (ping 9.6.0, cloud session 017zmKf7): headline 87.0 % / 66.5 %, provisional until the §5d browser checks pass
- v1.3.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Scope +14 (session ff4c803f): country calendars + time zones (v10.1, 4) and plans + subscriptions (v10.2, 10); roadmap total 140 → 154; version line v10.1-v10.4; figures recalculated
===============================================================================
-->

# PROGRESS — Feature completion

> **Headline (31 Oct 2026, v9.6 deployed - ping `9.6.0`):** **87.0 %** of the original spec · **60.5 %** of the full roadmap (spec + the v10 plan; total **154** since session ff4c803f, was 66.5 % of 140). *Provisional:* the scoring rule counts a feature only once checked in the browser; the deploy guide §5d checks (sign-in, invite message, company email + test email, invite, Links) are not reported yet. Until then the last confirmed figures are 78.8 % / 57.8 % (v9.5; 52.5 % of 154).
> After the v10 line (v10.4): 88.0 % spec · 92.2 % roadmap. 100 % on both needs file uploads + the ticket type Edit route.

---

## §1 Method

- **Spec basis (A):** the 8 areas of `Claude.md` §3 with the weights set on 30 Oct 2026 (session 7e008704): 3.1 users & permissions 15, 3.2 numbering 5, 3.3 admin config 30, 3.4 lifecycle / dashboard / reports 20, 3.5 audit 10, SLA escalation 5, tags & sharing 5, attachments 10. Only spec work moves it.
- **Rebased scope (B):** the spec's 100 points plus the features planned in `docs/planning/PLAN_FeatureGaps_Volume_20261031.md`, on the same scale (40 points on 31 Oct 2026 → 140 in all; +14 in session ff4c803f for `PLAN_CountryCalendars_TimeZones_20261031.md` and `PLAN_PlanTiers_Subscriptions_20261031.md` → **154**). It moves when roadmap features land; its total changes when scope changes (§5).
- **Per feature (C):** status detail with effort points (S = 1, M = 2, L = 3, XL = 5). Its totals are **not** a headline: it counts what's built, not the spec's full breadth.
- **Scoring:** 100 % = route + mounted screen that reaches it + offline tests passing (compliance P5), **deployed live and checked in the browser**. Backend only = 50 %; done with a known gap = 75–90 %. These are estimates from reading the code, not measurements.
- **Not counted:** the Neon / Vercel migration (infrastructure, not a feature).
- **When to recalculate:** at every AppScript version close and at every session dump (`REF_SessionLog.md` §3 rule 6). Add a §4 History row each time; never edit old rows.

---

## §2 Current figures

**Same basis as before.** Session 7e008704 (30 Oct 2026, transcript msg at 07:23 UTC) estimated **~79 % of the spec** at v9.5 (**~40 % on 19 Oct**), weighting the spec areas: 3.1 users & permissions 15 %, 3.2 numbering 5 %, 3.3 admin config 30 %, 3.4 lifecycle / dashboard / reports 20 %, 3.5 audit 10 %, SLA escalation 5 %, tags & sharing 5 %, attachments 10 %. Check: .15×75 + .05×100 + .30×85 + .20×95 + .10×85 + .05×100 + .05×90 + .10×0 = **78.75 %** ✓. Since then v9.5 has been **deployed live** (`getSystemHealth` 39 tables OK), so "built" and "live" now match for v9.5. The user steps in session dump §3 are still open.

### A. Spec basis (unchanged weights): how far the original spec gets

| Spec area | Wt | Now (v9.5) | v9.6 | v10.0 | v10.1–v10.4 | Backlog | What moves it |
|---|---|---|---|---|---|---|---|
| 3.1 Users & permissions | 15 | 75 | **100** | 100 | 100 | 100 | v9.6 admin checks + allow-list + idle sign-out |
| 3.2 Numbering | 5 | 100 | 100 | 100 | 100 | 100 | v10.1: YEAR from the country calendar (PH unchanged) |
| 3.3 Admin config | 30 | 85 | 85 | 85 | 85 | **100** | ticket type Edit + file field / require-attachment (uploads) |
| 3.4 Lifecycle / dashboard / reports | 20 | 95 | 95 | **100** | 100 | 100 | v10.0 pagination + search |
| 3.5 Audit | 10 | 85 | **100** | 100 | 100 | 100 | v9.6 every admin write logged |
| SLA escalation | 5 | 100 | 100 | 100 | 100 | 100 | |
| Tags & sharing | 5 | 90 | 90 | 90 | 90 | **100** | remaining tag gap |
| Attachments | 10 | 0 | **30** | 30 | 30 | **100** | v9.6 links; uploads last |
| **Spec total** | 100 | **78.8 %** | **87.0 %** | **88.0 %** | 88.0 % | **100 %** | |

The spec basis gives the new features **no credit** (head approval, delegation, Restricted, notifications aren't in the spec), so it stalls at 88 %. Hence a rebased scope:

### B. Rebased scope (the spec + the roadmap features; same scale, 154 pts since session ff4c803f)

Version line since 31 Oct 2026 (session ff4c803f): v10.0 → **v10.1** country calendars + time zones → **v10.2** plans + subscriptions → **v10.3** head / delegation / bulk (was v10.1) → **v10.4** comments and the rest (was v10.2).

| New area (pts on the spec's scale) | Wt | Now | v9.6 | v10.0 | v10.1 | v10.2 | v10.3 | v10.4 | Basis for "now" |
|---|---|---|---|---|---|---|---|---|---|
| User onboarding / invites | 2 | 0 | **2** | 2 | 2 | 2 | 2 | 2 | |
| Visibility + who creates + Restricted tickets / fields | 10 | 0 | 0 | **10** | 10 | 10 | 10 | 10 | |
| Pagination + search + volume ops (participants, archive, size check, perf log) | 6 | 0.9 | 0.9 | **6** | 6 | 6 | 6 | 6 | v9.4 cache + read-count tests (≈15 %) |
| Notifications: workflow events + email outbox + company email | 6 | 0 | **2** | **6** | 6 | 6 | 6 | 6 | `triggerWorkflowNotifications` only logs; v9.6 company email = 2 |
| Country calendars + time zones (calendars + holidays 1, company zone + helpers 1, SLA / numbering / reports / emails 1, user display zone + UI 1) | 4 | 0 | 0 | 0 | **4** | 4 | 4 | 4 | PH-only holidays (v9.5) aren't counted: the area is multi-country |
| Plans + subscriptions (catalogue + gate + template library 3, lifecycle + trial 2, invoices 1, screens 2, ticket uploader 2) | 10 | 0 | 0 | 0 | 0 | **10** | 10 | 10 | |
| Immediate head + delegation + bulk approve | 6 | 0.2 | 0.2 | 0.2 | 0.2 | 0.2 | **6** | 6 | unmounted `BulkOperationsManager` |
| Comments + mentions + watchers, drafts | 4 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | |
| SLA analytics, expiring assignments, print / PDF, webhooks, task callback, component clean-up | 6 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | **6** | analytics + expiring routes exist, no screens |
| **New areas earned** | 54 | 2.1 | 6.1 | 25.2 | 29.2 | 39.2 | 45.0 | 54.0 | |
| Spec earned (from A) | 100 | 78.8 | 87.0 | 88.0 | 88.0 | 88.0 | 88.0 | 88.0 | |
| **Rebased total (of 154)** | 154 | **52.5 %** | **60.5 %** | **73.5 %** | **76.1 %** | **82.6 %** | **86.4 %** | **92.2 %** | backlog → 100 % |
| *(same, of 140, before ff4c803f)* | *140* | *57.8 %* | *66.5 %* | *80.9 %* | - | - | *85.0 % (was "v10.1")* | *91.4 % (was "v10.2")* | |

**Headline:** the original spec is at **~79 %** at v9.5 and **~87 %** after v9.6. It reaches **100 %** only once uploads + the ticket type Edit route land. On the bigger scope (154 since session ff4c803f), the app is at **~61 %** after v9.6 and **~92 %** after v10.4.

---

## §3 Per feature

| # | Feature | Wt | Now | After | Gap / done in |
|---|---|---|---|---|---|
| 1 | Sign-in + proxy token check | 3 | 100 % | 100 % | v9.4 |
| 2 | Roles per company / type, global, dates | 3 | 100 % | 100 % | |
| 3 | Ticket numbering | 1 | 100 % | 100 % | |
| 4 | Companies + code locking | 2 | 100 % | 100 % | |
| 5 | Ticket types | 2 | 75 % | 100 % | Edit route (backlog) |
| 6 | Comment requirements | 1 | 100 % | 100 % | |
| 7 | Custom field builder | 3 | 90 % | 100 % | `file` field needs uploads (backlog) |
| 8 | Dropdowns (dependent, company access) | 3 | 100 % | 100 % | |
| 9 | Workflow engine (steps, any/all, SLA, conditions, chained, tasks) | 5 | 100 % | 100 % | |
| 10 | Copy workflows | 1 | 100 % | 100 % | |
| 11 | Reports + config + CSV | 3 | 100 % | 100 % | (visibility applied in v10.0) |
| 12 | Dashboard + chained view | 2 | 100 % | 100 % | |
| 13 | Cancel / return / reject / reopen | 3 | 100 % | 100 % | |
| 14 | Audit logs | 2 | 80 % | 100 % | every admin write (v9.6) |
| 15 | Tags + sharing | 2 | 100 % | 100 % | |
| 16 | SLA + escalation + holidays | 3 | 90 % | 100 % | slaCalculator +8 h bug (fixed in v10.1 with the time zone move) |
| 17 | User profiles / profile types / role types | 3 | 90 % | 100 % | Jest suites (backlog) |
| 18 | Config export / import / backup | 2 | 100 % | 100 % | |
| 19 | Admin-only server checks + sign-in allow-list | 2 | 0 % | 100 % | v9.6 |
| 20 | Attachment links | 1 | 0 % | 100 % | v9.6 |
| 21 | Company email settings | 2 | 0 % | 100 % | v9.6 |
| 22 | Idle sign-out | 1 | 0 % | 100 % | v9.6 |
| 23 | Visibility (private / collaborative) + who can create | 3 | 0 % | 100 % | v10.0 - **M1 built** (`bc0d2dc`, not live): counts once deployed + checked |
| 24 | Pagination + search | 3 | 0 % | 100 % | v10.0 |
| 25 | Workflow event notifications + email outbox | 3 | 0 % | 100 % | v10.0 |
| 26 | Restricted fields | 2 | 0 % | 100 % | v10.0 |
| 27 | Restricted tickets | 3 | 0 % | 100 % | v10.0 |
| 28 | Volume ops on Sheets (participants, archive, size check, perf log) | 2 | 30 % | 100 % | v10.0 (cache + read-count tests exist since v9.4) |
| 29 | Immediate head approval | 2 | 0 % | 100 % | v10.3 (was v10.1) |
| 30 | Delegation | 2 | 0 % | 100 % | v10.3 (was v10.1) |
| 31 | Bulk approve / reject | 2 | 10 % | 100 % | v10.3 (unmounted `BulkOperationsManager`) |
| 32 | Comments + mentions + watchers | 2 | 0 % | 100 % | v10.4 |
| 33 | Draft tickets | 1 | 0 % | 100 % | v10.4 |
| 34 | SLA analytics screen | 1 | 50 % | 100 % | v10.4 (routes + hooks exist) |
| 35 | Expiring assignments view | 1 | 50 % | 100 % | v10.4 (route exists) |
| 36 | Task-step callback | 1 | 0 % | 100 % | v10.4 |
| 37 | Outbound webhooks | 2 | 0 % | 100 % | v10.4 |
| 38 | Print / PDF ticket | 1 | 0 % | 100 % | v10.4 |
| 39 | Unmounted component clean-up | 1 | 0 % | 100 % | v10.4 |
| 41 | User onboarding / invites | 2 | 0 % | 100 % | v9.6 |
| 40 | File uploads | 3 | 0 % | 100 % | backlog (last) |
| 42 | Country calendars (year, holidays, weekends) + company time zone | 3 | 0 % | 100 % | v10.1 |
| 43 | Per-user display time zone | 1 | 0 % | 100 % | v10.1 (gated to Advanced+ in v10.2) |
| 44 | Plan catalogue + gate + limits + platform admin | 3 | 0 % | 100 % | v10.2 |
| 45 | Subscriptions: trial end, grace, read-only, renew / downgrade | 3 | 0 % | 100 % | v10.2 |
| 46 | Invoices (no payment integration) | 1 | 0 % | 100 % | v10.2 |
| 47 | Template library + adopt (Basic) + managed setup | 2 | 0 % | 100 % | v10.2 |
| 48 | Ticket uploader (self / on behalf) | 2 | 0 % | 100 % | v10.2 |

Table C's effort-point totals aren't used for the headline: they gave the spec 96 % because they count features as built, not the spec's full breadth. A and B carry on the 30 Oct method so the trend (40 % → 79 % → …) stays comparable.

**Recalculate A and B at each version close** (here, then quote the two headline numbers in the session dump; REF_SessionLog §3 rule 6). If a feature is added or dropped, B's total changes, so show the old and new total side by side. A only moves with the spec. "Built" counts only once deployed live and checked in the browser (session 7e008704 rule).

---

## §4 History

| Date | Point | Spec (A) | Roadmap (B) | Note |
|---|---|---|---|---|
| 19 Oct 2026 | (as quoted on 30 Oct) | ~40 % | - | figure quoted in session 7e008704; its basis wasn't recorded |
| 30 Oct 2026 | v9.5 built, not deployed | 78.8 % | - | session 7e008704 (first weighted estimate) |
| 31 Oct 2026 | v9.5 live | 78.8 % | 58.6 % | session 2d369f00: scope +38 pts (§5); "built" and "live" now match for v9.5 |
| 31 Oct 2026 | scope +2 (invites, v9.6) | 78.8 % | 57.8 % | session 2d369f00: roadmap total 138 → 140 |
| 31 Oct 2026 | v9.6 deployed (ping 9.6.0) | 87.0 % | 66.5 % | session 017zmKf7: all v9.6 items built as planned (no scope change), so the planned v9.6 column holds; provisional until the §5d browser checks pass |
| 31 Oct 2026 | scope +14 (calendars / zones, plans) | 87.0 % | 60.5 % | session ff4c803f: roadmap total 140 → 154 (66.5 % of 140 = 60.5 % of 154); v9.6 still provisional (browser check 7 open) |
| 31 Oct 2026 | v10.0 M1 built, not live (`bc0d2dc`) | 87.0 % | 60.5 % | session ff4c803f: visibility per type + who can create (feature 23). Headline unchanged (not live). Built-only it would be 62.9 % (area "Visibility + who creates + Restricted": 3 of its 8 feature points ≈ 3.75 / 10 pts) |

---

## §5 Scope changes

| Date | Change | Points | Reason |
|---|---|---|---|
| 31 Oct 2026 | + Visibility, who can create, Restricted tickets / fields | +10 | G1 / G2 + user decisions (plan §2) |
| 31 Oct 2026 | + Pagination, search, volume ops | +6 | G3, Claude.md non-functional targets |
| 31 Oct 2026 | + Workflow notifications, email outbox, company email | +6 | G4; company email from session 7e008704 |
| 31 Oct 2026 | + Immediate head approval, delegation, bulk approve | +6 | G5–G7 + user decisions |
| 31 Oct 2026 | + Comments / mentions / watchers, drafts | +4 | G8 |
| 31 Oct 2026 | + SLA analytics, expiring assignments, print, webhooks, task callback, clean-up | +6 | G10 |
| 31 Oct 2026 | + User onboarding / invites (v9.6) | +2 | ST-2: the v9.6 allow-list needs it (user: yes) |
| 31 Oct 2026 | + Country calendars + time zones (v10.1) | +4 | session ff4c803f: selling by plan opens other countries (user U8–U10) |
| 31 Oct 2026 | + Plans + subscriptions, template library, ticket uploader (v10.2) | +10 | session ff4c803f: Basic / Advanced / Enterprise per company (user U1–U7) |
