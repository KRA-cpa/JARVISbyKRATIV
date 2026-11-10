<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: REVIEW_UIErgonomics_20261110.md | Author: Kenneth R. Advento | Version: 1.6.0
Created: 10 November 2026 UTC+8 (Philippine Standard Time) | Modified: 10 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Ergonomics review of the whole UI (signed-in app, Admin, public site, requester page) against the user's priorities, with the fix for each finding in the "Daloy" (current) or "Daloy Flow" (proposed) design system | Status: Review - designs next, nothing built
REVISION HISTORY:
- v1.6.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Form builder with live preview in four styles (River Slip canvas); skins per plan proposed (awaiting the user's OK); Snooze = Enterprise (plan tiers v1.7.0)
- v1.5.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | New canvas "Daloy River Slip": Routing Slip format + Daloy Flow colours, trail and loader; four type options as a tweak; leave = title not asked
- v1.4.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User: titles can be required, but some requests just use the ticket type as the title - title rule per ticket type + list summary field; canvas board extended
- v1.3.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User: entry fields minimalist, not boxes; canvas board "Routing Slip - entering a request" added
- v1.2.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User's initial comments on the four systems recorded (Flow's FlowTrail + Loader liked; Routing Slip format for approving) - no pick yet
- v1.1.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Flow judged "very AI-coded" by the user; concept systems Routing Slip + Quiet Utility added ("create systems separately, effectively 4 choices"); comparison canvas
- v1.0.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 5f83b40e). User: "revisit the UI for more ergonomics, including the public sites", "all - to be consistent with the name Daloy or flow", review + designs first, design system from code + an alternative, priorities 3 density & readability, 1 fewer clicks for approvers, 4 accessibility; "is the logo while loading too dated?" -> "logo and app name, with flow water effect or what is more appropriate and modern"
===============================================================================
-->

# REVIEW — UI ergonomics (10 Nov 2026)

## Context
- **Scope:** every surface. Public: Home, How it works, Plans, Contact, Status, legal, Login. App: header, Dashboard, Tickets (list, detail, create), Reports, Profile. Admin. Requester page `/r/demo`.
- **Priorities (user):**
  1. density & readability;
  2. fewer clicks for approvers;
  3. accessibility.

  Phone use is not a priority this round, but nothing may break at phone width.
- **Basis:** the code on `main3@33f6cc8` (after the Dashboard A / compact filters fixes, test revision `daloy-00005-sos`). Colour figures are WCAG 2 contrast ratios.
- **Design systems (claude.ai, private to the user):**
  - **Daloy**, the current look taken from the code: https://claude.ai/artifact/Xw3b237LuP3LnFAHboXSeA. It keeps the failing colour pairs exactly as they are and flags them.
  - **Daloy Flow**, the proposed refresh: https://claude.ai/artifact/F6V9mJmLbuVyPcbufoiL6K. It uses Figtree, light + dark themes, and all 64 text / border pairs checked. It adds three components: a **Loader**, a **FlowTrail** and an **ApprovalBar**.
- **Update, same day (v1.1):** the user found Flow "very AI-coded". Two concept systems were added, so there are four to choose from:
  - **Daloy Routing Slip**: paper and ink, serif documents, ledgers, stamps, with approval on "your line" of a routing slip. https://claude.ai/artifact/7REYguSSsxgtMQYzXQMQu9
  - **Daloy Quiet Utility**: near-monochrome, keyboard-first, a dense table with an inspector, IBM Plex. https://claude.ai/artifact/HuKF5ENy8yVYiF1dgt1uqB

  The comparison canvas has both loaders and both approval screens: https://claude.ai/artifact/8W9GpoveCYuaVh3y3EsYYS. The fixes listed below still apply whichever system is picked.
- **Initial comments (user, v1.2, no pick yet):** "i like the flow trail of Daloy Flow, loader as well // router slip format seems sensible for easier approving -- initial comments only".
  - Kept from **Daloy Flow**: the **FlowTrail** (the ticket's path as done / current / next steps with who acts and when) and the **Loader** (the mark's stream flows continuously, logo + name).
  - Kept from **Routing Slip**: the approval format, where the decision ("Initial & approve", Return, Reject, comment) sits on the approver's own line of the slip.
  - Direction this points to, pending the rest of the comments: a Routing Slip layout carrying Flow's trail and loader. The trail and loader would be redrawn in that system's colours and type, so Flow's generic tells (rounded cards, pastel pills, Figtree) stay out.
- **Entering a request (user, v1.3):** "Fields in routing slip - minimalist, not boxes", meaning how a ticket is entered / created. The canvas board **"Routing Slip - entering a request"** shows it:
  - each field is a fill-in line on the sheet: a hairline underline, the label in small caps on the left, a 2px blue line on focus, and a red line plus a plain sentence on error;
  - the title is typed straight into the serif heading; dropdowns are a word with a caret; the reason box is lined paper;
  - optional fields say "optional" (no asterisks on required ones); the ticket number that will be given is shown up front;
  - on the right, the route the request will take (Flow's trail on the slip), including why a stop was added ("amount PHP 50,000 or more").
- **Title rule per ticket type (user, v1.4):** "titles can be required but some request will just have the ticket type as the title". Today the title is always required (`TicketForm.js:131`) and the server stores whatever the form sends (`createTicket`).
  - New setting on the ticket type: **Required** (the requester writes one) / **Optional** (blank becomes the type name, e.g. "Leave request") / **Not asked** (the field is hidden and the title is always the type name).
  - The **server** fills the title (compliance F1, the server owns business rules), so lists, emails, notifications and reports never show a blank title.
  - Companion setting **"Shown in lists after the title"** (one custom field, e.g. Dates), so a ledger of leave requests reads "Leave request · 14–15 Nov" rather than ten identical rows.
  - Build: two `ticket_types` columns (`title_mode`, `list_summary_field_id`), on the new server (Phase 4), since Apps Script is frozen. Existing types default to `required` (today's behaviour).
  - Shown on the canvas board "Routing Slip - entering a request", second half.
- **New canvas "Daloy River Slip" (user, v1.5):** "create this new canvas but retain the watery flowy rivery type colors and font faces maybe (as options) but some sans won't hurt". https://claude.ai/artifact/AXRqsRhVriJrqm2oCyETwc
  - The Routing Slip way of working (slip with your line, stamps, line fields, title rule) in **Daloy Flow's contrast-checked colours**: navy ink `#0f1b2d`, teal current `#0e7490`, shallows `#e3f5f9` for "your line", the mark blue `#2563eb` for the one action, stream `#93c5fd` for the trail line only, red `#b42318` for overdue / reject.
  - **Type as a tweak on every board:** River (Figtree + JetBrains Mono), Slip (Newsreader titles + Public Sans + IBM Plex Mono), Plain sans (Public Sans), Plex (IBM Plex Sans).
  - Boards: loader (Flow's continuous stream, light + dark) with colours and type; approving (list with a mini trail per row, request with the full FlowTrail on top, routing slip with the decision on your line); entering a request (line fields, route preview, leave request with the title not asked, Admin title rule).
  - User confirmed: leave requests need no title (title rule "Not asked").
- **Form builder with a live preview (user, v1.6):** "add form builder board to the Daloy flow, river, utility, routing slip". Four boards on the River Slip canvas, same content: the field list (order, required / optional / hidden, the title rule, the picked field open for editing, "used by a routing rule - can be hidden, not removed"), the requester's form updating live, "Try it" with sample values showing the route a rule produces. Today only one field at a time is previewed (`AdminCustomFieldCreatePage.js:635`). Build: the preview is the real requester form fed with the unsaved setup.
- **Skins per plan (user, v1.6, proposal - awaiting OK):** "can the boards be done as skins, one time pick in basic, basic+, customizable in advanced and enterprise; or is it too much?"
  - Feasible **if a skin is colours + fonts + field style only**, on one shared layout (River Slip's). Each skin is a block of CSS variables chosen by `data-skin` on `<html>`; the contrast script checks every skin in light and dark.
  - **Too much if a skin also changes layout** (Utility's three panes and key bar, Flow's cards and ApprovalBar, the slip): that is four UIs to build, test and fix forever.
  - Proposed skins: **River** (default), **Paper** (Routing Slip colours, serif titles), **Quiet** (monochrome, Plex), **Classic** (Flow's boxed fields). Field style (lines / boxes) is a token, not a layout.
  - Proposed tiers: Basic and Basic+ pick one skin at setup (a later change goes through the platform admin); Advanced switches skins any time and sets an accent colour + logo; Enterprise also sets its own palette and fonts from a list, refused by the server if any pair fails the contrast check, and can give each organization its own skin.
  - Not gated: dark mode and keyboard shortcuts stay per-user preferences on every plan (accessibility).
  - Build: skin tokens ship with slice 1 (the default skin); the per-company setting and its plan gate go on the new server (Phase 4).
- **Next:** canvas designs of each screen in the chosen system. The user picks per screen, and then the build.

## Findings
Ranked within each priority by impact. Each finding gives the place, the problem and the fix, with the Flow token or component it uses.

### Brand moment — the loader (user question)
**L1. The loading screen is a stock spinner, no logo.**
- Where: `src/components/shared/LoadingScreen.js`, used on every sign-in and route guard (`App.js:54/75/103/200`, `LoginPage.js:46`).
- Problem:
  - a Tailwind half-ring spinner and "Loading..." on `bg-gray-50`, while pages use gray-100, so the grey flashes;
  - no dark mode;
  - before React starts, `public/index.html` shows a blank white page for the whole 280 kB bundle.
- Fix: Flow **Loader**. The mark at 56 px plus "Daloy / by KRAtiv", with the mark's own stream flowing.
  - Motion: dash offset, 1.8 s, linear.
  - Fade-in: shown after 300 ms, so fast loads never see it.
  - Ground: the `page` colour in both themes.
  - Reduced motion: the stream is static.
  - Accessibility: `role="status"`.
  - The same markup goes inline in `index.html` as the splash.

  Variants for the canvas: B (liquid fill) and C (a line under the name). A is recommended because it is calm and on-brand, and it moves only the brand's own stream.

### Priority 3 — density & readability
**D1. Ticket rows are tall and read number-first.**
- Where: the Tickets list rows in `TicketDashboard.js` (`p-4`, cards with `space-y-4`).
- Problem: about 6 tickets fit on a laptop screen. The ticket number leads, but people scan by *what*.
- Fix: Flow **TicketRow**.
  - Height and density: 48 px (`row-h`), so 12 fit on a laptop screen.
  - Order: the title first, then number · type · requester · "step 2 of 3".
  - Pills: at most two.
  - Dividers instead of separate cards.

**D2. Text sizes jump; metadata is small and grey.**
- Problem:
  - 951 × `text-sm`, 314 × `text-xs` (12 px);
  - grey-500 metadata on the gray-100 page is 4.4:1;
  - headings mix `text-lg font-medium` with `text-2xl/3xl font-bold`.
- Fix: the Flow type scale.
  - `caption` 12.5 px / 500 as the floor.
  - `section-title` 15 / 600.
  - One `page-title` 22 per page.
  - Figtree, which stays open at small sizes.

**D3. SLA shown as dates, not time left.**
- Where: "Step due: 12 Nov 2026" in rows and the Dashboard.
- Fix:
  - SLA pills read "Due today 6 pm", "Overdue 2d" or "Due in 3d" (Flow **Pill**, `warning` / `danger` / `flow`);
  - the exact date goes in a tooltip.

**D4. Filters still take a full card and hide what is set.**
- Where: the compact toolbar of 10 Nov. "More filters (n)" counts the hidden filters but does not name them.
- Fix: Flow **FilterToolbar**.
  - Show becomes a segmented switch.
  - Filters become chips: unset ones are dashed with "+"; set ones are solid with their value and an ×.
  - Everything that is set stays visible.

**D5. The ticket opens as a centred modal over the list.**
- Where: `TicketDetail.js:25-26` (`fixed inset-0 … max-w-4xl max-h-[90vh]`).
- Problem: the list disappears, and you lose your place when you move to the next ticket.
- Fix:
  - a right-hand side panel (`shadow-3`), with the list still visible and selectable;
  - Up / Down move to the next ticket;
  - the **FlowTrail** at the top shows where the ticket is.

**D6. Seven tabs in the ticket detail.**
- Where: Details · Workflow · History · Links · Tags · Sharing · Actions (`TicketDetail.js:512`).
- Fix:
  - one scrolling panel: summary + FlowTrail, fields, then activity (history + comments);
  - Links, Tags and Sharing become a compact "More" section;
  - Actions merge into the ApprovalBar or the panel header.

**D7. Admin labels leak build jargon.**
- Where: the Admin overview cards say "Phase 8.5 - Available" (`AdminPage.js:321-324`).
- Problem: 13 top-level tabs plus sub-tabs in one horizontal bar.
- Fix:
  - grouped side navigation: Organisation (companies, users, roles), Requests (ticket types, fields, workflows, dropdowns), Time (SLA rules, escalations, calendars), Records (reports, audit log), System;
  - real counts instead of phase labels.

**D8. The Dashboard repeats the Tickets page below the fold.**
- Fix:
  - keep Dashboard A (StatCards, "Your turn" inbox, recent tickets);
  - in Flow, the inbox rows use TicketRow with quick Approve (see A1), so the dashboard is where approvers finish their work.

### Priority 1 — fewer clicks for approvers
**A1. Approving takes four steps and two modals.**
- Path today: Tickets list → open the ticket (a modal) → **Workflow** tab (the default is Details) → Approve → a confirmation modal with a comment → Approve (`WorkflowStep.js:415-463`).
- Fix:
  - **Quick Approve in the row** (Flow TicketRow, `sm` primary) when the step needs no comment: one click, then a toast naming the next step. There is no undo, because the server has no un-approve, and holding the request in the browser would be a fake save (F4);
  - otherwise the **ApprovalBar**, pinned at the bottom of the side panel: comment + Return / Reject / Approve in one row, with no tab and no second modal;
  - keyboard: `A` approves when no comment is needed, `J` / `K` move to the next / previous ticket.

**A2. Bulk approve is hidden behind row selection with no select-all.**
- Where: `TicketDashboard.js` bulk bar.
- Fix: in "Your turn" view, a header checkbox selects all, and a sticky bar offers "Approve n" / "Reject n" with one shared comment. This already works server-side; it's only the UI.

**A3. "Waiting for my approval" is called four different things.**
- The four names:
  - "For your approval" (dashboard card);
  - "Waiting for my approval" (Show pill);
  - "Your approval" (row badge);
  - "Pending Approval" (old card).
- Fix: one name, **"Your turn"**, in the card, the Show switch, the pill and the header badge.

**A4. Approvers aren't told when it's their turn while they're in the app.**
- Fix: a "Your turn · n" count badge on the Tickets nav item (from `getDashboard` `for_my_approval`, already loaded). The bell keeps SLA notices.

**A5. Return and Reject look alike, and Reject is a solid red primary.**
- Fix:
  - Reject becomes `danger-quiet` (outlined) until confirmed by its comment;
  - Return gets its own icon;
  - Approve is the only primary.

### Priority 4 — accessibility
**X1. Control borders are 1.5:1.**
- Where: `border-gray-300` on white, on every input, select and secondary button.
- Problem: empty fields are hard to see.
- Fix: Flow `border-control`, 3.5:1 light / 4.1:1 dark.

**X2. Status pill text fails 4.5:1.**
- Problem: green-600 is 3.3:1 and yellow-600 is 3.0:1 on their 50-tints; red-600 on white is 4.4:1.
- Fix:
  - Flow `success` / `warning` / `danger` / `approval` (all ≥ 5:1 on their `-soft` grounds);
  - every pill carries an icon + a word;
  - success is teal-green, away from red in hue.

**X3. Dark mode in about 200 places only.**
- Problem: most components, the Login page and the loading screen stay light, and many cards stay white in dark mode.
- Fix: Flow is a full dark theme on tokens. Components use tokens, never raw `bg-white` / `text-gray-*`.

**X4. Focus rings are inconsistent.**
- Problem: some buttons have `focus:ring-2`, many have none, and inputs use `focus:border-transparent` (the border disappears on focus).
- Fix: one global `:focus-visible` 2 px `focus-ring` outline (3:1+ on every ground).

**X5. Icon-only buttons and the tag chip × have no labels; tag text sits on any admin-chosen colour.**
- Where: `TagSearchFilter.js`, rows.
- Problem: white text on light tag colours fails.
- Fix:
  - `aria-label` on every icon button;
  - Flow **TagChip**: neutral text with a colour swatch.

**X6. Emoji carry meaning in the SLA select (🔴 / 🟡 / 🟢).**
- Fix: words only in the select; colour + icon appear in the pills.

**X7. Modals don't trap focus or restore it.**
- Where: ticket detail, confirmation.
- Fix: the side panel moves focus to its heading, Esc closes it, and focus returns to the row.

### Public site
**P1. Home leads with the name, not the promise.**
- Where: `HomePage.js:44-47`. The h1 is "Daloy"; the tagline is the second line.
- Problems:
  - "Our full website is on its way." undercuts it;
  - "See plans" uses a shield icon.
- Fix:
  - h1 = "Less chasing, more flow." (`display`);
  - `lead` = what it does;
  - the name and meaning go in the header and wordmark;
  - one primary call to action ("See plans") and a secondary "Sign in";
  - drop the "on its way" line;
  - add the FlowTrail as a static product glimpse beside the hero.

**P2. Login is a different visual world.**
- Where: `LoginPage.js:50-57`: `bg-gray-50`, `text-3xl font-extrabold`, no dark mode.
- Fix: the Flow page ground, the Loader's wordmark above the sign-in card, `page-title`, and both themes.

**P3. "Plans" sits in the signed-in nav with a shield icon.**
- Where: `Header.js:23`.
- Problem: daily users don't need it.
- Fix: move it to the profile menu and the footer for signed-in users; keep it in the public nav.

**P4. The legal and status pages are long single columns at `text-sm`.**
- Fix: `body` 15 / 24 at a 70-character measure, with a sticky contents list from 1024 px up.

### Requester page (`/r/`)
**R1. Requesters can't see where their request is.**
- Where: `RequesterDemoPage.js`. "My requests" shows only a status word.
- Fix: a FlowTrail per request: Submitted → Manager → Finance (current, "due today"), so the requester can see that "Finance has it" without asking.

## Consistency (both systems)
- Sentence case everywhere ("New ticket", not "Create New Ticket"; "Clear", not "Clear All / Clear Filters").
- One name per concept ("Your turn", "My requests", "Overdue").
- No gradients or `hover:scale-105` (the Tickets "Create New Ticket" button).
- Dates in the company zone via `formatDateOnly`; times relative where urgent.

## Next
1. Claude Design canvas boards, the current system next to Flow, for:
   - Loader (A / B / C);
   - Login;
   - Home;
   - Dashboard;
   - Tickets list;
   - Ticket panel + ApprovalBar;
   - Create ticket;
   - Reports;
   - Admin;
   - the requester page.
2. The user picks per board.
3. A build plan for the approved boards: tokens into `tailwind.config.js` + CSS variables, then the Loader and splash, then screen by screen, with a preview link before any push.
