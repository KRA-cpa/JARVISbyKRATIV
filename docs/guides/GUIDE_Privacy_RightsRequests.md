<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_Privacy_RightsRequests.md | Author: Kenneth R. Advento | Version: 0.1 (DRAFT)
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: How KRAtiv handles data-subject requests (to be informed, access, rectification, erasure / blocking, portability, objection, complaints) - DPA Sec. 16-18; IRR Sec. 34-37 | Status: DRAFT - for the DPO / counsel
REVISION HISTORY:
- v0.1 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Draft by Claude (session 461f9ea9) - privacy plan §6; the request log is the `privacy_requests` table (migration 0003)
===============================================================================
-->

# GUIDE — Data-subject rights requests (DRAFT)

## 1. Receive and log (same day)
- Requests arrive at KRATIV.dpo@blueknight.xyz, through support, or from a customer organization.
- Log it in **`privacy_requests`** (Neon; until the server is live, a sheet with the same columns [[where]]):
  `id` (`DSR-YYYY-NNN`), `received_at`, `channel`, `requester_name`, `requester_email`, `user_id` (if known),
  `company_id`, `request_type` (`access` | `portability` | `rectification` | `erasure` | `blocking` | `objection` |
  `information` | `complaint`), `data_role` (`processor` | `controller`), `status` (`received` | `verifying` |
  `forwarded` | `in_progress` | `done` | `refused`), `due_at`, `forwarded_to`, `forwarded_at`, `completed_at`,
  `outcome`, `handled_by`, `notes`.
- **Due:** [[15 working days]] from receipt *(counsel to confirm the current NPC timeline)*.

## 2. Verify identity
- Signed-in request from the account itself, or a reply from the account's email address. Never send data to a
  different address than the account's. Ask for no more proof than needed.

## 3. Whose data is it?
- **Processor data** (tickets, profiles, history in a customer organization): the organization is the controller.
  Forward to its admins within **2 working days** (`forwarded_to`, `forwarded_at`); tell the requester it was
  forwarded and to whom; help the organization answer (exports, corrections, anonymization on its instruction).
- **Controller data** (KRAtiv's: sign-in account, security logs, billing contacts, enquiries): KRAtiv answers.

## 4. Act
| Right | How |
|---|---|
| Information | the Privacy Policy; answer questions in plain words |
| Access / portability | the user's own data: Profile → **Download my data** (`exportMyData`: profile, preferences, own notifications, tickets they requested - JSON). More than that (processor data) on the organization's instruction |
| Rectification | the user edits the profile, or the organization's admin; tickets through the organization's workflow |
| Erasure / blocking | **anonymization**, not row deletion (audit logs stay linked): `anonymizeUser` (organization admin, or the platform owner on the organization's written instruction / for KRAtiv's own data) - name, email, phone become "Deleted user #id"; sign-in disabled. A whole organization: `GUIDE_DataReturnDeletion_20261115.md` |
| Objection | email notifications can be turned off (preferences); no marketing exists to object to |
| Complaint | answer within the same deadline; tell the person they may complain to the National Privacy Commission (privacy.gov.ph) |

## 5. Close
Reply to the requester (what was done, or why refused, and the right to complain to the NPC); set `completed_at`,
`outcome`, `status`. Keep the log entry [[3 years]].

## Refusals
Only when the law allows (e.g. the request is manifestly unfounded or would reveal another person's data) - the DPO
decides and records why.
