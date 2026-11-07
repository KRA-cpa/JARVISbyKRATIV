# General Terms of Service - version archive

One Markdown snapshot per version, **never edited after it is added** (user, 1 Nov 2026: "archive each version of terms").

| File | Version | Status | Last updated |
|---|---|---|---|
| `TERMS_v0.15_20261102.md` | 0.15 | Draft - DPO email KRATIV.dpo@blueknight.xyz (previews; not in effect) | 2 Nov 2026 |
| `TERMS_v0.14_20261102.md` | 0.14 | Draft - §5.1b price changes from the next billing cycle (previews; not in effect) | 2 Nov 2026 |
| `TERMS_v0.13_20261102.md` | 0.13 | Draft - §5.1a USD prices billed in PHP at last month's BSP rate (previews; not in effect) | 2 Nov 2026 |
| `TERMS_v0.12_20261101.md` | 0.12 | Draft - §5.3b late-payment penalty (previews; not in effect) | 1 Nov 2026 |
| `TERMS_v0.11_20261101.md` | 0.11 | Draft - §10.2 provider outages (previews; not in effect) | 1 Nov 2026 |
| `TERMS_v0.10_20261101.md` | 0.10 | Draft - §7.4a limited access to Customer-owned storage (previews; not in effect) | 1 Nov 2026 |
| `TERMS_v0.9_20261101.md` | 0.9 | Draft - §5.3a withholding agent status + CWT rates notice (previews; not in effect) | 1 Nov 2026 |
| `TERMS_v0.8_20261101.md` | 0.8 | Draft - §5.3a Philippine taxes (previews; not in effect) | 1 Nov 2026 |
| `TERMS_v0.7_20261101.md` | 0.7 | Draft - §3a Customer attestations (previews; not in effect) | 1 Nov 2026 |
| `TERMS_v0.6_20261101.md` | 0.6 | Draft - renamed "General Terms of Service"; DPA admin-only (previews; not in effect) | 1 Nov 2026 |
| `TERMS_v0.5_20261101.md` | 0.5 | Draft (first version shown, on previews; not in effect) | 1 Nov 2026 |

**When the Terms change:** add `TERMS_v<version>_<YYYYMMDD>.md` here (a copy of `docs/planning/DRAFT_TermsOfService_*.md`
or the published text), copy the replaced version's object unchanged into `src/config/legal/termsArchive.js`
(with `supersededOn`), then update `src/config/legal/terms.js` (version, lastUpdated). The in-app history is
`/terms/versions`; a customer's acceptance record points to the version it accepted.

Drafts 0.1-0.4 were working drafts (never shown); 0.5-0.15 were shown on previews only; their history is in git and in the draft's revision history.
