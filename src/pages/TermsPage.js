import React from 'react';
import { Link, useParams } from 'react-router-dom';
import LegalPage from './LegalPage';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import { TERMS_OF_SERVICE } from '../config/legal/terms';
import { TERMS_ARCHIVE } from '../config/legal/termsArchive';

/**
 * TermsPage - PUBLIC, no API call (docs/planning/DRAFT_TermsOfService_20261101.md):
 *   - /terms, /terms/draft      the current version (src/config/legal/terms.js) through LegalPage
 *   - /terms/versions           version history: the current version + every archived one
 *   - /terms/v/:version         an archived version, frozen (src/config/legal/termsArchive.js), marked "archived"
 * Archiving rule (user, 1 Nov 2026: "archive each version of terms"): before the text of a published version changes,
 * its object is copied unchanged into TERMS_ARCHIVE (with supersededOn) and never edited again; the acceptance record
 * (Terms §0a) points to these versions. A Markdown snapshot of every version also goes to docs/archive/legal/terms/.
 * Layer: page (imports a page, shared components + config only).
 */

const archivedByVersion = Object.fromEntries(TERMS_ARCHIVE.map(t => [t.version, t]));

/** /terms/v/:version - one archived version, or a short "not found" with the history link. */
export const TermsArchivedPage = () => {
  const { version } = useParams();
  const doc = archivedByVersion[version];
  if (doc) return <LegalPage doc={{ ...doc, historyPath: '/terms/versions', currentPath: '/terms' }} archived />;
  if (version === TERMS_OF_SERVICE.version) return <LegalPage doc={TERMS_OF_SERVICE} draft />;
  return <TermsVersionsPage notFound={version} />;
};

/** /terms/versions - every version, newest first. */
export const TermsVersionsPage = ({ notFound = '' }) => {
  const { user, userRoles, isAuthenticated, loading } = useUser();
  const rows = [
    { ...TERMS_OF_SERVICE, path: TERMS_OF_SERVICE.status === 'draft' ? TERMS_OF_SERVICE.draftPath : '/terms', current: true },
    ...TERMS_ARCHIVE.map(t => ({ ...t, path: `/terms/v/${t.version}` }))
  ];
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {isAuthenticated && !loading ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">General Terms of Service - version history</h1>
          {notFound && <p className="mt-4 text-sm text-red-700 dark:text-red-300">Version {notFound} was not found.</p>}
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Every version is kept unchanged. The version a customer accepted is recorded with its subscription.
          </p>
          <table className="mt-6 min-w-full overflow-hidden rounded-lg bg-white text-sm shadow-sm dark:bg-gray-800">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-4 py-3 font-medium">Version</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Last updated</th>
                <th scope="col" className="px-4 py-3 font-medium">Effective</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.version} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3"><Link to={row.path} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{row.version}</Link></td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {row.current ? (row.status === 'draft' ? 'Current draft (not in effect)' : 'Current') : `Archived${row.supersededOn ? ` - replaced ${row.supersededOn}` : ''}`}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{row.lastUpdated || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{row.effectiveDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Earlier drafts (0.1-0.8) were never in effect; their snapshots and history are in the project records.
          </p>
        </article>
      </main>
      <Footer publicSite />
    </div>
  );
};

/** /terms and /terms/draft. @param {boolean} draft - true on /terms/draft: show the draft text in every build */
const TermsPage = ({ draft = false }) => <LegalPage doc={TERMS_OF_SERVICE} draft={draft} />;

export default TermsPage;
