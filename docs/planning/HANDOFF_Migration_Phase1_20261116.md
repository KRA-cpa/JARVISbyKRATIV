<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: HANDOFF_Migration_Phase1_20261116.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 16 November 2026 UTC+8 (Philippine Standard Time) | Modified: 16 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Handoff from session 461f9ea9 (migration 0.10 / 0.2 / 1.1 done, privacy batch, Platform manager final + /platform mockup) to the next session | Status: Open - read at the start of the next session
REVISION HISTORY:
- v1.0.0 | 16 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "close session, prepare handoff"
===============================================================================
-->

# HANDOFF — migration Phase 1 (after 1.1 went live)

## §0 Start here
1. Log the session in `REF_SessionLog.md` §2; it continues **461f9ea9** (that row is a handoff, §3 rule 4 - close it
   when you open the new one).
2. `./scripts/check-backup-health.sh` (a backup ran at the close of 461f9ea9, 16 Nov 2026 ~08:00).
3. `git status` - expected clean on `main3`; everything up to `9da604c` is pushed (main3 + `preview/plans-public`). The
   handoff commit itself may still be local (the user says "push").
4. **First question to the user (open decision, §3):** the 1.2 approach. Ask it as default-or-veto, no pick list.
5. Tools that lived in the old scratchpad are gone - reinstall in the new scratchpad only when needed:
   - Neon CLI: `npm install neonctl@2.15.0` there (its sign-in is in `~/.config/neon/credentials.json`; a browser
     re-auth may be asked - the user clicks "authorize").
   - PGlite: `npm install @electric-sql/pglite@0.5.13` there, then `--pglite <dir>` for `test-sheets-sync`,
     `test-gen-ddl`, `test-db-migrate`, `test-db-load-sheets`, `test-db-explain`, `test:privacy-db`.

## §1 Done in 461f9ea9 (15–16 Nov 2026)
- **0.10** legal drafts for after the move (DPA v0.4 Annex B / C, Privacy, Terms v0.16, `/data-location`), breach notice
  templates A / B / B2 / P / PE + Admin → Security Notices history, forced sign-out + who is signed in (deploy guide §H),
  announcements A1 (§I), privacy check + batch 2 (migration `0003_privacy`, privacy handlers, T1 / T2 / retention
  scripts, PrivacyNoticeGate, Organization Terms, Your data).
- **Platform manager** final design v2.0.0 + `OPEN_PlatformManager_20261115.md` (O1–O14, defaults applied); `/platform`
  wireframe with staff sign-in `/platform/login`, console header / loader, **M17 Costs mockup** (sample data - O14) and
  the console's **own tab icon** (`public/favicon-platform.svg`, `src/hooks/useConsoleTab.js`).
- **Login v2** is `/login`; ESG page draft `/sustainability`; 0.2 Cloud Run prices verified.
- **1.1 DONE in production (16 Nov, user "go"):**
  - Neon `production` branch (`br-cold-feather-aoyphgfz`, database `daloy`, endpoint `ep-red-truth-…`): `0001`–`0003`
    applied, synced (322 clean rows, 28 left out by the 0.8 rule).
  - Secret **`daloy-db-prod-url`** (Singapore only) → Cloud Run env **`SYNC_DATABASE_URL`** - deliberately not
    `DATABASE_URL`, so `/api/rpc` still answers every action from Apps Script.
  - `POST /api/cron/sync` (`server/cronSync.js`; shared run `scripts/lib/syncRun.js` with an advisory lock; caller = a
    Google-signed OIDC token of `daloy-scheduler@krativ-daloy.iam.gserviceaccount.com`, no roles, no keys).
  - Production = revision **`daloy-00009-kec`** (100 %); the website (Firebase Hosting) was NOT republished - the live
    frontend is still the 14 Nov build. `deploy-cloudrun.sh` v1.4 (`SKIP_HOSTING=1` for a server-only deploy).
  - Cloud Scheduler `asia-southeast1`, Asia/Manila: `daloy-sync-hourly` (`0 * * * *`) + `daloy-sync-workhours`
    (`5-55/5 7-19 * * 1-5`). Runs take 1.3–4.5 s.
  - The developer's Token Creator grants on `daloy-sheet-reader` and `daloy-scheduler` are removed; only the Cloud Run
    compute account borrows the reader. Runbook: deploy guide §J.
  - Artifact Registry `cloud-run-source-deploy`: cleanup rule keep 5 newest (user "ok"); 154 MB.
- Tests added: `test:cron-sync` (7), `test:sheets-export` (5), `test:sheets-sync` (8 with PGlite). All pre-push checks
  passed at `9da604c`.

## §2 State to know
- **Progress:** 88.0 % spec / 75.6 % roadmap (of 159) - unchanged this session (1.1 is infrastructure; M17 Costs is a
  proposal, not in scope until the user approves O14).
- **Production data path:** website → Cloud Run → Apps Script → Sheet (source of truth). Neon production is a copy,
  up to 5 min behind in working hours, up to 60 min otherwise.
- **Terminal sync runs** now need a temporary Token Creator grant on `daloy-sheet-reader` for the developer account
  (grant, run, remove - deploy guide §J). Prefer `gcloud scheduler jobs run daloy-sync-hourly …`.
- **Gotchas found:** an empty `POST` to `*.run.app` gets **411** from Google's front end (send a body - the jobs send
  `{}`); `/healthz` on `run.app` is answered by Google (404), not by the app; the preview alias is behind Vercel's login
  (curl gets 302); a `cloudbilling` call with user credentials hit a quota error (quota project) - use
  `--billing-project krativ-daloy` or a service account next time.
- **Not deployed / preview only:** all UI work since 14 Nov (privacy gate, login v2, announcements, `/platform`,
  `/sustainability`, legal drafts) - production frontend changes only on the user's "go" (website deploy =
  `deploy-cloudrun.sh production` without `SKIP_HOSTING`).

## §3 Next - decision waiting for the user
Claude's recommendation (default; the user may veto): **build 1.2 now but switch production later.**
- Why: until the write cutover every save goes to Apps Script; Postgres reads in production would be up to 5 min
  (after hours 60 min) stale - a user would not see the ticket they just created / approved.
- So: port the read groups (dashboard, reference data, users, reports, notifications, SLA reads) and test them on the
  preview against Neon `dev` with the Claude.md p95 + query budgets; production reads stay on Apps Script until Phase 2,
  when reads and writes switch in one deploy. **Plan change:** 1.2's gate = "passes on the preview".
- Order after that (preview first): 1.2 reads → 1.3 Better Auth beside Firebase → the write groups (2.4's code, built
  early) → 0.9 reverse export → rewrite the 2 integration suites (`src/tests/integration/AdminWorkflow.test.js`,
  `UniversalEntityArchitecture.test.js`) → Phase 2 (announce, freeze, final sync, one deploy, smoke tests).
- On "ok": update `PLAN_Migration_Unified_20261108.md` 1.2 (gate + note), then start 1.2 with the reference-data group
  (state each action's expected query count + indexes first - Claude.md working rules).

## §4 User items (carry in the closing list)
1. The 1.2 decision above.
2. 0.5 baseline: `node scripts/measure-api-latency.js --url https://daloy.blueknight.xyz/api/appscript-proxy`.
3. Costs mockup: "estimate" / "partial" labels + realistic $0.00 sample amounts - not answered yet.
4. O14 for real numbers: Billing → Billing export → BigQuery (standard usage cost, dataset in `asia-southeast1`);
   optional budget ($10, 50 / 90 / 100 %).
5. ~1 Dec: Neon November CU-h against 100.
6. Earlier lists still open: `CHECKLIST_Privacy_UserReview_20261115.md` (B1 DPO, C1–C2 sign PIA / manual, D1 2SV, D2–D4,
   E counsel); lawyer review (0.3, gates 3.1); Platform O5 / O7 / O10 / O11 before PM1; UI refresh decisions
   (`docs/design/DECISIONS_UIRefresh_20261110.md`); ESG E2 / E3.
