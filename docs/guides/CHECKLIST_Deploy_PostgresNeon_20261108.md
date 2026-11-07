<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: CHECKLIST_Deploy_PostgresNeon_20261108.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 8 November 2026 UTC+8 (Philippine Standard Time) | Modified: 8 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Chronological checklist to move Daloy from Google Sheets + Apps Script to Postgres on Neon, on the cheapest all-Asia stack (Cloud Run Singapore + Neon Singapore + Better Auth + SES Singapore) | Status: Draft - starts when the user confirms the stack (step 0)
REVISION HISTORY:
- v1.0.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 61523343) from PLAN_Migration_NeonVercel_20261030.md §6-§9 and CHECK_HostingPricing_20261108.md §6-§7 (user: "create a checklist of chronological steps to deploy to postgres/neon", "based on the cheapest option")
===============================================================================
-->

# CHECKLIST — Deploy to Postgres / Neon (cheapest all-Asia stack)

**Stack** (`docs/planning/CHECK_HostingPricing_20261108.md` §6): website + API on **Google Cloud Run `asia-southeast1`
(Singapore)**, jobs on **Cloud Scheduler**, database **Neon `aws-ap-southeast-1` (Singapore)**, sign-in **Better Auth**
(Google sign-in, tables in Neon), email **Amazon SES `ap-southeast-1`**. If step 0 picks the runner-up (Cloudflare
Pages + Workers) or Vercel `sin1`, the order stays the same; only steps 1, 3, 8–10 change host.

**Method** (`docs/planning/PLAN_Migration_NeonVercel_20261030.md` §6, Option A): copy Sheets into Postgres → move reads →
freeze and move writes → clean up. The API contract (`{ action, ...payload }` → `{ success, data, message }`) does not
change, so the frontend changes in one place (`apiConfig.baseURL`).

**Owner:** **You** = the user (accounts, payments, legal, approvals, Apps Script editor); **Claude** = code, scripts,
tests, docs. **Gate** = must be true before the next step starts.

---

## 0. Decide and verify (before anything is built)
- [ ] **You** - Confirm the stack above (it replaces Vercel + Firebase in `PLAN_Migration`, and settles cloud choice O11 in
      `PLAN_ServerCore_OrgSheetBridge_20261101.md` §5a).
- [ ] **You + Claude** - Verify the UNVERIFIED items in `CHECK_HostingPricing` §4: Cloud Run Tier 2 (Singapore) rates and
      egress in the Google pricing calculator; the custom-domain option in `asia-southeast1`. If they come out worse, switch
      to the Cloudflare runner-up.
- [ ] **You** - Data Privacy Act / IT clearance to move company data to Singapore; the IP / invention-assignment clause
      (`PLAN_Migration` §10).
- [ ] **You** - A lawyer reviews the DPA / Privacy / Terms changes (`CHECK_HostingPricing` §7).
- [ ] **You** - Meanwhile, the live site advertises plans (commercial use): put the Vercel team on **Pro** now, or plan the
      domain move (step 9) sooner.
- **Gate:** stack confirmed, prices verified, clearance given.

## 1. Accounts and environment (You)
- [ ] Google Cloud project; billing account (card); **budget alerts** (e.g. $5 / $20 / $50).
- [ ] Neon project in **`aws-ap-southeast-1`**; branches `main` (production) and `dev`; note the pooled + unpooled
      connection strings. Plan: **Free** while building.
- [ ] AWS account; **SES in `ap-southeast-1`**: verify the sending domain (DKIM, SPF, DMARC); **request production
      access** (the sandbox allows 200 emails / 24 h).
- [ ] Secrets in Google **Secret Manager**: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, Google OAuth
      client id / secret, SES keys, `CRON_SECRET`, `PROXY_SECRET` (the Apps Script fallback, as today).
- **Gate:** every account in an Asian region; nothing in `us-*` / `iad1`.

## 2. Baseline (Claude, You run it)
- [ ] `node scripts/measure-api-latency.js` on the live Apps Script v10.2 (5 runs per action); record it in
      `docs/planning/REVIEW_AppScriptReco_20261030.md` §5 for the before / after comparison.

## 3. Foundation (Claude)
- [ ] Update `docs/reference/PRODUCTION_REQUIREMENTS.md` **first** (new dependencies: `@neondatabase/serverless`,
      `drizzle-orm` / `drizzle-kit`, `better-auth`).
- [ ] A portable Node server: `/api/rpc` with the handler registry (`api/_lib/handlers/<group>.js`) and the **Apps
      Script fallback** for actions not ported yet; logs `action, duration_ms, query_count, user_id, company_id, status`
      and `X-Backend: pg | gas`.
- [ ] The same server serves the React build (one Cloud Run service = website + API).
- [ ] `Dockerfile`; Artifact Registry; Cloud Run service in **`asia-southeast1`**, min instances 0; preview revisions
      with **revision tags** (replaces Vercel preview links).
- [ ] Offline tests + `npm run check:api-contract` / `check:code-rules` still pass.
- **Gate:** the server runs locally and on a tagged Cloud Run revision, answering everything through the fallback.

## 4. Schema (Claude)
- [ ] `scripts/gen-ddl.js` from the **49 tables** in `TABLE_SCHEMAS` of the latest AppScript file; hand-tune into
      migration `0001` (types, keys, constraints - `PLAN_Migration` §4), day-one indexes, the v10 tables (§12:
      participants, outbox, country calendars, subscriptions).
- [ ] `npm run db:migrate` on Neon **`dev`**.
- **Gate:** migrations apply cleanly from empty; `EXPLAIN` for the hot paths saved in `docs/perf/`.

## 5. Export, load and reverse export (Claude writes, You run in the Apps Script editor)
- [ ] A **read-only export route** in a **new** AppScript version file (`APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt`; never
      edit an older one) - one JSON file per tab.
- [ ] `repairCompanyLocksApply()` first; then the transform (`PLAN_Migration` §7): booleans, blank → NULL, JSON text →
      `jsonb`, date text → `date`, the **`TS_UTC_SINCE` −8 h rule** per column.
- [ ] Load into `dev` in dependency order.
- [ ] **Reverse export** (Postgres → Sheets) written **and tested** - the rollback path for step 10.
- **Gate:** row counts match per table; 10 tickets compared end to end (history, current step, custom fields, escalation
  events).

## 6. Sign-in move (Claude)
- [ ] Better Auth with **Google sign-in**; its tables in Neon; the `authjs` adapter in the identity layer.
- [ ] `users` + `auth_identities`: the **Firebase uid stays the user id** (no re-keying of `requester_id` etc.); linking a
      second provider only after admin approval (`PLAN_Migration` §3).
- [ ] Sign-in allow-list + invites carried over (v9.6 rules).
- [ ] Both sign-ins work side by side until step 12.
- **Gate:** an existing user signs in with Better Auth and sees the same tickets.

## 7. Legal notice (You; Claude drafts)
- [ ] Draft the new DPA Annex C + transfers, Privacy providers / transfers / cookies, Terms providers
      (`CHECK_HostingPricing` §7); show them on previews.
- [ ] Send the **new Sub-processor notice** to every customer admin **at least [[30]] days before step 10**.
- **Gate:** notice sent, date recorded; the cutover date is ≥ [[30]] days later.

## 8. Sync (Phase 0.5) (Claude)
- [ ] A Cloud Scheduler job **every 5 min** → `/api/cron/sync`: rows changed since the last watermark (`updated_at` /
      `created_at`) through the Apps Script read-only export → upsert into Neon **`main`**.
- **Gate:** sync lag < 5 min for a day.

## 9. Reads from Postgres (Phase 1) (Claude; You check the previews)
- [ ] Port the read groups (dashboard, reference data, users, reports, notifications, SLA reads).
- [ ] Handler tests on a Neon branch per run; tagged-revision preview first, then production.
- [ ] Switch the **custom domain** to Cloud Run (website + API); keep the old address redirecting.
- **Gate:** every ported read meets its `Claude.md` p95 and query budget on the test data set; `X-Backend: pg` on all.

## 10. Write cutover (Phase 2) (You run the window, Claude deploys)
- [ ] Announce the maintenance window.
- [ ] Freeze writes: Script Property `READ_ONLY=true`.
- [ ] Final sync; row counts; spot checks.
- [ ] One deploy with **all** write groups + the Scheduler jobs: SLA escalation (every **30 min on Neon Free**, 15 min on
      Launch), email outbox through **SES**, nightly backup / archive.
- [ ] Smoke tests (create, approve, return, reject, reopen, cancel; two approvals on one ticket → exactly one
      transition); stop the sync job.
- [ ] Apps Script stays **read-only for 2 weeks** as a fallback.
- **Rollback:** before the deploy completes - unfreeze Apps Script and point the base URL back; after it - the reverse
  export (step 5).
- **Gate:** the load test passes; no write outside a transaction.

## 11. Publish the legal changes (You approve, Claude edits)
- [ ] `src/config/legal/dpa.js` (Annex C, transfers, security, deletion), `privacy.js` (providers, transfers, cookies,
      retention), `terms.js` (providers, proof-of-concept clause) - archive the old Terms version first
      (`termsArchive.js` rule); `src/config/site.js` `STATUS` (Google Cloud, Neon, AWS).

## 12. Clean-up (Phase 3) (Claude, You approve)
- [ ] **Neon Launch before the first paying customer** (Free suspends at its limit); decide scale-to-zero for production.
- [ ] Remove the Apps Script fallback and `READ_ONLY` handling; Row-Level Security on `company_id`.
- [ ] Scheduled backups; monitoring + alerts.
- [ ] Retire **Firebase Auth**, the **Vercel** project (remove `@vercel/speed-insights`) and the **Apps Script**
      deployment (after the 2 weeks).
- [ ] Update `docs/reference/PRODUCTION_REQUIREMENTS.md`, the deploy guide and `Claude.md`.

## 13. Ongoing
- [ ] Re-run `docs/guides/PROMPT_CheckHostingPricing.md` every 3 months and before price changes.
- [ ] Watch for a **Philippine region** (Neon, Google Cloud, AWS, Vercel, Azure - none today).
