import React from 'react';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import Icons from '../components/shared/Icons';
import { CONTACT, contactMailto } from '../config/site';

/**
 * ContactPage - /contact, PUBLIC (docs/planning/PLAN_PlatformWebsite_20261101.md §4, phase W1). "Request a trial" and
 * "Talk to us" are mailto: links to REACT_APP_CONTACT_EMAIL (decision W5), pre-filled with the details a reply needs;
 * nothing is sent or stored by the app. While the address isn't set, the buttons are hidden and the page says so
 * (compliance F4: no fake form). The W2 lead form replaces the mailto links later. Static: no API call.
 * Layer: page (imports shared components + config only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const ContactPage = () => {
  const { user, userRoles, isAuthenticated, loading } = useUser();
  const page = CONTACT;
  const hasSales = Boolean(page.salesEmail);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {isAuthenticated && !loading ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{page.title}</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{page.intro}</p>

          {hasSales ? (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {page.requests.map(request => {
                const Icon = Icons[request.icon] || Icons.Comment;
                return (
                  <section key={request.id} aria-labelledby={`contact-${request.id}`}
                    className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                        <Icon size={20} />
                      </span>
                      <h2 id={`contact-${request.id}`} className="text-lg font-semibold text-gray-900 dark:text-white">{request.heading}</h2>
                    </div>
                    <p className="mt-3 flex-1 text-gray-600 dark:text-gray-300">{request.text}</p>
                    <a href={contactMailto(page.salesEmail, request.subject)}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700">
                      <Icons.ExternalLink size={16} />
                      <span>{request.button}</span>
                    </a>
                  </section>
                );
              })}
              <p className="sm:col-span-2 text-sm text-gray-500 dark:text-gray-400">
                The buttons open your email app with a short form to fill in. You can also write to{' '}
                <a href={`mailto:${page.salesEmail}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{page.salesEmail}</a>.
              </p>
            </div>
          ) : (
            <p className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {page.salesMissing}
            </p>
          )}

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <section aria-labelledby="contact-customers">
              <h2 id="contact-customers" className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Icons.Users size={18} className="text-gray-500 dark:text-gray-400" />
                {page.customerHeading}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-300">{page.customerText}</p>
            </section>
            <section aria-labelledby="contact-privacy">
              <h2 id="contact-privacy" className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <Icons.Lock size={18} className="text-gray-500 dark:text-gray-400" />
                {page.privacyHeading}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                {page.privacyText}{' '}
                <a href={`mailto:${page.privacyEmail}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{page.privacyEmail}</a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;
