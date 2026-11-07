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
 * A ticket's life in six steps - set up, route, on time, informed, protect, report - rendered from src/config/site.js.
 * Static: no API call, so no sign-in is needed. Signed-in users get the app header, visitors the public one.
 * Layer: page (imports shared components + config only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const HowItWorksPage = () => {
  const { user, userRoles, isAuthenticated, loading } = useUser();
  const page = HOW_IT_WORKS;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {isAuthenticated && !loading ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <header className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{page.title}</h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{page.intro}</p>
          </header>

          <ol className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {page.steps.map((step, index) => {
              const Icon = Icons[step.icon] || Icons.Ticket;
              return (
                <li key={step.id} id={step.id}
                  className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                      <Icon size={20} />
                    </span>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      <span className="text-gray-500 dark:text-gray-400">{index + 1}.</span> {step.heading}
                    </h2>
                  </div>
                  <p className="mt-3 text-gray-700 dark:text-gray-200">{step.summary}</p>
                  <ul className="mt-3 space-y-2">
                    {step.points.map(point => (
                      <li key={point} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Icons.CheckCircle size={16} className="mt-0.5 flex-none text-green-600 dark:text-green-400" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>

          <section className="mt-12 rounded-xl bg-blue-600 px-6 py-8 text-white sm:px-10" aria-labelledby="how-cta">
            <h2 id="how-cta" className="text-2xl font-bold">{page.ctaHeading}</h2>
            <p className="mt-2 max-w-2xl text-blue-50">{page.ctaText}</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
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
