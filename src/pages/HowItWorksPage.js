import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import Icons from '../components/shared/Icons';
import { HOW_IT_WORKS } from '../config/site';

/**
 * HowItWorksPage - /how-it-works (and /features), PUBLIC (docs/planning/PLAN_PlatformWebsite_20261101.md W1, "/features").
 * Four short steps - form, approvers, on time, done - in a row from md up (joined by a line), stacked on phones; then the
 * plans / contact call to action. Copy in src/config/site.js. The first, detailed version is archived in
 * docs/archive/2026-11/how-it-works-detailed/. Static: no API call, so no sign-in is needed.
 * Layer: page (imports shared components + config only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const HowItWorksPage = () => {
  const { user, userRoles, isAuthenticated, loading } = useUser();
  const page = HOW_IT_WORKS;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {isAuthenticated && !loading ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <header className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{page.title}</h1>
            <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{page.intro}</p>
          </header>

          <ol className="relative mt-12 grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-6">
            {/* the line joining the steps (md up), behind the icons */}
            <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-0.5 bg-gray-300 dark:bg-gray-600 md:block" />
            {page.steps.map((step, index) => {
              const Icon = Icons[step.icon] || Icons.Ticket;
              return (
                <li key={step.id} className="relative flex items-start gap-4 md:flex-col md:items-center md:text-center">
                  <span aria-hidden="true"
                    className="inline-flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600 dark:bg-gray-900 dark:text-blue-300 dark:border-blue-400">
                    <Icon size={24} />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white md:mt-4">
                      <span className="text-gray-500 dark:text-gray-400">{index + 1}.</span> {step.heading}
                    </h2>
                    <p className="mt-1 text-gray-600 dark:text-gray-300">{step.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <section className="mt-14 rounded-xl bg-blue-600 px-6 py-8 text-center text-white sm:px-10" aria-labelledby="how-cta">
            <h2 id="how-cta" className="text-2xl font-bold">{page.ctaHeading}</h2>
            <p className="mx-auto mt-2 max-w-2xl text-blue-50">{page.ctaText}</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/plans"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
                <Icons.Shield size={16} />
                <span>See plans</span>
              </Link>
              <Link to="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/70 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700">
                <Icons.Comment size={16} />
                <span>Contact us</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HowItWorksPage;
