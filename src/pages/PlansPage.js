import React from 'react';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import Footer from '../components/shared/Footer';
import PlanCatalog from '../components/plans/PlanCatalog';

/**
 * PlansPage - /plans (AppScript v10.2, docs/planning/PLAN_PlanTiers_Subscriptions_20261031.md)
 *
 * The Basic / Advanced / Enterprise catalogue - features and limits per plan - and the plans of the user's companies.
 * Layer: page (imports shared + feature components only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const PlansPage = () => {
  const { user, userRoles } = useUser();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Header user={user} userRole={userRoles?.[0]?.name} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlanCatalog />
      </div>
      <Footer />
    </div>
  );
};

export default PlansPage;
