<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: HANDOFF_UIFixes_ProdMove_20261109.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 9 November 2026 UTC+8 (Philippine Standard Time) | Modified: 9 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Plan for the next session - UI fixes from the Cloud Run test-site review (Dashboard A, compact Tickets filters, Reports dates, footer on short pages), then production on daloy.blueknight.xyz (unified plan H.3 / H.4), then Phase 0 | Status: Handoff (nothing built yet)
REVISION HISTORY:
- v1.0.0 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created at the handoff of session 61523343 (user: "write as plan for next session", "as md file")
===============================================================================
-->

# HANDOFF — UI fixes, then production on daloy.blueknight.xyz (9 Nov 2026)

## Context
Session 61523343 moved the app's hosting to a new Google project and got the test version working:
- **H.1:** new project `krativ-daloy` on Blaze, $10 budget, secrets, `AUTH_MODE=enforce`.
- **H.2:** test revision `daloy-00004-pen` at `https://first---daloy-xmczwkduaa-as.a.run.app`. Sign-in is verified, tickets load, and there are no 5xx errors.
- **Fixes from the user's test-site review (already built, commit `a9f0f4f`):**
  - the Git Bash path bug in `deploy-cloudrun.sh` v1.2;
  - the header no longer wraps, and its clock was removed;
  - `/status` names only the build's own host;
  - the Claude credit was removed from the footer;
  - the Admin "Backend Integration Status" panel is flagged as unified step 3.6.
- **Git state:** main3 is **10 commits ahead of origin, not pushed**.
- **The roadmap** is `docs/planning/PLAN_Migration_Unified_20261108.md`; this doc covers its Phase H finish.

While testing, the user found the **dashboard too crowded**, the **Tickets filters too big** and the **Reports date
fields too narrow**. Another Claude Code session proposed a dashboard clean-up (A). Session 61523343 checked it
against the code and agrees, with the corrections in §1.

**Why the dashboard is crowded (checked in the code):**
- Three generations of SLA widgets are stacked; overdue = 9 is shown 4 times.
- `SLASummaryWidgets` (`src/components/shared/SLAWidgets.js`) and `SLANotificationSystem` were mounted on 19 Oct only to clear the contract check (rule A12).
- Their hooks `useSLAOverdueTickets` / `useSLADueTodayTickets` (`src/hooks/useAPI.js:813`, `:844`) read every open ticket and work out the SLA in the browser. That breaks F1 (the server owns business rules).
- The page's own stats use `useTickets()`, i.e. `API.Tickets.getAll` (`src/api/googleSheet.js:876`). That reads up to **10 pages × 100** tickets on every load (F5 call budget), and the counts are wrong beyond 1,000 tickets.
- The server already returns the counts: `getDashboard` (AppScript v10.2 file) gives `counts { total, open, mine, overdue, due_today, closed, for_my_approval }` plus `approval_inbox`.

## Order
0. **Session start:**
   - run `scripts/check-backup-health.sh`;
   - log the new session in `REF_SessionLog.md` §2 (61523343 is handed off, not closed);
   - `git status` must be clean at this doc's commit or later.
   - **Only one session edits the repo.** Coordinate with any other Claude Code session; it must not touch `Header.js`, `Footer.js`, `LiveClock.js`, `site.js`, `AdminPage.js` or the deploy script in parallel.
1. **UI fixes** (Claude):
   - Dashboard A (§1), Tickets page compact filters (§1b), Reports date fields (§1c), footer at the bottom on short pages (§1d);
   - one `CI=true` build, then one test deploy (`first` tag);
   - the user checks the three pages, then a local commit.
2. **H.3: production** (§2): Claude deploys after the user's "go"; the user does the domain and DNS steps.
3. **H.4: Vercel previews only** (§3): Claude adds the redirect; the user says "push" and changes one Vercel setting.
4. **Then Phase 0 (user):**
   - 0.1 confirm the stack;
   - 0.2 verify the 2 Cloud Run prices;
   - 0.3 DPA / IT clearance;
   - 0.4 create a Neon Free project in Singapore and an AWS SES account.

   After that, Claude does 0.5 onward (unified plan).

## 1. Dashboard A (`src/pages/DashboardPage.js`)
Decisions (recommended; assumed unless the user changes them):
- **A**, not the minimal B.
- **Completed** card dropped.
- **Clock kept**, in a slim welcome strip. The header has no clock since `a9f0f4f`, so this becomes the only one.
- The dashboard **Filters** block is removed; the Tickets page has the filters, search and paging.

New layout, all from **one `getDashboard` call** plus one small ticket page:
1. **Slim strip:** "Welcome back, <name>" · role / companies, with `DetailedClock` on the right. It replaces the big card at `DashboardPage.js:185–209`.
2. **One row of cards from `dashboard.counts`.** Each links to the Tickets page (`TicketDashboard.js:55` already reads `?sla=` and `?show=`):
   - **For your approval:** `for_my_approval`, links to `/tickets?show=approval`, highlighted when above 0.
   - **Overdue:** `overdue`, links to `/tickets?sla=overdue`, red when above 0.
   - **Due today:** `due_today`, links to `/tickets?sla=due_today`.
   - **Open:** `open`, links to `/tickets`. *Correction:* there is no "pending approval" count, and Apps Script is frozen, so no new server fields.
   - **My requests:** `mine`, links to `/tickets?show=mine`. *Correction:* the server's `mine` counts tickets you requested, so the old label "Assigned to or created by you" was wrong.
   - The `DEV_CONFIG.DASHBOARD_CARDS` flags (`src/config/development.js:36`) still apply. `SHOW_PENDING_APPROVAL` → Open; `SHOW_COMPLETED` is dropped.
3. **"Waiting for your approval":** the top 5 of `dashboard.approval_inbox`, each with an Open button. No extra call (*correction*).
4. **Recent tickets:** `useTicketList({}, 10)` (`src/hooks/useAPI.js:353`), one page of 10, plus "See all in Tickets". It replaces `useTickets()` / `getAll`. The existing `renderTicketRow` is reused.
5. **Notice strip:** "N SLA notices – view", shown only when there are unread notices. It reuses `useNotifications` (already loaded by the header bell, so no new call).
6. **Removed:**
   - the SLA Overview row and SLA Monitoring;
   - the client-side `stats` block (`DashboardPage.js:49–60`);
   - the Filters block and its state.
7. **Deleted, since nothing else uses them (checked with grep on 9 Nov):**
   - `src/components/shared/SLAWidgets.js`;
   - `src/components/shared/SLANotificationSystem.js`;
   - `useSLAOverdueTickets` / `useSLADueTodayTickets` and their export lines (`useAPI.js:1245–1246`).

   Then update `docs/reference/DEPENDENCY_MAPPING.md` / `docs/reference/DEVELOPMENT_PLAN.md`; the file inventory shrinks.
8. **Result:** about 2 calls on load (`getDashboard` plus one 10-ticket page; the bell is already loaded), and every SLA number comes from the server.

## 1b. Tickets page: compact filters
*User, 9 Nov 2026: "check /tickets as well - filter by tags label, search box and advance toggle takes up too much space".*

**Today:** `src/components/tickets/TicketDashboard.js:539–786` stacks five blocks above the list:
1. the title + Create button;
2. the "Show" pills;
3. a full **"Filter by Tags" card** (`src/components/shared/TagSearchFilter.js:195–414`): a title row with Save Search / Clear All / **Advanced**, its own search box, chosen tags, an "Active Filter" box and Saved Searches;
4. a **Search & Filters card**, two rows: a labelled search, Company / Status / Priority, then Date / SLA / Clear All;
5. a **Sort card**.

There are two search boxes and two "Clear All" buttons. **Bug:** the page's Clear All does not clear the tag filter (`clearFilters` at `:260` never touches `tagFilter`).

**Change: one toolbar, the rest folded away.**
1. **Show pills:** unchanged (small; the dashboard cards link into them).
2. **One toolbar row** (a single card):
   - `[🔍 Search tickets…  (flex-1, no label; placeholder only)]`
   - `[Status ▾]`
   - `[SLA ▾]`
   - `[⚙ More filters (n)]`: a toggle showing how many hidden filters are set.
   - `[Clear]`: only when any filter is set; it also clears the tags (remount `TagSearchFilter` with a `key` reset).
3. **"More filters" panel**, collapsed by default and opened automatically when one of its filters is set (e.g. from a URL). One row of Company / Priority / Date range, plus the **tag filter in a new `compact` mode**:
   - no card, title row or "Advanced" toggle;
   - an inline `Tags…` input with the chosen tags as chips beside it;
   - ANY / ALL shows only with 2 or more tags;
   - each suggestion has a small **Exclude** button (the Advanced toggle is dropped);
   - the "Active Filter" box is dropped (the chips say it);
   - saved searches become a small `Saved ▾` dropdown, shown only when some exist.

   The non-compact mode stays as it is; `TicketDashboard` is its only user (checked with grep).
4. **Sort card → one slim line** above the list, not a card: `23 tickets · Sort [Created ▾] [↓] · [20 per page ▾]`.
5. **Result:** from about 5 blocks above the list to 2 (pills + toolbar), with nothing lost. Every filter, tag exclusion and saved search is still there, one click away.

## 1c. Reports: date fields too narrow
*User, 9 Nov 2026: "Reports - date picker doesnt show full mm/dd/yyyy date".*

**Cause:** `src/components/tickets/TicketReport.js:102` lays the criteria out in a **5-column** grid from lg up:
- Ticket type, Company, Status, the date pair and Run each get one column;
- the From / To dates **share one column** (`:137` `grid grid-cols-2 lg:col-span-1`);
- so each date box is only about 110 px wide, too narrow for `mm/dd/yyyy` plus the calendar icon (about 140 px).

**Fix:**
- change the grid to `lg:grid-cols-6` and give the date pair `lg:col-span-2`, so each date gets about 190 px;
- add `min-w-[9.5rem]` on both date inputs, so they can never shrink below a full date;
- at `sm`, the pair takes a full row (`sm:col-span-2`).

## 1d. Footer sits mid-screen on short pages
*User, 9 Nov 2026: "footer for Reports - too high as well, what happened".*

**Cause:** the signed-in pages wrap their content in `min-h-screen` but not in a flex column. The footer therefore follows the content directly. On a short page (Reports before a report runs, an empty list) it floats mid-screen with grey space below it.

The public pages already pin the footer to the bottom (`min-h-screen flex flex-col` + a `flex-1` main) since the website work of 1 Nov:
- `HomePage`, `HowItWorksPage`, `ContactPage`, `StatusPage`, `TermsPage`, `LegalPage`.

The signed-in pages never got that layout:
- `src/pages/AdminPage.js`, `DashboardPage.js`, `PlansPage.js`, `ProfilePage.js`, `ReportsPage.js`, `TicketsPage.js`.

So this is not a regression from the 9 Nov changes; it only shows most on short pages.

**Fix (the same pattern as the public pages):** on each of those six pages:
- the outer wrapper becomes `min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900`;
- the content wrapper gets `flex-1 w-full`;
- `ProfilePage` uses `bg-gray-50` today; align it to the others.

**Verification:**
- on Reports before a report runs, and on Tickets with no results, the footer sits at the bottom of the window;
- on long pages, it still comes after the content.

## 2. H.3: production (`docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md` §C)
1. **Claude, after the user's "go":**
   ```
   AUTH_MODE=enforce scripts/deploy-cloudrun.sh production
   ```
   - It runs in the background; don't edit the script while it runs.
   - It needs `gcloud` on the PATH. If Claude Code started before the install, use the full path, or prefix `PATH="/c/Users/clark/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin:$PATH"` with `CLOUDSDK_CORE_DISABLE_PROMPTS=1`.
   - All traffic moves to the new revision, and Firebase Hosting goes live at `https://krativ-daloy.web.app`.
2. **User:**
   - Firebase project **`krativ-daloy`** → Hosting → **Add custom domain** `daloy.blueknight.xyz`. Add the records it shows at blueknight.xyz's DNS host; **leave the MX / forwarding records alone**. Wait for the certificate.
   - Firebase project **`jarvisbyerp`** (sign-in) → Authorized domains → add `daloy.blueknight.xyz` and `krativ-daloy.web.app`.
   - Apps Script → Script Properties → `APP_URL = https://daloy.blueknight.xyz`.
3. **Both:** on `daloy.blueknight.xyz`, check sign-in, the dashboard, one write on seed data, `/plans` and `/status`. Then:
   - `curl -sI ".../api/appscript-proxy?action=ping"` should show `x-backend: gas` and `cache-control: no-store`;
   - the logs should show `verified` and no 5xx.

## 3. H.4: Vercel previews only (GUIDE §D)
1. **Claude:** add a `vercel.json` host-scoped redirect, from `jarvis-by-erp.vercel.app/<page>` to `daloy.blueknight.xyz/<page>`, keeping `/api/*`. Commit locally.
2. **User:** says **"push"**. That's one last Vercel production build, and it carries all the local commits. Before the push, Claude runs:
   - `npm run build:ci`;
   - `npm run check:api-contract` and `npm run check:code-rules`;
   - the offline suites.
3. **Then:** check that `jarvis-by-erp.vercel.app/plans` lands on the new domain. The user sets **Vercel → Settings → Git → Production Branch** to `vercel-production-retired`.
4. **Claude:**
   - update `Claude.md` working rule 3 ("one Vercel check" → the Cloud Run deploy + a `daloy.blueknight.xyz` check);
   - update the memory `feedback_batch_then_deploy_check`;
   - tick Phase H in the unified plan.

## Files the next session will touch
- **Dashboard:** `src/pages/DashboardPage.js`; delete `src/components/shared/SLAWidgets.js` and `src/components/shared/SLANotificationSystem.js`; edit `src/hooks/useAPI.js`.
- **Tickets page:** `src/components/tickets/TicketDashboard.js` and `src/components/shared/TagSearchFilter.js` (new `compact` prop).
- **Reports:** `src/components/tickets/TicketReport.js`.
- **Footer layout:** the six signed-in pages in `src/pages/` (§1d).
- **Reference docs:** `docs/reference/DEPENDENCY_MAPPING.md` and `docs/reference/DEVELOPMENT_PLAN.md`.
- **H.4:** `vercel.json` (new), `Claude.md` and the memory file.
- **Logs and plans:** the `docs/planning/PLAN_Migration_Unified_20261108.md` progress notes and `REF_SessionLog.md`.

## Verification
- **UI fixes:**
  - `CI=true` build (warnings fail);
  - `npm run check:api-contract`: the contract still matches, and the known-gaps list may only shrink;
  - `npm run check:code-rules`;
  - test deploy to `first---daloy-xmczwkduaa-as.a.run.app`.
  - Then the user checks:
    - the **dashboard** fits one laptop screen above the lists, each card's number matches the Tickets page it links to, and the logs show about 2 API calls per load;
    - on **Tickets**, each filter still narrows the list, Clear also clears tags, the dashboard's `?sla=` / `?show=` links still apply, and tag AND / OR / exclude still go through `API.Tags.search`;
    - on **Reports**, at 1024 px, at 1280 px and on a phone, both dates show the full `mm/dd/yyyy` with the picker icon.
- **H.3:** the new domain works end to end (sign-in, data, one seed write), with `verified` logs and no 5xx.
- **H.4:** the old address redirects (and `/api` still answers there for open tabs), and pushes build previews only.
- **Rollback (GUIDE §E):**
  - for a bad revision: `gcloud run services update-traffic daloy --region asia-southeast1 --to-revisions <prev>=100`;
  - for the whole move: set the Vercel Production Branch back to `main3` and remove `vercel.json`.
