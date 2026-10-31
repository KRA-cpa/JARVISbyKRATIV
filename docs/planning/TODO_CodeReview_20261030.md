<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TODO_CodeReview_20261030.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 30 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Findings of the /code-review (high) of the v9.4 + v9.5 batch (session 7e008704) and their fixes | Status: All 10 fixed before the first commit
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | 10 findings, all fixed in the uncommitted v9.4 / v9.5 drafts and the frontend / proxy / scripts
===============================================================================
-->

# TODO — Code Review Findings (30 Oct 2026)

**Scope (compliance P7):** `git diff --no-index` v9.3 → v9.4 and v9.4 → v9.5, plus the new proxy, scripts, tests and the `src/` changes. `/code-review high`, read-only (no verify pass), so the findings were candidates; each fix has a regression test where one is possible.
**Covers P9:** no review logs exist for v9.1–v9.3; this review read the v9.4 / v9.5 changes, not v9.1–v9.3.
**Fixed in place:** `APPSCRIPT_v9.4_20261030_0627.txt` and `APPSCRIPT_v9.5_20261030_0650.txt` had never been committed or deployed, so they were corrected before their first commit instead of getting new files.

| ID | Sev | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| CR2-01 | 🔴 | v9.4 / v9.5 `createTicket` | `actorId(payload.requester_id)` also ran for **chained** tickets. Under `enforce` the approver who completed the step became the child's requester | `createTicket(payload, { requesterIsTarget: true })` from `createTicketWithWorkflow` (the chained path) | v9.5 `CR2-01` |
| CR2-02 | 🔴 | `src/api/googleSheet.js` | A write cleared the cache but not `inFlightReads`. A read started before the write was shared with a refetch after it and re-cached the old data, so the ticket showed "still pending" after an approval | `cacheGeneration` bumped on every write; a read from an older generation doesn't fill the cache; `inFlightReads.clear()` on write; `finally` deletes only its own entry | `build:ci` (no client test harness) |
| CR2-03 | 🔴 | v9.5 `slaEscalationPass` | Mail was sent **before** the event rows (the idempotency record) were written. A failure in between re-sent the same mail every run | Events, notices (`email_status: queued`) and logs are written first; mail afterwards; `email_status` updated in one batch | v9.5 `CR2-03` |
| CR2-04 | 🟠 | v9.5 `slaFireTime` | `before_due` measured its look-back by counting forward from the due date with the calendar, so weekends after it stretched the span (a Friday due date warned on Tuesday) | Wall-clock look-back (validation already limits `before_due` to minutes / hours / days) | v9.5 `CR2-04` |
| CR2-05 | 🟠 | v9.5 `runSLAEscalations` | The trigger held the script lock through the `MailApp` loop. User writes (`waitLock` 30 s) could time out every 15 minutes | Lock released after the rows are written; mail is sent outside it (`sendSLAEmails`); the status update takes the lock briefly | v9.5 `CR2-05` |
| CR2-06 | 🟠 | `SLANotificationSystem.js` / `NotificationsAPI.markRead` | `markRead([])` became `all: true`, silently marking **every** notification read | `[]` marks nothing; only `null` / no argument means all; the button only shows when there are unread SLA notices | `build:ci` |
| CR2-07 | 🟡 | v9.5 `markNotificationsRead` | One `setValues` per notification under the lock (200 rows ≈ 10–20 s) | `writeRecordsById`: one write per run of contiguous rows | v9.5 notifications test |
| CR2-08 | 🟡 | v9.5 `visitStartedAt` | The fallback for pre-v9.5 tickets was `updated_at`, which moves with unrelated edits. That changed the visit key, re-fired rules and dropped escalation grants | Fallback is `created_at` (stable) after the history arrival row | v9.5 `CR2-08` |
| CR2-09 | 🟡 | `scripts/measure-api-latency.js` | `--token <ID token>` put a bearer token on the command line (compliance S2) | `ID_TOKEN` from the environment only; `--token` is refused | - |
| CR2-10 | 🟡 | `api/_lib/proxyCore.js` | GET reads carried `_proxy_secret` in the Apps Script URL query (URL logs, `e.queryString`) | The proxy always POSTs; GET reads are marked `_via_get` and `doPost` hands them to `doGet` (v9.4 + v9.5); clients can't send `_via_get` | proxy test (20), v9.4 + v9.5 `CR2-10` |

## Lessons → rules

- CR2-01: an actor rule needs an explicit **internal-caller** exception wherever a handler is reused by the engine. Added as a note to A15 (internal calls pass the target explicitly).
- CR2-03 / CR2-05: A19 now says "record first, side effects after, outside the lock".
- CR2-02: F5 now says "a write invalidates reads already in flight too".
