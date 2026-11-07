import React from 'react';
import { PROMO_BANNER } from '../../config/promo';
import { CONTACT, contactMailto } from '../../config/site';
import { DEFAULT_ZONE, todayInZone } from '../../utils/dateTime';

/**
 * PromoBanner - the promotional banner from src/config/promo.js (on / off, where, words), for the home page and /plans.
 * Off when: enabled is false (or REACT_APP_PROMO_BANNER=off), the page isn't listed, showOn is 'preview' in a production
 * build, endsOn has passed, or the text is empty. The words follow the price switch (promo.js text / SHOW_PRICES). The CTA is a pre-filled email to sales (hidden without a sales address - compliance F4).
 * Static: no API call. Layer: shared component (config + utils).
 * @param {string} page - 'home' | 'plans'
 */

// Build-time flags (Create React App inlines them): Vercel exposes REACT_APP_VERCEL_ENV = production | preview | development
const IS_PREVIEW_BUILD = process.env.NODE_ENV === 'development' || process.env.REACT_APP_VERCEL_ENV === 'preview';
const ENV_SWITCH = String(process.env.REACT_APP_PROMO_BANNER || '').trim().toLowerCase(); // 'on' | 'off' | ''

/** Today as a calendar day in the platform's default zone (Philippines) - the banner's end date (compliance F3 v3). */
const todayDay = () => todayInZone(DEFAULT_ZONE);

export const isPromoVisible = (page, banner = PROMO_BANNER) => {
  const enabled = ENV_SWITCH === 'on' ? true : ENV_SWITCH === 'off' ? false : Boolean(banner.enabled);
  if (!enabled || !banner.pages.includes(page)) return false;
  if (!banner.text) return false;
  if (banner.showOn !== 'all' && !IS_PREVIEW_BUILD) return false;
  return !(banner.endsOn && todayDay() > banner.endsOn);
};

const PromoBanner = ({ page, className = '' }) => {
  if (!isPromoVisible(page)) return null;
  const b = PROMO_BANNER;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-50 ${className}`} role="note">
      <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">{b.badge}</span>
      <span className="font-medium">{b.text}</span>
      {CONTACT.salesEmail && b.cta && (
        <a href={contactMailto(CONTACT.salesEmail, b.cta.subject, b.cta.plan)}
          className="ml-auto rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
          {b.cta.label}
        </a>
      )}
    </div>
  );
};

export default PromoBanner;
