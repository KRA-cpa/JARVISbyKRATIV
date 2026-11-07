/**
 * Promotional banner (user, 2 Nov 2026: "founding customers banner in homepage - banner can be turned on/off; content can
 * be changed"). ONE banner shared by the home page and /plans, so both always say the same thing.
 *
 * To change it, edit this object and redeploy:
 *   - enabled   true / false. The Vercel env var REACT_APP_PROMO_BANNER = on | off overrides it (no code change; redeploy).
 *   - showOn    'preview' = Vercel previews + local development only;
 *               'all'     = production too (safe while prices are hidden: the text then has the % saving only)
 *   - pages     where it appears: 'home', 'plans'
 *   - endsOn    optional last day 'YYYY-MM-DD' (company calendar, PH): from the next day it hides itself; '' = no end
 *   - badge, text, cta - the words. Keep the numbers in `text` in line with the founding price (PROPOSAL_Pricing PR5,
 *               src/config/plansProposed.js) and the current BSP rate.
 *   - cta.subject / cta.plan - the pre-filled email to sales (CONTACT.salesEmail); no button without a sales address
 *   - text follows the price switch SHOW_PRICES (src/config/pricing.js; user, 8 Nov 2026: "leave the banner, wired to
 *               the prices toggle, retain the percentage savings"): true = `withPrices`, false = `withoutPrices` (the
 *               savings in % only, no amounts). Only the chosen line is in the build.
 * Layer: config (imports config/pricing only).
 */
import { SHOW_PRICES } from './pricing';

export const PROMO_BANNER = {
  enabled: true,
  showOn: 'all', // 'preview' | 'all' - 'all' from 8 Nov 2026 (user: "ready the 4 tier plan + promo banner to main3")
  pages: ['home', 'plans'],
  endsOn: '',
  badge: 'Founding customers',
  // headline first (user, 2 Nov 2026: "save x% as founding Basic+ customer"): ($35 - $29) / $35 = 17%
  text: SHOW_PRICES
    ? 'Save 17% as a founding Basic+ customer: $29 / month (≈ ₱1,830) instead of $35 for your first 12 months. ' +
      'First 10 customers only.' // withPrices
    : 'Save 17% as a founding Basic+ customer for your first 12 months. First 10 customers only.', // withoutPrices
  cta: { label: 'Claim a founding spot', subject: 'Founding customer - Basic+', plan: 'Basic+ (founding customer)' }
};
