import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useSignInFlow from '../hooks/useSignInFlow';
import { returnPathFrom } from '../utils/returnPath';
import Icons from '../components/shared/Icons';
import BrandMark from '../components/shared/BrandMark';
import LoadingScreen from '../components/shared/LoadingScreen';
import { AnnouncementLines } from '../components/shared/AnnouncementBanner';
import { BRAND_NAME, BRAND_PARENT_LINE, BRAND_DESCRIPTOR, BRAND_TAGLINE } from '../config/site';

/**
 * LoginPage - /login, the customers' sign-in (15 Nov 2026: the one-screen redesign, previewed as /login/v2 - user:
 * "reorg login page, so theres no need to scroll down - create loginv2 as preview", then "use login v2 as new login
 * page", "archive old login PAGE"; the old page is in docs/archive/2026-11/login-v1/). Google sign-in, the session
 * notice, back to the page first opened (src/utils/returnPath.js), Terms + Privacy links (no consent checkbox).
 * Layout:
 *   - one screen, no scrolling: brand on the left and the sign-in card on the right from md up; on phones a compact
 *     brand row above the card (min-h-[100dvh], no large vertical padding);
 *   - the "System Features" box and the always-"Online" status line are gone (the line claimed a status it never
 *     checked); a "Service status" link to /status instead;
 *   - maintenance / outage announcements (15 min before and during) and the session notice sit inside the card;
 *   - dark mode.
 * Layer: page (hooks, utils, shared components, config).
 */

export const GoogleG = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const POINTS = ['Requests that route themselves to the right people', 'Approvals with deadlines everyone can see', 'A full record of every step'];

const LoginPage = () => {
  const location = useLocation();
  const { loading, error, clearError, notice, isSigningIn, signIn: handleGoogleSignIn } = useSignInFlow(returnPathFrom(location.state));

  if (loading && !error) return <LoadingScreen />;

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl grid gap-6 md:grid-cols-2 md:gap-10 items-center">
        {/* Brand: a compact row on phones, the left column from md up */}
        <div className="flex items-center gap-3 md:block">
          <BrandMark size={48} />
          <div className="md:mt-5">
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{BRAND_NAME}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{BRAND_PARENT_LINE}</p>
          </div>
          <div className="hidden md:block">
            <p className="mt-5 text-lg font-semibold text-blue-700 dark:text-blue-300">{BRAND_TAGLINE}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{BRAND_DESCRIPTOR}</p>
            <ul className="mt-5 space-y-2 text-sm text-gray-700 dark:text-gray-200">
              {POINTS.map(p => (
                <li key={p} className="flex items-start gap-2">
                  <Icons.CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sign in</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Use the Google account your organization invited.</p>

          <AnnouncementLines liveOnly className="mt-4" />

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

          <button type="button" onClick={handleGoogleSignIn} disabled={isSigningIn}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">
            {isSigningIn ? (
              <><span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" aria-hidden="true" /><span>Signing in...</span></>
            ) : (
              <><GoogleG /><span>Sign in with Google</span></>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Terms of Service</Link>
            {' '}and acknowledge our{' '}
            <Link to="/privacy" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</Link>.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <span>Need help? Ask your administrator.</span>
            <Link to="/status" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Service status</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
