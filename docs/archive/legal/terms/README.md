# Terms of Service - version archive

One Markdown snapshot per version, **never edited after it is added** (user, 1 Nov 2026: "archive each version of terms").

| File | Version | Status | Last updated |
|---|---|---|---|
| `TERMS_v0.5_20261101.md` | 0.5 | Draft (first version shown, on previews; not in effect) | 1 Nov 2026 |

**When the Terms change:** add `TERMS_v<version>_<YYYYMMDD>.md` here (a copy of `docs/planning/DRAFT_TermsOfService_*.md`
or the published text), copy the replaced version's object unchanged into `src/config/legal/termsArchive.js`
(with `supersededOn`), then update `src/config/legal/terms.js` (version, lastUpdated). The in-app history is
`/terms/versions`; a customer's acceptance record points to the version it accepted.

Drafts 0.1-0.4 were working drafts (never shown); their history is in git and in the draft's revision history.
