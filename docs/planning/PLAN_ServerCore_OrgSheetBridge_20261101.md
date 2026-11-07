<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_ServerCore_OrgSheetBridge_20261101.md | Author: Kenneth R. Advento | Version: 1.6.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Add ORGANIZATIONS above companies (an organization owns its data store - e.g. its own Google Sheet - and onboards one or more companies); business logic moves to the server; Apps Script shrinks to a thin bridge to the organization's Sheet | Status: Draft (session 017zmKf6), decisions O1-O10 open, not built
REVISION HISTORY:
- v1.6.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §6b provider (Google) outages: classify vs store unavailable, /status page, banner + notice, billing unaffected, goodwill credits
- v1.5.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §6a store unavailable: billing / payments always in the platform store (received even when the org store is unreachable), unavailable state + banner, recovery digest, health history, 30-day suspension
- v1.4.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §5a O11 analysis (Vercel + Neon vs Cloud Run + Cloud SQL vs split) - recommendation only, NOT decided (user)
- v1.3.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | O1 decided: Apps Script bridge, set up by COPYING a template in the organization's Workspace (no ownership transfer: blocked across domains, and a web app keeps running as its deployer); §4a set-up + health
- v1.2.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User: "appscript only needed to write and read to the org's Google sheet db" - bridge = read / write only; sendMail and nextSequence removed (mail and numbering on the server)
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User: "appscript lives on the cloud now" - no more feature work in the Apps Script backend; admin scope (O0) and organizations are built in the cloud server only; interim rule for the shared Apps Script platform
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created; user: "appscript must now then live in server, appscript only to bridge the frontend to their sheet" + "organization is the owner of sheets, so they can onboard multiple companies"
===============================================================================
-->

# PLAN — Organizations, server core, organization Sheet bridge

## Context
Today the whole backend is one Apps Script file (~19,600 lines, v10.2) bound to **one** hard-coded Sheet
(`SPREADSHEET_ID`). Every company lives in that Sheet, separated by `company_id`. A customer that wants **its own
Google Sheet** can only get a full separate copy of Daloy, and every release must be pasted into every copy
(`docs/guides/GUIDE_Onboarding_GoogleWorkspace.md` §3).

**User decisions (1 Nov 2026):**
1. A new level, the **organization**, sits **above companies**. The organization is the customer account: it **owns
   the data store** (for example its own Google Sheet) and **onboards one or more companies** into it (a group of
   companies, or a firm running several client companies).
2. **The logic lives on the server (the cloud).** Apps Script stays only as a **bridge** between the server and the
   organization's Sheet, and nothing else.
3. **No more feature work in the Apps Script backend** (v10.2 is the last feature release there; fixes only).
   Organizations, admin scope and everything in this plan are built in the cloud server.

"Company" keeps its meaning (tickets, roles, ticket types, calendar, email settings stay per company).

This follows `docs/planning/PLAN_Migration_NeonVercel_20261030.md` (handlers in `api/_lib/`, Neon Postgres) and adds
**storage per organization**: the shared platform store, or the organization's own Google Sheet through the bridge.

## §1 The model
```
Platform (Daloy, KRAtiv)         platform admins (PLATFORM_ADMIN_UIDS)
 └─ Organization                 the customer: owns the data store, organization admins, (billing - O3)
     ├─ storage: 'platform' (shared)  or  'sheet' (its own Google Sheet via its bridge)
     ├─ Company A                ticket types, roles, workflows, calendar, email settings, tickets
     ├─ Company B
     └─ ...
Users: one identity (Google account) → member of one or more organizations → roles per company (as today)
```
| Concept | Today | Target |
|---|---|---|
| Where data lives | One platform Sheet | Per organization: platform store or its own Sheet |
| Who sets up companies | Any admin (global) | **Organization admins**, inside their organization only |
| Admin reach | **Global** - see §2 | Platform admin = everything; organization admin = its companies; company admin = one company |
| Users | Global profiles, roles per company | Same + membership per organization |
| Links / copying workflows between companies | Any two companies (plan-gated) | Free **inside** an organization; across organizations only with both sides' consent (O7) |

## §2 Prerequisite found while planning: admin rights are global
`isAdminUser` (`APPSCRIPT_v10.2_20261101_0710.txt` ~line 13149) returns true for anyone with an active role whose
**name contains "admin" in any company**, and admins see every ticket of every company (v10.0 visibility rules).
That was fine with one operator. **With two outside customers on the shared platform, customer A's admin can see
customer B.**

→ **Built into the cloud server from day one (not patched into Apps Script):** admin rights scoped to the admin's
organization; platform-wide actions stay with platform admins. Route test: an admin of company X gets "not found" for a
ticket of company Y (compliance A21 style).

→ **Interim rule while the Apps Script backend is live:** only **one outside customer** on the shared platform, **or**
no customer user gets a role whose name contains "admin" (the platform team does admin work for them). Lift the rule
when the cloud server is live.

## §3 Target architecture
```
Browser ─► /api/rpc (Vercel, sin1) ── ALL logic: sign-in, organization + company scope, permissions,
             │                         visibility, workflow, SLA, plan gate, notifications, audit
             ├─ org storage 'platform' ─► Neon Postgres (shared; rows carry organization_id + company_id)
             └─ org storage 'sheet'    ─► Bridge: Apps Script web app in the organization's Workspace
                                             (runs as the organization's account) ─► its Google Sheet
                                             (all its companies in one Sheet, rows carry company_id)
Vercel Cron ─► SLA escalation, email outbox, archive (were Apps Script triggers)
```
- **One code base, one release** for every organization, whatever its storage. The bridge changes only when its
  small contract changes (§4) - rarely.
- **The bridge only reads and writes the organization's Sheet** (user, 1 Nov 2026). No business rules, permissions,
  workflow, plan checks, mail, triggers or numbering: all of that is on the server. It accepts only signed requests
  from the server and does table I/O under one lock.
- A new company in a Sheet organization = new rows in the same Sheet. **No new Sheet, script or deployment per
  company.**

## §4 Bridge contract (v1, small on purpose)
One web-app endpoint, `POST`, JSON, signed by the server.

| Op | Does |
|---|---|
| `ping` | Bridge version, Sheet ID, tab list, **the account the bridge runs as** (`Session.getEffectiveUser()`) |
| `ensureSchema(tables)` | Create missing tabs / header columns (never deletes) |
| `read(table, filter?)` | Rows of a table: all, by ids, by `company_id`, or changed since a time |
| `batch(ops[])` | `append` / `update(id, fields, expectedVersion)` / `delete` across tables **inside one `LockService` lock**; a version mismatch fails the whole batch (optimistic locking) |

Nothing else. **Ticket numbers** are a server job: read the `sequences` row, then `batch` an `update` with
`expectedVersion` (retry on a version mismatch) - the bridge lock makes it safe. **Mail** is sent by the server's mail
provider for every organization (sender name and Reply-To per company, as today).

**Security:** a per-organization secret (Vercel encrypted env / secret store + the bridge's Script Properties); each
request carries `timestamp + HMAC(body)`; the bridge refuses unsigned or > 5-minute-old requests.
**Size target:** ≤ 500 lines, `BRIDGE_VERSION`, its own contract test.

## §4a Bridge set-up: the organization copies a template (decided 1 Nov 2026)
**Not ownership transfer.** Google Drive does not transfer ownership across domains (our account → their Workspace),
and even where it does, a web app set to "Execute as: Me" keeps running as **the account that deployed it** - the
bridge would still read and write as us, or break when our access is removed.

**Set-up (≈ 10 minutes, their Workspace admin):**
1. Daloy keeps one **master template**: a Google Sheet with the bridge script bound to it, shared view-only.
2. Organization settings → *Use your own Google Sheet* → a copy link
   (`https://docs.google.com/spreadsheets/d/<template id>/copy`). The copy - Sheet **and** script - is created in their
   Workspace, **owned by them** from the start.
3. In the copy: Extensions → Apps Script → run `setup()` once: approves the Sheets permission, stores the secret
   Daloy shows them, creates the tabs (`ensureSchema`).
4. Deploy → New deployment → Web app → *Execute as:* **Me** (their account) → *Who has access:* **Anyone** → copy the
   `/exec` URL.
5. Paste the URL into Daloy's organization settings → the server calls `ping` and accepts the bridge only if it runs
   as an account on the organization's domain and the signature matches.
6. Optional: they add the Daloy support account as **editor** (bridge upgrades, support).

**What keeps it working**
| Need | Why | How |
|---|---|---|
| Runs as **their** account | Their data access and quotas, not ours | `ping` reports the account; the server refuses a bridge running as a non-organization account |
| That account stays alive | A deleted person's account takes its files and deployments with it | Own it with a **role account** (e.g. `daloy-admin@theirdomain.com`), never a person's own account |
| Web apps for "Anyone" allowed | Otherwise the server can't reach the bridge | Their Workspace admin checks Drive sharing settings before set-up |
| Secret matches | Every server request is signed | Set in `setup()`; Daloy has a *Rotate secret* action (new secret shown → run `setup()` again) |
| No triggers in the bridge | Triggers belong to whoever created them and die with that access | By design: the bridge only reads and writes (§3) |
| Breakage is noticed | Otherwise users find out first | The server pings every few minutes; failures alert the organization admins and the platform team |

**Bridge upgrades** (rare - only when the §4 contract changes): the organization copies the new template script into
its project (or our support account does it as editor), then Deploy → Manage deployments → Edit → New version (the URL
stays the same). The server supports the current and the previous `BRIDGE_VERSION` during the change-over.

## §5 Open decisions (proposed defaults)
| # | Question | Proposed default |
|---|---|---|
| O1 | Bridge = Apps Script, or the server calls the **Sheets API** with a service account the organization shares its Sheet with? | ✅ **Decided: Apps Script bridge, set up by copying a template (§4a)**: runs in their Workspace as their account, they can switch it off. Keep the storage adapter open for a Sheets-API adapter later (faster, no Apps Script quotas, but needs sharing to an outside account) |
| O2 | Organizations on the shared platform | **Every customer is an organization**, also on shared storage (one model; a one-company customer = an organization with one company) |
| O3 | Plan / billing level | **Organization** pays (one invoice). Plan features apply to all its companies; limits (users, tickets / month) pooled across them. Moves v10.2's `company_subscriptions` to `organization_subscriptions` |
| O4 | Users in several organizations (an accountant serving clients) | Allowed. The app shows an organization switcher when a user has more than one |
| O5 | Who may create companies | Organization admins, up to a plan limit `companies` (new limit key) |
| O6 | Which organizations may use Sheet storage | Paid add-on / Enterprise; up to ~20k tickets / year per organization (Sheet cell limit + latency), else platform storage |
| O7 | Links / copies across organizations | Off by default; on only when both organization admins allow it |
| O8 | Caching | Server read cache per organization, short TTL, cleared on its own writes. Direct Sheet edits not supported (§7) |
| O9 | Move between storages | Export / import: Sheet → platform (outgrown), platform → Sheet (customer leaves with its data) |
| O10 | Order vs the Neon migration | Organizations + admin scope in the server and Postgres schema from Neon Phase 0; the Sheet adapter after Postgres works |
| O11 | Which cloud hosts the server | ⏳ **Not decided** (user, 1 Nov 2026). Analysis + recommendation in §5a: Vercel + Neon now, portable handlers, revisit on the listed triggers |

## §5a O11 analysis - which cloud (recommendation only, not decided)
| | **A. Vercel + Neon** (PLAN_Migration_NeonVercel) | **B. Google Cloud Run + Cloud SQL** | **C. Split: site on Vercel, server on Cloud Run** |
|---|---|---|---|
| Fits what exists | ✅ Site + proxy (`api/appscript-proxy.js`) already on Vercel | ❌ New platform for the server (Firebase is already Google - small plus) | ⚠️ Two platforms to deploy, watch and pay |
| Ops effort | Lowest: git push deploys; no containers | Medium: containers, IAM, Secret Manager, Cloud Scheduler, database set-up | Highest |
| Long jobs (bulk upload, SLA runs, slow bridge calls) | ⚠️ Function time limits - batch / chunk work (e.g. a 2,000-row upload to a Sheet organization) | ✅ Requests up to 60 min | ✅ server side |
| Scheduled jobs | ✅ Vercel Cron (frequent runs need the paid plan) | ✅ Cloud Scheduler | ✅ |
| Database | Neon: serverless Postgres, scales to zero, branches; AWS Singapore | Cloud SQL: managed Postgres, always-on monthly minimum (Neon also usable from Cloud Run) | Either |
| Cost at today's size | Low; **Hobby plan forbids commercial use → Pro needed before paying customers** | Low server cost; Cloud SQL minimum is the main line | Highest (two bills) |
| Latency for PH users | Singapore functions + Singapore DB | Singapore region | Same |
| Latency to the Sheet bridge | Apps Script run time (0.3-2 s) dominates; a few ms of network don't matter | "Closer to Google" saves ms on a call that takes seconds - **not a real advantage** | – |
| Customer IT perception | Fine for most; unfamiliar to some | ✅ "Runs on Google Cloud" is an easy yes for Workspace-heavy IT - **B's main real argument** | Mixed |
| Lock-in | Low if handlers stay plain Node | Low (containers) | Low |
| Billing / consoles | Vercel + Neon + Firebase separately | One Google bill and console with Firebase | Split |

**Recommendation (not a decision):** **A now**, with the handlers in `api/_lib/` kept plain Node (no Vercel imports),
so moving to Cloud Run later is a container file + a thin HTTP wrapper, not a rewrite.
1. Shortest path: the proxy, deploys and migration plan already target Vercel; B adds weeks of set-up first.
2. B's latency argument doesn't survive the numbers: Apps Script itself is the slow part.
3. B's real advantages (long jobs, one Google bill, IT comfort) matter later; chunking covers A's only real gap.

**Revisit (move to B) if any of these happens:**
- A customer contract / IT policy **requires Google Cloud** (or data staying with Google).
- Long jobs keep hitting Vercel limits even with chunking (e.g. large uploads to Sheet organizations).
- Vercel usage cost passes what a small Cloud Run set-up would cost (compare current price lists at that time).

**Do now, whichever wins:**
- Check the Vercel plan: move from Hobby to **Pro** before taking paying customers (Hobby terms: non-commercial only).
- Add "plain Node handlers - no Vercel imports in `api/_lib/`" to `npm run check:code-rules`, so portability is
  enforced, not hoped for.

## §6 What changes vs today
| Today (Apps Script v10.2) | Target |
|---|---|
| No organization level | `organizations` table; `companies.organization_id` |
| Logic + storage in one script | Logic in `api/_lib/handlers/`; storage adapter `platform` / `sheet` chosen per organization |
| One hard-coded Sheet | `organizations.storage`, `bridge_url`, `bridge_secret_ref` |
| Admin = global | Platform / organization / company admin scopes (§2) |
| Plan per company | Plan per organization (O3) |
| Triggers in the script | Vercel Cron |
| Mail from the script owner's Gmail | Server mail provider for all organizations (verified sending domain; sender name / Reply-To per company) |
| Release = paste into each copy | Release = deploy the server once |

## §6a When an organization limits access to its data store (General Terms §7.4a)
- **Billing never depends on the bridge:** subscriptions, usage counters, statements, invoices, payments and credit
  memos are KRATIV's records and live in the **platform store** for every organization - payments are received and
  recorded even while the organization's Sheet / database is unreachable (user, 1 Nov 2026). The bridge carries only
  Customer Data.
- **Organization state `store_unavailable`:** set when bridge health checks fail (§4a); one banner for the whole
  organization ("Your organization's data store isn't reachable - contact your administrator") instead of scattered
  errors; writes are refused (fail closed, no silent queue); KRATIV-side data (sign-in, logs, usage, billing) unaffected.
- **Read-only store** (protected tabs, view-only sharing): reads served, writes refused with the same banner.
- **Recovery:** `ping` + `ensureSchema` + cache flush, then resume; escalations that became due while unavailable are
  sent as **one digest** per admin, not a burst.
- **Health history** per organization (down at / back at / reason) - evidence for "not a Service failure" and for
  support.
- **After [[30]] days unavailable:** platform admin may suspend the subscription (Terms §7.4a), then normal
  termination; the organization keeps its store, KRATIV deletes only its own data.

## §6b Google (and other provider) outages (General Terms §10.2)
- **Two different causes, one symptom** (the bridge / Firebase / Sheets stop answering): **(1) the organization limited
  access** (§6a, the customer's doing) or **(2) a provider outage** (nobody's doing). The health history records which:
  when several organizations' bridges, Firebase sign-in or the shared Sheet fail at the same time, or Google's status
  feeds report an incident, it is classed as a **provider outage**; a single organization's bridge failing alone is
  classed as **store unavailable** (§6a).
- **Status sources:** the public `/status` page links the providers' dashboards (Google Workspace Status Dashboard,
  Google Cloud Status, Firebase Status, Vercel Status) and Daloy's own health. Later: read the providers' machine
  feeds where they offer one (e.g. Google Cloud's public incidents feed) to show a live "Google reports an incident"
  banner - check each feed's availability and terms first.
- **Banner + notice:** during a detected provider outage the app shows "Google services are having an outage -
  Daloy can't save changes right now" (with the status link); after [[1 hour]] the admins of affected organizations get
  a notice; a summary when it ends.
- **Billing:** unaffected (platform store); fees remain due. Goodwill credits for long outages are a platform-admin
  decision (Terms Waivers and credits), issued as a discount or credit memo; the health history gives the hours.
- **Apps Script quotas** (daily run time, mail) exhausted is treated like a provider outage for the user, but the
  platform team is alerted separately (it is a capacity problem, not Google's incident).

## §7 Honest limits (tell customers)
- **The server sees the data while it works on it.** Their Sheet holds the data at rest in their tenant; Daloy still
  processes it (privacy role: processor). "Our own Sheet" ≠ "Daloy never sees it".
- **No direct edits** in the Sheet: they skip permissions, the audit log and the cache, and can break tickets.
- **Slower than Postgres:** a bridge call is ~0.3-2 s. The server batches: one read and at most one write call per
  request.
- **Apps Script quotas** (run time, simultaneous runs, mail) are the organization's; a very busy organization belongs
  on platform storage.
- One Sheet holds **all** the organization's companies: the 10-million-cell limit is shared by them.

## §8 Phases
| Phase | Scope | Depends on |
|---|---|---|
| **O1** | Cloud server core: handlers on the server, Postgres with `organizations` + `organization_id`, admin scopes (§2), plan per organization (O3), Vercel Cron | PLAN_Migration_NeonVercel; O11 |
| **O2** | Organization admin screens: create companies, invite admins, organization switcher (O4) | O1 |
| **O3** | Storage adapter interface + per-organization routing; Postgres adapter = the O1 code | O1 |
| **O4** | Bridge v1 (§4) + contract test + Sheet adapter + cache | O3 |
| **O5** | Pilot: one Workspace organization with 2+ companies on its own Sheet via the template copy (§4a); rewrite onboarding guide §3 for the bridge | O4 |
| **O6** | Export / import between storages (O9), incl. moving existing Apps Script data to the cloud | O4 |

## §9 Progress
| Item | Status |
|---|---|
| Plan written | ✅ 1 Nov 2026 |
| O1-O10 decided | ⏳ |
| Interim one-customer / no-admin-role rule (§2) | ⏳ in force until O1 is live |
| O1 cloud server core | ⏳ |
