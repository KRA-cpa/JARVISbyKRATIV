<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: DECISIONS_UIRefresh_20261110.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 10 November 2026 UTC+8 (Philippine Standard Time) | Modified: 10 November 2026 UTC+8 (Philippine Standard Time)
Purpose: How design decisions are taken with the user (default-or-veto statements), what is already decided, the draft statement bank for the UI refresh, and the answer log - replayable if a re-design is requested | Status: Draft bank - superthink + first batch happen in the design decision session (NOT the next session, which is migration)
REVISION HISTORY:
- v1.0.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 5f83b40e). User: "as a possible indecisive adhder, looks like i need to be prompted questions that will help you decide how to go forward with the design. record this process if we need to go back to the design decisions - if a re-design is again requested"; "dont confront me picking from the 4"; "superthink will be 1st step in design decision session"; "next session will be migration"
===============================================================================
-->

# DECISIONS — UI refresh (how we decide, what's decided, what's open)

**State on 10 Nov 2026:** no statement in §3 has an answer yet. One attempt (a 4-option pop-up of Round 1) was shown and **not answered** (§4). Every §3 item is open; its default is a default, not a choice. **No UI build starts until batch 1 is answered.**

## §0 The design decision session (order)
1. **Superthink first** (user: "superthink will be 1st step in design decision session"), grounded, not a broad audit (Claude.md working rule 6). Its output replaces the §3 draft and goes in §6:
   - **Coverage:** every review finding (`docs/design/REVIEW_UIErgonomics_20261110.md`: L1, D1–D8, A1–A5, X1–X7, P1–P4, R1) and every open point of `docs/design/DESIGN_SnoozePauseSLA_20261110.md` (O1–O6, the "to confirm" items) maps to a statement, or is marked "no decision needed" with the reason.
   - **Reco check:** each default against `docs/planning/REVIEW_AppScriptReco_20261030.md` and `docs/guides/GUIDE_CodeReview_Compliance.md`:
     - F1: the server owns rules (title rule, snooze cap, pause conflict);
     - F4: no fake saves (no undo on approve);
     - F5: call budget per screen (list trail, route preview);
     - Claude.md §9 targets: paging ≤ 50 and p95 for the list and the route preview;
     - A21: visibility through `canViewTicket` (pause roles viewing).
     A default that breaks one is changed or flagged in its statement.
   - **Order by dependency:** base style → font → fields → skins → approving → screens → plans → build order.
   - **Wording check:**
     - one idea per statement, about 15 words or fewer;
     - the default said plainly, with a scenario where it helps;
     - what "no" leads to, in a few words;
     - no file names or jargon in the statement (the side column holds references).
   - **Cost tag** on each statement: *frontend only* / *new server* / *Apps Script frozen*, so a "no" shows its cost.
2. **Batches** by the §1 method, starting with batch 1, when the user says to start.
3. **Log every answer** in §4, then update the review doc, the plans and the canvases.

## §1 How to ask (the method)
User, 10 Nov: "dont confront me picking from the 4. duh."

- **Default-or-veto statements.** Each item is what Claude will do, numbered, plain text: "3. Fields are lines, not boxes."
  - The user answers with the number plus `ok` / `no` / `skip`, or a few words. This is how the user already answers well ("1 - ok, 2 - role based…, others noted muna").
  - Nothing to pick.
  - `skip` or no answer keeps the default, logged as *default, not confirmed*.
  - `no`: Claude brings back **one** alternative next time, also as a statement.
- **Small batches:** 5–8 statements per message, the most important first. The user can stop at any point. What's left waits.
- **No pick lists, no pop-ups.** No 4-option questions and no question dialogs.
- **When there is no sensible default:** a this-or-that pair (2, never more), side by side on the canvas, asked as "which one would you NOT want?". Rejecting is easier than choosing.
- **Reactions count:** comments left on the canvases ("like", "no", a few words) are answers. Claude reads them into §4.
- **Scenario wording** where it helps: "Finance at 5 pm with 3 tickets: approve on your slip line, one click", not "decision placement".
- **Prepared first, asked only on the user's word.** Claude writes the statements here and presents them when the user says to start. Never unprompted (see §4, the 10 Nov attempt).

## §2 Already decided (before this method)
| Date | Decision | User's words |
|---|---|---|
| 10 Nov | Daloy Flow as a whole looks AI-made; not the base | "looks very AI-coded" |
| 10 Nov | Keep from Flow: the FlowTrail and the Loader; from Routing Slip: the approval format | "i like the flow trail of Daloy Flow, loader as well // router slip format seems sensible for easier approving" |
| 10 Nov | Entry fields minimalist, no boxes (Routing Slip) | "Fields in routing slip - minimalist, not boxes … meaning how ticket will be entered/created" |
| 10 Nov | Title rule per ticket type: Required / Optional / Not asked; leave requests = not asked | "titles can be required but some request will just have the ticket type as the title"; "leave requests need not title" |
| 10 Nov | River Slip canvas: slip way of working + Flow's water colours; fonts as options, sans welcome | "retain the watery flowy rivery type colors and font faces maybe (as options) but some sans won't hurt" |
| 10 Nov | Admin form builder gets a live preview; boards in all four styles | "preview of ticket form builder while being built?"; "add form builder board to the Daloy flow, river, utility, routing slip" |
| 10 Nov | Snooze: Enterprise only; the SLA keeps running; ends no later than the deadline; not offered once overdue (counted time) | `DESIGN_SnoozePauseSLA_20261110.md` D1–D3, D7 |
| 10 Nov | Pause SLA: per step; not on head-level approvals; kept apart from Snooze; who pauses = pause roles per ticket type; no pausing your own step (conflict of interest); "Can pause" list; pause roles can view the tickets | same doc D4–D6, D8–D12 |
| 10 Nov | Skins: proposed only (colours + fonts, one layout; per plan) - **not decided** | "can the boards be done as skins …; or is it too much?" |

## §3 Statement bank - DRAFT (superthink rewrites it first)
Defaults as of 10 Nov. The superthink (§0.1) checks, reorders and tags them before batch 1.

**Batch 1 - the base**
1. The app is built in River Slip: the slip layout with Flow's water colours.
2. Font: Figtree everywhere. *(If no: a "which would you NOT want" pair - Figtree vs serif titles.)*
3. Fields are lines, not boxes. *(Already the user's direction; confirm for all forms, Admin too.)*
4. Skins change colours and fonts only; one layout for everyone.
5. You approve on your own line of the routing slip: one click, remarks optional unless required.
6. The button says "Approve", not "Initial & approve".
7. Each row in the list shows a small trail of where the ticket is.
8. The loader is the logo's stream flowing, with "Daloy" under it.

**Batch 2 - screens**
9. A ticket opens beside the list, not as a pop-up over it.
10. The open ticket is one scrolling page, not seven tabs.
11. Stamps (Received, Approved, Returned) show on the slip.
12. Status is a word, not a coloured pill.
13. Due times read "due today 6 pm" or "overdue 2 days"; the date is on hover.
14. Filters you set always stay visible as chips.
15. Dark mode comes with the first build.
16. Admin gets a grouped side menu instead of 13 tabs.

**Batch 3 - approvers and lists**
17. "Your turn" is the one name for things waiting on you.
18. A "Your turn · 3" count sits on the Requests menu.
19. Select-all + "Approve 3" in Your turn, one shared remark.
20. Reject is quiet (outlined) until you write why; Approve is the only solid button.
21. Keyboard shortcuts (J/K move, A approve) for everyone, as a personal setting.
22. Lists are comfortable by default (2 lines per row); compact is a personal setting.

**Batch 4 - plans and skins**
23. Skins: Basic / Basic+ pick once at setup; Advanced switches any time + accent + logo; Enterprise sets its own palette (contrast-checked).
24. Dark mode and shortcuts are never plan-gated.
25. Pause SLA is on Advanced and Enterprise.
26. No admin override of the no-pausing-your-own-step rule.
27. Restricted tickets stay hidden from pause roles unless they're in the chain.
28. At the expected resume date: a reminder, not an automatic resume.
29. "Department head" = a head-level mark on roles; those steps can't be paused.
30. Snooze on a step without an SLA lasts at most 5 working days.

**Batch 5 - build order and the rest**
31. Build in slices, each with a preview link before any push.
32. Colours, fonts, loader and splash go first (frontend only).
33. The UI slices start after the migration's production move (H.3), not before.
34. Previews run on a Cloud Run test revision.
35. The public site (Home, Login, Plans) gets the same style in the same release.
36. The requester page shows a trail per request.
37. The form builder with live preview is its own slice, after approving.

## §4 Answer log
| Date | Session | Item | Answer | Note |
|---|---|---|---|---|
| 10 Nov 2026 | 5f83b40e | Round 1 of an earlier 4-option pop-up format (base style, font, fields, skins) | **not answered** | User: "not now"; "note no answer has been given". Process note - user: "you asked me directly, why is that bro": the request was to prepare the questions and hand off, not to ask live. Then: "dont confront me picking from the 4". The method was changed to §1. |

## §5 Re-design replay
If a re-design is requested later:
1. Re-run the superthink (§0.1) on the then-current review doc and designs.
2. Re-present only the affected batches as statements, with the earlier answer as the default ("Last time: lines, not boxes. Still ok?").
3. Log the new answers under the old ones in §4 (keep both), and bump this doc's version.

## §6 Superthink notes
*(empty - filled by the design decision session)*
