<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: REVIEW_AppScriptReco_20261030.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 30 October 2026 UTC+8 (Philippine Standard Time) | Modified: 30 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Check the "TicketFlow: Apps Script Recommendations & Migration Plan" (19 Oct 2026) against the code (AppScript v9.3 + frontend), record what is confirmed, corrected or new, and what was done about it | Status: Active
REVISION HISTORY:
- v1.0.0 | 30 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Initial review (session 7e008704)
===============================================================================
-->

# REVIEW — Apps Script Recommendations (19 Oct 2026)

> **Checked against:** `appscript_files/APPSCRIPT_v9.3_20261019_2015.txt` (API 9.3.0) and `src/` at `f211c5a`.
> **Acted on in:** AppScript v9.4 (quick wins, S1–S5), v9.5 (SLA escalation), `docs/guides/GUIDE_CodeReview_Compliance.md` v2.0.0 (rules A14–A20, F1–F6, P7–P10), `docs/planning/PLAN_Migration_NeonVercel_20261030.md` (migration).
> **The reco text** is kept in Appendix A.

---

## §1 Verdict per finding

| # | Reco finding | Verdict | Evidence (v9.3 line) | Done in |
|---|---|---|---|---|
| P1 | Whole-tab read per lookup, no per-request cache | ✅ Confirmed | `readTable` :11499, `getSheetDataAsJSON` :2825; `SpreadsheetApp.openById(SPREADSHEET_ID)` appears 80 times | v9.4 table cache (A14) |
| P2 | One approval reads ~20–25 tabs | ✅ Confirmed. The 19 Oct review found it as **R-08** and v9.1 only partly fixed it | `progressTicketWorkflow` :6681 | v9.4 cache + read-count test (A16) |
| P3 | `getDropdownLists` reads options once per list | ✅ Confirmed, **plus a bug** (see N1) | :1933 calls `getDropdownOptions(list.id)` per list | v9.4 one read, grouped by list |
| P4 | `getSystemHealth` on dashboard load | ⚠️ **Not happening.** `useSystemHealth` (`src/hooks/useAPI.js:484`) is mounted by no screen; only the admin API test panel calls the health check | `src/hooks/useAPI.js` | Kept admin-only; no change |
| P5 | Every write holds the single script lock | ✅ Confirmed, by design (CR-03) | `withScriptLock` :2799 | Stays until migration (Postgres transactions) |
| P6 | `createTicket` computes `max(id)+1` over all tickets | ✅ Confirmed | `createTicket` :1336 | v9.4 ticket id from `sequence_counters` (A18) |
| P7 | `getTickets` filters links per ticket | ✅ Confirmed | `getTickets` :1424 | v9.4 links indexed once |
| P8 | One HTTP call per widget | ✅ Confirmed, **partly offset**: `makeRequest` already caches GET results in memory | `src/api/googleSheet.js` `cache.get` | v9.4 `getDashboard` (F5) |
| S1 | No server-side authentication | ✅ Confirmed: `getCurrentUserId()` returns `'system_user'` | :138 | v9.4 + proxy (A15, F2, F6) — see N2 |
| S2 | Timestamps +8h but labeled `Z` | ✅ Confirmed: `getCurrentTimestamp()` adds 8h then `toISOString()`; 24 call sites (audit fields, dropdown access logs). The frontend does it too (`toPhilippineTime` in `src/utils/slaEscalation.js`) | :148 | v9.4 real UTC + `TS_UTC_SINCE` (A17, F3) |
| S3 | `getSheetByName` in try/catch never initializes | ✅ Confirmed (rule A10 already existed; old code predates it) | `getUserPreferences` :2426, `updateUserPreferences` :2492 | v9.4 |
| S4 | `getTicketActionLogs` defined twice | ✅ Confirmed | :7174 and :13745 | v9.4 (A20) |
| S5 | Positional log writers, `getLastRow()` as id | ✅ Confirmed | `logLogin` :2674, `logTicketHistory` :2696, `logTicketAction` :2716 | v9.4 (A1, A18) |
| S6 | Unused helpers with wrong signatures | ✅ Plausible, not re-checked line by line | — | Not ported in the migration |

### New findings (not in the reco)

| # | Finding | Evidence | Done in |
|---|---|---|---|
| N1 | `getDropdownOptions` compares `opt.dropdown_list_id === listId`. A numeric cell never equals a string id, so lists with numeric ids show no options. Breaks A8 | :1958 | v9.4 `sameId` |
| N2 | **S1 can be fixed before migrating.** The Vercel proxy `api/appscript-proxy.js` is already the production base URL (`src/config/apiConfig.js`) and can read the `Authorization` header, which Apps Script cannot. The proxy verifies the Firebase ID token and forwards the uid with a shared secret; Apps Script refuses calls without the secret | `api/appscript-proxy.js` (also hard-codes the exec URL) | v9.4 + proxy |
| N3 | The reco's `/api/rpc` is the existing proxy, extended — not a new route | `src/config/apiConfig.js:10,21` | Migration plan §2 |
| N4 | Pointing `getSheetDataAsJSON` at `readTable().records` (reco §3.1) changes its output: `readTable` drops blank rows, trims headers and skips empty headers. Its 24 callers would change behaviour | :2825 vs :11499 | v9.4 caches the raw values instead |
| N5 | The file has **108** sheet mutation calls. Hand-placed invalidations will miss some unless a test catches stale reads | grep `appendRow\|setValue\|deleteRow\|clear` | v9.4 stale-cache detector in the test runtime (A14) |
| N6 | SLA escalation is a browser-only mock: hard-coded rules, `setTimeout` saves, nothing persisted, every open dashboard fires its own alerts, +8h applied again, percent trigger assumes a 24h SLA, `AdminSLAEscalationManager` unmounted | `src/utils/slaEscalation.js`, `src/hooks/useAPI.js:807-1001` | v9.5 (F1, F4) |
| N7 | `calculateSLADueDate` skips weekends with `getDay()`, which uses the script time zone, not Manila | :7736 | v9.5 (A17) |
| N8 | Company SLA rules (incl. `escalation_*`, business hours) are stored but never used | :13923-14060 | v9.5 (company rule wins, decision D4 of session a38297ac) |
| N9 | **The client made P8 worse:** `makeRequest` looked up its cache only for reads **without** a payload, but `getAll(filters = {})` always sends `{}` - so the dashboard and each SLA widget fetched `getTickets` separately (~8 calls per dashboard), and `RequestQueue(2)` let only two run at a time | `src/api/googleSheet.js` `makeRequest`, `RequestQueue(2)` | v9.4 frontend: identical reads in flight are shared, payload reads cached 10 s (Refresh stays fresh), any write clears the cache; `getDashboard` → dashboard = 2 calls |
| N10 | `src/utils/slaCalculator.js` `toPhilippineTime` adds 8 h too (SLA widgets, date formatting) - in a Manila browser `format()` then shows times 8 h late | `slaCalculator.js:413` | **Open** - known gap F3 in `scripts/code-rules-known-gaps.txt` |
| N11 | The rule's own field named `action` (first v9.5 draft) replaced the route name in the flat POST body | v9.5 tests | Renamed `escalation_action` before commit (A13 worked as designed) |

---

## §2 Why the code reviews didn't catch these

1. **The reviews only saw changed code; these problems are older.** `getCurrentUserId` / the +8h `getCurrentTimestamp` are in the frozen v8.0 `APPSCRIPT.txt` (Nov 2025). The per-list dropdown read came from commits before the reviews started. The 17 Oct review covered v8.0→v8.2, the 19 Oct review v9.0 only.
2. **Each version is a new 13k-line file**, so `git diff` shows it all as added and a reviewer can't see what changed. → **P7**: review `git diff --no-index <prev> <new>`.
3. **No rule covered reads per request, caller identity or time zones** (A1–A13 are about headers, locks, routes). → **A14–A20, F1–F6**, enforced by `npm run check:code-rules`.
4. **No review log for v9.1–v9.3.** → **P9**.
5. **R-08 found the approval re-reads** and was marked "revisit when data grows". → reopened, closed in v9.4 with read-count tests (**P10**).
6. **The R-05 fix made `user_id` required in the request**, which made the request decide who the caller is (S1). → **A15**.

---

## §3 Auth: both providers

The user asked whether both Firebase and Auth.js / Better Auth can be used. Yes:
- **v9.4 (Sheets):** the proxy verifies the **Firebase ID token** (`jose`, Google securetoken JWKS). Adapters sit in an `identityAdapters` list.
- **Migration (Neon):** add an **Auth.js / Better Auth** adapter. `users.id` stays the Firebase uid (no re-keying); `auth_identities(provider, external_id, user_id)` maps any provider to it.

---

## §4 Actor vs target keys (S1 inventory, v9.4)

`actorId(claimed)` (compliance A15): in `AUTH_MODE` **enforce** it returns the uid the proxy verified (the claimed id is ignored); in **warn** / **off** it returns the claimed id (warn logs a mismatch with the token).

| Action | Key | Meaning | v9.4 |
|---|---|---|---|
| `submitStepApproval` (approve / return / reject / complete) | `user_id` | actor | `actorId` (`progressTicketWorkflow`) — also the `ticket_history.user_id` written |
| `canUserApprove` | `user_id` | actor | `actorId` |
| `updateTicketStatus` (cancel / reopen / resubmit) | `user_id` | actor | `actorId` (requester-or-admin, admin rules) |
| `createTicket` | `requester_id` | actor | `actorId` — requester, `created_by`, history, workflow start |
| `shareTicket`, `revokeTicketShare` | `user_id` | actor | `actorId` |
| `getReportData` | `user_id` | viewer (scope) | `actorId` — admin sees all, others their own |
| `getAdminActionLogs`, `getTicketActionLogs` | `user_id` | viewer (admin check) | `actorId` |
| `exportConfiguration`, `importConfiguration` | `user_id` | actor (admin check) | `actorId` |
| `getTicketsForApproval`, `getSharedTickets`, `getDashboard` | `user_id` | viewer (own data) | `actorId` |
| `recordLogin` (`logLogin`) | `userId` | actor | `actorId` |
| `assignUserRole` / `createUserRoleAssignment` | `user_id` | **target** (assignee) | kept |
| `getUserProfile`, `getUserRoles`, `getUserGeneralRole` | `user_id` / `userId` | **target** (whose profile) | kept |
| `getUserPreferences`, `updateUserPreferences` | `user_id` | own preferences | kept — **follow-up**: should be `actorId` (anyone can read / change anyone's preferences) |

### Open: S1 part 3 — admin-only routes have no server-side admin check

Most admin write routes (companies, roles, ticket types, workflow steps, custom fields, dropdowns, role assignments, SLA rules, ticket links) **don't check that the caller is an admin** - they trust the admin UI. With `AUTH_MODE=enforce` only signed-in users get through, but Firebase's Google sign-in accepts **any Google account**, so a signed-in non-admin can still call them directly. Not fixed in v9.4 (outside the reco's quick wins; needs a bootstrap rule for the first admin). Recommended next:
- An `ADMIN_ONLY_ACTIONS` list in `doPost` checked with `isAdminUser(actorId(data.user_id))` (enforce mode refuses, warn mode logs), with a bootstrap exception while no active admin assignment exists.
- Restrict sign-in to known users: refuse tokens whose uid has no `user_profiles` row (or an allow-listed email domain) at the proxy.
- `getUserPreferences` / `updateUserPreferences` on `actorId`.

---

## §4b Measured offline (fake runtime, tab reads per request)

| Action | v9.3 | v9.4 | v9.5 |
|---|---|---|---|
| createTicket | 10 | 7 | - |
| submitStepApproval (completes a step) | 18 | 9 | 11 (escalation grants + company SLA rule lookups) |
| getDropdownLists (options tab) | 1 per list | 1 | 1 |
| SLA escalation run | - | - | each tab once |

## §5 Measurements

Baseline (v9.3) vs v9.4, median / worst of 5 runs from Manila via the proxy — filled in after deploy with `node scripts/measure-api-latency.js`.

| Action | v9.3 median | v9.3 worst | v9.4 median | v9.4 worst |
|---|---|---|---|---|
| getTickets | | | | |
| getDropdownLists | | | | |
| getTicketsForApproval | | | | |
| getReportData | | | | |
| createTicket (seed) | | | | |
| approve (seed) | | | | |

---

## Appendix A — The reco (19 Oct 2026), summary of its sections

1. Summary — slowness from whole-tab reads; quick wins; S1 + S2 must be fixed; targets; migrate behind `/api/rpc`, port by table group.
2. Findings P1–P8, S1–S6 (verdicts in §1 above).
3. Apps Script quick wins: per-request table cache, one dropdown read, health check off the dashboard, `getDashboard`, CacheService for reference data, ticket id from `sequence_counters`, links indexed, SWR on the client; S2–S5 fixes.
4. Why migrate anyway — latency floor, one lock, 6-min limit, no constraints, no auth boundary.
5. Migration approach — keep `{ action, ...payload }`; Option A mirror-then-flip (recommended), B parallel build, C per-group; `/api/rpc` skeleton; Auth.js / Better Auth.
6. Postgres data model — DDL from `TABLE_SCHEMAS`, text ids, constraints replacing v9.3 code, day-one indexes, data load with the S2 shift, R2 attachments.
7. Port order (Option A) Phases 0–3.
8. Risks and open decisions.
9. Non-functional targets — latency, query budgets, correctness / security / data rules, test volumes, how to measure, a `CLAUDE.md` block (added to `Claude.md` v4.0).

The decisions taken from it (session 7e008704): Option A, designed for heavy use; both auth providers; v9.4 quick wins + S1–S5 now; SLA escalation rewritten server-side (v9.5).
