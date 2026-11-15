<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TEMPLATE_BreachNotice_ProviderIncident_20261115.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Notice templates for a security incident / breach at one of Daloy's service providers ("X service"): A = no company data affected, B = company data may have been affected (+ B2 follow-up) | Status: DRAFT - for review by the owner and counsel (with DPA v0.3 / Privacy Policy)
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "draft a notice of breach of x service where template a) no company data is affected, template b) company data may have been affected"
===============================================================================
-->

# TEMPLATE — Notice of a security incident at a service provider

**Legend:** `{...}` = fill in per incident. `[[...]]` = pending decision (same as the legal drafts).
**"X service"** = any provider in DPA Annex C: Google Cloud (Cloud Run, Cloud Scheduler, Secret Manager, Cloud Logging),
Firebase Hosting, Google sign-in, Google Workspace (KRAtiv's mailbox), Neon (database), Vercel (previews). Before the
move also Google Sheets / Apps Script and Firebase Authentication.

## §1 Which template

| Situation | Template |
|---|---|
| The provider confirms (in writing or on its status / security page) that our project, region or account was **not** in scope, **and** our own checks below find nothing | **A** |
| Our project / region / account **is** in scope, **or** the provider can't say yet, **or** our checks find anything unusual | **B** |
| Anything in between | **B**. Never send A on a guess - a wrong "not affected" is worse than a careful "may have been". If it later turns out nothing was affected, send B2 saying so |

**Checks before sending A** (record each in the incident record, §4):
1. The provider's statement names the affected services / regions / dates - ours (`asia-southeast1`, `aws-ap-southeast-1`, project `krativ-daloy`, Neon project `daloy`) are not among them.
2. Access logs for the incident window (Cloud Run revision logs, Cloud Logging audit logs, Neon access) show no sign-in, query or export we can't explain.
3. As a precaution, the secrets that the provider holds or that pass through it were rotated (e.g. `daloy-db-*-url`, `PROXY_SECRET`) - say so in the notice only if done.

## §2 Timing and who receives it

- **To:** the administrators of every organization on Daloy (company admin accounts); **Cc:** the DPO
  (KRATIV.dpo@blueknight.xyz). Under B, only the organizations whose data is in scope; the rest get A.
- **B:** within **[[24]] hours** of KRAtiv becoming aware (DPA v0.3 "Personal Data Breaches"), even with facts
  missing - say what is not known yet and when the next update comes (B2).
- **A:** not legally required; send within [[48]] hours of the provider's public statement, or as soon as the
  checks in §1 are done, so customers hear it from us first.
- **Who notifies the NPC and individuals:** for Customer Data, the organization is the personal information
  controller and decides; KRAtiv (processor) gives it the facts. Only for KRAtiv's **own** data (KRAtiv's own
  account and billing records - Privacy Policy) does KRAtiv itself notify the NPC and the individuals within 72 hours
  when the rules require it. [[counsel: confirm the current NPC breach rules - NPC Circular 16-03 or its successor]]
- Same channels for both: email from the KRAtiv mailbox + a short line on `/status` (§3, last block).

---

## TEMPLATE A — no company data affected

**Subject:** Security notice: {Provider} incident - your Daloy data was not affected

> Dear {Organization} administrator,
>
> On {date of provider's statement}, {Provider}, which provides {what it does for Daloy, e.g. "our database
> service" / "our application hosting"}, reported a security incident: {one-sentence summary of the provider's
> statement, with link}.
>
> **Your organization's data in Daloy was not affected.** {Provider} has confirmed that {the affected services /
> regions / accounts} were involved, and Daloy does not use {them / that service in that region}. We also reviewed
> our own access records for {incident window} and found no unusual access to your data. {As a precaution, we
> changed the access keys Daloy uses with {Provider}.}
>
> **You don't need to do anything.** Daloy is working normally {or: "was briefly unavailable from {time} to {time}
> while {Provider} fixed the problem; no data was lost"}.
>
> We tell you about incidents at our providers even when your data is not involved, so you hear it from us first.
> If anything changes, we will write to you again.
>
> Questions: our Data Protection Officer at KRATIV.dpo@blueknight.xyz.
>
> KRAtiv Solutions - Daloy
> {date}

---

## TEMPLATE B — company data may have been affected

**Subject:** Important: {Provider} security incident - your organization's Daloy data may have been affected

> Dear {Organization} administrator,
>
> We are writing to tell you about a security incident at {Provider}, which provides {what it does for Daloy}. Your
> organization's data in Daloy **may have been affected**. We are telling you now, before every fact is known, so
> that you can meet any obligations of your own under the Data Privacy Act of 2012. {Next update: by {date / time}.}
>
> **What happened.** On {date}, {Provider} {reported / informed us} that {summary: what was accessed or exposed, by
> whom if known, the time window}. Daloy {stores / processes} your organization's data with {Provider}
> ({region, e.g. Singapore}). KRAtiv became aware of the incident on {date and time, UTC+8}.
>
> **What data may be involved.** {Choose and edit:}
> - {Ticket records: titles, field values, comments, approval history}
> - {Names and work email addresses of your users}
> - {Attachment links (the files themselves stay in your own Google Drive and were not involved)}
> - {Sign-in records: dates, times, IP addresses}
>
> {Not involved: {e.g. passwords - Daloy does not store passwords; sign-in is through Google}.} {Not known yet:
> {what is still being confirmed}.}
>
> **Who may be affected.** {Number, or "the users and requesters of your organization", and the period, e.g.
> "records created between {date} and {date}".}
>
> **Possible consequences.** {e.g. "Someone outside your organization may have read ticket content. We have no sign
> that it has been misused." / "Users may receive phishing emails that mention Daloy."}
>
> **What we have done.**
> - {Worked with {Provider}, which {stopped / closed} the access on {date}}
> - {Changed the access keys Daloy uses with {Provider}}
> - {Signed all users out of Daloy; they sign in again with Google as usual}
> - {Reviewed our access records for {window}: {result}}
> - Recorded the incident and will keep you updated until it is closed.
>
> **What you should do.**
> - Tell your users to be careful with emails or messages that mention Daloy or ask them to sign in. Daloy never
>   asks for a password by email.
> - {If ticket content can include sensitive personal information: check whether your tickets contained such data.}
> - Your organization decides whether this must be reported to the National Privacy Commission and to the
>   individuals concerned. Under the NPC breach rules this applies when sensitive personal information, or
>   information that could enable identity fraud, is involved and there is a real risk of serious harm - generally
>   within 72 hours of knowing. [[counsel: confirm wording and the current circular]] We will give you the
>   information you need for that report; reply to this email or contact our DPO.
>
> **Contact.** Our Data Protection Officer: KRATIV.dpo@blueknight.xyz {, phone}. Please quote reference
> {incident reference, e.g. INC-2026-001}.
>
> We are sorry this happened. We will write again {by {date / time}} with what we have learned.
>
> KRAtiv Solutions - Daloy
> {date}

---

## TEMPLATE B2 — follow-up (after B)

**Subject:** Update {n}: {Provider} security incident - {incident reference}

> Dear {Organization} administrator,
>
> This updates our notice of {date of B} about the {Provider} security incident.
>
> **What we know now.** {New facts.}
>
> **Result for your organization.** {Choose one:}
> - {Your organization's data **was** involved: {what data, how many records / users}. {What changes in "What you
>   should do"}.}
> - {Your organization's data **was not** involved after all: {how this was confirmed}. You don't need to do
>   anything further.}
>
> **Status.** {Ongoing - next update by {date} / Closed on {date}.}
>
> Contact: KRATIV.dpo@blueknight.xyz, reference {incident reference}.
>
> KRAtiv Solutions - Daloy
> {date}

---

## §3 Status page line (`/status`, both templates)

- **A:** "{date}: {Provider} reported a security incident. Daloy data was not affected. Service is working normally."
- **B:** "{date}: {Provider} reported a security incident that may involve Daloy data. Affected organizations have
  been contacted directly. Next update: {date / time}."

Don't name customers or data on the status page; details go only to the organizations concerned.

## §4 Incident record (keep for every incident, A or B)

The DPA requires KRAtiv to keep a record of every breach. Minimum fields: reference; provider; when KRAtiv became
aware (UTC+8); provider statement (link / copy); checks in §1 with results; organizations in scope; data and number of
individuals; actions taken (with times); notices sent (template, to whom, when); the organization's decision on the
NPC report (if told); closed date. [[decide where the record lives - e.g. a restricted folder in the KRAtiv Drive,
not this repo]]

**Related:** DPA v0.3 "Personal Data Breaches" ([[24]] h to the customer) and Annex C (providers), Privacy Policy
"What we do if a personal data breach happens" (72 h for KRAtiv's own data),
`DISCLOSURE_DataLocation_NewClients_20261115.md` §2 (providers and regions).
