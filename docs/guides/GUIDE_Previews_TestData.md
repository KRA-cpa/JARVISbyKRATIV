<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_Previews_TestData.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Point the Vercel preview builds at a TEST Google Sheet with SEED data, so Vercel never processes real personal data (user: "exclude Vercel in any platforms we use") | Status: Ready - your steps
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9) - privacy check #16
===============================================================================
-->

# GUIDE — Previews on test data only

**Why:** today the Vercel previews call the **live** Apps Script (real customer data through Vercel's servers in the
US). Vercel is not a Daloy platform, so previews must use a separate test Sheet filled with SEED data. Production
(Cloud Run, `daloy.blueknight.xyz`) is not touched. About 30 minutes, once.

## A. The test Sheet and its Apps Script (Google, in your browser)
1. Google Drive → **New → Google Sheets**. Name it `Daloy TEST - previews`.
2. In that Sheet: **Extensions → Apps Script**. The editor opens.
3. In the editor, open `Code.gs`, select everything, delete it, and paste the whole file
   `appscript_files/APPSCRIPT_v10.1_20261101_0101.txt` (the same version production runs). Press **Ctrl+S**.
4. Left panel **+ → Script**, name it `seed`. Paste the whole file `appscript_files/SEED_TestData_v1.1_20261031_2122.txt`.
   Put your own Firebase uid between the quotes of `SEED_MY_USER_ID` (Profile page in Daloy). Press **Ctrl+S**.
5. Function dropdown (top bar) → `rebuildAllTablesApply` → **Run**. Google asks for permissions the first time:
   **Review permissions → your account → Advanced → Go to (unsafe) → Allow**. Wait for "Execution completed".
6. Function dropdown → `seedTestDataApply` → **Run**. The log ends with the seed counts (2 companies, 4 users,
   12 tickets).
7. **Project Settings** (gear, left) → **Script Properties → Add script property** twice:
   - `PROXY_SECRET` = a new random value (e.g. 40 letters and digits; **not** production's). Keep it for step B2.
   - `AUTH_MODE` = `enforce`.
8. **Deploy → New deployment** → type **Web app** → Execute as **Me**, Who has access **Anyone** → **Deploy** →
   copy the **Web app URL** (ends in `/exec`).

## B. Vercel (Preview environment only)
1. vercel.com → project `jarvis_by_krativity` → **Settings → Environment Variables**.
2. Add `APPS_SCRIPT_URL` = the URL from A8, and `PROXY_SECRET` = the value from A7. For **both**: tick **Preview**
   only (untick Production and Development). Save.
3. If a variable with the same name already exists for Preview, **Edit** it instead (keep Production untouched).
4. **Deployments** → newest Preview → **⋯ → Redeploy** (or push to `preview/plans-public`).

## C. Check
1. Open the preview link (branch alias) and sign in.
2. Companies show only the seed companies (`SEED ...`), tickets only the 12 seed tickets.
3. Tell Claude "previews on test data" - Claude ticks CHECK_PrivacyCompliance #16 and the checklist.

## Notes
- The test Sheet holds no real person's data; keep it that way (no copying from the live Sheet).
- Remove seed data later with `removeSeedDataApply()`; re-seed with `seedTestDataApply()`.
- Neon `dev` (migration tests) still holds 303 real rows until the 1.1 sync proves out; then Claude replaces them with
  SEED rows (deletion guide §4.3).
