## **Ticketing & Workflow Orchestration System: Functional Specifications**

A. DO NOT FORGET to Read first md/txt/or any file before you update.
B. Consult `docs/planning/SUPERTHINK_TODO_ANALYSIS_2025-09-27.md` on current/completed to do. From 31 Oct 2026 the **current roadmap** is `docs/planning/PLAN_FeatureGaps_Volume_20261031.md` (AppScript v10 line). A "superthink" is a check against the Claude web reco (`docs/planning/REVIEW_AppScriptReco_20261030.md`: P1–P8 / S1–S6, §9 targets, A14–A20 / F1–F6 / P7–P10), not a broad audit (that plan's §11).
C. Log every session in `REF_SessionLog.md` (see 🗓️ SESSION LOG below).
D. New docs go in the matching `docs/` folder (see 📁 REPO LAYOUT below) — never the repo root.
E. **Progress %** lives in `docs/planning/PROGRESS_FeatureCompletion.md` (spec basis + rebased roadmap). Recalculate it at every AppScript version close / session dump (`REF_SessionLog.md` §3 rule 6).

**Version:** 4.2 **Date:** October 31, 2026 - 🔐 **v9.6 BUILT (cloud session 017zmKf7, not deployed yet)**: admin-only routes + first-admin bootstrap, sign-in allow-list + invites, attachment links with broken-link reports, company email settings, idle sign-out + 12-hour cap at the proxy; ADMIN_Tools v1.1; review log `docs/planning/TODO_CodeReview_20261031.md`; deploy guide v1.8.0 §5d (make yourself admin before the redeploy). **v4.1** - 🧭 **ROADMAP v10 + PROGRESS** (feature gaps + volume design `docs/planning/PLAN_FeatureGaps_Volume_20261031.md`: ticket visibility per type, who can create, Restricted tickets / fields, pagination + search, workflow notifications, immediate head approval, delegation, bulk approve; AppScript **v10.0–v10.2** after v9.6; `docs/planning/PROGRESS_FeatureCompletion.md`: 78.8 % spec / 57.8 % roadmap at v9.5 live. v9.6 also gets user onboarding / invites. Nothing built yet. **v9.6 handoff to a cloud session: `docs/planning/HANDOFF_v9.6_20261031.md`**; 🧑‍💻 WORKING RULES added.) **v4.0** (October 30, 2026) - ⏱️ **RECO QUICK WINS, PROXY AUTH, SLA ESCALATION** (AppScript v9.4: per-request table cache, one dropdown read, ticket id sequence, `getDashboard`, Firebase token verified at the Vercel proxy + `AUTH_MODE`, real UTC timestamps; v9.5: SLA escalation rules / run / notifications / holidays, company SLA rule due dates; compliance v2.0 rules A14–A20 + F1–F6 + `npm run check:code-rules`; non-functional targets below. v3.9 = workflow logic, reports, tags & sharing, v3.8 = core ticket loop, v3.7 = API contract check, v3.6 = code review compliance, v3.5 = repo reorg into `docs/`)

### **🧑‍💻 WORKING RULES** *(the user's standing preferences; copied 31 Oct 2026 from the local Claude memory so cloud sessions follow them too)*

1. **Claude writes all the code.** Never leave `TODO(user)` stubs or ask the user to write the "meaningful" parts; this overrides any output style that asks for user contributions. When a step is a real policy choice, pick the safe recommended option, build it, and say which one was chosen and how to switch.
2. **AppScript: a new timestamped file per update.** `appscript_files/APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt` (UTC+8), never edit an older version or `APPSCRIPT.txt`. The header has a `Deploy description:` line (`v<ver> <YYYYMMDD_HHMM> - <summary>`, < ~100 chars) for the redeploy dialog; update reference #7 below.
3. **Batch, then one deploy check.** In a multi-item release, do every item and commit locally step by step; one push and one Vercel check at the end. Before the push: `npm run build:ci`, `npm run check:api-contract`, `npm run check:code-rules` and the offline AppScript suites. A frontend push that needs new routes waits for the user's AppScript deploy. Push only when the user says so.
4. **Long commands in the background.** Builds, test suites and backups run in the background (on the Z: drive a build takes minutes); give the user a one-line status first and carry on meanwhile.
5. **Log every session** in `REF_SessionLog.md` §2 at the start; close only per its §3 (incl. the handoff exception and rule 6, progress at version close).
6. **Superthink = grounded in the Claude web reco.** Check against `docs/planning/REVIEW_AppScriptReco_20261030.md` (P1–P8 / S1–S6, §9 targets, A14–A20 / F1–F6 / P7–P10); no broad TODO sweep or per-file audit unless asked.

### **📁 REPO LAYOUT**

| Folder | Contents |
|---|---|
| `/` (root) | `Claude.md`, `README.md`, `Gemini.md`, `REF_SessionLog.md`, configs, and dev launchers: `run-backend.bat` (local mock :3001), `run-frontend.bat [live\|local]` (:3000), `run-dev.bat [local\|live]` (both windows), `AdminCMD.bat` |
| `docs/reference/` | Mandatory references below + `docs/reference/DATABASE_SCHEMA_UPDATES.txt` |
| `docs/guides/` | How-to, setup and testing guides |
| `docs/design/` | Feature designs and system analyses |
| `docs/planning/` | Active TODOs and plans |
| `docs/backups/` | Conversation backup system docs |
| `docs/archive/2025-09/` | Finished audits, debriefs, superseded plans (frozen — links not maintained) |
| `appscript_files/` | Latest `APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt`, frozen `APPSCRIPT.txt` (v8.0), deploy guide, API/implementation/audit docs |
| `appscript_files/tools/` | Local AppScript server, API test scripts, Apps Script test/analyzer snippets |
| `appscript_files/archive/` | `versions/` (old AppScript copies) and `troubleshooting/` (Sept 2025 debug notes) |

Reorg record: `docs/planning/PLAN_RepoReorg_20261017.md` + `docs/planning/REORG_MANIFEST.tsv` (old → new paths). Check links with `node scripts/reorg-relink.js --check`.

### **🔗 MANDATORY DEVELOPMENT REFERENCES**

**BEFORE ANY DEVELOPMENT WORK, CONSULT THESE REQUIRED DOCUMENTS:**

1. **`docs/reference/PRODUCTION_REQUIREMENTS.md`** - 🚨 **CRITICAL MANDATORY REFERENCE**
   - Node.js, npm, and runtime environment requirements
   - Complete dependency list with versions and compatibility matrix
   - CSS framework configuration and build requirements
   - Google Sheets + Apps Script proof of concept database documentation
   - Mandatory update clause for design requirement changes

2. **`docs/reference/DEVELOPMENT_PLAN.md`** - ⚠️ **MANDATORY REFERENCE**
   - Complete 45-file architecture with current file structure
   - React hooks documentation and usage patterns
   - 7-layer dependency hierarchy and import rules
   - Code quality standards and best practices
   - Phase completion status and technical requirements

3. **`docs/reference/DEPENDENCY_MAPPING.md`** - ⚠️ **MANDATORY REFERENCE**
   - Component dependency relationships and architecture
   - Import/export rules for circular dependency prevention
   - Layered architecture validation guidelines
   - Component categorization and interaction patterns

4. **`docs/reference/SUPERTHINK_AUDIT.md`** - ⚠️ **MANDATORY REFERENCE**
   - File-by-file audit results and quality metrics
   - React hooks compliance and validation status
   - Compilation error fixes and icon reference corrections
   - ESLint compliance and code quality standards

5. **`docs/reference/SLA_IMPLEMENTATION.md`** - ⚠️ **MANDATORY REFERENCE**
   - Complete SLA calculator implementation documentation
   - Business rules for Philippine timezone and SLA calculations
   - API integration points and component requirements
   - Phase-by-phase implementation tracking and status

6. **`docs/reference/DATABASE_SCHEMA_UPDATES.txt`** - ⚠️ **MANDATORY REFERENCE**
   - **File Location**: `./docs/reference/DATABASE_SCHEMA_UPDATES.txt`
   - Complete database schema documentation and updates
   - Google Sheets table structure definitions
   - Schema migration and update tracking

7. **`APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt`** - ⚠️ **MANDATORY REFERENCE**
   - **Latest File**: `./appscript_files/APPSCRIPT_v9.7_20261031_1748.txt` (v9.7 — attachment link rules: https links only to Script Property `LINK_ALLOWED_HOSTS` (default `docs.google.com,drive.google.com`, exact host, `*` = the v9.6 rule), links saved earlier on other hosts come back `link_allowed: false` (not clickable); the link name is required. No schema change. Test `ROUTES_TEST_v9.7.js` (6))
   - **v9.6**: `APPSCRIPT_v9.6_20261031_1510.txt` (v9.6 — authorization hardening (S1 part 3): `ADMIN_ONLY_ACTIONS` checked in doPost against the verified uid (`enforce` refuses with `ADMIN_ONLY`, `warn` logs), **bootstrap** while no active admin assignment exists, every admin write leaves an `admin_action_logs` row; **sign-in allow-list** (active profile or role in force, else a pending invite for the Google-verified email is accepted, else `NOT_INVITED` / `ACCOUNT_DISABLED`; CacheService `allow:<uid>` 10 min); **invites** (`user_invites` tab, create / resend / revoke, 14 days); **attachment links** (add / remove / report broken / fix in place, http(s) only); **company email settings** (on/off over `sla_email`, sender name, Reply-To, CC, footer, test email); preferences on `actorId`. Rebuild apply needed: 1 new tab, `ticket_attachments` + 4, `companies` + 5 columns. **Make yourself admin (JARVIS Admin v1.1) before the redeploy** - deploy guide §5d. Contains v9.5 - deploy it directly; then push the frontend + proxy)
   - **v9.5**: `APPSCRIPT_v9.5_20261030_0650.txt` (v9.5 — SLA escalation: `sla_escalation_rules` (levels per company + ticket type + step; `percent_elapsed` / `before_due` / `after_due`; `escalation_action` notify or escalate_role), `sla_escalation_events`, in-app `notifications` (header bell), `company_holidays` + `addPhilippineHolidays`; `runSLAEscalations` from a 15-minute trigger (`installSLAEscalationTrigger()` once in the editor - asks for mail + trigger permissions), email per ticket type / global default + the user's preference; a company SLA rule for the step's name now sets the due date (business hours / days, holidays). Rebuild apply needed: 4 new tabs, tickets + `step_started_at`, ticket_types + `sla_email`; then `migrateCompanyEscalationsToRules()` dry run / apply. Contains v9.4 - deploy it directly. Deploy the frontend from the same commit)
   - **v9.4**: `APPSCRIPT_v9.4_20261030_0627.txt` (reco quick wins: per-request table cache (`CACHE_ENABLED` Script Property kill switch), `getDropdownLists` one options read, ticket id from the `ticket_id` sequence, links indexed once, `getDashboard`; S1 proxy auth - Script Properties `PROXY_SECRET` + `AUTH_MODE` (`off` / `warn` default / `enforce`), `actorId()` in permission checks; S2 real UTC timestamps (`TS_UTC_SINCE`); S3–S5 fixes. No schema change. Review: `docs/planning/REVIEW_AppScriptReco_20261030.md`)
   - **v9.3**: `APPSCRIPT_v9.3_20261019_2015.txt` (v9.3 — dropdown company access (get / assign / global / remove / update; getDropdownLists filters by company), company SLA rules CRUD, exportConfiguration (read-only) / createConfigurationBackup (JSON in the owner's Drive - new Drive permission) / importConfiguration (company to company, dry run by default), tags + sharing with per-ticket-type switches `enable_tags` / `enable_sharing` (off by default, locked on once used), old unrouted Phase 11 code removed. Rebuild apply needed: 2 new tabs, ticket_types + 2 columns. Contains v9.0–v9.2 - deploy it directly. Deploy the frontend from the same commit)
   - **v9.2**: `APPSCRIPT_v9.2_20261019_1946.txt` (conditional routing per step, returns follow the path taken, task steps complete like an approval, chained links, reports config + data, admin audit log reads; no schema change)
   - **v9.1**: `APPSCRIPT_v9.1_20261019_1400.txt` (v9.1 — core ticket loop + workflow admin: ticket number peek/reserve, workflow step create/update/delete/copy/default with SLAs, custom field get/update/delete (in use → hidden), ticket links by number with cycle check, company code lock/unlock/status (locks on the first ticket; `repairCompanyLocks()` in the editor), comment requirements saved + enforced, getTicketHistory, getTicketsForApproval inbox; review fixes R-03–R-10. Rebuild apply needed: ticket_links + 3 columns. Deploy the frontend from the same commit)
   - **v9.0**: `APPSCRIPT_v9.0_20261019_0501.txt` (approval path routes, date-aware roles, approver_logic 'all', loud errors; the approve request sends `decision`)
   - ⚠️ **Never apply the rebuild with v8.2** (data-corruption bugs; see `docs/planning/TODO_CodeReview_20261017.md`). Redeploy before applying if the app may be in use.
   - **Offline tests** (fake Sheets runtime in `appscript_files/tools/lib/fakeSheetsRuntime.js` - from v9.4 it fails any test that reads a cached tab after a write without `invalidateTable`, counts tab reads, and fakes Properties / MailApp / ScriptApp), all on the latest file, with `TZ=Asia/Manila`: `node appscript_files/tools/ROUTES_TEST_v9.6.js <file>` (24 tests; fakes CacheService too), `ROUTES_TEST_v9.5.js` (25), `ROUTES_TEST_v9.4.js` (20), `ROUTES_TEST_v9.3.js` (10), `ROUTES_TEST_v9.2.js` (14), `ROUTES_TEST_v9.1.js` (18), `ROUTES_AND_APPROVALS_TEST_v9.0.js` (21) and `CODE_REVIEW_FIXES_TEST_v8.3.js` (11). Proxy: `node scripts/test-proxy-auth.js` (26: + verified email, 12-hour cap `MAX_SESSION_HOURS`, 401 codes)
   - **Test data**: `./appscript_files/SEED_TestData_v1.0_20261019_2023.txt` - a second script file (`seed.gs`) in the same Apps Script project: `seedTestData()` dry run / `seedTestDataApply()` (2 seed companies, workflows with a branch + task + chained ticket, roles, 4 seed users, 12 tickets through the real engine; `SEED_MY_USER_ID` gives your uid seed roles), `removeSeedData()` / `removeSeedDataApply()` deletes only seed rows. Editor-only. Test: `node appscript_files/tools/SEED_TEST.js <APPSCRIPT file> <SEED file>` (4). Deploy guide §8
   - **Admin menu (v9.6+)**: `./appscript_files/ADMIN_Tools_v1.2_20261031_1609.txt` - a second script file (`admin.gs`) whose `onOpen` adds **JARVIS Admin** to the Sheet: status (incl. admins / *bootstrap open*), schema check / repair, company locks, SLA escalation migrate / trigger / preview, AUTH_MODE, **4. Users & access** (recent sign-ins, make a user admin, pending invites), **5. Testing (temporary)** (set up my admin access, give me / remove test roles, test as non-admin + restore, clean up - `docs/guides/GUIDE_Testing_SwitchRoles.md`). v1.0 = for v9.5. Test: `node appscript_files/tools/ADMIN_TOOLS_TEST.js <APPSCRIPT file> <ADMIN file>` (15). Deploy guide §0a
   - **Contract check**: `npm run check:api-contract` — every `makeRequest` action has a route in the newest file, every `API.Group.method()` call exists, every component is mounted from `src/index.js`, every `Icons.X` exists; `scripts/api-contract-known-gaps.txt` (0 actions since v9.3; 8 unmounted components + 2 icons left from the baseline) may only shrink
   - **Code rules check (v9.4)**: `npm run check:code-rules` — self-test, then static checks of compliance A14–A18 / A20 on the newest AppScript file and F3 / F4 on `src/`; `scripts/code-rules-known-gaps.txt` (91 on v9.3 → 7) may only shrink
   - **Cache rule (v9.4, A14)**: read through `readTable` / `sheetValues` / `ss()`; every sheet write calls `invalidateTable(...)` in the same function
   - **Identity rule (v9.4, A15)**: the acting user comes from `actorId(payload.user_id)`; payload keys that name a target user stay as sent. Deploy: set Script Properties `PROXY_SECRET` (same value as the Vercel env) and `AUTH_MODE=warn`, check the logs, then `enforce`
   - **Header rule (v8.3)**: write rows by header name (`rowFromRecord`), create tabs with `ensureTableSheet()`, and take `withScriptLock()` for writes. No positional rows, no hard-coded header lists.
   - **Naming Rule**: every AppScript update is a NEW file `APPSCRIPT_v<ver>_<YYYYMMDD>_<HHMM>.txt` (UTC+8); never overwrite older versions. The newest timestamp is the latest.
   - **Deploy description (from v8.4)**: the file header has a `Deploy description:` line (`v<ver> <YYYYMMDD_HHMM> - <summary>`) to paste into New version → Description on redeploy. From v9.0, `ping` also reports the file's `API_VERSION` (keep it equal to the header `Version:`; through v8.3 it always said `8.0.0`).
   - **Snapshot**: `./appscript_files/APPSCRIPT.txt` is frozen at v8.0 (Nov 27, 2025) — do not edit
   - **Schema Source of Truth**: `TABLE_SCHEMAS` in the latest file (column order follows the positional writers)
   - **Deploy / Rebuild Guide**: `./appscript_files/GUIDE_AppScript_Deploy_and_Schema_Rebuild.md` — paste → dry run → apply → verify → redeploy
   - Complete Google Apps Script backend implementation
   - All API functions and database operations
   - Backend deployment and configuration code

8. **`docs/reference/RESOLUTION_CHECKLIST.md`** - 🚨 **CRITICAL MANDATORY REFERENCE FOR ALL ERROR RESOLUTION**
   - **File Location**: `./docs/reference/RESOLUTION_CHECKLIST.md`
   - Fundamental Resolution Rule with domain-specific checks
   - Comprehensive Frontend (8 checks), API (7 checks), AppScript (9 checks), Schema (6 checks)
   - Must be consulted before any error resolution attempt
   - Working pattern reference library for each domain

9. **`docs/reference/USER_MANAGEMENT_FEATURE_PLAN.md`** - 🚀 **NEW REVOLUTIONARY MANDATORY REFERENCE**
   - **File Location**: `./docs/reference/USER_MANAGEMENT_FEATURE_PLAN.md`
   - Revolutionary user/role system with universal custom fields
   - User profile types, role types, and unified dropdown system
   - Date-based role assignments and immediate approver relationships
   - Complete implementation specifications for Phase 10.0

10. **`docs/reference/UNIVERSAL_ENTITY_ARCHITECTURE.md`** - 🚨 **CRITICAL MANDATORY REFERENCE FOR ALL ENTITY WORK**
   - **File Location**: `./docs/reference/UNIVERSAL_ENTITY_ARCHITECTURE.md`
   - Defines universal entity concept treating tickets, user profiles, and roles uniformly
   - Same custom fields infrastructure reused across all entity types
   - Required reading before any component, API, or schema work involving entities
   - Implementation guidelines and backward compatibility requirements

11. **`docs/guides/GUIDE_CodeReview_Compliance.md`** (v2.0) - 🚨 **MANDATORY FOR ALL APPSCRIPT, COUNTERPART (`src/`, `api/`) AND `scripts/` CHANGES**
   - **File Location**: `./docs/guides/GUIDE_CodeReview_Compliance.md`
   - Rules from the 17 + 19 Oct 2026 code reviews and the 30 Oct 2026 reco review (`docs/planning/REVIEW_AppScriptReco_20261030.md`)
   - **§0 change recipe**: schema → handler → route → offline test → `googleSheet.js` method → hook → mounted component → proxy → checks → review
   - AppScript A1–A13: header-driven rows, `TABLE_SCHEMAS` only, `COLUMN_DEFAULTS`, no destructive routes, `withScriptLock`, `createHandlerResponse`, frontend key matching, offline test, **contract check (A12)**, **no payload key `action` (A13)**
   - AppScript A14–A20 (v2.0): **cache invalidation (A14)**, **actor from `actorId()` (A15)**, **one read per tab per request (A16)**, **real UTC, Manila via `formatDate` (A17)**, ids from `generateId` / a sequence (A18), idempotent time-driven jobs (A19), one definition per function (A20)
   - Counterpart F1–F6: server owns business rules, ID token in `Authorization`, `Intl` in Asia/Manila, no fake saves, call budget per screen, proxy verifies + strips identity fields
   - Process P7–P10: review the **version diff** (`git diff --no-index <prev> <new>`), whole-file review every 3 versions, one review log per version, read-count gate on hot paths
   - Scripts S1–S9: `pipefail`, no secrets in argv, pathspec commits, recorded times not mtimes, exact-match scope, CRLF, sandbox tests
   - §4 pre-commit checklist — tick it before every AppScript, frontend, proxy or script commit

**⚠️ CRITICAL DEVELOPMENT RULES:**
- **NO COMPONENT CREATION** without consulting dependency mapping
- **NO HOOK MODIFICATIONS** without reviewing audit documentation
- **NO DEPENDENCY CHANGES** without updating `docs/reference/PRODUCTION_REQUIREMENTS.md` first
- **ALL IMPORTS** must follow 7-layer dependency hierarchy
- **VERIFY FILE STRUCTURE** against current 45-file inventory in `docs/reference/DEVELOPMENT_PLAN.md`
- **PREVENT REACT ERROR #130** by following `docs/reference/REACT_ERROR_130_PREVENTION_GUIDE.md`
- **VERIFY ROUTES** exist in App.js before implementing navigation
- **TEST COMPILATION** with `npm run build:ci` before committing changes: it builds like Vercel (`CI=true`), where any ESLint warning fails the deploy (compliance P6)
- **🔌 API CONTRACT** - a new frontend API action ships with its AppScript route in the same batch, and a new component is mounted in the batch that adds it; `npm run check:api-contract` must pass (compliance A12). A phase is done when a screen reaches its endpoints, not when its functions or components are written (P5)
- **🚀 NEW: UNIVERSAL ENTITY RULES** - All entity types (tickets, users, roles) must use unified custom field patterns
- **🚀 NEW: USER/ROLE INTEGRATION** - Follow `docs/reference/USER_MANAGEMENT_FEATURE_PLAN.md` for all user/role implementations
- **🚨 MANDATORY: UNIVERSAL ENTITY ARCHITECTURE** - Must consult `docs/reference/UNIVERSAL_ENTITY_ARCHITECTURE.md` before any entity-related work
- **⚖️ CODE REVIEW COMPLIANCE** - AppScript, counterpart and `scripts/` changes follow `docs/guides/GUIDE_CodeReview_Compliance.md` (tick its §4 checklist); run `/code-review` on the version diff, `npm run check:api-contract` **and** `npm run check:code-rules` before pushing a batch, and log findings in `docs/planning/TODO_CodeReview_<YYYYMMDD>.md`

### **📏 NON-FUNCTIONAL REQUIREMENTS (mandatory)** *(from the 19 Oct 2026 reco §9.6; added v4.0)*

These are the gates for the Vercel `/api/rpc` + Neon build (`docs/planning/PLAN_Migration_NeonVercel_20261030.md`). On Apps Script (v9.4+) the same intent is enforced by compliance A14–A17 and the read-count tests (P10).

**Performance**
- Server p95 per action, measured in `/api/rpc`: simple read ≤150 ms; list/dashboard ≤300 ms; ticket write ≤400 ms; admin write ≤500 ms; report ≤1.5 s at 10k tickets.
- Query budget: simple read ≤3 queries; list ≤5; workflow write ≤10, in one transaction.
- No queries inside loops (N+1). Use joins, `IN (...)` or `ANY($1)`. Flag any exception before writing it.
- Paginate list actions (default 50, max 100). No unpaginated response over 1 MB.
- Every new query on a table that can exceed 10k rows must use an index; show `EXPLAIN` for hot paths.

**Correctness & security**
- `user_id` comes from the server session only; ignore any `user_id` in the request body.
- Check admin / approver / share / report permissions on the server for every action.
- Every company-scoped query filters by `company_id`.
- Store timestamps as `timestamptz` in UTC; convert to Asia/Manila only for display and SLA day logic. Never shift times by adding hours.
- Ticket numbers are assigned inside the create transaction (row lock on `sequence_counters`).
- Write actions are all-or-nothing (single transaction).
- Soft delete only: deactivate, never `DELETE` configuration or transaction records.

**API contract**
- Keep the existing `{ action, ...payload }` request and `{ success, data, message }` / `{ success: false, status: 'error', error }` response shapes used by `src/api/googleSheet.js`.

**Working rules**
- Before implementing an action, state its expected query count and which indexes it uses.
- After each phase, report: actions ported, measured p95 per action, query count per action, and anything that misses a target, with the reason and a fix.
- At each phase checkpoint, answer: "What breaks first at 10× the data, and what would you change?"
- Log per request: action, duration_ms, query_count, user_id, company_id, status.

### **🤖 CLAUDE CONVERSATION HISTORY BACKUP SYSTEM**

**Automated Backup System:** ✅ **ACTIVE** | AES-256-CBC | `.claude/conversation-backups/encrypted/`
**Backup Password**: stored in `.claude/conversation-backups/backup-password.txt` (gitignored — keep a copy in your password manager; never commit the value)

**Claude's Session Start Duty:** Run `./scripts/check-backup-health.sh`
- ✅ Healthy (<24h): Silent | ⚠️ Due (24-36h): Inform user | 🔴 Overdue (>36h): Run `./scripts/backup-conversations.sh`

**Docs:** `docs/backups/CLAUDE_BACKUP_SETUP.md`, `docs/backups/QUICK_REFERENCE_BACKUPS.md`, `docs/backups/Automated_Conversation_Backup_Strategy_20251108-190744.md`

### **🗓️ SESSION LOG**

**Authority document:** `REF_SessionLog.md` in the repo root — single source of truth for all session logging rules, the session log table, and the subproject map.

At the start of every Claude Code session, Claude must:
1. Read `REF_SessionLog.md` and log the current session in §2 of that file (Status: OPEN)
2. If the subproject is not clear from the first message, ask before logging
3. Mark CLOSED per the criteria in `REF_SessionLog.md §3`:
   - (a) Session dump written, (b) work formally wrapped, or (c) user asks "OK to close?" → Claude checks open items → confirms clear or flags open
4. Handoff exception: if user says they are closing this convo and continuing in a new one, carry forward as handoff — do NOT auto-close
5. On a new machine where the memory file is absent: write `feedback_session_log_workflow.md` at `%USERPROFILE%\.claude\projects\[project-folder]\memory\` per `REF_SessionLog.md §4`

**This section is enforced by:** SessionStart hook in `.claude/settings.local.json` (echoes a one-line reminder at session start; file is gitignored — recreate per machine) + memory file `feedback_session_log_workflow.md`

### **📊 SUPERTHINK AUDIT METHODOLOGY & LATEST RESULTS**

**🔍 SUPERTHINK AUDIT METHODOLOGY:**
Comprehensive systematic review process for React applications focusing on:
- **React Hooks Dependencies**: Validation of useEffect, useCallback, useMemo dependency arrays
- **Syntax Error Detection**: Complete compilation error identification and resolution
- **Component Dependencies**: Import/export relationship mapping and circular dependency prevention
- **Code Quality Standards**: ESLint compliance, type safety, and architectural consistency
- **Production Readiness**: Build verification, error handling, and performance optimization

**✅ LATEST AUDIT COMPLETION (September 21, 2025):**
- **45/45 Files Audited**: 100% coverage of entire React application codebase
- **24 Critical Icon Fixes**: All non-existent icon references resolved (Icons.Loading, Icons.CheckCircle, Icons.Document, Icons.Documents, Icons.History, Icons.List, Icons.Plus, etc.)
- **React Error #130 Resolution**: Zero runtime component reference errors
- **4 Compilation Errors Fixed**: Zero blocking build issues remain (useAPIData function, useUsers hook, useTicketTypes export, cache references, etc.)
- **Dependency Architecture**: Complete 7-layer hierarchy established and documented
- **Production Ready**: Application compiles successfully with only minor ESLint warnings

**🔧 REACT ERROR #130:** ✅ **RESOLVED** - See `docs/reference/REACT_ERROR_130_PREVENTION_GUIDE.md` for complete resolution details and prevention strategies.

**📋 QUALITY METRICS ACHIEVED:**
- **ESLint Compliance**: All critical warnings resolved, only minor style preferences remain
- **React Hooks Validation**: All dependency arrays validated and optimized
- **TypeScript-Style Documentation**: JSDoc types throughout codebase for IDE support
- **Mobile Responsive**: All components optimized for mobile devices with Tailwind CSS
- **Error Handling**: Comprehensive loading states and error boundaries implemented

**🔄 FUTURE AUDIT REQUIREMENTS:**
When conducting future superthink audits, follow the methodology documented in `docs/reference/SUPERTHINK_AUDIT.md` and update results in this section.

### **1.0 Overview**

This document outlines the functional requirements for a dynamic ticketing and workflow orchestration system. The primary goal is to create a highly configurable, multi-tenant platform where administrators can define entire business processes—including forms, multi-step approval chains, conditional logic, SLA tracking, and integrations with external tools—without requiring new code.

### **🔬 PROOF OF CONCEPT ARCHITECTURE** - **✅ BACKEND AUDIT COMPLETE**

**Current Implementation**: Google Sheets + Apps Script Database Backend
- **Purpose**: Serverless proof of concept demonstrating workflow orchestration capabilities
- **Database**: Google Sheets with 15+ tabs representing normalized database tables
- **API Layer**: Google Apps Script web app providing RESTful endpoints with JSON responses ✅ **AUDIT COMPLETE**
- **Frontend**: React SPA deployed to Vercel with Firebase Authentication
- **Data Tables**: companies, roles, tickets, ticket_types, users, workflow_steps, custom_fields, dropdown_lists, dropdown_options, ticket_history, ticket_action_logs, admin_action_logs, sequence_counters

### **📊 BACKEND AUDIT STATUS**

**✅ BACKEND AUDIT 100% COMPLETE** - See `docs/reference/SUPERTHINK_AUDIT.md` for detailed backend audit results, critical fixes applied, and production deployment status.

### **📋 API TESTING METHODOLOGY**

**See `docs/reference/PRODUCTION_REQUIREMENTS.md` for complete API testing procedures, troubleshooting guidelines, and health check protocols.**

**📋 Backend Audit Documentation**:
- **`APPSCRIPT_AUDIT.md`** - Complete function-by-function audit report with detailed findings
- **`APPSCRIPT_IMPLEMENTATION.md`** - Updated production deployment guide with audit results
- **`APPSCRIPT_API.md`** - Enhanced API documentation including all audit fixes and improvements
- **`APPSCRIPT.txt`** - Updated code with all critical issues resolved and runtime verification

**🛡️ Error Prevention Documentation**:
- **`docs/reference/REACT_ERROR_130_PREVENTION_GUIDE.md`** - Comprehensive guide to prevent React minified error #130
- **`docs/archive/2025-09/REACT_ERROR_130_SUPERTHINK_DUMP.md`** - Complete resolution methodology and debugging process

### **⚠️ PRODUCTION CONSIDERATIONS** (Post-Audit Update)
- **Scale Limitations**: Google Sheets not suitable for high-volume production use ✅ **AUDIT ACKNOWLEDGED**
- **Migration Path**: Future migration to traditional database (PostgreSQL, MySQL, etc.) planned
- **Current Status**: Fully functional proof of concept with production-ready frontend architecture ✅ **AUDIT VERIFIED**
- **Backend Reliability**: ✅ **AUDIT CERTIFIED** - Zero runtime errors, comprehensive error handling
- **Code Quality**: ✅ **PRODUCTION-READY** - Complete documentation, testing, and verification
- **Deployment Status**: ✅ **OPERATIONAL** - Live backend serving frontend admin components

**IMPLEMENTATION STATUS:** Phase 9.0 Complete - Page-based creation system with date range support

**✅ MODAL-TO-PAGE MIGRATION COMPLETE:**
- **AdminTicketTypeCreatePage**: Dedicated full-page creation with save-then-activate pattern
- **AdminCustomFieldCreatePage**: Enhanced field creation with date range support
- **AdminTicketTypeList**: Simplified list view with navigation to dedicated pages
- **Date Range Field Type**: New custom field type with start/end date validation
- **Route Configuration**: Dedicated URLs for creation workflows (/admin/ticket-types/create, /admin/custom-fields/create)
- **Form Components**: Extracted reusable components with auto-save functionality

**🎯 NEW FEATURES:**
- **Date Range Custom Fields**: Start/end date selection with validation and duration calculation
- **Enhanced Form Layouts**: Full-page forms with better spacing and organization
- **Breadcrumb Navigation**: Clear navigation paths for admin workflows
- **Auto-save Drafts**: Form state persistence for long creation sessions
- **Field Type Preview**: Real-time preview of custom field appearance
- **Error Prevention System**: Comprehensive React error #130 prevention with automated validation
- **Safe Navigation**: Route validation to prevent undefined navigation errors
- **Enhanced UX**: Quick start guides and improved button states for better user experience

**📋 SCHEMA UPDATES:**
- `custom_field_values` table: Added `start_date_value` and `end_date_value` columns for date range support

### **2.0 System Architecture**

The system is composed of two main parts: a frontend application for user interaction and a backend for data storage and logic.

#### **2.1 Frontend Architecture**

The user interface will be a single-page application (SPA) built with **React**. This provides a modern, responsive, and interactive user experience.

**⚠️ CURRENT IMPLEMENTED ARCHITECTURE:**

**📋 FOR COMPLETE FILE STRUCTURE AND DEPENDENCY MAPPING, SEE:**
- `docs/reference/DEVELOPMENT_PLAN.md` - Complete 45-file architecture with status
- `docs/reference/DEPENDENCY_MAPPING.md` - 7-layer dependency hierarchy and import rules
- `docs/reference/SUPERTHINK_AUDIT.md` - React hooks compliance and validation status

**🎯 ARCHITECTURE STATUS:**
- **✅ Phase 8.5 Complete**: All 45 files implemented and integrated
- **✅ Zero Compilation Errors**: Successful build verification
- **✅ Admin Panel Complete**: All management components integrated
- **✅ Real API Integration**: Google Apps Script backend connected  
    

    #### **2.2 Backend Architecture**

The backend will be serverless, leveraging Google Workspace tools for rapid development and cost-effectiveness.

* **Database:** A **Google Sheet** will serve as the database, with each sheet (tab) acting as a table. This allows for easy viewing and manual editing of data if necessary.  
* **API Layer:** A **Google Apps Script** project, deployed as a Web App, will function as the RESTful API. It will contain all the business logic to read from and write to the Google Sheet, enforcing rules like uniqueness and creating chained tickets.

  #### **2.2.1 Google Sheet Schema**

The Google Sheet will contain the following sheets (tables), with the first row of each serving as the header.

| Sheet Name | Columns | Description |
| ----- | ----- | ----- |
| **`companies` (Enhanced)** | `id`, `name`, `code`, `code_locked`, `code_locked_at`, `code_locked_reason`, `ticket_count` | Defines each company/tenant in the system. Code locking prevents changes after first ticket creation. |
| **`roles` (New)** | `id`, `name`, `company_id` | Defines available roles. `company_id` is NULL for global roles. |
| **`tickets`** | `id`, `ticket_number`, `title`, `ticket_type_id`, `requester_id`, `status`, `current_step_id`, `step_due_date`, `created_at`, `updated_at`, `company_id` | Tracks every ticket created. |
| **`ticket_history`** | `id`, `ticket_id`, `user_id`, `action`, `comment`, `timestamp` | Audit log of all actions on a ticket. |
| **`ticket_types`** | `id`, `transaction_id`, `code`, `name`, `description`, `is_active`, `require_attachment_on_create`, `company_id` | Defines each kind of ticket. `company_id` is NULL for global types. |
| **`comment_requirements`** | `ticket_type_id`, `require_on_approve`, `require_on_return`, `require_on_reject`, `require_on_cancel` | Rules for mandatory comments. |
| **`custom_fields`** | `id`, `ticket_type_id`, `name`, `label`, `type`, `is_required`, `is_hidden`, `sort_order`, `dropdown_list_id`, `depends_on_field_id` | Defines all possible custom fields. |
| **`custom_field_values`** | `id`, `ticket_id`, `custom_field_id`, `text_value`, `number_value`, `date_value`, `start_date_value`, `end_date_value`, `dropdown_option_id` | Stores the data for custom fields. Date range fields use start_date_value and end_date_value. |
| **`workflow_steps` (Enhanced)** | `id`, `ticket_type_id`, `company_id`, `name`, `status_on_reach`, `step_type`, `approver_logic`, `sort_order`, `next_ticket_type_id`, `external_app_url`, `completion_action_name` | Defines the approval/task steps. Each step is company-specific with explicit assignment required. |
| **`step_approvers`** | `step_id`, `role_id` | Links roles to workflow steps. |
| **`user_role_assignments`** | `user_id`, `ticket_type_id`, `role_id`, `validity_end_date`, `company_id` | Assigns roles to users for specific ticket types and companies. |
| **`step_slas`** | `step_id`, `duration`, `unit`, `exclude_weekends` | Defines the SLA for each step. |
| **`step_conditions`** | `id`, `step_id`, `custom_field_id`, `operator`, `value` | Rules for conditional workflows. |
| **`dropdown_lists`** | `id`, `name`, `description` | Defines reusable dropdown lists (company-neutral). |
| **`dropdown_options`** | `id`, `dropdown_list_id`, `label`, `value`, `parent_option_id` | Stores all options for dropdowns. |
| **`dropdown_company_assignments`** | `id`, `dropdown_list_id`, `company_id`, `is_global`, `is_active`, `created_at`, `created_by`, `updated_at`, `updated_by`, `deactivated_at`, `deactivated_by`, `deactivation_reason` | Manages company access to dropdown lists. `is_global=true` means available to all companies. |
| **`ticket_attachments`** | `id`, `ticket_id`, `uploader_id`, `file_name`, `file_url`, `uploaded_at` | Tracks uploaded files. |
| **`report_configurations`** | `id`, `ticket_type_id`, `field_name`, `display_name`, `field_type`, `sort_order` | Stores report configurations. |
| **`ticket_links`** | `id`, `parent_ticket_id`, `child_ticket_id` | Creates links for chained tickets. |
| **`sequence_counters`** | `sequence_name`, `last_number` | Tracks the last used number for ticket ID generation. |
| **`ticket_action_logs`** | `id`, `ticket_id`, `user_id`, `action_type`, `details`, `timestamp` | Detailed, system-level log of all changes to a ticket for auditing. |
| **`admin_action_logs`** | `id`, `admin_user_id`, `action_type`, `target_entity`, `target_id`, `details`, `timestamp` | Logs all configuration changes made in the Admin Panel and all user logins. |

### **3.0 Functional Requirements**

#### **3.0.1 Core Multi-Company Design Principles**

**🎯 EXPLICIT ASSIGNMENT PRINCIPLE**
The system operates on explicit assignment rather than defaults or fallbacks:

* **No Default Workflows:** Every company-ticket type combination requires explicit workflow assignment
* **Copy-Based Setup:** Companies configure by copying from existing setups rather than inheriting defaults
* **Independent Ownership:** Each company owns their workflow copy and can modify without affecting others

**🔄 WORKFLOW ASSIGNMENT ARCHITECTURE**
```
Ticket Type: "Purchase Request"
├── Company A: Manager → Finance (2 steps, 24h SLA)
├── Company B: Manager → Dept Head → Finance (3 steps, 48h SLA)
└── Company C: [Must explicitly choose to copy from A or B]
```

**📋 ADMIN CONFIGURATION FLOW**
1. **First Company Setup:** Company A creates workflows for ticket type
2. **Subsequent Companies:** Must choose to either:
   - Create workflows from scratch, OR
   - Copy existing workflows from Company A (or any other company)
3. **Customization:** After copying, companies can modify their workflows independently

**🔐 DATA INTEGRITY PRINCIPLES**
* **Company Code Locking:** Automatic after first ticket creation
* **Workflow Independence:** Changes to Company A workflows don't affect Company B
* **Explicit Validation:** System validates company-specific configurations separately

#### **3.1 User & Permissions Management**

* **Authentication:** User identity will be managed by Firebase Authentication for security and ease of use.  
* **Role-Based Access Control (RBAC):**  
  * **Company-Dependent Roles:** User roles will be assigned on a **per-company** and **per-ticket-type** basis. A user can be a 'manager' for "Purchase Requests" at Company A, but only a 'user' for the same ticket type at Company B.  
  * **Global Roles:** An admin can create a role that is not assigned to any specific company (`company_id` is NULL). When a user is assigned this global role, it applies to all existing and future companies.  
  * **Assignments:** Role assignments are stored in the `user_role_assignments` sheet, linking a user, role, ticket type, and company.  
  * **Validity Period:** Each role assignment can have an optional `validity_end_date`, after which the permission expires.  
  * **Admin Role:** A global "admin" role exists, granting access to the Admin Panel.

    #### **3.2 Ticket Number Generation**

* **Format:** A user-facing ticket number will be generated upon creation with the format: `COMPANYCODE-TYPECODE-YEAR-SEQUENCE`.  
  * `COMPANYCODE`: A short code from the `companies` sheet (e.g., "MYCO").  
  * `TYPECODE`: A short code from the `ticket_types` sheet (e.g., "PR").  
  * `YEAR`: The current 4-digit year based on Philippine Time (UTC+8).  
  * `SEQUENCE`: An 8-digit number, padded with leading zeros (e.g., `00000001`).  
* **Sequence Logic:**  
  * The sequence number will increment from the value stored in the `sequence_counters` sheet.  
  * The sequence will be unique per company and ticket type code (e.g., "MYCO-PR" is one sequence, "MYCO-LEAVE" is another).  
  * The sequence will only reset after reaching `99,999,999`.  
* **Backend Implementation:** The Google Apps Script will use `LockService` to ensure that even if two users create a ticket at the exact same time, they will receive unique, sequential numbers without any race conditions.

  #### **3.3 Admin Panel: Dynamic Configuration**

Administrators will have access to a dedicated UI to configure the entire system without writing code.

* **Company Management:** Full CRUD for companies, including setting their name and code.
  * **Company Code Locking:** Company codes are automatically locked after the first ticket is created to prevent breaking existing ticket numbers. Admin override capability available with audit logging.
  * **Data Integrity Protection:** Prevents changes to company codes that would invalidate the ticket numbering format (`COMPANYCODE-TYPECODE-YEAR-SEQUENCE`).
* **Role Management:** Full CRUD for roles, including defining them as global or company-specific.
* **Ticket Type Management:**
  * Full CRUD for ticket types. The "Transaction ID" is the unique business identifier for the ticket type.
  * Each ticket type will have a short **Code** for ticket numbering.
  * Configuration for requiring attachments on creation.
  * Configuration for requiring comments on actions (Approve, Return, Reject, Cancel).
  * **Duplicate Prevention:** Ticket type names must be unique within each company (case-insensitive). Prevents user confusion from similar names like "Purchase Request" vs "purchase request".
  * **Multi-Company Ticket Types:** Ticket types are designed to serve multiple companies with explicit workflow assignments per company.
  * **Copy-Based Configuration:** No default workflows - each company must explicitly assign workflows by either creating new ones or copying from existing company setups.
  * **Workflow Independence:** Each company owns their workflow copy and can customize independently without affecting other companies.  
* **Custom Field Builder:**  
  * Admins can add, hide, and reorder fields for any ticket type. Fields used in existing tickets can be hidden but not deleted.  
  * Supported field types: `text`, `paragraph`, `date`, `amount`, `dropdown`, `file`.  
  * Fields can be marked as required.  
* **Dropdown List Management:**
  * A dedicated UI to create and manage reusable lists of options for dropdown fields using a **two-step process**:
    * **Step 1**: Create dropdown list with name, description, and options (saved as draft)
    * **Step 2**: Assign company access - global (all companies), specific companies, or multiple companies
  * **Multi-Company Support**: Dropdowns can be assigned to:
    * **Global**: Available to all companies
    * **Single Company**: Available to one specific company only
    * **Multiple Companies**: Available to selected companies but not all
    * **Draft/Admin-Only**: No company assignments (visible only to admins)
  * **Company Assignment Management**: Admins can add/remove company access after creation
  * Supports **dependent dropdowns**, where the options of one dropdown are filtered based on the selection in a parent dropdown.  
* **Workflow Builder:**  
  * Admins can define a sequence of steps for any ticket type.  
  * **Step Naming:** Steps can be given custom names, with a default naming convention (e.g., "For Approval of Approver (1)").  
  * **Status per Step:** Each step defines the ticket's `status` while it is at that stage.  
  * **Multi-Approver Logic:** Steps can require approval from one (`any`) or all (`all`) assigned roles.  
  * **SLA Configuration:** Each step can have an SLA defined in `hours` or `days`, with an option to exclude weekends (weekdays only).  
  * **Conditional Logic (Stitching):** A step can have conditions based on ticket data (e.g., `itemValue >= 5000`). This allows for branching workflows.  
  * **Chained Workflows:** A step can be configured to automatically trigger the creation of one or more new tickets of different types upon completion, creating parallel chains.  
  * **External App Integration:** A step can be defined as a `task` that links to an external application. The workflow pauses until the user completes the external task and marks it as complete in the system.  
* **Report Configuration:**  
  * For each ticket type, admins can select which standard fields, custom fields, and computed values (e.g., SLA Status) appear in the status report.

    #### **3.4 Ticketing Lifecycle & User Experience**

* **Dashboard:**  
  * The main view will display all tickets.  
  * It will support a **hierarchical (chained) view**, where parent tickets can be expanded to show their child/parallel tickets.  
  * SLA status will be clearly visible (e.g., "Overdue", "Due Today").  
* **Ticket Actions:**  
  * **Cancellation:** Requesters can cancel a ticket if it has not yet been fully completed.  
  * **Return:** Approvers can return a ticket to the previous workflow step.  
  * **Rejection:** Approvers can reject a ticket, which is a final state unless reopened by an admin.  
  * **Reopening:** Admins can reopen a rejected ticket, returning it to the step from which it was rejected.  
* **Reporting:**  
  * A dedicated "Reports" section will allow users to generate and view reports based on the configurations set by the admin.  
  * Reports will include links to view ticket details and workflow history.  
  * Reports will have an option to be exported to CSV.

    #### **3.5 Audit Logging**

* **Ticket Action Logging:**  
  * Every state change on a ticket (creation, status change, field value update, step change) will be recorded in the `ticket_action_logs` sheet.  
  * The `details` column will store a JSON string representing the change (e.g., `{"field": "status", "from": "New", "to": "Pending Approval"}`).  
  * This provides a detailed, immutable record for compliance and debugging, separate from the user-facing `ticket_history`.  
* **Admin Action Logging:**  
  * Every successful user login will be recorded in the `admin_action_logs` sheet with an `action_type` of "USER\_LOGIN".  
  * Every action performed within the Admin Panel (e.g., creating a new ticket type, modifying a workflow, updating a role) will be recorded in the `admin_action_logs` sheet.  
  * The `target_entity` and `target_id` will identify the object that was changed (e.g., `ticket_type`, `tt_1`).  
  * The `details` column will store a JSON string of the changes made.  
  * This ensures full traceability of all administrative changes to the system's configuration.  
    

Notes:

**App.js Note:** Mock user data is placeholder for Firebase Authentication. Replace `setTimeout` block with `onAuthStateChanged` listener and API profile call when fully connected.



### **🚨 CRITICAL SCHEMA MIGRATION UPDATE** (September 24, 2025)

**RESOLVED**: Major schema consistency issue identified and resolved through comprehensive SUPERTHINK audit.

**Issue**: When audit fields were added to all database tables (dropdown_lists, companies, roles, etc.), only headers were updated while existing data remained in old format, causing severe column mapping issues where timestamps appeared in wrong fields.

**Solution**: Clean reset approach implemented in `APPSCRIPT.txt` v4.3
- `completeSystemReset()` - One-click solution (recommended)
- `cleanResetAllTables()` - Schema reset only
- `createFreshTestData()` - Fresh test data creation
- `diagnoseDropdownListsSheet()` - Schema debugging utility

**Status**:
- ✅ Root cause identified and solution implemented
- 🟡 Pending: Execute `completeSystemReset()` in deployed Google Apps Script
- 🟡 Pending: Verify dropdown creation works end-to-end

**File Location**: `./appscript_files/APPSCRIPT.txt` (Version 4.3)

---

## 🌟 UNIVERSAL ENTITY ARCHITECTURE

**Core Innovation**: Treating tickets, user profiles, and roles as the same type of configurable entities with dynamic custom fields.

### **Universal Entity Concept**
```
📊 TICKETS      → custom_fields (entity_category='ticket')      → custom_field_values
👤 USER PROFILES → custom_fields (entity_category='user_profile') → custom_field_values
🔐 ROLES        → custom_fields (entity_category='role')        → custom_field_values
⚡ WORKFLOWS    → custom_fields (entity_category='workflow_step') → custom_field_values (future)
```

**Reused:** Custom fields, AdminCustomFieldBuilder (entityCategory prop), API functions, dropdown system, validation
**NOT Universal:** SLAs, workflow engine, approval routing, status transitions (ticket-specific only)
**Benefits:** 90% code reuse, backward compatible, consistent UX across entity types

**Mandatory Reference**: `docs/reference/UNIVERSAL_ENTITY_ARCHITECTURE.md` - Required reading before any entity-related development work.

### **🔄 UPDATED SCHEMA: UNIVERSAL ENTITY TABLES (September 27, 2025)**

#### **Enhanced Existing Tables for Universal Entity Support**

**custom_fields (Enhanced)**
```
SCHEMA: id|ticket_type_id|entity_category|name|label|type|is_required|is_hidden|sort_order|dropdown_list_id|depends_on_field_id|is_active|created_at|created_by|updated_at|updated_by|deactivated_at|deactivated_by|deactivation_reason

KEY CHANGE: + entity_category (TEXT, default 'ticket')
VALUES: 'ticket', 'user_profile', 'role', 'workflow_step'
BACKWARD COMPATIBILITY: 100% - existing ticket custom fields unchanged
```

**custom_field_values (Enhanced)**
```
SCHEMA: id|ticket_id|entity_category|custom_field_id|text_value|number_value|date_value|start_date_value|end_date_value|dropdown_option_id|is_active|created_at|created_by|updated_at|updated_by|deleted_at|deleted_by|deletion_reason

KEY CHANGE: + entity_category (TEXT, default 'ticket')
PURPOSE: ticket_id becomes entity_id for non-ticket entities
BACKWARD COMPATIBILITY: 100% - existing ticket data unchanged
```

**user_role_assignments (Date-based Enhancement)**
```
SCHEMA: id|user_id|role_id|ticket_type_id|company_id|assignment_type|effective_start_date|effective_end_date|auto_expire_days|assigned_by_user_id|approval_required|assignment_notes|validity_end_date|is_active|created_at|created_by|updated_at|updated_by|deactivated_at|deactivated_by|deactivation_reason

KEY CHANGES:
+ assignment_type ('permanent', 'temporary', 'project_based', 'emergency', 'delegation')
+ effective_start_date/effective_end_date (temporal role management)
+ auto_expire_days (automatic expiration)
+ assigned_by_user_id (assignment tracking)
+ approval_required (assignment approval workflow)
+ assignment_notes (reason/documentation)
```

#### **New Tables for User/Role Management**

**user_profile_types**
```
SCHEMA: id|name|description|code|company_id|is_active|created_at|created_by|updated_at|updated_by|deactivated_at|deactivated_by|deactivation_reason

PURPOSE: Define configurable user profile types (Employee, Contractor, Vendor, Intern)
RELATIONSHIP: Links to custom_fields with entity_category='user_profile'
EXAMPLES: Standard Employee (EMP), Contractor (CTR), Vendor Contact (VND)
```

**role_types**
```
SCHEMA: id|name|description|code|company_id|is_active|created_at|created_by|updated_at|updated_by|deactivated_at|deactivated_by|deactivation_reason

PURPOSE: Define configurable role types with custom attributes
RELATIONSHIP: Links to custom_fields with entity_category='role'
EXAMPLES: Approval Roles (APR), Department Roles (DEP), System Roles (SYS)
```

**user_profiles**
```
SCHEMA: user_id|user_profile_type_id|display_name|email|immediate_approver_id|backup_approver_id|status|hire_date|is_active|created_at|updated_at|updated_by|deactivated_at|deactivated_by|deactivation_reason

PURPOSE: Individual user profile instances with approval relationships
KEY FEATURES:
- immediate_approver_id: Direct manager/supervisor
- backup_approver_id: Fallback approver when primary unavailable
- Integrates with Firebase Authentication via user_id
- Links to custom_field_values for additional configurable attributes
```

#### **Implementation Impact**
- Modified: 3 tables | New: 3 tables | 100% backward compatible
- Code/API/UI Reuse: 90%/85%/95% | Est. time: 35-45 days vs 60+ days separate
- **Next:** Execute `completeSystemReset()`, implement entityCategory API support, update frontend

### **🏷️ PHASE 11.0: TICKET TAGS & COLLABORATION SYSTEM**

**Status**: Design Complete, Implementation Pending
**Impact**: Enhanced ticket organization and cross-company collaboration capabilities

#### **🎯 Core Features:**
- **Ticket Tagging**: Hierarchical tags with smart autocomplete and usage analytics
- **Collaboration System**: Share tickets across users/companies with granular permissions
- **Advanced Search**: Multi-tag filtering with AND/OR/NOT operators and saved searches
- **Security Controls**: Permission levels, access revocation, audit trails, and expiration dates

#### **📊 Implementation Components:**
- **Database**: 8 new tables for tags and collaboration (see `docs/reference/DATABASE_SCHEMA_UPDATES.txt`)
- **Backend**: 25+ AppScript functions for tag/collaboration management (see `appscript_files/archive/versions/TICKET_TAGS_COLLABORATION_APPSCRIPT.txt`)
- **Frontend**: 4 new React components (TagInput, TagSearchFilter, TicketTagManager, TicketCollaborationManager)
- **Integration**: Designed for seamless integration with existing ticket workflow

#### **🔄 Current Status:**
- ✅ **Design Complete**: All specifications, schemas, and components designed
- 🔄 **Implementation Pending**: Backend integration and database table creation required
- **Next Steps**: See `docs/planning/SUPERTHINK_TODO_ANALYSIS_2025-09-27.md` for detailed implementation roadmap

**References**: Complete specifications in `docs/reference/DATABASE_SCHEMA_UPDATES.txt`, component designs in `/src/components/`, AppScript functions in `appscript_files/archive/versions/TICKET_TAGS_COLLABORATION_APPSCRIPT.txt`

---

MANDATORY NOTICES:
1. Ensure to check/recheck/fix any and all syntax errors in component created/edited.
2. Consider create mapping of all dependencies connection before creating/updating the components.
3. update dependecy documentation as each component is created/updated/read/updated/audited.
4. **ALWAYS READ FILES FIRST BEFORE UPDATING** - Use Read tool to understand current content and context before making any modifications to prevent overwriting important information.
5. **SCHEMA MIGRATION**: Execute `completeSystemReset()` in Google Apps Script before any dropdown testing.

### **🛡️ DROPDOWN CREATION LESSONS LEARNED**

**📋 COMPREHENSIVE SAFEGUARDS AND RESOLUTION METHODOLOGY**
**See `docs/reference/RESOLUTION_CHECKLIST.md` for complete:**
- 15 critical development safeguards based on dropdown creation analysis
- Fundamental Resolution Rule with domain-specific checks
- Pattern consistency requirements and working reference library
- Comprehensive 6-phase evolution analysis and lessons learned

