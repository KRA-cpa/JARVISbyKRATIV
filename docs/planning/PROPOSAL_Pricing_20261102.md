<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PROPOSAL_Pricing_20261102.md | Author: Kenneth R. Advento | Version: 0.9.0
Created: 2 November 2026 UTC+8 (Philippine Standard Time) | Modified: 2 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Peso cost of the cloud services Daloy runs on + a proposed price list (plans, add-ons, one-time fees) for the four plans (PLAN_PlanTiers U9 / U10) | Status: PROPOSAL - not decided; website decision W2 ("no prices yet") still stands until approved
REVISION HISTORY:
- v0.9.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User approved: Basic+ $35 (PR9) and the founding-customer price $29 / month for 12 months (PR5); PR10 still open
- v0.8.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §3c add-on crossover projection vs the next plan (user); users about right, tickets too cheap; proposed ticket add-ons $10 / 250 and $25 / 1,000 (PR10)
- v0.7.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | §3b first-year cost with setup ON TOP of the monthly fee (user); Basic+ options $39 / $35 / $33 / $31 - prices unchanged until decided (PR9)
- v0.6.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Setup fees set by the user: ₱3,490 / ₱5,590 / ₱16,990 / ₱44,990; recheck table; PR7 note (annual waiver = 11-22% of the first year)
- v0.5.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | PR8: provider price changes reflected from the next billing cycle (user)
- v0.4.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Projections at a conservative PLANNING rate of ₱66 / USD (user: "so we are already accounting for high USD rate"); billing still at the previous month's BSP rate
- v0.3.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Monthly subscription + add-ons priced in USD, billed in PHP at last month's BSP rate (user; General Terms §5.1a); USD list added; one-time fees stay in PHP
- v0.2.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Rate basis = BSP weighted average for the previous month (user): October 2026 ₱63.10 / USD; costs recomputed; one-time setup fees per plan + KRATIV's own one-time launch costs (user: "add one time setup cost")
- v0.1.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (user: "check peso rates for cloud services + proposed pricing"); web research 2 Nov 2026
===============================================================================
-->

# PROPOSAL — Daloy pricing (PHP)

**Sources are third-party summaries dated Oct-Nov 2026 unless marked; confirm on each vendor's own pricing page before
budgeting.**

**Exchange rate (user, 2 Nov 2026): the BSP weighted average rate for the previous month.** October 2026 =
**₱63.10 / USD** (as reported from the BSP daily rate table by philnews.ph, 2 Nov 2026 - [[confirm on BSP Table 12;
www.bsp.gov.ph was not reachable from this session]]). Card payments in USD add the bank's FX / foreign-transaction
fee on top. Update this rate each month (or at each price review) from the BSP table.

**Planning rate (user, 2 Nov 2026): ₱66 / USD** for every cost projection and every PHP figure in this proposal - a
buffer of ~4.6% over October's ₱63.10, so a weaker peso is already accounted for. **Billing** still converts at the
previous month's BSP rate (General Terms §5.1a); when BSP is below ₱66, statements come out lower than these figures.

## §1 What the cloud services cost (monthly)
| Service | Used for | Price (USD) | ≈ PHP @ ₱66 (planning) | Notes |
|---|---|---|---|---|
| **Vercel Pro** | website, app, proxy / server | $20 / month, 1 deploying seat, incl. $20 usage credit; +$20 per extra deploying seat; usage above the credit is metered | **₱1,320** | Hobby (free) is **non-commercial only** - Pro is required once customers pay |
| **Google Workspace Business Starter** (platform account) | Apps Script owner, Sheets, mail (1,500 recipients / day vs 100 on Gmail) | $7 / user (annual) - $8.40 (flexible) | **₱462-554** + 12% VAT = **₱517-621** | 1 user is enough today |
| **Firebase Authentication** | Google sign-in | free up to **50,000 MAU** (Blaze) | **₱0** | Spark (free plan) caps at 3,000 daily active users - use Blaze, still ₱0 at our size |
| Domain (.com / .ph) | daloy.* | ~$12-40 / year | **~₱66-220** / month | decision W4 |
| **Today (Apps Script stage) - total** | | | **≈ ₱1,900-2,200 / month** | |
| **Neon Postgres - Launch** (cloud server, PLAN_ServerCore) | database | usage: $0.106 / CU-hour + $0.35 / GB-month; small apps ~$15 | **₱990-2,640** ($15-40) | scale-to-zero keeps it low; an always-on 4-CU DB would be ~$345 - not needed |
| **Resend Pro** (or similar) | email from the cloud server | $20 / 50,000 emails | **₱1,320** | free tier 3,000 / month may do at first |
| Accounting / billing system | invoices, credit memos, BIR | [[not researched]] | [[₱1,500-3,000]] | issues the BIR-compliant invoices (plans §2c) |
| **Cloud-server stage - total** | | | **≈ ₱5,700-9,100 / month** | before growth |

**VAT on these:** foreign digital services sold to Philippine buyers now carry **12% VAT** (RA 12023) - expect it on
Vercel / Neon / Resend bills *(verify how each vendor charges it)*.

**What this means:** costs are **almost all fixed and small**. One more customer costs close to nothing until the
database and email volume grow. **Price from value and the market, not from cost** - costs only set the floor:
**3 Basic+ customers cover the cloud-server stage.**

## §2 What the market charges (PH, per employee per month)
| Product | Price | Comparable to |
|---|---|---|
| Hier Payroll - **Employee Self-Service add-on** (filing leave, OT, time logs) | **₱50** / active employee, on top of ₱150-200 plans | Daloy's payroll pack, closest match |
| WORKSPHR | ₱79 / ₱149 / ₱219 per employee (Starter / Growth / Pro) | full HR + payroll |
| Salarium | ~₱180-280 per employee | full HR + payroll |
| Sprout Solutions | ~₱200-300 per employee, enterprise by quote | full HR + payroll |
| Entry SME HR tiers (market) | ₱79-149; mid-market ₱150-300 | full HR + payroll |

Daloy is **not** a payroll system (payroll rules are out of scope); it is the **request and approval layer** (any
request type, not only HR). Benchmark: **₱40-100 per user per month**, below full HRIS, above a bare ESS add-on.

## §3 Proposed price list (per company or organization, monthly, VAT-exclusive)
**Currency (user, 2 Nov 2026; General Terms §5.1a):** the monthly subscription and monthly add-ons are **priced in USD**
and **billed in PHP** at the **BSP weighted average rate of the previous month**; one-time fees stay in PHP. The USD
list below is the PHP proposal ÷ ₱63.10 (Oct 2026), rounded.

| Plan | **USD list / month** | PHP at the **₱66 planning rate** | PHP at Oct 2026 BSP ₱63.10 (a Nov 2026 statement) |
|---|---|---|---|
| Basic | **$24** | ₱1,584 | ₱1,514 |
| Basic+ | **$35** ✅ (PR9; was $39) - founding customers **$29** for 12 months (PR5) | ₱2,310 (founding ₱1,914) | ₱2,209 (founding ₱1,830) |
| Advanced | **$159** | ₱10,494 | ₱10,033 |
| Enterprise | **from $619** (quote) | from ₱40,854 | from ₱39,059 |
| Add-on: +5 users | **$6.50** (Basic / Basic+) · **$4** (Advanced) · **$2.50** (Enterprise) | ₱429 · ₱264 · ₱165 | ₱410 · ₱252 · ₱158 |
| Add-on: tickets | **$5** / 250 (Basic / Basic+) · **$8** / 1,000 (Advanced) | ₱330 · ₱528 | ₱316 · ₱505 |

*PHP planning figures (the first draft, kept for reference):*
| Plan | Included | **Monthly** | Per user at full allowance | Annual (pay 10 months) |
|---|---|---|---|---|
| **Basic** | 25 users · 5 types · 500 tickets | **₱1,490** | ₱60 | ₱14,900 |
| **Basic+** (Payroll + HR packs) | 25 users · 5 types + packs · 1,000 tickets | **₱2,490** | ₱100 | ₱24,900 |
| **Advanced** | 200 users · 25 types · 5,000 tickets | **₱9,900** | ₱50 | ₱99,000 |
| **Enterprise** | 2,000 users · unlimited types · 50,000 tickets | **from ₱39,000** (quote) | ≤ ₱20 | by quote |

**Usage add-ons (U10)** - billed in arrears, only when used:
| Plan | +5 users | + ticket block |
|---|---|---|
| Basic / Basic+ | **₱400** (₱80 / user) | **₱300** per 250 tickets |
| Advanced | **₱250** (₱50 / user) | **₱500** per 1,000 tickets |
| Enterprise | **₱150** (₱30 / user) | - (storage ceiling; talk to us) |

**One-time and other add-ons**
| Item | Proposed |
|---|---|
| Managed setup | see **§3a one-time setup fees** |
| Paid custom ticket type (Basic / Basic+, U5) | **₱1,500** one-time per type |
| Own Google Sheet as the data store (bridge, PLAN_ServerCore O6) | **₱1,500 / month**, Advanced and up |
| Trial | 30 days, free |

**Checks on the numbers**
- **Upgrade hint (G4) works:** Basic+ with add-ons passes Advanced's ₱9,900 only at **120 users** - long after a
  company should look at Advanced for its features; no one is pushed early.
- **Basic+ vs the closest rival:** 25 users on Basic+ = ₱2,490 vs Hier ESS ₱50 × 25 = ₱1,250 **plus** its ₱150-200 base
  plan per employee (₱5,000+). Daloy is cheaper as a stand-alone request layer and includes approval chains for any
  request, not only HR.
- **Floor (at ₱66):** cloud-server stage ≈ ₱9,100 / month → **covered by 4 Basic+ ($35 = ₱2,310 each) or 1 Advanced
  ($159 = ₱10,494)** customer. Costs and prices are both in USD, so the floor holds at any rate.
- **Upgrade point (USD list):** Basic+ $35 + $6.50 per 5 users passes Advanced's $159 at **125 users** - the same at any rate.
- **Late penalty** (Terms §5.3b) on ₱2,490 = ₱25 / month - small enough to be fair, big enough to matter.

## §3a One-time setup (user, 2 Nov 2026: "add one time setup cost")
**Charged to the customer** (one-time, on the first invoice, VAT-exclusive; waivable by credit memo or discount):
| Plan / item | Setup fee | What it covers |
|---|---|---|
| Basic | **₱3,490** | company + region set-up, adopting up to 5 templates, roles mapped, admin onboarding call, first 25 users invited |
| Basic+ | **₱5,590** | the above + Payroll and HR packs configured (leave types, approvers, windows) |
| Advanced | **₱16,990** | the above + up to 10 custom ticket types / workflows built with the customer, SLA rules, email settings, a training session |
| Enterprise | **from ₱44,990** (quote above for migrations / many companies) | migration / upload of existing tickets, Restricted set-up, several companies, integration (webhooks) |
| Own Google Sheet bridge (template copy + checks, PLAN_ServerCore §4a) | **₱5,000** | with the customer's Workspace admin |
| Data import (ticket uploader, on behalf) | **₱2,000 per 1,000 rows** | mapping + checks |
| Self-serve set-up (customer does it alone) | **₱0** | trial → adopt templates without help |

Setup fees set by the user (2 Nov 2026), in PHP, VAT-exclusive, not rate-linked. **Recheck** (at the ₱66 planning rate):
| Plan | Setup | = months of the monthly fee | % of an annual prepayment (10 months) | with 12% VAT (if registered) |
|---|---|---|---|---|
| Basic | ₱3,490 | 2.2 | 22% | ₱3,909 |
| Basic+ | ₱5,590 | 2.2 | 22% | ₱6,261 |
| Advanced | ₱16,990 | 1.6 | 16% | ₱19,029 |
| Enterprise | from ₱44,990 | 1.1 | 11% | from ₱50,389 |

- The steps are consistent: Basic+ − Basic = ₱2,100 for configuring the two packs.
- Basic / Basic+ setup ≈ 2 months of fees - fine because it is **optional** (self-serve set-up is ₱0).
- Enterprise is the lightest relative to its fee (1.1 months) while its work is the heaviest (migration, several
  companies, Restricted, webhooks) - keep it **"from"** and quote above it when the scope is large.
- Annual prepayment: waiving the whole fee (PR7) on top of "pay 10 for 12" gives Basic / Basic+ ~36% off the first
  year - see PR7.

**KRATIV's own one-time costs to launch** ([[not researched - estimates to fill in with actual quotes]]):
| Item | Estimate |
|---|---|
| Business registration (DTI or SEC), barangay / mayor's permit | [[₱ - actual fees]] |
| BIR registration, books of accounts, invoicing (a BIR-registered invoicing / accounting system - plans §2c) | [[₱ - actual fees / subscription]] |
| Lawyer review: General Terms, DPA, Privacy Policy | [[₱ - quote]] |
| NPC registration / DPO appointment (if required - privacy plan D4) | [[₱ - if any]] |
| Domain + email set-up, logo / brand clearance (trademark search - IPOPHL) | [[₱ - actual]] |
| **Payback:** at ₱5,590 setup + $35 (₱2,310 at ₱66) / month per Basic+ customer, one-time launch costs of ₱X are recovered after **X ÷ (setup + 12 × monthly margin)** customers - fill in once the quotes are in | |

## §3b First-year cost to the customer - setup is ON TOP of the monthly fee (user, 2 Nov 2026)
At the ₱66 planning rate; per user = at the full user allowance.
| Plan | Monthly | Year 1 monthly + setup | Year 1 annual (10 mo) + setup | Year 1 self-serve | **₱ / user / month, year 1 with setup** | year 1 self-serve | year 2+ |
|---|---|---|---|---|---|---|---|
| Basic | ₱1,584 | ₱22,498 | ₱19,330 | ₱19,008 | **₱75** | ₱63 | ₱63 |
| Basic+ | ₱2,574 | ₱36,478 | ₱31,330 | ₱30,888 | **₱122** | ₱103 | ₱103 |
| Advanced | ₱10,494 | ₱142,918 | ₱121,930 | ₱125,928 | **₱60** | ₱52 | ₱52 |
| Enterprise | ₱40,854 | ₱535,238 | ₱453,530 | ₱490,248 | **₱22** | ₱20 | ₱20 |

**Finding:** only **Basic+** leaves the ₱40-100 per user target (§2) - **₱122** in year 1 with setup, ₱103 even
self-serve - and the buyer of Basic+ compares it with HR apps whose entry tiers include leave / OT filing
(WORKSPHR Starter ₱79 per employee). Basic, Advanced and Enterprise stay inside or below the band.

**Basic+ options** (setup ₱5,590 unchanged):
| Basic+ | ₱ / month @ ₱66 | Year 1 with setup, ₱ / user | Self-serve / year 2+, ₱ / user | Year 1 annual + setup |
|---|---|---|---|---|
| $39 (current) | ₱2,574 | ₱122 | ₱103 | ₱31,330 |
| **$35** | ₱2,310 | ₱111 | ₱92 | ₱28,690 |
| $33 | ₱2,178 | ₱106 | ₱87 | ₱27,370 |
| $31 | ₱2,046 | ₱100 | ₱82 | ₱26,050 |

**Recommendation (PR9):** **Basic+ $35** - back inside the band from year 2 / self-serve (₱92), year 1 with setup
₱111; still well above Basic ($24), so the packs keep a clear price. Pitch it as "every request type, with payroll and
HR packs" rather than as an HR app. With PR7 (50% off setup on annual prepayment) a Basic+ annual year 1 is
₱25,895 (₱86 / user). Floor check at $35: cloud-server stage ₱9,100 / ₱2,310 → still **4 Basic+** customers.

## §3c "Need more?" add-ons vs the next plan up (user, 2 Nov 2026)
**Crossover** = the usage at which "plan + add-ons" costs more than the next plan. Target: **50-80 % of the next plan's
allowance** - earlier and add-ons feel punitive; beyond 100 % and add-ons undercut the upgrade. USD (rate-independent).

**Current add-on prices**
| From → to | Users: crossover | Tickets: crossover |
|---|---|---|
| Basic → Advanced | 130 users = **65 %** ✅ | 7,500 tickets = **150 %** ❌ too cheap |
| Basic+ → Advanced | 120 users = **60 %** ✅ | 7,250 tickets = **145 %** ❌ too cheap |
| Advanced → Enterprise | 780 users = **39 %** ⚠ a little early, acceptable (Enterprise features matter at that size) | 63,000 tickets = **126 %** ❌ too cheap (and past the 50,000 storage ceiling) |

**Why:** an add-on unit should cost about what a unit costs inside the plan. Users do (Basic $0.96 / user in the plan
vs $1.30 as add-on; Advanced $0.80 vs $0.80). Tickets don't: Basic $0.048 / ticket in the plan vs **$0.020** as add-on;
Advanced $0.032 vs **$0.008**.

**Proposed ticket add-ons (PR10)** - users unchanged:
| Plan | Ticket add-on | at ₱66 | Crossover |
|---|---|---|---|
| Basic / Basic+ | **$10 per 250** (was $5) | ₱660 | Basic 4,000 = **80 %**; Basic+ 4,250 = **85 %** (at $35: 4,250 = 85 %) |
| Advanced | **$25 per 1,000** (was $8) | ₱1,650 | 24,000 = **48 %** |
| Enterprise | - (storage ceiling) | | |

**Combined growth** (users and tickets grow together - the usual case), Basic+ at $35, new ticket prices:
| Users / tickets per month | Basic+ + add-ons | Advanced |
|---|---|---|
| 40 / 1,500 | $74.50 | $159 |
| 60 / 2,000 | $120.50 | $159 |
| 80 / 3,000 | **$186.50** | **$159** - upgrade hint (G4) fires here |
| 100 / 4,000 | $252.50 | $159 |
A growing company is pointed to Advanced at roughly **70-80 users / 2,500-3,000 tickets** - well inside Advanced's
200 / 5,000, so the move feels natural, never forced. The 3-month ticket average still shields one-off spikes.

## §4 Things to settle (P-decisions)
| # | Question | Proposed default |
|---|---|---|
| PR1 | VAT status of KRATIV Solutions | Below the VAT threshold (₱3M gross sales / year) → non-VAT, percentage tax; prices shown "VAT-exclusive" now so nothing changes on registration *(confirm - Terms T4)* |
| PR2 | Prices shown publicly or "talk to us" | Public for Basic / Basic+ / Advanced; Enterprise by quote |
| PR3 | Annual discount | Pay 10 months for 12 |
| PR4 | Payment channels | Bank transfer + e-wallet / card via a local gateway [[fees not researched - typically a few %]] |
| PR5 | Founding-customer price | ✅ **Decided (user, 2 Nov 2026):** the first [[10]] customers on Basic+ pay **$29 / month for their first 12 months** (then the list price), shown as a discount line on each statement; setup fee as normal (PR7 applies to annual prepayment) |
| PR6 | Currency risk | ✅ **Decided (user):** USD prices billed in PHP at the BSP weighted average rate of the previous month - the FX risk on USD costs passes to the customer month by month; the Usage & charges page shows the coming month's rate in advance (no bill shock) |
| PR7 | Setup fee on annual prepayment | Waiving it fully = 11-22% of the first year on top of the 2-months-free annual price. **Recommendation: 50% off the setup fee** with annual prepayment (discount line on the invoice) [[confirm]] |
| PR8 | Provider price changes (Google, Vercel, Neon, email) | ✅ **Decided (user):** reflected in Daloy's USD prices **from the next billing cycle**, after [[30]] days' notice; prepaid periods keep their price; customers may leave before it applies (General Terms §5.1b). Review the §1 cost table whenever a provider announces a change |
| PR9 | Basic+ monthly price, given setup is on top | ✅ **Decided (user, 2 Nov 2026): $35** (§3b) |
| PR10 | Ticket add-on prices | **$10 per 250** (Basic / Basic+) and **$25 per 1,000** (Advanced) - §3c; user add-ons unchanged [[decide]] |

## Sources (2 Nov 2026)
- Exchange rate: philnews.ph USD to PHP exchange rate today, 2 Nov 2026 (October 2026 average ₱63.100, citing BSP); BSP Table 12 (bsp.gov.ph/statistics/external/tab12_pus_data.aspx - to confirm)
- Vercel: focusreactive.com/vercel-cost-optimization; omidsaffari.com/blog/vercel-pricing; temps.sh Vercel pricing guide 2026
- Neon: comparedge.com/tools/neon-db/pricing; vela.run Neon pricing 2026; selfhost.dev Neon pricing
- Google Workspace: emailvendorselection.com/google-workspace-pricing; truehost.ph Google Workspace plan Philippines
- Firebase Auth: firebase.google.com/docs/auth; firebase.google.com/pricing
- Resend: usecarly.com/blog/resend-pricing; superdupr.com/blog/resend-pricing
- PH HR software: worksphr.com/pricing; hr.software/reviews/hier-payroll; akriviahcm.com HR payroll software pricing Philippines 2026
