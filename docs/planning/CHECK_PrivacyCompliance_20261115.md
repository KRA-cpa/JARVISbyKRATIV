<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: CHECK_PrivacyCompliance_20261115.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Check of every required privacy item under the Philippine Data Privacy Act (RA 10173), its IRR and NPC issuances - status, evidence, owner - EXCEPT the review of the Privacy Policy / DPA / Terms texts | Status: Check done; Claude items done or built (see Status); user items in CHECKLIST_Privacy_UserReview_20261115.md
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "check on after everything - all required privacy things except the review of the privacy statements (policy, data sharing/processing)", "do all items c/o Claude. create checklist doc that i need to review/finalize", "exclude Vercel in any platforms we use", "do we need analytics bg jobs - mention no personal or sensitive info is read or processed"
===============================================================================
-->

# CHECK — Privacy compliance (Philippine Data Privacy Act)

**Scope:** everything the Data Privacy Act, its IRR and the NPC issuances require of KRAtiv / Daloy, **except** the
wording of the Privacy Policy, the DPA and the Terms (reviewed separately by counsel / the DPO). Basis:
`docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md`. Legal references marked *(verify)* need counsel to confirm the
current issuance. **Your items:** `docs/planning/CHECKLIST_Privacy_UserReview_20261115.md`.
**Next check:** before the first paying customer, and at migration step 3.1 (publishing the legal texts).

## §1 Status

✅ done · 🟡 drafted / built, waiting for you, counsel or the deploy · 🔴 open

| # | Requirement | Basis | Status | Evidence | Owner |
|---|---|---|---|---|---|
| 1 | Data Protection Officer designated: name / title, address, appointment | IRR Sec. 26(a); NPC Advisory 2017-01 *(verify)* | 🔴 mailbox only (`KRATIV.dpo@blueknight.xyz`) | privacy plan D2 / D2a | You |
| 2 | Privacy Impact Assessment | IRR Sec. 29; NPC Advisory 2017-03 *(verify)* | 🟡 draft | `docs/planning/PIA_Daloy_20261115.md` | Claude → you / DPO sign |
| 3 | Registration of the processing system with the NPC - assessed | NPC Circular 2022-04 *(verify)* | 🟡 assessed: not required yet (§3) | this doc §3 | You confirm |
| 4 | Privacy Manual / internal privacy and security policies | IRR Sec. 26; NPC "Five Pillars" *(verify)* | 🟡 draft | `docs/guides/MANUAL_Privacy_Security_20261115.md` | Claude → you sign |
| 5 | People with access: confidentiality undertaking, access review, training | IRR Sec. 26(c)-(e) | 🟡 text in the manual §5 | manual §5 | You sign / hold |
| 6 | Personal data breach management: response team, runbook, notification, annual report | DPA Sec. 20(f); NPC Circular 16-03 *(verify)* | 🟡 runbook + provider templates; team named in the manual | `docs/guides/GUIDE_Privacy_BreachResponse.md`, `docs/planning/TEMPLATE_BreachNotice_ProviderIncident_20261115.md`, `scripts/list-signed-in.sh`, `scripts/revoke-sessions.sh` | You confirm the team |
| 7 | Data-subject requests: process, deadline, request log | DPA Sec. 16-18; IRR Sec. 34-37 | 🟡 guide + log table (`privacy_requests`, server) | `docs/guides/GUIDE_Privacy_RightsRequests.md` | Claude ✅ / you run it |
| 8 | Inventory of processing (records of what, where, why, who) | IRR Sec. 26(c); accountability | ✅ updated to the new platform | privacy plan §4 v1.3.0; PIA §2 | - |
| 9 | Notice at collection (sign-in, invitations) | DPA Sec. 16(a)-(b); IRR Sec. 34 | 🟡 sign-in page links Terms + Privacy Policy ✅; invitation emails: link when invites move to the server (Apps Script frozen) | `src/pages/LoginPage.js` | Claude (server) |
| 10 | Notice acknowledged at first sign-in, recorded; organization accepts Terms + DPA, recorded | accountability (DPA Sec. 21); contract | 🟡 see Batch 2 | `PrivacyNoticeGate`, `contract_acceptances` | Claude (deploy with the server) |
| 11 | Access / portability ("Download my data") | DPA Sec. 16(c), 18 | 🟡 see Batch 2 | handler `exportMyData` | Claude (server) |
| 12 | Erasure / blocking (anonymization), customer off-boarding | DPA Sec. 16(e); DPA contract | 🟡 see Batch 2 | handler `anonymizeUser`; `scripts/db-export-company.js`, `scripts/db-delete-company.js`; `docs/guides/GUIDE_DataReturnDeletion_20261115.md` | Claude (server) |
| 13 | Retention: kept only as long as needed; disposal | DPA Sec. 11(e) | 🟡 job built (see Batch 2); Cloud Logging bucket region → Singapore before 3.1 (open) | `scripts/db-retention.js`; privacy plan §5 | Claude / you (periods with counsel) |
| 14 | Proportionality: no data collected without a use | DPA Sec. 11(c) | ✅ `shared_ticket_access_logs.ip_address` never written → dropped from the Postgres schema | migration `0003_privacy` | - |
| 15 | No analytics; providers listed truthfully | DPA Sec. 11, 16 | ✅ Speed Insights + `@firebase/analytics` removed; **Vercel off every provider list** (user decision) | `src/App.js`, `package.json`, `dpa.js` v0.4, `privacy.js`, `site.js`, disclosure v1.0.1 | - |
| 16 | No real personal data outside the listed platforms | accountability; transfers (DPA Sec. 21) | 🔴 previews read the live Apps Script → switch to test data (guide); Neon `dev` holds 303 real rows (migration test) | `docs/guides/GUIDE_Previews_TestData.md`; deletion guide §4.3 | You (set-up) |
| 17 | Platform-admin accounts protected (2-step verification) | IRR Sec. 28 (technical measures) | 🔴 unknown | PlatformManager §3 | You |
| 18 | Technical measures in place | IRR Sec. 28 | ✅ Google sign-in verified on the server; invite allow-list; admin / platform-only routes; 12 h cap + 60 min idle sign-out + forced sign-out; Restricted tickets / fields + masking; audit logs; HTTPS; secrets in Secret Manager; data at rest encrypted by Google / Neon | `api/_lib/proxyCore.js`, PLAN_v10.0, `GUIDE_Deploy_CloudRun_FirebaseHosting.md` §H | - |
| 19 | Breach notices to customer organizations (processor duty) + history | DPA Sec. 20(f); DPA contract | ✅ templates A / B / B2 / P / PE, banner, Admin → Security Notices | breach template v1.4.0 | - |
| 20 | Data sharing agreements | NPC Circular 2020-03 *(verify)* | ✅ not needed - no sharing beyond processors / sub-processors | - | - |
| 21 | Analytics and background jobs: no content, no sensitive information | DPA Sec. 11(b)-(c) | ✅ rule §4 (in the manual and the PIA) | this doc §4 | - |

## §2 What changed in this check (15 Nov 2026)
- **Vercel is not a Daloy platform** (user): no Vercel service in the app, no Vercel entry in the DPA Annex C, the
  Privacy Policy providers, `/status` or the data-location disclosure. Vercel only hosts internal preview builds,
  which must run on test data (#16).
- **No consent checkbox for users** (the organization is the controller of its users' data; the basis is the
  contract and legitimate interest - consent from an employee is not freely given). Users get the notice and
  acknowledge it at first sign-in; organization admins accept the Terms and DPA for the organization. Both recorded.
- Sign-in page: "By signing in, you agree to our Terms of Service and acknowledge our Privacy Policy" (both linked).

## §3 NPC registration - assessment
NPC Circular 2022-04 *(verify)* requires a PIC or PIP to register its data processing systems when it (a) employs
**250 or more** people, (b) processes the sensitive personal information of **1,000 or more** individuals, or (c)
its processing is likely to pose a risk to the rights and freedoms of data subjects.
- (a) no: KRAtiv has far fewer than 250 employees.
- (b) not yet: no paying customers (user, 15 Nov 2026); the 303 migration test rows are not 1,000 individuals'
  sensitive information. A customer that puts sensitive information (health in leave requests, government IDs) into
  Restricted tickets counts toward this.
- (c) arguable later: a processor of many employers' HR / approval data. Reassess with counsel.
- **Assessment: registration not required today.** Recheck at the first paying customer, when Restricted tickets of
  all customers reach about 1,000 individuals, and yearly. Even unregistered, the DPO, PIA, manual, breach and
  rights duties still apply (they are in this check).

## §4 Analytics and background jobs - the rule
User, 15 Nov 2026: "do we need analytics bg jobs - mention no personal or sensitive info is read or processed".
- **Web / product analytics: none.** No analytics SDK, cookie or tracking pixel (removed: Vercel Speed Insights,
  `@firebase/analytics`). Adding one needs a new check.
- **Jobs we do need:** usage counts for plans and statements (tickets per month, monthly active users - Platform
  manager PM2); performance figures (p95, query counts) from the request logs; the retention clean-up
  (`scripts/db-retention.js`).
- **Rule for those jobs:** they read only record ids, statuses and timestamps - **never** ticket titles or content,
  custom-field values, comments, attachments, names, email addresses or Restricted tickets / fields - and keep
  **totals only** (per organization per month); performance figures drop `user_id` before aggregating; no per-person
  result leaves the job.
- **Wording for documents:** "Usage and performance figures are counts. They are computed from record ids and
  timestamps only; no ticket content and no sensitive personal information is read, and the results identify no
  one." (Not "no personal information at all": counting monthly active users reads which account signed in - an
  id is personal data. The sentence above stays true.)
- **Not analytics:** SLA escalation and the email outbox read tickets to notify the people working on them - that is
  the service itself, described as such.
