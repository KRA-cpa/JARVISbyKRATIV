<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: TODO_CodeReview_20261031.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Findings of the /code-review (high) of the v9.6 batch (cloud session 017zmKf7) and their fixes | Status: 9 fixed, 1 kept by design
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | 10 findings: 9 fixed in APPSCRIPT_v9.6_20261031_1510.txt (not yet deployed) and the proxy / frontend, 1 kept
===============================================================================
-->

# TODO — Code Review Findings (31 Oct 2026, v9.6)

**Scope (compliance P7):** `origin/main3...HEAD` = the v9.5 → v9.6 AppScript diff, `api/_lib/proxyCore.js`, the `src/` changes, ADMIN_Tools v1.1 and the tests. `/code-review high`, read-only (no verify pass), so the findings were candidates; each fix has a regression test where one is possible.
**Fixed in place:** `APPSCRIPT_v9.6_20261031_1510.txt` has never been deployed, so it was corrected instead of getting a new file (same as v9.4 / v9.5 in TODO_CodeReview_20261030).

| ID | Sev | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| CR3-01 | 🔴 | v9.6 `checkAllowList` | Two parallel requests on an invited user's first sign-in: both read "unknown" before the lock; the second found the invite already accepted and answered **NOT_INVITED**, so the frontend signed the new user out | Inside the lock: drop the request cache for profiles / assignments / invites, re-check, accept only if still unknown | v9.6 `review: a parallel first-sign-in request…` |
| CR3-02 | 🔴 | v9.6 `getTicketAttachments`, `reportAttachmentLinkBroken` | No "can see the ticket" check: any signed-in user could read another company's link URLs and spam reports / bells | `canSeeTicketLinks`: can manage, or a role in force in the ticket's company, or a live share (user / company). Interim until v10.0 `canViewTicket` | v9.6 links test (`u_far`) |
| CR3-03 | 🔴 | `api/_lib/proxyCore.js` | Every verify failure became `SESSION_EXPIRED`, which now signs people out: a JWKS fetch outage or a missing `FIREBASE_PROJECT_ID` would end every session | `SESSION_EXPIRED` only for jose `ERR_JWT_EXPIRED`; other failures → `TOKEN_REJECTED` (not a sign-out code) | proxy `key-set outage` + `401 codes` |
| CR3-04 | 🟠 | v9.6 `createHandlerResponse` | A handler's `code` (ADMIN_ONLY) stayed under `data.code`; the frontend reads `response.code`, so with mock mode on a refusal fell back to mock data | `code` copied to the top level | v9.6 `review: handler codes…` |
| CR3-05 | 🟠 | `src/api/googleSheet.js` | The "no mock for auth errors" guard used `!error.code`; a timeout's `DOMException` has numeric `code` 20, so timeouts lost the mock fallback | `backendCode()`: only string codes count | `build:ci` |
| CR3-06 | 🟡 | `src/pages/LoginPage.js` | The notice was read only when `isAuthenticated` changed; an idle sign-out on a directly opened `/login` never showed and leaked into a later visit | Effect also depends on `loading` (the auth state settling) | `build:ci` |
| CR3-07 | 🟡 | `src/utils/sessionGuard.js` | The cap notice always said "12 hours" though `MAX_SESSION_HOURS` can change it | The `jarvis-auth` event carries the server's message; `SESSION_MAX_AGE` shows it | `build:ci` |
| CR3-08 | 🟡 | v9.6 `saveCompanyEmailSettings`, `reportAttachmentLinkBroken` | Before the v9.6 rebuild apply, `updateRecordFields` skips the missing columns and the call reported success with nothing saved | `requireColumns()` → `SCHEMA_OUTDATED` "run the v9.6 schema rebuild" | v9.6 `review: before the v9.6 rebuild…` |
| CR3-09 | 🟡 | v9.6 `resendUserInvite` | Resending an expired invite could create a second pending invite for the same email (older grants silently lost), or email someone who already has a profile | Refused when another pending invite or a profile exists for the email | v9.6 `review: resend refuses…` |
| CR3-10 | ⚪ | v9.6 `requireAdminOrBootstrap` | The new admin handlers re-check admin after the doPost gate; in `warn` the gate only logs but these handlers refuse | **Kept by design**: the routes are new (no legacy UI relies on warn), so being strict in warn is the safer default; the repeat reads hit the per-request cache. Same pattern as the v9.5 handlers (`requireAdmin`) | - |

## Lessons → rules

- CR3-01: an allow-list (or any "first time" path) that writes must re-read inside the lock: the request cache is from before the lock. Candidate note for A14 ("reads taken before `withScriptLock` are stale inside it - invalidate what the decision depends on").
- CR3-03: only an error that the user can fix by signing in may end a session; infrastructure failures get their own code (F6 note).
- CR3-08: a write that depends on new schema columns checks for them (`requireColumns`) until the rebuild is known to be applied.

## Also found while testing (not review findings)

- `ROUTES_AND_APPROVALS_TEST_v9.0.js` "date-only end covers that day" fails on **v9.5 too** when the machine's time zone isn't Asia/Manila (the cloud container is UTC). Run the suites with `TZ=Asia/Manila`.
- Jest (`react-scripts test`): 104 of 174 tests fail on `main3` before this batch as well (same tests, same outcomes) - pre-existing, not touched here.
