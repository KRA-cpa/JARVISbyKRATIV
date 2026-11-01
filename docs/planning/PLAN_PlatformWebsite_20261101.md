<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_PlatformWebsite_20261101.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 1 November 2026 UTC+8 (Philippine Standard Time) | Modified: 1 November 2026 UTC+8 (Philippine Standard Time)
Purpose: The public platform website - pages, public API surface, contact / trial requests, SEO, phases W1-W4 | Status: Draft (session 41700a8e), decisions W4 (domain) - W9 open, not built
REVISION HISTORY:
- v1.1.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | W4a: brand "Daloy by KRAtiv" replaces "TicketFlow" (taken); W4 narrowed to the domain
- v1.0.0 | 1 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created after the public /plans page (commit c5b755a); user: "page /plans should be accessible to the public, as part of the platform's website (TBD), might create a plan for this" → "write the website plan next"
===============================================================================
-->

# PLAN — Public platform website

## Context
With v10.2 the platform has something to sell: Basic, Advanced and Enterprise plans per company (`docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md`). The app has no public face yet:
- `/` sends every visitor to `/login` (`SmartRedirect` in `src/App.js`).
- `public/robots.txt` allows everything, the app screens included.
- There is no page that explains the product.

The first public page exists: **`/plans`** (commit `c5b755a`).
- It is open to everyone on `OpenRoute` and rendered from `src/config/plans.js` with **no API call**.
- `PublicHeader` (`src/components/shared/PublicHeader.js`) gives visitors **Sign in** and signed-in users **Go to dashboard**.
- `npm run check:api-contract` fails when the page copy differs from the server catalogue (gap `plan-copy …`).

This plan turns that into a small website around the app.

**Decisions made (session 41700a8e, 1 Nov 2026):**

| # | Decision |
|---|---|
| W1 | The website lives **in this app, as public routes** on the same Vercel project. Signed-in screens stay behind sign-in. One codebase, one deploy |
| W2 | **No prices yet.** The plans page shows features and limits, plus a "Talk to us" / "Request a trial" call to action. Prices come later (§8) |
| W3 | `/plans` is public now and makes no sign-in-requiring request (done, `c5b755a`) |
| W4a | **Brand: "Daloy by KRAtiv"** (Tagalog "flow"; parent line "A KRAtiv Solutions app"; KRA = Kenneth R. Advento). "TicketFlow" was taken. JARVIS stays the internal project / server name. Copy lives in `src/config/site.js` (`BRAND_*`) |

**Open decisions (defaults proposed; change any before its phase):**

| # | Question | Proposed default |
|---|---|---|
| W4 | Domain | TBD. Until there is one, the site runs on the Vercel URL. (Brand name decided - W4a above) |
| W5 | Where "Talk to us" goes | W1 phase: a `mailto:` to one sales address (env `REACT_APP_CONTACT_EMAIL`; the button is hidden while it isn't set). W2 phase: the lead form (§4) |
| W6 | Trial requests: self-serve or reviewed | **Reviewed:** a request becomes a lead; a platform admin creates the company and starts the trial (`startTrial`, v10.2 P2). Self-serve sign-up is later (§9) |
| W7 | Legal pages (terms, privacy) | Pages and routes are built with a clearly marked placeholder; **the text comes from the business / its counsel**, not from code |
| W8 | SEO depth | Phase W1: per-page title / description, sitemap, robots. Phase W4: prerendered HTML for the public routes |
| W9 | Analytics / cookies | **None** by default. If added later: privacy-friendly analytics with no cookies, or a consent banner |

---

**Built so far (1 Nov 2026, cloud session 017zmKf9):** W1 public pages **How it works** (`/how-it-works`, also `/features`; four short steps - the first, detailed version is archived in `docs/archive/2026-11/how-it-works-detailed/` - the nav label is `HOW_IT_WORKS_LABEL` in `src/config/site.js`) and **Contact** (`/contact`, mailto per W5: `REACT_APP_CONTACT_EMAIL`, hidden while unset, plus the DPO address); `PublicHeader` nav How it works · Plans · Contact · Privacy with a phone menu. Privacy is `docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md` (`/privacy`, not `/legal/privacy`). Still open in W1: `PublicFooter` / `PublicLayout`, page meta, sitemap / robots, code split, public 404, terms.

---

## §1 Principles
- **Public pages make no signed-in request.** They render from config files. The only public server calls are the ones in §5, and each is on an explicit allow-list in both the proxy and AppScript.
- **The server still decides.** Any plan or feature text on the site is display copy. Enforcement stays in AppScript (F1), and the `plan-copy` check keeps the copy honest.
- **App routes stay protected.** Nothing changes for `ProtectedRoute` screens. Visitors never load app data.
- **Little personal data.** The lead form (§4) stores only what it asks for. It has a privacy notice and a retention period.
- **Fast for visitors.** The app's screens are code-split away from the public pages (§6), so a visitor downloads only the site.

## §2 Site map
| Route | Page | Phase | Notes |
|---|---|---|---|
| `/` | **Home** for visitors (what it does, who it's for, the three plans in brief, call to action). Signed-in users → `/dashboard` as today | W1 | Replaces the `/login` redirect for visitors only |
| `/plans` | Plans + feature comparison | done | Add the W5 call to action in W1 |
| `/features` | The workflow engine, SLAs, approvals, Restricted tickets, uploader - short sections with screenshots | W1 | Copy in `src/config/site.js` |
| `/contact` | "Talk to us" / "Request a trial" | W1 (mailto) → W2 (form) | §4 |
| `/legal/terms`, `/legal/privacy` | Terms of service, privacy notice | W1 (placeholder) | W7 |
| `/login` | Sign in (exists) | - | Linked from `PublicHeader` |

- **Shared pieces:**
  - `PublicHeader`, extended with nav links Home / Features / Plans / Contact and a mobile menu;
  - a new `PublicFooter` (legal links, contact, copyright);
  - a `PublicLayout` that wraps both.
- **Copy:** `src/config/site.js` holds brand, taglines, sections, contact address and legal placeholders. Text changes never touch components.
- **Unknown public paths:** today they redirect to `/dashboard` (then `/login`). Add a public 404 for paths outside the app.

## §3 Routing changes (`src/App.js`)
- **`/`:** `SmartRedirect` → visitors render `HomePage` (on `OpenRoute`); signed-in users still go to `/dashboard`. `DEV_CONFIG.DISABLE_AUTH` keeps today's dev behaviour.
- **Public routes** use `OpenRoute`, the app routes `ProtectedRoute`, unchanged.
- **Catch-all:** known app prefixes (`/dashboard`, `/tickets`, `/reports`, `/admin`, `/profile`) keep redirecting to sign-in; anything else shows the public 404.

## §4 Contact and trial requests
- **W1 (no backend):** a `mailto:` button (W5). Nothing is stored. The button is hidden when `REACT_APP_CONTACT_EMAIL` isn't set (F4: no fake form).
- **W2 lead form** (after v10.2 P2, so `startTrial` exists):
  - **Fields:** name, work email, company, country, team size, plan of interest, message, consent checkbox (privacy notice link).
  - **Route `submitLead`** (public, POST): validates and normalises the fields, then writes a `website_leads` row. Columns: `id`, `name`, `email`, `company_name`, `country_code`, `team_size`, `plan_interest`, `message`, `consent_at`, `source_page`, `status` (`new|contacted|converted|discarded`), `company_id` once converted, audit columns.
    - Header-driven write (A1), `withScriptLock`, `invalidateTable`.
    - Ids from `generateId` (A18).
  - **Notify platform admins:** an in-app notification plus an `email_outbox` row to each platform admin (`PLATFORM_ADMIN_UIDS`, v10.2 P1).
  - **Abuse controls:**
    - at the proxy: a rate limit per IP (e.g. 5 per hour) and a captcha token check (Cloudflare Turnstile or reCAPTCHA, a secret in a Vercel env var);
    - in AppScript: a honeypot field, max field lengths, and a duplicate check (same email within 24 h → update, not a new row).
  - **Platform → Leads screen:** list, filter by status, mark contacted / discarded, **Convert**. Convert creates the company (and region) and calls `startTrial` with the requested plan and the default trial end, then sends an invite (v9.6) to the contact's email.
  - **Retention:** leads not converted are deactivated after 12 months. The editor job is idempotent (A19).
- **Dependencies:** the captcha widget is a script include, so `docs/reference/PRODUCTION_REQUIREMENTS.md` is updated first. No new npm package if the script tag is enough.

## §5 Public API surface
- **One list, in two places:** `PUBLIC_ACTIONS` in `api/_lib/proxyCore.js` and in AppScript.
  - Today the proxy refuses every unsigned request but `ping`, and AppScript (`authenticateRequest`, `checkAllowList`) does the same.
  - The list becomes `['ping', 'submitLead']` in W2. `getPlanCatalog` is **not** needed: the pages are static.
  - A public action runs without `_auth_uid`; it still needs the proxy secret (the public `/exec` URL stays closed).
- **Rule (compliance, new F7):** a public action never reads company data, never takes `user_id` from the body, and writes at most one row per call.
- **Checks:**
  - `check:code-rules`: every `PUBLIC_ACTIONS` entry is routed, and the two lists are the same;
  - a static rule: files under `src/pages/public/` and `src/components/public/` may not import `hooks/useAPI` or `api/googleSheet` (except the lead form's one call).
- **Caching:** public pages are static assets (Vercel CDN). `submitLead` replies are never cached.

## §6 SEO and performance
- **W1:**
  - per-route `document.title` and `meta description` through a small `usePageMeta` helper (no dependency);
  - `public/sitemap.xml` (public routes only);
  - `public/robots.txt`: allow the public routes, **disallow** `/dashboard`, `/tickets`, `/reports`, `/admin`, `/profile`, `/api/`;
  - an Open Graph image.
- **Code split (W1):** `React.lazy` + `Suspense` for the app's pages, so `/`, `/plans`, `/features` and `/contact` don't download the admin and ticket bundles. This is built into React 19, so no new dependency.
- **W4 prerender:** the CRA app renders in the browser, so crawlers see an empty `index.html`. Two options:
  - a build step that snapshots the public routes to static HTML (a prerender package, which needs `docs/reference/PRODUCTION_REQUIREMENTS.md` first);
  - moving the public pages to a static generator when the Neon/Vercel migration (`docs/planning/PLAN_Migration_NeonVercel_20261030.md`) changes the frontend build anyway.
  - Decide in W4, with measurements.
- **Targets:** Lighthouse ≥ 90 for performance / SEO / accessibility on `/`, `/plans` and `/features` (mobile); first load JS for the home page ≤ 200 KB gzip.

## §7 Content and accessibility
- All text in `src/config/site.js` and `src/config/plans.js`.
- Screenshots come from the seed data (`SEED_TestData_v1.2`), so no real company data is shown.
- Semantic headings, one `h1` per page, alt text, keyboard navigation for the mobile menu, dark-mode classes as in the app.

## §8 Prices (later, after v10.2 P2 invoices)
- **Server price list:** a `plan_prices` tab (plan, currency PHP, period monthly / yearly, amount, effective_from, audit), edited on Platform → Plans.
- **Use:** invoices default their plan line from it, and a public `getPlanPrices` action (added to `PUBLIC_ACTIONS`) feeds `/plans`.
- **Display:** prices are display only; what a company pays is what its invoice says.
- **Until then:** "Talk to us" (W2).

## §9 Self-serve sign-up (later, optional)
A visitor creates a company on a trial without a platform admin. It needs:
- abuse controls (email verification, a captcha, one trial per domain);
- an automatic company code;
- a default template set (v10.2 P3 template library).

Deferred until reviewed trials (W6) show the demand.

## §10 Phases
| Phase | Content | Needs | Backend |
|---|---|---|---|
| **W1** | `PublicLayout` / header / footer, Home, Features, Contact (mailto), legal placeholders, `/` + catch-all routing, page meta, sitemap / robots, code split, the `/plans` call to action | W4 brand text, W5 address, W7 placeholder OK | none - can ship with any frontend push |
| **W2** | Lead form + `submitLead` + `website_leads` + Platform → Leads + convert to company / trial / invite; proxy public list + rate limit + captcha | v10.2 P2 (`startTrial`) deployed | AppScript route + proxy change |
| **W3** | Prices (§8) | v10.2 P2 invoices | AppScript `plan_prices` + public read |
| **W4** | Prerender / SEO, domain, Lighthouse targets | W4 domain, W8 | none |

- **Order:** W1 can be built now (frontend only). W2 waits for the v10.2 deploy. W3 and W4 follow.
- **Commits:** each phase gets a local commit (working rule 3), and a frontend push waits for its AppScript deploy.

## §11 Tests and checks
- **W1:**
  - `npm run build:ci`;
  - `check:api-contract`, incl. `plan-copy` and every new page mounted from `src/index.js`;
  - `check:code-rules`, incl. the new "public pages make no API call" rule;
  - a local run (`run-frontend.bat local`): signed out, `/`, `/plans`, `/features` and `/contact` load with no proxy requests in the network tab; signed in, `/` goes to `/dashboard`; `/admin` signed out goes to sign-in; an unknown path shows the public 404.
- **W2:**
  - `ROUTES_TEST_v10.x.js`: `submitLead` without a uid works in enforce, other actions still refuse; validation, honeypot, the duplicate rule, one write, platform-admin notification, convert → company + trial + invite.
  - `scripts/test-proxy-auth.js`: a public action passes without a token, and the rate limit and captcha refusals work.
- **Every phase:** `/code-review` on the diff, logged in `docs/planning/TODO_CodeReview_<YYYYMMDD>.md`.

## §12 Progress
Not in the roadmap total yet. When this plan is approved for building, `docs/planning/PROGRESS_FeatureCompletion.md` §5 gets a scope row. Proposed **+5 pts**: public pages + routing + SEO basics 2, lead form + convert 2, prices 1. The total goes 154 → 159.
