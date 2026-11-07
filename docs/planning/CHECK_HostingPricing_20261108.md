<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: CHECK_HostingPricing_20261108.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 8 November 2026 UTC+8 (Philippine Standard Time) | Modified: 8 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Answer to docs/guides/PROMPT_CheckHostingPricing.md - current prices, free-tier limits, terms and SERVER LOCATIONS of the services Daloy can run on, ranked Philippines > Southeast Asia > rest of Asia > cheapest elsewhere; the cheapest all-Asia stack with its catches and its DPA / Terms / Privacy Policy implications | Status: Active - recommendation pending the user's confirmation and the UNVERIFIED items (§4)
REVISION HISTORY:
- v1.1.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | User decided: production → Cloud Run Singapore behind Firebase Hosting (daloy.blueknight.xyz), previews stay on Vercel Hobby (risk accepted); custom-domain options checked (§4) - Firebase Hosting chosen
- v1.0.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 61523343). User rules: servers must be in Asia; PH > SEA > Asia > cheapest; recommend the cheapest overall + catches + legal implications
===============================================================================
-->

# CHECK — Hosting prices, terms and locations (8 Nov 2026)

## §1 When and how
- **Checked:** 8 November 2026, 02:55–03:30 Asia/Manila (UTC+8), from a local Claude Code session that could open the
  providers' own pages. Each figure below names its page and the page date where one is shown.
- **Rule (user, 8 Nov 2026):** *servers must be in Asia*; rank **Philippines > Southeast Asia > rest of Asia > cheapest
  elsewhere**; ultimately **recommend the cheapest overall** with its catches and the DPA / Terms / Privacy implications.
- **UNVERIFIED** = not read on the provider's own page (page didn't render, or a third-party source only). Nothing was filled
  from memory.
- **Currency:** BSP's statistics page says *"The Online Interactive Statistics Database has been temporarily disabled due
  to technical issues"* (www.bsp.gov.ph/SitePages/Statistics/ExchangeRate.aspx), so PHP figures use the **₱66 / USD
  planning rate** (labelled). The ₱63.10 October rate in `PROPOSAL_Pricing_20261102.md` was not re-verified.

## §2 Locations and prices by layer (🇵🇭 → SEA → Asia → elsewhere)

### §2.1 Database (Postgres)
| Rank | Option | Price | Source |
|---|---|---|---|
| 🇵🇭 | **No managed Postgres in the Philippines** from the providers checked. **AWS Manila Local Zone** `ap-southeast-1-mnl-1a` (parent: Singapore) offers *"T3, C5, R5, and M5 instances"*, *"gp2 volume type"*; **RDS, S3, NAT Gateway: not available** → Postgres would be self-managed on EC2 | EC2 Manila price **UNVERIFIED** (AWS price pages did not render) | aws.amazon.com/about-aws/global-infrastructure/localzones/features/ (© 2026) |
| 🇵🇭 | Local providers: ePLDT / PLDT Vitro (Makati), Converge Cloud (Angeles data center, announced 2026), Zenlayer Manila (colocation / bare metal), Nearbase ("managed PostgreSQL for Asia", page returned 403) | no self-serve prices found - **quotes needed**, UNVERIFIED | search results 8 Nov 2026 |
| SEA ✅ | **Neon - Singapore `aws-ap-southeast-1`** (the only Asian Neon region; *"Neon has no Singapore Azure region"*) | **Free** $0: 100 CU-h / project / month, up to 2 CU, *"Suspends after 5 min; cannot be turned off"*, 5 GB egress, 6 h history. **Launch**: *"Pay for what you use … no monthly minimum"*, **$0.106 / CU-hour**, **$0.35 / GB-month**, 7-day history. **Scale**: $0.222 / CU-hour, 30-day history, the only plan with an uptime SLA. No regional price difference stated | neon.com/pricing ("Last updated: 2026-11-04"); neon.com/docs/introduction/plans (2026-11-04); neon.com/docs/introduction/regions (14 Oct 2026) |
| SEA | Supabase - Singapore `ap-southeast-1` | Free: 500 MB, *"Limit of 2 active projects"*, *"Free projects are paused after 1 week of inactivity"*, no backups. Pro *"from $25/month"*, $10 compute credit, 8 GB, *"Daily backups stored for 7 days"*, no SLA. Regional price difference not stated | supabase.com/pricing; supabase.com/docs/guides/platform/regions (no date) |
| Asia | Supabase Tokyo, Seoul, Mumbai (and Sydney) | as above | as above |
| Elsewhere | Neon US / EU / São Paulo / Sydney (same price) | as above | as above |

### §2.2 Application / API compute
| Rank | Option | Price | Source |
|---|---|---|---|
| 🇵🇭 (edge) | **Cloudflare Workers** - Cloudflare lists data centers in **Cagayan de Oro, Cebu, Manila, Tarlac City** (PH). Which data center runs a request is not stated / not guaranteed | Free: *"100,000 requests per day"* (over it: Error 1027), 10 ms CPU per invocation, 5 Cron Triggers. Paid: *"$5 USD minimum per account per month"*, 10 M requests + 30 M CPU-ms, +$0.30 / M requests, +$0.02 / M CPU-ms, 250 Cron Triggers | cloudflare.com/network/; developers.cloudflare.com/workers/platform/pricing/ (2 Oct 2026), /limits/ (29 Oct 2026) |
| SEA ✅ | **Google Cloud Run - Singapore `asia-southeast1`** (Tier 2) or **Bangkok `asia-southeast3`** (Tier 1). No Philippine region (Manila is only a network edge / CDN / interconnect site) | Free tier (request-based): *"First 180,000 vCPU-seconds"*, *"First 360,000 GiB-seconds"*, 2 M requests - *"applied as a spending based discount using Tier 1 pricing"*. Tier 1 active rate $0.000024 / vCPU-s, $0.0000025 / GiB-s. **Tier 2 (Singapore) per-unit rate UNVERIFIED** (region table renders by script). *"A Google Cloud billing account is required to access the Google Cloud Free Tier."* Cloud Scheduler: $0.10 / job / month, *"Each Google billing account gets 3 jobs per month free"* | cloud.google.com/run/pricing; docs.cloud.google.com/run/docs/locations; docs.cloud.google.com/free/docs/free-cloud-features; cloud.google.com/scheduler/pricing |
| SEA | **Vercel `sin1` Singapore** (Pro only; regional prices are *"available only to Pro plan users"*) | Fluid Active CPU **$0.16 / h**, Provisioned Memory **$0.0133 / GB-h**, Fast Data Transfer **$0.16 / GB**, CDN requests $2.60 / M, Fast Origin Transfer $0.27 / GB. Pro **$20 / month** incl. *"$20 included credit"* | vercel.com/docs/pricing/regional-pricing/sin1 (14 Sep 2026); vercel.com/pricing |
| Asia | Vercel `bom1` Mumbai: CPU $0.14 / mem $0.0116 / transfer $0.20 · `icn1` Seoul: $0.169 / $0.014 / $0.35 · `hkg1` Hong Kong: $0.176 / $0.0146 / $0.16 · `hnd1` Tokyo & `kix1` Osaka: $0.202 / $0.0167 / $0.16. Cloud Run Tier 1: Tokyo, Osaka, Taiwan, Mumbai | as listed | vercel.com/docs/pricing/regional-pricing/<code> (14 Sep 2026) |
| Elsewhere | Vercel `iad1` Washington: $0.128 / $0.0106 / $0.15 - **Vercel's default function region** (*"Vercel Functions default to running in the iad1"*); `syd1` Sydney $0.18 / $0.0149 / $0.16 | | vercel.com/docs/regions (11 Aug 2026) |

### §2.3 Website (static files)
| Rank | Option | Price | Source |
|---|---|---|---|
| 🇵🇭 (edge) | Cloudflare Pages | *"Requests to static assets are free and unlimited"*; commercial use on Free: not stated | developers.cloudflare.com/workers/platform/pricing/ |
| SEA | Served by the same Cloud Run service (Singapore) | inside the Cloud Run usage above | - |
| SEA | Vercel (CDN; 126 PoPs - the docs don't list PoP cities, so a PH PoP is not confirmed) | Pro $20 | vercel.com/docs/regions |

### §2.4 Sign-in
| Rank | Option | Price | Source |
|---|---|---|---|
| 🇵🇭 / SEA ✅ | **Better Auth / Auth.js** with its tables in Neon Singapore (planned in `PLAN_Migration_NeonVercel_20261030.md` §3), Google sign-in through OAuth | $0 (inside the database + compute above) | - |
| ❌ | **Firebase Authentication (used today)**: *"The Firebase Authentication service is run only from US data centers."* *"Firebase Authentication processes data exclusively in the United States."* - **fails the Asia rule** | 50K MAU at no cost on Spark and Blaze | firebase.google.com/support/privacy (last modified 24 Sep 2026); firebase.google.com/pricing |

### §2.5 Email
| Rank | Option | Price | Source |
|---|---|---|---|
| 🇵🇭 | none found | | |
| SEA ✅ | **Amazon SES - Singapore `ap-southeast-1`** (also Jakarta, Malaysia, Thailand; SMTP not in Jakarta / Malaysia) | **$0.10 per 1,000** emails (à la carte; no regional rate stated); attachments $0.12 / GB; new accounts: *"Sending quota … 200 per 24 hours"* until production access | docs.aws.amazon.com/general/latest/gr/ses.html; aws.amazon.com/ses/pricing/ |
| Asia | Resend - Tokyo `ap-northeast-1` (its only Asian region); SES Tokyo / Osaka / Seoul / Mumbai / Taipei | Resend Free $0: 3,000 / month, *"limited to 100 emails per day"*; Pro $20 / 50,000, $35 / 100,000, $0.90 / 1,000 over | resend.com/docs/dashboard/domains/regions; resend.com/pricing |
| Today | Apps Script MailApp (Google, no region choice) | consumer 100 recipients / day, Workspace 1,500 / day | developers.google.com/apps-script/guides/services/quotas |

### §2.6 Today's data store
- **Google Sheets + Apps Script: no Asia option.** Workspace data regions are *"United States, Europe, No preference"*, and
  only for Frontline Plus, Education Standard / Plus, Enterprise Plus, Enterprise Essentials Plus (knowledge.workspace.google.com
  "Choose a geographic location for your data", updated 26 Oct 2026). Only the Postgres move meets the Asia rule.
- Apps Script quotas (*"subject to elimination, reduction, or change at any time, without notice"*): consumer vs Workspace -
  email recipients 100 vs 1,500 / day, URL Fetch 20,000 vs 100,000 / day, trigger runtime **90 min vs 6 h / day**, 6 min
  per run, 20 triggers / user / script.

## §3 Other terms that change the decision
| Item | Exact text | Source |
|---|---|---|
| **Vercel Hobby is non-commercial** | *"Hobby teams are restricted to non-commercial personal use only."* Commercial includes *"Advertising the sale of a product or service"* | vercel.com/docs/limits/fair-use-guidelines (14 Sep 2026) |
| → **The live site** (/plans, the founding-customer offer, sales buttons) **advertises a product**, so Vercel needs **Pro now** (or the site moves off Vercel). The Vercel plan this project uses is not known from the repo - check the dashboard | | |
| Vercel Hobby crons | *"Hobby accounts are limited to cron jobs that run once per day."* Pro: once per minute, 100 per project | vercel.com/docs/cron-jobs/usage-and-pricing (15 Jul 2026) |
| Vercel spend | default $200 on-demand budget; *"At 100%, you can optionally pause all projects"*; Pro *"pay as you go, uncapped"* | vercel.com/pricing |
| Neon Free at the limit | *"your compute is suspended until the next billing period or until you upgrade"*; *"None of these limits delete your data."* | neon.com/docs/introduction/plans |
| Neon SLA | *"Guaranteed service availability is offered on the Scale plan."* | same |
| Cloudflare free services | *"termination of the Free Service by Cloudflare in our sole discretion"* | cloudflare.com/terms/ (Self-Serve Subscription Agreement, 12 Sep 2025) |
| Commercial use on free tiers | **Not stated** for Neon, Cloudflare, Supabase, Resend, Firebase | their pricing / terms pages |

## §4 Changed or uncertain
- **UNVERIFIED - check before committing:** Cloud Run Tier 2 (Singapore) per-unit rates; Cloud Run internet egress rates;
  AWS Manila EC2 prices; local PH provider prices.
- **Custom domain - checked (v1.1.0):** Cloud Run domain mapping supports `asia-southeast1` but *"Cloud Run domain mappings
  are in the preview launch stage"* and *"not production-ready"* (docs.cloud.google.com/run/docs/mapping-custom-domains).
  **Firebase Hosting** rewrites to Cloud Run in `asia-southeast1` (firebase.google.com/docs/hosting/cloud-run), needs a
  billing account (Blaze), *"60-second request timeout"*; Hosting includes *"10 GB"* storage and *"360 MB/day"* transfer at
  no cost, then $0.026 / GB stored and $0.15 / GB transferred (firebase.google.com/pricing); *"Only the specially-named
  `__session` cookie is permitted to pass through"* (firebase.google.com/docs/hosting/manage-cache). → **Chosen: Firebase
  Hosting** in front of Cloud Run.
- Neon Free storage: **0.5 GB** per project on the plans page vs *"1 GB/project"* in the pricing summary - confirm in the console.
- **Firebase Spark:** the pricing page now shows 50K MAU at no cost on Spark too; `PROPOSAL_Pricing` says Spark *"caps at
  3,000 daily active users"* - corrected there.
- BSP rate: site down (§1).
- Commercial use on free tiers: not stated (§3).

## §5 Calculations
**Workload** (from the prompt): A = 25 users, 3,000 API requests / peak day, 0.2 GB; B = 75 users, 10,000, 0.5 GB;
C = 400 users, 60,000, 3 GB. Working hours Mon–Fri 10 / 12 / 14 h. Jobs every 15 min + 1 nightly.

**Neon Free compute, stage A** (0.25 CU; suspend after 5 min idle; outside working hours the database is awake ~5 of every
*N* minutes; a month = 22 weekdays + 8 weekend days):
- 15-minute jobs: weekday 10 + 14 / 3 = 14.67 h, weekend 24 / 3 = 8 h → (22 × 14.67 + 8 × 8) × 0.25 = **96.7 CU-h** (a
  23-weekday month: 100.3) → **does not reliably fit the 100 CU-h**.
- 30-minute jobs: 10 + 14 / 6 = 12.33 h, weekend 4 h → **75.8 CU-h** ✔
- 60-minute jobs: 10 + 14 / 12 = 11.17 h, weekend 2 h → **65.4 CU-h** ✔
- Jobs in working hours only: 22 × 10 × 0.25 = **55 CU-h** (+0.6 for the nightly job) ✔
- Stage B (12 h days, 15-min jobs): (22 × 16 + 64) × 0.25 = **104 CU-h** → Launch: 104 × $0.106 = **$11.0** + 0.5 GB × $0.35
  = **≈ $11.2**; always on at 0.25 CU: 182.5 CU-h = $19.4.
- Stage C (assumption: 1 CU in working hours, 0.25 after hours): 22 × 14.83 + 8 × 2 = 342 CU-h × $0.106 = **$36.3** + 3 GB ×
  $0.35 = **≈ $37.4**.

**Cloud Run, stage C** (assumption: 100 ms of 1 vCPU and 512 MiB per request): 60,000 × 22 = 1.32 M requests (< 2 M);
132,000 vCPU-s (< 180,000 at Tier 1 rates - **Tier 2 uses the discount faster**, so this is close); 66,000 GiB-s
(< 360,000). Stage A / B are well inside the free tier.

**Email:** A ≈ 50 / day ≈ 1,500 / month → SES $0.15; B ≈ 6,000 → $0.60; C ≈ 45,000 → $4.50.

## §6 Recommendation: the cheapest all-Asia stack
| Stack (every server in Asia) | A pilot | B 1–3 companies | C 10 companies | Prices |
|---|---|---|---|---|
| ⭐ **Cloud Run Singapore (website + API) + Cloud Scheduler (3 jobs free) + Neon Singapore + Better Auth in Neon + SES Singapore** | **≈ $0.15 (₱10)** | **≈ $12 (₱790)** | **≈ $42–47 (₱2,770–3,100)** | Cloud Run Tier 2 + egress UNVERIFIED |
| Runner-up: Cloudflare Pages + Workers Paid (placed near the database) + Neon Singapore + Better Auth + SES | $5.15 (₱340) | $17 (₱1,120) | $47 (₱3,100) | all verified, flat |
| Vercel Pro `sin1` + Neon Singapore + Better Auth + SES | $20 (₱1,320) | $32 (₱2,110) | $62 (₱4,090) | verified |
| PH-hosted: AWS Manila EC2 + self-managed Postgres, or a local provider | quote | quote | quote | UNVERIFIED - not recommended |

Add **Neon Scale (~+$40 at C)** only if Daloy promises an uptime SLA. Neon: Free with jobs every 30 min at A, **Launch
before the first paying customer**.

**Decided (user, 8 Nov 2026, v1.1.0):** production moves off Vercel to **Cloud Run `asia-southeast1` behind Firebase
Hosting at `daloy.blueknight.xyz`**; **Vercel keeps the previews on Hobby** (the user accepts the commercial-use risk);
backend stays Apps Script until the Postgres steps. How: `docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md`.

**Recommendation:** ⭐ the Cloud Run Singapore stack - the cheapest at every stage, all in Singapore. If the UNVERIFIED Cloud
Run items (§4) come out worse, or containers are unwanted, take the Cloudflare runner-up ($5 more per month, all prices
verified).

**Catches of the recommended stack**
1. Two prices unverified (Cloud Run Tier 2 Singapore, egress) - check the Google pricing calculator first.
2. Google Cloud billing account with a card; the free tier is a spending discount → set budget alerts.
3. Containers (Dockerfile, Artifact Registry, a deploy pipeline). **No automatic per-branch preview links** like Vercel's
   (today's preview-before-push habit) - use Cloud Run revision tags instead.
4. Custom domain via Firebase Hosting (checked, §4): 60 s request limit, only the `__session` cookie passes; the address
   changes from `jarvis-by-erp.vercel.app` to `daloy.blueknight.xyz`.
5. Cold starts: Cloud Run scales to zero and Neon suspends after 5 min - the first request after idle is slower (not measured).
6. Neon Free suspends compute at its limit (never for a paying customer); **no uptime SLA below Neon Scale**.
7. Sign-in moves off Firebase - session security becomes ours (Better Auth).
8. SES sandbox (200 / 24 h) until production access; DKIM / SPF / DMARC set-up.
9. Leaving Vercel: `@vercel/speed-insights` (`src/App.js`), `api/appscript-proxy.js` and the deploy guide change.
10. **No Philippine hosting anywhere** in the stack: all data in Singapore = a transfer outside the Philippines (Data
    Privacy Act - §7).
11. Google sign-in still passes through Google (US / global) as the identity provider.

## §7 DPA, General Terms and Privacy Policy implications (recommended stack)
*To be reviewed by a lawyer before publishing; the edits are steps 7 and 11 of `docs/guides/CHECKLIST_Deploy_PostgresNeon_20261108.md`.*

| Document | Today (Vercel + Google Sheets + Firebase) | After the move |
|---|---|---|
| **DPA** (`src/config/legal/dpa.js`) | Annex C: Google LLC (Firebase Authentication - **US only**; Sheets / Apps Script - **no fixed region**), Vercel Inc. (functions default **iad1, US**). "Transfers outside the Philippines" still says `[[confirm the regions]]` - the honest answer today is **United States / not fixed** | Annex C: **Google LLC** - Cloud Run + Cloud Scheduler, `asia-southeast1` Singapore, and Google sign-in; **Neon** - database, AWS Singapore (AWS as Neon's sub-processor); **Amazon Web Services** - email (SES Singapore). Remove Vercel; remove Firebase when sign-in moves. Transfers → **Singapore** (+ the Google sign-in step). The **[[30]] days' notice of a new Sub-processor** goes to customer admins **before** the cutover. Deletion within [[90]] days must cover Neon history / backups (6 h Free, 7 days Launch) and SES logs. Security measures: "every request checked for a valid sign-in" now means a server session, not a Firebase token |
| **Privacy Policy** (`src/config/legal/privacy.js`) | Service providers: Google (Workspace / Sheets, Apps Script, Firebase Authentication, email sending) and Vercel. Transfers: `[[confirm the storage regions]]` → today **United States / not fixed**. Cookies: sign-in kept "through Google Firebase" | Providers → Google Cloud (Singapore), Neon (Singapore), AWS SES (Singapore), Google sign-in. Transfers → Singapore. Cookies → a session cookie set by our server. Retention incl. backup windows. DPO address unchanged |
| **General Terms** (`src/config/legal/terms.js`) | "Proof-of-concept status … Google Sheets through Google Apps Script"; Provider outages: Google (Workspace, Sheets, Apps Script, Firebase sign-in), Vercel | After the cutover: providers → Google Cloud, Neon, AWS; PoC clause rewritten. **No uptime promise beyond the providers'** (Neon has no SLA below Scale). §5.1b (provider price changes) already covers price moves. Customer-owned Sheet storage stays in the customer's own Google account - no Asia option there (their choice; say so) |
| **Status page** (`src/config/site.js` `STATUS`) | Google Workspace, Google Cloud, Firebase, Vercel | Google Cloud, Neon status, AWS Health; drop Vercel / Firebase after the move |

## §8 Re-check
- **Before committing to the stack:** the §4 UNVERIFIED items.
- **Before the first paying customer:** Neon Launch, Vercel plan (if still on Vercel), SES production access.
- **Every 3 months** (re-run `docs/guides/PROMPT_CheckHostingPricing.md`), on any provider pricing changelog, and **whether a
  Philippine region opens** (Neon, Vercel, Google Cloud, AWS, Azure - none today).

**Related:** `docs/guides/CHECKLIST_Deploy_PostgresNeon_20261108.md` (deploy steps on this stack),
`docs/planning/PLAN_Migration_NeonVercel_20261030.md`, `docs/planning/PROPOSAL_Pricing_20261102.md`,
`docs/planning/PLAN_ServerCore_OrgSheetBridge_20261101.md` §5a (O11).
