/**
 * Platform switch for the move off Apps Script / Google Sheets (docs/planning/PLAN_Migration_Unified_20261108.md).
 * User, 15 Nov 2026: "update status pages as well. ready all components when full migrate is complete".
 *
 * MIGRATION_COMPLETE - false until the full migration is done: the write cutover (2.4), the 2-week fallback (2.6) and
 * the retirement of Firebase Auth + the shared Apps Script deployment (3.4). Flip it to true in step 3.1, in the same
 * commit that publishes the legal texts (src/config/legal/*). Everything that names the platform's own stack reads it:
 *   - the public /status page (src/config/site.js STATUS) - the providers before / after the move
 *   - the backend labels of the admin diagnostics (backendInfo below). The API connection check reads the server's own
 *     answer, the X-Backend header (src/config/apiConfig.js checkAPIConnection), so a ping answered by Postgres says so
 *     even before the flag flips; the Admin page's fixed labels use the flag's default
 *
 * Previews (Vercel preview builds and local development) show the AFTER text of the public pages, so it can be
 * reviewed before 3.1 - the same rule as the legal drafts. Production (Cloud Run) shows the BEFORE text until the flag
 * flips.
 * Layer: config (no imports).
 */

export const MIGRATION_COMPLETE = false;

/** Vercel preview builds and local development (Create React App inlines both at build time). */
export const IS_PREVIEW_BUILD = process.env.NODE_ENV === 'development' || process.env.REACT_APP_VERCEL_ENV === 'preview';

/** Public wording (Status page): the after-migration stack in production once complete, and always on previews. */
export const SHOW_MIGRATED_STACK = MIGRATION_COMPLETE || IS_PREVIEW_BUILD;

/** True on previews while production still shows the old stack - pages add a "preview of the new stack" note. */
export const MIGRATED_STACK_PREVIEW = SHOW_MIGRATED_STACK && !MIGRATION_COMPLETE;

/**
 * What answered a request - the server's X-Backend header (api/_lib/rpcCore.js: pg; api/_lib/proxyCore.js: gas).
 * Sheets-option organizations (plan §2 / D7: own Sheet through the bridge, or a dedicated Apps Script instance) keep
 * "gas" after the migration, so the label comes from the answer, not from the flag.
 */
export const BACKENDS = {
  pg: {
    code: 'pg',
    label: 'Postgres - Neon, Singapore',
    name: 'Daloy server',
    store: 'Postgres on Neon, Singapore',
    host: 'Google Cloud Run, Singapore',
    consoleName: null,
    consoleUrl: null
  },
  gas: {
    code: 'gas',
    label: 'Google Sheets / Apps Script',
    name: 'Google Apps Script',
    store: 'Google Sheets',
    host: 'Google Apps Script',
    consoleName: 'Check Apps Script',
    consoleUrl: 'https://script.google.com/home'
  }
};

/** The backend for an X-Backend value; unknown / not answered yet → the platform default for this build. */
export const backendInfo = code => BACKENDS[code] || (MIGRATION_COMPLETE ? BACKENDS.pg : BACKENDS.gas);
