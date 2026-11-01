import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import { PRIVACY_POLICY } from '../config/legal/privacy';

/**
 * PrivacyPage - /privacy, PUBLIC (docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md phase L3a). Renders
 * src/config/legal/privacy.js and makes no API call, so anyone can read it without signing in.
 *   - status 'draft': the proposed text (marked DRAFT, open decisions highlighted) on Vercel previews and local development,
 *     and on /privacy/draft (user, 1 Nov 2026: the live page may link to the draft); production /privacy shows the "being
 *     prepared" placeholder with a link to /privacy/draft. The draft view asks search engines not to index it.
 *   - status 'published': the policy everywhere, with its version and effective date.
 * Layer: page (imports shared components + config only, per docs/reference/DEPENDENCY_MAPPING.md).
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

/** Keep a draft out of search results while it is shown (removed again when the page closes). */
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

/** @param {boolean} draft - true on /privacy/draft: show the draft text in every build */
const PrivacyPage = ({ draft = false }) => {
  const { user, userRoles, isAuthenticated, loading } = useUser();
  const policy = PRIVACY_POLICY;
  const published = policy.status === 'published';
  const showText = published || (policy.status === 'draft' && (IS_PREVIEW_BUILD || draft));
  useNoIndex(showText && !published);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {isAuthenticated && !loading ? <Header user={user} userRole={userRoles?.[0]?.name} /> : <PublicHeader />}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{policy.title}</h1>
          {published && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Version {policy.version} · effective {policy.effectiveDate}</p>
          )}

          {!published && (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
              <p className="font-semibold">{showText ? 'Draft' : 'Being prepared'}</p>
              <p className="mt-1">{showText ? policy.draftNotice : policy.placeholderIntro}</p>
            </div>
          )}

          <section className="mt-8" aria-labelledby="privacy-contents">
            <h2 id="privacy-contents" className="text-lg font-semibold text-gray-900 dark:text-white">
              {showText ? 'Contents' : 'What the policy will cover'}
            </h2>
            <ol className="mt-3 list-decimal space-y-1 pl-6 text-gray-700 dark:text-gray-200">
              {policy.sections.map(s => (
                <li key={s.id}>
                  {showText ? <a href={`#${s.id}`} className="text-blue-600 hover:underline dark:text-blue-400">{s.heading}</a> : s.heading}
                </li>
              ))}
            </ol>
          </section>

          {showText && policy.sections.map((s, index) => (
            <section key={s.id} id={s.id} className="mt-10 scroll-mt-20">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{index + 1}. {s.heading}</h2>
              <div className="text-gray-700 dark:text-gray-200 leading-relaxed"><Body text={s.body} /></div>
            </section>
          ))}

          {!showText && (
            <>
              {policy.status === 'draft' && (
                <p className="mt-6">
                  <Link to="/privacy/draft" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                    Read the proposed draft (not in effect)
                  </Link>
                </p>
              )}
              <p className="mt-6 text-sm text-gray-600 dark:text-gray-300">{policy.placeholderContact}</p>
            </>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPage;
