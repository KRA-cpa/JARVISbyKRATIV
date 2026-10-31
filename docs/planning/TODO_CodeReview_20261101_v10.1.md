<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TODO_CodeReview_20261101_v10.1.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Findings of the v10.1 review (version diff v10.0 → v10.1 + the T3 frontend, session ff4c803f) and their fixes | Status: 7 fixed, 1 noted (not a defect of the server)
REVISION HISTORY:
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | 7 findings fixed in APPSCRIPT_v10.1_20261101_0101.txt (not yet deployed), ADMIN_Tools v1.4 and src/; a regression test each; 1 known limitation noted
===============================================================================
-->

# TODO — Code Review Findings (1 Nov 2026, v10.1)

**Scope (compliance P7):** what v10.1 adds to `appscript_files/APPSCRIPT_v10.1_20261101_0101.txt` over `APPSCRIPT_v10.0_20261031_2053.txt` (`git diff --no-index`, 623 + / 269 −), the ADMIN_Tools v1.3 → v1.4 diff, and the `src/` changes of T3. Checked against compliance A1–A21 / F1–F6 (A17 v3 / F3 v3 new in this version) and the design `PLAN_CountryCalendars_TimeZones_20261031.md` §1–§4, §6. Read-only pass, then fixes.
**Whole-file review (P8):** after v10.2, as planned (`TODO_CodeReview_20261101.md` header).
**Fixed in place:** v10.1 has never been deployed, so the same file was corrected.

| ID | Sev | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| CR5-01 | 🟡 | `UserContext.companyZone` / ticket screens | The company zone came only from the user's profile companies (role assignments). An admin opening another company's ticket saw its dates and "due today" in the default zone, not that company's | Optional `fallbackZone`; TicketDashboard / TicketDetail pass the zone from the company list they already load | `build:ci` |
| CR5-02 | 🟡 | `setCompanyRegion` | Without `timezone` the company was reset to the country's reference zone, even when only the reason or the country stayed the same | Keep the company's zone when the (new) country allows it, else the reference zone | `ROUTES_TEST_v10.1.js` CR5-02 |
| CR5-03 | 🟠 | `calculateSLADueDate` (step SLAs) | Found while building T2: a step SLA (no company rule) still counted days and weekends on the default Manila Sat / Sun calendar, not the company's zone and country weekend | `calculateSLADueDate(..., clock)`; `stepDueDateFor` passes `companyClock` | T2 step SLA (Dubai Fri / Sat) |
| CR5-04 | 🟠 | `getUserPreferences` / `updateUserPreferences` | Positional rows (A1): the 12-cell row write dropped every column after `updated_at`, so `display_timezone` could never be saved; `'FALSE'` strings read as true | Read / write by header (`findRecord`, `updateRecordFields`, `appendRecord`), `preferencesView` with `boolFlag`, `display_timezone` validated | T3 preferences |
| CR5-05 | 🟡 | `createCompanyHoliday` | The route couldn't write `overrides_country: 'remove'` (design §2 "the company works that day"); only the migration knew the column | `overrides_country` add / remove (remove needs a company; `SCHEMA_OUTDATED` before the rebuild) | T3 createCompanyHoliday |
| CR5-06 | 🟡 | ADMIN_Tools v1.3 "Give me a test role" | Used `MANILA_TZ`, which v10.1 removed - the menu item failed on v10.1 | ADMIN_Tools v1.4: `adminTz_(company)` (companyClock on v10.1+, Manila before) | `ADMIN_TOOLS_TEST.js` v1.4 (19) |
| CR5-07 | ⚪ | `companySLARuleValues` | New company SLA rules still defaulted `timezone` to Manila although the column is no longer read (T2: the company clock decides) | Left blank = the company zone; the form shows the company's zone instead of a picker | T3 company SLA rule |
| N-01 | ⚪ note | `src/utils/dateTime.js` `wallClockIn` | In a browser whose OWN zone has daylight saving, a zone wall-clock time inside that browser's spring-forward hour can't be held in local fields, so the SLA preview (`slaCalculator`) can be one hour off for that hour. Display text (`formatInZone`) and the server are not affected | Not fixed: preview only, the server decides (F1). Fix when the preview matters: date-fns-tz (dependency change → PRODUCTION_REQUIREMENTS first) | - |

**Checked, no finding:** zone math (`zoneAt` two-pass offset, `nextDayIn` at noon, DST day = 23 h - T1 tests), the year rule (country `calendarTz`, not the company zone), `CLOCK_CACHE` reset on every write and per request, the SLA trigger runs inside `withRequestScope` (one read per tab), holidays country + add − remove, migration idempotent, `ADMIN_ONLY_ACTIONS` covers the four new writes, A21 unaffected (no new ticket route), D6 removal (frontend always sends `limit`; mock / older-backend arrays still accepted by `getPage`).

**Checks after the fixes:** `ROUTES_TEST_v10.1.js` 19 under TZ=UTC and TZ=Asia/Manila (T2 tests fail on the T1 file: 6 of 7), every older suite on v10.1, ADMIN_TOOLS (v1.4) 19 / 17 on v10.0 / 15 on v9.7, SEED 4, proxy 26; frontend `dateTime.test.js` 5 + `slaCalculator.test.js` 4 under TZ=UTC / America/New_York / Asia/Manila; `check:api-contract`, `check:code-rules` (A17 v3 / F3 v3; F3 slaCalculator gap removed), `build:ci` OK.
