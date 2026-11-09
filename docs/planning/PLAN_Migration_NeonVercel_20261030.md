<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_Migration_NeonVercel_20261030.md | Author: Kenneth R. Advento | Version: 1.4.2
Created: 30 October 2026 UTC+8 (Philippine Standard Time) | Modified: 9 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Plan to move the backend from Google Sheets + Apps Script to Neon Postgres (Singapore), served from Google Cloud Run (Singapore) behind Firebase Hosting - previews on Vercel - designed for heavy use, without changing the frontend's API contract (file name kept from the Vercel version for links) | Status: Design reference — the order and checkboxes are in docs/planning/PLAN_Migration_Unified_20261108.md
REVISION HISTORY:
- v1.0.0 | 30 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Initial plan (session 7e008704), from the reco (19 Oct 2026) and docs/planning/REVIEW_AppScriptReco_20261030.md
- v1.1.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §11 future option: client-hosted SQL database (shapes, pros / cons, decisions to keep the path open, testing without the client database)
- v1.2.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §12 v10 features on Postgres (pointer to PLAN_FeatureGaps_Volume_20261031.md §6; session 2d369f00)
- v1.2.1 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §12: the notification partition drop approved by the user
- v1.4.1 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Files: attachments go to the client's Google Workspace Drive (unified D11, PLAN_Attachments_ClientDrive_20261109.md); platform object storage deferred
- v1.4.2 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Frontend row: Hosting in the new project `krativ-daloy`, sign-in stays in `jarvisbyerp` until Better Auth (unified D12)
- v1.4.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Host decided (user: "move production to not vercel, preview in vercel"): production on Cloud Run asia-southeast1 behind Firebase Hosting (daloy.blueknight.xyz), previews on Vercel Hobby; new Phase H = docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md (server/app.js, Dockerfile, firebase.json, scripts/deploy-cloudrun.sh); §1 / §2 / Phase 0 / sync / §9 / §11 moved from Vercel functions + Vercel Cron to Cloud Run + Cloud Scheduler; email SES Singapore; files storage location to check (Asia rule); now the design reference of PLAN_Migration_Unified_20261108.md (Sheets / Apps Script kept as a customer option)
- v1.3.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Asia rule + hosting check (session 61523343): servers must be in Asia; Firebase Auth is US-only and Vercel functions default to iad1 (US); recommended cheapest all-Asia stack (Cloud Run Singapore + Neon Singapore + Better Auth + SES Singapore) pending the user's confirmation - CHECK_HostingPricing_20261108.md; chronological deploy steps - docs/guides/CHECKLIST_Deploy_PostgresNeon_20261108.md
===============================================================================
-->

# PLAN — Migration to Neon Postgres (host: Cloud Run Singapore; previews on Vercel)

> **Inputs:** the reco "TicketFlow: Apps Script Recommendations & Migration Plan" (19 Oct 2026) and its review `docs/planning/REVIEW_AppScriptReco_20261030.md`.
> **Decisions (user, 30 Oct 2026):** design for **heavy use** → reco **Option A** (mirror Sheets into Postgres, move reads first, then freeze writes and flip them); **both** auth providers (Firebase now, Auth.js / Better Auth later).
> **Phase gates:** the non-functional targets in `Claude.md` (latency, query budgets, correctness rules). A phase is done only when its actions meet them.
> **Asia rule + hosting check (user, 8 Nov 2026; v1.3.0):** servers must be in Asia, ranked Philippines > Southeast Asia > rest of Asia > cheapest. No provider checked has a Philippine database or app region. Two parts of this plan fail the rule as written: **Firebase Authentication runs only in US data centers** (§3 "Firebase now") and **Vercel functions default to `iad1` (US)** (§2 pins `sin1` - keep it). The cheapest all-Asia stack is **Cloud Run Singapore + Neon Singapore + Better Auth in Neon + SES Singapore** (runner-up: Cloudflare; then Vercel Pro `sin1`) - `docs/planning/CHECK_HostingPricing_20261108.md` §6, with its catches and the DPA / Terms / Privacy changes (§7). **Pending the user's confirmation**; the phases below stay valid on any of the three hosts. Step-by-step order: `docs/guides/CHECKLIST_Deploy_PostgresNeon_20261108.md`.
> **Host decided (user, 8 Nov 2026; v1.4.0):** production leaves Vercel for **Google Cloud Run `asia-southeast1` behind Firebase Hosting at `daloy.blueknight.xyz`**; **Vercel keeps the previews** (Hobby, commercial-use risk accepted by the user). This is **Phase H**, done **before Phase 0** with the backend unchanged (Apps Script): `docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md` (A set-up → B test revision → C domain → D Vercel previews only). The later phases then grow `server/app.js` behind the same address. Still to confirm for the data move: Neon Singapore + Better Auth + SES Singapore.
> **Step-by-step: `docs/planning/PLAN_Migration_Unified_20261108.md`** (Phases F, H, 0–5). This file is the **design reference** for it. Also decided there: Apps Script frozen (fixes only), v10.2 P2–P5 built on the new server after the cutover, `organizations` in the first schema, and **Google Sheets / Apps Script kept as a customer option** (bridge + interim dedicated instance) - so §6 Phase 3 retires only the shared platform's Apps Script deployment.

---

## §1 Target and principles

| Layer | Today (v9.5) | Target |
|---|---|---|
| Frontend | React SPA on Vercel | **Phase H:** Firebase Hosting (`daloy.blueknight.xyz`, project `krativ-daloy`; sign-in stays in `jarvisbyerp` until Better Auth - unified D12) for production; **Vercel for previews** |
| API | `api/appscript-proxy.js` → Apps Script web app | **Phase H:** the same proxy on **Cloud Run `daloy` (`asia-southeast1`)** via `server/app.js`; then `/api/rpc` next to it → handlers on Neon; unported actions still proxied to Apps Script |
| Database | Google Sheets (49 tabs at v10.2) | Neon Postgres (Singapore `aws-ap-southeast-1`), migrations in the repo |
| Files | Drive (config backups) | Ticket attachments in the **client's own Google Workspace Drive** (unified D11, `docs/planning/PLAN_Attachments_ClientDrive_20261109.md`); config backups as JSON in Neon / the nightly backup. Platform object storage in Asia (R2 Asia-Pacific or Cloud Storage `asia-southeast1`) **deferred** until a customer without Workspace needs uploads |
| Auth | Firebase ID token verified at the proxy (v9.4) | Better Auth sessions in Neon Singapore (Firebase Auth is US-only) - cookie named `__session` (Firebase Hosting passes only that one); one internal user id |
| Jobs | Apps Script time trigger (SLA escalation, v9.5) | **Cloud Scheduler** → `/api/cron/*` on Cloud Run (3 jobs free per billing account) |
| Email | MailApp (Apps Script) | Amazon SES Singapore through the `email_outbox` (§9) |

**Keep the API contract.** Request `{ action, ...payload }` (GET query or POST body), response `{ success, data, message }` or `{ success: false, status: 'error', error }`, exactly as `src/api/googleSheet.js` uses today. The frontend changes in one place (`apiConfig.baseURL`) and only once.

**Port by table group with its data, never by single action** (reco §5.2): two backends writing different copies of the same table give different answers.

---

## §2 Architecture

```
Browser ─► Firebase Hosting ─► /api/rpc  (Cloud Run "daloy", asia-southeast1 - server/app.js)
             ├─ verify identity (identityAdapters: firebase, authjs)        → 401 in enforce mode
             ├─ handlers[action] exists? ─► TS handler ─► Neon (pooled, sin) ─► { success, data }
             └─ otherwise ─► proxy to Apps Script (+ _auth_uid, _proxy_secret) ─► Sheets
           X-Backend: pg | gas, X-Response-Time, one log line per request
```

- **Route:** mount `/api/rpc` in `server/app.js` next to `/api/appscript-proxy` (Phase H already serves the proxy there); keep `/api/appscript-proxy` until the frontend base URL switches. Logic stays in `api/_lib/` (testable in plain Node, like `proxyCore.js` today; `scripts/test-cloudrun-server.js` covers the server).
- **Handler registry:** `api/_lib/handlers/<group>.js` exports `{ actionName: async (payload, ctx) => data }`; `ctx = { user, db, log, now }`. A handler returns the unwrapped data; the route wraps it.
- **Database access:** `@neondatabase/serverless` (HTTP for single queries, WebSocket `Pool` for transactions), Drizzle ORM for typed queries and migrations (`drizzle/` folder, `npm run db:migrate`).
- **Region:** Cloud Run in `asia-southeast1` and Neon in `aws-ap-southeast-1` - both Singapore (a short in-city round trip; measure it in Phase 0, not assumed). Previews on Vercel reach the API through the old Vercel proxy (`iad1`) until the base URL switches.
- **Observability:** the proxy's log line (action, duration_ms, user_id, company_id, auth, backend, status) gains `query_count`; Cloud Logging (`gcloud run services logs read daloy`) and a log-based metric for p95 per action.

---

## §3 Identity — both providers (user decision)

```sql
create table users (
  id            text primary key,          -- the Firebase uid for existing users (no re-keying of requester_id etc.)
  email         text unique,
  display_name  text,
  created_at    timestamptz not null default now()
);
create table auth_identities (
  provider      text not null,             -- 'firebase' | 'authjs'
  external_id   text not null,             -- Firebase uid, or the Auth.js account id
  user_id       text not null references users(id),
  primary key (provider, external_id)
);
```

- **Firebase (now):** the token's `sub` is looked up in `auth_identities('firebase', sub)`; for existing users that row maps to the same id.
- **Auth.js / Better Auth (later):** its `users / accounts / sessions` tables live in Neon; a session cookie is verified by the `authjs` adapter in `identityAdapters` and mapped through `auth_identities('authjs', account_id)`.
- **Linking:** the same verified email may link a second provider to an existing user **only after admin approval** (an `identity_link_requests` row), so an email typo can't take over an account.
- **Sign-in allow-list:** refuse identities with no `users` row (closes "any Google account can sign in" - REVIEW §4, S1 part 3).
- **Authorization:** every admin / approver / share / report check runs on the server with `ctx.user` (compliance A15 carries over).
- **Tenancy, second layer (Phase 3):** Postgres Row-Level Security on `company_id` with `set_config('app.user_id', …)` per transaction.

---

## §4 Schema

- **DDL generated from `TABLE_SCHEMAS`** (39 tables in v9.5) by a script (`scripts/gen-ddl.js`), then hand-tuned in the first migration.
- **Keys:** keep the existing ids as `text` primary keys (`comp_…`, `ws_…`, numeric ticket ids as text) - no reference rewrite during the load. Ticket ids continue from the `ticket_id` sequence (v9.4).
- **Types:** `boolean` for `is_*` / `require_*` / `enable_*`; `timestamptz` for `*_at`, `timestamp`, `step_due_date`, `step_started_at`; `numeric` for amounts and durations; `jsonb` for `details`, `field_changes`, `notify_role_ids`, `notify_emails`, `escalation_recipients`, `business_days`, `recipient_user_ids`, `granted_role_ids`.
- **Constraints that replace v9.x code:**

| v9.x code | Postgres |
|---|---|
| `sameId`, `findRecord`, `readTable` scans | foreign keys + indexes |
| duplicate checks (company code, role assignment, tag name, SLA rule, escalation level, holiday) | `unique` / partial unique indexes `where is_active` |
| `withScriptLock` + `generateTicketNumber` | one transaction + `select … for update` on `sequence_counters` |
| `nextSequenceValue('ticket_id')` | `bigint generated always as identity` (kept as text in the API) |
| `rebuildAllTables`, `_bak_` copies | versioned migrations |
| the per-request table cache (A14) | not needed - indexed queries |

- **Day-one indexes:** `tickets(company_id, status)`, `tickets(current_step_id)`, partial `tickets(step_due_date) where status not in ('Completed','Rejected','Cancelled')`, `ticket_history(ticket_id, timestamp)`, `user_role_assignments(user_id)`, `user_role_assignments(company_id, role_id)`, `step_approvers(step_id)`, `custom_field_values(ticket_id, entity_category)`, `workflow_steps(ticket_type_id, company_id, sort_order)`, `admin_action_logs(timestamp)`, `notifications(user_id, is_read, created_at desc)`, unique `sla_escalation_events(ticket_id, step_id, visit_started_at, rule_id)`, unique `tickets(ticket_number)`.

---

## §5 Designed for heavy use

| Concern | Design |
|---|---|
| Ticket numbers under concurrency | Inside the create transaction: `update sequence_counters set last_number = last_number + 1 where sequence_name = $1 returning last_number` (row lock), unique index on `ticket_number` as the backstop |
| Two approvals on the same ticket | Optimistic concurrency: `tickets.version int`; the approval updates `where id = $1 and version = $2`; 0 rows → "the ticket changed, refresh" (exactly one transition) |
| All-or-nothing writes | Every workflow write (create / approve / return / reject / reopen / cancel) in one transaction: ticket row, history, action log, chained ticket, notifications |
| Retries (frontend `MAX_RETRIES`) | Idempotency keys: the client sends `idempotency_key` on writes; `idempotency_keys(key, user_id, action, response, created_at)` returns the first response for a repeat |
| Lists | Cursor pagination (`created_at, id`), default 50, max 100; no response over 1 MB unpaginated |
| N+1 queries | Not allowed (compliance P10 + Claude.md budgets): joins, `= any($1)`, `json_agg` |
| Growing logs | `ticket_history`, `ticket_action_logs`, `admin_action_logs`, `notifications`: monthly range partitions once a table passes ~1M rows; archive after 24 months |
| Reports | A read replica (Neon read pool) for `getReportData` / audit log / SLA performance, so reports never slow writes |
| Abuse | Rate limit per user id at `/api/rpc` (e.g. 120 requests/min, 20 writes/min) with a Postgres or Upstash counter |
| Cold starts | Neon scale-to-zero off in production; a warm-up cron ping during demos on the free plan |

---

## §6 Phases (Option A) with exit gates

*Order, owners and checkboxes: `PLAN_Migration_Unified_20261108.md` §5 (this section keeps the design of each phase).*

### Phase 0 — Foundations
1. **Baseline:** deploy v9.4, run `node scripts/measure-api-latency.js` (5 runs per action) and record v9.3 vs v9.4 in REVIEW §5.
2. Neon project (Singapore); the Cloud Run service exists from Phase H; (object storage deferred - §1 Files); secrets in Secret Manager (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, storage keys).
3. `/api/rpc` with the handler registry and the Apps Script fallback (the v9.4 proxy, extended). Identity adapters: `firebase` (exists), `authjs` (added here).
4. DDL + first migration; the load script (§7) run against a copy of the sheet.
5. **Sync job (Phase 1 only):** a Cloud Scheduler job every 5 min pulls rows changed since the last sync (`updated_at` / `created_at` > watermark - this is why S2 real-UTC timestamps came first) through an Apps Script read-only export action, and upserts them. Deletes are soft (`is_active`), so they sync as updates.
- **Gate:** load script reproduces row counts per table; 10 tickets compared end to end; sync lag < 5 min.

### Phase 1 — Reads from Postgres (sync-fed)
- The reco's read list (dashboard, reference data, users, reports, checks) plus v9.4 `getDashboard` and v9.5 `getNotifications`, `getSLAEscalationRules`, `getSLAEscalationEvents`, `getCompanyHolidays`.
- The UI refreshes a ticket from the **write response**, not a re-read (reads may be one sync interval behind).
- **Gate:** every ported read meets its Claude.md latency + query budget on the §8 data set; `X-Backend: pg` on all of them.

### Phase 2 — Write cutover (short maintenance window)
1. Freeze writes: Script Property `READ_ONLY=true` (Apps Script answers writes with an error; the UI shows a maintenance banner).
2. Final sync, count verification, spot checks.
3. Switch **all** write actions to Postgres handlers in one deploy, by table group: ticket loop, workflow admin, users and roles, company admin (locks, SLA rules, dropdown access, config import / export), tags and sharing, **SLA escalation** (§9).
4. Stop the sync job. Keep the Apps Script deployment read-only for two weeks as a fallback, then retire it - **the shared platform deployment only**; dedicated customer instances and the Sheet bridge stay (unified plan §2).
- **Gate:** the §8 load test passes; 2 concurrent approvals on one ticket → exactly one transition; no write outside a transaction.
- **Rollback:** before step 3 completes, unfreeze Apps Script and point the base URL back; after it, a reverse export (Postgres → Sheets) script exists and is tested in Phase 0.

### Phase 3 — Clean-up
- Remove the proxy fallback and `READ_ONLY` handling; RLS on `company_id`; drop the S6 helpers (not ported); optional nightly export to Sheets for people who want spreadsheets.

---

## §7 Data load transform

1. Export every tab (Apps Script → JSON, one file per tab).
2. Transform:
   - `'TRUE'` / `'FALSE'` / blank → boolean; blank `is_active` → `true` (matches `isActiveFlag`).
   - **Timestamps (S2):** audit columns written through `getCurrentTimestamp()` before Script Property `TS_UTC_SINCE` are 8 h ahead → subtract 8 h for rows with that value before the cutover. Writers that used `new Date()` (ticket rows, history) are already correct - decide per column, spot-check against `ticket_history`.
   - Blank strings → `NULL` for foreign keys; JSON-in-text columns → `jsonb`.
   - Holiday dates stored as text (`'2026-12-25`) → `date`.
   - Run `repairCompanyLocksApply()` first (the pre-v9.1 `code_locked` dates).
3. Load in dependency order: companies → role_types / user_profile_types → roles → users / user_profiles / auth_identities → ticket_types → workflow_steps → step_* → dropdowns → custom_fields → company_sla_rules / sla_escalation_rules / company_holidays → tickets → custom_field_values → history / logs / notifications / sla_escalation_events → links / tags / shares.
4. Verify: row counts per table, 10 tickets end to end (history, current step, custom fields, escalation events), `validateTicketDependencies` as SQL.

---

## §8 Testing and measurement

- **Seed generator** (`scripts/seed-pg.js`) for the reco's volumes - PoC: 5 companies, 50 users, 10 ticket types, 10k tickets, 100k history rows; design target ×10.
- **Handler tests** against a Neon branch per CI run (`neonctl branches create`), the same scenarios as the offline `ROUTES_TEST_v9.x` suites (they become the acceptance list).
- **Load test** (k6): 20 concurrent approvals on different tickets, 2 on the same ticket, 50 concurrent dashboards; pass = no errors, p95 within Claude.md.
- **EXPLAIN (ANALYZE, BUFFERS)** for dashboard, approver inbox, report, approval and the escalation query kept in `docs/perf/`; re-run after schema changes.
- **Phase table:** per phase, actions ported, p95 per action, queries per action, misses with the fix.

---

## §9 SLA escalation on Postgres (v9.5 design carried over)

- **Cron:** Cloud Scheduler → `/api/cron/sla` on Cloud Run (an OIDC token from Scheduler's service account, or `Authorization: Bearer $CRON_SECRET`) - every **30 min on Neon Free** (the 15-minute rhythm doesn't reliably fit 100 CU-h, `CHECK_HostingPricing_20261108.md` §5), every 5–15 min on Neon Launch.
- **One set-based query** finds what is due: open tickets joined to the matching rules (step-specific beats "all steps" per level), `fire_at <= now()`, and `not exists` an event for (ticket, step, visit, rule). Uses the partial index on `tickets(step_due_date)`.
- **Idempotent:** `insert into sla_escalation_events … on conflict (ticket_id, step_id, visit_started_at, rule_id) do nothing returning *` - only inserted rows produce notifications, so overlapping runs can't double-notify (replaces `tryLock`).
- **Business calendar** in SQL or TS: `company_holidays` + business hours per company rule; Asia/Manila via `at time zone 'Asia/Manila'` (no hour arithmetic, compliance A17).
- **Email:** an `email_outbox` table filled in the same transaction, drained by a second Scheduler job through **Amazon SES Singapore** (retries, no MailApp quota); `notifications.email_status` updated from the outbox.
- **escalate_role grants:** a view `active_escalation_grants(ticket_id, role_id)` joined into the approver-eligibility query.

---

## §10 Risks and decisions

| Item | Note |
|---|---|
| Data privacy | If employer data is in TicketFlow, get IT / Data Privacy Act clearance before moving it to Neon / R2 |
| Plans and cost | Vercel Hobby forbids commercial use, including *"Advertising the sale of a product or service"* - the live site's /plans page and founding offer already count, so Pro **now** if the site stays on Vercel (8 Nov 2026 check); Neon Launch before the first paying customer (Free suspends compute at its limit). Prices per location: `CHECK_HostingPricing_20261108.md` |
| Server location (8 Nov 2026) | Servers must be in Asia: Neon `aws-ap-southeast-1`, functions in Singapore, SES `ap-southeast-1`; Firebase Auth (US-only) replaced by Better Auth before the cutover; the DPA's new-sub-processor notice ≥ [[30]] days before it |
| IP ownership | Check the invention-assignment clause of the employment contract before commercializing |
| SLA day logic | Postgres stores UTC; "Due Today", business days and holidays in Asia/Manila |
| Open S1 part 3 | Admin-only routes need server-side checks before Phase 2 (they are written that way in the new handlers; REVIEW §4) |
| Targets | Claude.md budgets are the starting proposal; change them as numbers, not by dropping them |

---

## §11 Future option — client-hosted ("local") SQL database

> **Status:** future plan, not scheduled (user, 31 Oct 2026). We have no client database to test against, so the plan relies on running the same tests against Docker copies of the client's database engine (§11.4).

### §11.1 Shapes it can take

| Shape | What the client runs | What we change | Effort |
|---|---|---|---|
| **A. Client Postgres** (on-prem or their cloud) | Postgres 14+ | Only `DATABASE_URL`: same schema, migrations and handlers as Neon | Small |
| **B. Client SQL Server / MySQL** | Their existing engine (common next to ERPs) | A second database dialect: query builder + dialect-specific migrations and locking | Medium–large |
| **C. Fully on-prem app** | API server (Docker / Node) + database + static frontend on their network | B or A, plus self-hosted API (the same `Dockerfile` / `server/app.js` as Cloud Run), their own scheduler for the SLA job, their own mail relay | Large |

### §11.2 Pros and cons

| Pros | Cons |
|---|---|
| **Data residency / Data Privacy Act:** client data never leaves their network or provider (often the deciding factor for enterprises) | **No test access by default:** version, collation, permissions and network differences show up only at the client - **unless the client provides a dev / staging database** (§11.4) |
| Integration with the client's ERP: reports or views can join TicketFlow tables with ERP tables | **Support burden:** every client database is one more environment to upgrade, migrate and debug - remotely, through their IT |
| No cloud database cost for the client; LAN latency can be very low | **Networking:** the cloud server (Cloud Run) can't reach a private database without a tunnel or VPC connector (Cloudflare Tunnel, VPN, or a public IP allow-list) - or the API must be hosted on-prem (shape C) |
| The client owns backups, retention and disaster recovery | Backups, HA and security patches become **their** responsibility - and outages land on us anyway |
| Can reuse the client's sign-in (Active Directory / Entra ID) via the Auth.js adapter (§3) | Two dialects (B) double the testing for every schema or query change; Postgres-only features (partial indexes, `ON CONFLICT`, `FOR UPDATE SKIP LOCKED`, `jsonb`) need equivalents |
| Easier to sell to clients that forbid SaaS | Releases need the client's change window; we can't hot-fix their database |

### §11.3 Decisions to take now, while building on Neon (so the path stays open)

1. **All database access through one repository layer** (`api/_lib/db/`): handlers never build SQL strings themselves, so a second dialect replaces one layer, not every handler.
2. **Use a query builder that supports several dialects** (Kysely or Drizzle with dialect-specific schema files; Kysely supports Postgres, MySQL, SQL Server and SQLite) instead of hand-written Postgres SQL in handlers.
3. **Keep Postgres-only features behind helpers:** `upsertOnConflict()`, `lockRowForUpdate()`, `jsonColumn()`. Each dialect implements them (SQL Server: `MERGE` / `WITH (UPDLOCK, ROWLOCK)` / `NVARCHAR(MAX)` + `ISJSON`).
4. **Keep the existing portable choices:** text ids, timestamps stored in UTC, Asia/Manila only at display (compliance A17), soft deletes, no database triggers holding business rules.
5. **Configuration only:** `DATABASE_URL`, `DB_DIALECT` (`postgres` default), `MAIL_TRANSPORT` (`ses` / `smtp`), `SCHEDULER` (`cloud-scheduler` / `external`). No code edits per client.
6. **The SLA job as a plain HTTP endpoint** (`/api/cron/sla`, signed): Cloud Scheduler calls it in the cloud, and an on-prem scheduler (Task Scheduler / cron / Kubernetes CronJob) calls it at a client.

### §11.4 How to test without the client's database

- **CI matrix:** run the handler suite (the `ROUTES_TEST_v9.x` scenarios ported to the API) against Docker images of each supported engine - `postgres:16`, and `mcr.microsoft.com/mssql/server:2022-latest` / `mysql:8` if shape B is offered. GitHub Actions `services:` start them per run.
- **Install checklist for the client's IT:** engine + version, collation (`Latin1_General_100_CI_AS_SC_UTF8` or equivalent for UTF-8), a dedicated database user with DDL rights for migrations, network path (tunnel or on-prem API), backups.
- **Health endpoint** (`getSystemHealth` equivalent) reporting engine, version, migration level and time zone, so the first remote check after an install shows mismatches at once.
- **Client dev / staging database (preferred - make it a contract condition):** a copy of their production engine, same version and collation, reachable from our CI (tunnel / VPN / allow-listed IP) with a dedicated test user. Our CI then runs the handler suite and every migration against it before each release, and the release goes to their production only after it passes there. Refresh it from production (masked data) before major releases.
- **A pilot client** before offering it widely.

### §11.5 Schema build-up scripts (one source, every engine)

Client DBAs usually want to **review and run the scripts themselves** instead of letting our tool change their database, so every release ships both a tool and plain SQL. Built in Phase 0 together with the Neon schema; not before, because their source of truth is that typed schema.

| Script | What it does |
|---|---|
| `scripts/db/schema.js` | **The single source of truth**: every table, column, type, default, key, index and constraint, defined once in a dialect-neutral form. It replaces `TABLE_SCHEMAS` (typing rules §4: `is_*` → boolean, `*_at` → timestamp UTC, ids → text, JSON columns, amounts → numeric) |
| `npm run db:gen-ddl -- --dialect postgres\|mssql\|mysql` | Generates the **full create script** for one engine (`build/sql/<dialect>/000_full_schema.sql`): tables in dependency order, keys, indexes, constraints. Idempotent (`IF NOT EXISTS` / `IF OBJECT_ID(...) IS NULL`), so running it twice changes nothing |
| `migrations/<dialect>/NNN_<name>.up.sql` + `.down.sql` | One numbered change per release, with its **rollback**; a `schema_migrations` table records what ran (version, checksum, time) |
| `npm run db:migrate` / `db:migrate -- --dry-run` | Applies the pending migrations in one transaction per migration; dry run prints the SQL only |
| `npm run db:verify` | Compares the live database with `schema.js` (missing / extra tables, columns, types, indexes) - the Postgres-era equivalent of `rebuildAllTables()` dry run and `getSystemHealth`. Read-only; run it first at every install |
| `npm run db:seed-reference` | Inserts the reference rows a new install needs (admin role, default sequences, statuses) - never test data; idempotent |
| `npm run db:bundle -- --dialect mssql --from 012` | Packs a **DBA bundle**: the SQL files from a migration number on, the rollbacks, the verify query and a README (order, expected results, how to roll back) - for clients whose DBA runs scripts by hand |

- **Tested in CI** on every engine offered (§11.4): full script on an empty database → `db:verify` passes; every migration up → down → up; the handler suite on the result.
- **Data load from Sheets** (§7) stays a separate one-off script; it uses the same `schema.js` for column names and types.

### §11.6 Recommendation

Offer **shape A (client Postgres)** first: it is the same code as Neon and needs no extra dialect. Offer **B (SQL Server / MySQL)** only as a paid add-on when a client requires it, after §11.3 is in place and the CI matrix covers that engine. Treat **C** as a separate on-prem edition, priced with its support burden.

---

## §12 v10 features on Postgres (added 31 Oct 2026)

The AppScript v10 line (visibility per ticket type, Restricted tickets / fields, pagination + search, workflow notifications + email outbox, immediate head approval, delegation, bulk approve, comments) is designed for both backends in `docs/planning/PLAN_FeatureGaps_Volume_20261031.md`. Its **§6 is the Postgres part of this plan** and is kept there, so a feature and its database design change together:
- **§6.1** extra tables / columns (`ticket_participants` with role-based pool windows, `approval_delegations`, `email_outbox`, `ticket_comments`, `tickets.version`, `tickets.search`).
- **§6.2** extra indexes (on top of the §4 day-one indexes here).
- **§6.3** the visibility-aware list query (≤ 3 queries) and **§6.4** the query budget per action (Claude.md working rule).
- **§6.5** growth: partitions for notifications / history / logs / participants. The one proposed exception to soft delete (dropping read notifications > 90 days old) was **approved by the user on 31 Oct 2026**.

Port order: these actions move with their table group in Phase 2 (§6): visibility and Restricted with the ticket loop, delegation and head approval with workflow admin, the outbox with SLA escalation (§9).
