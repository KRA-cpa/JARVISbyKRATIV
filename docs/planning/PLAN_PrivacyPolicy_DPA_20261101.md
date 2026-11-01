<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_PrivacyPolicy_DPA_20261101.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Plan for a Privacy Policy (privacy notice) and the supporting compliance work under the Philippine Data Privacy Act of 2012 (RA 10173), its IRR and NPC issuances, for TicketFlow / JARVIS | Status: Draft (session 41700a8e), decisions D1-D10 open, nothing built
REVISION HISTORY:
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created on request ("create plan for Privacy Policy that is PH DPA compliant"); follows docs/planning/PLAN_PlatformWebsite_20261101.md W7 (legal text from the business / counsel)
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | D2: DPO email `jarvis.dpo@blueknight.xyz`; the proposed draft (L2 starting text) is in `src/config/legal/privacy.js`, shown on previews and on the public `/privacy/draft` (marked DRAFT, noindex), production `/privacy` = placeholder + link to it
===============================================================================
-->

# PLAN — Privacy Policy under the Philippine Data Privacy Act

> **Not legal advice.** This plan lists what the policy and the system must cover and maps it to the data this codebase actually holds. The final wording, the role analysis (§2) and the registration question (§7) need sign-off by a Philippine lawyer and/or the appointed Data Protection Officer (DPO). Legal references are given as a checklist; anything marked *(verify)* must be checked against the National Privacy Commission's current issuances before publishing, since NPC circulars are amended and replaced.

## Context
TicketFlow is about to have a public face (`/` and `/plans`, `docs/planning/PLAN_PlatformWebsite_20261101.md`), and it sells plans to companies (v10.2). The legal basis for the privacy work:
- **The law:** the Data Privacy Act of 2012 (**RA 10173**), its Implementing Rules and Regulations (IRR, 2016) and the NPC's circulars and advisories.
- **What it requires:**
  - a **privacy notice** that tells data subjects what is collected, why, on what basis, who receives it, how long it is kept and how to exercise their rights;
  - the **organizational, physical and technical security measures** behind those statements.

The website plan's W7 left a placeholder for `/legal/privacy`; this plan fills it.

A privacy policy only holds if the system does what it says. So this plan has two halves: the **document** (§3–§6) and the **product and organization work** that makes it true (§7–§10).

---

## §1 Decisions needed (defaults proposed)

| # | Question | Proposed default |
|---|---|---|
| D1 | Legal entity that publishes the policy (name, address, TIN / SEC or DTI registration) | The business that owns TicketFlow - **to be supplied** |
| D2 | DPO (name or title, email, address) | **Email decided (1 Nov 2026): `jarvis.dpo@blueknight.xyz`** (a role mailbox). Still open: the DPO's name or title and mailing address; the appointment itself (required for PICs - IRR Sec. 26(a); NPC Advisory 2017-01 on DPO designation *(verify)*) |
| D3 | Customer contracts: TicketFlow as **processor (PIP)** for the companies' ticket data | Yes (§2) - a Data Processing Agreement (DPA-contract) with every customer company, signed with the plan / invoice |
| D4 | NPC registration of the data processing system | Assess against the registration thresholds (§7); register if any applies or if customers require it |
| D5 | Retention periods | §5 table (defaults per category) |
| D6 | Hosting / cross-border | Disclose Google (Sheets, Apps Script, Firebase, Gmail), Vercel; data may be stored outside the Philippines (§4) |
| D7 | Sensitive personal information in tickets (health in leave requests, government IDs, salary) | Allowed only in ticket types the customer marks **Restricted** (v10.0); the customer as PIC owns the lawful basis (DPA Sec. 13) |
| D8 | Minors | Service is for employees / business users 18+; no knowing collection from minors |
| D9 | Analytics / cookies on the public site | None (website plan W9); only the sign-in session storage Firebase needs |
| D10 | Language | English first; Filipino version later if customers ask |

## §2 Roles: who is the Personal Information Controller

| Data | Role of the TicketFlow business | Role of the customer company | Basis (for counsel to confirm) |
|---|---|---|---|
| Website visitors, sign-in accounts (Firebase identity, login logs), platform admin data, billing contacts, invoices, (later) website leads | **Personal Information Controller (PIC)** | - | it decides why and how this data is processed |
| Ticket content, custom field values, workflow history, user profiles (approvers, hire / termination dates), role assignments, notifications sent about tickets, attachment links | **Personal Information Processor (PIP)** acting on the customer's instructions | **PIC** (the employer / organization) | outsourcing arrangement - DPA Sec. 14; IRR Sec. 43-45 on outsourcing and subcontracting *(verify section numbers)* |

The policy states both roles plainly. For processor data it points employees to **their own employer** as the first contact for rights requests, and commits TicketFlow to help the employer answer.

## §3 The privacy notice: required content (checklist)

Each item maps to the data subject's **right to be informed** (DPA Sec. 16(a)-(b); IRR Sec. 34) and the general principles of **transparency, legitimate purpose and proportionality** (DPA Sec. 11; IRR Sec. 17-19).

1. **Who we are:** entity (D1) and contact; the DPO (D2).
2. **Scope:** the website, the TicketFlow app, sign-in, emails. It does not cover the customer's own policies for the data it puts in tickets (§2).
3. **What we collect, by category** (§4), including what comes from Google sign-in.
4. **Why and the lawful basis for each purpose**:
   - **Personal information:** DPA Sec. 12. The bases are contract (providing the service), legal obligation (tax / invoices), legitimate interests (security logs, abuse prevention) and consent (any optional marketing).
   - **Sensitive personal information:** DPA Sec. 13. This is only as instructed by the customer PIC (D7).
5. **Who receives it:**
   - service providers and sub-processors (§4: Google, Vercel);
   - the customer company and its users, per the ticket's visibility rules;
   - authorities when legally required.
   - **No selling of personal data.**
6. **Cross-border transfer:** where the data is stored and processed, and that TicketFlow stays accountable for data transferred to its providers (DPA Sec. 21, principle of accountability).
7. **Retention and disposal** (§5).
8. **Security measures**, in summary (§8).
9. **Data subject rights** and how to use them (§6), including the right to complain to the **National Privacy Commission** (privacy.gov.ph) and the right to damages.
10. **Breach notification** commitment (§9).
11. **Cookies / local storage:** sign-in session and preferences only (D9).
12. **Children** (D8).
13. **Changes to the policy:** effective date, version history, how users are told (in-app banner for material changes).

## §4 Data inventory (from this codebase, v10.2) → policy categories

| Category | Where it lives (tab / service) | Fields | Purpose | Role |
|---|---|---|---|---|
| Identity / sign-in | Firebase Authentication (Google sign-in) | uid, name, email, photo URL, sign-in time | authenticate users | PIC |
| Profile | `user_profiles` | display_name, email, **phone**, **hire_date**, **termination_date**, immediate / backup approver, status, last_login_at | approval routing, access | PIP (customer data) |
| Invites | `user_invites` | email, display name, role grants, inviter, send count | onboarding | PIP |
| Preferences | `user_preferences` | dark mode, time zone, language, email / desktop notification choices, display zone | settings | PIC |
| Tickets and workflow | `tickets`, `custom_field_values`, `ticket_history`, `ticket_participants`, `ticket_collaborations`, `ticket_links`, tags | anything the customer's forms ask for (may include **sensitive PI**); who acted, when, comments | the service | PIP |
| Attachment links | `ticket_attachments` | file name, Google Drive / Docs link, uploader (files themselves stay in the customer's Drive) | the service | PIP |
| Notifications and email | `notifications`, `email_outbox`; Gmail via Apps Script `MailApp` | recipient, email address, subject, body (ticket number / title) | workflow notices | PIP |
| Audit and security logs | `admin_action_logs` (logins with **email + IP address** when sent), `ticket_action_logs`; Vercel function logs (uid, company id, action, timing) | who did what, when | security, accountability, troubleshooting | PIC (security) / PIP (ticket audit) |
| Plans and billing | `company_subscriptions`, (P2) `subscription_invoices` | company, billing reference, invoice lines, the contact | contract, tax records | PIC |
| Website leads (website plan W2, later) | `website_leads` | name, work email, company, country, team size, message, consent time | answering enquiries, trials | PIC |

**Service providers to list:**
- Google: Workspace / Sheets, Apps Script, Firebase Authentication, Gmail sending;
- Vercel: hosting, the API proxy, logs;
- the migration target, if it happens (Neon Postgres - `PLAN_Migration_NeonVercel_20261030.md`).

Before the policy is published, the business confirms each one's region and its data processing terms.

## §5 Retention (D5 defaults - for counsel / the customer to confirm)

| Category | Default retention | How it ends |
|---|---|---|
| Ticket data (processor) | as long as the customer's subscription + the customer's own retention instruction; on contract end, export then delete / anonymize within 90 days | §7 off-boarding job |
| User profiles (processor) | while the user is active in a customer company; after deactivation per the customer's instruction | anonymize (§7) |
| Login / security logs | 1 year | the v10.0 log archive (`ARCHIVE_SPREADSHEET_ID`), then delete |
| Vercel function logs | the provider's default retention (state it) | provider |
| Invoices / billing | as long as tax law requires (BIR record-keeping - *(verify the current period)*) | delete after |
| Email outbox rows | 90 days after sending | cleanup job |
| Website leads (later) | 12 months if not converted (website plan §4) | deactivate / delete job |

Principle: kept **only as long as necessary** for the purpose (DPA Sec. 11(e)).

## §6 Data subject rights: how each is honoured

The DPA rights (Sec. 16-18; IRR Sec. 34-37): to be informed, to object, to access, to rectification, to erasure or blocking, to damages, to data portability, and to file a complaint.

| Right | How it works in TicketFlow |
|---|---|
| Informed | the privacy notice (§3), linked in the footer of every page, at sign-in, and in invite emails |
| Access / portability | **"Download my data"** (Profile): the user's profile, preferences, own notifications and the tickets they requested, as JSON / CSV. Processor data also goes through the employer |
| Rectification | profile edits (users / admins); ticket corrections through the customer's own workflow |
| Erasure / blocking | **anonymization**, not row deletion: the app's rule is soft-delete only, and audit logs must stay. Name / email / phone are replaced with `Deleted user #id`, the Firebase account is disabled, and records stay linked by id. Ticket content follows the customer PIC's instruction |
| Object | opting out of email notifications exists (preference); no marketing without consent |
| Complaint / damages | NPC contact details in the policy |

**Process:**
- requests go to the DPO mailbox (D2);
- identity is verified (a signed-in request, or a reply from the account's email);
- answered within **15 working days** *(verify the current NPC timeline)*;
- each request is recorded in a request log.

For processor data, TicketFlow forwards the request to the customer company and helps it answer.

## §7 Organization and registration (business tasks, not code)
1. **Appoint the DPO** (D2) and publish the contact.
2. **Privacy Impact Assessment (PIA)** of the TicketFlow system: the inventory (§4), risks (Restricted / sensitive data, cross-border hosting, admin access) and controls (§8). Repeat it at each major version.
3. **NPC registration** *(verify against the current registration circular, NPC Circular 2022-04)*: check the thresholds. These include the number of employees, the volume of sensitive personal information processed, and whether processing is likely to pose a risk to data subjects. Register the DPO and the processing system if any threshold applies. A processor that handles customers' employee data at scale is likely to need it.
4. **Data Processing Agreement** template for customers (D3). It covers:
   - the subject matter, duration, nature and purpose;
   - acting on documented instructions;
   - confidentiality;
   - security measures;
   - sub-processors (Google, Vercel) and notice of changes;
   - help with rights requests and breaches;
   - deletion or return at contract end;
   - audits.
5. **Data sharing:** none beyond processors today. If it ever happens, a data sharing agreement per NPC guidance *(verify the current circular)*.
6. **Privacy and security policies** for staff with platform access (platform admins, `PLATFORM_ADMIN_UIDS`): confidentiality undertakings, access reviews, training.

## §8 Security measures the policy can truthfully claim (and gaps to close)
The IRR requires organizational, physical and technical measures (IRR Sec. 25-29 *(verify)*). What the code already has, so the policy can describe it:
- **Access control:**
  - Google sign-in verified at the proxy (Firebase ID token);
  - Apps Script accepts only proxied calls (`PROXY_SECRET`, `AUTH_MODE=enforce`);
  - an invite-only allow-list (v9.6);
  - admin-only and platform-only routes;
  - a 12-hour session cap.
- **Need-to-know visibility:** ticket visibility per type, participants, and **Restricted** tickets and fields with masking for people outside the chain (v10.0).
- **Accountability:** admin action logs, ticket action logs, and a logged reveal of Restricted content.
- **Encryption in transit:** HTTPS everywhere (Google, Vercel).

Gaps to close before claiming more:

| Gap | Work |
|---|---|
| IP address in login logs only when the client sends it - decide: keep (security) or drop (proportionality) | decide; if kept, state it and keep 1 year |
| No "Download my data" | build (§10 L3) |
| No anonymization routine | build (§10 L3); it also covers off-boarding a customer |
| No outbox / log retention jobs | build the cleanup jobs (§5) on the existing 15-minute trigger, bounded and idempotent (A19) |
| Data at rest on Google / Vercel - provider encryption only | state it accurately; review again at the Neon migration |
| Breach runbook | §9 |

## §9 Personal data breach handling
- **Notify** the NPC and the affected data subjects within **72 hours** of knowledge of a breach that involves sensitive personal information or information that may enable identity fraud, and is likely to give rise to a real risk of serious harm. Basis: DPA Sec. 20(f) and the NPC circular on breach management (NPC Circular 16-03 *(verify whether it has been superseded)*).
- **Runbook** (`docs/guides/GUIDE_Privacy_BreachResponse.md`, to write):
  - detect → contain (switch `AUTH_MODE` / revoke sessions, rotate `PROXY_SECRET`, disable accounts) → assess → notify (NPC, then data subjects, then customer PICs for processor data, without undue delay) → document → review;
  - an annual security incident report, if the circular requires it.
- **Processor duty:** tell the customer PIC promptly (DPA template, §7.4) so it can meet its own 72 hours.

## §10 Phases
| Phase | Content | Who | Depends on |
|---|---|---|---|
| **L1** | Decisions D1-D10, DPO appointed, PIA started, registration check | business / counsel | - |
| **L2** | Policy text drafted from §3-§6 with the real entity data, plus the DPA-contract template. A first draft can be written here as a starting point, **marked draft** until counsel signs off | Claude (draft) → counsel | L1 |
| **L3** | Product work: (a) the `/legal/privacy` page (content in `src/config/legal/privacy.js`, version + effective date, no API call - `OpenRoute` like `/plans`; footer link on every page); (b) a notice link at sign-in and in invite emails, plus acceptance recorded on first sign-in (`user_profiles.privacy_notice_version`, `privacy_notice_accepted_at` - a new AppScript version); (c) **Download my data**; (d) **anonymization** routine + customer off-boarding; (e) retention cleanup jobs; (f) the breach runbook guide | Claude | L2 text approved |
| **L4** | Publish (push), announce the effective date in-app; review yearly and at each major version (with the PIA) | business + Claude | L3 |

**Checks for L3 (repo rules):**
- each AppScript change is a new timestamped file, with offline tests and compliance A1-A22;
- `check:api-contract`, `check:code-rules`, `build:ci`;
- `/code-review` on the diff, logged in `docs/planning/TODO_CodeReview_<date>.md`;
- the public page makes no API call.

**Progress:** not in the roadmap total yet. If approved, `docs/planning/PROGRESS_FeatureCompletion.md` §5 gets a scope row (proposed **+4 pts**: privacy page + notices 1, data export 1, anonymization + off-boarding 1, retention jobs 1).

## §11 References (checklist - confirm the current versions)
- Republic Act No. 10173, Data Privacy Act of 2012 - Sec. 11-13 (principles, lawful processing, sensitive information), 14 (subcontracting), 16-18 (rights, portability), 20 (security, breach notification), 21 (accountability, transfers), 25-37 (penalties)
- Implementing Rules and Regulations of RA 10173 (2016)
- NPC Circular 16-03 - Personal Data Breach Management *(verify)*
- NPC Circular 2022-04 - Registration of Personal Data Processing Systems *(verify)*
- NPC Advisory 2017-01 - Designation of Data Protection Officers *(verify)*
- NPC guidance on privacy notices, consent and data sharing agreements *(verify the current circulars)*
- National Privacy Commission: privacy.gov.ph
