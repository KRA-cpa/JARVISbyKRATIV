<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: HANDOFF_Migration_Phase0_20261114.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 14 November 2026 UTC+8 (Philippine Standard Time) | Modified: 14 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Handoff from session 44cbe47d (Phase H done, Phase 0 started) to the next session after a Claude Code restart | Status: Open - read at the start of the next session
REVISION HISTORY:
- v1.0.0 | 14 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 44cbe47d). User: "pause session, as i will restart claude"
===============================================================================
-->

# HANDOFF — migration Phase 0 continues (after a Claude Code restart)

## §0 Start here
1. Log the session in `REF_SessionLog.md` §2; it continues **44cbe47d** (close that row as a handoff, §3 rule 4).
2. Run `./scripts/check-backup-health.sh`.
3. The user restarted Claude Code to load the new **`.mcp.json`** (Neon MCP server). Check it is listed (`/mcp`); the first
   use asks the user to sign in to Neon (OAuth). Ask whether to **commit `.mcp.json`** (URL only, no secret - Claude's
   default: commit it).
4. Then continue at §2.

## §1 Done in 44cbe47d (11–14 Nov 2026)
- **Phase H complete:** production = `https://daloy.blueknight.xyz` (Firebase Hosting → Cloud Run `asia-southeast1`,
  revision `daloy-00007-z66`, `AUTH_MODE=enforce`); DNS = CNAME `daloy` → `krativ-daloy.web.app` + TXT
  `_acme-challenge.daloy` (keep it); certificate active. Vercel = previews only: Production Branch
  `vercel-production-retired` (exists on GitHub at `d1602c3`; **never push to it**); `jarvis-by-erp.vercel.app` and
  `jarvis.blueknight.xyz` redirect (307) to the new domain. **~21 Nov:** switch both redirects in `vercel.json` to
  `"permanent": true` (needs a production build → temporarily point the Vercel branch back, or leave as 307).
- **0.1 done → D13 / D14** (plan §1): Neon Singapore + Better Auth + Cloud Scheduler + attachments in the client's
  Drive; **email through the client's own mail service** (E1–E7): client notification emails **off until the client
  connects its mail**; the client-admin invite + platform mail from KRAtiv's Google mailbox; Apps Script keeps sending
  for today's companies until the connector ships (E6). SES dropped.
- **0.4 done (Neon only):** project `daloy` `falling-brook-59657512` (org `org-shy-haze-40497133`), `aws-ap-southeast-1`,
  Postgres 18, Free; branches `production` + `dev` (`br-muddy-band-aocsslat`); database `daloy` (owner `neondb_owner`).
  Secret **`daloy-db-dev-url`** in `krativ-daloy` (asia-southeast1 only, direct connection). Neon CLI 9.5.0 lives in the
  old session's scratchpad (gone after restart) - reinstall in the new scratchpad if needed (`npm install neon@9.5.0`
  there; `npx` failed on an npm cache lock); its sign-in is saved in the user profile.
- **0.5 done:** baseline in `docs/planning/REVIEW_AppScriptReco_20261030.md` §5.1 (getTickets 5.4–5.9 s, dropdowns
  3.5–4.0 s, inbox 4.6–5.3 s, dashboard 6.2–6.6 s, report 7.8 s median). Script gained `--report-type`.
- **0.7 part 1 done:** `scripts/gen-ddl.js` + `scripts/db/ddl-rules.js` v1.1 → `migrations/postgres/0001` / `0002`
  (55 tables incl. `mail_connections`); `npm run check:ddl`; PGlite check passed (PGlite was in the old scratchpad).
- Claude.md v4.6 (working rule 3: production = Cloud Run; `check:ddl` before a push); memories
  `feedback_batch_then_deploy_check` (updated), `feedback_spell_out_interactive_steps` (new).

## §2 Next steps
| Step | Who | What |
|---|---|---|
| 0.6 | Claude | `docs/reference/PRODUCTION_REQUIREMENTS.md` first (new packages - recommend `pg` for Cloud Run + Neon's direct / pooled URL; Better Auth later at 1.3), then the migration runner (`npm run db:migrate`, `schema_migrations` table, reads `daloy-db-dev-url` via `gcloud secrets versions access` without printing it), then `/api/rpc` skeleton in `server/app.js` |
| 0.7 part 2 | Claude | apply `0001` on Neon `dev`; `EXPLAIN` for the hot paths in `docs/perf/` |
| 0.2 | You + Claude | check the two Cloud Run prices (Tier 2 Singapore, egress) in the Google calculator |
| 0.3 | You | Data Privacy Act / IT clearance for data in Singapore |
| 0.8 | Claude writes, You run | read-only export route (a new AppScript **fix** file) → load into Neon `dev` → preflight → `0002` |
| — | You (optional) | Node.js ≥ 22.20 if you want the Neon skills (`neon skills -s neon --agent claude-code -y`) |

## §3 Working rules (unchanged)
- Claude writes all code; batch, then one push on "push"; long commands in the background; UTC+8 stamps from
  PowerShell `Get-Date`; read before write; decisions as default-or-veto statements.
- User-run commands: one action per step, say where a prompt appears and what to paste (memory
  `feedback_spell_out_interactive_steps`).
- Secrets never in chat, argv or repo files: Secret Manager only.

## §4 Commits from 44cbe47d
Pushed: through `d1602c3` (main3 + branch `vercel-production-retired`). Local, not pushed: `b86c593`, `93c2f6b`,
`1f17024`, `786d078`, `f4461c6`, `573e7ad`, `13f5bb6`, `909e484` + this handoff commit. Untracked: `.mcp.json`, `.firebase/`
(Firebase deploy cache - consider adding to `.gitignore`).
