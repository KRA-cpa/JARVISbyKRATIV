<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PROMPT_CheckHostingPricing.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 7 November 2026 UTC+8 (Philippine Standard Time) | Modified: 7 November 2026 UTC+8 (Philippine Standard Time)
Purpose: A reusable prompt for an AI assistant with web access (Claude with web search, or a cloud session whose network allows the providers' sites) to check the current prices, free-tier limits and terms of the services Daloy runs on, and to pick the cheapest compliant setup per stage | Status: Active (re-run before any hosting decision and every 3 months)
REVISION HISTORY:
- v1.0.0 | 7 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (cloud session 017zmKfA) after the "Postgres without paying" question: official pages couldn't be opened from the cloud session, so the figures came from search summaries
===============================================================================
-->

# PROMPT — Check hosting pricing and terms

**How to use:** paste everything inside the fence below into an assistant **that can open web pages**. In a Claude
Code cloud session, first allow these hosts in the environment's network settings: `neon.com`, `vercel.com`,
`developers.cloudflare.com`, `www.cloudflare.com`, `cloud.google.com`, `firebase.google.com`,
`developers.google.com`, `supabase.com`, `www.bsp.gov.ph`. Update the **Workload** numbers first if they changed.
Save the answer as `docs/planning/CHECK_HostingPricing_<YYYYMMDD>.md` and link it from
`docs/planning/PLAN_Migration_NeonVercel_20261030.md` and `docs/planning/PROPOSAL_Pricing_20261102.md`.

````text
You are checking the CURRENT prices, free-tier limits and terms of service for the hosting of a small B2B SaaS.
Be accurate rather than agreeable: if a page can't be opened or a number isn't stated, say so - never fill a gap
from memory or from a blog.

## Product and stage
- Daloy: ticketing + approval workflows for companies in the Philippines. React single-page app, a Node API
  (plain Node handlers, portable between hosts), Postgres, Firebase Authentication (Google sign-in), scheduled jobs
  (SLA escalation, email outbox), transactional email. Today the backend is Google Apps Script + Google Sheets.
- It is a COMMERCIAL product (paid plans, public pricing page). Stages to price:
  A. Build + pilot: no revenue, 1 pilot company.
  B. First paying customer: 1-3 companies.
  C. Growth: 10 companies.

## Workload (estimates - use them for every "does it fit" answer)
| | A | B | C |
|---|---|---|---|
| Active users | 25 | 75 | 400 |
| Tickets per month | 300 | 1,500 | 10,000 |
| API requests per day (peak working day) | 3,000 | 10,000 | 60,000 |
| Database size after 12 months | 0.2 GB | 0.5 GB | 3 GB |
| Working hours (Asia/Manila, Mon-Fri) | 10 h/day | 12 h/day | 14 h/day |
| Scheduled jobs | every 15 min (escalation, outbox), 1 nightly (backup, archive) | same | same |
| Emails per day | 50 | 200 | 1,500 |
| Region wanted | Singapore (or nearest to the Philippines) | | |

## Services to check (official pages first)
1. Neon Postgres - Free and the cheapest paid plan.
2. Vercel - Hobby and Pro (functions, cron jobs, bandwidth).
3. Cloudflare - Workers Free / Paid, Pages, Cron Triggers.
4. Google Cloud Run (+ Cloud Scheduler) free tier and first paid usage.
5. Supabase - Free and Pro (as the alternative Postgres).
6. Firebase Authentication - Spark (free) vs Blaze, for Google sign-in only.
7. Google Apps Script quotas - time-driven triggers, URL Fetch calls, MailApp recipients per day (consumer Gmail vs
   Google Workspace).
8. One transactional email provider with a free tier (name it, e.g. Resend, Brevo, Postmark, Amazon SES).

## For EACH service answer, with numbers
a. Price of each plan (monthly, per seat if any) and what usage costs above the included amount.
b. Free-tier limits: storage, compute (e.g. compute-hours and the smallest compute size), requests, CPU time per
   request, function duration, bandwidth / egress, number of projects, cron job count AND minimum interval.
c. **Commercial use:** is a commercial / revenue-generating product allowed on the free tier? Quote the exact
   sentence from the terms or the pricing FAQ, with its URL. "Not stated" is a valid answer.
d. What happens at the limit: hard stop, service paused / suspended, throttled, or billed automatically?
   Is a payment card required to use the free tier? Is there a spending cap?
e. Inactivity rules (e.g. projects paused after N days), cold-start / scale-to-zero behaviour.
f. Backups and restore window (point-in-time restore), and any uptime SLA per plan.
g. Data region availability (Singapore?) and where the data is stored.

## Calculations
1. Neon Free compute for stage A: compute-hours per month = (working hours + the time the 15-minute jobs keep the
   database awake, i.e. wakes per day x minutes awake per wake) x the smallest compute size x days. State the
   suspend-after-idle time you used and whether the free plan lets it be changed. Then the same with the jobs every
   30 and 60 minutes, and only during working hours.
2. For each stage, the cheapest setup that is ALLOWED by the terms (commercial use) and fits the workload:
   frontend host + API host + Postgres + scheduler + email + auth. Give the monthly total in USD and in PHP.
3. PHP conversion: use the latest monthly BSP weighted average rate from www.bsp.gov.ph - state the rate, its month
   and the URL. If you can't open it, say so and use 66 PHP / USD as a labelled planning rate.

## Output format
1. Date and time of the check (Asia/Manila, UTC+8).
2. One table per service: item | value | exact quote (short) | source URL | page date if shown.
3. A "Changed or uncertain" list: anything where sources disagree, a page couldn't be opened, or the number came
   only from a third-party site (mark those UNVERIFIED).
4. Stage A / B / C recommendation table: component | service + plan | monthly USD | monthly PHP | why | risk.
5. Red flags: terms that a paying customer would violate, limits that charge without a cap, pause / suspension rules.
6. What to re-check and when (e.g. "before the first paying customer", "every 3 months").

## Rules
- Prefer the provider's own pricing page, docs, terms of service and changelog. Third-party blogs only to point you
  to an official page, never as the source of a number.
- Quote, don't paraphrase, for commercial-use terms and limit behaviour.
- Don't round numbers that change a decision (e.g. 100 vs 190 compute-hours).
- No affiliate or promotional advice; no "it depends" without the numbers it depends on.
````
