<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TEMPLATE_BreachNotice_ProviderIncident_20261115.md | Author: Kenneth R. Advento | Version: 1.3.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Notice templates for a security incident / breach at one of Daloy's service providers ("X service"): A = no company data affected, B = company data may have been affected (+ B2 follow-up), P = public version (ready, not published by default), PE = email to the organizations before P is published; incident timeline (§6) | Status: DRAFT - for review by the owner and counsel (with DPA v0.3 / Privacy Policy)
REVISION HISTORY:
- v1.3.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Incident timeline in every notice, from the first sign to the resolution (user: "add incident timeline details in notices, from initial to resolution") - §6 stages, a Timeline block in A / B / B2 / P, `timeline` + `resolvedAt` in §5; template PE (user: "tell the org first - create an email template ready to send")
- v1.2.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §0 decision D1 recorded (user: "dafault, record decision, public notice must be readily availble for publisjing"); template P (public version); /status notice line + /notices/<id>/public in §5
- v1.1.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §5 sign-in banner (user: "banner upon login, effective for 7 days, user can hide" + "banner will provide link to breach notif"): `src/config/notices.js`, banner on every signed-in page, full notice at /notices/<id>
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "draft a notice of breach of x service where template a) no company data is affected, template b) company data may have been affected"
===============================================================================
-->

# TEMPLATE — Notice of a security incident at a service provider

**Legend:** `{...}` = fill in per incident. `[[...]]` = pending decision (same as the legal drafts).
**"X service"** = any provider in DPA Annex C: Google Cloud (Cloud Run, Cloud Scheduler, Secret Manager, Cloud Logging),
Firebase Hosting, Google sign-in, Google Workspace (KRAtiv's mailbox), Neon (database), Vercel (previews). Before the
move also Google Sheets / Apps Script and Firebase Authentication.

## §0 Decision D1 - no public breach page by default; the public version is always ready (15 Nov 2026)

User: "dafault, record decision, public notice must be readily availble for publisjing" - the default below, as proposed:
1. **No separate public breach page by default.** The full notice goes by email (A / B / B2) and in the app: the
   sign-in banner for 7 days, then `/notices/<id>`, signed-in, only to the organizations addressed (§5).
2. **The public `/status` page shows one neutral line** per notice during its 7 days (§3): provider and date; under B
   "affected organizations have been contacted directly". Never customer names or data.
3. **A full public notice (template P) only when** the NPC asks for one, or the people concerned can't be reached one
   by one (KRAtiv has no contact for them, or individual notices would take disproportionate effort), or the owner and
   counsel decide so at the time. **It must be ready to publish:** every notice carries its template P text from the
   start (`publicTitle` / `publicSections` in `src/config/notices.js`), and publishing is one flag (`public: true`) +
   a deploy - it then shows at `/notices/<id>/public` (open to everyone) and `/status` links it.

Why: Daloy is the processor for Customer Data - the customer organization (controller) decides on the NPC report and on
telling its own people; a public page advertises "breach" next to the name for good (search engines), early statements
can be quoted back, details can help attackers, and the customers lose control of their own message. The reasons for a
public notice (reaching people we can't email, an NPC request) are covered by keeping P ready.
[[counsel: confirm when the NPC rules expect a public announcement]]

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
- Same channels for both: email from the KRAtiv mailbox + the sign-in banner for 7 days (§5) + a short line on `/status` (§3).

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
> **Timeline** (UTC+8; §6):
> - {date time} - Incident began at {Provider} (time given by the provider)
> - {date time} - {Provider} published its statement; we became aware of it
> - {date time} - We confirmed that the services and regions Daloy uses were not involved; access records reviewed
> - {date time} - {Precaution: access keys changed}
> - {date time} - Resolved: {Provider} closed the incident {or: "{Provider} is still working on it; we will update you
>   when it closes"}
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
> **Timeline so far** (UTC+8; §6):
> - {date time} - {Unauthorized access / the incident} began at {Provider} (time given by the provider)
> - {date time} - {Provider} detected it {and closed the access}
> - {date time} - {Provider} informed us; we became aware of the incident
> - {date time} - Contained on our side: {keys changed, users signed out, records under review}
> - {date time} - This notice to your administrators
> - Next: {what we expect next, e.g. the provider's findings by {date}}
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
> **Timeline since our last notice** (UTC+8; the full timeline is in the notice in Daloy, `/notices/{reference}`):
> - {date time} - {event}
> - {date time} - {Resolved: what closed it - e.g. "{Provider} completed its investigation; no further access
>   since {date}"}
>
> **Status.** {Ongoing - next update by {date} / Resolved on {date}.}
>
> Contact: KRATIV.dpo@blueknight.xyz, reference {incident reference}.
>
> KRAtiv Solutions - Daloy
> {date}

---

## TEMPLATE P — public version (ready with every notice; published only per §0)

Written for the people whose data is in the organizations' Daloy records, not for one customer. No customer names,
no per-organization detail. Shown at `/notices/<id>/public`.

**Title (A):** Security notice: {Provider} incident - Daloy data was not affected

> On {date}, {Provider}, one of Daloy's service providers, reported a security incident: {one-sentence summary, with a
> link to the provider's statement}. The services and regions Daloy uses were not involved, and our own review found no
> unusual access to Daloy data. Daloy is working normally; customers don't need to do anything.
>
> Questions: our Data Protection Officer at KRATIV.dpo@blueknight.xyz.

**Title (B):** Notice of a security incident at {Provider}, a Daloy service provider

> **What happened.** On {date}, {Provider}, which provides {what it does for Daloy}, informed us of a security incident:
> {what was accessed or exposed, the time window}. Data of some organizations that use Daloy, and of their users, may
> have been involved. We became aware of it on {date and time, UTC+8}.
>
> **What information may be involved.** {Names and work email addresses; content of workflow requests (tickets) of the
> organizations concerned.} Not involved: passwords - Daloy does not store passwords; sign-in is through Google.
>
> **What we have done.** We have {closed the access with the provider, changed our access keys and signed all users
> out}. The organizations concerned have been contacted directly, and we are helping them with their own notices.
>
> **What you can do.** Be careful with emails or messages that mention Daloy or ask you to sign in. Daloy never asks for
> a password by email. If you use Daloy through your employer or another organization, it can tell you whether your
> information was involved.
>
> **Contact.** Our Data Protection Officer: KRATIV.dpo@blueknight.xyz. You may also contact the National Privacy
> Commission (privacy.gov.ph). Next update on this page: {date / time}.

**Timeline (both):** the same as the notice's, without internal entries (which organization was told when) - the page
shows it from `timeline` (§5); entries marked `internal: true` stay out.

**Before publishing P: tell the organizations first** - send PE to the administrators of every organization concerned
(under A: all organizations) at least [[4]] hours before setting `public: true`, the same day. Don't publish before PE
has gone out.

---

## TEMPLATE PE — to the organizations, before the public notice (ready to send)

**To:** the administrators of each organization concerned (one email per organization, or Bcc - never a visible list
of customers). **Cc:** KRATIV.dpo@blueknight.xyz. **When:** at least [[4]] hours before `public: true`.

**Subject:** Before we publish: public notice on the {Provider} security incident - {incident reference}

> Dear {Organization} administrator,
>
> This is about the {Provider} security incident we told you about on {date of notice A / B} (reference
> {incident reference}).
>
> **We will publish a public notice** about this incident on our website on {date}, at {time} (UTC+8), because
> {choose: "the National Privacy Commission has asked us to" / "some of the people whose data may be involved can't
> be reached individually" / "{other reason}"}. We are telling you first so that you are not surprised and can prepare
> anything you want to say to your own people.
>
> **What the public notice says.** It describes the incident at {Provider}, the kind of information that may be
> involved, what we have done, what people can do, and the timeline. It **does not name your organization** or any
> other customer, and it does not include any of your records. The text is below.
>
> {paste the public title, text and timeline (template P) exactly as they will be published}
>
> **Where it will be:** https://daloy.blueknight.xyz/notices/{incident reference}/public (it opens at the time above),
> linked from our service status page https://daloy.blueknight.xyz/status.
>
> **What you may want to do.**
> - If you have not yet told your own people, you may want to do so before {time}.
> - If anything in the text is wrong for your organization, reply before {time} and we will look at it before
>   publishing.
> - People who ask you about it can be pointed to the public notice. Questions about your organization's own records
>   stay with you, and we will help you answer them.
>
> Contact: our Data Protection Officer, KRATIV.dpo@blueknight.xyz, reference {incident reference}.
>
> KRAtiv Solutions - Daloy
> {date}

Record in the incident record (§4): when PE went to which organization, any replies, the publication time.

---

## §3 Status page line (`/status`, both templates)

- **A:** "{date}: {Provider} reported a security incident. Daloy data was not affected. Service is working normally."
- **B:** "{date}: {Provider} reported a security incident that may involve Daloy data. Affected organizations have
  been contacted directly. Next update: {date / time}."

Don't name customers or data on the status page; details go only to the organizations concerned.

## §4 Incident record (keep for every incident, A or B)

The DPA requires KRAtiv to keep a record of every breach. Minimum fields: reference; provider; when KRAtiv became
aware (UTC+8); provider statement (link / copy); checks in §1 with results; organizations in scope; data and number of
individuals; the incident timeline (§6, every stage with its time); actions taken (with times); notices sent (template, to whom, when - incl. PE before any public notice); the organization's decision on the
NPC report (if told); closed date. [[decide where the record lives - e.g. a restricted folder in the KRAtiv Drive,
not this repo]]

## §5 Sign-in banner (in the app)

Every signed-in page shows the notice as a banner for **7 days**; each user can **Hide** it; the banner links to the
full notice at **`/notices/<id>`** (signed-in, only the organizations addressed; still readable after the 7 days, so
the email can link to it too: `https://daloy.blueknight.xyz/notices/<id>`).

To post: add an entry to `LOGIN_NOTICES` in `src/config/notices.js` and deploy (one push + the Cloud Run deploy).
- `id` = the incident reference; `template` = `A` (blue) | `B` (red) | `B2` (amber); `postedAt` = start, e.g.
  `'2026-11-20T09:00:00+08:00'`; `days` (default 7); `companyIds` = `[]` for everyone (A), the organizations in scope (B).
- `banner` = the signed-in line; `statusLine` = the §3 line (shown on `/status` for the same 7 days);
  `title` + `sections` = template A / B / B2, filled in.
- `publicTitle` + `publicSections` = template P, filled in **when the notice is posted** (§0 D1: always ready);
  `public: false`. To publish: send PE first, then `public: true` + deploy → `/notices/<id>/public` for everyone,
  linked from `/status`.
- `timeline` = `[{ at, text, internal? }]` - add an entry at every §6 stage and redeploy; `internal: true` keeps an
  entry out of the public version. `resolvedAt` = `null` while ongoing; set it with the last entry - the notice,
  banner and `/status` line then say "Resolved".
- Hidden notices are remembered per user in that browser only; the email stays the formal notice.
- Previews show two samples (`SAMPLE-A`, `SAMPLE-B`) with the open items highlighted, their `/status` lines and their
  public versions (marked "not published"); production leaves them out.

## §6 Incident timeline - stages, from the first sign to the resolution

Every notice (A, B, B2, P and the in-app notice) carries a timeline; times in UTC+8, oldest first. Record each stage
in the incident record (§4) as it happens, then copy it to the notice. A stage that doesn't apply is left out; a time
known only roughly is written as such ("about 03:00").

| # | Stage | Source | In the public version |
|---|---|---|---|
| 1 | Incident began (first unauthorized access / failure) | the provider | yes |
| 2 | Detected by the provider | the provider | yes |
| 3 | KRAtiv became aware (provider's notice, its status page, our own alert) - **starts the [[24]] h clock** | us | yes |
| 4 | Assessed: our services / regions in scope or not (§1 checks) | us | yes (result only) |
| 5 | Contained: provider closed the access; our keys changed, sessions ended | provider + us | yes |
| 6 | Organizations notified (A / B, by email + banner) | us | no (`internal`) |
| 7 | Updates (B2): new facts, data confirmed involved / not involved | us | yes |
| 8 | PE sent, then the public notice published (only if §0 applies) | us | the publication only |
| 9 | Resolved: provider closed its incident, no further access since {date}, our review done | provider + us | yes |
| 10 | Closed: incident record complete, lessons noted | us | no |

**Resolved** = stage 9 (set `resolvedAt`). A B incident is not resolved while the data involved is still unknown.

**Related:** DPA v0.3 "Personal Data Breaches" ([[24]] h to the customer) and Annex C (providers), Privacy Policy
"What we do if a personal data breach happens" (72 h for KRAtiv's own data),
`DISCLOSURE_DataLocation_NewClients_20261115.md` §2 (providers and regions).
