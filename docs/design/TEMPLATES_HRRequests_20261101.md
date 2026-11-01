<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TEMPLATES_HRRequests_20261101.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: HR pack - request templates for the owner template library (PLAN_PlanTiers §2a), starting with the Certificate of Employment (CoE) request | Status: Draft for review; H1-H5 open; not seeded
REVISION HISTORY:
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

## §1 CE — Certificate of Employment request
CoE types are taken from the user's current system (screenshot, 1 Nov 2026).

| Field | Label | Type | Req. | Options / settings |
|---|---|---|---|---|
| `coe_type` | CoE type | dropdown | ✓ | Certificate of Employment · CoE with Compensation · CoE for Company Housing Plan · CoE with Job Description · CoE with Good Moral · CoE with Approved Leave · CoE for Correction of Name |
| `requirement_for` | Requirement for | text | ✓ | purpose, e.g. bank loan, visa application, Pag-IBIG housing loan, new school enrollment (H2) |
| `addressed_to` | Addressed to | text | – | blank = "To whom it may concern" |
| `needed_by` | Needed by | date | ✓ | window **1 / 0** (today up to 1 month ahead) |
| `copies` | Copies | dropdown | ✓ | Soft copy (PDF) only · 1 printed · 2 printed · 3 printed |
| `related_request` | Related request number | text | – | for *CoE with Approved Leave*: the leave ticket (e.g. LV-2026-00000118) |
| `correct_name` | Correct name (as on ID) | text | – | for *CoE for Correction of Name* |
| `notes` | Other details | paragraph | – | e.g. salary breakdown needed, embassy format |

**Steps:** **1. HR** (prepares the certificate) → **2. HR Head** (signs).
**Done:** HR adds the signed PDF as a **link** on the ticket at the last step and completes it; the requester is
notified (bell, email per the company's settings). Printed copies: the completion comment says where to pick them up.

**Help text on the form** (the base template has no conditional fields, H3):
- *CoE with Approved Leave* → fill **Related request number**.
- *CoE for Correction of Name* → fill **Correct name** and attach a link to the ID / PSA document in **Other details**.

**Variants**
| Variant | Plan | What changes |
|---|---|---|
| Compensation goes through Payroll | Advanced (`conditional_routing`) | Condition *CoE type = CoE with Compensation* → add a **Payroll** step before HR Head (confirms the figures) |
| Restricted for compensation | Enterprise (`restricted`) | `confidential_mode` on the type: pay details visible only to the requester and the chain |
| Requester's own PDF link only | – | Companies that never print drop `copies` (Basic light edit: hide a field) |

**Privacy note:** *CoE with Compensation* puts salary on a ticket. On Basic / Advanced the type stays `private`
(requester, the people on the ticket, the HR roles, admins); the Restricted variant narrows it further. The PDF lives
wherever HR stores it (a link), not in Daloy.

## §2 Summary
| Code | Template | New field types needed | Window | Steps | Min plan |
|---|---|---|---|---|---|
| CE | Certificate of Employment request | none | needed by: 1 / 0 | HR → HR Head | Basic (variants: Advanced / Enterprise) |

*(More HR pack templates - e.g. ID replacement, employee data update, 201 file request, clearance - can be added here.)*

## §3 Open decisions
| # | Question | Proposed default |
|---|---|---|
| H1 | Does the HR pack count as one adoption slot on Basic (like the payroll pack, payroll T1)? | Yes - one slot per pack |
| H2 | *Requirement for*: free text (as in the current system) or a dropdown (Bank / loan · Visa / travel · Pag-IBIG / SSS / government · New employment · School · Other)? | **Text** for v1 (matches the current system; a dropdown + "Other" needs conditional fields to ask "specify") |
| H3 | Conditional fields (show *Correct name* only for *Correction of Name*) | Not available today (only dependent dropdown options, Advanced) - help text instead; a "show field when" setting is a candidate feature |
| H4 | Who signs: HR Head role, or a named signatory per CoE type? | HR Head role; companies map it to the signatory |
| H5 | Who sees *CoE with Compensation* tickets on Basic / Advanced | Private visibility as above; recommend the Restricted variant to Enterprise customers |
