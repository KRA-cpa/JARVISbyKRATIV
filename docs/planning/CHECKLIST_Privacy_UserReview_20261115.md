<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: CHECKLIST_Privacy_UserReview_20261115.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: YOUR checklist - every privacy item you need to review, decide, provide, sign or set up; Claude's items are done (CHECK_PrivacyCompliance_20261115.md) | Status: Open
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "do all items c/o Claude. create checklist doc that i need to review/finalize"
===============================================================================
-->

# CHECKLIST — Privacy items for you to review / finalize

How to answer: reply with the number and **ok** (keep the default), **no** + what instead, or **skip** (later).
Tick the box when done. Full status of every requirement: `CHECK_PrivacyCompliance_20261115.md`.
Out of scope here: the text review of the Privacy Policy, the DPA and the Terms (counsel / DPO, separate).

## A. Decide (default applied - veto any)
| ✓ | # | Decision | Default (already applied) | Where |
|---|---|---|---|---|
| ☐ | A1 | "Exclude Vercel in any platforms we use" read as: Vercel processes **no** customer / user data, is on **no** provider list, no Vercel service in the app; it only hosts internal previews on **test** data | applied: DPA v0.4 Annex C, Privacy Policy providers, `/status`, disclosure v1.0.1, Speed Insights removed | CHECK §2 |
| ☐ | A2 | **No consent checkbox** for users - notice + "Continue" at first sign-in, recorded; shown again when the policy version changes. Organization admins: checkbox "I accept the General Terms and the DPA for {organization}", recorded | built (server part runs with the database in production) | CHECK #10 |
| ☐ | A3 | Analytics: none. Usage / performance jobs read ids and timestamps only, totals only. Wording: *"Usage and performance figures are counts. They are computed from record ids and timestamps only; no ticket content and no sensitive personal information is read, and the results identify no one."* | in the manual §2 and the PIA | CHECK §4 |
| ☐ | A4 | NPC registration: **not required today**; recheck at the first paying customer / ~1,000 people with sensitive information / yearly | assessed | CHECK §3 |
| ☐ | A5 | Retention periods: tickets = subscription + customer's instruction (deleted ≤ 90 days after the end); outbox 90 days; security logs 1 year; request logs 30 days; billing per BIR | job built with these values (dry run by default) | privacy plan §5; `scripts/db-retention.js` |
| ☐ | A6 | Profile fields `phone`, `hire_date`, `termination_date`: keep (approval routing / access end) | kept | PIA §3 |
| ☐ | A7 | Invitation emails get the privacy link **when invites move to the server** (Apps Script stays frozen) | waiting | CHECK #9 |
| ☐ | A8 | Until the server is live: incident records and the rights-request log in a private sheet in your Drive, columns as in the rights guide §1 | - | breach guide §1; rights guide §1 |
| ☐ | A9 | Rights-request log kept 3 years; requests answered in 15 working days | in the guide | rights guide |

## B. Provide / appoint
| ✓ | # | Item | Done when |
|---|---|---|---|
| ☐ | B1 | **DPO**: name or title, mailing address, phone; a short appointment letter (signed by you) | filled into the manual §1, PIA §8, breach guide; Claude updates the `[[...]]` |
| ☐ | B2 | Breach team **technical lead** (can be you) | manual §6 |
| ☐ | B3 | Where the incident record and request log live (A8) | link sent to Claude (not the content) |

## C. Sign / adopt
| ✓ | # | Document | Where to sign |
|---|---|---|---|
| ☐ | C1 | Privacy Impact Assessment (draft v0.1) - read, correct, sign | `docs/planning/PIA_Daloy_20261115.md` §8 |
| ☐ | C2 | Privacy Manual (draft v0.1) - read, correct, adopt | `docs/guides/MANUAL_Privacy_Security_20261115.md` §10 |
| ☐ | C3 | Confidentiality undertaking - you, and anyone else with access | manual §5 (text to copy) |
| ☐ | C4 | Training date recorded (you: reading the manual + both guides counts) | manual §5 |
| ☐ | C5 | Breach runbook and rights guide (drafts) - read, correct | `docs/guides/GUIDE_Privacy_BreachResponse.md`, `GUIDE_Privacy_RightsRequests.md` |

## D. Set up (one action each)
| ✓ | # | Item | Guide |
|---|---|---|---|
| ☐ | D1 | **2-step verification** on every Google account with platform / Google Cloud / Firebase / Neon access | Google Account → Security → 2-Step Verification |
| ☐ | D2 | **Previews on test data**: test Sheet + SEED + its web app + 2 Vercel Preview env vars | `docs/guides/GUIDE_Previews_TestData.md` |
| ☐ | D3 | Firebase authorized domain: `jarvisbykrativity-git-preview-3623d2-kenneths-projects-bf949001.vercel.app` (or say "ok" and Claude adds it) | Firebase Console → Authentication → Settings |
| ☐ | D4 | Cloud Logging bucket region → Singapore before step 3.1 (say "ok" and Claude does it) | migration plan |
| ☐ | D5 | First quarterly **access review** (Google Cloud, Firebase, Neon, Vercel team members, Secret Manager) - record date + changes | manual §4 |

## E. Counsel (confirm the current rules)
| ✓ | # | Question |
|---|---|---|
| ☐ | E1 | Current NPC issuances: breach management (Circular 16-03 or successor), registration (Circular 2022-04), DPO (Advisory 2017-01), PIA (Advisory 2017-03), data sharing (Circular 2020-03) |
| ☐ | E2 | Breach clocks: 72 h to the NPC / people; [[24]] h processor → customer; the annual security incident report |
| ☐ | E3 | Rights-request deadline (15 working days?) and the BIR record-keeping period for billing |
| ☐ | E4 | The legal texts (Privacy Policy, DPA, Terms) - separate review |

## F. Ship
| ✓ | # | Item |
|---|---|---|
| ☐ | F1 | Review on the preview: sign-in page links; privacy notice after sign-in; Admin → Organization terms; Profile → Download my data; `/status` (Google only) |
| ☐ | F2 | Say **"push"** for `main3`; the server parts go live with migration Phase 4 (`DATABASE_URL` in production) |
