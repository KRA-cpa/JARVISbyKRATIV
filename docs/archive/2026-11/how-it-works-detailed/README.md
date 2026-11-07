# How it works - detailed version (archived 1 Nov 2026)

The first `/how-it-works` page (commit `afe0699`): six cards, each with a summary and four feature bullets, covering only
features live in AppScript v10.2. The user replaced it with a shorter page ("too detailed").

- `HowItWorksPage.js.txt` - the page component as it was (`src/pages/HowItWorksPage.js`)
- `site.HOW_IT_WORKS.js.txt` - its copy (`HOW_IT_WORKS` in `src/config/site.js`)

To restore it: copy both back (drop the `.txt`), replacing the current `HOW_IT_WORKS` export and page. The bullet lists
are also a ready source for a future detailed features page, or for the plans comparison.
