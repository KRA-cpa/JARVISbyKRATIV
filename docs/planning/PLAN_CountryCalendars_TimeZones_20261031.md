<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_CountryCalendars_TimeZones_20261031.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: AppScript v10.1 - country calendars (ticket year, holidays, weekends) + company time zone (clock rules) + per-user display zone, replacing the hard-coded Asia/Manila; prerequisite for the v10.2 plans | Status: Approved (session ff4c803f), not built
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created from plan ~/.claude/plans/create-a-plan-how-soft-comet.md Part A (session ff4c803f)
===============================================================================
-->

# PLAN — Country calendars + time zones (AppScript v10.1)

## Context
Selling JARVIS by plan (`docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md`, v10.2) opens it to companies outside the Philippines. Today every date rule is Asia/Manila:
- the ticket number YEAR (Claude.md §3.2, "Philippine Time");
- SLA business hours / days and weekends;
- `company_holidays` + `addPhilippineHolidays` (v9.5);
- report date ranges and email date text;
- display (`Intl` in Asia/Manila, compliance F3);
- and, from v10.2, plan / trial end of day.

Timestamps are already stored in real UTC (v9.4 S2 / A17), so this is about **conversion at the edges**, not storage.

**User decisions (31 Oct 2026, session ff4c803f):**

| # | Decision |
|---|---|
| U8 | The **company time zone** governs business rules. A **per-user display zone** is a feature of **Advanced and up** (gated in v10.2) |
| U9 | Time zones are **their own version before plans**: v10.1 here, plans in v10.2 |
| U10 | The ticket YEAR, holidays and weekends follow the company's **country calendar**. A per-time-zone calendar doesn't make sense |

**Version line (from 31 Oct 2026):**
- v10.0 as approved (`docs/planning/PLAN_v10.0_Build_20261031.md`);
- **v10.1 = this plan**;
- v10.2 = plans + subscriptions;
- v10.3 = head approval / delegation / bulk (was v10.1 in `docs/planning/PLAN_FeatureGaps_Volume_20261031.md` §9);
- v10.4 = comments and the rest (was v10.2).

---

## §1 Model: two layers (+ display)

| Layer | What it sets | Source |
|---|---|---|
| **Country calendar** (a calendar fact) | the **ticket number YEAR**, **holidays**, **weekend days**, and the day boundaries those use | `country_calendars.calendar_tz` (one reference zone per country: PH → Asia/Manila, SG → Asia/Singapore, AE → Asia/Dubai; for multi-zone countries such as US / AU / ID the platform admin picks it, default the capital's zone) |
| **Company time zone** (a clock) | SLA **business hours**, plan / trial **end of day** (v10.2), reminder timing, delegation day bounds (v10.3), report date ranges, email date text | `companies.timezone`: an IANA zone that must be one of the country's zones (default = the country's `calendar_tz`) |
| **User display zone** (Advanced and up from v10.2) | only how dates are **shown** | `user_preferences.display_timezone` (blank = the company zone). Screens show the zone label when it isn't the company zone |

- In single-zone countries the two layers are the same.
- **The year is Gregorian.** "Country calendar" means the country's dates, holidays and weekends, not another calendar system.
- **Storage doesn't change:** real UTC (A17).

---

## §2 Schema (v10.1 rebuild apply via `ensureTableSheet`; writers by header through `rowFromRecord`; writes check `requireColumns` → `SCHEMA_OUTDATED`)

- **`country_calendars`** (new): `country_code` (ISO 3166-1 alpha-2), `name`, `calendar_tz`, `allowed_timezones` (json), `weekend_days` (json, JS day numbers, e.g. `[0,6]`; set per country), `default_business_hours` (json `{ start: '08:00', end: '17:00' }`), `is_active`, plus audit columns.
  - Seeded with **PH**: `Asia/Manila`, weekend `[0,6]`, business hours as in `docs/reference/SLA_IMPLEMENTATION.md`.
  - The platform admin adds other countries.
- **`country_holidays`** (new): `id` (`generateId`, A18), `country_code`, `date` (calendar date, no time), `name`, `type` (`regular` | `special` | …), `year`, `is_active`, plus audit columns.
  - `addPhilippineHolidays` becomes `addCountryHolidays('PH', year)`, one definition (A20), plus a CSV import for other countries (platform admin).
- **`company_holidays`** (v9.5, kept) + `overrides_country` (`add` default | `remove`): a company can add its own days, or work on a country holiday.
- **`companies`** + `country_code` (default `PH`), `timezone` (default `Asia/Manila`). Defaults go in `COLUMN_DEFAULTS`.
- **`user_preferences`** + `display_timezone` (blank).
- **Migration** (JARVIS Admin, dry run / apply, idempotent by country + date):
  - every existing company gets `PH` / `Asia/Manila`, so nothing changes;
  - `company_holidays` rows that are PH public holidays move to `country_holidays`.

---

## §3 Helpers (AppScript), replacing the hard-coded Manila

- **`companyClock(companyId)`** → `{ tz, country, calendarTz, weekendDays, businessHours }`. It's read once per request (A16), cached with `companies` + `country_calendars`.
- **`formatDate(date, tz)`** (exists) plus:
  - `startOfDayIn(tz, date)` and `endOfDayIn(tz, date)`;
  - `calendarYear(companyId, date)`, using `calendarTz`;
  - `isBusinessDay(companyId, date)`: weekend days, country holidays ∪ company `add` − company `remove`.
- **Call sites to move:**
  - ticket number YEAR (`getNextSequence` / `generateTicketNumber`);
  - SLA due date + business hours (`slaCalculator`, v9.5 company SLA rules);
  - `runSLAEscalations` percent / before / after due;
  - the holidays lookup;
  - report date ranges;
  - email date text.

  v10.0 cursors stay UTC (unchanged). Delegation (v10.3) and plan / trial dates (v10.2) use these helpers from the start.
- **The slaCalculator +8 h bug** (backlog) is fixed here as part of the move.
- **Compliance A17 v3** (`docs/guides/GUIDE_CodeReview_Compliance.md`): "real UTC; local dates only through `companyClock` + `formatDate(…, tz)`".
  - `npm run check:code-rules` flags any literal `'Asia/Manila'` / `+8` hour shift outside the `DEFAULT_TZ` constant and the PH seed.
  - The rule's self-test gets the new cases.

---

## §4 Frontend

- **`src/utils/dateTime.js`:** one `formatInZone(date, zone)` with `Intl`. Compliance F3 moves from "`Intl` in Asia/Manila" to "`Intl` in the effective zone".
- **`UserContext`** exposes `effectiveZone(companyId)`:
  - the user's display zone when allowed (in v10.1 open to all; v10.2 gates it with `user_timezone_display`);
  - else the company zone.
- **Checks:** every date display goes through it, and `check:code-rules` gets a `src/` grep for `toLocaleString(` / `timeZone: 'Asia/Manila'` outside `dateTime.js`.
- **Screens** (mounted, A12 / P5; added to `docs/reference/DEPENDENCY_MAPPING.md` / `docs/reference/DEVELOPMENT_PLAN.md`):
  - **Platform → Country calendars**: countries, reference zone, weekends, hours, holiday packs, CSV import.
  - **Admin → Company → Region**: country + time zone (chosen from the country's zones). Changing the **country** after the company's first ticket needs a platform admin and is logged, because it moves the year and the holidays.
  - **Profile → Display time zone.**

---

## §5 Postgres (goes into the migration plan)
- `country_calendars`; `country_holidays` unique on `(country_code, date)`.
- `companies.timezone` / `country_code`.
- Conversions with `AT TIME ZONE companies.timezone` (clock) or `country_calendars.calendar_tz` (calendar).
- The ticket year is assigned inside the create transaction (row lock on `sequence_counters`).

---

## §6 Tests: `appscript_files/tools/ROUTES_TEST_v10.1.js`
Fake clock. Run under `TZ=UTC` **and** `TZ=Asia/Manila` to catch host-zone leaks.

- **Ticket year:**
  - a PH company at 31 Dec 23:30 Manila → current year; at 1 Jan 00:01 → next year;
  - a US company (reference zone America/New_York) across its own midnight;
  - a company zone different from the country's reference zone uses the **country** year.
- **SLA:**
  - business hours in the company zone;
  - Fri / Sat weekends for a country set that way;
  - a country holiday skipped;
  - a company `remove` override is worked that day;
  - a company `add` day is skipped.
- **Migration:** existing companies are PH / Manila, and every v9.x / v10.0 SLA and numbering test passes unchanged.
- **Region change:** a country change after the first ticket is refused for a company admin, and allowed and logged for a platform admin.
- **Display:** the display zone only changes display; server results are identical whatever the user's zone.
- All older suites on the new file. Then `check:api-contract`, `check:code-rules`, `build:ci`, and `/code-review` on `git diff --no-index` v10.0 → v10.1 (P7), logged in `docs/planning/TODO_CodeReview_<YYYYMMDD>.md`.

---

## §7 Deploy (deploy guide "v10.1" section)
1. Rebuild dry run → apply (2 tabs, 5 columns).
2. Run the migration (dry run → apply).
3. Check that JARVIS Admin → Status shows every company as PH / Asia/Manila.
4. Redeploy (ping `10.1.0`), then the frontend from the same commit, then the Vercel check.

## §8 Open defaults (can change before the build)
- Multi-zone countries use the capital's zone as the calendar reference.
- PH business hours as in `docs/reference/SLA_IMPLEMENTATION.md`.
- A country change after the first ticket is platform-admin only.
- The display zone is open to all in v10.1 and gated in v10.2.
