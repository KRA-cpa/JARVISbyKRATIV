<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_Migration_Unified_20261108.md | Author: Kenneth R. Advento | Version: 1.6.0
Created: 8 November 2026 UTC+8 (Philippine Standard Time) | Modified: 11 November 2026 UTC+8 (Philippine Standard Time)
Purpose: THE migration plan + step-by-step, top to bottom: Apps Script / Google Sheets → Google Cloud Run + Neon Postgres (all servers in Asia), previews on Vercel, Google Sheets kept as a customer option; then the remaining v10.2 features and organizations on the new server | Status: Active - current roadmap (Phase F done, H.3 production deployed - custom domain pending, 0.7 schema generated)
REVISION HISTORY:
- v1.6.0 | 11 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | H.3 Claude part done: production revision `daloy-00007-z66` (100 %) + Firebase Hosting live at krativ-daloy.web.app (user: test site "2 is ok"); custom domain / authorized domains / APP_URL wait for the user. 0.7 part 1: `scripts/gen-ddl.js` + `scripts/db/ddl-rules.js` → `migrations/postgres/0001` (54 tables: 45 from TABLE_SCHEMAS + 9 new) / `0002` (uniques + FKs after the load, with a preflight report); `npm run check:ddl`; checked on real Postgres (PGlite). Session 44cbe47d
- v1.5.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Before H.3: UI fixes from the test-site review built + test-deployed (Dashboard A, compact Tickets filters, Reports dates, footer; handoff HANDOFF_UIFixes_ProdMove_20261109.md); H.4 redirect ready on branch `h4/vercel-previews-only` (merge after H.3). Session 5f83b40e
- v1.4.0 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | H.1 + H.2 done (gate met; the Git Bash path-rewrite bug found and fixed in deploy-cloudrun.sh v1.2); new step 3.6 - Admin "Backend Integration Status" panel flagged (user: "flag for update once core is migrated off appscript (unless clients using Sheets)"); 3.1 STATUS note (Cloud Run build already drops Vercel)
- v1.3.0 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | D12 servers in a new Google project `krativ-daloy` (user: "iwant to change to KRATIV_DALOY" → "New project krativ-daloy for servers"); sign-in stays in `jarvisbyerp` until Better Auth; H.1 updated
- v1.2.0 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Postgres without a subscription (user: "can we setup postgress without subscription?", "no SLA jobs yets"): Neon Free while building (0.4, its limits); step 1.1 sync no longer every 5 min around the clock (that keeps Neon awake ~183 CU-h > the Free 100) - every 5 min weekdays 07:00–20:00 + hourly otherwise (~81 CU-h; every 30 min otherwise ≈ 90, too close); risk line
- v1.1.0 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | D11 attachments in the client's Google Workspace Drive (user: "plan attachments on google drive (client's google workspace acct)") - PLAN_Attachments_ClientDrive_20261109.md; Files layer = client Drive / links, platform object storage deferred (step 0.4); schema reserved in 0.7; new step 4.7 (v10.3 / v10.4 → 4.8)
- v1.0.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 61523343; user: "might need a unified migration plan + step-by-step"). Folds in CHECKLIST_Deploy_PostgresNeon_20261108.md (now a pointer) and the phase lists of PLAN_Migration_NeonVercel_20261030.md §6 and PLAN_ServerCore_OrgSheetBridge_20261101.md §8
===============================================================================
-->

# PLAN — Unified migration + step-by-step

**How to use:** work top to bottom. Each step has an **owner** (**You** = the user: accounts, payments, DNS, legal,
approvals, the Apps Script editor; **Claude** = code, scripts, tests, docs, deploy commands after your go), a **gate**
(must be true before the next step) and a **Details** link. Tick `[x]` as you go and log progress in `REF_SessionLog.md`.

**The detail lives elsewhere (not repeated here):**
| Doc | Role |
|---|---|
| `docs/planning/PLAN_Migration_NeonVercel_20261030.md` | **Design reference:** schema §4, heavy use §5, data load transform §7, tests §8, SLA §9, client DB §11, v10 tables §12 |
| `docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md` | **Runbook for Phase H:** exact commands A–F |
| `docs/planning/CHECK_HostingPricing_20261108.md` | **Evidence:** prices per location, catches, DPA / Terms / Privacy implications |
| `docs/planning/PLAN_ServerCore_OrgSheetBridge_20261101.md` | **Organizations + Sheet bridge design** (Phase 5) |
| `docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md` | **Plans / subscriptions design** (Phase 4: P2–P5, §11 Q1 / Q2) |
| `docs/planning/PLAN_FeatureGaps_Volume_20261031.md` | Feature design (v10.x, §6 on Postgres) |
| `docs/planning/PLAN_Attachments_ClientDrive_20261109.md` | **Attachments in the client's Drive** (D11, step 4.7) |

---

## §1 Decisions
| # | Decision | Date / source |
|---|---|---|
| D1 | **Servers must be in Asia**; rank options PH > SEA > rest of Asia > cheapest; recommend the cheapest overall with its catches and legal impact | user, 8 Nov 2026; CHECK §1 |
| D2 | No provider has a Philippine database / app region; the cheapest all-Asia stack is **Cloud Run Singapore + Neon Singapore + Better Auth + SES Singapore** | CHECK §2, §6 |
| D3 | **Production off Vercel** → Cloud Run `asia-southeast1` (service `daloy`) **behind Firebase Hosting** at **`daloy.blueknight.xyz`** | user ("move production to not vercel, preview in vercel"; domain blueknight.xyz) |
| D4 | **Previews stay on Vercel Hobby** - the user accepts the commercial-use risk | user, 8 Nov 2026 |
| D5 | Front door = Firebase Hosting (Cloud Run domain mapping is *"not production-ready"*) | CHECK §4 |
| D6 | **Apps Script frozen now: fixes only.** v10.2 P2–P5 and queue Q1 / Q2 are built **on the new server after the write cutover** (Phase 4) | user, 8 Nov 2026 |
| D7 | **Google Sheets / Apps Script stays a customer option** ("there should be leeway for appscript/gsheet customers - this is an option") - bridge (long term) + dedicated instance (interim), §2 | user, 8 Nov 2026 |
| D8 | Cloud choice O11 (PLAN_ServerCore §5a) = **Cloud Run + Neon** (not Cloud SQL) | follows D2–D3 |
| D9 | `organizations` + `organization_id` in the **first** Postgres schema (one default organization for today's data) - O1's schema without a second migration later | this plan |
| D10 | Method = PLAN_Migration Option A: copy Sheets → Postgres, move reads, freeze + move writes, clean up; the API contract (`{ action, ...payload }` → `{ success, data, message }`) never changes | user, 30 Oct 2026 |
| D11 | **Attachments are uploaded into the client's own Google Workspace Drive** (a Shared Drive): option 1 role-account OAuth (`drive.file`) or option 2 Daloy service account as a member; on / off per organization and company (off by default); Daloy checks the ticket rules, then serves the file; folder `<COMPANY>/<TYPE>/<YYYY>/<ticket_number>/`; slots per ticket type. No Workspace → links only; **platform object storage deferred**. Built in step 4.7 - `docs/planning/PLAN_Attachments_ClientDrive_20261109.md` | user, 9 Nov 2026 |
| D12 | **Servers in a new Google project `krativ-daloy`** (display name KRATIV DALOY - `KRATIV_DALOY` is not a valid id; ids never change): Cloud Run, Firebase Hosting, Secret Manager, billing, later the Drive service accounts (`daloy-org-<id>@krativ-daloy.iam.gserviceaccount.com`) and the Better Auth / Drive OAuth clients. **Sign-in stays in `jarvisbyerp`** (Firebase Auth) until Better Auth (1.3), so no user moves; then `jarvisbyerp` retires. `deploy-cloudrun.sh` v1.1 keeps the two ids apart | user, 9 Nov 2026 ("iwant to change to KRATIV_DALOY" → "New project krativ-daloy for servers") |
| D13 | **Emails go through the client's own mail service** - no platform email provider (SES dropped from the stack). Same shape as D11: a connection per organization (company may override). Details E1–E7 below proposed 14 Nov 2026, awaiting ok / no / skip | user, 14 Nov 2026 ("no emails first", "emails should go throug client service") |
| **To confirm** | Neon Singapore + Better Auth for the data move (step 0.1); D13 details E1–E7 | - |

**D13 details (proposed defaults):**
- **E1** Connection kinds: **Google Workspace** (Gmail API, one role mailbox such as `daloy@client.com`, scope `gmail.send` only), **Microsoft 365** (Graph `Mail.Send` for one mailbox), or **SMTP** (the client's host / port / user + app password, stored encrypted). Set per organization; a company may use its own.
- **E2** The sender is that mailbox; the v9.6 company settings (sender name, Reply-To, CC, footer, on / off) stay.
- **E3** *(revised 14 Nov 2026, user: "initial: sa google service natin, since we have to invite the client admin")*
  **Initial sender = KRAtiv's own Google mailbox.** The invite to the client admin - and the organization's
  notifications until it connects its own mail - go out from Daloy's Google sender; once the client connects (E1), its
  mail goes through its own service. Catch: Google daily sending limits apply to our mailbox (Workspace ≈ 2,000 / day per
  user; a consumer Gmail / Apps Script MailApp only 100 recipients / day) - a **Google Workspace** mailbox on our domain
  is needed before several clients share it.
- **E4** Platform mail to organization admins (trial end, invoices, new-organization invites) always goes from that same
  KRAtiv Google mailbox.
- **E5** Google: offer both D11-style options - role-account OAuth (needs Google's verification of our OAuth app for the sensitive `gmail.send` scope, weeks) **or** a Daloy service account with domain-wide delegation limited to `gmail.send` for the one mailbox (the client's super admin grants it; no Google verification).
- **E6** Until the connector ships (Phase 4, with 4.7 attachments), **Apps Script keeps sending**: after the write cutover it drains the Postgres `email_outbox` through a small bridge route - so Phase 2 does not wait for D13.
- **E7** The table is reserved in the first schema now (`mail_connections`, like `drive_connections`) so no later migration.

## §2 Storage options for customers (D7)
| Option | Where the data lives | Asia rule | Features | Limits | Set-up |
|---|---|---|---|---|---|
| **Platform store** (default) | Neon Postgres, Singapore | ✅ | everything, incl. Phase 4 | Neon plan limits | sign-up / invite |
| **Own Google Sheet via the bridge** (Phase 5) | the customer's Google Sheet, in its own Google account | n/a - the customer's choice (say so in Terms / DPA) | the server's features | Apps Script quotas + speed, no Asia pinning (PLAN_ServerCore §7) | the customer copies the bridge template (PLAN_ServerCore §4a) |
| **Dedicated Apps Script instance** (available now, interim) | the customer's Google Sheet + its own copy of the v10.2 file | n/a - customer's choice | **frozen at v10.2** + fixes | one paste per release per copy; no Phase 4 features | `docs/guides/GUIDE_Onboarding_GoogleWorkspace.md` §3; later moved to the bridge or Postgres (step 5.5) |

## §3 Target architecture
```
Today:        jarvis-by-erp.vercel.app ─► Vercel /api/appscript-proxy ─► Apps Script ─► shared Sheet
After H:      daloy.blueknight.xyz ─► Firebase Hosting ─► Cloud Run "daloy" (sin) /api/appscript-proxy ─► Apps Script ─► Sheet
              previews: Vercel branch builds ─► jarvis-by-erp.vercel.app/api/appscript-proxy
After 2:      daloy.blueknight.xyz ─► Firebase Hosting ─► Cloud Run /api/rpc ─► Neon Singapore
                                                          ├─ Cloud Scheduler ─► /api/cron/* (SLA, outbox, nightly)
                                                          └─ SES Singapore (email)
After 5:      + Sheet organizations: Cloud Run ─► storage adapter ─► bridge (Apps Script in the customer's Workspace) ─► their Sheet
```
| Layer | After Phase 2 | Region | Monthly (pilot / 1–3 cos / 10 cos) |
|---|---|---|---|
| Site | Firebase Hosting (Vercel for previews) | Google CDN; Vercel previews | $0 within 10 GB + 360 MB / day |
| API | Cloud Run `daloy` (`server/app.js`) | `asia-southeast1` | ≈ $0 / ≈ $0 / small (Tier 2 rate UNVERIFIED) |
| Database | Neon Postgres (Free → Launch) | `aws-ap-southeast-1` | $0 / ≈ $11 / ≈ $37 |
| Sign-in | Better Auth in Neon (Google sign-in), cookie `__session` | Singapore | $0 |
| Jobs | Cloud Scheduler (3 jobs free) | `asia-southeast1` | $0 |
| Email | Amazon SES | `ap-southeast-1` | ≈ $0.15 / $0.60 / $4.50 |
| Files | the **client's Google Workspace Drive** via `drive_connections` (D11); links otherwise; platform object storage **deferred** | the client's Google account (their choice) | $0 storage; download egress only |
| **Total** | | | **≈ $0.15 / ≈ $12 / ≈ $42–47** (CHECK §6) |

## §4 Phase map
| Phase | What | Gate | State |
|---|---|---|---|
| **F** | Freeze Apps Script features | written down, everyone follows it | ✅ 8 Nov 2026 |
| **H** | Host move: production to Cloud Run + Firebase Hosting, previews on Vercel (backend unchanged) | `daloy.blueknight.xyz` serves production | code ready (`d342c68`) |
| **0** | Foundations: decide + verify, accounts, baseline, `/api/rpc` + fallback, schema, export / load / reverse export, legal drafts + notice | data loads into Neon `dev` and matches | - |
| **1** | Sync + reads + sign-in move | ported reads meet the `Claude.md` budgets | - |
| **2** | Write cutover | load test passes; one transition per double approval | - |
| **3** | Clean-up + publish legal + Neon Launch + retire the shared Apps Script deployment | first paying customer can start | - |
| **4** | New features on the server (v10.2 P2–P5, Q1 / Q2, then v10.3 / v10.4) | each feature live with tests | - |
| **5** | Organizations + the Google Sheets option (O2–O6) | one Workspace pilot on its own Sheet | - (may start beside 4) |
| **∞** | Ongoing | - | - |

---

## §5 Step-by-step

### Phase F — Freeze Apps Script (done)
- [x] **You** - Apps Script gets **fixes only** from now on (D6). A fix = a new timestamped file
      (`APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt`), its `Deploy description` says "also paste into each dedicated copy".
- [ ] **You** - finish the **open v10.2 user steps** so production is in a known state before anything moves
      (`docs/planning/SESSION_DUMP_41700a8e_20261101.md` §3): JARVIS Admin v1.4, the migrations (participants backfill,
      `migrateCountryCalendars`, `seedCompanySubscriptionsApply`), `PLATFORM_ADMIN_UIDS`, browser checks.

### Phase H — Host move (runbook: `GUIDE_Deploy_CloudRun_FirebaseHosting.md`)
- [x] **Claude** - code: `server/app.js`, `Dockerfile`, `firebase.json` / `.firebaserc`, `scripts/deploy-cloudrun.sh`,
      `scripts/test-cloudrun-server.js` (13) - commit `d342c68`.
- [x] **H.1 You** - set-up: new project **`krativ-daloy`** (D12) on Blaze (same billing account) + budget alerts,
      `gcloud` / `firebase` login, APIs, the two secrets, secret access, production's `AUTH_MODE`. *Details: GUIDE §A.*
      **Done 9 Nov 2026:** budget "Daloy monthly" **$10** (alerts $5 / $9 / $10 / $20) + Firebase's own $5 budget;
      secrets checked by shape only (URL = `script.google.com/…/exec`, proxy secret 64 characters, no whitespace);
      `AUTH_MODE=enforce`.
- [x] **H.2 Claude → You** - test revision `scripts/deploy-cloudrun.sh test first`; you sign in on it (read / seed data
      only - it uses the production Apps Script). **Gate:** `auth: verified` in the logs, no 5xx. *GUIDE §B.*
      **Gate met 9 Nov 2026** (revision `daloy-00002-weq`): 8 signed-in requests, all `verified` / 200, no 5xx; tickets
      load (`getTickets` ~5 s, `getDashboard` 7.6 s, `getUserProfile` 9.7 s incl. a cold start - Apps Script time, step
      0.5 measures it). **Found + fixed:** revision 1 had `C:/Program Files/Git/api/appscript-proxy` as its API address
      (Git Bash rewrites `/…` env values for Windows programs) → no API call reached the server; `deploy-cloudrun.sh`
      v1.2 builds with `MSYS_NO_PATHCONV=1` / `MSYS2_ENV_CONV_EXCL=REACT_APP_` and refuses to deploy a build without the
      right address. Same day: header no longer wraps (icons below 1280 px, no header clock - the dashboard has one),
      `/status` lists Google only on the Cloud Run build (`REACT_APP_HOSTING=cloudrun`), the footer's Claude credit removed.
      Test URL `https://first---daloy-xmczwkduaa-as.a.run.app` (service URL
      `https://daloy-1062039730837.asia-southeast1.run.app`, no public link to it); `ping` 200 through Apps Script
      (`x-backend: gas`, `cache-control: no-store`, API 10.2.0); a request without a token → 401 `NOT_SIGNED_IN`.
- [x] **Before H.3 - UI fixes from the test-site review** (handoff `HANDOFF_UIFixes_ProdMove_20261109.md` §1-§1d,
      10 Nov 2026, commits `749bd4a` / `c3b824f` / `52813f8`): Dashboard A (counts from `getDashboard`, one 10-ticket
      page, old SLA widgets deleted), compact Tickets filters (Clear now clears tags), Reports date widths, footer pinned
      on the signed-in pages. Test revision `daloy-00005-sos` on the `first` tag (pages 200, `ping` via `gas`, `no-store`). **You:** check the three pages there.
- [x] **H.3 Claude + You** - production deploy, Firebase custom domain `daloy.blueknight.xyz` (MX / forwarding records
      untouched), Firebase authorized domain, Script Property `APP_URL`. **Gate:** the new domain works end to end.
      *GUIDE §C.* **Claude part done 11 Nov 2026:** `AUTH_MODE=enforce` production deploy → revision `daloy-00007-z66`
      takes 100 % (test tag `first` stays on `daloy-00006-hib`), Firebase Hosting released; `krativ-daloy.web.app`: pages +
      `/plans` 200, `ping` 200 (`x-backend: gas`, `no-store`, API 10.2.0), no token → 401 `NOT_SIGNED_IN`, no errors /
      5xx in the revision logs. Subdomain `daloy` kept (user asked daloy vs daloy-krativ; blueknight.xyz is interim).
      **Gate met 11 Nov 2026:** DNS = **CNAME `daloy` → `krativ-daloy.web.app`** (Firebase asked for a CNAME, not an A
      record; the `hosting-site=` TXT on `daloy` had to go - a CNAME can't share a name) + TXT `_acme-challenge.daloy`;
      certificate Google Trust Services WR3 (to 9 Feb 2027, auto-renewed); authorized domains `daloy.blueknight.xyz` +
      `krativ-daloy.web.app` in `jarvisbyerp` (checked); `APP_URL` set (user). On the domain: `/`, `/plans`, `/status`,
      `/dashboard` 200 with strict TLS, `ping` via `gas` + `no-store`, no token → 401; the user signed in and saved a
      display time zone (user: "timezone change = reflected"). Optional: remove the old `jarvis.blueknight.xyz` authorized domain.
- [x] **H.4 Claude → You** - **Done 14 Nov 2026** (user: "push"): merged (`6ced602`), 22 checks passed, main3 pushed,
      Claude.md v4.6 rule 3 + memory `feedback_batch_then_deploy_check` updated. **Found:** a second Vercel production
      domain `jarvis.blueknight.xyz` still served the old app → redirected too (`d1602c3`, pushed before the switch).
      Vercel wanted the branch to exist → `vercel-production-retired` created on GitHub at `d1602c3` (= the redirect
      build; **never push to it**). Branch Tracking saved (user screenshot); no redeploy. **Gate met:**
      `jarvis-by-erp.vercel.app/plans` + `jarvis.blueknight.xyz/plans` → 307 `daloy.blueknight.xyz/plans`, `/api` still 200.
      Step 4 below (redirect `permanent: true`) after a week without problems. (`vercel.json` was on branch `h4/vercel-previews-only`, commit `1db367a`; merged into
      main3 only after H.3) `vercel.json` host-scoped redirect, one last Vercel production push, then Vercel Production
      Branch → `vercel-production-retired`. Update `Claude.md` working rule 3 + memory `feedback_batch_then_deploy_check`
      (production check = Cloud Run). **Gate:** `jarvis-by-erp.vercel.app/plans` lands on the new domain; pushes build
      previews only. *GUIDE §D.*
- **Rollback:** GUIDE §E.

### Phase 0 — Foundations
- [ ] **0.1 You** - confirm the data stack (Neon Singapore + Better Auth + SES Singapore). *CHECK §6.*
      **14 Nov 2026 - email deferred** (user: "no emails first"): no AWS / SES account now. Until the email provider is
      chosen, notification emails keep going out from **Apps Script** (MailApp + the 15-minute outbox trigger) as today;
      the new server writes in-app notifications + `email_outbox` rows only. The provider must be decided **before the
      write cutover (Phase 2)**, when tickets stop flowing through Apps Script. Neon (1), Better Auth (2), Cloud Scheduler
      (4), attachments in the client's Drive (5): awaiting the user's answer.
- [ ] **0.2 You + Claude** - verify the UNVERIFIED prices (Cloud Run Tier 2 Singapore, egress) in the Google calculator;
      watch the budget alerts since Phase H. *CHECK §4.*
- [ ] **0.3 You** - Data Privacy Act / IT clearance to move company data to Singapore; the IP / invention-assignment
      clause; a lawyer reviews the DPA / Privacy / Terms changes. *CHECK §7; PLAN_Migration §10.*
- [ ] **0.4 You** - accounts: Neon project **`aws-ap-southeast-1`** (branches `main`, `dev`; **Free while building** - no
      subscription, no monthly fee: 100 CU-h / project / month, 0.5 GB, suspends after 5 min idle, 6 h restore history,
      at the limit the compute stops until next month (data kept); **Launch** - pay per use, no minimum - before the
      first paying customer, CHECK §2.1 / §5); *(AWS / SES part deferred 14 Nov 2026 - see 0.1)* AWS +
      **SES `ap-southeast-1`** (domain DKIM / SPF / DMARC on blueknight.xyz, production-access request - the sandbox is
      200 / 24 h); connection strings and keys in Secret Manager. *(Object storage in Asia: **deferred** - files go to the
      client's Drive, D11; revisit only if a customer without Workspace needs uploads.)*
- [ ] **0.5 Claude (You run)** - baseline: `node scripts/measure-api-latency.js --url https://daloy.blueknight.xyz/api/appscript-proxy`
      (5 runs per action), recorded in `docs/planning/REVIEW_AppScriptReco_20261030.md` §5.
- [ ] **0.6 Claude** - `docs/reference/PRODUCTION_REQUIREMENTS.md` first (new packages: `@neondatabase/serverless`,
      `drizzle-orm` / `drizzle-kit`, `better-auth`), then `/api/rpc` in `server/app.js`: handler registry
      (`api/_lib/handlers/<group>.js`), the Apps Script fallback for unported actions, `X-Backend: pg | gas` +
      `query_count` in the log line; `npm run check:api-contract` / `check:code-rules` / `test:server` pass. *PLAN_Migration §2.*
- [ ] **0.7 Claude** - schema: `scripts/gen-ddl.js` from the **49 tables** of `TABLE_SCHEMAS` (latest AppScript file) →
      migration `0001` with types, keys, constraints, the day-one indexes, the v10 tables, **plus `organizations` +
      `organization_id`** (D9) **and the attachment columns / tables of D11** (`drive_connections`, the
      `ticket_attachments` additions, attachment rules + slots, step-required slots - PLAN_Attachments §4);
      `npm run db:migrate` on Neon `dev`. **Gate:** migrations apply from empty; `EXPLAIN` for the
      hot paths in `docs/perf/`. *PLAN_Migration §4, §12; PLAN_ServerCore §1–§2.*
      **Part 1 done 11 Nov 2026:** `scripts/gen-ddl.js` v1.0 (TABLE_SCHEMAS has **45** tables in v10.2, not 49) +
      the rules `scripts/db/ddl-rules.js` (types, keys, indexes, references, 9 new tables: organizations,
      organization_members, approval_delegations, ticket_comments, idempotency_keys, drive_connections, attachment rules /
      slots / step-required slots) → `migrations/postgres/0001_initial_schema` (tables, PKs, 45 indexes) and
      `0002_constraints` (13 unique rules + 76 FKs, applied **after** the load once `0002_constraints.preflight.sql` reports 0
      orphans / duplicates). `npm run check:ddl` (drift + `scripts/test-gen-ddl.js`, 8 tests; `--pglite <dir>` adds a run on
      real Postgres - passed). Left for part 2: the `db:migrate` runner (needs the 0.6 packages), apply on Neon `dev`, `EXPLAIN`.
- [ ] **0.8 Claude writes, You run in the editor** - a **read-only export** route in a new AppScript fix file;
      `repairCompanyLocksApply()` first; the transform (booleans, blank → NULL, `jsonb`, dates, the **`TS_UTC_SINCE` −8 h
      rule** per column); load into `dev` in dependency order. **Gate:** row counts per table + 10 tickets end to end.
      *PLAN_Migration §7.*
- [ ] **0.9 Claude** - **reverse export** (Postgres → Sheets) written **and tested** - the rollback for Phase 2, and the
      first half of the bridge / export work (Phase 5).
- [ ] **0.10 Claude drafts, You send** - new DPA Annex C + transfers, Privacy providers / transfers / cookies, Terms
      providers + the Sheets-option wording (D7), shown on previews; the **new Sub-processor notice** to every customer
      admin. **Gate:** notice date recorded; Phase 2 is ≥ **[[30]] days** later. *CHECK §7.*

### Phase 1 — Sync, reads, sign-in
- [ ] **1.1 Claude** - sync → `/api/cron/sync` (watermark on `updated_at` / `created_at`, upsert into Neon `main`)
      from **2 Cloud Scheduler jobs** (time zone Asia/Manila, inside the 3 free jobs): job A **hourly, always**
      (`0 * * * *`); job B the other 5-minute slots **Mon–Fri 07:00–20:00** (`5-55/5 7-19 * * 1-5`) - together every
      5 min in working hours, hourly otherwise, never two runs at once. Not every 5 min around the clock: Neon suspends
      only after 5 min idle, so that keeps it awake ~730 h ≈ 183 CU-h, over the Free 100. This schedule ≈ **81 CU-h**
      (0.25 CU × [22 weekdays × 13 h + 22 × 11 night runs × 5 min + 8 weekend days × 24 runs × 5 min] ≈ 0.25 × 322 h);
      every 30 min outside working hours would be ≈ 90 - too close to 100. The first morning run catches up on the
      night (the watermark). No SLA / outbox jobs on Postgres before 2.4. No Postgres backup job yet - Sheets stays the
      source of truth until Phase 2. **Gate:** lag < 5 min in working hours, < 60 min outside them; Neon CU-h on track
      for < 100 a month. *PLAN_Migration §6 Phase 0 item 5.*
- [ ] **1.2 Claude** - port the read groups (dashboard, reference data, users, reports, notifications, SLA reads);
      handler tests on a Neon branch per run (the `ROUTES_TEST_v9.x` scenarios); Vercel preview first, then production.
      **Gate:** every ported read meets its `Claude.md` p95 + query budget; `X-Backend: pg`. *PLAN_Migration §6 Phase 1, §8.*
- [ ] **1.3 Claude** - Better Auth (Google sign-in) beside Firebase: tables in Neon, cookie **`__session`** (Firebase
      Hosting passes only that one), `users` + `auth_identities` (the Firebase uid stays the user id), admin-approved
      linking, the v9.6 allow-list + invites. **Gate:** an existing user signs in with Better Auth and sees the same
      tickets. *PLAN_Migration §3.*

### Phase 2 — Write cutover (≥ [[30]] days after 0.10)
- [ ] **2.1 You** - announce the maintenance window.
- [ ] **2.2 You** - freeze writes: Script Property `READ_ONLY=true` (the app shows a maintenance banner).
- [ ] **2.3 Claude** - final sync; row counts; spot checks.
- [ ] **2.4 Claude** - one deploy: **all** write groups (ticket loop, workflow admin, users and roles, company admin,
      tags and sharing, SLA escalation) + Scheduler jobs (SLA every **30 min on Neon Free** / 5–15 min on Launch, the
      `email_outbox` drain through **SES**, nightly backup / archive). *PLAN_Migration §6 Phase 2, §9.*
- [ ] **2.5 Claude + You** - smoke tests (create, approve, return, reject, reopen, cancel; two approvals on one ticket →
      exactly one transition); stop the sync job. **Gate:** the load test passes; no write outside a transaction.
- [ ] **2.6** - the shared Apps Script deployment stays **read-only for 2 weeks** as the fallback.
- **Rollback:** before 2.4 completes - unfreeze Apps Script, point the base URL back; after it - the reverse export (0.9).

### Phase 3 — Clean-up and go-live
- [ ] **3.1 You approve, Claude edits** - publish the legal changes: `src/config/legal/dpa.js` (Annex C, transfers,
      security, deletion), `privacy.js` (providers, transfers, cookies, retention), `terms.js` (providers, the
      proof-of-concept clause, the Sheets option) - archive the old Terms version first (`termsArchive.js` rule);
      `src/config/site.js` `STATUS` (add Neon + AWS SES; since 9 Nov 2026 the Cloud Run build already drops Vercel -
      `REACT_APP_HOSTING=cloudrun`; the Google Workspace row stays for sign-in / Gmail and the Sheets-option customers).
- [ ] **3.2 You** - **Neon Launch before the first paying customer** (Free suspends compute at its limit); decide
      scale-to-zero for production.
- [ ] **3.3 Claude** - remove the Apps Script fallback and `READ_ONLY` handling for the platform store; Row-Level Security
      on `company_id` / `organization_id`; scheduled backups; monitoring + alerts.
- [ ] **3.4 You** - retire **Firebase Auth** and **only the shared platform's Apps Script deployment** (after the 2 weeks).
      The v10.2 file stays maintained (fixes) for **dedicated-instance customers** (§2), and its read / write code is the
      starting point of the bridge (Phase 5).
- [ ] **3.5 Claude** - point `src/config/apiConfig.js` defaults and `scripts/measure-api-latency.js` at
      `daloy.blueknight.xyz`; update `docs/reference/PRODUCTION_REQUIREMENTS.md`, `Claude.md`, the AppScript deploy guide (dedicated
      instances only).
- [ ] **3.6 Claude** - 🚩 **Admin → "Backend Integration Status"** (`src/pages/AdminPage.js`, the collapsible panel at
      the bottom; on unless `REACT_APP_SHOW_BACKEND_INFO=false`) - flagged 9 Nov 2026 (user: "flag for update once core
      is migrated off appscript (unless clients using Sheets)"). Today it hard-codes "Google Apps Script: Production
      Ready" and stale phase labels. Once the core is off Apps Script: show the **data store per organization from the
      server** (the `x-backend` answer: `pg` = Postgres on Cloud Run Singapore; **Sheets-option organizations** - bridge or
      dedicated instance, §2 / D7 - keep "Google Sheets + Apps Script" with their bridge status) instead of fixed text;
      drop the static API / phase lists (the plan page and `/status` cover them).

### Phase 4 — New features on the server (after Phase 2; D6)
Order (each = design section → `/api/rpc` handlers + tests → screens → contract check → preview → production):
- [ ] **4.1** v10.2 **P2**: trial (`startTrial`, `setTrialEnd`, conversion), grace → read-only (`COMPANY_READ_ONLY`,
      `READ_ONLY_ALLOWED`), upgrade / scheduled downgrade / renew, `subscription_events` + reminders,
      `subscription_invoices` (`INV-YYYY-#####`). *PLAN_PlanTiers §3, §4, §4a.*
- [ ] **4.2** **Q2** allowances instead of hard limits (U10): warn not refuse, 3-month average, add-on blocks, stop / cap
      choice, 80 % / 100 % alerts, month-end estimate - then remove the add-ons "Coming soon" badge. *PLAN_PlanTiers §2c, §11.*
- [ ] **4.3** v10.2 **P5** screens: Plan & usage, `useCompanyPlans` once in `UserContext`.
- [ ] **4.4** **Q1** Basic+ and the Payroll / HR packs (U9): `basic_plus` in the catalogue, pack features + on / off,
      pack ticket types from the templates; move `src/config/plansProposed.js` into `plans.js`; remove the Basic+ / pack
      badges. *PLAN_PlanTiers §2b, §11; docs/design/TEMPLATES_*.*
- [ ] **4.5** v10.2 **P3** template library (adopt, light edits, managed set-up).
- [ ] **4.6** v10.2 **P4** ticket uploader.
- [ ] **4.7** **Drive attachments** (D11): S1 spike (gate) → settings + connections → upload / download → slots per
      ticket type (may ship first, works with links) → legal + onboarding. *PLAN_Attachments_ClientDrive_20261109.md §16.*
- [ ] **4.8** then v10.3 (head approval, delegation, bulk approve) and v10.4 (comments and the rest).
      *PLAN_FeatureGaps_Volume.*
- Prices: switch `SHOW_PRICES` (`src/config/pricing.js`) only when the price list is approved.

### Phase 5 — Organizations and the Google Sheets option (O2–O6; may start beside Phase 4)
- [ ] **5.1** O2 organization admin screens: create companies, invite admins, organization switcher.
- [ ] **5.2** O3 storage adapter interface + per-organization routing (the Postgres adapter = Phases 1–2 code).
- [ ] **5.3** O4 bridge v1 + contract test + Sheet adapter + cache (built from the v10.2 read / write code and 0.9).
- [ ] **5.4** O5 pilot: one Workspace organization with 2+ companies on its own Sheet via the template copy;
      rewrite `GUIDE_Onboarding_GoogleWorkspace.md` §3 for the bridge.
- [ ] **5.5** O6 export / import between storages - incl. moving **dedicated-instance** customers onto the bridge or
      Postgres. *PLAN_ServerCore §4–§8.*

### Ongoing
- [ ] Re-run `docs/guides/PROMPT_CheckHostingPricing.md` every 3 months and before any price change; watch for a
      **Philippine region** (Neon, Google Cloud, AWS, Vercel, Azure - none today).
- [ ] Apps Script fixes: new file per fix, pasted into the shared deployment (until 3.4) and each dedicated copy.

---

## §6 Working rules during the migration
- Apps Script = fixes only (D6); no new routes there. Every new action is an `/api/rpc` handler with its contract-check
  entry, its test and its query budget stated first (`Claude.md` non-functional requirements).
- Production deploy = `scripts/deploy-cloudrun.sh production` when you say "push" / "deploy"; previews = Vercel branches
  (the preview-link-before-push habit stays).
- One version, one review log, one session-log row - as today (`Claude.md` working rules).

## §7 Risks and catches (details: CHECK §6 / §7, GUIDE §F)
- **UNVERIFIED** Cloud Run Tier 2 + egress prices (step 0.2). Attachment risks: PLAN_Attachments §17.
- Firebase Hosting: 60 s per request; only the `__session` cookie passes.
- Neon Free suspends at its limit; no uptime SLA below Neon Scale - promise none. Any job that runs every ≤ 5 min
  around the clock keeps Neon awake (~183 CU-h) - schedule jobs as in 1.1 / 2.4 while on Free.
- Test revisions and production share data until Phase 2; previews' API runs through Vercel `iad1` (US) until 3.5.
- Vercel Hobby previews: commercial-use risk accepted (D4).
- Transfers outside the Philippines (Singapore) - disclosed and notified (0.10); the Sheets options keep data in the
  customer's own Google account (no Asia pinning, their choice).

## §8 Progress
| Phase | Done | Notes |
|---|---|---|
| F | ✅ (open v10.2 user steps remain) | 8 Nov 2026 |
| H | ✅ 14 Nov 2026 (H.1–H.4; Vercel = previews only; redirect → permanent after ~21 Nov) | `d342c68`; UI fixes `749bd4a`..`52813f8`; H.4 `1db367a` (branch); prod `daloy-00007-z66` 11 Nov 2026 |
| 0 | 0.7 part 1 ✅ | schema generator + migrations 0001 / 0002, 11 Nov 2026 |
| 1 | - | |
| 2 | - | |
| 3 | - | |
| 4 | - | 4.7 attachments designed 9 Nov 2026 (D11) |
| 5 | - | |

Each phase close recalculates `docs/planning/PROGRESS_FeatureCompletion.md` (REF_SessionLog §3 rule 6).
