<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_AppScript_Deploy_and_Schema_Rebuild.md | Author: Kenneth R. Advento | Version: 1.7.0
Created: 17 October 2026 UTC+8 (Philippine Standard Time) | Modified: 30 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Step-by-step guide to paste a new AppScript version and rebuild all Google Sheet tables safely | Status: Active

REVISION HISTORY:
- v1.0.0 | 17 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Initial guide for AppScript v8.1 (TABLE_SCHEMAS + rebuildAllTables)
- v1.1.0 | 17 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Current file → v8.2 (resolveColumnMapping implemented, KEEP policy); removed "implement first" prerequisite
- v1.1.1 | 17 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Added BLOCKED banner: apply step on hold until v8.3 fixes code review CR-01–CR-04
- v1.2.0 | 17 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Current file → v8.3 (code review fixes); banner removed; §0/§3 redeploy-first note (write lock); `defaulted` log field; lock-timeout error row
- v1.3.0 | 19 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §5 step 3: the New version description is copied from the file header's `Deploy description:` line (rule A11, from v8.4 on)
- v1.4.0 | 19 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Current file → v9.0 (API contract routes, roles & approvals); deploy the frontend with it (breaking: approve payload, loud errors); roles 5 → 12 columns (rebuild apply needed); §5 ping reports the file version
- v1.5.0 | 19 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Current file → v9.1 (core ticket loop, workflow admin, links, company lock, comment requirements); ticket_links 14 → 17 columns; new §3a repairCompanyLocks(); v9.0 may be skipped (v9.1 includes it)
- v1.6.0 | 19 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Current file → v9.3 (v9.2 routing / reports / audit log + v9.3 dropdown access, company SLA rules, config export / import / backup, tags & sharing); 2 new tabs, ticket_types 10 → 12 columns; Drive permission for backups; §5a turn tags / sharing on per ticket type; v9.0–v9.2 may be skipped
- v1.7.0 | 30 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Current file → v9.5 (v9.4 request cache, proxy auth, real UTC + v9.5 SLA escalation); 4 new tabs, tickets 27 → 28, ticket_types 12 → 13 columns; §5b proxy auth rollout (Script Properties PROXY_SECRET / AUTH_MODE + Vercel env, warn → enforce); §5c SLA escalation setup (migration, trigger with mail + trigger permissions, holidays, email); v9.4 may be skipped
===============================================================================
-->

# GUIDE — AppScript Deploy & Schema Rebuild

> Use this guide every time a new `APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt` file is created.
> **Latest file is the one with the newest timestamp** in `appscript_files/`.
> Current: `APPSCRIPT_v9.5_20261030_0650.txt` (contains v9.0–v9.4 - deploy it directly; nothing in between has to be deployed first)

> ⚠️ **v9.4 / v9.5 - also do §5b and §5c after §5:**
> - v9.4 checks a shared secret from the Vercel proxy and takes the acting user from the verified Firebase token (`AUTH_MODE` - default `warn`, which only logs). Set the Script Properties and Vercel env in §5b before switching to `enforce`.
> - v9.4 stores timestamps in real UTC (they were 8 hours ahead); the Script Property `TS_UTC_SINCE` records when. Nothing to do by hand.
> - v9.5 adds SLA escalation (rules, a 15-minute trigger, in-app notifications, optional email) and lets a company SLA rule set the step due date. §5c installs the trigger - it asks for **send email** and **trigger** permissions.
> - Deploy the frontend from the same commit: the bell, Admin → SLA Escalations and `getDashboard` call v9.4 / v9.5 routes.

> ⚠️ **v9.0 – v9.3 change the API contract** - deploy the frontend from the same commit right after §5:
> - The approve request sends `decision` (v9.0), and failures return `status: 'error'`, which the frontend shows instead of an empty list.
> - The new screens (`/tickets`, Admin → Workflows, Ticket Links) call the v9.1 routes; `/reports`, routing, Admin → Reports / Audit Log call v9.2; Admin → SLA Rules / System & Backup, dropdown access, tags and sharing call v9.3.
> - A task step's **Mark Task Complete** now moves the ticket to the next step (v9.2); before, it closed the whole ticket.
> - Cancel / reopen now need `user_id`, and reopen needs an admin role (a role whose name contains "admin").
>
> An older frontend keeps working for everything except approvals and the new screens.
>
> Offline tests (all must pass on the file you paste):
> - `node appscript_files/tools/ROUTES_TEST_v9.5.js appscript_files/APPSCRIPT_v9.5_20261030_0650.txt` → 25 PASS
> - `ROUTES_TEST_v9.4.js` → 20 PASS, `ROUTES_TEST_v9.3.js` → 10 PASS
> - `ROUTES_TEST_v9.2.js` → 14 PASS, `ROUTES_TEST_v9.1.js` → 18 PASS
> - `ROUTES_AND_APPROVALS_TEST_v9.0.js` → 21 PASS
> - `CODE_REVIEW_FIXES_TEST_v8.3.js` → 11 PASS (same file)
> - `node scripts/test-proxy-auth.js` → 20 PASS (the Vercel proxy)
>
> Checks: `npm run check:api-contract` → OK, `npm run check:code-rules` → OK. Never apply with v8.2.

**Time needed:** ~15 minutes | **Risk:** Low — the rebuild never deletes data and backs up every tab it changes

---

## §0 Before You Start

| Check | How |
|---|---|
| ☐ You can open the Google Sheet | Sheet ID `1EjFpr_yktSU6QAeBSAvcr6iWVtmaOCV1t5unvImmot4` (same as `SPREADSHEET_ID` in the script) |
| ☐ An `xSchema` tab exists in the Sheet | Needed by `analyzeCurrentSchema()` in §4. If missing: in the Sheet click **+** (bottom-left) → rename the new tab to `xSchema` |
| ☐ Nobody is using the app, **or** you redeploy (§5) before applying (§3) | The apply step holds the script lock, and v8.3+ web-app writes wait for it. Redeploying first is safe: v9.0+ writes by header name and works on the old layout too (a missing `roles` / `ticket_links` column is just skipped until the rebuild adds it) |

---

## §1 Paste the New File into the Apps Script Editor

1. Open the Google Sheet → **Extensions → Apps Script** (or open the project from script.google.com).
2. In the left panel, click the script file (usually `Code.gs`).
3. In the repo, open the latest file: `appscript_files/APPSCRIPT_v9.5_20261030_0650.txt` → select all → copy.
4. In the editor: **Ctrl+A** → **Ctrl+V** to replace everything.
5. **Ctrl+S** to save. If a red error bar appears, the paste was incomplete — repeat steps 3–5.
6. Quick check: the first lines must say `Version: 9.5`.

> Pasting and saving updates the **editor** only. The live web app keeps serving the old version until you redeploy (§5).

---

## §2 Dry Run — `rebuildAllTables()`

This **only reports**. It changes nothing.

1. In the toolbar function dropdown (next to **Debug**), choose **`rebuildAllTables`**.
2. Click **Run**.
3. First run only - and again after pasting v9.3, which adds Google Drive access for configuration backups: Google asks for authorization → **Review permissions** → choose your account → **Advanced → Go to (project) (unsafe)** → **Allow**. The Drive permission lets `createConfigurationBackup` save a JSON file in your Drive; nothing else uses it.
4. The **Execution log** opens at the bottom. Read one line per table:

| Log line | Meaning | Action |
|---|---|---|
| `OK: <table>` | Headers already match | None |
| `CREATED: <table>` | Tab is missing or empty — will be created with headers | None |
| `REPAIRED: <table> … added: […] moved: […] extra: […]` (+ `defaulted: […]`) | Headers differ — tab will be backed up and its rows re-mapped by column name | Review `extra` (see below) |
| `ERROR: <table>: …` | Something failed for that table | Stop — see §6 |

5. Last line: `=== REBUILD COMPLETE: X created, Y ok, Z repaired, N errors ===`

**Review before applying:**
- **`added`** — new columns, empty for existing rows. Normal.
- **`defaulted`** — added columns that existing rows get a value for instead of blank (`COLUMN_DEFAULTS`): `entity_category = 'ticket'` in `custom_fields` / `custom_field_values`, and (v9.0) `is_active = TRUE` in `roles`. Normal.
- **v9.5 expects**
  - `CREATED: sla_escalation_rules`, `CREATED: sla_escalation_events`, `CREATED: notifications`, `CREATED: company_holidays`
  - `REPAIRED: tickets … added: [step_started_at]` (blank for existing tickets - the escalation run falls back to the ticket history)
  - `REPAIRED: ticket_types … added: [sla_email] … defaulted: [sla_email]` (`default`: follows the global email setting, which is off)
  - v9.4 changes no table.
- **v9.3 expects** (if v9.3 was never applied)
  - `CREATED: dropdown_company_assignments` and `CREATED: company_sla_rules`
  - `REPAIRED: ticket_types … added: [enable_tags, enable_sharing] … defaulted: [enable_tags, enable_sharing]` (both off)
  - if v9.1 was never applied, also `REPAIRED: ticket_links … added: [enforce_blocking_rules, sync_status, notify_on_update] … defaulted: [enforce_blocking_rules, sync_status, notify_on_update]`
  - if v9.0 was never applied, also `REPAIRED: roles … added: [role_type_id, is_active, created_by, updated_by, deactivated_at, deactivated_by, deactivation_reason] … defaulted: [is_active]`

  v9.2 changes no table. Nothing else should change if v8.3 was applied.
- **`moved`** — existing columns that will change position. Data moves with its header. Normal.
- **`extra`** — columns in the tab that are **not** in `TABLE_SCHEMAS`. They are **kept**, moved after the official columns, with their data. A blank header becomes `_unnamed_<col>`; a repeated header becomes `<name>_dup_<col>`. If a name looks like a typo of a real column (e.g. `creatd_at`), fix the header in the Sheet by hand **before applying** and re-run the dry run — otherwise its data stays in the extra column instead of the real one.

> ⚠️ Repair matches columns **by header name**. If a tab has rows that were written under the wrong headers in the past (the Sept 24, 2025 schema issue), those values stay in the wrong columns after the repair. Spot-check a few rows in `tickets` and `custom_field_values` after §3.

---

## §3 Apply — `rebuildAllTablesApply()`

> If people may be using the app, do §5 (redeploy) **now**, then come back here — see §0.

1. Function dropdown → **`rebuildAllTablesApply`** → **Run**.
2. Wait for `=== REBUILD COMPLETE … ===` in the Execution log. The `REPAIRED` / `CREATED` counts should match the dry run.
3. In the Sheet you'll now see backup tabs: `_bak_<table>_<yyyyMMdd_HHmmss>` — one per repaired table. **Don't delete them yet.**

> If it stops with `Exceeded maximum execution time` (6-minute Apps Script limit), just run it again. Tables already fixed report `OK` and are skipped.

---

## §3a Once, on the first deploy of v9.1 or later: Repair the company lock columns — `repairCompanyLocks()`

Before v9.1, every company edit wrote `created_at` / `updated_at` into `code_locked` / `code_locked_at`, and nothing ever set the lock or `ticket_count`.

1. Function dropdown → **`repairCompanyLocks`** → **Run**. This is a dry run, so nothing changes. The log lists one line per company it would fix, e.g. `MYCO (co_1): {"code_locked":"2025-09-…"} -> {"code_locked":true,"ticket_count":3,…}`.
2. Check that the companies with tickets are the ones that get `code_locked: true`.
3. Function dropdown → **`repairCompanyLocksApply`** → **Run**.
4. Run **`repairCompanyLocks`** once more: it should report `0 company row(s) to repair`.

From now on the first ticket of a company locks its code. Admin → Companies → Edit has **Unlock Code**, which needs a reason that is logged.

---

## §4 Verify — `analyzeCurrentSchema()`

1. Function dropdown → **`analyzeCurrentSchema`** → **Run**.
2. Open the `xSchema` tab in the Sheet. Each row shows a table, its column count and its headers.
3. Compare against the expected column counts:

| Table | Cols | Table | Cols | Table | Cols |
|---|---|---|---|---|---|
| companies | 15 | step_slas | 13 | user_profile_types | 13 |
| roles | 12 | step_conditions | 16 | role_types | 17 |
| tickets | 28 | dropdown_lists | 12 | user_profiles | 19 |
| ticket_history | 11 | dropdown_options | 5 | ticket_tags | 18 |
| ticket_types | 13 | ticket_attachments | 19 | ticket_tag_assignments | 13 |
| comment_requirements | 16 | report_configurations | 18 | tag_categories | 15 |
| custom_fields | 19 | ticket_links | 17 | tag_usage_statistics | 8 |
| custom_field_values | 18 | sequence_counters | 2 | ticket_collaborations | 20 |
| workflow_steps | 19 | ticket_action_logs | 6 | collaboration_requests | 19 |
| step_approvers | 2 | admin_action_logs | 7 | collaboration_notifications | 10 |
| user_role_assignments | 24 | user_preferences | 12 | shared_ticket_access_logs | 9 |
| dropdown_company_assignments | 12 | company_sla_rules | 25 | sla_escalation_rules | 23 |
| sla_escalation_events | 15 | notifications | 14 | company_holidays | 12 |

A table with **more** columns than listed had `extra` columns, which are kept at the end — that's expected. Delete them in the Sheet by hand once you're sure they aren't needed.

4. Run **`rebuildAllTables`** (dry run) once more → every table should now say `OK`.

---

## §5 Redeploy the Web App (so the live API uses the new file)

1. **Deploy → Manage deployments**.
2. Select the active web-app deployment → **✏️ Edit**.
3. **Version → New version** → **Description**: copy the `Deploy description:` line from the header of the file you pasted (v9.5: `v9.5 20261030_0650 - SLA escalation rules + notifications + business calendar`; v9.4: `v9.4 20261030_0627 - request cache, one dropdown read, proxy auth, real UTC timestamps`; v9.3: `v9.3 20261019_2015 - dropdown access, company SLA rules, config export/import, tags & sharing`; v9.2: `v9.2 20261019_1946 - conditional routing, task steps, reports, audit log`; v9.1: `v9.1 20261019_1400 - core ticket loop routes, workflow admin, links, company lock, comment rules`; v9.0: `v9.0 20261019_0501 - API contract routes, roles & approval engine, loud errors`). For v8.3, which predates that line, use `v8.3 20261017_1510 - code review fixes CR-01..CR-07`. → **Deploy**.
4. The web-app URL stays the same — no frontend change needed.
5. Open the app → Admin page → confirm the API status shows connected and lists load.
6. From v9.0, `<web app URL>?action=ping` returns the file's `API_VERSION` - `"version": "9.5.0"` for v9.5. Before v9.0 it always said `8.0.0`. `?action=getSystemHealth` lists any tab whose headers differ from `TABLE_SCHEMAS`.

---

## §5a After v9.3: turn on tags / sharing where you want them

Both are **off** for every ticket type after the rebuild.

1. App → **Admin → Ticket Types**: each row has **Tags: off** and **Sharing: off** pills - click one to turn it on.
2. A switch can be turned off again only until the first ticket of that type is tagged / shared. After that the backend refuses, so no tag or share is orphaned (remove the tags / shares first if you really need it off).
3. Then: **Admin → SLA Rules** for company SLA targets, **Admin → System & Backup** → **Back up to Drive** once to confirm the Drive permission works (the file appears in the script owner's Drive).

---

## §5b After v9.4: proxy auth (Script Properties + Vercel env), warn first

Until v9.4 anyone with the web-app URL could act as any user (the request said who it was). Now the Vercel proxy verifies the Firebase ID token and forwards the uid with a shared secret.

1. Make a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. Apps Script editor → **Project Settings** (gear) → **Script Properties** → add `PROXY_SECRET` = the secret, `AUTH_MODE` = `warn`. (Optional: `CACHE_ENABLED` = `false` turns the v9.4 table cache off without a redeploy.)
3. Vercel → Project → **Settings → Environment Variables** (Production): `PROXY_SECRET` (same value), `AUTH_MODE` = `warn`, `APPS_SCRIPT_URL` = the web-app `/exec` URL, `FIREBASE_PROJECT_ID` = the Firebase project id (it falls back to `REACT_APP_FIREBASE_PROJECT_ID`). Redeploy the frontend.
4. Use the app for a while, then check:
   - Vercel → **Logs**: each proxy line has `"auth":"verified"` and your `user_id`.
   - Apps Script → **Executions**: no `AUTH warn:` lines for normal use (they mean a request came without a verified user, or claimed a different user than its token).
5. Switch both `AUTH_MODE` values to `enforce` (Script Property + Vercel env, then redeploy Vercel). Requests without the secret or without a signed-in user are now refused (`ping` still answers).
6. To roll back: set both to `warn` (or `off` = v9.3 behaviour).

> Still open (REVIEW S1 part 3): admin-only routes check the caller only where a v9.x handler already did (reports, audit log, config export / import, SLA escalation admin). Any signed-in Google account can still call the other admin writes - see `docs/planning/REVIEW_AppScriptReco_20261030.md` §4.

## §5c After v9.5: SLA escalation

1. **Migrate old escalation settings** (company SLA rules' warning threshold / escalation fields → escalation levels): function **`migrateCompanyEscalationsToRules`** → Run (dry run, the log lists the levels) → **`migrateCompanyEscalationsToRulesApply`** → Run. Running it again creates nothing.
2. **Install the trigger**: function **`installSLAEscalationTrigger`** → Run → Google asks for permission to **send email as you** and **run when you're not there** → Allow. Run it again any time - it removes duplicates. (`removeSLAEscalationTrigger` turns it off.)
3. **Dry run**: function **`runSLAEscalationsDryRun`** → Run → the log lists what would fire now (nothing is written or sent).
4. App → **Admin → SLA Escalations**:
   - **Rules**: company → ticket type → **Add Level** (e.g. level 1 at 75% to the current approvers, level 2 two hours overdue escalating to a Department Head role). **Preview** shows what would fire now.
   - **Holidays**: **Philippine holidays for <year>...** → check the list (Eid and Chinese New Year are proclaimed yearly - add them by hand) → **Add them**. They count when a company SLA rule has "exclude holidays".
   - **Email**: in-app notices always; turn email on per ticket type or by default. People who switched email off in their profile get in-app only.
5. **Smoke test**: a company SLA rule of 1 hour for a step + a level at 50% → create a ticket → within ~15 minutes (after 30 minutes of SLA time) the approvers see a bell notification (and an email when on).

---

## §6 If Something Goes Wrong

**Restore one table from its backup**
1. In the Sheet, right-click the broken tab (e.g. `tickets`) → **Delete**.
2. Right-click `_bak_tickets_<stamp>` → **Rename** → `tickets`.

**Common errors**

| Error | Cause | Fix |
|---|---|---|
| `xSchema sheet not found` | No `xSchema` tab | Create it (§0) |
| `Lock timeout` / `Could not obtain lock` | Another script run in progress | Wait a minute, run again |
| App shows a save error with `lock` in it during §3 | v8.3 web-app writes wait up to 30s for the rebuild's lock, then fail rather than lose data | Retry the save after the rebuild finishes |
| `A sheet with the name "_bak_…" already exists` | Two applies in the same second | Run again |
| `Exceeded maximum execution time` | 6-minute limit | Run again — finished tables are skipped |
| Backup fails with `You do not have permission to call DriveApp.createFile` | The Drive permission (v9.3) wasn't granted | Run any function in the editor (e.g. `rebuildAllTables`), allow the Drive permission, then redeploy (§5) |

**Cleanup:** after the app has worked normally for a few days, delete the `_bak_*` tabs.

---

## §7 Record It

- Add a line to `REF_SessionLog.md` (or tell Claude) with the date, the file version deployed, and the dry-run counts.
- Next AppScript change → new timestamped file → repeat this guide from §0.

---

## §8 Optional: Test Data — `SEED_TestData_v1.0_<stamp>.txt`

A separate script file that fills the Sheet with a complete test setup, so every screen has something to show. It
needs the main file v9.3+ in the same project and §3 done. Offline test: `node appscript_files/tools/SEED_TEST.js <APPSCRIPT file> <SEED file>` → 4 PASS.

1. Apps Script editor → **Files +** → **Script** → name it `seed` → paste the whole `appscript_files/SEED_TestData_v1.0_*.txt` → **Ctrl+S**. (Don't paste it into `Code.gs` - it is a second file.)
2. Optional: set `SEED_MY_USER_ID` at the top to your Firebase uid, so you get admin + Manager + Finance + IT roles in both seed companies and can approve / complete the seeded tickets yourself.
3. Function dropdown → **`seedTestData`** → **Run** (dry run: lists what it would add).
4. **`seedTestDataApply`** → **Run**. It adds:
   - companies **Seed Alpha Corp** (`SEEDA`) and **Seed Beta Inc** (`SEEDB`); ticket types **Seed Purchase Request** (tags + sharing on) and **Seed IT Setup**
   - custom fields (amount, department dropdown, date), roles, 4 seed users, comment rules (return / reject / cancel), report columns, a company SLA rule, 2 tags
   - per company: Manager Approval → (amount ≥ 50,000: Finance Review) → Procurement task (completing it creates a chained **Seed IT Setup** ticket), all with SLAs
   - 12 tickets taken through the real engine: waiting, at Finance, at the task, routed past Finance, completed + chained, returned, rejected, cancelled, overdue, tagged + shared, and 2 in Seed Beta
5. Re-running adds nothing. To start over or clean up: **`removeSeedData`** (dry run) → **`removeSeedDataApply`**. It deletes only seed rows (ids / keys starting `seed_`, the seed companies' tickets and everything attached to them, the `SEEDA-` / `SEEDB-` number counters). Admin log entries stay.

> The seed is editor-only and never routed. Don't run it on a Sheet where real companies use the codes `SEEDA` / `SEEDB`.
