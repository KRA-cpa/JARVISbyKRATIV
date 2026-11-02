<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PROPOSAL_Pricing_20261102.md | Author: Kenneth R. Advento | Version: 0.1.0
Created: 2 November 2026 UTC+8 (Philippine Standard Time) | Modified: 2 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Peso cost of the cloud services Daloy runs on + a proposed price list (plans, add-ons, one-time fees) for the four plans (PLAN_PlanTiers U9 / U10) | Status: PROPOSAL - not decided; website decision W2 ("no prices yet") still stands until approved
REVISION HISTORY:
- v0.1.0 | 2 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (user: "check peso rates for cloud services + proposed pricing"); web research 2 Nov 2026
===============================================================================
-->

# PROPOSAL — Daloy pricing (PHP)

**Sources are third-party summaries dated Oct-Nov 2026 unless marked; confirm on each vendor's own pricing page before
budgeting.** Rate used: **₱63.72 / USD** (mid-market, 2 Nov 2026); budget at **₱66 / USD** to cover card FX margins.

## §1 What the cloud services cost (monthly)
| Service | Used for | Price (USD) | ≈ PHP @ ₱66 | Notes |
|---|---|---|---|---|
| **Vercel Pro** | website, app, proxy / server | $20 / month, 1 deploying seat, incl. $20 usage credit; +$20 per extra deploying seat; usage above the credit is metered | **₱1,320** | Hobby (free) is **non-commercial only** - Pro is required once customers pay |
| **Google Workspace Business Starter** (platform account) | Apps Script owner, Sheets, mail (1,500 recipients / day vs 100 on Gmail) | $7 / user (annual) - $8.40 (flexible) | **₱510-610** incl. VAT (reseller quotes) | 1 user is enough today |
| **Firebase Authentication** | Google sign-in | free up to **50,000 MAU** (Blaze) | **₱0** | Spark (free plan) caps at 3,000 daily active users - use Blaze, still ₱0 at our size |
| Domain (.com / .ph) | daloy.* | ~$12-40 / year | **~₱100-200** / month | decision W4 |
| **Today (Apps Script stage) - total** | | | **≈ ₱2,000 / month** | |
| **Neon Postgres - Launch** (cloud server, PLAN_ServerCore) | database | usage: $0.106 / CU-hour + $0.35 / GB-month; small apps ~$15 | **₱1,000-2,700** | scale-to-zero keeps it low; an always-on 4-CU DB would be ~$345 - not needed |
| **Resend Pro** (or similar) | email from the cloud server | $20 / 50,000 emails | **₱1,320** | free tier 3,000 / month may do at first |
| Accounting / billing system | invoices, credit memos, BIR | [[not researched]] | [[₱1,500-3,000]] | issues the BIR-compliant invoices (plans §2c) |
| **Cloud-server stage - total** | | | **≈ ₱5,000-8,000 / month** | before growth |

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

## §3 Proposed price list (PHP, per company or organization, monthly, VAT-exclusive)
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
| Managed setup (platform team configures types, roles, users) | **₱5,000** (waivable by credit memo) |
| Paid custom ticket type (Basic / Basic+, U5) | **₱1,500** one-time per type |
| Own Google Sheet as the data store (bridge, PLAN_ServerCore O6) | **₱1,500 / month**, Advanced and up |
| Trial | 30 days, free |

**Checks on the numbers**
- **Upgrade hint (G4) works:** Basic+ with add-ons passes Advanced's ₱9,900 only around **~115 users** - long after
  a company should look at Advanced for its features; no one is pushed early.
- **Basic+ vs the closest rival:** 25 users on Basic+ = ₱2,490 vs Hier ESS ₱50 × 25 = ₱1,250 **plus** its ₱150-200 base
  plan per employee (₱5,000+). Daloy is cheaper as a stand-alone request layer and includes approval chains for any
  request, not only HR.
- **Floor:** cloud-server stage ≈ ₱8,000 / month → **covered by 4 Basic+ or 1 Advanced** customer.
- **Late penalty** (Terms §5.3b) on ₱2,490 = ₱25 / month - small enough to be fair, big enough to matter.

## §4 Things to settle (P-decisions)
| # | Question | Proposed default |
|---|---|---|
| PR1 | VAT status of KRATIV Solutions | Below the VAT threshold (₱3M gross sales / year) → non-VAT, percentage tax; prices shown "VAT-exclusive" now so nothing changes on registration *(confirm - Terms T4)* |
| PR2 | Prices shown publicly or "talk to us" | Public for Basic / Basic+ / Advanced; Enterprise by quote |
| PR3 | Annual discount | Pay 10 months for 12 |
| PR4 | Payment channels | Bank transfer + e-wallet / card via a local gateway [[fees not researched - typically a few %]] |
| PR5 | Founding-customer price | First [[10]] customers: Basic+ at ₱1,990 for 12 months (discount line on the invoice) |
| PR6 | Currency risk | Costs are in USD; review prices yearly or if ₱/$ moves > 10% |

## Sources (2 Nov 2026)
- Exchange rate: valuta.exchange/usd-to-php; exchangerates.org.uk USD-PHP history; poundsterlinglive.com USD-PHP 2026
- Vercel: focusreactive.com/vercel-cost-optimization; omidsaffari.com/blog/vercel-pricing; temps.sh Vercel pricing guide 2026
- Neon: comparedge.com/tools/neon-db/pricing; vela.run Neon pricing 2026; selfhost.dev Neon pricing
- Google Workspace: emailvendorselection.com/google-workspace-pricing; truehost.ph Google Workspace plan Philippines
- Firebase Auth: firebase.google.com/docs/auth; firebase.google.com/pricing
- Resend: usecarly.com/blog/resend-pricing; superdupr.com/blog/resend-pricing
- PH HR software: worksphr.com/pricing; hr.software/reviews/hier-payroll; akriviahcm.com HR payroll software pricing Philippines 2026
