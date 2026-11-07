<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_Deploy_CloudRun_FirebaseHosting.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 8 November 2026 UTC+8 (Philippine Standard Time) | Modified: 8 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Move PRODUCTION from Vercel to Google Cloud Run (asia-southeast1, Singapore) behind Firebase Hosting at daloy.blueknight.xyz; Vercel keeps the previews. Backend unchanged (Apps Script) - the Postgres move follows CHECKLIST_Deploy_PostgresNeon_20261108.md | Status: Ready to run (nothing deployed yet) - the runbook for Phase H of docs/planning/PLAN_Migration_Unified_20261108.md
REVISION HISTORY:
- v1.1.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Runbook for Phase H of PLAN_Migration_Unified_20261108.md; step D also updates Claude.md working rule 3 + the deploy-check memory
- v1.0.0 | 8 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 61523343). User decisions: production off Vercel, previews on Vercel Hobby (commercial-use risk accepted), domain blueknight.xyz (subdomain daloy.); Firebase Hosting as the front door (Cloud Run domain mapping is Preview, "not production-ready")
===============================================================================
-->

# GUIDE — Production on Cloud Run + Firebase Hosting, previews on Vercel

```
Production:  https://daloy.blueknight.xyz ─► Firebase Hosting (static build, CDN)
                                              └─ /api/** ─► Cloud Run "daloy" (asia-southeast1) ─► Apps Script ─► Sheet
Previews:    git push <branch> ─► Vercel preview ─► jarvis-by-erp.vercel.app/api/appscript-proxy ─► Apps Script
Old URL:     jarvis-by-erp.vercel.app/<page> ─► redirect to daloy.blueknight.xyz/<page>  (its /api/* keeps working)
```

**What runs where:** `server/app.js` serves the same proxy as Vercel (`api/_lib/proxyCore.js` - Firebase token check,
identity fields stripped, `PROXY_SECRET` added) plus the React build; `Dockerfile` builds the image;
`scripts/deploy-cloudrun.sh` builds and deploys; `firebase.json` / `.firebaserc` configure Hosting (project
`jarvisbyerp`, the same Firebase project as sign-in). Tests: `node scripts/test-cloudrun-server.js` (13) and
`node scripts/test-proxy-auth.js` (26).

**Why this front door** (`docs/planning/CHECK_HostingPricing_20261108.md`): Cloud Run's own domain mapping exists in
`asia-southeast1` but is *"in the preview launch stage … not production-ready"* with latency issues; a load balancer costs
extra; **Firebase Hosting** rewrites to Cloud Run in `asia-southeast1`, includes 10 GB storage + 360 MB / day transfer at
no cost (then $0.15 / GB), and needs the Blaze plan (billing) - which Cloud Run needs anyway.

**Owner:** **You** = console / DNS / passwords; **Claude** = code, deploy commands (after your go), checks.

---

## A. One-time set-up (You, ~30 min)
- [ ] **Billing:** Firebase console → project `jarvisbyerp` → upgrade to **Blaze**; Google Cloud console → Billing →
      **Budgets & alerts**: e.g. $5 / $20 / $50 alerts.
- [ ] **CLIs** (in your own terminal): Google Cloud SDK (`gcloud`) and `npm install -g firebase-tools`. Then in this
      Claude session: `! gcloud auth login`, `! gcloud config set project jarvisbyerp`, `! firebase login`.
- [ ] **APIs:** `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com`
- [ ] **Secrets** - the same values as Vercel production (Vercel → Settings → Environment Variables). Typed at a hidden
      prompt, never on a command line (compliance S2):
      ```bash
      read -rs S && printf '%s' "$S" | gcloud secrets create daloy-proxy-secret --data-file=- ; unset S
      read -rs S && printf '%s' "$S" | gcloud secrets create daloy-apps-script-url --data-file=- ; unset S
      ```
- [ ] **Let Cloud Run read them** (the default runtime account):
      ```bash
      SA="$(gcloud projects describe jarvisbyerp --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
      for s in daloy-proxy-secret daloy-apps-script-url; do
        gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
      done
      ```
- [ ] **Note production's `AUTH_MODE`** (Vercel env) - every deploy passes it explicitly.

## B. Test revision (Claude deploys, You check)
- [ ] `AUTH_MODE=<production value> scripts/deploy-cloudrun.sh test first` - builds (minutes on Z:), deploys a revision
      tagged `first` and prints its URL (`https://first---daloy-….a.run.app`).
- [ ] **You:** Firebase → Authentication → Settings → **Authorized domains** → add that host (for sign-in on it).
- [ ] **You:** open it, sign in, open the dashboard, a ticket, `/plans`, `/privacy`. ⚠️ It talks to the **production**
      Apps Script (same as the live site) - test with reads or seed data only.
- [ ] **Claude:** `gcloud run services logs read daloy --region asia-southeast1 --limit 50` - one JSON line per request
      (`action, duration_ms, user_id, auth, status, backend`), as on Vercel.
- **Gate:** sign-in works, `auth: verified` in the logs, no 5xx.

## C. Domain and production (You + Claude)
- [ ] **Claude:** `AUTH_MODE=<value> scripts/deploy-cloudrun.sh production` - all traffic to the tested revision +
      `firebase deploy --only hosting` → live at `https://jarvisbyerp.web.app` first.
- [ ] **You:** Firebase → Hosting → **Add custom domain** `daloy.blueknight.xyz` → add the records it shows at the DNS
      host of blueknight.xyz. **Leave the MX / forwarding records alone** (KRATIV.sales@ / KRATIV.dpo@). Wait for the
      certificate (Hosting shows it).
- [ ] **You:** Firebase → Authentication → Authorized domains → add `daloy.blueknight.xyz`.
- [ ] **You:** Apps Script editor → Project Settings → Script Properties → `APP_URL = https://daloy.blueknight.xyz`
      (links in notification emails).
- [ ] **Claude + You:** check `https://daloy.blueknight.xyz`: sign in, dashboard, one write on seed data, `/plans`,
      `/status`; `curl -sI "https://daloy.blueknight.xyz/api/appscript-proxy?action=ping"` → `x-backend: gas`,
      `cache-control: no-store`.
- **Gate:** the new domain works end to end.

## D. Switch Vercel to previews only (Claude commits, You push + change one setting)
1. [ ] **Claude** adds this `vercel.json` (only now - committed earlier it would redirect visitors before the new
       domain exists):
       ```json
       {
         "redirects": [
           {
             "source": "/:path((?!api/).*)",
             "has": [{ "type": "host", "value": "jarvis-by-erp.vercel.app" }],
             "destination": "https://daloy.blueknight.xyz/:path",
             "permanent": false
           }
         ]
       }
       ```
       Only the old production host redirects (previews have other hosts); `/api/*` is excluded so previews and open
       tabs keep their proxy.
2. [ ] **You:** "push" → main3 deploys **one last** Vercel production build with the redirect. Check
       `https://jarvis-by-erp.vercel.app/plans` → lands on `daloy.blueknight.xyz/plans`.
3. [ ] **You:** Vercel → Settings → Git → **Production Branch** → `vercel-production-retired` (a branch that doesn't
       exist). From now on pushes only make **previews**; the last production deployment (redirect + `/api`) stays.
4. [ ] Switch the redirect to `"permanent": true` after a week without problems.
5. [ ] **Claude:** update `Claude.md` working rule 3 ("one Vercel check" → the Cloud Run deploy + a check of
       `daloy.blueknight.xyz`) and the memory `feedback_batch_then_deploy_check`; tick Phase H in
       `PLAN_Migration_Unified_20261108.md` §8.

**From then on:** production = `scripts/deploy-cloudrun.sh production` (Claude runs it when you say "push" / "deploy");
previews = push a branch (Vercel); the preview-link-before-push habit is unchanged.

## E. Rollback
- **One bad revision:** `gcloud run services update-traffic daloy --region asia-southeast1 --to-revisions <previous>=100`
  (Cloud Run console → Revisions shows the names).
- **The whole move:** Vercel → Production Branch back to `main3`, remove `vercel.json`, push → `jarvis-by-erp.vercel.app`
  serves production again (its proxy never stopped). The Firebase domain can stay.

## F. Catches (also in CHECK_HostingPricing §6)
- Firebase Hosting: **60-second** limit per request (the app's own timeout is 45 s); only the **`__session`** cookie
  reaches Cloud Run (*"Only the specially-named `__session` cookie is permitted to pass through"*) - Better Auth must
  use that name later; the `Authorization` header passes and is part of the cache key.
- Test revisions and production share the **same Apps Script data**.
- Cold start: min instances 0 - the first request after idle is slower. `--max-instances 3` caps cost.
- Previews on **Vercel Hobby**: the user accepts the commercial-use risk (Vercel: commercial = *"any Deployment that is used
  for the purpose of financial gain of anyone involved in any part of the production"*). Preview API calls still go
  through the old Vercel function (Washington `iad1`, US) - preview traffic only.
- Firebase Hosting's file storage location isn't stated (served from Google's CDN); the API and data path is Singapore +
  Apps Script.
- Legal pages (DPA Annex C, Privacy providers, `/status`): Google Cloud joins, Vercel stays for previews only - update at
  CHECKLIST_Deploy_PostgresNeon step 11 (`CHECK_HostingPricing` §7).
