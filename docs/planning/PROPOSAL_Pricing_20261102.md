<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PROPOSAL_Pricing_20261102.md | Author: Kenneth R. Advento | Version: 0.3.0
Created: 2 November 2026 UTC+8 (Philippine Standard Time) | Modified: 2 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Peso cost of the cloud services Daloy runs on + a proposed price list (plans, add-ons, one-time fees) for the four plans (PLAN_PlanTiers U9 / U10) | Status: PROPOSAL - not decided; website decision W2 ("no prices yet") still stands until approved
REVISION HISTORY:
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

## §1 What the cloud services cost (monthly)
| Service | Used for | Price (USD) | ≈ PHP @ ₱63.10 | Notes |
|---|---|---|---|---|
| **Vercel Pro** | website, app, proxy / server | $20 / month, 1 deploying seat, incl. $20 usage credit; +$20 per extra deploying seat; usage above the credit is metered | **₱1,262** | Hobby (free) is **non-commercial only** - Pro is required once customers pay |
| **Google Workspace Business Starter** (platform account) | Apps Script owner, Sheets, mail (1,500 recipients / day vs 100 on Gmail) | $7 / user (annual) - $8.40 (flexible) | **₱442-530** + 12% VAT = **₱495-594** | 1 user is enough today |
| **Firebase Authentication** | Google sign-in | free up to **50,000 MAU** (Blaze) | **₱0** | Spark (free plan) caps at 3,000 daily active users - use Blaze, still ₱0 at our size |
| Domain (.com / .ph) | daloy.* | ~$12-40 / year | **~₱63-210** / month | decision W4 |
| **Today (Apps Script stage) - total** | | | **≈ ₱1,800-2,100 / month** | |
| **Neon Postgres - Launch** (cloud server, PLAN_ServerCore) | database | usage: $0.106 / CU-hour + $0.35 / GB-month; small apps ~$15 | **₱947-2,524** ($15-40) | scale-to-zero keeps it low; an always-on 4-CU DB would be ~$345 - not needed |
| **Resend Pro** (or similar) | email from the cloud server | $20 / 50,000 emails | **₱1,262** | free tier 3,000 / month may do at first |
| Accounting / billing system | invoices, credit memos, BIR | [[not researched]] | [[₱1,500-3,000]] | issues the BIR-compliant invoices (plans §2c) |
| **Cloud-server stage - total** | | | **≈ ₱5,500-8,900 / month** | before growth |

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
list below is the PHP proposal ÷ ₱63.10 (Oct 2026), rounded; the PHP column is what a November 2026 statement would show.

| Plan | **USD list / month** | = PHP at ₱63.10 (Nov 2026 statements) |
|---|---|---|
| Basic | **$24** | ₱1,514 |
| Basic+ | **$39** | ₱2,461 |
| Advanced | **$159** | ₱10,033 |
| Enterprise | **from $619** (quote) | from ₱39,059 |
| Add-on: +5 users | **$6.50** (Basic / Basic+) · **$4** (Advanced) · **$2.50** (Enterprise) | ₱410 · ₱252 · ₱158 |
| Add-on: tickets | **$5** / 250 (Basic / Basic+) · **$8** / 1,000 (Advanced) | ₱316 · ₱505 |

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
- **Floor:** cloud-server stage ≈ ₱8,900 / month → **covered by 4 Basic+ or 1 Advanced** customer.
- **Upgrade point recomputed:** Basic+ ₱2,490 + ₱400 per 5 users passes Advanced's ₱9,900 at **120 users**.
- **Late penalty** (Terms §5.3b) on ₱2,490 = ₱25 / month - small enough to be fair, big enough to matter.

## §3a One-time setup (user, 2 Nov 2026: "add one time setup cost")
**Charged to the customer** (one-time, on the first invoice, VAT-exclusive; waivable by credit memo or discount):
| Plan / item | Setup fee | What it covers |
|---|---|---|
| Basic | **₱3,000** | company + region set-up, adopting up to 5 templates, roles mapped, admin onboarding call, first 25 users invited |
| Basic+ | **₱5,000** | the above + Payroll and HR packs configured (leave types, approvers, windows) |
| Advanced | **₱15,000** | the above + up to 10 custom ticket types / workflows built with the customer, SLA rules, email settings, a training session |
| Enterprise | **by quote** (from ₱40,000) | migration / upload of existing tickets, Restricted set-up, several companies, integration (webhooks) |
| Own Google Sheet bridge (template copy + checks, PLAN_ServerCore §4a) | **₱5,000** | with the customer's Workspace admin |
| Data import (ticket uploader, on behalf) | **₱2,000 per 1,000 rows** | mapping + checks |
| Self-serve set-up (customer does it alone) | **₱0** | trial → adopt templates without help |

Proposed: the setup fee is **waived for annual prepayment** (PR7) - it rewards the commitment and covers the work out of
the prepaid year.

**KRATIV's own one-time costs to launch** ([[not researched - estimates to fill in with actual quotes]]):
| Item | Estimate |
|---|---|
| Business registration (DTI or SEC), barangay / mayor's permit | [[₱ - actual fees]] |
| BIR registration, books of accounts, invoicing (a BIR-registered invoicing / accounting system - plans §2c) | [[₱ - actual fees / subscription]] |
| Lawyer review: General Terms, DPA, Privacy Policy | [[₱ - quote]] |
| NPC registration / DPO appointment (if required - privacy plan D4) | [[₱ - if any]] |
| Domain + email set-up, logo / brand clearance (trademark search - IPOPHL) | [[₱ - actual]] |
| **Payback:** at ₱5,000 setup + ₱2,490 / month per Basic+ customer, one-time launch costs of ₱X are recovered after **X ÷ (setup + 12 × monthly margin)** customers - fill in once the quotes are in | |

## §4 Things to settle (P-decisions)
| # | Question | Proposed default |
|---|---|---|
| PR1 | VAT status of KRATIV Solutions | Below the VAT threshold (₱3M gross sales / year) → non-VAT, percentage tax; prices shown "VAT-exclusive" now so nothing changes on registration *(confirm - Terms T4)* |
| PR2 | Prices shown publicly or "talk to us" | Public for Basic / Basic+ / Advanced; Enterprise by quote |
| PR3 | Annual discount | Pay 10 months for 12 |
| PR4 | Payment channels | Bank transfer + e-wallet / card via a local gateway [[fees not researched - typically a few %]] |
| PR5 | Founding-customer price | First [[10]] customers: Basic+ at ₱1,990 for 12 months (discount line on the invoice) |
| PR6 | Currency risk | ✅ **Decided (user):** USD prices billed in PHP at the BSP weighted average rate of the previous month - the FX risk on USD costs passes to the customer month by month; the Usage & charges page shows the coming month's rate in advance (no bill shock) |
| PR7 | Setup fee on annual prepayment | Waived (discount line on the invoice) |

## Sources (2 Nov 2026)
- Exchange rate: philnews.ph USD to PHP exchange rate today, 2 Nov 2026 (October 2026 average ₱63.100, citing BSP); BSP Table 12 (bsp.gov.ph/statistics/external/tab12_pus_data.aspx - to confirm)
- Vercel: focusreactive.com/vercel-cost-optimization; omidsaffari.com/blog/vercel-pricing; temps.sh Vercel pricing guide 2026
- Neon: comparedge.com/tools/neon-db/pricing; vela.run Neon pricing 2026; selfhost.dev Neon pricing
- Google Workspace: emailvendorselection.com/google-workspace-pricing; truehost.ph Google Workspace plan Philippines
- Firebase Auth: firebase.google.com/docs/auth; firebase.google.com/pricing
- Resend: usecarly.com/blog/resend-pricing; superdupr.com/blog/resend-pricing
- PH HR software: worksphr.com/pricing; hr.software/reviews/hier-payroll; akriviahcm.com HR payroll software pricing Philippines 2026
