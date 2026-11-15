<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: DISCLOSURE_DataLocation_NewClients_20261115.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Migration step 0.10 - where data is stored and who processes it, worded for NEW clients (sign-up, welcome email, sales answers); replaces the Sub-processor notice | Status: DRAFT - for review by the owner (and counsel with the DPA / Privacy / Terms changes)
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "no notice needed. no payng clients for now. or word it for new clients" - no existing customer to notify, so no 30-day notice and no Phase 2 wait; the DPA's [[30]]-day rule applies to later changes once clients exist
===============================================================================
-->

# DISCLOSURE — Data location and service providers, for new clients

**Why this replaces the notice:** the DPA's [[30]] days' notice of a new Sub-processor protects **existing** customers.
As of 15 Nov 2026 there are **no paying clients** (user), so nobody needs to be notified and Phase 2 does not wait
30 days. New clients are told up front instead: they accept the DPA with Annex C already listing the providers. From the
first paying client on, every later provider change follows the DPA's notice rule.

## §1 Short statement (sign-up page, welcome email, proposals)
The same text is the draft page **/data-location** (`src/config/legal/dataLocation.js` v0.1 - change both together; previews and /data-location/draft show it, production shows a placeholder until published).

Use **A** for a client who signs up before the move (plan Phase 2), **B** after it.

**A - before the move**

> **Where your data is stored.** Daloy's application server runs on Google Cloud in Singapore. Your organization's data
> is currently kept in Google Sheets through Google Apps Script, and is moving to a dedicated Postgres database run by
> Neon, Inc. in Singapore (Amazon Web Services region ap-southeast-1) [[in the coming weeks / by date]]. You sign in with
> your Google account. No provider offers a Philippine region for these services today; Singapore is the nearest. We
> remain responsible for your data under the Data Privacy Act of 2012. You don't need to do anything for the move; we
> announce the short read-only maintenance window ahead of time.

**B - after the move**

> **Where your data is stored.** Your organization's Daloy data is stored in Singapore: in a managed Postgres database
> run by Neon, Inc. (Amazon Web Services region ap-southeast-1), with the application server on Google Cloud in Singapore.
> You sign in with your Google account. No provider offers a Philippine region for these services today; Singapore is
> the nearest. We remain responsible for your data under the Data Privacy Act of 2012.

**Both - add when it applies**

> **Prefer your own Google Sheet?** Daloy can also run on a Google Sheet in your organization's own Google account. Your
> data then stays where your Google account keeps it.
>
> **Your own Drive and mail.** Attachments and notification emails can go through your organization's own Google Drive
> and mail service once you connect them; those stay under your agreements with those providers.
>
> The full list of our service providers is in the Data Processing Agreement (Annex C), which your administrator accepts
> at sign-up. Questions: our Data Protection Officer at KRATIV.dpo@blueknight.xyz.

## §2 Providers (the same list as DPA Annex C v0.3)
| Provider | What for | Where |
|---|---|---|
| Google LLC | application server + scheduled jobs (Cloud Run, Cloud Scheduler), website (Firebase Hosting), secrets + service logs, sign-in with Google, KRAtiv's mailbox for invitations / account emails | Singapore (`asia-southeast1`); website and sign-in on Google's global network; logs [[Singapore once the log bucket region is set]] |
| Neon, Inc. (on Amazon Web Services) | the database | Singapore (`aws-ap-southeast-1`) |
| Vercel Inc. | staff test versions (previews) only | [[decision: test data only → off the list]] |
| *Before the move only:* Google Sheets / Apps Script, Firebase Authentication | today's data store and sign-in check | Google, no fixed region / US |

Not KRAtiv providers: the client's own Google Drive, mail service and Google Sheet (connected by the client, under its
own agreements).

## §3 When a paying client exists before the move
If a client signs up **before** Phase 2, it gets statement **A** at sign-up. Because A already names Neon and Singapore,
the move is not a new Sub-processor for that client. Still send a short heads-up with the maintenance window date. Only
a provider that A / Annex C does not name would need the [[30]]-day notice.

**Related:** DPA v0.3, Privacy Policy (15 Nov 2026), General Terms v0.16 (all drafts, published in plan step 3.1 with
`src/config/platform.js` `MIGRATION_COMPLETE = true`).
