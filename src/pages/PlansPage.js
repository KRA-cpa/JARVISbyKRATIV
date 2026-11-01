import React from 'react';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import PlanCatalog from '../components/plans/PlanCatalog';

/**
 * PlansPage - /plans, PUBLIC (AppScript v10.2, docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md)
 *
 * The Basic / Advanced / Enterprise catalogue - features and limits per plan - for anyone, signed in or not: it is
 * rendered from the display copy in src/config/plans.js and makes no API call (no sign-in needed). Signed-in users get
 * the app header, visitors the public one. Part of the future platform website.
 * Layer: page (imports shared + feature components only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const PlansPage = () => {
  const { user, userRoles, isAuthenticated, loading } = useUser();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* review CR6-21: the public header while sign-in is still loading (it shows no button until Firebase answers) */}
      {isAuthenticated && !loading ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlanCatalog signedIn={isAuthenticated} />
      </div>
      <Footer publicSite />
    </div>
  );
};

export default PlansPage;
