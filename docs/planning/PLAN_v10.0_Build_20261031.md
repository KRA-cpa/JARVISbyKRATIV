<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_v10.0_Build_20261031.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Build plan for AppScript v10.0 against the live v9.6 code - scope recap, what changed since the design, code map, milestones, tests, deploy, open decisions | Status: Approved 31 Oct 2026 (D1-D6 decided) - building
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (cloud session 017zmKf7) from PLAN_FeatureGaps_Volume_20261031.md §4 / §5.1 / §7 / §9 / §11 and a read of APPSCRIPT_v9.6_20261031_1510.txt
- v1.1.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User decisions: D1 D2 D3 D5 D6 as recommended; D4 Restricted stays in v10.0 with no v10.0.1 fallback
===============================================================================
-->

# PLAN — AppScript v10.0 build (31 Oct 2026)

> **Design source (decided, not re-opened here):** `docs/planning/PLAN_FeatureGaps_Volume_20261031.md` §2 decisions, §4.1–§4.4 + §4.10–§4.11 shared design, §5.1 Apps Script scope, §5.4 read budgets, §7 tests, §9 order, §11 reco check.
> **This file adds:** what v9.6 changed for v10.0 (§1), the size and the milestones (§2), the code map on the live file (§3), the frontend list (§4), tests (§5), deploy (§6), and **6 decisions to confirm before coding (§7)**.
> **Start condition:** v9.6 browser checks passed (deploy guide §5d; PROGRESS is provisional until then).

---

## §0 Scope recap (v10.0)

| # | Part | Design |
|---|---|---|
| 1 | **Visibility per ticket type** (`private` default \| `collaborative`); hidden ticket = *not found* | §2.2, §4.2 |
| 2 | **Who can create** (role on type + company); `getCreatableTicketTypes` | §2.1, §4.2 |
| 3 | **`ticket_participants`** (requester / acted / shared / pool windows / head) written at the action; backfill | §4.1 |
| 4 | **Pagination + search** on `getTickets` (cursor, filters, `q`) | §4.3 |
| 5 | **Workflow event notifications** (rewire `triggerWorkflowNotifications`) + **`email_outbox`** drained by the 15-min trigger | §4.4 |
| 6 | **Restricted fields** (`custom_fields.is_confidential`, server-side masking everywhere) | §4.10 |
| 7 | **Restricted tickets** (`ticket_types.confidential_mode`, stub for outsiders, no sharing, 3 admin options, `revealConfidential`) | §4.11 |
| 8 | Head snapshot columns on `tickets` (written in v10.0, **used** in v10.1) | §4.5 |

Schema (one rebuild apply): **new tabs** `ticket_participants`, `email_outbox`; **columns** `ticket_types.visibility`, `.require_immediate_head_approval`, `.confidential_mode`, `.confidential_admin_access`; `tickets.head_approver_id`, `.head_backup_id`, `.is_confidential`; `custom_fields.is_confidential`; `notifications.recipient_role_id`.

---

## §1 What changed since the design (from building v9.6)

| # | Change | Effect on v10.0 |
|---|---|---|
| C1 | The share table is **`ticket_collaborations`** (`shared_with_user_id` / `shared_with_company_id`, `shareInForce`), not `ticket_shares` as the design says | Backfill and `canViewTicket` read `ticket_collaborations` |
| C2 | v9.6 added an interim **`canSeeTicketLinks`** (manage / role in company / share) | Replaced by `canViewTicket(scope, ticket) === 'full'`; one definition (A20) |
| C3 | v9.6 **allow-list** + `allow:<uid>` cache; **ADMIN_ONLY_ACTIONS** | New admin routes (`revealConfidential` is not one of them - it's per-type; `backfillTicketParticipants` is editor-only) go on the list where they are admin writes; the v9.6 test checks every listed action is routed |
| C4 | v9.6 review CR3-08: writes needing new columns check them (`requireColumns` → `SCHEMA_OUTDATED`) | Every v10.0 write to a new column / tab uses it, so a deploy before the rebuild apply fails loudly |
| C5 | v9.6 review CR3-01: reads before `withScriptLock` are stale inside it | Participant / outbox writes made inside the lock invalidate first where a decision depends on them |
| C6 | **ADMIN_Tools is v1.2** (design said v1.1) | v10.0 ships **ADMIN_Tools v1.3**: backfill participants (dry run / apply), outbox status, spreadsheet size check, archive (§5.3 of the design) |
| C7 | 8 frontend reads take `getTickets` as an array: `TicketDashboard`, `TicketReport`, `DashboardPage`, `AdminPage`, `SLANotificationSystem`, `useAPI` (×2 SLA hooks), `approvalRouter` | The compat shape (no `limit` → old array) is **required** in v10.0, not optional; the list in §4 moves each one |
| C8 | Offline suites need `TZ=Asia/Manila`; **Jest is red** (104 / 174, pre-existing) | Not fixed by v10.0 unless decided (§7 D5) |
| C9 | Compliance P8: v9.4 → v9.6 = 3 versions since the last whole-file review | v10.0 gets a **whole-file** `/code-review`, not only the diff |
| C10 | The design never says what visibility does in `AUTH_MODE` **warn** | Decision §7 D1 - it decides whether the older suites still pass unchanged |

---

## §2 Size, and how to build it

v10.0 is about **3× v9.6**: ~12 new helpers, 14 changed read paths, 2 new tabs + 9 columns, 3 new routes (`getCreatableTicketTypes`, `revealConfidential`, paged `getNotifications`), 8 frontend consumers of `getTickets`, plus masking in every place a value leaves the server. The risk is not one feature but **a read path that forgets the check** (a leak). So:

- **One AppScript file, one deploy** (as designed), but built in **5 milestones**, each committed with every suite green:

| M | Content | Gate before the next |
|---|---|---|
| M1 | Schema + `buildActorScope` + `canViewTicket` (full / none) + `canCreateTicket` + `getCreatableTicketTypes`; every ticket read path filtered (§3 list) | visibility matrix tests + the new code-rules check (`canViewTicket` in every ticket-returning route) |
| M2 | `ticket_participants` writers (create / progress / share / revoke / pool windows) + `backfillTicketParticipants` | backfill idempotent; participants match a history replay on the SEED data |
| M3 | Paged `getTickets` + filters + `q` + cursor; compat shape; frontend paging / search | no gaps / duplicates across pages while creating; read budget §5.4 |
| M4 | Restricted fields + tickets: `isInChain`, stub, masking (ticket, list, report + CSV, search, history, action logs, notifications, chained copy), share refusal + revoke on turn-on, `revealConfidential` + 3 admin options; field builder + ticket type switches | the "real value appears nowhere in the JSON" string-search tests for every viewer type |
| M5 | Event notifications (rewired `triggerWorkflowNotifications`, fan-out cap, role notifications) + `email_outbox` + drain in `runSLAEscalations` + paged bell | outbox idempotent, quota guard, A19 |

- ~~Fallback: M4 as v10.0.1.~~ **Decided 31 Oct 2026 (D4): Restricted ships in v10.0, no fallback.**

---

## §3 Code map (APPSCRIPT_v9.6_20261031_1510.txt, 16,924 lines)

| Function (line) | v10.0 change | M |
|---|---|---|
| `getTickets` :1790, routes doGet :917 / doPost :1302 | filter → `canViewTicket` → sort → page; stub rows; links indexed for the page only; compat when no `limit` | M1, M3, M4 |
| `getTicketById` :8085, route `getTicket` :1474 | not found when `none`; stub when `stub`; field masking | M1, M4 |
| `getDashboard` :13448 | counts + inbox through the scope (one pass) | M1 |
| `getTicketsForApproval` :13394 | through the scope (head / delegates come in v10.1) | M1 |
| `getReportData` :14110 | scope + date range default 90 days, max 5,000 rows (`truncated`), per-row masking | M1, M4 |
| `searchTicketsByTagsAction` :15088, `getTicketTagsAction` :15015 | scope; stubs match number only | M1, M4 |
| `getSharedTicketsAction` :15223, `getTicketSharesAction` :15187 | scope; Restricted tickets drop out | M1, M4 |
| `getTicketHistory` :7518, `getTicketActionLogs` :14249, `getTicketLinksAction` :13004, `getStepApprovals` :12175 | not found when hidden; `field_changes` masked | M1, M4 |
| `getTicketAttachments` :16809, `canSeeTicketLinks` :16771 | use `canViewTicket` (C2); `canSeeTicketLinks` removed | M1 |
| `addTicketAttachmentLink`, `updateAttachmentLink` | ✅ **done in v9.7** (user, 31 Oct 2026): name required + allowed hosts (`LINK_ALLOWED_HOSTS`, default docs / drive.google.com). v10.0 starts from `APPSCRIPT_v9.7_20261031_1748.txt` | - |
| `createTicket` :1700 | `canCreateTicket`; head snapshot; `is_confidential` from the mode; participants (requester, head, first-step pool); `awaiting_approval` event | M1, M2, M4, M5 |
| `progressTicketWorkflow` :7125 (calls `triggerWorkflowNotifications` :7307) | participants (acted; close / open pool windows); events | M2, M5 |
| `triggerWorkflowNotifications` :8023 | rewired to `queueNotifications` (no second notifier, A20) | M5 |
| `cancelTicketWithReason` :7336, `reopenTicketToStep` :7418 | pool windows close / open; events | M2, M5 |
| `processStepCompletion` :7934, `createTicketWithWorkflow` :7016 | chained child: own type's Restricted mode; confidential values copied only into a Restricted field | M4 |
| `shareTicketAction` :15144, `revokeTicketShareAction` :15199 | participant rows; refuse on Restricted | M2, M4 |
| `setTicketTypeFeatures` :14891 | + visibility, confidential_mode, confidential_admin_access; turning Restricted on revokes shares + watcher rows (one write) | M1, M4 |
| `getCustomFields` :9785, `createCustomField` :9818, `updateCustomField` :5018 | `is_confidential`; turning it off with values = admin + logged | M4 |
| `getNotifications` :15644 | paged + role notifications through the actor's roles | M5 |
| `runSLAEscalations` :15930 | also drains the outbox (A19: tryLock skip, bounded, idempotent) | M5 |
| `getTicketTypes` :2631 | carries the new switches | M1 |

---

## §4 Frontend

- **`getTickets` consumers (C7):** `TicketDashboard` and `TicketReport` → paged (`useTickets` with `limit`, "Load more", 300 ms debounced search); `DashboardPage` → `getDashboard` only (drop its `useTickets`); `AdminPage` → counts from `getDashboard`; `SLANotificationSystem` and the two SLA hooks in `useAPI.js` (:759, :790) → `getDashboard` counts or a filtered page (`status` open, `limit` 100); `approvalRouter.js:475` → `getTicketsForApproval`. Goal: nothing calls `getTickets` without `limit` by the end of v10.0, so v10.1 can drop the compat shape.
- **New Ticket** (`TicketForm`): the type list from `getCreatableTicketTypes`; the 🔒 Restricted checkbox when the type's mode is `optional`.
- **Admin → Ticket Types → features:** visibility, Restricted mode, admin access (3 options).
- **Custom field builder:** 🔒 Restricted switch.
- **`TicketDetail` / `TicketReport`:** masked values `•••••• Restricted`, the stub screen, Reveal (with reason) for admins when the type allows it; Share hidden on Restricted tickets.
- **Bell** (`Header`): paged `getNotifications`.
- **Labels:** `src/config/labels.js` → `RESTRICTED_LABEL` (design §2.7).

---

## §5 Tests (`appscript_files/tools/ROUTES_TEST_v10.0.js`, enforce + identity fields, `TZ=Asia/Manila`)

- **M1 visibility matrix:** requester / approver-role / collaborative-role / shared / admin / outsider × private / collaborative × every read path in §3 (a hidden ticket is *not found* on each); `canCreate` refusal + `getCreatableTicketTypes`.
- **M2:** participants written by create / approve / return / share / revoke; pool window open / close; backfill dry run writes nothing, apply, second apply adds nothing (key ticket + user + reason [+ role + step for pool]).
- **M3:** cursor paging with tickets created between pages (no gaps / duplicates); filters; `q`; compat shape without `limit`; read-count asserts from design §5.4.
- **M4 (the leak tests):** design §7 confidential matrix; for every masked viewer the real value is **absent from the serialized response** (string search) on ticket, list, report + CSV, search, history, action logs, notifications, email bodies; stub key set exact; share refused; Restricted on later revokes shares + watchers in one write; off doesn't restore; chained child follows its own type; 3 admin options; routing on a Restricted field still works.
- **M5:** events → notifications (batched, one `setValues`); fan-out cap > 25 → one role notification; outbox: queued not sent inline, drain idempotent, digest per recipient, quota guard at 80 %, A19 (busy lock skips).
- **All older suites on the new file:** v9.6 … v8.3, SEED, ADMIN_TOOLS (with v1.3), proxy. Expected adjustments are listed per D1.
- **Checks:** `check:api-contract`, `check:code-rules` (+ the new `canViewTicket` rule, design ST-3), `build:ci`, whole-file `/code-review` (C9), log `TODO_CodeReview_<date>.md`.

---

## §6 Deploy (deploy guide gets a "v10 upgrade" section)

1. Paste ADMIN_Tools v1.3 + `APPSCRIPT_v10.0_<stamp>.txt`. Rebuild dry run → apply (2 tabs, 9 columns).
2. JARVIS Admin → **Backfill participants** dry run → apply (before the redeploy, so nobody loses sight of tickets they acted on).
3. Per ticket type: visibility / Restricted / admin access (defaults per D2).
4. Redeploy (ping `10.0.0`) → push the frontend from the same commit → Vercel check.
5. **Behaviour change to announce:** with `private` as the default, a requester stops seeing other people's tickets the moment v10.0 is live (today everyone sees everything).

---

## §7 Decisions (decided 31 Oct 2026: D1, D2, D3, D5, D6 = recommended; D4 = Restricted in v10.0, no fallback)

| # | Question | Recommended | Alternative |
|---|---|---|---|
| D1 | Visibility in `AUTH_MODE` **warn** | **Filter by the actor when there is one (verified uid, else the claimed id); with no actor at all, log `AUTH warn: unscoped <action>` and return unfiltered** - same rollout stance as the v9.6 admin gate; the older suites (warn, no token) keep passing; live is `enforce`, so production is always filtered | Filter always (no actor = nothing visible): stricter, but the older suites' list reads must be rewritten |
| D2 | Default visibility for **existing** ticket types at the rebuild | **`private`** (the design default; fixes G1 at once; there are no testers yet) | `collaborative` for existing types (today's behaviour), switch per type later |
| D3 | SLA escalation emails: keep their v9.5/v9.6 direct digest, or move them into the outbox | **Keep direct in v10.0** (tested, working; the outbox is for the new events); unify in v10.1 | Move both now: one mail path, more change in one release |
| D4 | Restricted (M4) in v10.0 | **Yes, with the M3-gate fallback to v10.0.1** (§2) | Plan it as v10.0.1 from the start |
| D5 | Jest (104 / 174 red since before v9.6) | **Leave it** (not in the reco scope); note it in the review log | Fix the suites first as a v10.0 prerequisite (separate session) |
| D6 | `getTickets` compat shape | **v10.0 only, removed in v10.1** (design §9), with every consumer moved in v10.0 (§4) | Keep it longer |

---

## §8 After v10.0

PROGRESS recalculation at v10.0 live (expected 88.0 % spec / 80.9 % roadmap, design §10 / PROGRESS §2), then **v10.1** (head approval, delegation, bulk approve) on the v10.0 scope / participants.
