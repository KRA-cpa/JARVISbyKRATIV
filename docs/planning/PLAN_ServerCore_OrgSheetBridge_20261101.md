<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_ServerCore_OrgSheetBridge_20261101.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Add ORGANIZATIONS above companies (an organization owns its data store - e.g. its own Google Sheet - and onboards one or more companies); business logic moves to the server; Apps Script shrinks to a thin bridge to the organization's Sheet | Status: Draft (session 017zmKf6), decisions O1-O10 open, not built
REVISION HISTORY:
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
- **The bridge has no business rules**: no permissions, workflow or plan checks. It accepts only signed requests from
  the server and does table I/O under one lock.
- A new company in a Sheet organization = new rows in the same Sheet. **No new Sheet, script or deployment per
  company.**

## §4 Bridge contract (v1, small on purpose)
One web-app endpoint, `POST`, JSON, signed by the server.

| Op | Does |
|---|---|
| `ping` | Bridge version, Sheet ID, tab list |
| `ensureSchema(tables)` | Create missing tabs / header columns (never deletes) |
| `read(table, filter?)` | Rows of a table: all, by ids, by `company_id`, or changed since a time |
| `batch(ops[])` | `append` / `update(id, fields, expectedVersion)` / `delete` across tables **inside one `LockService` lock**; a version mismatch fails the whole batch (optimistic locking) |
| `nextSequence(name)` | Ticket numbers etc., under the lock |
| `sendMail(...)` (optional) | Mail from the organization's own domain (Workspace: 1,500 recipients / day) |

**Security:** a per-organization secret (Vercel encrypted env / secret store + the bridge's Script Properties); each
request carries `timestamp + HMAC(body)`; the bridge refuses unsigned or > 5-minute-old requests.
**Size target:** ≤ 500 lines, `BRIDGE_VERSION`, its own contract test.

## §5 Open decisions (proposed defaults)
| # | Question | Proposed default |
|---|---|---|
| O1 | Bridge = Apps Script, or the server calls the **Sheets API** with a service account the organization shares its Sheet with? | **Apps Script bridge** (user decision): runs in their Workspace as their account, can mail from their domain, they can switch it off. Keep the storage adapter open for a Sheets-API adapter later (faster, no Apps Script quotas, but needs sharing to an outside account) |
| O2 | Organizations on the shared platform | **Every customer is an organization**, also on shared storage (one model; a one-company customer = an organization with one company) |
| O3 | Plan / billing level | **Organization** pays (one invoice). Plan features apply to all its companies; limits (users, tickets / month) pooled across them. Moves v10.2's `company_subscriptions` to `organization_subscriptions` |
| O4 | Users in several organizations (an accountant serving clients) | Allowed. The app shows an organization switcher when a user has more than one |
| O5 | Who may create companies | Organization admins, up to a plan limit `companies` (new limit key) |
| O6 | Which organizations may use Sheet storage | Paid add-on / Enterprise; up to ~20k tickets / year per organization (Sheet cell limit + latency), else platform storage |
| O7 | Links / copies across organizations | Off by default; on only when both organization admins allow it |
| O8 | Caching | Server read cache per organization, short TTL, cleared on its own writes. Direct Sheet edits not supported (§7) |
| O9 | Move between storages | Export / import: Sheet → platform (outgrown), platform → Sheet (customer leaves with its data) |
| O10 | Order vs the Neon migration | Organizations + admin scope in the server and Postgres schema from Neon Phase 0; the Sheet adapter after Postgres works |
| O11 | Which cloud hosts the server | Vercel functions (sin1) + Neon, as in PLAN_Migration_NeonVercel - **confirm** (alternative: Google Cloud Run, closer to Workspace customers' Google tenancy) |

## §6 What changes vs today
| Today (Apps Script v10.2) | Target |
|---|---|
| No organization level | `organizations` table; `companies.organization_id` |
| Logic + storage in one script | Logic in `api/_lib/handlers/`; storage adapter `platform` / `sheet` chosen per organization |
| One hard-coded Sheet | `organizations.storage`, `bridge_url`, `bridge_secret_ref` |
| Admin = global | Platform / organization / company admin scopes (§2) |
| Plan per company | Plan per organization (O3) |
| Triggers in the script | Vercel Cron |
| Mail from the script owner's Gmail | Bridge `sendMail` (their domain) or a mail provider |
| Release = paste into each copy | Release = deploy the server once |

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
| **O5** | Pilot: one Workspace organization with 2+ companies on its own Sheet; rewrite onboarding guide §3 for the bridge | O4 |
| **O6** | Export / import between storages (O9), incl. moving existing Apps Script data to the cloud | O4 |

## §9 Progress
| Item | Status |
|---|---|
| Plan written | ✅ 1 Nov 2026 |
| O1-O10 decided | ⏳ |
| Interim one-customer / no-admin-role rule (§2) | ⏳ in force until O1 is live |
| O1 cloud server core | ⏳ |
