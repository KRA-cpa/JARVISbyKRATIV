<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: DESIGN_MultiDateField_LeaveDays_20261101.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Design of the "Dates" custom field (multiple dates, half days) and the leave-day count with the sandwich rule (rest days / holidays between leave days) | Status: Design - for review; decisions D1-D8 open; not built
REVISION HISTORY:
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "design multiple dates. holiday can be sandwiched or rest day/weekend sandwiched by leaves"
===============================================================================
-->

# DESIGN — "Dates" field (multiple dates) + leave-day count with the sandwich rule

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
| `allow_past` | yes / no | yes (sick leave is filed after) |
| `count_label` | text | "Leave days" |

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

## §8 Tests (when built)
- `countLeaveDays` unit tests: the 9 worked examples + duplicates, unsorted input, a range across months / years,
  a holiday on a weekend (counted once), `non_working_pick` variants, `max_days`.
- Route test: the server recomputes and ignores a client-sent `count`.
- Time zone test (TZ=UTC and Asia/Manila, as v10.1): day strings never shift.
