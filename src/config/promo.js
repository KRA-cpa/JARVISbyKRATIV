/**
 * Promotional banner (user, 2 Nov 2026: "founding customers banner in homepage - banner can be turned on/off; content can
 * be changed"). ONE banner shared by the home page and /plans, so both always say the same thing.
 *
 * To change it, edit this object and redeploy:
 *   - enabled   true / false. The Vercel env var REACT_APP_PROMO_BANNER = on | off overrides it (no code change; redeploy).
 *   - showOn    'preview' = Vercel previews + local development only (prices are not public yet - website decision W2);
 *               'all'     = production too (once prices are approved)
 *   - pages     where it appears: 'home', 'plans'
 *   - endsOn    optional last day 'YYYY-MM-DD' (company calendar, PH): from the next day it hides itself; '' = no end
 *   - badge, text, cta - the words. Keep the numbers in `text` in line with the founding price (PROPOSAL_Pricing PR5,
 *               src/config/plansProposed.js) and the current BSP rate.
 *   - cta.subject / cta.plan - the pre-filled email to sales (CONTACT.salesEmail); no button without a sales address
 * Layer: config (no imports).
 */

export const PROMO_BANNER = {
  enabled: true,
  showOn: 'preview', // 'preview' | 'all'
  pages: ['home', 'plans'],
  endsOn: '',
  badge: 'Founding customers',
  // headline first (user, 2 Nov 2026: "save x% as founding Basic+ customer"): ($35 - $29) / $35 = 17%
  text: 'Save 17% as a founding Basic+ customer: $29 / month (≈ ₱1,830) instead of $35 for your first 12 months. ' +
    'First 10 customers only.',
  cta: { label: 'Claim a founding spot', subject: 'Founding customer - Basic+', plan: 'Basic+ (founding customer)' }
};
