<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: DESIGN_MultiDateField_LeaveDays_20261101.md | Author: Kenneth R. Advento | Version: 2.0.1
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Design of the "Dates" custom field (multiple separate dates, with a day count) for payroll-type requests - leave, non-punching authorization and Manual DTR (time in / out per day) - and the selection window for date-type fields | Status: Design - for review; decisions D2-D14 open; not built
REVISION HISTORY:
- v2.0.1 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Export: the ticket's other fields as columns (e.g. Type of overtime - a plain dropdown field; no special subtype concept)
- v2.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User: "no sandwich detection, just count the number of days if multiple dates (not date range)... just count dates and report it"; calendar treatment left to the designer: rest days / holidays marked, not pickable in leave mode by default, never change the count. Removed: sandwich rule, count function, worked examples, D1, D5. Templates moved to TEMPLATES_PayrollRequests_20261101.md
- v1.5.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Scope line (user): payroll rules / pay computation are out of scope; the sandwich detection + leave-day count stay (an extension of the date field). Removed from Manual DTR: breaks, hours worked, total hours; export carries raw times only; D12 closed
- v1.4.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §4b payroll request modes: non-punching authorization (no time in / no time out / both) and Manual DTR (user); `time` values; payroll export; D11-D14
- v1.3.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Window is for PAYROLL-type requests, not "HR" (user correction); template renamed; later option: back limit = last payroll cut-off
- v1.2.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Window = the calendar only SHOWS the allowed days and months (user: "make calendar selection limited, dont greyout") - no disabled days
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §4a selection window (user: "for HR type request, limit calendar selection to next x months") for every date-type field; D9-D10
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "design multiple dates. holiday can be sandwiched or rest day/weekend sandwiched by leaves"
===============================================================================
-->

# DESIGN — "Dates" field (multiple dates + day count) for payroll-type requests: leave, non-punching, Manual DTR

## Context
Field types today: text, paragraph, date, date range (Advanced, and its name differs between the form builder
`daterange` and the server `date_range` - see the field-type assessment, 1 Nov 2026), amount, dropdown. There is no
way to pick **several separate days** (Mon, Wed, Fri) or **half days**, and no time field.

**Scope line (user, 1 Nov 2026):** Daloy captures, checks and routes the request. **Payroll and leave rules are out of
scope** - sandwich rules, hours worked, breaks, premiums, deductions, leave balances. The Dates field only **counts the
dates chosen and reports the count**. The count is for the Dates field only, **not for date range fields**.

The request templates built on this field: `docs/design/TEMPLATES_PayrollRequests_20261101.md`.

## §1 What the requester sees
```
Leave dates *
 ┌──────────── November 2026 ────────────┐
 │ Su  Mo  Tu  We  Th  Fr  Sa             │   tap a day = whole day
 │  1   2   3   4   5  [6]  7             │   tap again = AM → PM → off (if half days are on)
 │  8  [9] 10  11  12  13  14             │   rest days in lighter text, holidays with a dot + name
 │ ...                                    │
 └────────────────────────────────────────┘
 Fri 6 Nov · Mon 9 Nov — 2 days
 Leave can be filed from 2 Oct 2026 to 1 Feb 2027.
```
- A **calendar** (month view) with the company's rest days and holidays **marked for information** (v10.1 country
  calendar + company holidays). The marks never change the count.
- **Tap** a day = whole day; tap again = **AM** half, again = **PM** half, again = removed (half days: D3).
- Under the calendar: the chosen dates and the **count** ("2 days", "2.5 days"). The same line is shown to approvers,
  in emails, on the ticket and in reports.
- The calendar **only shows the selection window** (§4a): it pages only between the first and last allowed months,
  and days outside the window are not drawn (no greyed / disabled days).

### Rest days and holidays (designer's call - user: "bahala ka na")
| Mode | Can a rest day / holiday be picked? | Why |
|---|---|---|
| `leave` | **No** by default (not tappable; the field setting `non_working_pick` can allow it) | Leave on a day off is almost always a mistake; refusing it keeps the count meaningful without any counting rules |
| `missed_punch`, `time_entries` | **Yes** | People do work rest days and holidays |

- The **count is always the number of chosen dates** (half day = 0.5). Rest days / holidays are never added or
  subtracted.
- The value records each date's **calendar kind** (`working` / `rest_day` / `holiday`) as a fact for the reader
  (approver, payroll). Daloy draws no conclusion from it.

## §2 The value
Stored per ticket field (Sheets: `custom_field_values.text_value` as JSON; Postgres: `jsonb`). The **count** goes in
`number_value`, so reports, sorting and **conditional routing** ("more than 5 days → second approver") work with the
existing numeric comparison.
```json
{ "v": 1, "mode": "leave",
  "entries": [ { "date": "2026-11-06", "part": "full", "day_kind": "working" },
               { "date": "2026-11-09", "part": "am",   "day_kind": "working" } ],
  "count": 1.5 }
```
- `date` = a calendar day `yyyy-MM-dd` in the **company's** calendar, **no time, no zone conversion** (compliance F3 v3).
  Never stored as a Sheets Date cell (avoids the midnight / zone shift).
- `part` = `full` | `am` | `pm` (leave mode only).
- `count` = Σ (`full` = 1, `am` / `pm` = 0.5) in leave mode; the number of dates in the other modes. **The server
  recomputes it on submit** and ignores a count sent by the browser.
- `day_kind` = from the company calendar at submit time (a snapshot; a later holiday change doesn't rewrite it).

## §3 (removed in v2.0)
The sandwich rule and the leave-day count function were removed (user, 1 Nov 2026). The count is §2's plain sum.

## §4 Field settings (form builder)
| Setting | Values | Default |
|---|---|---|
| Label, required, help text | as other fields | – |
| `mode` | `leave` / `missed_punch` / `time_entries` (§4b) | `leave` |
| `half_days` (leave mode) | on / off | on (D3) |
| `non_working_pick` (leave mode) | `refuse` / `allow` | `refuse` (D4) |
| `max_days` | number or empty | empty |
| `count_label` | text | "days" |
| Window `months_ahead` / `days_back` | §4a | none |

## §4a Selection window (all date-type fields)
For **payroll-type requests** - anything that changes pay for a day: leave, overtime, undertime, schedule / shift
changes, official business, non-punching, Manual DTR - the company limits **how far ahead** (and how far back) a day
can be picked, so requests land in a payroll period that is still open. One setting pair on **every date-type
field** - `date`, `date_range` (both ends) and `multi_date` (every day):

| Setting | Values | Default (new field) |
|---|---|---|
| `months_ahead` | 0-24, or empty = no limit | empty |
| `days_back` | 0-365, or empty = no limit | empty |

(Per-template values: `TEMPLATES_PayrollRequests_20261101.md`.)

**Rules**
- "Today" = the day in the **company's** time zone (v10.1 `companyClock`), not the browser's or the server's.
- `months_ahead` is **rolling**: the last allowed day = today + N months, same day of month, clamped to the month's
  last day (31 Jan + 1 month → 28 Feb; 1 Nov 2026 + 3 → 1 Feb 2027) (D9). 0 = today is the last day.
- `days_back` = 0 means "today or later"; the first allowed day = today − N days.
- **The calendar shows only the window** (user decision): months outside it can't be reached, and days outside it in
  the first / last month are left blank - never greyed or disabled.
- **The server still checks** the window on submit (API, uploader, a tab opened yesterday): a one-line refusal,
  *"Leave dates: pick days from 2 Oct 2026 to 1 Feb 2027."*
- **When it's checked:** on create, and on edit / resubmit **only for days that changed** (D10).
- `max_days` and the window are separate: the window limits *which* days, `max_days` limits *how many*.
- **Later option (payroll cut-off):** the back limit = the start of the **first open payroll period** (needs a
  company payroll calendar; semi-monthly 1-15 / 16-end is the PH norm). Not in v1.

**Worked examples** (today = Sun 1 Nov 2026, company zone Asia/Manila)
| Field | Window | Allowed |
|---|---|---|
| Leave dates (`multi_date`) | 3 months ahead, 30 days back | 2 Oct 2026 - 1 Feb 2027 |
| Vacation (`date_range`) | 3 ahead, 0 back | 1 Nov 2026 - 1 Feb 2027 (both ends) |
| Missed punch (`multi_date`, `missed_punch`) | 0 ahead, 15 back | 17 Oct - 1 Nov 2026 |

## §4b Modes: leave, non-punching authorization, Manual DTR
Payroll requests all pick **days**, and two of them need **times per day**. Today's fields hold one value each, so a
Manual DTR (several days, each with its own time in / out) can't be built from them. The Dates field gets a **mode**
(D11): one calendar, one value shape, one export.

| Mode | Request | Per chosen date | Count |
|---|---|---|---|
| `leave` | Leave (vacation, sick, emergency...) | `part`: full / am / pm | Σ days (half = 0.5) |
| `missed_punch` | **Non-punching authorization** | `missing`: **time_in** / **time_out** / **both** + the actual time(s) for what was missed | number of dates |
| `time_entries` | **Manual DTR** | `time_in`, `time_out` (both required) | number of dates |

**Requester view**
```
Non-punching authorization                     Manual DTR
Date(s) *   [calendar - window §4a]            Dates *   [calendar - window §4a]
 Tue 27 Oct  Missing: (•) Time in               Mon 26 Oct  In [08:02]  Out [17:10]
                      ( ) Time out              Tue 27 Oct  In [21:00]  Out [06:00]  (out next day)
                      ( ) Both                  — 2 days
             Actual time in [07:55]
 — 1 day
Reason * [Biometric not working ▾]             Reason * [Field work ▾]
Proof (link) [ ... ]                           Proof (link) [ ... ]
```
- Each date picked gets its own row; removing the date removes the row.
- **Times** are wall-clock `HH:mm` in the **company's** zone, no conversion. An out-time earlier than the in-time is
  flagged **next day** (night shift).
- **No hours, breaks or durations** are computed - the times are carried as the requester states them.

**Value**
```json
{ "v": 1, "mode": "time_entries",
  "entries": [
    { "date": "2026-10-26", "time_in": "08:02", "time_out": "17:10", "day_kind": "working" },
    { "date": "2026-10-27", "time_in": "21:00", "time_out": "06:00", "next_day_out": true, "day_kind": "working" } ],
  "count": 2 }
```
`missed_punch` entries: `{ "date", "missing": "time_in" | "time_out" | "both", "time_in"?, "time_out"?, "day_kind" }`.

**Server checks (on submit)**
- Every date is inside the window (§4a); no duplicate dates; `max_days` if set.
- Leave mode: no rest day / holiday unless `non_working_pick` = `allow`.
- A date that is **today**: times must not be later than the current company time.
- `missed_punch`: the time(s) for what is missing are required. `time_entries`: both times, valid `HH:mm`, in ≠ out.

**Export:** a CSV of **approved** tickets, **one row per date** - ticket number, employee, company, request type,
date, day kind, part / missing, time in, time out, next-day flag, approved at, approver, the ticket's count, and the
ticket's **other fields as columns** (e.g. *Type of overtime*, *Type of leave* - ordinary dropdown fields).
Filter by company and period (e.g. 1-15 Nov). Raw facts only; payroll / HR systems apply their own rules (D13).

## §5 Clashes and changes
| Area | What changes |
|---|---|
| Field types | New type key `multi_date` (label "Dates"); fix `daterange` / `date_range` naming at the same time (one name + alias) |
| **Plans** (`PLAN_FEATURE_TIERS` + `src/config/plans.js`) | D2 - must change both or `check:api-contract` fails |
| Template library | The payroll pack comes with Basic+ and up (PLAN_PlanTiers U9 / §2b); `multi_date` must be available from Basic+ at least (D2) |
| **Holiday types** (v10.1) | `companyHolidayDays` treats every holiday type as a day off. A PH **special working day** is a working day → a type list with `is_working_day` (D6), so `day_kind` and the leave-mode pick rule are right |
| Rest days per person | v1 uses the company's country weekend; per-person schedules later (D7) |
| Conditional routing | Uses `number_value` (the count) with the existing `greater_than` etc.; the routing reader must read `number_value` for `multi_date` |
| Reports / CSV | Summary text ("Fri 6 Nov, Mon 9 Nov (AM) · 1.5 days"); a numeric count column; the per-date export (§4b) |
| Ticket uploader | One cell: `2026-11-06; 2026-11-09 am` (`;` between dates, optional `am` / `pm`); times as `2026-10-27 21:00-06:00`; rows outside the window refused (on-behalf uploads may bypass, D10) |
| Restricted fields, config transfer | Type-agnostic; pass through |
| Emails / notifications | Use the summary text |
| `time` values | No time field type exists today; times live inside the Dates value as `HH:mm`. A stand-alone `time` field (needed by some templates) reuses the same rules |
| Biometric / timekeeping, payroll | Not integrated: they read the export (D13) |
| Existing `date` / `date_range` fields | Gain the window settings (empty = no limit, nothing changes); no count |
| SLA / escalation | None |
| Apps Script freeze (PLAN_ServerCore §Context.3) | New type = feature work → D8 |
| Postgres schema | `value_json jsonb` + `value_number numeric` on field values (Neon Phase 0) |

## §6 Out of scope
- **Payroll and leave rules:** sandwich rules, hours, breaks, premiums, deductions, leave balances.
- Later: overlap check across tickets ("you already filed 6 Nov"), team "who's off" calendar, per-person rest days (D7).

## §7 Open decisions (proposed defaults)
| # | Question | Proposed default |
|---|---|---|
| D2 | Plan tier for `multi_date` (and `time`) | **All plans** (leave / DTR are core small-company requests; the requester one-pager targets Basic). Avoids the `date_range` trap |
| D3 | Half days in leave mode | On by default, AM / PM |
| D4 | Picking a rest day / holiday in leave mode | Refused by default; field setting can allow it |
| D6 | Holiday types that are working days | Type list with `is_working_day` (PH: special working day = working) |
| D7 | Per-person rest days | Later (needs work schedules) |
| D8 | Build on Apps Script v10.2 or only the cloud server | Ask: these requests may be needed by the first customers before the cloud server is live |
| D9 | "Next X months" rolling or to the end of the X-th month | **Rolling**, clamped to month-end |
| D10 | Window on resubmitted tickets and uploads | Only changed dates are checked; on-behalf uploads (Enterprise) may bypass |
| D11 | One Dates field with modes, or separate field types | **One field with modes** |
| D12 | ~~Breaks in Manual DTR~~ | **Closed:** out of scope |
| D13 | Export | CSV of approved tickets, one row per date, by company + period; scheduled / API export later |
| D14 | May an approver correct a time before approving? | No in v1 - return it to the requester |

## §8 Tests (when built)
- Count: full + AM + PM = 2; three dates in missed_punch = 3; duplicates refused; unsorted input sorted; the
  browser-sent count is ignored.
- Leave mode: a holiday / rest day refused by default, allowed with `non_working_pick` = `allow`, count unchanged
  either way.
- Modes: missing = time_out needs time_out only; both needs both; 21:00 → 06:00 flagged next day; today with a
  future time refused; `day_kind` recorded; no durations computed anywhere.
- Window: the §4a examples; month-end clamp (31 Jan + 1); 23:30 Manila = next day vs UTC; a resubmitted ticket keeping
  an out-of-window date; a changed date refused.
- Time zones (TZ=UTC and Asia/Manila, as v10.1): day strings never shift.
- Export: one row per date, approved tickets only.
