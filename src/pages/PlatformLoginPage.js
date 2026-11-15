import React from 'react';
import { Link } from 'react-router-dom';
import useSignInFlow from '../hooks/useSignInFlow';
import { PlatformMark } from '../components/shared/PlatformLoadingScreen';
import PlatformLoadingScreen from '../components/shared/PlatformLoadingScreen';
import { GoogleG } from './LoginPage';
import { PLATFORM_PATH } from '../config/platformConsole';

/**
 * PlatformLoginPage - /platform/login, the staff sign-in of the Platform console (user, 15 Nov 2026: "have platform
 * login in homepage", then "platform login still goes to /login. why?"). Its own page in the console's look (slate tile,
 * amber edge - PlatformMark), so it never looks like the customers' sign-in; the same Google sign-in, then /platform.
 * Signed in already → straight to /platform. Opening /platform signed out comes here (App.js ProtectedRoute loginPath).
 * Who may use the console is decided by the server (PLAN_PlatformManager v2.0.0 §4), not by this page.
 * One screen, no scrolling (the LoginPage layout rule). Kept out of search engines.
 * Layer: page (hooks, shared components, config).
 */

const PlatformLoginPage = () => {
  const { loading, error, clearError, notice, isSigningIn, signIn } = useSignInFlow(PLATFORM_PATH);

  React.useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Staff sign-in - Daloy Platform';
    return () => { meta.remove(); document.title = title; };
  }, []);

  if (loading && !error) return <PlatformLoadingScreen />;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-100 px-4 py-6 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <PlatformMark size={44} title="Daloy Platform" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Daloy <span className="text-amber-600 dark:text-amber-400">Platform</span>
            </h1>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">KRAtiv staff console</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 border-t-4 border-t-amber-500 bg-white p-6 shadow-sm dark:border-slate-700 dark:border-t-amber-500 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Staff sign-in</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            For KRAtiv platform admins. Use your KRAtiv Google account with 2-step verification.
          </p>

          {notice && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100" role="status">
              {notice.message}
            </p>
          )}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100" role="alert">
              <p>{error}</p>
              <button type="button" onClick={clearError} className="mt-1 font-medium underline">Dismiss</button>
            </div>
          )}

          <button type="button" onClick={signIn} disabled={isSigningIn}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
            {isSigningIn ? (
              <><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-amber-500" aria-hidden="true" /><span>Signing in...</span></>
            ) : (
              <><span className="rounded bg-white p-0.5"><GoogleG /></span><span>Sign in with Google</span></>
            )}
          </button>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Every action in the console is checked on the server and recorded with your name. Not staff?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Customer sign-in</Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          <Link to="/" className="hover:underline">Back to Daloy</Link>
        </p>
      </div>
    </div>
  );
};

export default PlatformLoginPage;
