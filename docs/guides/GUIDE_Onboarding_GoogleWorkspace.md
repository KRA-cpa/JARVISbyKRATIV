<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_Onboarding_GoogleWorkspace.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: How to onboard a company that already uses Google Workspace onto Daloy - shared platform (default) or a dedicated instance on the company's own Google Sheet | Status: Active (written against AppScript v10.2 / proxy v9.4+); Option C and D are not built
REVISION HISTORY:
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Note on organizations (owner of the data store, onboards several companies) + global-admin warning; points to PLAN_ServerCore_OrgSheetBridge
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "add guide how to onboard a company already using google workspace, esp if they want their own google sheet as db"
===============================================================================
-->

# GUIDE — Onboarding a Google Workspace company

**Who this is for:** you (platform owner) onboarding a company whose staff already sign in with Google Workspace
accounts (`name@theircompany.com`).

> **Coming: organizations** (`docs/planning/PLAN_ServerCore_OrgSheetBridge_20261101.md`). The customer becomes an
> **organization** that owns the data store (e.g. its own Google Sheet) and onboards **one or more companies** into it.
> The logic moves to the server and Apps Script becomes a thin bridge to the organization's Sheet, so "own Sheet"
> no longer needs a full copy per customer. Until then, this guide describes what works **today**.
>
> ⚠️ **Before onboarding a second outside customer on the shared platform:** admin rights are global today (a user
> with an "admin" role in any company sees every company). Do plan phase **O0** (scope admin rights) first, or give
> customer admins a non-admin role.

**Good news first:** Workspace accounts *are* Google accounts. Daloy signs people in with Google (Firebase), so their
staff sign in with the account they already use - no new passwords.

---

## §0 Decide the set-up first

Ask the company one question: **"Does your data have to live in a Google Sheet that you own?"**

| | **A. Shared platform** (default) | **B. Dedicated instance on their Sheet** | **C. One script, a Sheet per company** | **D. Their Sheet as a copy** |
|---|---|---|---|---|
| What it is | Their company is one more company in the Daloy Sheet | A separate copy of Daloy: their Sheet + their Apps Script + its own web address | The shared script opens a different Sheet per company | Shared platform; Daloy copies their data into a Sheet they own |
| Built today? | ✅ | ✅ (manual, by copying) | ❌ not built | ❌ not built |
| Your effort per company | Minutes | Hours to set up + **every release pasted again** | Large one-off build | Medium one-off build |
| Their data in their Drive | ❌ | ✅ | ✅ | ✅ (a copy, read-only for them) |
| Recommended | **Yes, for most** | Only if they insist *and* pay for it | **No** (see §4) | **Yes - the better answer to "we want our data"** (build later) |

> **Why the shared Sheet is one place only:** the script has one hard-coded `SPREADSHEET_ID`
> (`appscript_files/APPSCRIPT_v10.2_20261101_0710.txt`, line ~218) and the Vercel proxy forwards to one
> `APPS_SCRIPT_URL`. Every company in that deployment lives in the same Sheet, separated by `company_id`.
> "Their own Sheet" therefore means **a separate deployment (Option B)**.

Most "we want our own Sheet" requests are really one of these - ask which:
1. *"We want to see / analyse our data in Sheets"* → **Option D** (or the report CSV export today).
2. *"Our data must not sit in someone else's account"* (policy / audit) → **Option B**.
3. *"We want to edit data directly in the Sheet"* → **say no**: direct edits skip the app's permissions, audit log and
   locks, and can break tickets. Not supported in any option.

---

## §1 Steps for every Workspace company (both A and B)

### 1.1 Check their Workspace admin settings (ask their IT admin)
| Setting (Google Admin console) | Why | What to ask |
|---|---|---|
| **Security → API controls → App access control** | If "unconfigured third-party apps" are blocked, staff can't sign in with Google to Daloy | Mark Daloy's OAuth client as **Trusted** (Configure new app → by OAuth client ID). Get the client ID from Firebase console → Authentication → Sign-in method → Google → Web SDK configuration |
| **Gmail → routing / spam** | Daloy's emails (invites, SLA alerts) come from the script owner's address | Allow-list the sender address, or invites land in spam |
| (Option B only) **Apps → Google Workspace → Drive and Docs → Sharing** | A web app open to "Anyone" may be blocked if sharing outside the organisation is off | See §3.2 |

### 1.2 Create the company and its first admin
1. Daloy → **Admin → Companies → New**: name, **Region** (country calendar + time zone, v10.1).
2. Platform admin → set the **plan** (v10.2: Basic / Advanced / Enterprise, trial end date).
3. **Admin → Users → Invite**: their admin's Workspace email, company, role *admin* (deploy guide §5d.3).
   The invite email links to the app; signing in with that Google account creates the profile.

### 1.3 Their admin sets up the company
- Ticket types (from the template library on Basic, own builder on Advanced+), approvers, roles.
- **Admin → Companies → 🔔 Email**: sender name = their company, **Reply-To = their helpdesk address**, footer.
- Invites for staff (or the ticket uploader on Advanced+ for many at once).

### 1.4 Tell their staff
- "Sign in with Google using your **work** account" (the sign-in asks which account - `prompt: select_account`).
- A personal Gmail won't work: the invite is tied to the work email.

---

## §2 Option A — shared platform (default)
Nothing beyond §1. Their data sits in the Daloy Sheet, owned by the platform account, separated by `company_id`
(server-side visibility, compliance A21). What to tell them:
- Their data is visible only to their users and the platform admins.
- They can export: the standard report as CSV; Enterprise has configuration export / backup.
- Privacy: Daloy is the **personal information processor** for their tickets (PLAN_PrivacyPolicy_DPA_20261101.md).

---

## §3 Option B — dedicated instance on their own Google Sheet

### 3.1 Choose who owns what
| Model | Sheet owner | Script owner | Pros | Cons |
|---|---|---|---|---|
| **B1 (recommended)** | Them (their Workspace) | Them (script bound to / in their Workspace); you are an **editor** | Data never leaves their tenant; mail sent from their domain with Workspace quotas (1,500 recipients / day vs 100 on a free Gmail) | You need their editor access for every release; their admin can remove you |
| B2 | Them | You (your account), Sheet shared with you as editor | You control releases | Script runs as **you** ("Execute as: Me"), so you can read all their data - often defeats the reason they asked; if they unshare the Sheet, the app stops |

### 3.2 Set-up (B1)
Do this together with their Workspace admin, signed in as the account that will own the script.

1. **Sheet:** in their Drive create an empty Google Sheet, e.g. `Daloy - <Company> - DB`. Note its ID (the long part of
   the URL between `/d/` and `/edit`).
2. **Script:** Extensions → Apps Script (or a standalone project in their Drive). Paste the **current** release file
   (`APPSCRIPT_v<ver>_<stamp>.txt`, the "Latest File" in `Claude.md`).
3. **Point it at their Sheet:** change the line `const SPREADSHEET_ID = "...";` to their Sheet ID. This is the **only
   code change**. Keep a note of it - you must redo it on every release (§3.4).
4. **Build the tables:** run `rebuildAllTables()` (dry run) → `rebuildAllTablesApply()` → `analyzeCurrentSchema()`
   (deploy guide §2-§4). Then the post-deploy steps that apply to the release (§5b-§5f: country calendars, etc.).
5. **Script Properties** (Project Settings): `PROXY_SECRET` (a **new** secret for this instance), `AUTH_MODE` = `warn`
   then `enforce`, `APP_URL` = this instance's web address, `PLAN_GATE`, `PLATFORM_ADMIN_UIDS` (you). Others as the
   deploy guide says.
6. **Deploy as web app:** Deploy → New deployment → Web app → *Execute as:* **Me** (the owner account) → *Who has
   access:* **Anyone** (the proxy does the real sign-in check). If "Anyone" isn't offered, their admin must allow it
   (§1.1, Drive sharing). Copy the `/exec` URL.
7. **Triggers:** run `installSLAEscalationTrigger()` once (asks for mail + trigger permission, as the owner).
8. **Front end + proxy:** a **separate Vercel project** from the same Git repo/branch, with env:
   `APPS_SCRIPT_URL` = their `/exec` URL, `PROXY_SECRET` = the same new secret, `AUTH_MODE`, `MAX_SESSION_HOURS`, and
   the Firebase settings. You can **reuse the same Firebase project**: add the new Vercel domain under Firebase →
   Authentication → Settings → Authorized domains.
9. **First admin + company:** sign in → make yourself admin (deploy guide §5d.1) → create their company → invite
   their admin (§1.2).
10. **Lock down the Sheet:** only the owner account (and you, as editor for releases) have edit access. Staff must
    **not** get edit access to the Sheet - all use goes through the app.

### 3.3 What they must agree to (put it in the contract)
- **No direct edits** to the Sheet; you are not liable for data broken that way.
- They keep your editor access for releases and support, or they accept staying on an old version.
- They run (or let you run) each release within an agreed window.
- Backups: Google Sheets version history + Enterprise config backup; their retention policy applies.

### 3.4 Every release, per Option B company
1. Open their script → paste the new release file → **set `SPREADSHEET_ID` back to their Sheet ID**.
2. Run the release's rebuild / migration steps from the deploy guide.
3. Deploy → Manage deployments → Edit → New version (the URL stays the same).
4. Redeploy their Vercel project from the same commit as the release.

This is the real cost of Option B: **every release × every dedicated company**. Price it in (setup fee + a higher
monthly fee), and cap how many you take on until §4 / Option D exist.

### 3.5 Limits to tell them
- A Google Sheet holds at most **10 million cells**; Apps Script has daily quotas (mail, run time). Fine for a small /
  mid company; a large one will outgrow it (see the Neon migration plan).
- Features that work **across** companies (links between companies, one platform admin view, copying workflows between
  companies) do not reach a dedicated instance - it is its own island.

---

## §4 Why not "one script, a Sheet per company" (Option C)
It sounds tidy but:
- Cross-company features, platform admin, plan catalogue and the ticket-number sequence all assume **one** Sheet.
- Every route would need to resolve the company **before** opening any table - a large, risky change across ~19,000
  lines.
- The roadmap moves the backend to Postgres (`docs/planning/PLAN_Migration_NeonVercel_20261030.md`); building
  per-company Sheets now is work thrown away later.

**Do Option D instead** when "we want our data" comes up often.

## §5 Option D — their Sheet as a copy (to build later)
Shared platform as usual; a scheduled job (the existing 15-minute trigger, or nightly) copies **their company's**
tickets, steps and audit rows into a Sheet **they own and share with the platform account**. Read-only for them in
spirit (edits are overwritten on the next copy). Gives them Sheets analysis, Looker Studio dashboards and a copy in
their tenant, without a second deployment. Candidate for an Enterprise feature. Plan it when two or more customers ask.

---

## §6 Checklist
| Step | A | B |
|---|---|---|
| Workspace admin: Daloy OAuth client trusted (§1.1) | ☐ | ☐ |
| Sender address allow-listed (§1.1) | ☐ | ☐ |
| Their Sheet + script created, `SPREADSHEET_ID` set (§3.2.1-3) | – | ☐ |
| Tables built, release steps done (§3.2.4) | – | ☐ |
| Script Properties incl. new `PROXY_SECRET` (§3.2.5) | – | ☐ |
| Web app deployed, triggers installed (§3.2.6-7) | – | ☐ |
| Vercel project + Firebase authorised domain (§3.2.8) | – | ☐ |
| Company, region, plan created (§1.2) | ☐ | ☐ |
| Their admin invited and signed in (§1.2) | ☐ | ☐ |
| Company email: sender name, Reply-To (§1.3) | ☐ | ☐ |
| Sheet edit access locked down (§3.2.10) | – | ☐ |
| Contract terms for no direct edits / releases (§3.3) | – | ☐ |
| Instance added to your release list (§3.4) | – | ☐ |
