<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: HANDOFF_Migration_Phase0_20261115.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Handoff from session 92b85189 (migration 0.6, 0.7, 0.8 done) to the next session after a terminal restart + Node update | Status: Open - read at the start of the next session
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 92b85189). User: "push, create handoff so i an restart the terminal and update node"
===============================================================================
-->

# HANDOFF — migration Phase 0 continues (after a terminal restart + Node update)

## §0 Start here
1. Log the session in `REF_SessionLog.md` §2; it continues **92b85189** (close that row as a handoff, §3 rule 4).
2. Run `./scripts/check-backup-health.sh` (last backup `20261114-215609`).
3. **Node check:** `node -v` and `npm -v`. Before the restart they were **v22.23.5 / 10.9.9** (already ≥ 22.20, the Neon
   skills' minimum). If the user installed a new version:
   - still **22.x** → update the two Node / npm lines in `docs/reference/PRODUCTION_REQUIREMENTS.md` (v1.3, §Runtime +
     the compatibility matrix) and run the checks in §3 below;
   - a new major (**24.x**) → the Cloud Run image is `node:22-slim` (`Dockerfile`) and `server/package.json` says
     `>=22`; say that local and production now differ and offer (default-or-veto) to move the `Dockerfile` to
     `node:24-slim` in the same batch, PRODUCTION_REQUIREMENTS first. `react-scripts` 5 is old - run `npm run build:ci`
     before anything else.
4. **Neon skills** (optional, Node is new enough): on "install neon skills" → `neon skills -s neon --agent claude-code -y`
   (the Neon CLI must be reinstalled in the new scratchpad: `npm install neon@9.5.0` there; its sign-in is in the user
   profile).
5. **PGlite is gone** with the old scratchpad. Reinstall in the new scratchpad when a test needs it:
   `npm install @electric-sql/pglite@0.5.13` there, then pass `--pglite <that dir>` to `test-gen-ddl`, `test-db-migrate`,
   `test-db-load-sheets`, `test-db-explain`.
6. Then continue at §2.

## §1 Done in 92b85189 (14–15 Nov 2026)
- **0.3 (part):** D15 - data in Singapore approved by Kenneth R. Advento (owner, KRAtiv Solutions). Left: the IP /
  invention-assignment clause + the lawyer's review (with 0.10).
- **0.6 done:** driver `pg` 8.23.1 (no ORM, no Neon serverless driver; Better Auth at 1.3); `api/_lib/db.js`,
  `api/_lib/rpcCore.js` + `handlers/` (`/api/rpc`: ported action + `DATABASE_URL` → Postgres, `X-Backend: pg`; everything
  else → Apps Script), shared authenticator in `proxyCore.js`; `npm run db:migrate` (`schema_migrations`, checksums,
  advisory lock, preflight gate). Not deployed - production has no `DATABASE_URL` yet (deploy guide §G).
- **0.8 done:** editor-only export `appscript_files/EXPORT_ForPostgres_v1.0_20261114_2216.txt` (the user ran it:
  `daloy-export-20261115-0213.json` in My Drive) + `npm run db:load-sheets`. The real export showed a type error
  (`companies.email_enabled` is `default | on | off`, not boolean → rules v1.2); the loader now skips rows of spaces and
  gives `comment_requirements` a `cr_…` id. **Neon `dev` holds 303 clean rows; 28 skipped** (report next to the export in
  My Drive). Row counts + 10 tickets verified. **`0002` applied** (preflight clean).
- **0.7 done:** `npm run db:explain` → `docs/perf/EXPLAIN_HotPaths_20261115.md`: 17 / 17 hot paths can use an index at
  scale (seq scans off; a Seq Scan = FAIL). Watch at volume: `idx_user_role_assignments_user` may be redundant with
  `uq_user_role_assignments_grant`; the participants query should use `idx_ticket_participants_user_ticket`.
  User asked whether 10k rows is a fair index line: yes as *when to plan an index*; the proof is the Phase 1 timing at
  10k tickets against the p95 targets.
- Plan `PLAN_Migration_Unified_20261108.md` v1.7.2; Claude.md v4.9; PRODUCTION_REQUIREMENTS v1.3 (Node 22.23.5 recorded).
- Repo renamed **KRA-cpa/JARVISbyKRATIV** (remote updated).

**Neon `dev` now:** `0001` + `0002` applied, data loaded. To reload from a newer export, the constraints must come off
first (the loader refuses while `0002` is applied): `npm run db:migrate -- --down 0002 --yes`, then
`npm run db:load-sheets -- <export> --apply --replace --yes`, then `npm run db:migrate` (re-applies `0002`).

## §2 Next steps
| Step | Who | What |
|---|---|---|
| 0.9 | Claude | **reverse export** (Postgres → Sheets) written and tested - the Phase 2 rollback |
| 0.2 | You + Claude | check the two Cloud Run prices (Tier 2 Singapore, egress) in the Google calculator |
| 0.3 rest / 0.10 | Claude drafts, You | IP clause; DPA Annex C / Privacy / Terms wording + the sub-processor notice; lawyer review |
| — | You | delete `daloy-export-20261115-0213.json` + its two `.load-report` files from My Drive when done (company data) |
| ~21 Nov | Claude | `vercel.json` redirects → `"permanent": true` |
| Phase 1 | Claude | when the frontend moves to `/api/rpc`, `check:api-contract` counts rpc handlers too |

## §3 Checks before a push (Claude.md rule 3)
`npm run build:ci`, `check:api-contract`, `check:code-rules`, `check:ddl`, `test:server`, `test:db-migrate`,
`test:db-load-sheets`, `test:db-explain`, `node scripts/test-proxy-auth.js` + the offline AppScript suites. Database
commands need gcloud on PATH (`/c/Users/clark/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin` in Git Bash).

## §4 Working rules (unchanged)
- Claude writes all code; batch, then one push on "push"; long commands in the background; UTC+8 stamps from
  PowerShell `Get-Date`; read before write; decisions as default-or-veto statements; plain English for the user.
- Secrets never in chat, argv or repo files (Secret Manager only); exports and load reports stay outside the repo;
  nothing in the Google Sheet is changed by the migration.

## §5 Commits from 92b85189
Pushed through `d38e4b4` (main3, 15 Nov 2026, user: "push"). Local after that: the PRODUCTION_REQUIREMENTS v1.3 +
this handoff commit.
