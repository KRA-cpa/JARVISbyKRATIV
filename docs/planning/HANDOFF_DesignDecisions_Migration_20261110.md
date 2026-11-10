<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: HANDOFF_DesignDecisions_Migration_20261110.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 10 November 2026 UTC+8 (Philippine Standard Time) | Modified: 10 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Handoff from session 5f83b40e (UI fixes + UI refresh exploration) to the next session: MIGRATION first; the design decision session comes later | Status: Open - read at the start of the next session
REVISION HISTORY:
- v1.0.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 5f83b40e). User: "design decision will be prompted, next session will be migration"; "ill clear the session once handoff is created for the next steps"
===============================================================================
-->

# HANDOFF — next session = migration; design decisions later

## §0 Start here (next session)
1. Log the session in `REF_SessionLog.md` §2. It continues 5f83b40e: close that row as a handoff (§3 rule 4).
2. Run `./scripts/check-backup-health.sh` (session-start duty).
3. **This session is MIGRATION.** Don't open the design questions and don't ask which to do first. Begin at §2 below.
4. **Design decisions are not answered yet** (§1). No UI-refresh build starts until the design decision session has run.
5. **Doc banner:** docs written or amended from now on say **"JARVIS / DALOY by KRAtiv"** in the header banner, not "JARVISbyERP". Existing docs change only when they are next amended (memory `feedback_doc_banner_name`).

## §1 Design state (parked - for the later design decision session)
- **How decisions get taken:** `docs/design/DECISIONS_UIRefresh_20261110.md`.
  - The session starts with a **superthink** (§0.1 there): coverage of every finding, the reco check, dependency order, wording, cost tags.
  - Then **default-or-veto statements** in batches of 5–8, answered `ok` / `no` / `skip`. No 4-option pick lists, no pop-ups. Asked only when the user says to start.
  - **Answer log:** one attempt on 10 Nov, **not answered**.
- **Review:** `docs/design/REVIEW_UIErgonomics_20261110.md` v1.7.0 (findings L1, D1–D8, A1–A5, X1–X7, P1–P4, R1; the user's comments; skins proposal; build slices).
- **Snooze / Pause SLA design** (not built): `docs/design/DESIGN_SnoozePauseSLA_20261110.md` v1.2.0, decisions D1–D12. Snooze also appears in the plan tiers doc `docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md` v1.8.0 (§2 catalogue).
- **Artifacts on claude.ai** (private to the user):

| What | Link |
|---|---|
| Design system: Daloy (as built) | https://claude.ai/artifact/Xw3b237LuP3LnFAHboXSeA |
| Design system: Daloy Flow | https://claude.ai/artifact/F6V9mJmLbuVyPcbufoiL6K |
| Design system: Daloy Routing Slip | https://claude.ai/artifact/7REYguSSsxgtMQYzXQMQu9 |
| Design system: Daloy Quiet Utility | https://claude.ai/artifact/HuKF5ENy8yVYiF1dgt1uqB |
| Canvas: Daloy UI refresh (loaders, approving in Slip + Utility, Slip entry form + title rule) | https://claude.ai/artifact/8W9GpoveCYuaVh3y3EsYYS |
| Canvas: **Daloy River Slip** (loader + colours + 4 fonts as a tweak; approving; entering a request; form builder in 4 styles) | https://claude.ai/artifact/AXRqsRhVriJrqm2oCyETwc |

- **Server-side features the design needs (for Phase 4 of the migration):**
  - title rule per ticket type + "shown in lists" field;
  - route preview before sending;
  - the list trail (needs each ticket's route in the list data);
  - per-company skin + plan gate;
  - Snooze (Enterprise);
  - Pause SLA (proposed Advanced + Enterprise).
  Apps Script stays frozen, so all of these are built on the new server.

## §2 Migration - next steps (`docs/planning/PLAN_Migration_Unified_20261108.md` §5)
**Phase H - host move**
| Step | Who | What | Status |
|---|---|---|---|
| Test site check | You | Check Dashboard, Tickets filters, Reports dates and the footer on `https://first---daloy-xmczwkduaa-as.a.run.app` (revision `daloy-00005-sos`) | waiting |
| H.3 | Claude, on your "go" | `AUTH_MODE=enforce scripts/deploy-cloudrun.sh production` (gcloud on PATH: `/c/Users/clark/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin`, `CLOUDSDK_CORE_DISABLE_PROMPTS=1`) | waiting for "go" |
| H.3 | You | Firebase custom domain `daloy.blueknight.xyz` in `krativ-daloy` (leave the MX / forwarding records); authorized domains in `jarvisbyerp` (`daloy.blueknight.xyz`, `krativ-daloy.web.app`); Script Property `APP_URL` | after the deploy |
| H.4 | Claude, on your "push" | Merge `h4/vercel-previews-only` (`1db367a`), run `build:ci` + `check:api-contract` + `check:code-rules` + the offline suites, push main3 | after H.3 works end to end |
| H.4 | You | Vercel → Production Branch = `vercel-production-retired` | after the push |
| H.4 | Claude | `Claude.md` working rule 3 + memory `feedback_batch_then_deploy_check` (production check = Cloud Run); tick Phase H in §8 | after the above |

**Phase 0 - foundations (you first)**
- 0.1: confirm the data stack (Neon Singapore + Better Auth + SES Singapore).
- 0.2: verify the two Cloud Run prices.
- 0.3: Data Privacy Act / IT clearance.
- 0.4: Neon Free project (Singapore) + AWS SES account.
- Then Claude: 0.5 baseline latency → 0.6 `/api/rpc` → 0.7 schema → 0.8 export → 0.9 reverse export → 0.10 notices.

**Also open**
- v9.6 browser check 7 (attachment links).
- Cloud session row 017zmKf7 stays OPEN in the session log.

## §3 Working rules (unchanged)
- Claude writes all code; no `TODO(user)` stubs.
- Batch, then one deploy check. Push only on "push". A preview link before any push of UI changes.
- Long commands run in the background (the Z: drive is slow).
- UTC+8 stamps come from PowerShell `Get-Date`.
- Read before write; no shell pre-creating files.
- For decisions: default-or-veto statements, never 4-option pick lists (memory `feedback_decision_prompts`).

## §4 Commits from session 5f83b40e (local, not pushed)
- `749bd4a` / `c3b824f` / `52813f8`: UI fixes.
- `33f6cc8`: plan v1.5.0.
- `35213a9`: backup.
- `42324ea` → `c99f63b` + this handoff's commit: design docs.
- Branch `h4/vercel-previews-only` (`1db367a`).
- main3 is many commits ahead of origin.
