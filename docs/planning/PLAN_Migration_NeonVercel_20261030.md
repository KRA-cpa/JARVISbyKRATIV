<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_Migration_NeonVercel_20261030.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 30 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Plan to move the backend from Google Sheets + Apps Script to Vercel functions + Neon Postgres (+ Cloudflare R2), designed for heavy use, without changing the frontend's API contract | Status: Draft — for review; Phase 0 starts after AppScript v9.4 / v9.5 are live
REVISION HISTORY:
- v1.0.0 | 30 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Initial plan (session 7e008704), from the reco (19 Oct 2026) and docs/planning/REVIEW_AppScriptReco_20261030.md
- v1.1.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §11 future option: client-hosted SQL database (shapes, pros / cons, decisions to keep the path open, testing without the client database)
===============================================================================
-->

# PLAN — Migration to Vercel + Neon Postgres

> **Inputs:** the reco "TicketFlow: Apps Script Recommendations & Migration Plan" (19 Oct 2026) and its review `docs/planning/REVIEW_AppScriptReco_20261030.md`.
> **Decisions (user, 30 Oct 2026):** design for **heavy use** → reco **Option A** (mirror Sheets into Postgres, move reads first, then freeze writes and flip them); **both** auth providers (Firebase now, Auth.js / Better Auth later).
> **Phase gates:** the non-functional targets in `Claude.md` (latency, query budgets, correctness rules). A phase is done only when its actions meet them.

---

## §1 Target and principles

| Layer | Today (v9.5) | Target |
|---|---|---|
| Frontend | React SPA on Vercel | unchanged |
| API | `api/appscript-proxy.js` → Apps Script web app | `/api/rpc` (the same proxy, extended) → TypeScript handlers on Neon; unported actions still proxied to Apps Script |
| Database | Google Sheets (39 tabs) | Neon Postgres (Singapore), migrations in the repo |
| Files | Drive (config backups) | Cloudflare R2 (attachments, backups) |
| Auth | Firebase ID token verified at the proxy (v9.4) | the same, plus Auth.js / Better Auth sessions; one internal user id |
| Jobs | Apps Script time trigger (SLA escalation, v9.5) | Vercel Cron → `/api/cron/*` |

**Keep the API contract.** Request `{ action, ...payload }` (GET query or POST body), response `{ success, data, message }` or `{ success: false, status: 'error', error }`, exactly as `src/api/googleSheet.js` uses today. The frontend changes in one place (`apiConfig.baseURL`) and only once.

**Port by table group with its data, never by single action** (reco §5.2): two backends writing different copies of the same table give different answers.

---

## §2 Architecture

```
Browser ─► /api/rpc  (Vercel Node function, region sin1)
             ├─ verify identity (identityAdapters: firebase, authjs)        → 401 in enforce mode
             ├─ handlers[action] exists? ─► TS handler ─► Neon (pooled, sin) ─► { success, data }
             └─ otherwise ─► proxy to Apps Script (+ _auth_uid, _proxy_secret) ─► Sheets
           X-Backend: pg | gas, X-Response-Time, one log line per request
```

- **Route:** extend `api/appscript-proxy.js` (already the production base URL) into `/api/rpc`; keep `/api/appscript-proxy` as an alias until the frontend base URL switches. Logic stays in `api/_lib/` (testable in plain Node, like `proxyCore.js` today).
- **Handler registry:** `api/_lib/handlers/<group>.js` exports `{ actionName: async (payload, ctx) => data }`; `ctx = { user, db, log, now }`. A handler returns the unwrapped data; the route wraps it.
- **Database access:** `@neondatabase/serverless` (HTTP for single queries, WebSocket `Pool` for transactions), Drizzle ORM for typed queries and migrations (`drizzle/` folder, `npm run db:migrate`).
- **Region:** Vercel functions pinned to `sin1`, Neon in `aws-ap-southeast-1` (Singapore) - one round trip ≈ 2–5 ms.
- **Observability:** the proxy's log line (action, duration_ms, user_id, company_id, auth, backend, status) gains `query_count`; Vercel log drains or Axiom for p95 per action.

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

### Phase 0 — Foundations
1. **Baseline:** deploy v9.4, run `node scripts/measure-api-latency.js` (5 runs per action) and record v9.3 vs v9.4 in REVIEW §5.
2. Neon project (Singapore), Vercel functions `sin1`, R2 bucket, env vars (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `R2_*`).
3. `/api/rpc` with the handler registry and the Apps Script fallback (the v9.4 proxy, extended). Identity adapters: `firebase` (exists), `authjs` (added here).
4. DDL + first migration; the load script (§7) run against a copy of the sheet.
5. **Sync job (Phase 1 only):** a Vercel Cron every 2–5 min pulls rows changed since the last sync (`updated_at` / `created_at` > watermark - this is why S2 real-UTC timestamps came first) through an Apps Script read-only export action, and upserts them. Deletes are soft (`is_active`), so they sync as updates.
- **Gate:** load script reproduces row counts per table; 10 tickets compared end to end; sync lag < 5 min.

### Phase 1 — Reads from Postgres (sync-fed)
- The reco's read list (dashboard, reference data, users, reports, checks) plus v9.4 `getDashboard` and v9.5 `getNotifications`, `getSLAEscalationRules`, `getSLAEscalationEvents`, `getCompanyHolidays`.
- The UI refreshes a ticket from the **write response**, not a re-read (reads may be one sync interval behind).
- **Gate:** every ported read meets its Claude.md latency + query budget on the §8 data set; `X-Backend: pg` on all of them.

### Phase 2 — Write cutover (short maintenance window)
1. Freeze writes: Script Property `READ_ONLY=true` (Apps Script answers writes with an error; the UI shows a maintenance banner).
2. Final sync, count verification, spot checks.
3. Switch **all** write actions to Postgres handlers in one deploy, by table group: ticket loop, workflow admin, users and roles, company admin (locks, SLA rules, dropdown access, config import / export), tags and sharing, **SLA escalation** (§9).
4. Stop the sync job. Keep the Apps Script deployment read-only for two weeks as a fallback, then retire it.
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

- **Cron:** Vercel Cron every 5 min → `/api/cron/sla` (header `Authorization: Bearer $CRON_SECRET`).
- **One set-based query** finds what is due: open tickets joined to the matching rules (step-specific beats "all steps" per level), `fire_at <= now()`, and `not exists` an event for (ticket, step, visit, rule). Uses the partial index on `tickets(step_due_date)`.
- **Idempotent:** `insert into sla_escalation_events … on conflict (ticket_id, step_id, visit_started_at, rule_id) do nothing returning *` - only inserted rows produce notifications, so overlapping runs can't double-notify (replaces `tryLock`).
- **Business calendar** in SQL or TS: `company_holidays` + business hours per company rule; Asia/Manila via `at time zone 'Asia/Manila'` (no hour arithmetic, compliance A17).
- **Email:** an `email_outbox` table filled in the same transaction, drained by a second cron through Resend / SES (retries, no MailApp quota); `notifications.email_status` updated from the outbox.
- **escalate_role grants:** a view `active_escalation_grants(ticket_id, role_id)` joined into the approver-eligibility query.

---

## §10 Risks and decisions

| Item | Note |
|---|---|
| Data privacy | If employer data is in TicketFlow, get IT / Data Privacy Act clearance before moving it to Neon / R2 |
| Plans and cost | Vercel Hobby forbids commercial use - Pro before charging customers; Neon Launch (no scale-to-zero cold starts) |
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
| **C. Fully on-prem app** | API server (Docker / Node) + database + static frontend on their network | B or A, plus self-hosted API (no Vercel), their own scheduler for the SLA job, their own mail relay | Large |

### §11.2 Pros and cons

| Pros | Cons |
|---|---|
| **Data residency / Data Privacy Act:** client data never leaves their network or provider (often the deciding factor for enterprises) | **No test access by default:** version, collation, permissions and network differences show up only at the client - **unless the client provides a dev / staging database** (§11.4) |
| Integration with the client's ERP: reports or views can join TicketFlow tables with ERP tables | **Support burden:** every client database is one more environment to upgrade, migrate and debug - remotely, through their IT |
| No cloud database cost for the client; LAN latency can be very low | **Networking:** Vercel functions can't reach a private database without a tunnel (Cloudflare Tunnel, VPN, or a public IP allow-list) - or the API must be hosted on-prem (shape C) |
| The client owns backups, retention and disaster recovery | Backups, HA and security patches become **their** responsibility - and outages land on us anyway |
| Can reuse the client's sign-in (Active Directory / Entra ID) via the Auth.js adapter (§3) | Two dialects (B) double the testing for every schema or query change; Postgres-only features (partial indexes, `ON CONFLICT`, `FOR UPDATE SKIP LOCKED`, `jsonb`) need equivalents |
| Easier to sell to clients that forbid SaaS | Releases need the client's change window; we can't hot-fix their database |

### §11.3 Decisions to take now, while building on Neon (so the path stays open)

1. **All database access through one repository layer** (`api/_lib/db/`): handlers never build SQL strings themselves, so a second dialect replaces one layer, not every handler.
2. **Use a query builder that supports several dialects** (Kysely or Drizzle with dialect-specific schema files; Kysely supports Postgres, MySQL, SQL Server and SQLite) instead of hand-written Postgres SQL in handlers.
3. **Keep Postgres-only features behind helpers:** `upsertOnConflict()`, `lockRowForUpdate()`, `jsonColumn()`. Each dialect implements them (SQL Server: `MERGE` / `WITH (UPDLOCK, ROWLOCK)` / `NVARCHAR(MAX)` + `ISJSON`).
4. **Keep the existing portable choices:** text ids, timestamps stored in UTC, Asia/Manila only at display (compliance A17), soft deletes, no database triggers holding business rules.
5. **Configuration only:** `DATABASE_URL`, `DB_DIALECT` (`postgres` default), `MAIL_TRANSPORT` (`resend` / `smtp`), `SCHEDULER` (`vercel-cron` / `external`). No code edits per client.
6. **The SLA job as a plain HTTP endpoint** (`/api/cron/sla`, signed): Vercel Cron calls it in the cloud, and an on-prem scheduler (Task Scheduler / cron / Kubernetes CronJob) calls it at a client.

### §11.4 How to test without the client's database

- **CI matrix:** run the handler suite (the `ROUTES_TEST_v9.x` scenarios ported to the API) against Docker images of each supported engine - `postgres:16`, and `mcr.microsoft.com/mssql/server:2022-latest` / `mysql:8` if shape B is offered. GitHub Actions `services:` start them per run.
- **Install checklist for the client's IT:** engine + version, collation (`Latin1_General_100_CI_AS_SC_UTF8` or equivalent for UTF-8), a dedicated database user with DDL rights for migrations, network path (tunnel or on-prem API), backups.
- **Health endpoint** (`getSystemHealth` equivalent) reporting engine, version, migration level and time zone, so the first remote check after an install shows mismatches at once.
- **Client dev / staging database (preferred - make it a contract condition):** a copy of their production engine, same version and collation, reachable from our CI (tunnel / VPN / allow-listed IP) with a dedicated test user. Our CI then runs the handler suite and every migration against it before each release, and the release goes to their production only after it passes there. Refresh it from production (masked data) before major releases.
- **A pilot client** before offering it widely.

### §11.5 Recommendation

Offer **shape A (client Postgres)** first: it is the same code as Neon and needs no extra dialect. Offer **B (SQL Server / MySQL)** only as a paid add-on when a client requires it, after §11.3 is in place and the CI matrix covers that engine. Treat **C** as a separate on-prem edition, priced with its support burden.
