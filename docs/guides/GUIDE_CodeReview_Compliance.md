<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_CodeReview_Compliance.md | Author: Kenneth R. Advento | Version: 2.4.0
Created: 18 October 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Coding rules for AppScript, its counterpart frontend / proxy code and scripts, derived from the code reviews (17 + 19 Oct 2026) and the Apps Script reco review (30 Oct 2026), so new changes don't reintroduce them | Status: Active — MANDATORY for AppScript, counterpart (src/, api/) and scripts/ changes

REVISION HISTORY:
- v1.0.0 | 18 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Initial rules A1–A11, S1–S9, P1–P4 from docs/planning/TODO_CodeReview_20261017.md
- v1.1.0 | 19 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | A11 step 2: header carries a `Deploy description:` line to paste at redeploy
- v1.2.0 | 19 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | A12 contract check (49 frontend actions had no route; 3 routes called functions that never existed), A13 no payload key `action`, A11 ping reports API_VERSION; P1 amended (diff-scoped review + contract check), P5 done = reachable
- v1.3.0 | 19 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | P6 build like Vercel (`npm run build:ci`): Vercel's CI=true turned 13 ESLint warnings into errors and every deploy from 24934fd failed; frontend checklist added
- v1.4.0 | 19 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | A12 also checks missing client methods, unmounted components and missing icons (the ticket UI was reachable from no screen); P5 "reachable" includes a screen
- v2.0.0 | 30 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §0 change recipe (AppScript + counterparts in order); A14–A20 (cache invalidation, actor identity, read budget, real UTC, ids, time-driven jobs, one definition); §1b counterpart rules F1–F6 (frontend + proxy); P7–P10 (version-diff review, whole-file review, one review log per version, performance gate); `npm run check:code-rules` + `scripts/code-rules-known-gaps.txt` (baseline 91 on v9.3, may only shrink). Source: `docs/planning/REVIEW_AppScriptReco_20261030.md`
- v2.1.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | From the v9.6 review (docs/planning/TODO_CodeReview_20261031.md): A1 logAdminAction is header-driven (off the legacy list); A14 re-read inside the lock what a locked decision depends on; A15 admin routes are gated in doPost (ADMIN_ONLY_ACTIONS); F6 only an expired token may end a session, verify outages get their own code, `_auth_email` only when verified
- v2.2.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | A21 (v10.0 M1, session ff4c803f): every ticket read goes through canViewTicket, a hidden ticket answers like a missing one; `check:code-rules A21`
- v2.3.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | A17 v3 / F3 v3 (v10.1, session ff4c803f): local days and clocks come from the COMPANY's calendar (companyClock / dateTime.js effective zone), the default zone is named once (DEFAULT_TZ / DEFAULT_ZONE); `check:code-rules` flags the literal elsewhere, and `toLocale*String(` / an Intl `timeZone:` outside dateTime.js. Review log docs/planning/TODO_CodeReview_20261101_v10.1.md
- v2.4.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | A22 (v10.2, session 41700a8e, review `docs/planning/TODO_CodeReview_20261101_v10.2.md` CR6-01..18): the plan gate resolves the company from the record and fails closed; platform admins only from `PLATFORM_ADMIN_UIDS`; `check:code-rules A22` + the extended `plan-copy` contract check
===============================================================================
-->

# GUIDE — Code Review Compliance

> **Source:** `docs/planning/TODO_CodeReview_20261017.md`, `docs/planning/TODO_CodeReview_20261019.md` and `docs/planning/REVIEW_AppScriptReco_20261030.md` (findings and fixes). **Reference implementation:** `appscript_files/APPSCRIPT_v8.3_20261017_1510.txt` (A1–A10), v9.4 (A14–A18, A20), v9.5 (A19), `scripts/` v1.1.
> **Use it:** follow the §0 recipe, read the rules for the area you're changing, then tick the §4 checklist before committing.
> Each rule names the finding that motivated it. If a rule blocks something legitimate, change the rule here (new version) instead of ignoring it.

### How a rule is written

Every rule has the same parts, so a reviewer (or `/code-review`) can check it:

```
### A14 — <the rule in one imperative line> *(<finding ids that caused it>)*
<1–3 sentences: what broke, with the concrete case from this repo>
// ✅ Do      <short snippet using the repo's helpers>
// ❌ Don't   <the snippet that caused the finding>
**Checked by:** <offline test | check:code-rules <RULE> | check:api-contract | review only>
```

It also gets a §4 checklist line, a §5 finding → rule row and a check in `docs/reference/RESOLUTION_CHECKLIST.md` (P4). A rule nothing can check automatically says **review only**, so the review knows to look for it. A deliberate exception to a static check carries `code-rules-allow <RULE> <reason>` on the line (or the line above).

---

## §0 Change Recipe — one AppScript change and its counterparts, in order

| # | Step | Rules |
|---|---|---|
| 1 | `TABLE_SCHEMAS` (+ `COLUMN_DEFAULTS` for columns filters depend on) | A2, A3 |
| 2 | The handler: header-driven rows, lock, errors, ids, actor, reads, time | A1, A5–A10, A14–A20 |
| 3 | The route: `doGet` (reads) or `routePostAction` (writes); a read-only POST goes into `POST_READ_ONLY_ACTIONS` | A5, A12 |
| 4 | Offline test in `appscript_files/tools/ROUTES_TEST_v<ver>.js` (+ run every older suite on the new file) | A11, P10 |
| 5 | `src/api/googleSheet.js`: the client method with the exact keys; a GET action also goes into `readActions` | A7, A12, A13 |
| 6 | The hook in `src/hooks/useAPI.js` (real call, cache invalidation after writes) | F4, F5 |
| 7 | A **mounted** component on a screen | A12, P5 |
| 8 | `api/appscript-proxy.js` when auth, headers or env change | F2, F6 |
| 9 | `npm run check:api-contract`, `npm run check:code-rules`, `npm run build:ci` | A12, P6 |
| 10 | `/code-review` on the version diff, findings logged | P1, P7, P9 |

---

## §1 AppScript Rules (A1–A20)

### A1 — Write rows by header name, never by position *(CR-01, X-3)*

Positional arrays break as soon as `TABLE_SCHEMAS` adds or moves a column. The value shifts into the neighbouring column without any error.

```javascript
// ✅ Do
const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
sheet.appendRow(rowFromRecord(headers, { id, ticket_id, entity_category: 'ticket', custom_field_id, text_value }));

// ✅ Update = read the record, change fields, write the whole row back by header
const record = { ...currentValue, text_value: 'new', updated_at: ts };
sheet.getRange(rowNumber, 1, 1, headers.length).setValues([rowFromRecord(headers, record)]);

// ❌ Don't
sheet.appendRow([valueId, ticketId, fieldId, value, null, null, null]);
```

**Legacy exception.** These positional writers still exist. Their column order is pinned as the first columns of `TABLE_SCHEMAS`, so **never reorder or insert columns in front of these prefixes**:

| Writer | Table | Pinned prefix |
|---|---|---|
| `createTicket()` | `tickets` | first 11 columns |
| `logTicketHistory()` | `ticket_history` | first 6 |
| `logTicketAction()` | `ticket_action_logs` | all 6 |
| ~~`logLogin()`, `logAdminAction()`~~ | `admin_action_logs` | header-driven since v9.4 / v9.6 - off the list |
| `generateTicketNumber()` | `sequence_counters` | both columns |

New code must not add to this list.

### A2 — `TABLE_SCHEMAS` is the only header list *(CR-04)*

- New table or column → edit `TABLE_SCHEMAS`, adding new columns **at the end**.
- Create or initialize a tab only through `ensureTableSheet(SHEETS.X)`. An `initialize*Sheet()` function is a one-line wrapper around it.
- ❌ No `const headers = [...]` in init, reset or migration functions.
- Check: after `cleanResetAllTables()` or any init, `rebuildAllTables()` (dry run) reports **0 repaired**.

### A3 — New columns that existing rows need get a `COLUMN_DEFAULTS` entry *(CR-02)*

When a filter depends on a new column (e.g. `row.entity_category === 'ticket'`), existing rows must get a value when the rebuild adds that column. Otherwise they silently disappear from results.

```javascript
const COLUMN_DEFAULTS = {
  custom_fields: { entity_category: 'ticket' },
  custom_field_values: { entity_category: 'ticket' }
  // your_table: { your_new_column: 'value' }
};
```

The dry run shows them as `defaulted: [...]`. Review that line before applying.

### A4 — Never clear data outside an explicit, editor-only reset *(CR-05, X-4)*

- Init functions are **idempotent**: a tab that already has rows is left unchanged (`ensureTableSheet` does this).
- ❌ No `sheet.clear()` / `clearContents()` / `deleteSheet()` in anything `doPost` or `doGet` can reach.
- Seeding functions check first and skip when data exists (see `createUserManagementTestData`).
- Destructive tools (`cleanResetAllTables`, `completeSystemReset`, migrations) are run **from the editor only**, never routed.

### A5 — Every write runs under `withScriptLock` *(CR-03)*

- `doPost` already locks every action except `POST_READ_ONLY_ACTIONS`. Add a new **read-only** POST action to that list. Never add an action that writes.
- Code outside `doPost` that writes and must not interleave with the rebuild (triggers, editor jobs) wraps its work in `withScriptLock(() => …)`.
- ❌ Don't call `LockService.getScriptLock()` directly. A second `waitLock` inside a locked call can deadlock or release the outer lock early. `withScriptLock` is re-entrant.

### A6 — Report failures as failures *(CR-07)*

Many handlers return `{ status: 'error', message }` instead of throwing. Route them through `createHandlerResponse(result)`:

```javascript
// ✅ Do
case 'deleteRoleType':
  return createHandlerResponse(deactivateRecord(SHEETS.ROLE_TYPES, id, reason));

// ❌ Don't — reports success even when result.status === 'error'
return createJsonResponse({ success: true, data: deactivateRecord(...) });
```

New handlers should **throw** on failure (`doPost` turns that into `success: false`), or return `{ status: 'error' }` and use `createHandlerResponse`. The frontend only throws on a top-level `status: 'error'` (`src/api/googleSheet.js` `makeRequest`).

### A7 — Match the request keys the frontend actually sends *(X-2)*

Before writing or changing a `doPost` case, open the matching method in `src/api/googleSheet.js` and use its exact keys. Example: the frontend sends `user_profile_type_id` / `role_type_id`, not `id`. When names differ, accept both (`data.id || data.role_type_id`).

### A8 — Compare ids as strings *(CR-07)*

Sheets returns numbers for numeric cells, and requests may send strings. Use `String(row[idIndex]) === String(id)`, never a bare `===` between a cell and a request value.

### A9 — `logAdminAction`: use the 5-argument form *(CR-06, X-1)*

```javascript
logAdminAction(getCurrentUserId(), 'CREATE_ROLE_TYPE', 'role_type', roleTypeId, { name, code });
//             admin_user_id       action_type         target_entity target_id   details
```

The 3-argument form `(actionType, targetId, details)` is still accepted for old callers, but it logs `target_entity = 'ENTITY'`.

### A10 — `getSheetByName` returns `null`; it doesn't throw *(X-4)*

```javascript
// ✅ Do
const sheet = ss.getSheetByName(name) || ensureTableSheet(name);

// ❌ Don't — the catch never runs, so sheet stays null
try { sheet = ss.getSheetByName(name); } catch (e) { sheet = ss.insertSheet(name); }
```

### A11 — Every change is a new timestamped file, tested offline *(process)*

1. Copy the latest file to `APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt` (UTC+8). Never edit an older version.
2. Update the header block: `Version:`, a `Phase` line listing the changes, `Last Updated`, and a `Deploy description:` line to paste into **Deploy → Manage deployments → ✏️ Edit → Version: New version → Description** when redeploying. Format: `v<ver> <YYYYMMDD_HHMM> - <short summary>`, with the same timestamp as the file name, kept under about 100 characters:
   ```
    * Deploy description: v8.4 20261019_0500 - is_active writable for user profile / role types
    *   (paste at redeploy: Deploy > Manage deployments > Edit > New version > Description)
   ```
   The description is how a deployment is traced back to its file. From v9.0, `ping` reports the `API_VERSION` constant at the top of the file too (it was stuck at `8.0.0` through v8.3): bump it with the header `Version:` line; the v9.0 offline test fails when they differ.
3. Run the offline test (no Google access needed). Add a test for any new behaviour:
   ```bash
   node appscript_files/tools/CODE_REVIEW_FIXES_TEST_v8.3.js appscript_files/APPSCRIPT_v<new>.txt
   ```
   It runs the file against an in-memory fake of `SpreadsheetApp` / `LockService`. The fake lock throws if it's taken twice in one execution, which proves the locking is re-entrant.
4. Keep the CRLF line endings and the file's trailing-newline state the same as the previous version, so `git diff` shows only real changes.

### A12 — Every action the frontend sends has a route *(19 Oct 2026 contract diff)*

Until v9.0, 49 of the 84 actions `src/api/googleSheet.js` sends had no `case` in `doGet` / `routePostAction`. Three routes (`deleteRole`, `deleteDropdownList`, `deleteTicketType`) called functions that never existed. Nobody noticed: unknown actions answered `success: false` without `status: 'error'`, `makeRequest` only threw on `status: 'error'`, and development fell back to mock data.

```bash
npm run check:api-contract        # newest APPSCRIPT_v*.txt; or: node scripts/check-api-contract.js <file>
```

- It checks: no route; sent by GET but only in doPost (and the reverse); a router case calling an undefined function; a payload with an `action` key (A13).
- From v1.4.0 it also checks the frontend's own wiring:
  - `missing-method`: an `API.Group.method()` / `xxxAPI.method()` call the class doesn't define. `AdminWorkflowBuilder` called `updateStepApprovers` and `AdminTicketTypeCreatePage` called `saveCommentRequirements`; neither existed.
  - `unmounted-component`: a `src/components` / `src/pages` file that `src/index.js` can't reach through imports. Until v9.1 the whole ticket UI (`TicketDashboard`, `TicketForm`, `TicketDetail` → `WorkflowStep`) and `AdminWorkflowBuilder` were reachable from no screen.
  - `missing-icon`: `Icons.X` with no `X` in `Icons.js`. It renders `undefined`, which is React error #130. The mounted profile / role type lists used `Icons.Trash`.
- A new component is mounted (imported from a page or a mounted component) in the batch that adds it.
- `scripts/api-contract-known-gaps.txt` lists the gaps that are known and not fixed yet. It **may only shrink**: fix a gap, then `node scripts/check-api-contract.js --update`. Never add a line to silence a new gap. `--update` refuses to add.
- A new frontend action ships with its backend route **in the same batch**. A new GET action goes into both `readActions` and `doGet`.
- Unknown actions and handler failures return `success: false` **and** `status: 'error'` (doGet too, via `createHandlerResponse` / `createDataResponse`), and `makeRequest` throws on either. Never answer a failure with `success: true`.

### A13 — No payload key named `action` *(19 Oct 2026, approve button)*

`makeRequest` posts `{ action, ...payload }`. A payload key `action` replaces the route name: `submitApproval` sent `action: 'approve'`, so the backend saw the action `approve` and every approval failed. Use a domain name (`decision`, `operation`). `makeRequest` throws on an `action` key, and the contract check flags it.

### A14 — Read through the cache; every write invalidates it *(reco P1/P2, R-08)*

From v9.4, `readTable` / `sheetValues` / `getSheetDataAsJSON` serve each tab from a per-request cache (`TABLE_CACHE`, reset at the top of `doGet` / `doPost`). A write that doesn't drop the cache entry makes a later read in the same request return the old rows - an approval would read its own ticket back unchanged.

```javascript
// ✅ Do - the shared writers already invalidate; a direct write invalidates its tab
appendRecord(SHEETS.TICKET_HISTORY, record);                 // invalidates inside
sheet.getRange(row, 1, 1, headers.length).setValues([rowFromRecord(headers, record)]);
invalidateTable(sheet.getName());                            // same function as the write
for (const row of rowsToDelete.reverse()) sheet.deleteRow(row);
invalidateTable(SHEETS.STEP_APPROVERS);                      // once, after a delete loop (row numbers shift)

// ❌ Don't
sheet.appendRow(rowFromRecord(headers, record));             // no invalidation: the next readTable is stale
SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(x)    // use ss().getSheetByName(x)
```

- `invalidateTable()` with no name drops the whole cache; use it when the tab isn't known.
- Callers must not mutate `readTable(...).records` (copy first: `{ ...record }`). `sheetValues()` returns a copy, so `data.shift()` is safe.
- `CACHE_ENABLED` (Script Property, default on) turns the cache off without a redeploy.
- **Reads taken before `withScriptLock` are stale inside it** *(v9.6 review CR3-01)*: another execution may have written meanwhile. A decision made inside the lock (accept an invite, take a number) first calls `invalidateTable(...)` for the tabs it depends on and reads them again.

**Checked by:** `check:code-rules A14` (a function that mutates must call `invalidateTable`); the stale-cache detector in `appscript_files/tools/lib/fakeSheetsRuntime.js` (`{ detectStaleCache: true }`) fails any offline test that reads a cached tab after a write.

### A15 — The acting user comes from `actorId()`, never from the payload *(reco S1, R-05)*

Until v9.4 every permission check trusted the `user_id` the request sent; anyone with the URL could act as an admin. The proxy now verifies the Firebase ID token and forwards `_auth_uid`; `actorId(claimed)` returns it (in `AUTH_MODE` `enforce` the claimed id is ignored; in `warn` / `off` it falls back to the claimed id and logs a mismatch).

```javascript
// ✅ Do
const userId = actorId(payload.user_id);                     // who is acting
if (!isAdminUser(actorId(params.user_id))) return { status: 'error', message: 'Only admins can …' };
createUserRoleAssignment({ user_id: payload.user_id, assigned_by_user_id: actorId(payload.assigned_by_user_id) });
//                         ^ target user (kept)      ^ actor

// ❌ Don't
if (!isAdminUser(params.user_id)) …                          // the request decides who the caller is
```

- A payload key that names the **target** of the action (the assignee, the profile being read) stays as sent. `docs/planning/REVIEW_AppScriptReco_20261030.md` §4 lists actor vs target keys per action.
- Pass-through helpers (`requireAdmin(userId, what)`) take the id as a parameter; their callers are checked.
- From v9.6 every admin write is listed in `ADMIN_ONLY_ACTIONS` and gated in `doPost` on the **verified** uid (`actorId(null)`: on admin routes a body `user_id` often names the target). A new admin route goes on the list in the same batch; the v9.6 test checks every listed action is routed.
- When the engine reuses a handler internally (a chained ticket created by `processStepCompletion`), pass the target explicitly (`createTicket(payload, { requesterIsTarget: true })`): there the verified user is the approver, not the requester *(review CR2-01)*.

**Checked by:** `check:code-rules A15` (a permission check whose argument is not `actorId(...)`, a variable assigned from it, or a parameter); v9.4 auth tests (`AUTH_MODE` off / warn / enforce).

### A16 — Read each tab at most once per request; never inside a loop *(reco P3, P7, R-08)*

`getDropdownLists` read the whole options tab once per list; one approval read ~20–25 tabs. Read once, then build a lookup map.

```javascript
// ✅ Do
const optionsByList = groupBy(readTable(SHEETS.DROPDOWN_OPTIONS).records, o => String(o.dropdown_list_id));
lists.map(list => ({ ...list, options: optionsByList[String(list.id)] || [] }));

// ❌ Don't
lists.map(list => ({ ...list, options: getDropdownOptions(list.id) }));   // one tab read per list
ids.forEach(id => findRecord(SHEETS.TICKETS, id));                       // one scan per id
```

**Checked by:** `check:code-rules A16` (a direct read or `readTable` / `findRecord` / `getSheetDataAsJSON` inside a loop or array callback); read-count assertions in `ROUTES_TEST_v9.4.js` (one approval reads each tab once) (P10).

### A17 — Store real UTC; local days only through the company's clock *(reco S2, `calculateSLADueDate`; v3 = v10.1 country calendars)*

`getCurrentTimestamp()` added 8 hours and then called `toISOString()`, so 21:35 PHT was stored as `21:35Z` (= 05:35 PHT the next day). `calculateSLADueDate` skipped weekends with `getDay()`, which uses the script's time zone.

```javascript
// ✅ Do
const now = new Date();                                       // stored as is (UTC)
const day = Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd');   // Manila calendar day
const weekday = Number(Utilities.formatDate(d, 'Asia/Manila', 'u'));  // 1 = Monday … 7 = Sunday
addSlaTime(start, 8, 'business_hours', calendar);             // business time through the shared helper

// ❌ Don't
new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();   // shifted value labeled Z
dueDate.getDay(); dueDate.setHours(dueDate.getHours() + 8);    // script time zone
```

Rows written before v9.4 are 8 h ahead in the audit columns; Script Property `TS_UTC_SINCE` records the switch, and the migration transform corrects older rows.

**v3 (v10.1, `PLAN_CountryCalendars_TimeZones_20261031.md`):** a company's days are its own, not Manila's.

- The ticket number YEAR is the **country calendar's** year: `calendarYear(companyId)` (the country's reference zone, not the company zone).
- SLA time, "due today", report / list date filters, notice and email dates use `companyClock(companyId)` (`tz`, `weekendDays`, `businessHours`) with `dayIn` / `clockIn` / `zoneAt` / `dayStartIn` / `dayEndIn`, and holidays from `companyHolidayDays` (country + company add − company remove).
- The default zone is named **once**: `const DEFAULT_TZ = 'Asia/Manila'` (with `DEFAULT_COUNTRY = 'PH'`); everything else uses the constant. Any IANA zone works (daylight saving included) - never a fixed offset such as `'+08:00'`.

```javascript
// ✅ Do (v3)
const clock = companyClock(ticket.company_id);
const today = dayIn(new Date(), clock.tz);                     // the company's today
const due = addSlaTime(start, 2, 'business_days', slaCalendar(rule, companyHolidayDays(ticket.company_id), clock));
const year = calendarYear(company.id);                         // the ticket number YEAR
// ❌ Don't (v3)
Utilities.formatDate(d, 'Asia/Manila', 'yyyy');                // a company outside the Philippines gets Manila's year
new Date(`${day}T08:00:00+08:00`);                             // fixed offset: wrong for every other zone
```

**Checked by:** `check:code-rules A17` (`8 * 60 * 60`, `getTime() + 8`, `getDay` / `getHours` / `setHours`; v3: a quoted `'Asia/Manila'` anywhere but the `DEFAULT_TZ` line). Test: `ROUTES_TEST_v10.1.js`, run under `TZ=UTC` **and** `TZ=Asia/Manila`.

### A18 — Ids come from `generateId()` or a locked sequence *(reco S5, P6)*

`logLogin` / `logTicketHistory` / `logTicketAction` used `getLastRow()` as the id (duplicates after a row is deleted); `createTicket` used `max(id) + 1` over the whole tickets tab.

```javascript
// ✅ Do
appendRecord(SHEETS.TICKET_HISTORY, { id: generateId('th'), ticket_id, user_id, action, comment, timestamp: new Date() });
const ticketId = nextSequenceValue('ticket_id');              // sequence_counters row, under the script lock

// ❌ Don't
sheet.appendRow([(sheet.getLastRow() > 0 ? sheet.getLastRow() : 1), ticketId, …]);
const newTicketId = (ids.length ? Math.max(...ids) : 0) + 1;
```

**Checked by:** `check:code-rules A18`.

### A19 — Time-driven jobs are idempotent, skip when busy, and dry-run first *(v9.5 SLA escalation)*

A trigger runs as the script owner with no request around it; two runs (or a run plus a retry) must not notify twice.

- Record each occurrence in an event table with a natural key (SLA: ticket + step + visit + rule); fire only when the key has no row.
- Take the lock with `LockService.getScriptLock().tryLock(5000)` and **skip** the run when busy - the next run catches up. Don't queue behind user writes.
- **Record first, side effects after:** write the event rows before sending mail, and send mail **outside** the lock (update the outcome in one batch afterwards) *(review CR2-03, CR2-05)*.
- Bound the work per run (e.g. 200 notifications) to stay under the 6-minute limit.
- `install…Trigger()` / `remove…Trigger()` are editor-only and idempotent (remove duplicates); the job takes `{ dryRun, now }` so tests and admins can preview it.

**Checked by:** `ROUTES_TEST_v9.5.js` (second run fires nothing, busy lock skips, dry run writes nothing).

### A20 — One definition per function name *(reco S4)*

Apps Script keeps the **last** `function getTicketActionLogs(...)`; the earlier one is dead code that reads as if it ran.

**Checked by:** `check:code-rules A20`.

### A21 — Every ticket read goes through `canViewTicket` *(v10.0; design `PLAN_FeatureGaps_Volume_20261031.md` ST-3)*

From v10.0, who may see a ticket depends on the caller (ticket type visibility, roles, shares, participants). One read path that forgets the check is a leak.

- Lists filter with `canViewTicket(scope, ticket) !== 'none'`, using one `buildActorScope` / `requestScope` per request (A16).
- One-ticket reads go through `ticketReadGuard(request, ticketId, action)` in the route. A hidden ticket answers **exactly like a missing one** (same message), so the answer doesn't tell that it exists.
- Writes on a ticket the caller can't see answer like a missing ticket too (e.g. `mayReadTicket` on the link routes).
- A per-actor list whose rows are visible by definition (own approval inbox, tickets shared with you) carries `// code-rules-allow A21 <reason>` above its `case`.

**Checked by:** `check:code-rules A21` (a `get*` / `search*` route naming tickets, plus `getReportData` / `getDashboard` / `getStepApprovals`, must reach one of `ticketReadGuard`, `canViewTicket`, `requestScope`, `buildActorScope`, `mayReadTicket` or an admin-only check, in its case or the handler it calls). Test: `ROUTES_TEST_v10.0.js` (visibility matrix; hidden = missing on every read path).

### A22 — The plan gate fails closed *(v10.2; design `PLAN_PlanTiers_Subscriptions_20261031.md` §5; review `TODO_CodeReview_20261101_v10.2.md`)*

From v10.2 what a company may do depends on its plan. The cloud review (CR6-01..08) bypassed the gate with an ordinary request, so these rules apply to every gated route and every new feature key:

- **The company comes from the record the request acts on** (ticket, step, the rule / tag being updated, a company-owned ticket type). A `company_id` the client sends counts only when the request creates something in that company (CR6-01). `planCompanyOf` and the `company:` resolvers in `PLAN_GATED_ACTIONS` follow this; an update resolver never falls back to `b.company_id`.
- **Fallbacks are never Enterprise by accident.** An id that is not a live company → Basic. A company whose rows all ended / were cancelled → its last plan, read-only. A company created after the migration (`PLAN_CUTOVER_AT`) with no row → `NEW_COMPANY_PLAN` (Basic). Only companies that existed before the migration get `NO_PLAN_DEFAULT` (CR6-08).
- **Platform admins are only the uids in `PLATFORM_ADMIN_UIDS`.** Empty = nobody; no admin role and no bootstrap makes a platform admin, and `AUTH_MODE=warn` refuses platform-only routes too (CR6-02, CR6-03).
- **Global configuration** (a global ticket type, profile / role types) needs the feature in every company it reaches: the actor's and every company running the type. A per-user preference (display zone) needs it in one of the user's companies (CR6-09).
- **Turning a feature off, deleting, or editing what exists without switching a gated feature on is never refused** (`when` predicates; §1 of the design).
- **Limits count what will have access:** users = role assignments in force now or starting later, plus pending invites in their company and every company their grants name. Every path that adds to a count checks it: create, update (reactivation, new dates, moving a type into a company), invites (CR6-04..07).
- **A refusal carries its fields at the top level** (`code`, `feature`, `required_plan`, `current_plan` / `limit`, `max`, `used`), returned or thrown (`planError`); thrown text has no `Error:` prefix (CR6-15).

**Checked by:** `check:code-rules A22` (every `PLAN_GATED_ACTIONS` action is routed; every feature key in it or in a `requireFeature(..., 'key')` call is in `PLAN_FEATURE_TIERS`; catalogue keys with no gate yet are printed as an information line). `check:api-contract` gap `plan-copy` (the public `/plans` copy in `src/config/plans.js` = the server's tiers, limits, plan order, limit keys and grace / trial days). Tests: `ROUTES_TEST_v10.2.js` (gate matrix, limits at the edge, CR6 regressions).

---

## §1b Counterpart Rules — frontend and proxy (F1–F6)

### F1 — The server owns business rules; the frontend shows the results *(SLA escalation engine)*

The SLA escalation "engine" ran in every open browser on hard-coded rules: each dashboard fired its own alerts, nothing was stored, and the server never knew. Escalation, SLA status, permissions and numbering are computed on the server; the frontend renders what it returns. A client-side copy of a rule is allowed only for form validation that mirrors the server (`validateEscalationRule`).

**Checked by:** review only.

### F2 — Identity is the ID token in the `Authorization` header *(reco S1)*

`makeRequest` sends `Authorization: Bearer <await auth.currentUser.getIdToken()>`. A `user_id` in a body names a target or a display value; the backend never treats it as proof of who is calling (A15).

**Checked by:** `scripts/test-proxy-auth.js`; review.

### F3 — Show times through `src/utils/dateTime.js` in the effective zone; no hour arithmetic *(`toPhilippineTime`; v3 = v10.1)*

Every date on screen goes through `dateTime.js` (`formatDateTime`, `formatDateOnly`, `formatTimeOnly`, `formatInZone`, `dayInZone`). The zone is `useUser().effectiveZone(companyId)`: the user's display zone when set, else the company's zone (from the profile; pass the zone from a company list the screen has as the fallback), else `DEFAULT_ZONE`. Calls without a zone use the current company's effective zone (UserContext keeps it set). A day the **server** filters or counts (date filters, "due today") uses `companyZone(companyId)` - the company's zone, not the display zone. Day math with date-fns uses `wallClockIn` / `fromWallClock`, never a shifted `Date`. A date-only value (`yyyy-MM-dd`) is a calendar day: `formatDateOnly` shows the same day in every zone.

```javascript
// ✅ Do
const { effectiveZone } = useUser();
formatDateTime(ticket.created_at, effectiveZone(ticket.company_id));
dayInZone(ticket.step_due_date, companyZone(ticket.company_id)) === dayInZone(new Date(), companyZone(ticket.company_id));
// ❌ Don't
new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));            // the old toPhilippineTime: 8 h ahead in a Manila browser
new Date(iso).toLocaleString();                                  // the browser's zone
new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila' });   // a fixed zone outside dateTime.js
```

**Checked by:** `check:code-rules F3` (hour shifts; v3: `.toLocaleString(` / `.toLocaleDateString(` / `.toLocaleTimeString(` and an Intl `timeZone:` option outside `src/utils/dateTime.js`, a quoted `'Asia/Manila'` anywhere but `DEFAULT_ZONE` in `src/config/timeZones.js`). Tests: `src/utils/dateTime.test.js`, `src/utils/slaCalculator.test.js` (run with TZ=UTC / America/New_York / Asia/Manila).

### F4 — No fake saves *(useAPI escalation mutations; P5 made checkable)*

`await new Promise(resolve => setTimeout(resolve, 500))` followed by `return { success: true }` looks like a save and stores nothing. A hook calls the real API or the feature isn't done (P5). A deliberate delay (a minimum spinner time) carries `code-rules-allow F4 <reason>`.

**Checked by:** `check:code-rules F4` (`setTimeout` promises and `TODO: Replace with actual API call` in `src/`).

### F5 — Call budget per screen; writes invalidate the entity cache *(reco P8, R-02)*

A screen makes at most 2–3 calls on load; combine with a dedicated read (`getDashboard`) instead of one call per widget. After a write, invalidate the cached entity (`cache.invalidate('tickets')`) so the next read is fresh - and reads already **in flight** too: `makeRequest` bumps a cache generation on every write, so an older read neither fills the cache nor is shared *(review CR2-02)*.

**Checked by:** review only (count the requests in DevTools → Network).

### F6 — The proxy verifies before forwarding and keeps its secrets in env *(reco S1)*

`api/appscript-proxy.js` reads `APPS_SCRIPT_URL`, `PROXY_SECRET`, `AUTH_MODE` and `FIREBASE_PROJECT_ID` from the environment (no hard-coded URL), verifies the token through an identity adapter (`firebase` now, `authjs` after the migration), **strips** any `_auth_uid` / `_auth_email` / `_proxy_secret` the client sent, then adds its own.

- v9.6: `_auth_email` is forwarded **only when the provider marks it verified** (invites trust it).
- Only a failure the user fixes by signing in may end a session: `SESSION_EXPIRED` (expired token), `SESSION_MAX_AGE` (`MAX_SESSION_HOURS`). A key-set outage or missing config answers `TOKEN_REJECTED`, which the app does not treat as a sign-out *(v9.6 review CR3-03)*.

**Checked by:** `scripts/test-proxy-auth.js` (valid / forged / expired / missing token × each `AUTH_MODE`; client-sent `_auth_uid` / `_auth_email` stripped; verified email; 12-hour cap; 401 codes).

---

## §2 Shell Script Rules (S1–S9)

### S1 — A failed pipeline must stop the script *(CR-09)*

```bash
set -o pipefail
if ! tar -czf - -C "$SRC" . | openssl enc ... -out "$OUT"; then
    rm -f "$OUT"; echo "ERROR: ..." >&2; exit 1      # remove partial output, change nothing else
fi
[ -s "$OUT" ] || { rm -f "$OUT"; exit 1; }            # empty output is a failure too
```

### S2 — Secrets never go on the command line *(CR-09, X-5)*

- ❌ `-pass "pass:$PASSWORD"`: any process listing can read it.
- ✅ `-pass "file:$PASSWORD_PATH"` (or `env:`, or stdin).
- Git Bash only converts arguments that **start** with `/`. Convert a path that comes after a prefix like `file:` yourself:
  ```bash
  PASSWORD_PATH="$PASSWORD_FILE"
  command -v cygpath &> /dev/null && PASSWORD_PATH=$(cygpath -m "$PASSWORD_FILE")
  ```

### S3 — Automated commits name their files *(CR-08)*

```bash
# ✅ Commits only these paths, even if the user has other changes staged
git add "$A" "$B" && git commit -m "chore: ..." -- "$A" "$B"
# ❌ Commits the whole index
git commit -m "chore: ..." || true
```

Report the real outcome. Never `|| true` followed by a ✅ message.

### S4 — Use recorded times, not file mtimes *(CR-10)*

`git checkout` / `clone` resets mtimes. Read the time from the record the script itself writes (e.g. `.claude/conversation-backups/backup-index.json` `last_backup`). Only fall back to mtime with a visible warning.

### S5 — Exact match or fail; never widen the scope *(CR-12)*

Find the Claude project folder with `scripts/lib/claude-project-dir.sh` (`claude_project_dir`). It matches the exact folder name, or exits 1 and lists the candidates. ❌ No `find … | head -1`, and no "searching all projects" fallback: it would back up every project's conversations.

### S6 — Lines read from a file may end in CRLF *(CR-11)*

This repo uses `core.autocrlf=true`. Strip `\r` from every field you read:

```bash
while IFS=$'\t' read -r a b; do a="${a%$'\r'}"; b="${b%$'\r'}"; ...; done < file.tsv
```

### S7 — Validate values before passing them on *(CR-09)*

```bash
[[ "$SIZE" =~ ^[0-9]+$ ]] || SIZE=0      # before jq --argjson
```

### S8 — Shared logic lives in `scripts/lib/`; no duplicated branches *(CR-13)*

### S9 — Test committing or destructive scripts in a sandbox first

```bash
SB=$(mktemp -d); cd "$SB" && git init -q && git config user.email t@t && git config user.name t
# create the files the script expects, stage an unrelated file, use a fake HOME:
HOME="$SB/fakehome" bash "/path/to/repo/scripts/<script>.sh"
git show --name-only HEAD; git diff --cached --name-only     # only the intended files committed?
```

---

## §3 Process Rules (P1–P10)

- **P1 — Review before pushing a batch.** Run `/code-review`, `npm run check:api-contract` **and** `npm run check:code-rules`. `/code-review` only sees the diff, so it can't find code that was never written (the 49 missing routes were never in a diff); the contract check covers the whole repo. Record the findings in `docs/planning/TODO_CodeReview_<YYYYMMDD>.md` with `CR-nn` ids and a status per row. Mark unfinished work as **BLOCKED** in `Claude.md` and the relevant guide until it's fixed.
- **P2 — Fix in a new AppScript file** (A11) and tick the status in the tracker with the file or commit that fixed it.
- **P3 — Deploy order for data migrations.** The lock (A5) only protects writes from a web app that runs the new code. Redeploy the web app **before** applying a rebuild or migration, or make sure nobody is using the app. See `appscript_files/GUIDE_AppScript_Deploy_and_Schema_Rebuild.md`.
- **P4 — Promote lessons.** When a finding reveals a new class of bug, add a rule here (new version) and a check in `docs/reference/RESOLUTION_CHECKLIST.md`.
- **P5 — Done means reachable.** A feature or phase is done when its endpoints are routed, a screen reaches them (mounted, wired to the real API - no `setTimeout` "saves" or "will be implemented" placeholders), the contract check passes, and a live smoke test exercised them (the deploy guide's verify step). Functions written but not routed, or components written but not mounted, count as not started. The v6.2–v6.3 workflow engine was marked "18 functions → v6.2" and was unreachable for a year; the ticket screens were "Phase 6" components that no page imported.
- **P6 — Build like Vercel.** Vercel builds with `CI=true`, where Create React App fails on any ESLint warning. A plain `npm run build` only prints them, so the warnings piled up locally while every Vercel deploy from 24934fd (19 Oct 2026) failed with "Failed to compile" and the site kept serving 3 Oct 2025. Run `npm run build:ci` before pushing frontend changes; it also clears the ESLint cache, which went stale on the Z: drive. Fix the warning or, when the code is deliberate, add an `eslint-disable-next-line` with the reason. Never set `CI=false` on Vercel.
- **P7 — Review the version diff, not the new file.** Each AppScript version is a new 13k-line file, so `git diff` shows it all as added and the review can't tell what changed. Review `git diff --no-index <previous APPSCRIPT_v*.txt> <new APPSCRIPT_v*.txt>` together with the frontend diff.
- **P8 — Whole-file review.** Every 3 AppScript versions, and before each migration phase, run `/code-review` on the latest AppScript file as a whole (not a diff), checked against A1–A20 and the `Claude.md` non-functional targets. Diff reviews never see old code: S1 and S2 lived in the file since v8.0.
- **P9 — One review log per AppScript version.** Each version gets a `docs/planning/TODO_CodeReview_<YYYYMMDD>.md` entry (findings, status). v9.1–v9.3 had none, so v9.4's review covers v9.0 → v9.4.
- **P10 — Performance gate.** A change on a hot path (ticket create / approve / dashboard / lists) keeps or adds a read-count assertion in the offline tests. After the migration, the `Claude.md` query and latency budgets apply. A finding marked "revisit when data grows" (R-08) gets a test, not a note.
- **`check:code-rules` known gaps.** `scripts/code-rules-known-gaps.txt` lists the violations that existed on v9.3 (baseline 91). It **may only shrink**: fix a violation, then `node scripts/check-code-rules.js --update`, which refuses to add lines.

---

## §4 Pre-Commit Checklist

**Frontend change**
- [ ] `npm run build:ci` passes: zero ESLint warnings (P6)
- [ ] `npm run check:api-contract` passes: routes, client methods, mounted components and icons (A12)
- [ ] A new screen is mounted and uses the real API - no simulated saves or placeholder modals (P5, F4)
- [ ] `npm run check:code-rules` passes; its known-gaps list only shrank (F3, F4)
- [ ] Business rules computed on the server, not in the browser (F1); times shown through `dateTime.js` in the effective zone (F3 v3)
- [ ] Identity sent only as the ID token header; body `user_id` is a target or display value (F2)
- [ ] A screen makes ≤ 2–3 calls on load; writes invalidate the cached entity (F5)

**Proxy change (`api/`)**
- [ ] URL and secrets from env; token verified before forwarding; client `_auth_uid` / `_proxy_secret` stripped (F6)
- [ ] `node scripts/test-proxy-auth.js` passes (F6)

**AppScript change**
- [ ] New timestamped file; header block updated, including the `Deploy description:` line (A11)
- [ ] No positional rows added; no new columns in front of a pinned prefix (A1)
- [ ] Headers only in `TABLE_SCHEMAS`; tabs created via `ensureTableSheet` (A2)
- [ ] New column that filters depend on → `COLUMN_DEFAULTS` entry (A3)
- [ ] No clear or delete reachable from `doPost` / `doGet`; init and seed are idempotent (A4)
- [ ] Writes under `withScriptLock`; `POST_READ_ONLY_ACTIONS` lists only reads (A5)
- [ ] Error results go through `createHandlerResponse` or throw (A6)
- [ ] Request keys match `src/api/googleSheet.js`; ids compared with `String()` (A7, A8)
- [ ] `logAdminAction` uses the 5-argument form (A9)
- [ ] Offline test passes; a new test was added for new behaviour (A11)
- [ ] `API_VERSION` matches the header `Version:` (A11)
- [ ] `npm run check:api-contract` passes; the known-gaps list only shrank (A12)
- [ ] No payload key named `action` (A13)
- [ ] Every sheet write invalidates its cache entry; offline suites run with the stale-cache detector (A14)
- [ ] Permission checks use `actorId(...)`; target-user keys kept as sent (A15)
- [ ] No read inside a loop; hot paths keep their read-count assertion (A16, P10)
- [ ] Timestamps are real UTC; local days only via `companyClock` / `dayIn` / `addSlaTime` / `calendarYear`; no `getDay` / `+8h` / `'Asia/Manila'` literal (A17 v3)
- [ ] Ids from `generateId()` or a locked sequence (A18)
- [ ] Time-driven jobs idempotent, `tryLock` skip, bounded, dry-run, editor-only install (A19)
- [ ] No duplicate function names (A20)
- [ ] Every route that returns tickets checks `canViewTicket`; a hidden ticket answers like a missing one (A21)
- [ ] A gated route takes its company from the record, its fallbacks fail closed, every path that adds to a limit checks it, and a new feature key is in `PLAN_FEATURE_TIERS` and in `src/config/plans.js` (A22)
- [ ] `npm run check:code-rules` passes; its known-gaps list only shrank (A14–A18, A20–A22)
- [ ] Review run on `git diff --no-index <prev> <new>` and logged in `TODO_CodeReview_<date>.md` (P7, P9)
- [ ] Dry run `rebuildAllTables()` reviewed before any apply (P3)

**Script change**
- [ ] `pipefail` and exit checks; partial output removed on failure (S1)
- [ ] No secrets in argv; Git Bash paths converted after prefixes (S2)
- [ ] Commits use a pathspec; real outcome reported (S3)
- [ ] Times come from records, not mtimes (S4)
- [ ] Exact match or fail; no widened scope (S5)
- [ ] `\r` stripped from fields read from files (S6)
- [ ] Values validated before use (S7)
- [ ] Shared logic in `scripts/lib/` (S8)
- [ ] Sandbox-tested if it commits, deletes or encrypts (S9)

---

## §5 Finding → Rule Map

| Finding | Rule | | Finding | Rule |
|---|---|---|---|---|
| CR-01 positional custom_field_values | A1 | | CR-08 commit without pathspec | S3 |
| CR-02 blank new column | A3 | | CR-09 unchecked pipeline / password in argv | S1, S2, S7 |
| CR-03 rebuild vs unlocked writers | A5, P3 | | CR-10 mtime as backup age | S4 |
| CR-04 duplicate header lists | A2 | | CR-11 CRLF manifest | S6 |
| CR-05 init clears data | A4 | | CR-12 widened project scope | S5 |
| CR-06 logAdminAction arity | A9 | | CR-13 duplicated branches | S8 |
| CR-07 success:true on error | A6, A8 | | X-1 26 mis-logged audit rows | A9 |
| X-2 frontend/backend key mismatch | A7 | | X-3 update/delete positional rows | A1 |
| X-4 init clear + null sheet | A4, A10 | | X-5 `file:` path on Git Bash | S2 |
| X-6 old web app ignores lock | P3 | | 49 unrouted frontend actions | A12, P1, P5 |
| Routes calling undefined functions | A12 | | Payload `action` overwrote the route | A13 |
| Reco P1/P2 + R-08 tabs re-read per approval | A14, A16, P10 | | Reco P3 options read per list (+ N1 strict `===`) | A16, A8 |
| Reco S1 no server-side auth (+ R-05 required `user_id`) | A15, F2, F6 | | Reco S2 +8h labeled `Z` (+ N7 `getDay`) | A17, F3 |
| Reco S5 `getLastRow()` ids, P6 `max(id)+1` | A18 | | Reco S4 duplicate `getTicketActionLogs` | A20 |
| N6 browser-only SLA escalation, `setTimeout` saves | F1, F4, A19 | | Reco P8 one call per widget (+ R-02) | F5 |
| Old code never reviewed (diff-only reviews) | P7, P8, P9 | | | |
