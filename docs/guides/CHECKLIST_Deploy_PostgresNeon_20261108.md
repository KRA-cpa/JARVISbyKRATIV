<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: CHECKLIST_Deploy_PostgresNeon_20261108.md | Author: Kenneth R. Advento | Version: 2.0.0
Created: 8 November 2026 UTC+8 (Philippine Standard Time) | Modified: 8 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Pointer - the step-by-step moved into the unified migration plan | Status: SUPERSEDED by docs/planning/PLAN_Migration_Unified_20261108.md
REVISION HISTORY:
- v2.0.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Superseded (user: "might need a unified migration plan + step-by-step"): every step H, 0-13 is now in PLAN_Migration_Unified_20261108.md §5 (Phases F, H, 0-5); this file keeps only the pointer. v1.1.0 is in git history
- v1.1.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Step H: host move first; Better Auth cookie __session
- v1.0.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 61523343)
===============================================================================
-->

# CHECKLIST — Deploy to Postgres / Neon → **superseded**

The step-by-step now lives in **`docs/planning/PLAN_Migration_Unified_20261108.md` §5**:

| Old step (v1.1.0) | Now |
|---|---|
| H. Host move | Phase H (runbook `docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md`) |
| 0. Decide and verify | Phase 0, steps 0.1–0.3 |
| 1. Accounts | 0.4 |
| 2. Baseline | 0.5 |
| 3. Foundation | 0.6 |
| 4. Schema | 0.7 (+ `organizations` from day one) |
| 5. Export, load, reverse export | 0.8–0.9 |
| 6. Sign-in move | 1.3 |
| 7. Legal notice | 0.10 |
| 8. Sync | 1.1 |
| 9. Reads | 1.2 |
| 10. Write cutover | Phase 2 |
| 11. Publish legal | 3.1 |
| 12. Clean-up | 3.2–3.5 (only the shared Apps Script deployment retires - Google Sheets stays a customer option) |
| 13. Ongoing | Ongoing |
