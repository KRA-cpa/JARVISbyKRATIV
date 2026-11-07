<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_RequesterOnePager_20261101.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Daloy "requester one-pager" - a simple single-page site per company where requesters file and track requests, aimed at smaller companies | Status: IDEA / parked (session 017zmKf6), decisions R1-R8 open, not scheduled, not built
REVISION HISTORY:
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Sample page /r/demo added (user: "create a sample one pager request page")
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created so the idea isn't lost; user: "daloy can be wrapped in a simpler one pager site for requester, for smaller companies - create a plan for this so i wont forget it"
===============================================================================
-->

# PLAN — Requester one-pager (Daloy Lite for requesters)

## Context
Daloy today is one full app for everyone: requesters, approvers and admins all sign in to the same dashboard, ticket
lists, reports and admin screens. For a **small company** most people only ever do two things: **file a request** and
**check where it is**. The full app is too much for them.

**The idea:** wrap Daloy in a **simple one-page site per company** for requesters:
- pick a request type → fill the form → submit;
- see "my requests" and where each one is (step, who has it, due date);
- nothing else (no dashboard, reports, admin, workflow builder).

Approvers and admins keep the full app. The one-pager is a thin front on the same backend: no second system.

Why it matters:
- **Sells to small companies** (Basic plan, ≤ 25 users) where "install a ticketing system" is a hard pitch but
  "here is your request page" is easy.
- Fits the brand: *Less chasing, more flow* / *Magaan ang daloy*.
- Also the reason the home page copy avoids the word "internal" (1 Nov 2026): requesters may later be outside people.

## §1 Principles
1. **Same backend, same rules.** The one-pager calls the existing routes (`getCreatableTicketTypes`, `createTicket`,
   paged `getTickets`, ticket detail). The server still decides who may create / view (v10.0 visibility, compliance
   A21) and what the plan allows (v10.2 gate, F1). No logic copied into the page.
2. **One screen, phone first.** Most requesters open it from a link in chat or email on a phone.
3. **Nothing the requester doesn't need.** If a feature isn't "file" or "track", it stays in the full app.
4. **Per-company branding light:** the company's name (and later logo) on top, "Powered by Daloy" at the bottom.

## §2 What the page has
| Part | Content |
|---|---|
| Header | Company name (+ logo later), the requester's name, Sign out |
| **New request** | The ticket types this person may create (`getCreatableTicketTypes`) as big buttons → the type's form (same custom-field renderer as the app) → Submit → "Request PR-2026-00000042 sent to Manager" |
| **My requests** | Paged list: number, type, status, current step, who has it, due date. Tap → read-only timeline (steps, approvals, returns) + the return / cancel actions the requester already has |
| Footer | Help contact (company admin), Privacy Policy, "Powered by Daloy" |

Not on the page: approving, dashboards, reports, admin, tags / sharing, uploads (v1).

## §3 Open decisions (proposed defaults)
| # | Question | Proposed default |
|---|---|---|
| R1 | **Who are the requesters?** Staff of the company only, or also outside people (customers, tenants, suppliers)? | **v1 staff only.** Outside requesters = phase R3, after R4 / R5 are settled |
| R2 | **Sign-in** | v1: the same Google sign-in + allow-list / invites (v9.6). Later: email link (passwordless) for people without Google |
| R3 | **Address** | `/r/<company-slug>` on the Daloy domain (W4 domain still TBD). Custom domain = Enterprise, later |
| R4 | **Do requesters count as users (plan limit `users`)?** Basic allows 25 | Yes in v1 (simple, already enforced). Revisit with a separate "requester seat" if small companies hit 25 because of requesters |
| R5 | **Outside requesters: spam + privacy** | Needs a DPA review (PLAN_PrivacyPolicy_DPA): personal data of non-users, consent text on the form, retention. No anonymous submissions without rate limits + captcha |
| R6 | **Which plan gets it?** | All plans (it is the simplest way in). It is the default home for requesters on Basic |
| R7 | **Same app or separate deploy?** | Same React app, a new public-looking route group with its own minimal layout (like the website, W1). One codebase, one deploy |
| R8 | **Does a requester ever see the full app?** | A per-company switch: "requesters use the one-pager only". Off by default; Basic companies onboarded with it on |

## §4 What exists already vs what's new
| Need | Today (AppScript v10.2) | New work |
|---|---|---|
| List the types a user may file | `getCreatableTicketTypes` (v10.0, "who can create") | none |
| Create a ticket | `createTicket` | none (maybe a lighter response) |
| My requests, paged | `getTickets` paged + filters (v10.0 / v10.1) | a "mine as requester" filter if not already covered |
| Visibility | `canViewTicket` everywhere (A21) | none |
| Sign-in for staff | Firebase + allow-list + invites (v9.6) | none for v1 |
| Plan limits | `users`, `tickets_per_month` (v10.2) | R4 decision only |
| Company slug for the URL | – | new `companies.slug` column + lookup route (no data before sign-in except company name) |
| Company logo | – | later (upload or link) |
| Outside requesters | – | email-link sign-in, rate limit, consent, retention (R5) |

## §5 Phases
| Phase | Scope | Depends on |
|---|---|---|
| **R0** | This plan; settle R1-R8 | – |
| **R1** | One-pager for **staff**: route `/r/:slug`, minimal layout, New request + My requests, read-only timeline. Frontend only + `companies.slug` | v10.2 deployed; website W1 (shared public layout) |
| **R2** | Per-company switch (R8), company logo, "Powered by Daloy", onboarding guide for small companies | R1 |
| **R3** | **Outside requesters**: email-link sign-in, rate limits, consent text, retention rules | R5 DPA review; Privacy Policy published |
| **R4** | Extras if asked: attachments on the form, status emails with a "track" link, Filipino UI text | R1 |

Not scheduled. Pick it up after v10.2 is deployed and the website (W1) is live; add it to
`docs/planning/PLAN_FeatureGaps_Volume_20261031.md` (roadmap) when scheduled.

## §6 Risks
- **Two front ends drift.** Mitigate: reuse the app's form renderer and API hooks; no copied logic (§1.1).
- **Requester seats eat Basic's 25 users** (R4) - the very customers this is for.
- **Outside requesters = personal data of non-users** (R5): privacy and spam work before anything public.
- **Apps Script volume:** many small companies × requesters polling "my requests". Keep the page on paged reads and
  no auto-refresh faster than the app's.

## §7 Progress
| Item | Status |
|---|---|
| Plan written | ✅ 1 Nov 2026 |
| Sample page `/r/demo` (made-up data, no API, noindex): `src/pages/RequesterDemoPage.js` + `src/config/requesterDemo.js` | ✅ 1 Nov 2026 |
| R1-R8 decided | ⏳ |
| R1 built | ⏳ |
