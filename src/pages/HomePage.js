import React from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import Icons from '../components/shared/Icons';
import { PLAN_ORDER, PLAN_NAMES } from '../config/plans';
import { PROPOSED_PLAN_ORDER, PROPOSED_PLAN_NAMES } from '../config/plansProposed';
import { BRAND_NAME, BRAND_PARENT_LINE, BRAND_TAGLINE, BRAND_MEANING } from '../config/site';
// Hero animation (docs/design/ticketflow-hero/, made in claude.ai): CSS-only SVG, no script; it stops on its final frame
// when the viewer asks for reduced motion. The app's dark mode is a class (tailwind darkMode: 'class'), so the fixed light
// / dark variants are swapped with dark: classes rather than the OS-following file.
import heroLight from '../assets/hero/ticketflow-hero-light.svg';
import heroDark from '../assets/hero/ticketflow-hero-dark.svg';

// Preview builds list the PROPOSED plans (Basic / Basic+ / Advanced / Enterprise - PLAN_PlanTiers U9), like /plans;
// production lists the live catalogue, which must match the server (compliance F1)
const IS_PREVIEW_BUILD = process.env.NODE_ENV === 'development' || process.env.REACT_APP_VERCEL_ENV === 'preview';
const HOME_PLANS = IS_PREVIEW_BUILD
  ? PROPOSED_PLAN_ORDER.map(plan => PROPOSED_PLAN_NAMES[plan]).join(' · ')
  : PLAN_ORDER.map(plan => PLAN_NAMES[plan]).join(' · ');

const HERO_ALT = 'Purchase request moving through Manager, Finance and Done approval, ending Approved';

/**
 * HomePage - "/" for visitors who aren't signed in (signed-in users go to /dashboard - SmartRedirect in App.js).
 * PLACEHOLDER for the platform website (docs/planning/PLAN_PlatformWebsite_20261101.md W1): the hero animation, brand, one
 * line, and links to /plans and /login. Static: no API call, so no sign-in is needed.
 * Layer: page (imports shared components + config only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const HomePage = () => (
  <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
    <PublicHeader />
    <main className="flex-1 flex items-center">
      {/* Text left, animation right from md up; on phones the text comes first, so the headline and the buttons stay
          above the fold and the animation follows */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center">
      <div className="text-center md:text-left">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">{BRAND_NAME}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{BRAND_MEANING} · {BRAND_PARENT_LINE}</p>
        <p className="mt-5 text-2xl sm:text-3xl font-semibold text-blue-700 dark:text-blue-300">{BRAND_TAGLINE}</p>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
          Ticketing for requests, tasks and approvals, set up without code. Every request follows a clear path to the right
          people, with deadlines and a full record.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Plans: {HOME_PLANS}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3">
          <Link to="/plans"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700">
            <Icons.Shield size={16} />
            <span>See plans</span>
          </Link>
          <Link to="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
            <Icons.Key size={16} />
            <span>Sign in</span>
          </Link>
        </div>
        <p className="mt-10 text-xs text-gray-400 dark:text-gray-500">Our full website is on its way.</p>
      </div>
      <div>
        <img src={heroLight} alt={HERO_ALT} width="560" height="280" className="mx-auto block h-auto w-full max-w-[560px] dark:hidden" />
        <img src={heroDark} alt={HERO_ALT} width="560" height="280" className="mx-auto hidden h-auto w-full max-w-[560px] dark:block" />
      </div>
      </div>
    </main>
    <Footer publicSite />
  </div>
);

export default HomePage;
