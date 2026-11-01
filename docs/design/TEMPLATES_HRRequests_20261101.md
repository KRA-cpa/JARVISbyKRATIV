<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TEMPLATES_HRRequests_20261101.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: HR pack - request templates for the owner template library (PLAN_PlanTiers §2a), starting with the Certificate of Employment (CoE) request | Status: Draft for review; H1-H5 open; not seeded
REVISION HISTORY:
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Routing (user): Compensation / Company Benefit → Payroll → HR; others → HR (1 or 2 levels). "Company Housing Plan" → "Company Benefit". Basic shape = two types (CE + CB), Advanced shape = one type with conditions; H6
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "HR Pack - Certificate of employment requests" (CoE type list from the user's current system screenshot)
===============================================================================
-->

# TEMPLATES — HR pack (template library basis)

## Context
The **HR pack** groups HR service requests for the owner template library, next to the payroll pack
(`docs/design/TEMPLATES_PayrollRequests_20261101.md`). The **conventions** of the payroll pack §1 apply here too
(private visibility, Employee role creates, ≤ 3 steps, comments required on return / reject / cancel, link
attachments, no conditions in base templates so Basic can adopt them, `CODE-YYYY-########` numbers).

Field types used here all exist today (`dropdown`, `text`, `paragraph`, `date`) - **nothing new to build** for CE.

## §1 Certificate of Employment requests
CoE types are taken from the user's current system (screenshot, 1 Nov 2026); *Company Housing Plan* is generalised to
**Company Benefit** (user: housing plan is too specific).

**Routing (user, 1 Nov 2026)**
| CoE type | Route |
|---|---|
| CoE with Compensation · CoE for Company Benefit | **Payroll → HR** |
| Certificate of Employment · with Job Description · with Good Moral · with Approved Leave · for Correction of Name | **HR**, optionally a second level **HR → HR Head** |

Routing by the CoE type needs **conditional routing (Advanced)**, and Basic can't delete steps or change dropdown
options (PLAN_PlanTiers §2a light edits). So the library ships the same request in two shapes:

| Shape | For | Ticket types |
|---|---|---|
| **A. Two types** (base, no conditions) | **Basic** and up | **CE** - Certificate of Employment (5 types) and **CB** - CoE with Compensation / Benefit (2 types) |
| **B. One type with conditions** | **Advanced** and up | **CE** with all 7 types; the Payroll step runs only for Compensation / Company Benefit |

Both shapes route exactly as the table above. The requester sees two tiles in shape A ("Certificate of Employment",
"CoE with Compensation / Benefit") and one in shape B.

### Fields (shared by CE and CB)
| Field | Label | Type | Req. | Options / settings |
|---|---|---|---|---|
| `coe_type` | CoE type | dropdown | ✓ | **CE (shape A):** Certificate of Employment · CoE with Job Description · CoE with Good Moral · CoE with Approved Leave · CoE for Correction of Name. **CB (shape A):** CoE with Compensation · CoE for Company Benefit. **Shape B:** all seven |
| `requirement_for` | Requirement for | text | ✓ | purpose, e.g. bank loan, visa application, Pag-IBIG housing loan, school enrollment (H2) |
| `benefit` | Company benefit | text | – | CB / shape B: which benefit, e.g. housing plan, car plan, salary loan |
| `addressed_to` | Addressed to | text | – | blank = "To whom it may concern" |
| `needed_by` | Needed by | date | ✓ | window **1 / 0** (today up to 1 month ahead) |
| `copies` | Copies | dropdown | ✓ | Soft copy (PDF) only · 1 printed · 2 printed · 3 printed |
| `related_request` | Related request number | text | – | CE: for *CoE with Approved Leave* (e.g. LV-2026-00000118) |
| `correct_name` | Correct name (as on ID) | text | – | CE: for *CoE for Correction of Name* |
| `notes` | Other details | paragraph | – | e.g. salary breakdown needed, embassy format |

In shape A each type shows only its own fields (CE hides `benefit`; CB hides `related_request` and `correct_name` -
`is_hidden`, a Basic light edit). Shape B shows all of them with help text (H3).

### Steps
| Type | Steps | Library variants (H6) |
|---|---|---|
| **CE** (shape A) | **1. HR** → **2. HR Head** | *CE - HR only* (1 level) · *CE - HR → HR Head* (2 levels) |
| **CB** (shape A) | **1. Payroll** → **2. HR** | one variant |
| **CE** (shape B, Advanced) | **1. Payroll** *(only when CoE type = Compensation or Company Benefit)* → **2. HR** → **3. HR Head** *(2-level variant; only when not Compensation / Benefit)* | *1 level* / *2 levels* |

**Done:** HR adds the signed PDF as a **link** on the ticket at its last step and completes it; the requester is
notified (bell, email per the company's settings). Printed copies: the completion comment says where to pick them up.

**Variants**
| Variant | Plan | What changes |
|---|---|---|
| Restricted for compensation / benefit | Enterprise (`restricted`) | `confidential_mode` on **CB** (or on shape B): pay and benefit details visible only to the requester and the chain |
| Soft copy only | – | Companies that never print hide `copies` (Basic light edit) |

**Privacy note:** CoE with Compensation puts salary on a ticket. On Basic / Advanced the type stays `private`
(requester, the people on the ticket, the step roles, admins); the Restricted variant narrows it further. A side
effect of shape A: compensation requests are a **separate ticket type**, so their visibility can be set apart from
plain CoEs. The PDF lives wherever HR stores it (a link), not in Daloy.

## §2 Summary
| Code | Template | Shape | New field types | Window | Steps | Min plan |
|---|---|---|---|---|---|---|
| CE | Certificate of Employment | A | none | needed by 1 / 0 | HR (→ HR Head) | Basic |
| CB | CoE with Compensation / Company Benefit | A | none | needed by 1 / 0 | Payroll → HR | Basic (Restricted: Enterprise) |
| CE | Certificate of Employment (all 7 types, conditional) | B | none | needed by 1 / 0 | Payroll if comp / benefit → HR (→ HR Head) | Advanced |

*(More HR pack templates - e.g. ID replacement, employee data update, 201 file request, clearance - can be added here.)*

## §3 Open decisions
| # | Question | Proposed default |
|---|---|---|
| H1 | Does the HR pack count as one adoption slot on Basic (like the payroll pack, payroll T1)? | Yes - one slot per pack |
| H2 | *Requirement for*: free text (as in the current system) or a dropdown (Bank / loan · Visa / travel · Pag-IBIG / SSS / government · New employment · School · Other)? | **Text** for v1 (matches the current system; a dropdown + "Other" needs conditional fields to ask "specify") |
| H3 | Conditional fields (show *Correct name* only for *Correction of Name*) | Not available today (only dependent dropdown options, Advanced) - help text instead; a "show field when" setting is a candidate feature |
| H4 | Who signs: HR Head role, or a named signatory per CoE type? | HR Head role; companies map it to the signatory (CB: the HR step signs) |
| H5 | Who sees *CoE with Compensation* tickets on Basic / Advanced | Private visibility as above; recommend the Restricted variant to Enterprise customers |
| H6 | 1 vs 2 HR levels: Basic can't delete steps | Ship **both** CE variants in the library (*HR only*, *HR → HR Head*); the company picks at adoption. (Alternative: managed setup by the platform team removes the step) |
