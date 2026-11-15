import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import { Body, WithBlanks } from './LegalPage';
import { noticeById, noticeForCompanies, isPublicVisible } from '../config/notices';
import { formatDateTime } from '../utils/dateTime';

/**
 * NoticePage - the full notice from src/config/notices.js (wording docs/planning/TEMPLATE_BreachNotice_ProviderIncident_20261115.md).
 *   - /notices/:id (App.js ProtectedRoute): the notice the sign-in banner links to - signed-in users of the organizations
 *     addressed; readable after the banner's 7 days too (the email may link here). Others: answers like a missing one.
 *   - /notices/:id/public (publicView, open to everyone): the PUBLIC version (template P), only when the notice has
 *     public: true - on previews also before that, marked "not published", for review. User, 15 Nov 2026: no public
 *     breach page by default, but "public notice must be readily available for publishing".
 * Static: no API call. Layer: page (shared components, config, utils).
 * @param {boolean} publicView - true on /notices/:id/public
 */

const BADGES = {
  A: { text: 'Security notice', cls: 'bg-blue-600' },
  B: { text: 'Important', cls: 'bg-red-600' },
  B2: { text: 'Update', cls: 'bg-amber-600' }
};

const Note = ({ title, children }) => (
  <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{children}</p>
  </div>
);

const NoticePage = ({ publicView = false }) => {
  const { id } = useParams();
  const { user, userRoles, userCompanies, isAuthenticated, loading } = useUser();
  const found = noticeById(id);
  const notice = !found ? null
    : publicView ? (isPublicVisible(found) ? found : null)
      : (noticeForCompanies(found, (userCompanies || []).map(c => c.id)) ? found : null);
  const badge = notice ? BADGES[notice.template] || BADGES.A : null;
  const title = notice ? (publicView ? notice.publicTitle : notice.title) : '';
  const sections = notice ? (publicView ? notice.publicSections : notice.sections) : [];
  const signedIn = isAuthenticated && !loading;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {signedIn ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {!notice ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notice not found</h1>
              <p className="mt-3 text-gray-700 dark:text-gray-200">
                This notice doesn't exist{publicView ? ' or isn\'t public' : ' or isn\'t addressed to your organization'}.
                Questions: our Data Protection Officer at KRATIV.dpo@blueknight.xyz.
              </p>
            </>
          ) : (
            <>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${badge.cls}`}>
                {badge.text}
              </span>
              <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white"><WithBlanks text={title} /></h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Reference {notice.id}
                {notice.postedAt && <> · Posted {formatDateTime(notice.postedAt)}</>}
              </p>
              {notice.sample && (
                <Note title="Sample - previews only">This shows how a notice will look. Highlighted items are filled in per incident.</Note>
              )}
              {publicView && notice.public !== true && (
                <Note title="Public version - not published">
                  Ready to publish: set public: true on this notice (src/config/notices.js) and deploy. Until then only
                  previews show this page.
                </Note>
              )}
              {sections.map(s => (
                <section key={s.id} id={s.id} className="mt-8">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{s.heading}</h2>
                  <div className="text-gray-700 dark:text-gray-200 leading-relaxed"><Body text={s.body} /></div>
                </section>
              ))}
            </>
          )}
          <p className="mt-10">
            {publicView
              ? <Link to="/status" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Service status</Link>
              : <Link to="/dashboard" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Back to the dashboard</Link>}
          </p>
        </article>
      </main>
      <Footer publicSite={publicView} />
    </div>
  );
};

export default NoticePage;
