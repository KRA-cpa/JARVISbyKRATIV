<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: REF_Domain_KRAtivSolutions_20261109.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 9 November 2026 UTC+8 (Philippine Standard Time) | Modified: 9 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Domain decision (krativ.solutions over krativ.app) + checklist for putting it live on Google Cloud production | Status: Decided - domain not bought yet

REVISION HISTORY:
- v1.0.0 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session cdad6703). User: ".solutions is cheaper" (cart quotes below); "KRAtiv solutions was to be used for the trade name"; "vercel will be for preview builds moving forward, already using gcloud"
===============================================================================
-->

# REF — Domain: krativ.solutions

## 1. Decision

**`krativ.solutions`**. The company site goes on `krativ.solutions` and the product (Daloy) on `daloy.krativ.solutions`.
`krativ.app` was the other candidate.

## 2. Why

| Point | krativ.solutions | krativ.app |
|---|---|---|
| Year 1 (same registrar, user's carts, Nov 2026) | **₱560** (67% off ₱1,680) | ₱1,680 |
| Renewal (from Oct 2027) | ₱1,680/yr + tax | ₱1,680/yr + tax |
| 3-year cost | **₱3,920** | ₱5,040 |
| Matches the trade name | **Yes**: "KRAtiv Solutions" (DTI business name) | No |
| Length / reads as | Longer; company / business | Shorter; software product |
| HTTPS | Firebase Hosting issues TLS for any custom domain | Same (plus the HSTS preload, not needed) |

- The two cost the same on renewal, so .solutions is never more expensive and saves ₱1,120 in year 1.
- The domain is the same as the name on the DTI certificate, invoices, and the Terms / Privacy / DPA. A customer can
  check that the website and the contracting business are the same.
- The length is not a problem in practice, because users go to `daloy.krativ.solutions` or a bookmark.
- Email at `@krativ.solutions` replaces `@blueknight.xyz` for sales@ / dpo@. .xyz has a weak spam reputation; with
  SPF / DKIM / DMARC set up, the new address is fine for deliverability.

**Catches**
- Skip the cart's "free domain with a website plan" (₱590/mo). Hosting is Google Cloud.
- Before the Oct 2027 renewal, compare at-cost registrars (Cloudflare, Porkbun) and transfer if renewal is cheaper.
- Optional: buy `krativ.app` later only to redirect it, if it is cheap.

## 3. Hosting context

Production runs on **Google Cloud**: Firebase Hosting in project `krativ-daloy`, in front of Cloud Run in
`asia-southeast1`. **Vercel serves preview builds only**, so the domain does **not** go on Vercel. Sign-in stays in
Firebase project `jarvisbyerp` until Better Auth. Runbook: `docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md` §C,
which currently names `daloy.blueknight.xyz`.

## 4. Checklist once the domain is bought

- [ ] Buy `krativ.solutions` (1 year, no website plan).
- [ ] Firebase → project `krativ-daloy` → Hosting → **Add custom domain** `daloy.krativ.solutions`, plus the
      `krativ.solutions` apex (redirect or company site). Add the A / TXT records it shows at the registrar and wait
      for the certificate.
- [ ] Firebase → project **`jarvisbyerp`** → Authentication → Authorized domains → add `daloy.krativ.solutions`.
      Previews stay on `*.vercel.app`.
- [ ] Repo: replace the `daloy.blueknight.xyz` production host in the guide (purpose line, diagram, §C),
      `src/config/site.js` and `docs/planning/PLAN_Migration_Unified_20261108.md`. Bump the guide version.
- [ ] Email: set up forwarding or a mailbox for `sales@` / `dpo@krativ.solutions`, with SPF / DKIM / DMARC. Then
      change the addresses in `src/config/site.js` and `src/config/legal/{terms,privacy,dpa}.js` together, as a
      Terms change per §17.
- [ ] Legal entity (after the DTI registration): replace
      `KRATIV Solutions [[placeholder - confirm the registered name]]` in `src/config/legal/{terms,privacy,dpa}.js`
      with the trade name exactly as on the certificate, together with the owner. A sole proprietor contracts as
      "<owner name>, doing business under the name KRAtiv Solutions". Pick one case: the brand uses "KRAtiv"
      (`src/config/site.js:15`) and the legal text uses "KRATIV".

## 5. Verification

- `nslookup daloy.krativ.solutions` points to Firebase Hosting. The site loads over https. Google sign-in works on the
  new host.
- Send a test email to sales@ / dpo@, check that it arrives, and check SPF / DKIM / DMARC = pass in the headers.
