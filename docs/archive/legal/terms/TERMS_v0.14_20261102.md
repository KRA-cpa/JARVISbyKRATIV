<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: DRAFT_TermsOfService_20261101.md | Author: Kenneth R. Advento | Version: 0.13.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 2 November 2026 UTC+8 (Philippine Standard Time)
Purpose: DRAFT General Terms of Service for Daloy (B2B subscription), aligned with the plan, usage, data and privacy decisions so far | Status: DRAFT - not legal advice, not in effect; for review by counsel; [[...]] = pending decision (§0)
REVISION HISTORY:
- v0.13.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §5.1a currency: USD-priced subscription billed in PHP at the previous month's BSP weighted average rate (user); T4
- v0.12.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §5.3b late-payment penalty (user: "penalties on overdue subs, unless agreed upon otherwise or waived via credit memo or in writing"); T5
- v0.11.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §10.2 provider outages (user: "add google status / google downtimes"): not a Service failure, fees due, Status page /status, admin notice after [[1 hour]], discretionary goodwill credit after [[24 h / month]]
- v0.10.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §7.4a limited access to Customer-owned storage: customer's right, not a Service failure, fees due and payments received / recorded as usual (user: "payments received even if database is unreachable"), notice, 30-day suspension
- v0.9.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §5.3a: Customer notifies its withholding agent status + CWT rates at sign-up and on change (user); attestation 3; tax profile in §0a
- v0.8.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §5.3a Philippine taxes (user: "include Daloy is covered by Philippine income tax laws")
- v0.7.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §3a Customer attestations (user: "attestations by customer in terms, like users must be 18 and other stuff"); recorded with the acceptance (§0a)
- v0.6.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Renamed "General Terms of Service" (user); the DPA is available only to customer admins in the Service (admin page /admin/dpa), prospects on request
- v0.5.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User: "last updated" on both documents; archive every Terms version (/terms/versions, termsArchive.js, docs/archive/legal/terms/); notice of major changes; major change = materially diminishes the Customer's or KRATIV's rights (§17). Text also in src/config/legal/terms.js (/terms)
- v0.4.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User: entity placeholder "KRATIV Solutions"; venue = courts of Mandaluyong City, Metro Manila (no arbitration); waivers / deductions given as a discount or by a credit memo issued to the Customer
- v0.3.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §6.5 waivers and credits (user: "platform owner can waive limitations on customer billing and usage"); T13
- v0.2.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User: "terms will form part of the subscription contract of a company or org once they sign up" - T2 / T3 decided; contract documents + order of precedence; acceptance record (§0a)
- v0.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | First draft (user: "draft terms and conditions")
===============================================================================
-->

# DRAFT — Daloy General Terms of Service

> **Draft, not legal advice, not in effect.** Written from the product decisions in this repo for review by a
> Philippine lawyer. `[[...]]` marks a pending decision. Legal references marked *(verify)* must be checked against
> the current law. Publish only after review, together with the Privacy Policy (`src/config/legal/privacy.js`) and the
> Data Processing Agreement (`PLAN_PrivacyPolicy_DPA_20261101.md` D3).

## §0 Decisions needed before publishing
| # | Decision | Proposed default / source |
|---|---|---|
| T1 | Contracting entity (legal name, address, SEC / DTI registration, TIN) | **KRATIV Solutions** as the placeholder name (user, 1 Nov 2026) - registration, address and TIN still to confirm (also privacy D1) |
| T2 | Who the customer is: organization or company | ✅ **Decided (user):** whichever **signs up** - a company, or an organization (which then covers its companies) |
| T3 | Acceptance | ✅ **Decided (user):** the Terms **form part of the subscription contract** when the company / organization signs up; accepted at sign-up and recorded (§0a) |
| T4 | Prices, currency, VAT | ✅ **Currency decided (user, 2 Nov 2026):** monthly subscription + monthly add-ons priced in **USD**, billed in **PHP** at the **BSP weighted average rate of the previous month** (§5.1a); one-time fees in PHP. Prices: `PROPOSAL_Pricing_20261102.md`; VAT treatment open (PR1) |
| T5 | Payment terms, late payment | Due [[15]] days after the statement / invoice. ✅ **Decided (user):** a late-payment **penalty** on overdue amounts, **unless agreed otherwise or waived by credit memo or in writing** (§5.3b); rate [[1% per month]] to confirm; no penalty on good-faith disputed amounts or on withheld tax before the 2307 deadline |
| T6 | Service levels | **None while the service is a proof of concept** (Google Sheets backend); a separate SLA later |
| T7 | Liability cap | Fees paid in the **12 months** before the claim |
| T8 | Data return / deletion after termination | Export available for [[30]] days of read-only access, deleted within [[90]] days (privacy retention) |
| T9 | Governing law and venue | ✅ **Decided (user):** Philippine law; the courts of **Mandaluyong City, Metro Manila** |
| T10 | Changes to the Terms | ✅ **Decided (user):** major change = materially diminishes the Customer's or KRATIV's rights; notice on the page, every footer and to admins, [[30]] days ahead, admins re-accept; other changes take effect when published (§17) |
| T11 | Suspension for non-payment | Read-only after the grace period (plan U4: 14 days paid, 7 after a trial) - not deletion |
| T12 | Language | English; a Filipino translation is for convenience, English prevails |
| T13 | Waivers by the platform owner (limits, fees, add-ons, credits) | ✅ Allowed at our discretion (§6.5): recorded, time-limited, no precedent; amounts given as a **discount** on the invoice or a **credit memo** to the customer (user); uses the platform admin overrides (plan U2, `setSubscriptionOverrides`) |

## §0a Subscription contract and acceptance record (product requirements)
**Contract documents** (one subscription contract per subscribing company or organization):
1. the **Subscription details** - plan, period, packs, allowances, add-on prices, billing contact (the order form, or
   the plan record shown at sign-up and on renewal);
2. these **General Terms of Service**;
3. the **Data Processing Agreement** (privacy D3) - shown **only to the customer's company / organization admins**, on
   the admin page (`/admin/dpa`); prospects receive it on request;
4. the **Privacy Policy** (for information; it describes processing, it is not a contract term).
If they conflict: Subscription details → Data Processing Agreement (for personal data) → Terms.

**Acceptance record** (needed so the contract can be shown later):
| Recorded | Where (proposal) |
|---|---|
| Who accepted (user id, name, email), for which company / organization | `subscription_acceptances` (new) or columns on `company_subscriptions` |
| When (UTC timestamp), from where (sign-up, renewal, plan change, re-acceptance) | same |
| Which versions: Terms, DPA, Privacy Policy (version + effective date) | same - a version string per document |
| The attestations confirmed (§3a) - the list as shown, ticked by the accepting admin | same |
| The subscription details accepted (plan, period, packs, add-on prices) | a snapshot (JSON) |
| Tax profile: TIN, VAT status, **withholding agent status / classification, CWT rate(s)**, effective date of each change (§5.3a) | the company / organization billing profile, history kept; shown on *Plan & usage*; statements compute the expected net |
| Waivers / overrides granted later (what, scope, from - to, by which platform admin, reason) | the override record (`setSubscriptionOverrides`) + an audit-log entry; shown to the customer on *Plan & usage* |

- A **material change** of the Terms (§17) asks a company / organization admin to accept the new version at next
  sign-in; until then the old version applies, and declining before the effective date ends the subscription with a
  pro-rated refund.
- The accepted versions are visible on the *Plan & usage* page and printable (the customer's copy of its contract).
- Platform-managed sign-ups (the platform team sets up a Basic company) still need a customer admin's acceptance on
  first sign-in before the plan starts [[or a signed order form]].

---

## General Terms of Service

**Effective date:** [[date]] · **Version:** [[1.0]]

These General Terms of Service ("**Terms**") are between **KRATIV Solutions** [[placeholder - confirm the registered name]]
("**KRATIV**", "**we**", "**us**"), with address at
[[registered address]], and the company or organization that signs up for Daloy ("**Customer**", "**you**").

**These Terms form part of the Customer's subscription contract.** When the Customer signs up (including a trial), the
subscription contract is made up of the Subscription details shown and accepted at sign-up (plan, period, packs,
allowances and prices), these Terms and the Data Processing Agreement. The person who accepts confirms they have
authority to bind the Customer. If an organization signs up, the contract covers every company it adds to its
account; an organization admin may accept on behalf of those companies. We keep a record of who accepted which
versions and when, and the Customer can view it in the Service.

### 1. Definitions
- **Service** or **Daloy**: the Daloy ticketing and workflow application, its website, templates and related support.
- **Organization**: the Customer's account that owns the data store and groups one or more **Companies**.
- **Users**: people the Customer allows to use the Service (employees, approvers, administrators, requesters).
- **Customer Data**: everything the Customer and its Users put into the Service - tickets, form answers, workflow
  history, attachments links, user lists and settings.
- **Plan**: the subscription level (Basic, Basic+, Advanced, Enterprise) with its features and allowances, as shown on
  the Plans page or the order form.
- **Pack**: a set of request templates for one area (for example the Payroll pack and the HR pack).
- **Usage Add-ons**: charges for use above a Plan's allowances (§6).

### 2. The Service
2.1 We provide the Service according to the Customer's Plan. A higher Plan includes the features of the lower Plans.
2.2 **Proof-of-concept status.** The Service currently stores data in Google Sheets through Google Apps Script. It is
provided without a service-level commitment ([[T6]]). We will tell Customers before we move data to another storage
system and will not reduce the protection of Customer Data when we do.
2.3 **Templates and Packs** are starting points. Their fields, lists (such as leave types) and steps are not legal,
tax or HR advice. The Customer decides how to use them and is responsible for its own policies.
2.4 **Payroll and leave rules are outside the Service.** Daloy records, routes and exports requests (for example
leave, overtime, non-punching and Manual DTR requests). It does not compute pay, hours, premiums, deductions or leave
balances. Results computed by the Customer or its payroll system from Daloy exports are the Customer's responsibility.
2.5 We may improve, change or retire features. We will not remove a core feature of a paid Plan during a paid period
without notice and a fair alternative or refund for the remaining period.

### 3. Accounts and Users
3.1 The Customer names at least one administrator, controls who is invited, and assigns roles.
3.2 Users sign in with Google accounts. The Customer is responsible for its Users' accounts, for keeping access
current (removing people who leave) and for everything done under its Users' accounts.
3.3 Users must be at least 18 years old (§3a).

### 3a. Customer attestations
By accepting these Terms - at sign-up, and again each time it renews, changes Plan or accepts a new version - the
Customer confirms that:
1. The Customer is a business, government office or other organization (not an individual consumer), validly existing and, where the law requires, registered (for example with the SEC, DTI or BIR).
2. The person accepting these Terms is authorized to bind the Customer, and for an organization, each company it adds.
3. The information given at sign-up and for billing (names, addresses, TIN, VAT status, withholding agent status and creditable withholding tax rates, contacts) is true and complete, and the Customer keeps it up to date.
4. Every User is at least 18 years old and uses the Service for the Customer's business.
5. The Customer has a lawful basis and has given the required notices for the personal information it and its Users put into the Service, including sensitive personal information (Data Privacy Act), and has the right to share the rest of the Customer Data.
6. The Customer's use of the Service, its templates and its exports (for example leave, overtime and payroll requests) complies with the laws that apply to it, including labor, tax and data privacy laws; the Customer remains responsible for its own policies and decisions.
7. The Customer keeps its administrator list and User access current and removes people who should no longer have access.
8. The Customer will not use the Service in breach of the Acceptable use section, and is not barred by law or sanctions from using it.

If any of these stops being true, the Customer tells us promptly. A materially false attestation is a material
breach of these Terms.

### 4. Plans, trials and changes of Plan
4.1 **Trials.** We may offer a trial for a set period. A trial ends on its end date; without a paid Plan the account
enters a short grace period and then becomes read-only (§8).
4.2 **Upgrades** take effect when confirmed. **Downgrades** take effect at the end of the current period; nothing is
deleted because of a downgrade, but creating more than the lower Plan allows is not possible.
4.3 **Packs.** Basic+ includes the Payroll and HR packs. On Advanced and Enterprise the Customer may turn each pack
on or off. Turning a pack off stops new requests of its types; existing requests remain readable and can finish.

### 5. Fees, statements and taxes
5.1 Fees are as stated on the order form or Plans page [[T4]]. Plans are billed per period in advance; Usage
Add-ons are billed in arrears (§6).
5.1a **Currency.** The monthly subscription fee and the monthly Usage Add-ons are priced in US dollars and billed in Philippine pesos. Each statement converts them at the Bangko Sentral ng Pilipinas (BSP) weighted average peso-dollar rate for the calendar month before the statement month, and shows the rate used. One-time fees (such as setup) are stated and billed in pesos unless the Subscription details say otherwise. The rate for the coming month is shown on the Customer's Usage & charges page as soon as the BSP publishes it, so the peso amount is known before the statement. *(verify: invoice currency / peso equivalent requirements under BIR rules)*
5.2 We send a **usage statement** each month. Official invoices are issued [[through our accounting / billing
system, in compliance with BIR rules]] *(verify the EOPT Act invoicing requirements)*.
5.3 Payment is due within [[15]] days ([[T5]]). Fees are [[exclusive]] of VAT and other taxes.
5.3a **Philippine taxes.** Daloy is provided by KRATIV, a Philippine taxpayer, from the Philippines. The fees and the income KRATIV earns from them are covered by the Philippine tax laws (the National Internal Revenue Code, as amended, and the rules of the Bureau of Internal Revenue), including income tax and VAT or percentage tax as they apply. Where the Customer is required by law to withhold creditable withholding tax on its payments to KRATIV, it withholds at the rate the law sets, pays it to the BIR, and gives KRATIV the certificate (BIR Form 2307) within the period the BIR requires; the amount withheld counts as paid once KRATIV receives the certificate. The Customer tells KRATIV, at sign-up and within [[15]] days of any change, whether it is a withholding agent (and its classification, for example a top withholding agent or a government office) and the creditable withholding tax rate(s) it applies to KRATIV's fees; statements show the expected amount net of that withholding. Until KRATIV is told, it treats the Customer as not withholding, and an amount withheld without notice and certificate remains due. The Customer is responsible for its own taxes. *(verify the current NIRC / BIR
withholding rules and the 2307 deadline)*
5.3b **Late payment.** An amount not paid by its due date bears a late-payment penalty of [[1%]] per month (or part of a month) on the overdue amount, from the due date until it is paid, unless the Subscription details or another written agreement says otherwise, or we waive it by credit memo or in writing. No penalty runs on: an amount the Customer disputes in good faith and tells us about, with reasons, before its due date (the undisputed part stays due); or tax the Customer has withheld while the BIR period for giving the certificate (Form 2307) has not yet ended. Penalties appear on the next statement. The late-payment penalty is separate from the grace period and read-only status, which only concern access to the Service. *(verify: stipulated interest in writing - Civil Code art. 1956; reduction of iniquitous penalties - art. 1229)*
5.4 Fees paid are non-refundable except where these Terms or the law say otherwise.

### 6. Usage allowances and Usage Add-ons
6.1 Each Plan includes allowances (for example users and tickets per month). If the Customer goes above an allowance,
it may keep working and pay Usage Add-ons in blocks, as published for its Plan, **instead of being required to
upgrade**. Features of a higher Plan still require that Plan.
6.2 **How usage is counted** is shown next to each number on the Customer's *Usage & charges* page (for example:
users who signed in during the month; tickets created, including cancelled ones; ticket volume on a 3-month rolling
average) [[final rules: plan O2, O6, O7]].
6.3 **No surprises.** The Customer's administrators can see current usage, a month-end projection and the list of
counted users and tickets at any time, receive alerts as usage approaches and passes an allowance, and can choose to
**stop at the allowance** or set a **monthly spending cap**. We do not charge Usage Add-ons that were not shown on the
*Usage & charges* page during the month.
6.4 Technical limits of the storage system may cap usage regardless of Plan; we will tell the Customer before a
technical limit is reached.

6.5 **Waivers and credits.** We may, at our discretion, raise or waive a limit, waive or reduce fees or Usage
Add-ons, or give credits for a Customer. A waiver applies only as recorded in the Customer's Subscription details or
on its *Usage & charges* page or statement, for the scope and period stated there (if no end is stated, until the
end of the current subscription period). A waiver is not a change to the Plan or prices, does not entitle the
Customer to the same waiver later, and can be ended for future periods with [[30]] days' notice. A waiver or deduction
of an amount is given either as a **discount** on the invoice for that period or by a **credit memo** issued to the
Customer, which reduces amounts the Customer owes; it is not paid out in cash unless we agree otherwise in writing.

### 7. Customer Data
7.1 **Ownership.** The Customer owns Customer Data. We use it only to provide, secure, support and improve the
Service, as described in the Privacy Policy and the Data Processing Agreement.
7.2 **Roles under the Data Privacy Act.** For Customer Data that is personal information, the Customer is the
personal information controller and we are its personal information processor (Republic Act No. 10173) *(verify)*.
The Data Processing Agreement forms part of these Terms.
7.3 **Customer responsibilities.** The Customer has a lawful basis for the personal information it puts into the
Service, gives the notices its Users and requesters need, and marks sensitive requests (for example health or salary
details) as **Restricted** where its Plan offers it.
7.4 **Customer-owned storage.** If the Customer chooses to keep Customer Data in its **own Google Sheet** through a
Daloy bridge in its Google Workspace: (a) the Customer is responsible for its Google account, its Workspace settings,
access to the Sheet and the bridge, and Google's terms; (b) the Customer and its Users must **not edit the Sheet
directly** - direct edits bypass the Service's permissions, audit log and locks, and we are not responsible for data
changed or lost that way; (c) the Service still processes Customer Data while it works on it.
7.4a **Limited access to Customer-owned storage.** The Customer may limit or end the Service's access to its own data store at any time - for example by removing or changing the bridge, removing sharing, making the Sheet read-only, or a Workspace setting that blocks the bridge. This is the Customer's right and not a breach. While access is limited: the parts of the Service that need the data store do not work (new requests, approvals, notifications, escalations and exports may stop or be delayed), and this is not a failure of the Service and is excluded from any service level; fees and Usage Add-ons for the period remain due, and statements, invoices, payments and credit memos are issued, received and recorded as usual, because subscription, billing and payment records are kept by KRATIV outside the Customer's data store; we notify the Customer's administrators promptly when the data store stops answering; and the Customer answers requests from data subjects about data in its own data store directly, with our help for the data we hold. When access is restored, the Service checks the data store and resumes; overdue escalations are sent as a summary. If access is not restored within [[30]] days, we may suspend the subscription and later end it under Term and termination; the Customer keeps its data store, and we delete only the data we hold, under the retention rules.
7.5 **Export.** The Customer can export its data (reports, CSV exports) while its account is active or read-only.
7.6 **Aggregated information.** We may use anonymous, aggregated usage information (that identifies no Customer or
person) to run and improve the Service.

### 8. Grace period, read-only and suspension
8.1 If a period ends without renewal, or a statement or invoice is unpaid when due, the Customer keeps its Plan for a
**grace period** ([[14]] days; [[7]] after a trial). After that the account becomes **read-only**: Users can sign in,
view and export, but cannot create or approve requests. Requests already in progress may finish.
8.2 We may suspend access immediately, with notice, if needed to stop a security threat, unlawful use or use that
harms the Service or other customers, limited to what is necessary.
8.3 Suspension or read-only status does not delete Customer Data.

### 9. Acceptable use
The Customer and its Users must not: break the law or others' rights; upload malware or attack the Service; try to
access other customers' data or bypass plan limits, permissions or security; resell the Service without our written
consent; use the Service to send spam; or put information in the Service that they have no right to share.

### 10. Third-party services
The Service relies on providers such as Google (Workspace, Sheets, Apps Script, Firebase sign-in), Vercel (hosting)
and [[others - privacy D6]]. Their services are subject to their own terms. We choose providers with appropriate
safeguards and remain responsible to the Customer for the parts of the Service we provide.
10.2 **Provider outages.** When Google (including Google Workspace, Google Sheets, Apps Script and Firebase) or another provider has an outage or planned maintenance, the parts of the Service that depend on it may not work. This is not a failure of the Service and is excluded from any service level, and fees for the period remain due. We show the providers' status pages on our Status page (/status), and we notify the Customer's administrators of a provider outage that stops the Service for more than [[1 hour]]. For a provider outage that makes the Service unavailable for more than [[24 hours in a month]], we may give a goodwill credit by discount or credit memo, at our discretion (Waivers and credits).

### 11. Intellectual property
11.1 We own the Service, the Daloy name and logo, and the templates as provided. The Customer receives a
non-exclusive, non-transferable right to use the Service during its subscription.
11.2 The Customer owns its Customer Data and its own adapted templates' content.
11.3 Suggestions the Customer gives us may be used to improve the Service without obligation.

### 12. Confidentiality
Each party keeps the other's non-public business information confidential, uses it only for these Terms, and shares
it only with people who need it and are bound by similar duties - except information that is public, already known,
independently developed, or required by law to be disclosed (with notice where allowed).

### 13. Warranties and disclaimers
13.1 We will provide the Service with reasonable skill and care and keep reasonable security measures.
13.2 Otherwise the Service is provided **"as is"** and **"as available"**. We do not promise that it will be
uninterrupted or error-free, or that templates meet any particular legal requirement.

### 14. Limitation of liability
14.1 Neither party is liable for indirect or consequential losses, lost profits or lost data that could have been
avoided by the other party's reasonable measures (including keeping its own exports).
14.2 Each party's total liability under these Terms is limited to the fees the Customer paid in the **12 months**
before the event giving rise to the claim ([[T7]]).
14.3 These limits do not apply to liability that the law does not allow to be limited, including fraud, bad faith or
gross negligence (Civil Code, arts. 1171-1172) *(verify)*, to the Customer's payment obligations, or to breaches of
§12 or the Data Processing Agreement [[confirm carve-outs]].

### 15. Indemnity
The Customer will defend and hold us harmless from third-party claims arising from Customer Data or from use of the
Service in breach of these Terms. We will defend the Customer from third-party claims that the Service, as we provide
it, infringes their intellectual property rights.

### 16. Term and termination
16.1 These Terms apply from sign-up until the subscription ends.
16.2 Either party may end the subscription at the end of a period by notice in the Service or in writing. Either
party may terminate if the other materially breaches these Terms and does not fix the breach within [[30]] days of
notice.
16.3 After termination the account stays **read-only for [[30]] days** so the Customer can export its data; Customer
Data is then deleted within [[90]] days, except records we must keep by law (for example billing records)
([[T8]]).
16.4 Sections that by their nature should survive (fees owed, Customer Data, confidentiality, liability, governing
law) survive termination.

### 17. Changes to these Terms
17.1 We may update these Terms. The "Last updated" date shows when they last changed, and every version is kept
unchanged in the version history (`/terms/versions`; archive rule in `src/config/legal/termsArchive.js`).
17.2 A **major change** is one that **materially diminishes the rights of the Customer or of KRATIV** under these
Terms (user, 1 Nov 2026). We give notice of a major change at least [[30]] days before it takes effect: on the Terms
page ("Upcoming change" notice with a summary and the effective date), in the footer of every page, and in the
Service or by email to the Customer's administrators, and we ask an administrator to accept the new version (§0a).
17.3 If the Customer does not accept a major change, it may end its subscription before the change takes effect and
receive a pro-rated refund of prepaid fees; until then the earlier version applies.
17.4 Other changes (clarifications, corrections, new features, changes required by law) take effect when published;
the "Last updated" date and the version history show them.

### 18. General
- **Force majeure:** neither party is liable for delay caused by events beyond its reasonable control (Civil Code,
  art. 1174) *(verify)*, except payment obligations.
- **Notices:** to the Customer's administrators by email or in the Service; to us at [[legal / support address]].
- **Electronic acceptance** has the same effect as a signature (Electronic Commerce Act, RA 8792) *(verify)*.
- **Assignment:** neither party may assign these Terms without consent, except to a successor of its business.
- **Entire agreement:** the subscription contract (the Subscription details, these Terms and the Data Processing
  Agreement) is the whole agreement; the Privacy Policy describes how we process personal information. If they
  conflict, the Subscription details prevail, then the Data Processing Agreement (for personal data), then these
  Terms.
- **Severability / no waiver:** an invalid clause does not affect the rest; not enforcing a right is not a waiver.
- **Governing law and disputes:** Philippine law. The parties first try to settle a dispute in good faith for
  [[30]] days; if not settled, the dispute goes exclusively to the proper courts of **Mandaluyong City, Metro Manila**.
- **Language:** English prevails over any translation ([[T12]]).

**Contact:** KRATIV Solutions [[placeholder]], [[address]] · [[support email]] · Data Protection Officer: jarvis.dpo@blueknight.xyz
