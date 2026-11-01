import React from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import Icons from '../components/shared/Icons';
import { PLAN_ORDER, PLAN_NAMES } from '../config/plans';

/**
 * HomePage - "/" for visitors who aren't signed in (signed-in users go to /dashboard - SmartRedirect in App.js).
 * PLACEHOLDER for the platform website (docs/planning/PLAN_PlatformWebsite_20261101.md W1): brand, one line, and links to
 * /plans and /login. Static: no API call, so no sign-in is needed.
 * Layer: page (imports shared components + config only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const HomePage = () => (
  <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
    <PublicHeader />
    <main className="flex-1 flex items-center">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Icons.Ticket size={48} className="mx-auto text-blue-600" />
        <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">TicketFlow</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          Ticketing and workflow orchestration for every company: forms, approval chains, SLAs and reports, set up without code.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Plans: {PLAN_ORDER.map(plan => PLAN_NAMES[plan]).join(' · ')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
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
    </main>
    <Footer />
  </div>
);

export default HomePage;
