<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_ESGPage_20261115.md | Author: Kenneth R. Advento | Version: 1.0.1
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Plan for a public ESG page (environmental, social, governance) for Daloy - what it says, where the numbers come from, honesty rules, where it lives, phases | Status: PLAN ONLY (user: "draft a ESG page. plan only") - defaults proposed, nothing built
REVISION HISTORY:
- v1.0.1 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | E-O1 done (user's "ok"): no switch needed - Google computes Carbon Footprint for every billing account; `krativ-daloy` is billed to the open account "Firebase Payment" (0126C7-...); BigQuery export only if E2 needs it
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9) after the US-vs-Singapore hosting and ESG comparison (user: "impact of moving to US cheapest", "check ESG impact of both", "draft a ESG page. plan only")
===============================================================================
-->

# PLAN — ESG page ("Sustainability & responsibility")

## Context
Customers - especially larger Philippine companies with their own ESG reporting, and their procurement teams - ask
suppliers where data lives, how it is protected, and what the service's environmental footprint is. Today the answers
are scattered: `/data-location`, `/privacy`, `/terms`, `/status`, the DPA (admins), the breach-notice process. The
15 Nov 2026 hosting check added the environmental facts (Google's carbon-free energy per region). One public page can
answer all three ESG questions honestly and link to the documents behind each answer.

**Facts already known (sources in §4):**
- Hosting: Google Cloud Run + Neon Postgres in **Singapore** (no Philippine region exists; decision D15).
- Singapore grid: Google **4 %** carbon-free energy (hourly, 2024), **367 g CO₂e / kWh**. US Oregon / Iowa: 87 %; the
  US would be ~10-30 × cleaner per unit of computing, but Daloy stays in Asia for speed and data residency
  (`CHECK_HostingPricing_20261108.md`, 15 Nov 2026 comparison). Daloy's absolute footprint is small (rough estimate
  ≈ 1 kg CO₂e / month at 10 companies - to be replaced by measured numbers, E2).
- Light by design: scales to zero when idle, no analytics, no tracking cookies, no ads.
- Social / governance: Data Privacy Act compliance work (DPO, PIA, privacy manual, breach runbook, rights requests),
  breach notices to organizations, data in Asia, Restricted tickets for sensitive data, audit logs, forced sign-out.

## §1 Decisions (defaults - veto any)
| # | Decision | Default |
|---|---|---|
| E-D1 | Name and address | **"Sustainability & responsibility"** at **`/sustainability`**, with "(ESG)" in the intro - plain words for most readers, "ESG" for procurement |
| E-D2 | Audience | Prospects, customers' procurement / ESG teams, the public. Not a report: one page, each claim linked to its source |
| E-D3 | Honesty rules | See §3 - no "green", "carbon neutral" or "net zero" claims about Daloy; Google's claims attributed to Google; every number dated with its source; gaps stated |
| E-D4 | Measured numbers | From Google Cloud's **Carbon Footprint** report for `krativ-daloy` (free) once it has data; until then only the region figures + "measured figures from {month}" |
| E-D5 | Where it lives | Content in `src/config/esg.js` (like the legal pages), page `src/pages/SustainabilityPage.js`, `OpenRoute`; footer link "Sustainability"; **previews only** (draft) until E3 |
| E-D6 | Update cycle | Yearly (with Google's new region data and the PIA review) + whenever hosting changes; "Last updated" on the page |
| E-D7 | Offsets | None bought, none claimed. If ever bought: named, with the registry link |
| E-D8 | Language | English; Filipino later if customers ask (same as the Privacy Policy, D10) |

## §2 Page outline (draft copy - final wording at E1)
1. **Intro** - "How Daloy handles the environment, people and accountability (ESG). Plain facts, with sources. Last
   updated {date}."
2. **Environmental**
   - *Where Daloy runs and what powers it* - Singapore; Google's hourly carbon-free energy there 4 % (2024), grid
     367 g CO₂e / kWh; why Singapore (no Philippine region, speed for users in the Philippines, data near customers) and
     the trade-off stated openly (US regions are cleaner per unit of computing).
   - *Small by design* - scales to zero when idle; the database suspends after 5 minutes idle; no analytics, trackers
     or ads; pages without heavy media.
   - *Our footprint* - E2: measured monthly emissions from Google's Carbon Footprint report (location- and market-based,
     as Google reports them) + the Neon (AWS) part stated as an estimate / not reported by the provider.
   - *What we will do* - re-check regions yearly; move to a Philippine or lower-carbon Asian region when one fits
     (price, speed, residency); keep the service light.
3. **Social**
   - *Your data and privacy* - Data Privacy Act; data in Asia (Singapore); no selling of data; Restricted tickets for
     sensitive information; download your data; privacy notice at sign-in. Links: `/privacy`, `/data-location`.
   - *If something goes wrong* - security notices to organizations, the breach process, `/status`.
   - *Accessibility* - keyboard use, screen-reader labels, light / dark modes; known gaps listed [[accessibility check -
     E1 runs one]].
   - *Local* - a Philippine company (KRAtiv Solutions); support in Philippine time.
4. **Governance**
   - *Who is responsible* - KRAtiv Solutions (owner), the Data Protection Officer (KRATIV.dpo@blueknight.xyz).
   - *Agreements* - General Terms, Data Processing Agreement (organizations' admins), providers listed (Google, Neon).
   - *Controls* - audit logs, staff access only with the customer's grant, forced sign-out, platform audit (as built).
   - *Decisions on record* - data in Singapore (D15), no analytics, Vercel not used for customer data.
5. **Sources and method** - each number with its source and date (§4); what is estimated vs measured.
6. **Contact** - questions about this page: the DPO mailbox (or a sales / ESG address - E-D9 in OPEN list below).

## §3 Honesty rules (anti-greenwashing)
- Say what is true for **Daloy**, not what is true for Google in general. Google's own targets (for example 24/7
  carbon-free energy by 2030) only as "Google states ...", with the link.
- Every figure: value, unit, year, source link. No rounding that changes the message (4 % stays 4 %).
- State the trade-off (Singapore is a higher-carbon grid than US regions) instead of hiding it.
- No icons or colours that imply a certification Daloy doesn't have.
- Measured (Carbon Footprint) and estimated (Neon / AWS) numbers are labelled as such.
- Counsel reviews the environmental wording before E3 (Philippine consumer-protection rules on product claims).

## §4 Data sources
| What | Source | Status |
|---|---|---|
| Region carbon-free energy + grid intensity | Google, `GoogleCloudPlatform/region-carbon-info`, yearly CSV (2024: Singapore 0.04 / 366.85) | available (read 15 Nov 2026) |
| Daloy's Cloud Run / Google emissions | Google Cloud **Carbon Footprint** report for the billing account / `krativ-daloy` (console; BigQuery export optional) | **to set up** (OPEN E-O1) |
| Neon (database) on AWS Singapore | no per-region data from Neon / AWS → estimate from compute hours × grid intensity, labelled | E2 |
| Hosting choices and trade-off | `docs/planning/CHECK_HostingPricing_20261108.md` | available |
| Privacy / security facts | `CHECK_PrivacyCompliance_20261115.md`, legal pages, breach template | available |

## §5 Phases
| Phase | Content | Needs | Done when |
|---|---|---|---|
| **E0** (now) | This plan | - | approved |
| **E1** | `src/config/esg.js` + `SustainabilityPage` on previews (draft badge), footer link on previews, region figures + qualitative sections, accessibility check of the main screens (feeds the Social section) | E0 ok | page reviewable on the preview |
| **E2** | Carbon Footprint set up; after the first full month, the measured figures + the Neon estimate | OPEN E-O1; one month of data | footprint section shows measured numbers |
| **E3** | Publish (status published, production footer link) | counsel's look at the environmental wording; your approval | live on `daloy.blueknight.xyz/sustainability` |
| **Yearly** | New Google region data, footprint for the year, review of the commitments | - | "Last updated" moves |

Effort: E1 S (1), E2 S (1). Not in the roadmap progress (website content, like the legal pages).

## §6 Open items (defaults in use)
| # | Item | Default | Needed by |
|---|---|---|---|
| E-O1 | ~~Turn on Google Cloud Carbon Footprint~~ **Done 15 Nov 2026:** nothing to switch on - Google computes it for every billing account (history included); `krativ-daloy` → billing account "Firebase Payment"; view: console → Carbon Footprint; monthly data around the 15th of the next month. BigQuery export (dataset + Data Transfer) only if E2 needs more than the dashboard | - | E2 |
| E-O2 | Counsel's review of environmental claims | before publishing | E3 |
| E-O3 | Contact for ESG questions | the DPO mailbox | E1 |
| E-O4 | Any company-level ESG facts to include (office energy, remote work, community work) | none - service only | E1 |

## §7 Related
`docs/planning/CHECK_HostingPricing_20261108.md` (regions, prices, the US comparison) · `PLAN_PlatformWebsite_20261101.md`
(public site) · `CHECK_PrivacyCompliance_20261115.md` · `src/config/legal/*` (page pattern) · the hosting rule (servers in
Asia).
