<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: HANDOFF_v9.6_20261031.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Hand AppScript v9.6 from local session 2d369f00 to a Claude Code cloud session - scope, decisions, findings from reading v9.5, build order, checks | Status: Handoff (no v9.6 code written yet)
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created at the handoff (session 2d369f00)
===============================================================================
-->

# HANDOFF — AppScript v9.6 (31 Oct 2026)

> **Start the cloud session with:** "start v9.6 from `docs/planning/HANDOFF_v9.6_20261031.md`".
> Then read, in order: this file → `Claude.md` (incl. **🧑‍💻 WORKING RULES**) → `REF_SessionLog.md` §2–§3 (log the new session; 2d369f00 is a handoff) → `docs/guides/GUIDE_CodeReview_Compliance.md` §0 + §4 → `docs/planning/PLAN_FeatureGaps_Volume_20261031.md` §4.12 / §4.13 → `docs/planning/REVIEW_AppScriptReco_20261030.md` §4.

---

## §1 State at handoff

- **Live:** AppScript **v9.5.0** (`AUTH_MODE=enforce`, `PROXY_SECRET` set in Script Properties and Vercel), Vercel frontend from `a0eba35`, Firebase Google sign-in working.
- **Repo:** `main3` pushed at the handoff. Everything since v9.5 is docs (v10 roadmap, progress, this file).
- **v9.6 code:** none yet. v9.5 was read (routing, auth, schemas, email, proxy, test harness, sign-in flow) and the findings are in §3.
- **The cloud box has no:** local memory files (their rules are now in `Claude.md` 🧑‍💻 WORKING RULES), git-ignored `.env*.local` / `backup-password.txt` / `.claude/settings.local.json`, and the local MCP servers. v9.6 needs none of them. Run `npm install` first.
- **Deploying stays with the user** (Apps Script editor paste + redeploy, Vercel check). The cloud session builds, tests, commits and, when the user says so, pushes.

---

## §2 v9.6 scope (all decided by the user)

| # | Part | Decided in | Detail |
|---|---|---|---|
| 1 | **Authorization hardening** (S1 part 3) | session 7e008704 | `ADMIN_ONLY` action list in `doPost` checked with `isAdminUser(actorId(...))`; bootstrap while no admin exists; preferences on `actorId`; an admin-log row for **every** admin write | REVIEW §4 |
| 2 | **Sign-in allow-list** | 7e008704 | a verified user without access is refused (`NOT_INVITED`) | REVIEW §4, plan §4.12 |
| 3 | **User onboarding / invites** | 2d369f00 | `user_invites` tab; admin invite / resend / revoke; accepted on the first verified sign-in with that email; `allow:<uid>` CacheService (10 min) | plan **§4.12** |
| 4 | **Attachment links** | 7e008704 | URL + name (+ description / step) in `ticket_attachments` (`file_type = 'link'`); `getTicketAttachments`, `addTicketAttachmentLink`, `removeTicketAttachment` (soft); requester / current approvers / admin; http(s) only; TicketDetail **Links** tab | REF_SessionLog 7e008704 Pending |
| 5 | **Broken links: report, then edit** | 2d369f00 | anyone who can see the ticket reports; while reported, anyone who can add links fixes it in place (old → new URL in the action log); closed tickets allowed; 4 new columns | plan **§4.13** |
| 6 | **Company email settings** | 7e008704 | per company: on/off (overrides the ticket type's `sla_email`), sender name, Reply-To, optional CC, footer, "send test email"; MailApp `name` / `replyTo` only - no new permission | REF_SessionLog 7e008704 Pending |
| 7 | **Idle sign-out** | 7e008704 | 60 min without click / key / scroll / touch / tab focus (shared across tabs via localStorage) → sign out → `/login` shows "Session closed due to inactivity. Please sign in again." only after an idle timeout; **no warning**; reopening after > 60 min idle → same | REF_SessionLog 7e008704 Pending |
| 8 | **12-hour absolute cap** at the proxy | 7e008704 | refuse tokens whose `auth_time` is older than 12 h (env `MAX_SESSION_HOURS`, default 12) → fresh sign-in daily | REF_SessionLog 7e008704 Pending |

Schema changes in v9.6 (one rebuild apply): new tab `user_invites`; `ticket_attachments` + `link_status`, `reported_by`, `reported_at`, `report_note` (`COLUMN_DEFAULTS`: `link_status: 'ok'`); `companies` + `email_enabled` (`default` | `on` | `off`, default `default`), `email_sender_name`, `email_reply_to`, `email_cc`, `email_footer`.

---

## §3 Findings from reading v9.5 (`appscript_files/APPSCRIPT_v9.5_20261030_0650.txt`, 16,113 lines)

**Routing and auth**
- `doGet` :841 (reads), `doPost` :1037 → `authenticateRequest` (strips `_proxy_secret` / `_auth_uid`, sets `REQUEST_AUTH`) → `POST_READ_ONLY_ACTIONS` :1077 skip the lock, everything else runs `withScriptLock(() => routePostAction(...))` :1091. The proxy sends GET reads as POST with `_via_get` → `doGet`.
- `actorId(claimed)` :~330: **enforce** → the verified uid only; **warn / off** → the claimed id. The offline suites run in **warn** with no `PROXY_SECRET`.
- `isAdminUser` :12611 (an active role whose name contains "admin"); `requireAdmin(userId, what)` :14217. **21 handlers already check admin** (mostly v9.3–v9.5: SLA escalation, holidays, export / import, audit logs, reports, sharing, `updateTicketStatusAction`).
- **Not checked today** (admin config writes trusting the UI) → the `ADMIN_ONLY` list: `createCompany`, `updateCompany`, `deleteCompany`, `reactivateCompany`, `createRole`, `updateRole`, `deleteRole`, `createDropdownList`, `updateDropdownList`, `deleteDropdownList`, `testMinimalDropdownCreate`, `createTicketType`, `updateTicketType`, `deleteTicketType`, `createUserProfileType`, `updateUserProfileType`, `deleteUserProfileType`, `createRoleType`, `updateRoleType`, `deleteRoleType`, `createUserProfile`, `updateUserProfile`, `createCustomField`, `updateCustomField`, `deleteCustomField`, `initializeUserManagementTables`, `completeUserManagementSetup`, `setStepApprovers`, `assignUserRole`, `removeUserRole`, `bulkAssignRole`, `replaceUserRoles`, `updateUserRoleAssignment`, `deleteUserRoleAssignment`, `getExpiringAssignments`, `createWorkflowStep`, `updateWorkflowStep`, `deleteWorkflowStep`, `copyWorkflowSteps`, `createDefaultWorkflow`, `lockCompany`, `unlockCompany`, `saveCommentRequirements`, `saveStepConditions`, `saveReportConfig`, `assignDropdownToCompany`, `assignDropdownGlobally`, `removeDropdownCompanyAssignment`, `updateDropdownCompanyAssignments`, `createCompanySLARule`, `updateCompanySLARule`, `deleteCompanySLARule`, `createConfigurationBackup`, `setTicketTypeFeatures`, `createTicketLink`, `deleteTicketLink` (only the admin `CrossCompanyTicketLinker` calls them), plus the new v9.6 invite / company-email routes. **Keep open:** `createTag` / `updateTag` / `assignTags` / `removeTags` (users tag tickets from `TicketTagManager`; `deleteTag` already has its own rule), `createTicket`, `setCustomFieldValue`, `generateTicketNumber`, `submitStepApproval`, `updateTicket`, `updateTicketStatus`, `updateUserPreferences`, `recordLogin`, `shareTicket` / `revokeTicketShare`, `markNotificationsRead`.
- **Behaviour per mode (REVIEW §4):** enforce → refuse non-admins (`Only admins can …`); warn → log `AUTH warn: <action> by non-admin <uid>` and continue (so the older suites still pass); off → no check. **Bootstrap:** while no active admin assignment exists, admin-only actions are allowed for any verified user (logged `ADMIN_BOOTSTRAP`). The deploy guide must say to assign the admin role right after deploying, and JARVIS Admin (ADMIN_Tools v1.1) gets "Make a user admin" + a status line "No admin yet - bootstrap open".
- **Allow-list rule:** allow an actor with an **active `user_profiles` row OR any active role assignment** (the user's own uid may have assignments but no profile row; a profile-only rule would lock them out). Otherwise try a pending invite for the verified email → accept → continue; else `{ success:false, status:'error', code:'NOT_INVITED', error:'Your account isn't set up yet. Ask your administrator for an invite.' }`. Exempt: `ping`. Skip while bootstrap is open. Enforce refuses, warn logs.
- **Every admin write logged:** `logAdminAction` sets a per-request flag; after an `ADMIN_ONLY` write succeeds and no handler logged, `doPost` writes one generic row (`action_type = <action>`, target id from the payload's id keys, details = the payload keys, not values). Note `logAdminAction` :3256 still writes **positionally** (`appendRow([...])`, A1): switch it to `rowFromRecord` + `TABLE_SCHEMAS.admin_action_logs` while there.
- `getUserPreferences` (doGet) / `updateUserPreferences` (POST) take `user_id` from the request → use `actorId(...)`.

**Tables and helpers to reuse**
- `TABLE_SCHEMAS` :11372, `COLUMN_DEFAULTS` :11597, `ensureTableSheet` :11562, `readTable` :11864, `findRecord` :11891, `rowFromRecord` :3230, `generateId` :3245, `appendRecord` :14191, `appendRecords` :15759, `writeRecordsById` (after `appendRecords`), `updateRecordFields`, `liveRecords`, `sameId`, `isActiveFlag`, `boolFlag`, `groupBy`, `withScriptLock` :3128, `createHandlerResponse` :3210, `createDataResponse` :11949, `getTicketById` :8002, `createUserProfile` :10225, `createUserRoleAssignment` (used by the v9.5 test seed).
- `ticket_attachments` schema already has `file_type`, `step_id`, `description`, `company_id` + audit columns; `initializeTicketAttachmentsSheet` :2922.
- Email: `slaEmailEnabled(ticketType)`, `getSLANotificationSettings` / `saveSLANotificationSettings`, `mailQuotaRemaining`, `sendSLAEmails` (`MailApp.sendEmail({ to, subject, body })` :15882, outside the lock). Company settings: the company's `email_enabled` overrides the type's `sla_email` (`on` / `off`; `default` → the type / global rule); add `name` / `replyTo` / `cc` / footer to `sendSLAEmails` and to invite emails.

**Proxy** (`api/_lib/proxyCore.js`, 152 lines; test `scripts/test-proxy-auth.js`, 20 cases)
- `firebaseAdapter.verify` returns `{ uid, provider, email }`: also return `email_verified` and `auth_time`.
- Forward `_auth_email` **only when `email_verified`**; add `_auth_email` to `IDENTITY_FIELDS` (client-sent copies stripped) and strip it in `authenticateRequest` too.
- 12 h cap: a token whose `auth_time` is older than `MAX_SESSION_HOURS` counts as no identity; in enforce → 401 `{ code: 'SESSION_MAX_AGE', error: 'Your session reached 12 hours. Please sign in again.' }`. Also add codes to the existing 401s (`NOT_SIGNED_IN`, `SESSION_EXPIRED`).

**Frontend**
- `src/contexts/UserContext.js` `fetchUserData`: on any error it falls back to a **mock Admin role + mock company, also in production**. That's wrong, and with the allow-list a `NOT_INVITED` user would look like an admin. Limit the fallback to `DEV_CONFIG.DISABLE_AUTH`; otherwise show the error.
- `src/api/googleSheet.js` `HTTPClient.request` (:172) throws `HTTP 401` and **retries** it, dropping the body. Read the JSON body on 401 / 403, throw an `Error` with `.code` and `.status`, and don't retry. `sendRequest` keeps `error.code` from `{ code }` responses and dispatches `window` event `jarvis-auth` (`{ code }`) for `NOT_INVITED` / `SESSION_MAX_AGE` / `SESSION_EXPIRED`.
- `UserContext` listens to `jarvis-auth` → `signOut` → `/login` with the message. The idle timer also lives there. LoginPage (`src/pages/LoginPage.js`) shows the notice (sessionStorage key, shown once): idle → "Session closed due to inactivity. Please sign in again."; 12 h → the cap message; not invited → the invite message.
- Screens to add: Admin → Users → **Invite** (`src/components/admin/AdminUserList.js`), Admin → Companies → **Email** (`src/components/admin/AdminCompanyManager.js`), TicketDetail → **Links** tab (`src/components/tickets/TicketDetail.js`). The new client methods go in `src/api/googleSheet.js` (GET reads into `readActions`), hooks in `src/hooks/useAPI.js`.

**Test harness**
- `appscript_files/tools/lib/fakeSheetsRuntime.js` has no `CacheService`: add a fake `CacheService.getScriptCache()` (`get` / `put(key, value, ttl)` / `remove`), and expose it so tests can inspect it. The AppScript side wraps CacheService in try/catch (editor / missing service = no cache).
- New suite `appscript_files/tools/ROUTES_TEST_v9.6.js`, run with `properties: { AUTH_MODE: 'enforce', PROXY_SECRET: 's' }` and requests carrying `_proxy_secret` / `_auth_uid` / `_auth_email`. Cases:
  - admin-only refused / allowed; bootstrap open then closed;
  - warn mode logs and continues;
  - allow-list: profile, role-only, `NOT_INVITED`;
  - invite accept / expired / revoked / wrong email / second request served from the cache (read-count assert) / deactivated user refused;
  - links add / list / remove; report → edit → report cleared; edit refused while `ok`; closed ticket allowed; non-http(s) refused;
  - company email: settings save + `name` / `replyTo` / `cc` used by `sendSLAEmails` + test email; generic admin log row; preferences on `actorId`.
- Then **every older suite on the new file**: `ROUTES_TEST_v9.5.js` (25), `v9.4` (20), `v9.3` (10), `v9.2` (14), `v9.1` (18), `ROUTES_AND_APPROVALS_TEST_v9.0.js` (21), `CODE_REVIEW_FIXES_TEST_v8.3.js` (11), `SEED_TEST.js` (4), `ADMIN_TOOLS_TEST.js` (6), and `node scripts/test-proxy-auth.js` (20 + new).

---

## §4 Build order (compliance §0 recipe)

1. Copy v9.5 → `appscript_files/APPSCRIPT_v9.6_<YYYYMMDD>_<HHMM>.txt` (UTC+8 time), header `Version: 9.6`, `API_VERSION = '9.6.0'`, `Deploy description: v9.6 <stamp> - admin checks + allow-list + invites + attachment links + company email`, Phase 18.0 header block.
2. Schema (`TABLE_SCHEMAS`, `SHEETS`, `COLUMN_DEFAULTS`) → handlers → routes (doGet reads, `routePostAction` writes, `POST_READ_ONLY_ACTIONS` only for reads) → `ADMIN_ONLY` + allow-list in `doPost` / `doGet`.
3. `fakeSheetsRuntime.js` CacheService → `ROUTES_TEST_v9.6.js` → all older suites (§3).
4. Proxy (`proxyCore.js` + its test).
5. Frontend: `googleSheet.js` (methods, `readActions`, 401 handling, `jarvis-auth`), `useAPI.js` hooks, `UserContext` (fallback fix, idle timer, auth events), `LoginPage` notices, AdminUserList Invite, AdminCompanyManager Email, TicketDetail Links.
6. `ADMIN_Tools_v1.1_<stamp>.txt` (Make a user admin, bootstrap status, invites list) + `ADMIN_TOOLS_TEST.js`.
7. Checks: `npm run check:api-contract`, `npm run check:code-rules`, `npm run build:ci` (run in the background).
8. `/code-review` on `git diff --no-index appscript_files/APPSCRIPT_v9.5_20261030_0650.txt <v9.6 file>` + the frontend / proxy diff; log in `docs/planning/TODO_CodeReview_<YYYYMMDD>.md` (P7, P9).
9. Docs: deploy guide (v9.6 section: rebuild dry run → apply → assign admin → test sign-in → company email → test email), `Claude.md` reference #7 → v9.6, `docs/reference/DATABASE_SCHEMA_UPDATES.txt`, `appscript_files/APPSCRIPT_API.md`, `docs/reference/DEPENDENCY_MAPPING.md` / `docs/reference/DEVELOPMENT_PLAN.md` (new components), compliance §4 ticked. Recalculate `docs/planning/PROGRESS_FeatureCompletion.md` at the version close (REF_SessionLog §3 rule 6): expected **87.0 % spec / 66.5 % roadmap** once v9.6 is live.
10. Commit locally (pathspec). One push and one Vercel check at the end, after the user deploys AppScript v9.6.

---

## §5 Open defaults chosen at the handoff (say if any should change)

- Bootstrap = any verified user while no admin exists (logged), closed as soon as one active admin assignment exists.
- Allow-list = active profile **or** active role assignment.
- Invite expiry 14 days; email match lower-case; Google `email_verified` required.
- Allow-list cache 10 minutes, removed on profile deactivation / role removal.
