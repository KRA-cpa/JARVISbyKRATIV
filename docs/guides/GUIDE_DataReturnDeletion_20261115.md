<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_DataReturnDeletion_20261115.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: The fixed process for the DPA "Return and deletion" clause (and Terms "Term and termination", Privacy "How long we keep it") - when an organization's subscription ends or it asks for deletion: what to send, when, what to export, what to delete where, how to confirm | Status: DRAFT - for review by the owner / DPO and counsel (with DPA v0.3)
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "document a process for this so wont be done on the fly - re DPA return and deletion"
===============================================================================
-->

# GUIDE — Returning and deleting an organization's data

**Rule:** no deletion is improvised. Every case follows this guide, has a case record (§7), and the owner / DPO
approves the deletion run before it starts. `[[...]]` = the same open decision as in the legal drafts (change both
together). `{...}` = fill in per case.

**What the contract says** (DPA v0.3 "Return and deletion", Terms v0.16 "Term and termination", Privacy "How long we
keep it"):
- After the subscription ends, the account is **read-only for [[30]] days** so the customer can export.
- KRAtiv then **deletes the customer's Personal Data within [[90]] days**, including copies at Sub-processors. The
  database's restore history ends **[[7]] days** after the deletion; service logs expire after **[[30]] days**.
- Kept: only what the law requires (e.g. **billing records**), protected and only as long as required.
- **On request**, KRAtiv confirms the deletion in writing. (Practice: send the confirmation every time - E3.)
- **Own Google Sheet** customers keep their Sheet; KRAtiv deletes what it holds and stops using the bridge.
- Records kept for accountability (who approved a request) have the personal details removed or replaced, not the
  record deleted - this applies to **one person's** deletion while the organization stays (§5), not to a leaving
  organization.

## §1 Which case

| Case | Starts when | Path |
|---|---|---|
| **C1 Subscription ends** (notice, non-renewal, trial not converted, unpaid after grace) | the end date | §2 → §3 → §4 → §6 |
| **C2 Termination for breach** (either side) | the termination date | same as C1; counsel checks for a legal hold first (§4 step 1) |
| **C3 Early deletion request** - the organization asks to delete before or without the read-only period | the written request | §2 (verify) → export offer → §4 within [[30]] days of the request → §6 |
| **C4 Own-Sheet organization leaves** | the end date | §2 → §3 (they already hold their data) → §4 only for what KRAtiv holds + §4.6 → §6 |
| **C5 One person's data** (a data subject asks, through the organization) | the organization's request | §5 |

## §2 Verify and open the case (day 0)

1. **Who asks / who decides.** Only an **administrator of the organization** can end, extend or ask for deletion.
   Verify: the request comes from an admin's account email, **and** confirm by a reply to that admin's address on
   file (not to a new address given in the request). For C2, the termination letter.
2. **Open the case record** (§7): reference `DEL-{YYYY}-{nnn}`, organization, company id(s), case, dates.
3. **Set the dates** (company calendar, UTC+8): end date = day 0; read-only until day [[30]]; deletion deadline =
   day [[90]] (C3: request + [[30]]). Put them in the case record and in E1.
4. **Legal hold check:** any open dispute, unpaid invoice under collection, NPC or court request, or an open breach
   (TEMPLATE_BreachNotice) that involves this organization → **stop**, record it, ask counsel. Nothing is deleted
   while a hold stands; tell the organization (E1 note).
5. Send **E1** to all the organization's administrators (Cc DPO).

## §3 Read-only period and return of the data (day 0 → day [[30]])

1. Switch the organization to **read-only** (users can sign in, read and export; nobody can create or approve).
   - Apps Script (today): `company_subscriptions` status `read_only` (v10.2 plan gate - needs v10.2 deployed; until
     then: set `is_active = false` on the ticket types of that company and [[decide: is that enough]]).
   - Postgres (after the move): the same subscription status through `/api/rpc` [[tool T3]].
2. **Return = the export.** The administrators can export reports / CSV themselves (Terms "Export"). On request -
   or for C3 always - KRAtiv sends a **full export** of the organization's data:
   - Apps Script: `exportConfiguration` (configuration) + a per-company data export [[tool T1]].
   - Postgres: per-company export [[tool T1 - built with migration step 0.9, the reverse export]].
   - Format: JSON + CSV per table, in one ZIP. Shared with the requesting admin only, through a link that expires in
     [[7]] days (e.g. a Drive file shared with that admin's email, not "anyone with the link"). Record the date sent.
   - Attachments: Daloy holds **links** only; the files stay in the organization's own Drive.
3. Day [[23]]: send **E2** (7 days left).
4. Day [[30]]: read-only ends → **access closed**: users of that organization can no longer sign in to it
   (remove their role assignments / profile links to that company; users who also belong to another organization
   keep that access). Stop scheduled jobs for the company (SLA escalations, outbox mail).

## §4 Deletion run (after day [[30]], before day [[90]])

**Step 1 - approval.** Owner / DPO signs off in the case record: no legal hold, export sent or declined in writing,
billing records separated (§4.5). Then run, in this order, each with a **dry run first** (counts only, no content)
and the counts saved in the case record:

| # | Where | What | How |
|---|---|---|---|
| 4.1 | **Production database** - Apps Script: the shared Google Sheet; Postgres: Neon `main` | every row with the organization's `company_id` (tickets, field values, history, logs about its tickets, workflows, roles, assignments, dropdown assignments, SLA rules, notifications, outbox, invites, participants, links, attachments rows, company settings, the `companies` row) | [[tool T2]] per-company delete, one transaction, dry run → apply. Users: delete the user profile only if the person belongs to no other organization; otherwise only the links to this company |
| 4.2 | **Other database copies** | Neon `dev` (the 303 rows loaded from the Sheet export on 14-15 Nov 2026 **are real customer data**), every Neon branch, local PGlite test dirs | the same tool against each; delete branches that are only copies |
| 4.3 | **Exports and reports outside the repo** | the Sheets export JSON and load reports in My Drive (migration 0.8), any earlier full exports, files in Downloads / scratch folders | delete the files; empty Drive trash; list each file in the case record |
| 4.4 | **Secrets and settings** | anything stored for that organization: bridge credentials (own Sheet), email settings, Script Properties naming it | delete / rotate in Secret Manager / Script Properties |
| 4.5 | **Kept on purpose** | invoices, payments, subscription rows, KRAtiv's own correspondence with the customer | move to the billing record store before 4.1 if they sit in a customer table; keep [[confirm the tax-law period]] |
| 4.6 | **Own-Sheet organization (C4)** | KRAtiv's side only: sign-in records, logs, cached data; KRAtiv's access to their Sheet | remove the Daloy service account / sharing from their Sheet (or ask them to); delete KRAtiv's cache rows |

**Step 2 - what expires by itself** (no action, but record the dates): Neon restore history - [[7]] days after
4.1 → write "restorable until {date}"; Cloud Logging - [[30]] days → "logs gone by {date}"; Apps Script execution
logs - Google's retention. **Shared Google Sheet (before the move):** the Sheet's **version history** still holds the
deleted rows - [[decision: accept and state it in E3 / make a fresh copy of the Sheet without history after the
deletion / move the organization to Postgres first]]. Counsel to confirm.

**Step 3 - check.** Re-run the dry run: 0 rows for the company id everywhere in 4.1–4.2. Search the export folders
again. Record the result.

## §5 One person's data (C5)

The organization (controller) asks; KRAtiv helps within [[10]] working days. The organization stays, so records are
kept and the personal details replaced: name → "Former user {n}", email removed, profile deactivated; tickets,
approvals and history stay with the replaced name (Privacy "remove or replace the personal details"). [[tool T4]].
Confirm to the administrator in writing (E3, short form).

## §6 Confirm (within 5 working days after §4 step 3)

Send **E3** to the administrators (to the addresses on file; for C3 to the requesting admin too), Cc DPO. Close the
case record when the last expiry date (Step 2) has passed.

## §7 Case record (one per case, outside the repo)

Reference; organization and company id(s); case C1–C5; who asked and how it was verified; dates (end, read-only
until, deletion deadline); legal hold check; E1 / E2 / E3 sent (when, to whom); export (sent when, format, link
expiry) or declined (copy of the decline); approval for the deletion run (who, when); dry-run and final counts per
place (§4); files deleted (§4.3); expiry dates (Step 2); closed date. **No customer content** in the record - counts
and names of places only. Keep [[5 years]]. [[decide where - the same restricted KRAtiv Drive folder as the incident
records]]

## §8 Tools - what exists, what is missing

| Tool | Status | Needed for |
|---|---|---|
| Read-only per organization | Apps Script v10.2 `company_subscriptions` `read_only` (when deployed) | §3.1 |
| T1 per-company full export | **missing** - build with migration 0.9 (reverse export) for Postgres; an editor-only Apps Script export like `EXPORT_ForPostgres` with a company filter until then | §3.2 |
| T2 per-company delete (dry run / apply, counts, one transaction, every table with `company_id` + users in no other company) | **missing** - Postgres script `scripts/db-delete-company.js` + test; Apps Script editor-only file (pattern of `removeSeedData` / `removeSeedDataApply`, a fix-only tool - no new route) | §4.1, §4.2 |
| T3 read-only switch on Postgres | with the subscriptions port (Phase 4) | §3.1 |
| T4 replace one person's details | **missing** - with T2 | §5 |

Until T1 / T2 exist, a case is handled by Claude writing the tool for it **before** day [[30]] - not by manual row
deletion in the Sheet or SQL typed by hand.

---

## E1 — End of subscription: your data (send on day 0)

**Subject:** Your Daloy subscription has ended - export your data by {read-only end date}

> Dear {Organization} administrator,
>
> Your organization's Daloy subscription {ended / will end} on {end date}. Here is what happens to your data, as set
> out in our Data Processing Agreement.
>
> - **Until {read-only end date}** your account is **read-only**: your users can sign in, read and export, but
>   cannot create or approve requests. Requests in progress may finish.
> - **Export your data** from Reports (CSV) at any time before then. If you would like a **full export** of all your
>   organization's data (JSON and CSV files), reply to this email and we will send it to you.
> - **After {read-only end date}** your users can no longer sign in to your organization's Daloy account.
> - **By {deletion deadline}** we delete your organization's data, including copies held by our service providers.
>   Our database's restore history ends 7 days after the deletion, and service logs expire after 30 days. We keep only
>   records the law requires us to keep, such as invoices.
> - We will **confirm the deletion in writing**.
>
> {C4 - own Google Sheet: "Your data stays in your own Google Sheet. After {read-only end date} we stop accessing it
> and delete what we hold (sign-in records, logs, cached data). You may also remove Daloy's access from the Sheet's
> sharing settings."}
>
> {Legal hold: "Because of {reason}, we cannot delete your data yet. We will tell you when that changes."}
>
> If you want to keep using Daloy, reply before {read-only end date} and we will restore full access.
>
> Questions: our Data Protection Officer, KRATIV.dpo@blueknight.xyz, reference {DEL reference}.
>
> KRAtiv Solutions - Daloy
> {date}

## E2 — Reminder (send on day [[23]])

**Subject:** 7 days left to export your Daloy data - {DEL reference}

> Dear {Organization} administrator,
>
> Your organization's Daloy account is read-only until **{read-only end date}**. After that date your users can no
> longer sign in, and by {deletion deadline} we delete your organization's data.
>
> If you haven't exported your data yet, you can do it from Reports, or reply to this email for a full export.
> {Already sent: "We sent your full export on {date}; the link works until {link expiry}."}
>
> Questions: KRATIV.dpo@blueknight.xyz, reference {DEL reference}.
>
> KRAtiv Solutions - Daloy
> {date}

## E3 — Deletion confirmation (send after §4 step 3)

**Subject:** Confirmation: your organization's Daloy data has been deleted - {DEL reference}

> Dear {Organization} administrator,
>
> We confirm that on **{deletion date}** we deleted your organization's data from Daloy, as set out in our Data
> Processing Agreement:
>
> - **Deleted:** your organization's requests (tickets), form answers, attachments links, comments and approval
>   history, workflows and settings, user accounts that belonged only to your organization, notifications and
>   email records, from our database and from the copies held by our service providers.
> - **Expiring by itself:** our database provider's restore history ends on **{deletion date + 7 days}**; service
>   logs expire by **{deletion date + 30 days}**. After those dates nothing of your organization's data remains with
>   us or our service providers. {Shared-Sheet history, per the decision in §4 Step 2.}
> - **Kept, as the law requires:** {invoices and payment records}, until {date / period}, protected and used for no
>   other purpose.
> - {C4: "Your own Google Sheet stays with you; we no longer have access to it."}
> - {Export: "We sent your full export on {date}." / "You told us on {date} that you did not need an export."}
>
> Please keep this letter for your records. Questions: our Data Protection Officer, KRATIV.dpo@blueknight.xyz,
> reference {DEL reference}.
>
> KRAtiv Solutions - Daloy
> {date}

**Related:** DPA v0.3 (`src/config/legal/dpa.js` "Return and deletion"), Terms v0.16 "Term and termination",
Privacy Policy "How long we keep it", `docs/planning/TEMPLATE_BreachNotice_ProviderIncident_20261115.md` (an open
breach is a legal hold), migration plan 0.9 (T1).
