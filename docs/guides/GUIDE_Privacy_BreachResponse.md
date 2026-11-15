<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_Privacy_BreachResponse.md | Author: Kenneth R. Advento | Version: 0.1 (DRAFT)
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Personal data breach runbook - any breach, at KRAtiv or a provider: detect, contain, assess, notify, document, review (DPA Sec. 20(f); NPC Circular 16-03 or its successor) | Status: DRAFT - for the DPO / counsel
REVISION HISTORY:
- v0.1 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Draft by Claude (session 461f9ea9) - privacy plan §9; links the provider templates and the sign-in tools built today
===============================================================================
-->

# GUIDE — Personal data breach response (DRAFT)

> A breach = any security incident that leads to personal data being lost, changed, disclosed or accessed without
> authority, or being unavailable when needed. When in doubt, treat it as one and start at step 1.
> Times in UTC+8. Keep every step's time in the incident record.

## Who
Breach response team (Privacy Manual §6): the **DPO** (lead), the **head of KRAtiv** (decisions, notices),
[[technical lead]] (containment). Anyone who notices something tells the DPO immediately.

## 1. Record and start the clock (within 1 hour)
- Open an incident record [[where - Privacy Manual §9]]: reference `INC-YYYY-NNN`, who reported, what, when noticed.
- **The clock starts when KRAtiv knows** (or should have known): [[24]] h to tell affected customer organizations
  (DPA contract); **72 h** to tell the NPC and the affected people when KRAtiv is the controller and the breach is
  notifiable (step 4).

## 2. Contain (as fast as possible)
- **Who is signed in:** `scripts/list-signed-in.sh` (read-only).
- **Sign everyone out:** `scripts/revoke-sessions.sh` → `--apply` (needs `AUTH_MODE=enforce`); check again with
  `list-signed-in.sh`. Deploy guide §H.
- **Rotate secrets** that may be exposed: Secret Manager new version (`daloy-proxy-secret` + the Apps Script Script
  Property `PROXY_SECRET` together; the Neon password / `DATABASE_URL`), then redeploy.
- **Disable accounts** involved (Admin → Users; Firebase / sign-in provider); remove platform access (Privacy Manual §4).
- **Stop the leak:** take the affected route or feature offline; for a maintenance window tell users
  (`public/announcements.json`, deploy guide §I).
- Preserve evidence: export the relevant Cloud Logging entries before their 30 days run out.

## 3. Assess (within 24 h)
- What data, whose (organizations, number of people), sensitive information or data that enables identity fraud?
- Cause, how long, still ongoing? Encrypted / masked (Restricted fields)?
- Likely harm to the people: real risk of serious harm?
- **Whose data:** processor data (a customer's tickets / users) → the customer organization is the controller and
  decides on notifying the NPC and its people; KRAtiv's own data → KRAtiv decides.

## 4. Notify
| To | When | How |
|---|---|---|
| Each affected customer organization | within [[24]] h of knowing, even with facts incomplete | provider incident: template A / B / B2 (`TEMPLATE_BreachNotice_ProviderIncident_20261115.md`); KRAtiv incident: same structure, template B wording; email + sign-in banner (`src/config/notices.js`) |
| NPC | within **72 h**, when KRAtiv is the controller and the breach involves sensitive information or data enabling identity fraud and is likely to cause real risk of serious harm | NPC's breach notification channel [[current form / portal - counsel]]; content: nature, data, people, measures, DPO contact |
| Affected people (KRAtiv's own data) | within 72 h, same test | email; public notice (template P, decision D1) only if they can't be reached individually or the NPC asks |
| Customers' NPC notices | the customer's duty; KRAtiv supplies facts and drafts on request | - |
Before any public notice: send PE to the organizations first (template PE).

## 5. Document
Incident record (template §4): timeline (template §6 stages), data and people involved, decisions and why,
notices sent (to whom, when), containment, evidence locations, lessons.
Admin → Security Notices keeps the customer-facing notices.

## 6. Review (within 2 weeks of closing)
Root cause; what to change (code, process, provider); update the PIA risks and this guide. Note every incident for
the **annual security incident report** to the NPC [[confirm the current requirement and deadline]].

## Related
Privacy Manual §6; DPA contract "Personal Data Breaches"; Privacy Policy "If a personal data breach happens"
(text reviewed separately); deploy guide §H (sessions) and §I (announcements).
