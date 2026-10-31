<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_FeatureGaps_Volume_20261031.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Missing features (except attachments), the user's decisions on them, and how they hold up at volume on Sheets and Postgres (reco-style) - the AppScript v10 line | Status: Approved (session 2d369f00), not built
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Initial plan (session 2d369f00); progress figures split out to PROGRESS_FeatureCompletion.md
===============================================================================
-->

# PLAN — Feature gaps + volume design (31 Oct 2026)

## Context
The user asked which features are missing (attachments / attachment links left out, since they're already planned). They then decided how visibility, who-can-create, immediate head approval and delegation should work, and asked for a **detailed plan for handling volume, like the Claude web reco** (19 Oct 2026, reviewed in `docs/planning/REVIEW_AppScriptReco_20261030.md`). Sources checked (read-only): Claude.md §3 + the non-functional targets, the 179 routes in `appscript_files/APPSCRIPT_v9.5_20261030_0650.txt`, `src/`, `docs/planning/SESSION_DUMP_7e008704_20261031.md`, `docs/planning/PLAN_Migration_NeonVercel_20261030.md` §4–§9.

**Status:** approved 31 Oct 2026 (session 2d369f00). Docs only so far: no code. Progress figures live in `docs/planning/PROGRESS_FeatureCompletion.md`.

**Superthink, grounded in the Claude web reco (user decision 31 Oct 2026: don't overdo it).** It's limited to what the reco covers: its findings P1–P8 / S1–S6, its §9 non-functional targets, and the rules taken from it (A14–A20, F1–F6, P7–P10). No broad TODO refresh and no file-by-file audit.
- **ST-1 Reco check of the v10 design.** One table in `PLAN_FeatureGaps_Volume_20261031.md` (new §11): for each reco item, whether v10 keeps it fixed, what could re-break it, and the guard.
  - **P1 / P2 / P7** whole-tab reads → `buildActorScope` + participants are read once (A16), with the §5.4 read budgets as tests.
  - **P3** per-list reads → none added.
  - **P5** single script lock → bulk approve (max 25 + time guard) and batched notification writes.
  - **P6** ids → `ticket_participants` / outbox / delegations ids from `generateId` (A18).
  - **P8** calls per screen → paged `getTickets`, the dashboard stays at 2 calls (F5).
  - **S1** identity → every visibility / Restricted / delegation check uses `actorId` (A15) and server-side masking (F1). The proxy strips identity fields (F6).
  - **S2** time → delegation dates, pool windows and the cursor in real UTC, with Manila only via `formatDate` (A17).
  - **S3–S5** → new tabs through `ensureTableSheet`, header writers, one definition each (A20).
  - **§9 targets** → the §3 / §6.4 budgets and "what breaks first at 10×" (§8).
- **ST-2 Reco-grounded gap from the TODO list:** **user onboarding / invites**. It follows directly from S1 (the v9.6 allow-list refuses users without a `user_profiles` row), so it **ships with v9.6**. An admin adds an email (+ company / roles) as a pending profile, and the first verified sign-in with that email binds the uid. Other old TODO items (tag admin page, MFA, stats, …) are **not** pulled in. Mark `SUPERTHINK_TODO_ANALYSIS_2025-09-27.md` with a short dated note pointing to this plan + PROGRESS as the current list (rule B).
- **ST-3 Gate:** `npm run check:code-rules` gets the new rule "a route returning tickets calls `canViewTicket`" (A14–A20 family). With `check:api-contract`, `build:ci` and the read-count tests, that's the whole superthink gate. The P8 whole-file `/code-review` of v10.0 stays (§9).

**Version line (decided 31 Oct 2026):** this conversation's changes are a **major version: AppScript v10**. v9.6 stays as planned in session 7e008704 (auth hardening, attachment links, company email, idle sign-out). Then **v10.0** = visibility / Restricted / pagination / notifications, **v10.1** = head approval / delegation / bulk, **v10.2** = comments and the rest. Why it's major: `getTickets` changes its response shape (paged), and ticket reads now depend on who the caller is, which every screen has to handle.

Already planned for v9.6 (not repeated here): admin-only action list + sign-in allow-list, company email settings, idle sign-out, plus **user onboarding / invites** (ST-2, pending user agreement). Backlog: file uploads, the slaCalculator +8 h bug, the ticket type Edit route, Neon Phase 0.

---

## §1 Findings (the gaps, with evidence)

| # | Gap | Evidence (v9.5) | Volume risk |
|---|---|---|---|
| G1 | Every signed-in user sees every ticket in every company | `getTickets` :1705 has no actor filter; route `getTicket` :1417 has no check | Security. The response grows with the whole tab |
| G2 | Anyone can create any ticket type | `createTicket` :1615 only resolves `actorId` | - |
| G3 | No pagination or server search; the status filter is the only one | `getTickets` :1726 | Response size + browser memory grow with tickets. Breaks Claude.md "no response > 1 MB" |
| G4 | Workflow events notify no one (only SLA escalation writes `notifications`) | `triggerWorkflowNotifications` :7940 (called at :7224) builds the requester / approver notices but only `Logger.log`s them; the only `MailApp.sendEmail` is in the SLA run :15882. **v10.0 rewires this function** to `queueNotifications` (§4.4) instead of adding a second notifier (A20) | Fan-out per event × approvers; MailApp quota |
| G5 | Immediate head / backup approver stored, never routed | `user_profiles.immediate_approver_id` read only in profile CRUD | - |
| G6 | No delegation | - | Inbox query must cover delegators |
| G7 | No bulk approve | - | N approvals in one lock / one 6-min run |
| G8 | Comments exist only as part of an action; no @mentions, no watchers | `ticket_history.comment` only | New growing tab |
| G9 | "Involved before" (approved earlier) can only be found by scanning `ticket_history`, the biggest tab | - | Visibility would read history on every list call |
| G10 | Not built yet, lower priority: drafts, task-step callback, SLA analytics screen (hooks `useAPI.js:637-681` unused), expiring-assignment view, print/PDF, webhooks, 8 unmounted components | `scripts/api-contract-known-gaps.txt` | Reports / analytics need a row cap on Sheets |

---

## §2 Decisions taken (31 Oct 2026)

1. **Who can create:** only users with a role on that ticket type + company. The New Ticket list is filtered, and `createTicket` refuses others.
2. **Visibility per ticket type:** `ticket_types.visibility` = `private` (default) | `collaborative` (later maybe `department`). Set next to `enable_tags` / `enable_sharing` via `setTicketTypeFeatures`; no lock.
   - `private`: requesters see their own tickets + the ones they're involved in (shared / acted on / can act now / watching). Approver roles on that type + company see all of them.
   - `collaborative`: any role on that type + company sees all of them. Admins see everything.
3. **Immediate head approval:** ticket type switch `require_immediate_head_approval`. A system step runs before the configured chain and goes to the head (or the backup approver if no head). If no head is set, submitting is blocked (default, can be changed). SLA comes from a company SLA rule named "Immediate head approval" if one exists.
4. **Delegation (optional):** set by the approver (Profile) or by an admin. Fields: delegate, date range, optional ticket types (default all, the head step included). The approver keeps access. Recorded "on behalf of". No chaining, no self-delegation.
5. **Confidential fields** (label: Restricted): a custom field can be tagged confidential. Its value is shown only to people **in the ticket's chain**. Everyone else who can see the ticket (collaborative scope, shared, watchers, non-chain approver roles) sees it **masked**, even on a collaborative ticket. Details in §4.10.
6. **Confidential tickets** (label: Restricted): a whole ticket can be confidential. People outside its chain see only a **masked stub**. **No sharing.** Chained children **don't inherit**: they follow their own ticket type's setting. Set per ticket type: off / optional (requester ticks it) / always. Admin access is per ticket type with **3 options** (reveal with reason, the default / always see / never see). Details in §4.11.
7. **Label (31 Oct 2026):** the UI, emails and CSV say **"Restricted"** (🔒 Restricted ticket, `•••••• Restricted` for a field), never "Confidential". Internal names stay `is_confidential` / `confidential_admin_access` / `revealConfidential`. The label comes from one constant (`src/config/labels.js` → `RESTRICTED_LABEL`, plus `RESTRICTED_LABEL` in AppScript for email text) so it can be renamed later. A later role-type visibility mode would be labelled **"Team only"**.

---

## §3 Volume targets (from Claude.md / reco §9)

| Data set | Companies | Users | Ticket types | Tickets | History | Notifications (est. ~15 / ticket) | Participants (est. ~5 / ticket) |
|---|---|---|---|---|---|---|---|
| PoC | 5 | 50 | 10 | 10k | 100k | 150k | 50k |
| Design ×10 | 50 | 500 | 100 | 100k | 1M | 1.5M | 500k |

**Sheets ceiling:** 10M cells per spreadsheet. At ×10: history 1M × 8 cols = 8M, tickets 100k × ~22 = 2.2M, notifications 1.5M × 10 = 15M. **Sheets cannot hold ×10.** It holds the PoC set only if logs are archived (§5.3). So the design is: **the same feature contract on both backends, Sheets kept within the PoC, Postgres for ×10.**

**Latency targets (Postgres, measured at `/api/rpc`):** simple read ≤150 ms, list/dashboard ≤300 ms, ticket write ≤400 ms, bulk approve ≤400 ms per ticket, report ≤1.5 s at 10k. **Sheets:** no ms target (the Apps Script floor is ~1–2 s). The gate there is **tab reads per request** (P10) + response size.

---

## §4 Shared design (both backends)

### 4.1 `ticket_participants`: the visibility index (fixes G9)
Each ticket keeps its own list of who is involved, written **at the moment of the action**, so no list call ever scans history.
- Columns: `id, ticket_id, user_id, role_id, step_id, reason (requester | acted | shared | watcher | head | pool), window_start, window_end, company_id, ticket_type_id, created_at, is_active`. `user_id` is blank for `pool` rows (role-based, §4.10). The backup and delegates get **no** row until they act (their live access is computed).
- Written by `createTicket` (requester, head, pool rows for the first step), `progressTicketWorkflow` (acted, on behalf of → both ids; closes the current step's pool windows and opens the next step's), `shareTicket` / `revokeTicketShare` (shared, soft), watch / unwatch.
- One-off backfill from `ticket_history` + `ticket_shares` (`backfillTicketParticipants()` dry run / apply, JARVIS Admin menu, idempotent: key = ticket + user + reason).
- "Can act now" is **not** stored, because it changes with every step. It comes from the inbox logic (current step approver roles, head id, delegations).

### 4.2 Actor scope: computed once per request
`buildActorScope(actorId)`, called once and passed down (A16):
- `isAdmin`; `roleScopes` = set of `company|ticket_type` where the actor has any active role (dates respected); `approverScopes` = the subset where one of those roles is an approver on any step of that type + company (from `step_approvers` + `workflow_steps`); `delegators` = approvers whose active delegation names the actor (with their type filter); `participantTicketIds` = the actor's rows in `ticket_participants`.
- `canViewTicket(scope, ticket, type)`: admin → yes; participant → yes; `collaborative` and `roleScopes` has company|type → yes; `private` and `approverScopes` has it → yes; current-step approver / head / delegate → yes; else no.
- `canCreateTicket(scope, company, type)`: `roleScopes` has company|type (or admin).
- Used by **every** ticket read: `getTickets`, `getTicket`, `getDashboard`, `getTicketsForApproval`, `getReportData`, `searchTicketsByTags`, `getSharedTickets`, `getTicketHistory`, `getTicketActionLogs`, links / tags / comments reads. A "not visible" ticket returns **not found**, not "forbidden", so it doesn't reveal that the ticket exists.

### 4.3 Pagination + search contract (fixes G3)
- Request: `{ action: 'getTickets', limit (default 50, max 100), cursor, filters: { status[], company_id, ticket_type_id, requester_id, mine, involved, date_from, date_to, q } }`. `q` matches ticket number prefix or title words.
- Response: `{ success, data: { items, next_cursor, has_more } }`. Cursor = base64 of `created_at|id` (newest first). **No total count** (it would cost a full scan on both backends). The dashboard counts come from `getDashboard`.
- The frontend (`src/api/googleSheet.js` + `useTickets`) uses "Load more" / infinite scroll and a debounced search (300 ms). The read cache key includes filters + cursor (F5: the dashboard stays at 2 calls).
- Compatibility: during the cutover, `getTickets` without `limit` keeps the old array shape for one version (logged as deprecated), then it's removed.

### 4.4 Notifications: fan-out and email (fixes G4)
- Events: `awaiting_approval` (to the current step's eligible approvers + delegates + head), `approved_step`, `returned`, `rejected`, `completed`, `cancelled` (to the requester + watchers), `mentioned`, `shared`, `delegation_started/ended`.
- **Batch writes:** all of an event's notification rows go in one `setValues` (Sheets) / one multi-row `insert` (PG), inside the same lock / transaction as the workflow write.
- **Fan-out cap:** if a step's approver role has > 25 eligible users, write **one role notification** (`recipient_role_id`) that the bell reads through the actor's roles, instead of one row per user. This keeps the ×10 growth linear in tickets, not tickets × role size.
- **Email never inline:** rows go to an `email_outbox` tab/table (`status pending | sent | failed | skipped`, `attempts`). The existing 15-minute trigger (`runSLAEscalations`) also drains the outbox, idempotent (A19), with one **digest per recipient per run**. It honours `user_preferences` and company/type email switches (v9.6). MailApp quota guard: stop at 80 % of `MailApp.getRemainingDailyQuota()`, leave the rest pending. On PG: the same outbox drained by Vercel Cron → Resend / SES (migration plan §9).
- Reading: `getNotifications({ limit 20, cursor, unread_only })` + `markNotificationsRead(ids | all)`.

### 4.5 Immediate head step (G5)
- At `createTicket`: read `user_profiles` (cached) once, then **snapshot** `head_approver_id` + `head_backup_id` onto the ticket (new columns). Later profile changes don't move tickets already in flight, and the inbox doesn't have to join profiles.
- The system step id is `__head__` in `current_step_id`, and its status is "For immediate head approval". On approve, routing continues to the first configured step (the existing conditional routing, unchanged). A return goes to the requester. History shows "Immediate head approval".
- Inbox: tickets where `current_step_id = '__head__'` and `head_approver_id` ∈ {actor} ∪ delegators. The backup can act only when the head is inactive / not set.

### 4.6 Delegation (G6)
- `approval_delegations(id, approver_id, delegate_id, ticket_type_ids (json, blank = all), start_date, end_date, set_by, is_active + audit)`. Small table, read once per request into the actor scope.
- The approval check (`canUserApprove`, `progressTicketWorkflow`) accepts the actor if they're an approver **or** an active delegate of one for that ticket's type. History / action log store `user_id = delegate`, `on_behalf_of = approver`.
- Dates: in Asia/Manila days via `formatDate` (A17). Start and end are inclusive.

### 4.7 Bulk approve (G7)
- `bulkSubmitStepApproval({ ticket_ids (max 25), decision, comment })`: each ticket is its **own all-or-nothing unit** (one ticket's failure doesn't undo the others). Response `{ results: [{ ticket_id, success, error }] }`.
- Sheets: one `withScriptLock` for the batch, the table cache shared across the tickets (the second ticket onward reads nothing new), writes batched per tab at the end (rows collected, then one `setValues` per tab). A time guard stops at 4 min and returns the rest as `not_processed` (the 6-min limit).
- The frontend splits a selection into chunks of 25. PG: one transaction per ticket, optimistic `version` check (migration plan §5).

### 4.8 Comments, mentions, watchers (G8)
- `ticket_comments(id, ticket_id, user_id, body, mentions (json), created_at, edited_at, is_active)`. Read only for one ticket (`getTicketComments({ ticket_id, limit 50, cursor })`), not in lists.
- A mention doesn't grant visibility. The mention picker lists only people who can already see the ticket (no leaking through mentions). A mention adds a `mentioned` notification.
- Watch / unwatch = participant row `watcher` (soft).

### 4.9 Reports at volume
- `getReportData` requires a date range (default the last 90 days, max 1 year on Sheets) and applies `canViewTicket`. Sheets: max 5,000 rows per run, `truncated: true` beyond that (CSV export via `src/utils/csvExport.js` on what was returned). PG: read replica + server-streamed CSV, no row cap.

### 4.10 Confidential fields (decision 5)
- **Setting:** `custom_fields.is_confidential` (default false), set in the custom field builder (ticket fields only, and `date_range` counts as one field). Turning it **on** is always allowed. Turning it **off** for a field that has values needs an admin and is audit-logged, because it reveals past values.
- **"In the chain" for a ticket (decided 31 Oct 2026):**
  | Who | Sees Restricted content |
  |---|---|
  | Requester | always |
  | Anyone who **acted** (approve / return / reject / complete, incl. the approver an action was taken on behalf of) | always, from then on |
  | **Immediate head** (snapshot) | from creation (the head step comes first) |
  | **Backup approver** (snapshot) | only **while they can act** (head inactive / not set and the ticket is at the head step) **or if they acted**. Otherwise the stub |
  | **Step pool** (users holding a step's approver role for that type + company, incl. v9.5 `escalate_role` grants) | **from the moment the ticket reaches their step, onwards**, even if another pool member approved (shared accountability). Future steps: stub until it reaches them |
  | **Delegate** | while the delegation is active and the ticket is at a step their delegator can act on, or if they acted. Otherwise the stub |
  | Collaborative-scope viewers, shared users, watchers, mentioned users | never (stub / masked) |
- The head + backup (named people from the requester's profile) are **separate from the step pool** (role-based, many people).
- **Pool access is recorded per role, not per user:** when a ticket enters a step, `ticket_participants` gets one row per approver role: `reason = 'pool'`, `role_id`, `step_id`, `window_start` = entered, `window_end` = left (blank while it's there). A user is in the pool if one of their `user_role_assignments` for that role + type + company **overlapped the window** (effective dates respected). So someone who held the role while it was at the step keeps access after losing the role, and someone who got the role after the step passed doesn't. A return or revisit opens a new window. This is one row per role per visit, not one per user (a pool can be 200 people), and no history scan is needed.
- **Admins:** follow the same 3-option admin setting as confidential tickets (§4.11): `reveal_with_reason` (default; `revealConfidential({ ticket_id, reason })`, admin-only, written to `admin_action_logs`) | `always` | `never`.
- **Masking is server-side only (F1):** a value not shown is never sent. It comes back as `{ field_id, masked: true }`, and the UI shows `•••••• Restricted`. It applies everywhere a value can leave the server: `getTicket`, `getTickets` (if field values are listed), `getReportData` + CSV (per row: masked for rows where the viewer isn't in the chain), `searchTickets` (`q` never matches confidential values), `getTicketHistory` / `getTicketActionLogs` (`field_changes` for confidential fields shown as `changed` with no values), notification and email text (never include the value), webhooks later, chained-ticket copy (the child doesn't inherit confidentiality: a confidential value is copied only if the child's matching field is also confidential; otherwise it's left blank, and the admin is warned in the workflow builder).
- **Server logic still uses real values:** conditional routing (`step_conditions`), SLA rules, required-field checks.
- **Writing:** only chain members (and the requester before submit) can set or change a confidential value. Others get "not allowed" even if they can edit the ticket.
- **Volume:** no extra tab reads. The chain set comes from data `buildActorScope` already loads (participants, `step_approvers` + `workflow_steps`, delegations), as `isInChain(scope, ticket)`. For a report it's one map lookup per row. The confidential field ids are read once from `custom_fields` (already in the cache). On PG: `is_in_chain` is an `exists` over `ticket_participants` + the scope rows, evaluated only for tickets in the page, with no extra index.

### 4.11 Confidential tickets (decision 6)
- **Who decides (decided):** `ticket_types.confidential_mode` = `off` (default) | `optional` (the requester ticks 🔒 Restricted on the New Ticket form) | `always` (every ticket of the type). It's a separate switch from `visibility`: private / collaborative keep their meaning, and Restricted narrows a ticket to its chain. No role-type rule. A "Team only" visibility mode can be added later without touching this.
- **Flag:** `tickets.is_confidential` (set at create from the mode + checkbox, then fixed; only an admin can change it, audit-logged). `createTicket` refuses `is_confidential=true` when the mode is `off`, and forces it when the mode is `always` (F1, server decides).
- **Admin access setting (decided, per ticket type):** `ticket_types.confidential_admin_access` = `reveal_with_reason` (default) | `always` | `never`. It covers Restricted tickets **and** Restricted fields of that type.
- **The chain** is the same table as §4.10 (requester, acted, head, backup only while acting / if acted, the step pool from when the ticket reaches their step, delegates while active). The ticket type's visibility (private / collaborative) and approver-role scope **don't apply**: only the chain sees the content.
- **Outsiders get a masked stub:** it shows up in lists / search results / the approver-role scope as `{ id, ticket_number, status, company_id, ticket_type_id, created_at, confidential: true }`. No title, requester, fields, history, comments, attachments or links. Opening it → "🔒 This ticket is restricted to the people in its approval chain". The stub only appears to people who could see the ticket if it weren't confidential (§4.2). Everyone else gets nothing, as for any hidden ticket. Search `q` matches only the ticket number for stubs (never the title). Reports: a stub row with the same fields; CSV the same.
- **No sharing:** `shareTicket` refuses confidential tickets; the Share button is hidden. **Turned on later by an admin (decided 31 Oct 2026):** people who had access only through a share **can't view it any more**. All active shares are revoked in the same write (soft, `revoked_reason = 'restricted'`, audit-logged), and their watcher rows go too. The ticket drops out of their "Shared with me". If they're also in the ticket's normal scope (collaborative / approver role) they see only the stub; otherwise nothing. They get no notification (it would draw attention to the ticket). If Restricted is turned off again, shares are **not** restored automatically: someone has to share again. Restricted *fields* don't revoke shares: shared users just see those values masked.
- **Chained children don't inherit:** a child follows its own ticket type's setting. Its link to the parent is shown, but the parent appears as a stub to anyone outside the parent's chain. Confidential parent values are copied into the child only under the §4.10 field rule.
- **Notifications / email:** chain members get the normal text. Watchers aren't allowed on confidential tickets unless they're in the chain. Email subjects never include the title, only "[JARVIS] <ticket number> needs your action".
- **Volume:** no extra tab reads. `canViewTicket` returns `full | stub | none`, using the same `isInChain` maps as §4.10. On PG the page query adds `case when t.is_confidential and not is_in_chain then stub` in the select, with no extra query. The index `tickets(company_id, ticket_type_id, created_at desc, id desc)` still serves it.

---

## §5 Apps Script implementation (v10.0 + v10.1)

**Rules that apply:** A1 header-driven rows, A5 `withScriptLock`, A12 contract, A13 no payload `action`, **A14** `invalidateTable` after every write, **A15** `actorId`, **A16** one read per tab per request, A17 UTC + `formatDate`, A18 ids from `generateId` / a sequence, A19 idempotent triggers, A20 one definition per function.

### 5.1 v10.0: visibility, pagination, search, participants, event notifications, email outbox
- Schema (rebuild apply via `ensureTableSheet`, dry run first): new tabs `ticket_participants`, `email_outbox`. Columns: `ticket_types.visibility` (`COLUMN_DEFAULTS` = `private`), `ticket_types.require_immediate_head_approval` (false, used in v10.1), `notifications.recipient_role_id`, `tickets.head_approver_id`, `tickets.head_backup_id`, `custom_fields.is_confidential` (false), `tickets.is_confidential` (false), `ticket_types.confidential_mode` (`off`), `ticket_types.confidential_admin_access` (`reveal_with_reason`). Confidential fields and tickets ship in v10.0 because they use the same scope / read paths. New helpers `isInChain`, `maskConfidentialValues(records, scope, ticket)`; route `revealConfidential`. Frontend: the "🔒 Restricted" checkbox in the field builder, the masked display in `TicketDetail` / `TicketReport`.
- New helpers: `buildActorScope`, `canViewTicket`, `canCreateTicket`, `addParticipants(records)` (batched), `queueNotifications(event, ticket, ctx)` (batched + fan-out cap), `queueEmails`, `drainEmailOutbox` (called from `runSLAEscalations`), `encodeCursor` / `decodeCursor`, `applyTicketFilters`.
- Changed: `getTickets` (filter → visibility → sort → page; links indexed only for the page's ids), `getTicket` route (not-found when not visible), `getDashboard`, `getTicketsForApproval`, `getReportData`, `searchTicketsByTags`, `getSharedTickets`, `getTicketHistory`, `getTicketActionLogs`, `createTicket` (G2 + participants + `awaiting_approval`), `progressTicketWorkflow` (participants + events), `shareTicket` / `revokeTicketShare`, `getNotifications` (paged + role notifications), `setTicketTypeFeatures` (+ visibility).
- JARVIS Admin menu (`ADMIN_Tools` v1.1): backfill participants (dry run / apply), outbox status, **spreadsheet size check** (cells used per tab vs the 10M limit), archive logs (§5.3).
- Frontend: `useTickets` paging + filters + search box on `TicketsPage` / `TicketDashboard`; New Ticket lists only `canCreate` types (from a `getCreatableTicketTypes` action, not client logic, F1); the visibility picker in the ticket type features; the bell on paged notifications.

### 5.2 v10.1: immediate head step, delegation, bulk approve
- Tab `approval_delegations`. Routes `getDelegations`, `createDelegation`, `endDelegation` (approver for self, admin for anyone), `bulkSubmitStepApproval`.
- Changed: `createTicket` (head snapshot + block), `progressTicketWorkflow` / `canUserApprove` / `getTicketsForApproval` (`__head__` + delegates), the SLA due date for the head step, escalation rules matching `__head__`.
- Frontend: Profile → Delegation panel; Admin → Users → Delegations; ticket type switch "Require immediate head approval"; inbox checkboxes + Bulk approve / reject (`ActionCommentModal`, currently unmounted, gets mounted here).

### 5.3 v10.2 (later): comments / mentions / watchers, drafts, SLA analytics screen, expiring assignments, task callback, webhooks, print view.
Log archiving on Sheets: a monthly trigger moves `notifications` rows that are read and > 90 days old, and `ticket_action_logs` / `admin_action_logs` rows > 12 months old, into a separate archive spreadsheet (`ARCHIVE_SPREADSHEET_ID` Script Property). Idempotent by id. History is never archived while on Sheets.

### 5.4 Read / write budget per action (Sheets: tab reads per request; P10 gate in the tests)

| Action | Tabs read (target) | Writes (setValues calls) | Notes |
|---|---|---|---|
| getTickets (page) | ≤ 8: tickets, ticket_types, user_role_assignments, roles, step_approvers, workflow_steps, ticket_participants, approval_delegations (+ ticket_links for the page) | 0 | today 2 + no scope |
| getTicket | ≤ 10 | 0 | + history, custom_field_values for one ticket |
| getDashboard | ≤ 9 | 0 | one pass for counts + inbox |
| getTicketsForApproval | ≤ 8 | 0 | |
| createTicket | ≤ 9 (v9.4: 7) | ≤ 6 (ticket, cfv, history, action log, participants, notifications + outbox) | |
| submitStepApproval | ≤ 13 (v9.5: 11) | ≤ 7 | |
| bulkSubmitStepApproval (25) | ≤ 14 total (cache shared) | ≤ 7 total (batched per tab) | not 25 × 13 |
| getNotifications | ≤ 2 (notifications, user_role_assignments) | 0 | |
| runSLAEscalations + outbox drain | each tab once | ≤ 3 | |

### 5.5 Sheets ceiling: when to stop and migrate
Migrate (start Neon Phase 0, migration plan §6) when **any** of these is true: a tab passes 20k rows; the spreadsheet passes 5M cells (half the limit); p95 `getTickets` passes 4 s in `scripts/measure-api-latency.js`; lock waits fail (`withScriptLock` timeout) more than once a day. JARVIS Admin → Status shows these numbers.

---

## §6 Postgres design (carried into the migration plan as §12)

### 6.1 Tables / columns
Same as §5.1 / §5.2 plus `tickets.version int` (optimistic lock), `tickets.search tsvector` (generated from number + title), and `ticket_comments`.

### 6.2 Indexes (in addition to migration plan §4)
- `tickets(company_id, ticket_type_id, created_at desc, id desc)`: collaborative / approver scope pages
- `tickets(requester_id, created_at desc, id desc)`: "mine"
- `tickets(head_approver_id) where current_step_id = '__head__'`: head inbox
- `tickets(current_step_id) where status not in ('Completed','Rejected','Cancelled')`: approver inbox (exists)
- GIN `tickets(search)` + `pg_trgm` GIN on `ticket_number`: search
- `ticket_participants(user_id, ticket_id)` unique `(ticket_id, user_id, reason) where is_active`
- `approval_delegations(delegate_id, start_date, end_date) where is_active`
- `notifications(user_id, is_read, created_at desc)` (exists) + `notifications(recipient_role_id, created_at desc) where recipient_role_id is not null`
- `email_outbox(status, created_at) where status = 'pending'`
- `ticket_comments(ticket_id, created_at)`

### 6.3 The list query (≤ 3 queries: scope, page, links)
1. Scope (one query, cached for the request): admin flag + `role_scopes` (company, type, is_approver) + delegators.
2. Page: `select … from tickets t join ticket_types tt on tt.id = t.ticket_type_id where (filters) and (t.created_at, t.id) < ($cursor) and ( $is_admin or exists (select 1 from ticket_participants p where p.ticket_id = t.id and p.user_id = $actor and p.is_active) or (t.company_id, t.ticket_type_id) in (select company_id, ticket_type_id from unnest($scope) …) where tt.visibility = 'collaborative' or s.is_approver ) or t.head_approver_id = any($actor_and_delegators) ) order by t.created_at desc, t.id desc limit $limit + 1`. Show `EXPLAIN (ANALYZE, BUFFERS)` in `docs/perf/` at 100k tickets.
3. Links for the page ids: `where parent_ticket_id = any($ids) or child_ticket_id = any($ids)`.

### 6.4 Query budget per action

| Action | Queries | Indexes |
|---|---|---|
| getTickets | 3 | 6.2 tickets ×3, participants |
| getTicket | ≤ 5 (scope, ticket + type, cfv, history page, comments page) | pk, `ticket_history(ticket_id, timestamp)` |
| getDashboard | ≤ 5 | as getTickets + inbox |
| createTicket | ≤ 8, one transaction | sequence row lock |
| submitStepApproval | ≤ 10, one transaction | version check |
| bulkSubmitStepApproval | ≤ 10 per ticket, a transaction each | |
| getNotifications | 2 | notifications ×2 |
| outbox drain (cron) | 3 per batch of 100 (`for update skip locked`) | outbox partial |

### 6.5 Growth handling
`notifications`, `ticket_history`, `ticket_action_logs`, `ticket_participants`: monthly range partitions once a table passes ~1M rows. Notifications that are read and > 90 days old are deleted by partition drop (they're not records; the history keeps the facts). This is the one documented exception to "soft delete only", **flag for the user's approval**. Reports run on the read replica.

---

## §7 Testing and measurement

- **Offline (Sheets):** `ROUTES_TEST_v10.0.js` / `v10.1.js` on the fake runtime: visibility matrix (requester / approver / collaborative / admin / shared / delegate / head × private / collaborative), not-found for hidden tickets, `canCreate`, cursor paging (no duplicates or gaps across pages while new tickets are created), search, fan-out cap, outbox idempotency + quota guard, bulk 25 with the 4-min guard (fake clock), participants backfill dry run / apply idempotent. **Confidential matrix:** for each viewer type (requester, head, backup before / while / after acting, pool member of a passed step who didn't act (sees), future-step pool member (stub), user given the role after the step passed (stub), user whose role ended after the step (sees), revisit after a return, delegate active / ended, collaborative viewer, shared, watcher, admin with and without Reveal), check `getTicket`, report rows + CSV, search, history, notifications and email bodies. A test fails if the real value appears **anywhere** in a masked viewer's response JSON (a string search over the serialized response). Routing on a confidential field still works. **Confidential ticket:** outsiders inside scope get only the stub keys (assert the exact key set); outsiders outside scope get nothing; share refused; turning Restricted on later revokes every share + watcher row in the same write, and a shared-only user then gets not-found (an in-scope user gets the stub); turning it off doesn't restore shares; a child of a confidential parent follows its own type; all 3 admin options. **Read-count asserts** from §5.4 (P10). Plus the existing suites on the new file.
- **Volume on Sheets:** `SEED` v1.1 option `seedVolume(n)` (editor-only) creates n tickets with history for one seed company, then `measure-api-latency.js` at 1k / 5k / 10k tickets. Record p50 / p95 + response bytes in REVIEW §5 (new table "v10.0 at volume").
- **Postgres:** `scripts/seed-pg.js` at PoC and ×10 (§3), a k6 run of 50 concurrent dashboards + 20 approvals + 1 bulk of 25 + search, `EXPLAIN` for list / inbox / search / notifications.
- **Per-request log (Claude.md working rule):** Sheets `console.log('[perf]', { action, duration_ms, tab_reads, user_id, company_id, status })` from `doPost`, with `tab_reads` counted in `sheetValues`. PG: the same fields in `/api/rpc`.
- **Checks before push:** `npm run check:api-contract`, `npm run check:code-rules` (new rule: any route that returns tickets must call `canViewTicket`; add to `scripts/check-code-rules.js`), `npm run build:ci`, `/code-review` on `git diff --no-index` v9.6 → v10.0.

## §8 What breaks first at 10×, and what we'd change
1. **Sheets cell limit** (history + notifications + logs). Change: the archive trigger buys time, but the real answer is the migration. §5.5 says when.
2. **`getTickets` on Sheets** still reads the whole tickets tab on every page. Change: on PG, the indexed page query (§6.3). On Sheets nothing more can be done except a smaller tab via archiving closed tickets older than 2 years into the archive spreadsheet (option, not planned).
3. **Notification fan-out** for big approver roles. Change: the role notification at > 25 users (§4.4), partitions on PG.
4. **Script lock contention** (bulk approve + notifications in the lock). Change: batch writes, max 25, the 4-min guard; on PG, row-level locks per ticket.
5. **Email quota** (MailApp 100/day consumer, 1,500 Workspace). Change: digest outbox + quota guard; on PG, Resend / SES.

## §9 Order
v9.6 (as decided) → **v10.0** (§5.1) → **v10.1** (§5.2) → v10.2 (§5.3).

**What the major bump changes:**
- File `APPSCRIPT_v10.0_<YYYYMMDD>_<HHMM>.txt`, header `Version: 10.0.0`, `API_VERSION = '10.0.0'`, `Deploy description: v10.0 …`. No check compares version numbers: `scripts/check-api-contract.js:53` and `scripts/check-code-rules.js:53` pick the newest file by its **timestamp**, and their regex `v(\d+)\.(\d+)` already matches `v10.0` (checked). `ROUTES_TEST_v10.0.js` etc. run alongside all the v8.3–v9.6 suites on the new file.
- **Breaking change handled:** `getTickets` without `limit` returns the old array (logged as deprecated) **only in v10.0**. It's removed in v10.1. The frontend ships from the same commit (as always).
- **Whole-file review (compliance P8, every 3 versions):** v9.4, v9.5 and v9.6 make three since the last whole-file review (the 19 Oct reco on v9.3), so **v10.0 gets a whole-file `/code-review`**, not only the diff.
- Claude.md MANDATORY REFERENCES §7: the "Latest File" line points to v10.0, and the v9.x entries move under it. The deploy guide gets a "v10 upgrade" section: the rebuild apply (new tabs / columns), then `backfillTicketParticipants` dry run → apply, then set `visibility` / Restricted per ticket type, then redeploy.
- `SEED_TestData` v1.1 (Restricted + collaborative + head + delegation seed cases, `seedVolume(n)`) and `ADMIN_Tools` v1.1 (backfill, outbox, size check, archive). The migration starts when §5.5 triggers, and §6 goes into the migration plan as §12 now so the Postgres side is designed alongside. Each version: new timestamped APPSCRIPT file, `Deploy description`, `API_VERSION`, deploy guide update, Claude.md MANDATORY REFERENCES entry, review log `TODO_CodeReview_<date>.md`, frontend from the same commit, one push + one Vercel check at the end (batch rule).

## §10 Progress
Moved to `docs/planning/PROGRESS_FeatureCompletion.md` (spec basis A, rebased scope B, per feature C, history, scope changes).

---

## §11 Reco check of the v10 design (superthink ST-1)

Grounded in the Claude web reco (19 Oct 2026, verdicts in `docs/planning/REVIEW_AppScriptReco_20261030.md` §1). For each reco item: is it still fixed after v10, what in v10 could re-break it, and the guard.

| Reco item | Fixed in | v10 risk | Guard in v10 |
|---|---|---|---|
| P1 whole-tab read per lookup | v9.4 table cache (A14) | `buildActorScope`, `ticket_participants`, `approval_delegations` add tabs to every ticket read | each read once per request through `readTable` / `sheetValues`; §5.4 read budgets asserted in `ROUTES_TEST_v10.x` (P10) |
| P2 one approval reads ~20 tabs | v9.4 cache + read-count test (A16) | participants windows + notifications + outbox writes inside `progressTicketWorkflow` | `submitStepApproval` ≤ 13 reads / ≤ 7 writes (§5.4); rows collected and written once per tab |
| P3 per-list option reads | v9.4 one read | none added | - |
| P4 health check on dashboard | not happening | - | - |
| P5 single script lock | by design until migration | bulk approve (25 tickets) and notification fan-out lengthen the lock | max 25 per call, 4-min time guard, batched writes, role notification above 25 users (§4.4, §4.7) |
| P6 `max(id)+1` ids | v9.4 sequence (A18) | new tabs need ids | `generateId` / a sequence for `ticket_participants`, `email_outbox`, `approval_delegations`, `ticket_comments` |
| P7 links filtered per ticket | v9.4 indexed once | paging could re-filter links per ticket | links indexed once, only for the page's ids (§5.1) |
| P8 one call per widget | v9.4 `getDashboard`, client dedupe (F5) | paged lists + search fire more calls | dashboard stays 2 calls; search debounced 300 ms; cache key = filters + cursor (§4.3) |
| S1 no server-side identity | v9.4 proxy + `actorId` (A15, F2, F6); v9.6 admin checks | visibility / Restricted / delegation decisions trusting a payload id | every check on `actorId(...)`; masking server-side only (F1); payload `user_id` ignored in enforce mode; new code-rules check "a route returning tickets calls `canViewTicket`" (ST-3) |
| S2 timestamps +8 h | v9.4 real UTC (A17) | delegation dates, pool windows, cursors, Manila-day logic | all stored UTC; Manila days only via `formatDate`; cursor = UTC `created_at|id` |
| S3 `getSheetByName` never initializes | v9.4 | new tabs | created only through `ensureTableSheet` + `TABLE_SCHEMAS` |
| S4 duplicate function | v9.4 (A20) | `triggerWorkflowNotifications` vs a new notifier | v10.0 rewires the existing function to `queueNotifications`, no second notifier |
| S5 positional writers | v9.4 (A1) | new writers | `rowFromRecord` only |
| S6 unused helpers | not ported | - | - |
| §9 latency / query budgets | Claude.md v4.0 | new actions without a budget | §3 targets, §5.4 (Sheets) and §6.4 (Postgres) per action; §8 "what breaks first at 10×" |

**ST-2 (from the old TODO list, reco-grounded):** user onboarding / invites follows from S1 (the v9.6 allow-list refuses users without a `user_profiles` row), so it is proposed **for v9.6**. Nothing else from `SUPERTHINK_TODO_ANALYSIS_2025-09-27.md` is pulled in (tag admin page, MFA, stats and the rest stay out until asked).

**ST-3 gate:** `npm run check:code-rules` (with the new `canViewTicket` rule), `npm run check:api-contract`, `npm run build:ci`, the read-count tests, and the P8 whole-file `/code-review` of v10.0.
