<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TEMPLATES_PayrollRequests_20261101.md | Author: Kenneth R. Advento | Version: 1.2.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Payroll-type request templates - the basis for the owner template library (PLAN_PlanTiers §2a): ticket types, fields, windows, steps, comment rules | Status: Draft for review; T1-T6 open; not seeded
REVISION HISTORY:
- v1.2.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Plans U9: Payroll pack = Basic+ and up (on / off on Advanced / Enterprise); T1 resolved; min plan Basic → Basic+
- v1.1.2 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | T2 corrected: Basic light edits can't change dropdown options
- v1.1.1 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | The OT subtype is just a ticket field (dropdown) - no special "subtype" concept; the export carries the ticket's fields generically (user)
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Rest day / holiday work merged into OT as subtypes (user: "overtime, rest day/holiday work will be subtypes of overtime"); 9 templates
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "create a file for payroll type request, as basis for the ticket template library" + "multi date field can already be incorporated"
===============================================================================
-->

# TEMPLATES — Payroll-type requests (template library basis)

## Context
The owner **template library** (`docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md` §2a) is a company flagged
`is_template_library`; its ticket types, custom fields, workflow steps, comment requirements and dropdowns are the
templates that companies **adopt** (Basic: adopt + light edits).

This file defines the **payroll-type** templates: requests that change pay for a day. It uses the **Dates field**
(`multi_date`, modes `leave` / `missed_punch` / `time_entries`) and the **selection window** from
`docs/design/DESIGN_MultiDateField_LeaveDays_20261101.md`.

**Scope:** Daloy captures, checks, routes and exports the request. Payroll and leave rules (balances, premiums, hours,
deductions) are **out of scope** - payroll reads the approved export.

## §1 Conventions (all templates)
| Item | Value |
|---|---|
| Visibility | `private` (requester + people on the ticket + approvers of the type; admins) |
| Who can create | Every employee role of the company ("Employee") |
| Roles used by steps | **Department Head**, **HR**, **Payroll** - created on adoption if missing; the company assigns people |
| First step | **Department Head** (a role step). The v10.3 *immediate head* switch (`head_approval`, Advanced) can replace it for Advanced+ companies |
| Steps | ≤ 3 per type (Basic / Basic+ `steps_per_type` = 3); approver logic `any` |
| Comment rules | Required on **return**, **reject** and **cancel**; optional on approve |
| Attachments | Links (v9.6 attachment links); `require_attachment_on_create` only where stated |
| Ticket number | `CODE-YYYY-########` (the type's `code`, the year from the company's country calendar) |
| Conditions | **None** in the base templates (keeps `template_min_plan` = Basic+, the lowest plan with the pack). Optional Advanced variants are listed per template |
| Field types | `text`, `paragraph`, `dropdown`, `amount`, `date` exist today. **`multi_date`** (design) and **`time`** (assessment, 1 Nov) are new - see §4 |

Window notation: **`ahead / back`** = `months_ahead` / `days_back` (design §4a). Rolling, company time zone; the
calendar only shows the window.

## §2 The templates
### LV — Leave
| Field | Label | Type | Req. | Settings / options |
|---|---|---|---|---|
| `leave_type` | Type of leave | dropdown | ✓ | Vacation · Sick · Emergency · Bereavement · Maternity · Paternity · Solo parent · Special leave for women · VAWC leave · Service incentive leave · Offset / CTO · Leave without pay · Other |
| `leave_dates` | Leave dates | **multi_date** `leave` | ✓ | half days on; rest days / holidays not pickable; window **3 / 30** |
| `reason` | Reason / note | paragraph | – | |
| `proof` | Supporting document (link) | text | – | e.g. medical certificate |

Steps: **1. Department Head** → **2. HR**. Count shown: "Leave dates · 2.5 days".
*Advanced variant:* condition "count > 5 → add *Senior Manager* step" (`conditional_routing`).
*The leave-type list is a dropdown only: Daloy applies no entitlement rules to it.*

### LC — Leave cancellation
| Field | Label | Type | Req. | Settings |
|---|---|---|---|---|
| `leave_ticket` | Leave request number | text | ✓ | e.g. LV-2026-00000118 |
| `cancel_dates` | Dates to cancel | **multi_date** `leave` | ✓ | half days on; window **3 / 15** |
| `reason` | Reason | paragraph | ✓ | |

Steps: **1. Department Head** → **2. HR**.

### OT — Overtime authorization (regular day, rest day, holiday - via the *Type of overtime* field)
| Field | Label | Type | Req. | Settings / options |
|---|---|---|---|---|
| `ot_type` | Type of overtime | dropdown | ✓ | **Regular day overtime** · **Rest day work** · **Holiday work** · **Rest day + holiday work** |
| `ot_dates` | Dates and times | **multi_date** `time_entries` | ✓ | labels **From / To**; rest days / holidays pickable; window **1 / 7** |
| `reason` | Work to be done | paragraph | ✓ | |

Steps: **1. Department Head** → **2. Payroll**. Filed before the overtime (pre-approval) or up to 7 days after.
- **One type per request** (it is one dropdown field). Overtime on a regular day and work on a rest day are filed as two requests.
- Each date carries its **calendar kind** (design §2). When it doesn't match the *Type of overtime* (e.g. *Rest day work* on a
  date the company calendar marks as a working day), the ticket shows a note to the approver - **not refused**: a
  person's rest day can differ from the company calendar (per-person schedules, design D7).
- *Type of overtime* reaches payroll like every other field (export, below) - what each type pays is payroll's rule.

### UT — Undertime
| Field | Label | Type | Req. | Settings |
|---|---|---|---|---|
| `ut_date` | Date | date | ✓ | window **1 / 7** |
| `leave_at` | Leaving at | **time** | ✓ | |
| `reason` | Reason | paragraph | ✓ | |

Steps: **1. Department Head** → **2. HR**.

### OB — Official business / field work
| Field | Label | Type | Req. | Settings |
|---|---|---|---|---|
| `ob_dates` | Dates and times | **multi_date** `time_entries` | ✓ | labels **From / To**; window **1 / 15** |
| `location` | Where | text | ✓ | client / site |
| `purpose` | Purpose | paragraph | ✓ | |

Steps: **1. Department Head** → **2. HR**.

### CS — Change of schedule / shift
| Field | Label | Type | Req. | Settings |
|---|---|---|---|---|
| `new_schedule` | New schedule per date | **multi_date** `time_entries` | ✓ | labels **Start / End**; window **1 / 0** (today or later) |
| `reason` | Reason | paragraph | ✓ | |

Steps: **1. Department Head** → **2. HR**.

### NP — Non-punching authorization
| Field | Label | Type | Req. | Settings |
|---|---|---|---|---|
| `np_dates` | Date(s) | **multi_date** `missed_punch` | ✓ | per date: missing **time in / time out / both** + actual time(s); window **0 / 15** |
| `np_reason` | Reason | dropdown | ✓ | Biometric not working · Forgot to punch · Field work · Power / system outage · Other |
| `details` | Details | paragraph | – | |
| `proof` | Proof (link) | text | – | photo, gate log, client sign-off |

Steps: **1. Department Head** → **2. HR**.

### MD — Manual DTR
| Field | Label | Type | Req. | Settings |
|---|---|---|---|---|
| `dtr_dates` | Dates and times | **multi_date** `time_entries` | ✓ | labels **Time in / Time out**; window **0 / 15** |
| `md_reason` | Reason | dropdown | ✓ | No biometric at site · Field work · System outage · New hire (not enrolled) · Other |
| `proof` | Proof (link) | text | ✓ | `require_attachment_on_create` off; the link field is required instead |

Steps: **1. Department Head** → **2. HR** → **3. Payroll**.

### PC — Payroll concern
| Field | Label | Type | Req. | Settings |
|---|---|---|---|---|
| `pay_period` | Pay period | dropdown | ✓ | the company's periods, e.g. "1-15 Nov 2026" (list kept by Payroll) |
| `concern` | Concern | dropdown | ✓ | Missing pay · Wrong deduction · Overtime not paid · Leave not credited · Allowance · Tax / contributions · Other |
| `amount` | Amount in question (PHP) | amount | – | |
| `details` | Details | paragraph | ✓ | |
| `proof` | Supporting document (link) | text | – | payslip, approved ticket number |

Steps: **1. Payroll** → **2. HR**.
*Enterprise variant:* `confidential_mode` (Restricted ticket) - pay details visible only to the chain.

## §3 Summary
| Code | Template | Dates field mode | Window | Steps | Min plan |
|---|---|---|---|---|---|
| LV | Leave | `leave` | 3 / 30 | Head → HR | Basic+ |
| LC | Leave cancellation | `leave` | 3 / 15 | Head → HR | Basic+ |
| OT | Overtime authorization (regular day · rest day · holiday · rest day + holiday) | `time_entries` | 1 / 7 | Head → Payroll | Basic+ |
| UT | Undertime | – (`date` + `time`) | 1 / 7 | Head → HR | Basic+ |
| OB | Official business | `time_entries` | 1 / 15 | Head → HR | Basic+ |
| CS | Change of schedule | `time_entries` | 1 / 0 | Head → HR | Basic+ |
| NP | Non-punching authorization | `missed_punch` | 0 / 15 | Head → HR | Basic+ |
| MD | Manual DTR | `time_entries` | 0 / 15 | Head → HR → Payroll | Basic+ |
| PC | Payroll concern | – | – | Payroll → HR | Basic+ (Restricted variant: Enterprise) |

Export: every template with a Dates field appears in the per-date payroll export (design §4b), approved tickets only.
The export carries the ticket's **other fields as columns** (e.g. *Type of overtime*, *Type of leave*, *Reason*) - no special subtype handling.

## §4 Dependencies and clashes
| Item | Status | Needed by |
|---|---|---|
| `multi_date` field + modes + count | Designed, not built | LV, LC, OT, OB, CS, NP, MD |
| `time` field (stand-alone) | Proposed (assessment), not built | UT |
| Selection window on date fields | Designed, not built | all except PC |
| Template library (`is_template_library`, `adoptTemplate`, `template_min_plan`) | v10.2 plan §2a - not built (P1 built: catalogue, gate, limits) | all |
| Holiday types with `is_working_day` (design D6) | Not built | LV (pick rule), the `day_kind` in exports |
| Plans | U9 (PLAN_PlanTiers §2b) | Payroll pack = Basic+ and up; min plan of the base templates = **Basic+** |
| Basic `steps_per_type` = 3 | v10.2 | MD uses exactly 3 |
| `head_approval` (immediate head) | Advanced, v10.3 | Base templates use the Department Head role instead |
| Pay-period dropdown (PC) | Dropdown kept by the company | A company payroll calendar later could fill it |
| Apps Script freeze | PLAN_ServerCore | Building the new field types → design D8 |

## §5 Open decisions
| # | Question | Proposed default |
|---|---|---|
| T1 | ~~Basic can adopt 5 types; the payroll set is 9~~ | **Resolved by U9 (PLAN_PlanTiers §2b):** the Payroll pack comes with **Basic+**, Advanced and Enterprise (on / off there); pack types don't count toward the `ticket_types` limit; Basic has no packs |
| T2 | Leave-type list | As in LV (PH statutory names + common company leaves). **Correction (1 Nov 2026):** Basic+ can't change dropdown options (light edits refuse dropdown changes, PLAN_PlanTiers §2a) - Basic+ gets the list as shipped (or the platform team edits it in managed setup); Advanced+ edit it themselves |
| T3 | Step 2 = HR or Payroll per template | As in §3; companies with one HR-payroll team map both roles to the same people |
| T4 | Leave cancellation as its own template vs "Cancel" on the leave ticket | Own template (LC) while a ticket can't be partly cancelled; revisit if per-date cancel is added |
| T5 | Proof links required? | Required only for MD; optional elsewhere |
| T6 | Seed format | A seed file in `appscript_files/` (like `SEED_TestData_*`) for the library company now; a JSON fixture for the cloud server later |
