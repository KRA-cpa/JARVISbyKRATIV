/**
 * The default time zone (v10.1, compliance A17 v3 / F3 v3): the Philippines calendar - companies without a region,
 * and the v10.0 rule. The ONLY place in src/ that names it; everything else imports DEFAULT_ZONE (src/utils/dateTime.js
 * re-exports it). `npm run check:code-rules` flags the literal anywhere else.
 * Layer: config (no imports), so the API client and contexts can use it too.
 */
export const DEFAULT_ZONE = 'Asia/Manila';

/** The default country calendar (ISO 3166-1 alpha-2), matching the server's DEFAULT_COUNTRY. */
export const DEFAULT_COUNTRY = 'PH';
