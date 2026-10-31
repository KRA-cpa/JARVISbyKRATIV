<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TODO_CodeReview_20261101.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Findings of the /code-review (medium) of AppScript v10.0 and its frontend (session ff4c803f) and their fixes | Status: 10 fixed (CR4-09 partly - see the note)
REVISION HISTORY:
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | 10 findings, all fixed in APPSCRIPT_v10.0_20261031_2053.txt (not yet deployed) and src/; a regression test each
===============================================================================
-->

# TODO — Code Review Findings (1 Nov 2026, v10.0)

**Scope (compliance P7):** what v10.0 added to `appscript_files/APPSCRIPT_v10.0_20261031_2053.txt` over v9.7 (`git diff --no-index`), and the `src/` changes of commits `bc0d2dc..2c2c448`, against compliance A1–A21 / F1–F6 and design `PLAN_FeatureGaps_Volume_20261031.md` §4. `/code-review medium`, read-only.
**Whole-file review (P8):** moved to **after v10.2** (user, 31 Oct 2026: "add code review after 10.2"). That review covers the whole v10.2 file (it contains v10.0 and v10.1) and the counterpart code since v9.7, so P8's "every 3 versions" is met there.
**Fixed in place:** v10.0 has never been deployed, so the same file was corrected (as for v9.4 / v9.5 / v9.6).

| ID | Sev | Where | Finding | Fix | Test (`ROUTES_TEST_v10.0.js`) |
|---|---|---|---|---|---|
| CR4-01 | 🔴 | route `getSLAEscalationEvents` | One ticket's escalation rows (steps, recipients, granted roles) came back for a ticket the caller can't see | `ticketReadGuard` on the route | `CR4-01/02` |
| CR4-02 | 🔴 | routes `updateTicket`, `setCustomFieldValue`, `assignTags`, `removeTags` (+ `updateTicketStatus`, `submitStepApproval`) | Writes didn't check visibility: an outsider could change a hidden / Restricted ticket, and the different refusals told which ids exist; `updateTicket` logged the claimed user | `ticketWriteGuard` (full view, else the missing-ticket answer); `restrictedValueWriteDenied` (a Restricted field only by the chain - design §4.10 "Writing"); `updateTicketWithValidation` on `actorId` | `CR4-01/02` |
| CR4-03 | 🟠 | `getReportData` | The 1-year cap was skipped when only `date_from` was sent | The range runs to now when `date_to` is blank | `CR4-03` |
| CR4-04 | 🟠 | `ARCHIVE_RULES` notifications | Read markers were archived but their role notifications never (never `is_read`) - old notices came back unread, role rows grew forever | Role notifications (no `user_id`) archive after 90 days too | `CR4-04 + CR4-10` |
| CR4-05 | 🟠 | `getTicketLinks`, `withTicketLinks` | The raw link row (`...link`) and `children` / `parent` carried the ids (and the link text) of tickets the caller can't see | A hidden side has no id; the link text only when both sides are fully visible; `withTicketLinks(tickets, views)` drops hidden ids | `CR4-05` |
| CR4-06 | 🟡 | `TicketDashboard` | SLA / priority / date filters ran in the browser over the loaded pages only - the SLA widget links (`?sla=overdue`) showed partial lists | Server filters `sla` (overdue / due_today / on_time / no_sla) and `priority` (stubs never match); the list sends them + `date_from`; the SLA hooks use `getAll({ sla })` | `CR4-06`, `build:ci` |
| CR4-07 | 🟡 | `Tickets.getAll` | Stopped silently at 1,000 tickets | `truncated` flag + a console warning; the SLA hooks now ask the server for exactly their tickets | `build:ci` |
| CR4-08 | 🟡 | `buildActorScope`, `isInChain` | An assignment without a company (a global role, spec 3.1) was dropped: no create rights, no approver / collaborative visibility, no Restricted pool | `'*'` company scopes; spans without a company match every company | `CR4-08` |
| CR4-09 | 🟡 | `buildActorScope` per single-ticket read | Every one-ticket read built the whole scope (~8 tabs) | Requester / immediate head answered without a scope; ticket types and shares are read lazily (an approver is decided before either) - the approval stays at the §5.4 budget of 13 | `CR4-09`; v9.4 budget 12 → 13 |
| CR4-10 | ⚪ | `archiveOldLogs` | One `deleteRow` per archived row inside the lock (6-minute limit on a first big run) | `deleteRowRuns`: one `deleteRows` per contiguous run, bottom-up | `CR4-04 + CR4-10` |

**CR4-09 note:** other viewers (approvers, collaborative roles, admins) still build the scope - one read of roles / assignments / steps / approvers / participants / escalation events per request, each once (A16). That's within the Sheets budgets of design §5.4. On Postgres it is one scope query (design §6.3).

**Checks after the fixes:** `ROUTES_TEST_v10.0.js` 50 (the 7 CR4 tests fail on the pre-fix file); every older suite on v10.0 and still on v9.7; SEED v1.1 4, ADMIN_TOOLS (v1.3) 17, proxy 26; `check:api-contract`, `check:code-rules`, `build:ci` OK.
