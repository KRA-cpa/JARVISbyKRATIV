import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import PlanCatalog from '../components/plans/PlanCatalog';
import { PROPOSED_PLANS_LIVE } from '../config/plansProposed';

/**
 * PlansPage - /plans, PUBLIC (AppScript v10.2, docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md)
 *
 * The Basic / Advanced / Enterprise catalogue - features and limits per plan - for anyone, signed in or not: it is
 * rendered from the display copy in src/config/plans.js and makes no API call (no sign-in needed). Signed-in users get
 * the app header, visitors the public one. Part of the future platform website.
 * PREVIEW builds (Vercel preview, local development) show the PROPOSED four-plan line-up (Basic / Basic+ / Advanced /
 * Enterprise - PLAN_PlanTiers U9) with a banner and a switch back to the live plans. Production shows the proposed
 * line-up while PROPOSED_PLANS_LIVE (src/config/plansProposed.js) is true, else the live catalogue; either way the server
 * decides what a company can do (compliance F1). Prices follow SHOW_PRICES (src/config/pricing.js).
 * Layer: page (imports shared + feature components only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
// Build-time flag (Create React App inlines it): Vercel exposes REACT_APP_VERCEL_ENV = production | preview | development
const IS_PREVIEW_BUILD = process.env.NODE_ENV === 'development' || process.env.REACT_APP_VERCEL_ENV === 'preview';

const PlansPage = () => {
  const { user, userRoles, isAuthenticated, loading } = useUser();
  const [showProposed, setShowProposed] = useState(true);
  // previews: the switch below; production: PROPOSED_PLANS_LIVE
  const proposed = IS_PREVIEW_BUILD ? showProposed : PROPOSED_PLANS_LIVE;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* review CR6-21: the public header while sign-in is still loading (it shows no button until Firebase answers) */}
      {isAuthenticated && !loading ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {IS_PREVIEW_BUILD && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100" role="note">
            <span>
              <strong>Preview.</strong>{' '}
              {proposed
                ? `Proposed plans (Basic+ with the Payroll and HR packs) - ${PROPOSED_PLANS_LIVE
                  ? 'production shows these too.' : 'not live yet; production shows the current plans.'}`
                : `Current plans (the server catalogue)${PROPOSED_PLANS_LIVE ? '.' : ', as live in production.'}`}
            </span>
            <button type="button" onClick={() => setShowProposed(!showProposed)}
              className="rounded-md border border-amber-400 bg-white px-3 py-1 font-medium hover:bg-amber-100 dark:border-amber-600 dark:bg-gray-800 dark:hover:bg-gray-700">
              {proposed ? 'Show current plans' : 'Show proposed plans'}
            </button>
          </div>
        )}
        <PlanCatalog signedIn={isAuthenticated} proposed={proposed} />
      </div>
      <Footer publicSite />
    </div>
  );
};

export default PlansPage;
