<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: MANUAL_Privacy_Security_20261115.md | Author: Kenneth R. Advento | Version: 0.1 (DRAFT)
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: KRAtiv Solutions' Privacy Manual - the internal privacy and security policies for everyone with access to Daloy's data (Data Privacy Act, IRR Sec. 25-29; NPC guidance) | Status: DRAFT - for the DPO / counsel; adopt by signing §10
REVISION HISTORY:
- v0.1 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Draft by Claude (session 461f9ea9) for the privacy check (CHECK_PrivacyCompliance_20261115.md #4 / #5 / #6)
===============================================================================
-->

# KRAtiv Solutions — Privacy Manual (DRAFT)

> Internal. Applies to every person who can reach Daloy's systems or data: platform admins, staff, contractors.
> `[[...]]` = to confirm. Review yearly with the PIA.

## §1 Purpose and roles
- KRAtiv is a **processor** of its customers' data (tickets, users, profiles) and a **controller** of its own
  (sign-in accounts, security logs, billing contacts, enquiries). Processor data is used **only** on the customer's
  documented instructions (the DPA contract).
- **Data Protection Officer (DPO):** [[name / title]], KRATIV.dpo@blueknight.xyz, [[address]]. Reports to the head of
  KRAtiv. Answers rights requests, runs breach handling, keeps this manual, the PIA and the logs current.
- **Head of KRAtiv Solutions:** Kenneth R. Advento - accountable for compliance; approves this manual.

## §2 Principles everyone follows
1. Use personal data only for the purpose it was collected for (Privacy Policy; DPA contract).
2. Look at customer data **only** with a support grant from the customer, or under break-glass (security incident /
   legal order: owner only, reason recorded, customer told within 24 h unless the law forbids it) -
   PLAN_PlatformManager §5.
3. Never copy customer data to personal devices, personal email, chat tools or AI tools. Exports go to the agreed
   location (outside the code repository) and are deleted when the case closes.
4. Test with **test data**: previews and development use the SEED data (`docs/guides/GUIDE_Previews_TestData.md`).
5. **No analytics on people:** usage and performance figures are counts from ids and timestamps; no ticket content
   or sensitive information is read; results identify no one (CHECK_PrivacyCompliance §4).
6. Secrets live in Secret Manager only - never in chat, command lines or files in the repository.

## §3 Data handling
- **Inventory and retention:** PLAN_PrivacyPolicy_DPA §4 / §5 (kept current). Retention job:
  `scripts/db-retention.js` (dry run, then `--apply`), monthly [[schedule]].
- **Customer off-boarding / return and deletion:** `docs/guides/GUIDE_DataReturnDeletion_20261115.md`.
- **Sensitive information:** only in Restricted ticket types / fields; revealing it is logged.
- **Disposal:** database rows by the retention job or the off-boarding tools; exports deleted from storage and trash;
  provider backups expire on their own schedule (Neon restore window [[7]] days, logs 30 days).

## §4 Access control
- Accounts: Google accounts of KRAtiv's Workspace with **2-step verification on** [[confirm on every platform-admin
  account]]. No shared accounts.
- Least privilege: platform roles `owner` / `billing` / `support` / `viewer` (PlatformManager §3); database access
  only through the server's role, except named maintenance by the owner.
- **Access review: every quarter** the owner lists platform admins, Google Cloud / Neon / Firebase members and
  Secret Manager access, removes what isn't needed, and records the review (date, who, changes).
- Leavers: access removed the same day; their sessions ended (`scripts/revoke-sessions.sh` if needed).

## §5 People: undertaking and training
**Confidentiality undertaking** (signed before access is given; kept by the DPO):
> I, [[name]], will keep confidential all personal data I can reach through my work for KRAtiv Solutions, during and
> after my engagement. I will use it only for my assigned work, follow KRAtiv's Privacy Manual, not copy or disclose
> it except as my work requires and the manual allows, and report any actual or suspected personal data breach to
> the Data Protection Officer immediately. I understand that unauthorized processing or disclosure may be punishable
> under the Data Privacy Act of 2012.
> Signature, date.

**Training:** at joining and yearly - this manual, the breach runbook, the rights guide (about 1 hour); record the
date per person.

## §6 Personal data breach
- **Breach response team:** the DPO (lead), the head of KRAtiv (decisions, notices), [[technical lead]] (containment).
- Runbook: `docs/guides/GUIDE_Privacy_BreachResponse.md`. Provider incidents:
  `docs/planning/TEMPLATE_BreachNotice_ProviderIncident_20261115.md`.
- Anyone who suspects a breach tells the DPO at once - by phone [[number]] and KRATIV.dpo@blueknight.xyz.

## §7 Rights requests
`docs/guides/GUIDE_Privacy_RightsRequests.md`: logged in `privacy_requests`, identity checked, answered within
[[15 working days]]; requests about processor data go to the customer organization, which decides, and KRAtiv helps.

## §8 Providers (sub-processors)
Google LLC and Neon, Inc. (DPA Annex C). Before adding one: a privacy check, the DPA Annex C update and notice to
customers per the DPA. **Vercel is not a provider** of the service (internal previews on test data only).

## §9 Records kept
PIA; this manual (signed); undertakings; training dates; access reviews; incident records; rights-request log;
terms / DPA acceptances and privacy acknowledgements (database); deletion case records.

## §10 Adoption
| Role | Name | Date | Signature |
|---|---|---|---|
| Head of KRAtiv Solutions | Kenneth R. Advento | | |
| Data Protection Officer | [[name]] | | |
