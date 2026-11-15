<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: OPEN_PlatformManager_20261115.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Open items of the Platform manager design - each with the DEFAULT the design uses until you answer, so you can come back to it | Status: Open (defaults in use)
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "create separate list of open items in plan", "use defaults, but create a doc so i can go back to it"
===============================================================================
-->

# OPEN — Platform manager: open items (defaults in use)

Design: [`PLAN_PlatformManager_20261106.md`](PLAN_PlatformManager_20261106.md) v2.0.0 (final). Every item below is
**already applied with its default**; nothing waits on you until the "Needed by" phase.

**How to answer:** fill "Your answer" and the date (or tell Claude "O4: ..."). Claude then updates the design and
marks the row done. "ok" = keep the default.

| # | Open item | Default in use | Where the design uses it | Owner | Needed by | Your answer | Date |
|---|---|---|---|---|---|---|---|
| O1 | Accounting system that receives the statements (PM-D5) - decides the CSV columns | a generic CSV: date, statement number, customer, line, USD, BSP rate, PHP | M4 export, `platformExportStatements` | You / tax adviser | PM3 | | |
| O2 | Statement due days and late-payment wording | due in 15 days; no penalty shown | PM-D8, M4 | You / counsel | PM3 | | |
| O3 | Tax items: EOPT invoicing, creditable withholding (CWT) rate, Form 2307 tracking | M12 stores the fields; no automatic tax lines on statements | M12 | Tax adviser | PM3 | | |
| O4 | Price book values and the founding-customer promotion | prices stay preview-only (`SHOW_PRICES` off) | M5, `/plans` | You | PM3 | | |
| O5 | The first owner's uid for `PLATFORM_OWNER_UIDS` (Cloud Run env; a uid, not a secret) | none - Claude asks for it when PM1 is deployed (your uid is on Profile) | §4 bootstrap | You → Claude sets it | PM1 | | |
| O6 | Re-auth window for sensitive actions, and how it works after the sign-in moves to Better Auth (migration 1.3) | 15 minutes on the Firebase `auth_time`; Claude confirms the Better Auth equivalent at 1.3 | PM-D16, §4 | Claude | PM1 | | |
| O7 | Who receives platform alerts, at which address | the owner, at the owner's KRAtiv mailbox | PM-D18 | You | PM1 | | |
| O8 | Support-grant length and the scope names customers see | 7 days; "metadata", "configuration", "tickets" | M10, PM-D9 | You | PM5 | | |
| O9 | Breach notice clock to customers (shared with the DPA / breach runbook) | 24 hours | M14 timers, M1 Needs attention | Counsel | PM1 | | |
| O10 | DPO name / title shown in M16 and on alerts (privacy checklist B1) | the role mailbox KRATIV.dpo@blueknight.xyz only | M16 | You | PM1 | | |
| O11 | Visual design - the UI refresh decisions (`docs/design/DECISIONS_UIRefresh_20261110.md`, none answered yet) | the current app look | PM-D19, every screen | You | before the first `/platform` screen ships | | |
| O12 | Progress scope +5 pts (PM-D10) | applied: roadmap 154 → 159 (`PROGRESS_FeatureCompletion.md`) | PROGRESS | You (ok) | now | | |
| O13 | Retention periods the console shows and runs (privacy checklist A5) | email outbox 90 days, sign-in rows 1 year | M16 retention, `scripts/db-retention.js` | You / counsel | PM1 | | |

**Done:** (rows move here with the answer and date)
