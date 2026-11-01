import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';

/**
 * LegalPage - renders one legal document (Privacy Policy, General Terms of Service) from its config object
 * (src/config/legal/*.js). PUBLIC, no API call. Used by PrivacyPage and TermsPage.
 *   - status 'draft': the proposed text (marked DRAFT, open decisions highlighted) on Vercel previews and local
 *     development, and on the document's draftPath; production shows the "being prepared" placeholder with a link to
 *     the draft. A draft view asks search engines not to index it.
 *   - status 'published': the text everywhere, with its version, effective date and last-updated date.
 *   - archived: a frozen earlier version (TermsPage /terms/v/:version), marked "archived", noindex.
 * Every view shows "Last updated" (user, 1 Nov 2026) and, when the document has one, a link to its version history.
 * doc.pendingChange (a notice of an upcoming MAJOR change - one that materially diminishes the customer's or the platform
 * owner's rights) shows an "Upcoming change" box with the summary and effective date.
 * Layer: page (imports shared components only; the document comes in as a prop).
 */

// Build-time flags (Create React App inlines them): Vercel exposes REACT_APP_VERCEL_ENV = production | preview | development
const IS_PREVIEW_BUILD = process.env.NODE_ENV === 'development' || process.env.REACT_APP_VERCEL_ENV === 'preview';

/** Text with [[open decision]] markers highlighted. */
const WithBlanks = ({ text }) => text.split(/(\[\[[^\]]+\]\])/g).map((part, i) => (
  /^\[\[.*\]\]$/.test(part)
    ? <mark key={i} className="rounded bg-amber-200 px-1 text-amber-900 dark:bg-amber-700/60 dark:text-amber-50">{part.slice(2, -2)}</mark>
    : <React.Fragment key={i}>{part}</React.Fragment>
));

/** A section body: paragraphs split by a blank line; lines starting with "- " become a bullet list. */
const Body = ({ text }) => text.split(/\n\n+/).map((block, i) => {
  const lines = block.split('\n');
  if (lines.every(line => line.startsWith('- '))) {
    return (
      <ul key={i} className="mt-2 list-disc space-y-1 pl-6">
        {lines.map((line, j) => <li key={j}><WithBlanks text={line.slice(2)} /></li>)}
      </ul>
    );
  }
  return <p key={i} className="mt-2"><WithBlanks text={block} /></p>;
});

/** Keep a draft / archived copy out of search results while it is shown (removed again when the page closes). */
function useNoIndex(active) {
  useEffect(() => {
    if (!active) return undefined;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, [active]);
}

/** "Version 0.4 (draft) · Last updated 1 November 2026 · Effective ..." */
const VersionLine = ({ doc, archived }) => {
  const parts = [];
  if (doc.version) parts.push(`Version ${doc.version}${doc.status === 'draft' ? ' (draft)' : ''}${archived ? ' (archived)' : ''}`);
  if (doc.lastUpdated) parts.push(`Last updated ${doc.lastUpdated}`);
  if (doc.status === 'published' && doc.effectiveDate) parts.push(`Effective ${doc.effectiveDate}`);
  if (!parts.length && !doc.historyPath) return null;
  return (
    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
      {parts.join(' · ')}
      {doc.historyPath && (
        <>{parts.length ? ' · ' : ''}<Link to={doc.historyPath} className="text-blue-600 hover:underline dark:text-blue-400">Version history</Link></>
      )}
    </p>
  );
};

/**
 * @param {object} doc - the document config (title, status, version, lastUpdated, sections, ...)
 * @param {boolean} draft - true on the draft path: show the draft text in every build
 * @param {boolean} archived - a frozen earlier version: always shown, marked archived
 * @param {boolean} publicSite - footer variant (false inside the signed-in app, e.g. the admin-only DPA)
 */
const LegalPage = ({ doc, draft = false, archived = false, publicSite = true }) => {
  const { user, userRoles, isAuthenticated, loading } = useUser();
  const published = doc.status === 'published';
  const showText = archived || published || (doc.status === 'draft' && (IS_PREVIEW_BUILD || draft));
  useNoIndex(archived || (showText && !published));

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {isAuthenticated && !loading ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{doc.title}</h1>
          <VersionLine doc={doc} archived={archived} />

          {doc.pendingChange && !archived && (
            <div className="mt-6 rounded-lg border-2 border-blue-500 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-50" role="note">
              <p className="font-semibold">
                Upcoming change{doc.pendingChange.version ? ` - version ${doc.pendingChange.version}` : ''}, effective {doc.pendingChange.effectiveDate}
              </p>
              {doc.pendingChange.noticeDate && <p className="mt-1">Notice given on {doc.pendingChange.noticeDate}.</p>}
              {doc.pendingChange.summary && doc.pendingChange.summary.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-6">{doc.pendingChange.summary.map(item => <li key={item}>{item}</li>)}</ul>
              )}
              {doc.pendingChange.path && (
                <p className="mt-2"><Link to={doc.pendingChange.path} className="font-medium text-blue-700 hover:underline dark:text-blue-300">Read the new version</Link></p>
              )}
            </div>
          )}

          {archived && (
            <div className="mt-6 rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
              <p className="font-semibold">Archived version</p>
              <p className="mt-1">
                This is an earlier version, kept unchanged for the record{doc.supersededOn ? ` (replaced on ${doc.supersededOn})` : ''}.{' '}
                {doc.currentPath && <Link to={doc.currentPath} className="font-medium text-blue-600 hover:underline dark:text-blue-400">Read the current version</Link>}
              </p>
            </div>
          )}

          {!published && !archived && (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
              <p className="font-semibold">{showText ? 'Draft' : 'Being prepared'}</p>
              <p className="mt-1">{showText ? doc.draftNotice : doc.placeholderIntro}</p>
            </div>
          )}

          <section className="mt-8" aria-labelledby="legal-contents">
            <h2 id="legal-contents" className="text-lg font-semibold text-gray-900 dark:text-white">
              {showText ? 'Contents' : 'What it will cover'}
            </h2>
            <ol className="mt-3 list-decimal space-y-1 pl-6 text-gray-700 dark:text-gray-200">
              {doc.sections.map(s => (
                <li key={s.id}>
                  {showText ? <a href={`#${s.id}`} className="text-blue-600 hover:underline dark:text-blue-400">{s.heading}</a> : s.heading}
                </li>
              ))}
            </ol>
          </section>

          {showText && doc.sections.map((s, index) => (
            <section key={s.id} id={s.id} className="mt-10 scroll-mt-20">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{index + 1}. {s.heading}</h2>
              <div className="text-gray-700 dark:text-gray-200 leading-relaxed"><Body text={s.body} /></div>
            </section>
          ))}

          {!showText && (
            <>
              {doc.status === 'draft' && doc.draftPath && (
                <p className="mt-6">
                  <Link to={doc.draftPath} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                    Read the proposed draft (not in effect)
                  </Link>
                </p>
              )}
              <p className="mt-6 text-sm text-gray-600 dark:text-gray-300">{doc.placeholderContact}</p>
            </>
          )}
        </article>
      </main>
      <Footer publicSite={publicSite} />
    </div>
  );
};

export default LegalPage;
