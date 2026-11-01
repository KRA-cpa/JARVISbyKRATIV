<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: DESIGN_MultiDateField_LeaveDays_20261101.md | Author: Kenneth R. Advento | Version: 1.4.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Design of the "Dates" custom field (multiple dates) for payroll-type requests - leave (half days, leave-day count with the sandwich rule), non-punching authorization and Manual DTR (time in / out per day) | Status: Design - for review; decisions D1-D14 open; not built
REVISION HISTORY:
- v1.4.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §4b payroll request modes: non-punching authorization (no time in / no time out / both) and Manual DTR (user); `time` values; payroll export; D11-D14
- v1.3.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Window is for PAYROLL-type requests, not "HR" (user correction); template renamed; later option: back limit = last payroll cut-off
- v1.2.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Window = the calendar only SHOWS the allowed days and months (user: "make calendar selection limited, dont greyout") - no disabled days
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §4a selection window (user: "for HR type request, limit calendar selection to next x months") for every date-type field; D9-D10
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "design multiple dates. holiday can be sandwiched or rest day/weekend sandwiched by leaves"
===============================================================================
-->

# DESIGN — "Dates" field for payroll-type requests: leave (sandwich rule), non-punching, Manual DTR

## Context
Field types today: text, paragraph, date, date range (Advanced, and its name differs between the form builder
`daterange` and the server `date_range` - see the field-type assessment, 1 Nov 2026), amount, dropdown. There is no
way to pick **several separate days** (Mon, Wed, Fri) or **half days**, and nothing counts **leave days** against the
company calendar.

Leave policies (common in the Philippines and the region) often have a **sandwich rule**: a rest day (weekend) or a
holiday that sits **between two leave days** counts as leave too. Example: leave on Friday and Monday → Saturday and
Sunday are "sandwiched" → 4 days, not 2.

v10.1 already has what the count needs: the company's country calendar (`weekend_days`), country holidays and
company add / remove days (`companyHolidayDays`, `isBusinessDay`).

## §1 What the requester sees
```
Leave dates *                                         [ + Add a range ]
 ┌──────────── November 2026 ────────────┐
 │ Su  Mo  Tu  We  Th  Fr  Sa             │   tap a day = whole day
 │  1   2   3   4   5  [6]  7             │   tap again = AM → PM → off
 │  8  [9] 10  11  12  13  14             │   grey = rest day, red dot = holiday (name on hover / long-press)
 │ ...                                    │
 └────────────────────────────────────────┘
 Fri 6 Nov · Mon 9 Nov
 Working days 2 · Sandwiched 2 (Sat 7, Sun 8 - rest days) · Leave days 4
```
- A **calendar** (month view, swipe for the next month) with the company's rest days and holidays marked.
- **Tap** a working day = whole day; tap again = **AM** half, again = **PM** half, again = removed (when half days are
  on for the field, D3).
- **Add a range** fills every working day between two dates (rest days / holidays are not selected, they may then
  count as sandwiched).
- Below the calendar, a live **summary**: the chosen days, working days, sandwiched days (with why), total. The same
  text is shown to approvers, in emails and on the ticket.
- Rest days and holidays **can't be picked directly** (default; D4).
- The calendar **only shows the selection window** (§4a): it opens on the first allowed month, pages only between
  the first and last allowed months, and in those edge months the days outside the window are **not drawn** (empty
  cells, nothing to tap) - no greyed or disabled days to explain. A line under the calendar says the range:
  "Leave can be filed from 2 Oct 2026 to 1 Feb 2027."

## §2 The value
Stored per ticket field (Sheets: `custom_field_values.text_value` as JSON; Postgres: `jsonb`), plus the total in
`number_value` so reports, sorting and **conditional routing** ("leave days > 5 → HR") work with the existing numeric
comparison:
```json
{
  "v": 1,
  "entries": [ { "date": "2026-11-06", "part": "full" }, { "date": "2026-11-09", "part": "full" } ],
  "count": {
    "working": 2, "sandwiched": [ { "date": "2026-11-07", "kind": "rest_day" }, { "date": "2026-11-08", "kind": "rest_day" } ],
    "total": 4, "rule": "both", "calendar": "PH", "computed_at": "2026-11-01T03:12:00Z"
  }
}
```
- `date` = a calendar day `yyyy-MM-dd` in the **company's** calendar, **no time, no zone conversion** (compliance F3 v3:
  a day is a day). Never stored as a Sheets Date cell (avoids the midnight / zone shift).
- `part` = `full` | `am` | `pm` (0.5 each).
- `count` is computed **by the server** (§3) and saved with the value - a snapshot. A later holiday change does not
  rewrite past tickets; returning / editing the ticket recomputes it.

## §3 The count (one pure function, server-authoritative)
`countLeaveDays(entries, calendar, policy) → { working, sandwiched[], total }`
- `calendar` = `{ restDays: weekday numbers (country weekend_days), holidays: Set of yyyy-MM-dd (companyHolidayDays) }`.
- `policy` = the field's settings (§4).

**Steps**
1. Drop duplicates, sort by date. Refuse a rest day / holiday entry unless D4 allows it (then it counts per D4).
2. **Working days:** each entry on a working day = 1 (`full`) or 0.5 (`am` / `pm`).
3. **Sandwich:** for each pair of **consecutive chosen dates** A < B where **every day strictly between them is a
   non-working day** (rest day or holiday, at least one), those days are *sandwiched* - **if the absence is
   unbroken**:
   - A must be off in the **afternoon** (`full` or `pm`), and
   - B must be off in the **morning** (`full` or `am`).
   - Then each gap day counts 1 **when its kind is covered by the rule** (`rest_days`, `holidays`, `both`); a gap day
     that is both (a holiday on a Sunday) counts once, kind `holiday`.
4. `total = working + count(sandwiched)`.

The browser runs the **same function** for the live summary; the server recomputes on submit and its result is the
one saved (a shared module: `src/utils/leaveDays.js` now, `api/_lib/` copy-free import in the cloud server).

**Worked examples** (Philippine calendar; weekend Sat-Sun; 2026 dates)
| # | Chosen | Between | Rule | Count |
|---|---|---|---|---|
| 1 | Fri 6 Nov, Mon 9 Nov | Sat 7, Sun 8 (rest) | off | **2** |
| 2 | same | same | rest_days or both | 2 + 2 = **4** |
| 3 | Fri 27 Nov, Tue 1 Dec | Sat 28, Sun 29 (rest), Mon 30 Nov (Bonifacio Day, holiday) | both | 2 + 3 = **5** |
| 4 | same | same | holidays | 2 + 1 = **3** (only Mon 30) |
| 5 | same | same | rest_days | 2 + 2 = **4** (only Sat, Sun) |
| 6 | Thu 24 Dec (full), Mon 28 Dec (**PM**) | Fri 25 (Christmas), Sat 26, Sun 27 | both | 1 + 0.5 = **1.5** - Monday morning worked, absence broken, no sandwich |
| 7 | Thu 24 Dec (**PM**), Mon 28 Dec (**AM**) | same | both | 0.5 + 0.5 + 3 = **4** - unbroken |
| 8 | Mon 2 Nov, Wed 4 Nov | Tue 3 (working, not chosen) | both | **2** - a working day in the gap is never sandwiched |
| 9 | Wed 30 Dec only | Thu 31 Dec, Fri 1 Jan holidays after it | both | **1** - a holiday next to only one side isn't sandwiched |

## §4 Field settings (form builder)
| Setting | Values | Default |
|---|---|---|
| Label, required, help text | as other fields | – |
| `half_days` | on / off | on |
| `sandwich_rule` | `off` / `rest_days` / `holidays` / `both` | `off` (D1) |
| `non_working_pick` | `refuse` / `allow_counted` / `allow_not_counted` | `refuse` |
| `max_days` | number or empty | empty |
| `allow_past` | yes / no | yes (sick leave is filed after) - superseded by `days_back` in §4a |
| `count_label` | text | "Leave days" |

## §4a Selection window (all date-type fields)
For **payroll-type requests** - anything that changes pay for a day: leave, overtime, undertime, schedule / shift
changes, official business - the company limits **how far ahead** (and how far back) a day can be picked, so requests
land in a payroll period that is still open. One setting pair on **every date-type field** - `date`, `date_range` (both ends) and `multi_date` (every day):

| Setting | Values | Default (new field) | Payroll leave template |
|---|---|---|---|
| `months_ahead` | 1-24, or empty = no limit | empty | **3** |
| `days_back` | 0-365, or empty = no limit | empty | **30** (sick leave filed after) |

**Rules**
- "Today" = the day in the **company's** time zone (v10.1 `companyClock`), not the browser's or the server's.
- `months_ahead` is **rolling**: the last allowed day = today + N months, same day of month, clamped to the month's
  last day (31 Jan + 1 month → 28 Feb; 1 Nov 2026 + 3 → 1 Feb 2027) (D9).
- `days_back` = 0 means "today or later" (e.g. vacation leave); the first allowed day = today − N days.
- **The calendar shows only the window** (user decision, 1 Nov 2026): months outside it can't be reached, and days
  outside it in the first / last month are left blank - never greyed or disabled. The Add-a-range pickers use the same
  bounds. Nothing outside the window can be chosen in the page, so the page needs no "not allowed" handling.
- **The server still checks** the window on submit - a request can be sent without the page (API, uploader, an old
  browser tab opened yesterday). It is a one-line refusal, not a screen state:
  *"Leave dates: pick days from 2 Oct 2026 to 1 Feb 2027."*
- **When it's checked:** on create, and on edit / resubmit **only for days that changed**. A returned ticket keeps its
  original days even if they now fall outside the window (the requester isn't punished for the approver's delay) (D10).
- `max_days` (§4) and the window are separate: the window limits *which* days, `max_days` limits *how many*.
- **Later option (payroll cut-off):** instead of a fixed `days_back`, the back limit = the start of the **first open
  payroll period** (needs a company payroll calendar: semi-monthly 1-15 / 16-end is the PH norm). Not in v1.

**Worked examples** (today = Sun 1 Nov 2026, company zone Asia/Manila)
| Field | Window | Allowed |
|---|---|---|
| Leave dates (`multi_date`) | 3 months ahead, 30 days back | 2 Oct 2026 - 1 Feb 2027 |
| Vacation (`date_range`) | 3 ahead, 0 back | 1 Nov 2026 - 1 Feb 2027 (both ends) |
| Overtime date (`date`) | no ahead limit, 7 back | 25 Oct 2026 onward |

## §4b Payroll request modes: leave, non-punching authorization, Manual DTR
Payroll requests all pick **days** and some need **times per day**. Today's fields hold one value each, so a Manual DTR
(several days, each with its own time in / out) can't be built from them. Instead of a generic "table" field, the Dates
field gets a **mode** (D11): one calendar, one value shape, one payroll export.

| Mode | Request it serves | Per chosen day |
|---|---|---|
| `leave` | Leave (vacation, sick, emergency...) | `part`: full / am / pm (§1-§3) |
| `missed_punch` | **Non-punching authorization** (forgot / couldn't punch) | `missing`: **time_in** / **time_out** / **both**, plus the actual time(s) for what was missed |
| `time_entries` | **Manual DTR** (no biometric, field work, system down) | `time_in`, `time_out` (both required), optional `break_minutes` (D12) |

**Requester view**
```
Non-punching authorization                     Manual DTR
Date(s) *   [calendar - window §4a]            Dates *   [calendar - window §4a]
 Tue 27 Oct  Missing: (•) Time in               Mon 26 Oct  In [08:02]  Out [17:10]  Break [60]  = 8h 08m
                      ( ) Time out              Tue 27 Oct  In [21:00]  Out [06:00]  Break [60]  = 8h 00m*
                      ( ) Both                  * crosses midnight
             Actual time in [07:55]             Total 2 days · 16h 08m
Reason * [Biometric not working ▾]             Reason * [Field work ▾]
Proof (link) [ ... ]                           Proof (link) [ ... ]
```
- Each day picked on the calendar gets its own row under it; removing the day removes the row.
- **Times** are wall-clock `HH:mm` in the **company's** zone - no conversion (compliance F3 v3: the punch happened at
  that local time). An out-time earlier than the in-time means **the next day** (night shift); the row says so.
- Rest days and holidays **can be picked** in these two modes (people do work them) and the value records the day's
  kind, because payroll pays rest-day / holiday work differently.

**Value** (same JSON envelope as §2; `mode` added; `number_value` = the headline number)
```json
{ "v": 1, "mode": "time_entries",
  "entries": [
    { "date": "2026-10-26", "time_in": "08:02", "time_out": "17:10", "break_minutes": 60, "day_kind": "working" },
    { "date": "2026-10-27", "time_in": "21:00", "time_out": "06:00", "break_minutes": 60, "next_day_out": true, "day_kind": "working" } ],
  "count": { "days": 2, "minutes": 968, "computed_at": "2026-11-01T03:12:00Z" } }
```
`missed_punch` entries: `{ "date", "missing": "time_in" | "time_out" | "both", "time_in"?, "time_out"?, "day_kind" }`.
`number_value`: leave = leave days; missed_punch = number of days; time_entries = total hours (2 decimals).

**Server checks (on submit)**
- Every chosen day is inside the window (§4a). **Default window for both modes: 0 months ahead** (a punch can't be
  missed in the future) and a short back limit (template: 15 days; later the payroll cut-off, §4a).
- A day that is **today**: the times must not be later than the current company time.
- `missed_punch`: the time(s) for what is missing are required (`time_in` for time_in, both for both).
- `time_entries`: both times required; worked time after the break between 0 and 24 h; `break_minutes` 0-240.
- One row per day (no duplicate dates in one request). Overlap with other tickets (leave on the same day, another
  DTR) = later (§6).

**Templates** (owner template library; all plans per D2)
| Template | Mode | Window | Other fields |
|---|---|---|---|
| Leave | `leave` | 3 ahead / 30 back | Type of leave, note |
| Non-punching authorization | `missed_punch` | 0 ahead / 15 back | Reason (dropdown: biometric down, forgot, field work, other), proof link |
| Manual DTR | `time_entries` | 0 ahead / 15 back | Reason (dropdown), proof link |

**Payroll export** (the reason these are tickets): a CSV of **approved** tickets, **one row per day** - ticket number,
employee, company, request type, date, day kind, part / missing, time in, time out, break, hours, approved at, approver.
Filter by company and period (e.g. 1-15 Nov). It reuses the report / CSV path; a scheduled export to the payroll
system is later (D13).

## §5 Clashes and changes
| Area | What changes |
|---|---|
| Field types | New type key `multi_date` (label "Dates"); fix `daterange` / `date_range` naming at the same time (one name + alias) |
| **Plans** (`PLAN_FEATURE_TIERS` + `src/config/plans.js`) | D2 - must change both or `check:api-contract` fails |
| Template library | A Leave template using `multi_date` must be usable by Basic (D2) |
| **Holiday types** (v10.1) | `companyHolidayDays` treats every `country_holidays.type` as a day off. A **special working day** (PH) is a working day → add a `is_working_day` rule per type (D6) before counts are trusted |
| Rest days per person | v1 uses the company's country weekend. Shift workers with other rest days need a per-person schedule (D7, later) |
| Conditional routing | Works through `number_value` (total) with the existing `greater_than` etc.; the routing reader must use `number_value` for `multi_date` |
| Reports / CSV | Show the summary text ("Fri 6 Nov, Mon 9 Nov · 4 days"); a numeric "leave days" column from `number_value` |
| Ticket uploader | One cell: `2026-11-06; 2026-11-09 am` (`;` between days, optional `am` / `pm`); the server counts |
| Restricted fields, config transfer | Type-agnostic; pass through |
| Emails / notifications | Use the summary text |
| `time` values (§4b) | No time field type exists today; times live inside the Dates value as `HH:mm` text. A stand-alone `time` field (assessment, 1 Nov) can reuse the same rules |
| Biometric / timekeeping systems | Not integrated: Daloy holds the approved correction, payroll / timekeeping reads the export (D13) |
| Existing `date` / `date_range` fields | Gain the window settings (empty = no limit, so nothing changes for existing fields) |
| Ticket uploader | Rows with days outside the window are refused per row; Enterprise **on behalf** uploads may bypass the window (historic imports) - D10 |
| SLA / escalation | None |
| Apps Script freeze (PLAN_ServerCore §Context.3) | New type = feature work → D8 |
| Postgres schema | `value_json jsonb` + `value_number numeric` on field values (plan it in Neon Phase 0) |

## §6 Out of scope (later)
- **Leave balances** (credits per person per year, deducting the total). The `total` is designed to feed it later.
- Overlap check ("you already have leave on 6 Nov" across tickets).
- Team calendar ("who is off this week").
- Per-person rest days / shifts (D7).

## §7 Open decisions (proposed defaults)
| # | Question | Proposed default |
|---|---|---|
| D1 | Default sandwich rule for a new field | `off` - the company opts in (policies differ; the law doesn't require it) |
| D2 | Plan tier for `multi_date` + the count + sandwich | **All plans** (leave is a core small-company request; the requester one-pager targets Basic). Avoids the `date_range` trap |
| D3 | Half days | On by default, AM / PM |
| D4 | Picking a rest day / holiday | Refused by default; field setting can allow it |
| D5 | Where the count runs before the cloud server exists | Shared pure function; server copy in Apps Script only if D8 allows |
| D6 | Holiday types that are working days | Add a type list with `is_working_day` (PH: `special_working` = working); default all other types = day off |
| D7 | Per-person rest days | Later (needs work schedules) |
| D8 | Build on Apps Script v10.2 or only the cloud server | Ask: leave requests may be needed by the first customers before the cloud server is live |
| D9 | "Next X months" = rolling (today + X months) or whole calendar months (to the end of the X-th month)? | **Rolling**, clamped to month-end (§4a) |
| D10 | Window on returned / resubmitted tickets and on uploads | Only changed days are checked; on-behalf uploads (Enterprise) may bypass |
| D11 | One Dates field with modes (leave / missed_punch / time_entries) or separate field types | **One field with modes** - one calendar, one value shape, one payroll export |
| D12 | Breaks in Manual DTR | Optional minutes per day; the field can hide it when the company deducts a fixed break in payroll |
| D13 | Payroll export | CSV of approved tickets, one row per day, by company + period; scheduled / API export later |
| D14 | May an approver correct a time before approving? | No in v1 - return it to the requester (keeps the requester's statement and the audit trail clean) |

## §8 Tests (when built)
- `countLeaveDays` unit tests: the 9 worked examples + duplicates, unsorted input, a range across months / years,
  a holiday on a weekend (counted once), `non_working_pick` variants, `max_days`.
- Route test: the server recomputes and ignores a client-sent `count`.
- Payroll modes: missing = time_out needs time_out only; both needs both; night shift (21:00 → 06:00) = 9 h minus
  break; today with a future time refused; rest day / holiday kind recorded; export rows = one per day, approved only.
- Window tests: the 3 §4a examples; month-end clamp (31 Jan + 1); company zone at 23:30 Manila = next day vs UTC;
  a returned ticket keeping an out-of-window day; a changed day refused.
- Time zone test (TZ=UTC and Asia/Manila, as v10.1): day strings never shift.
