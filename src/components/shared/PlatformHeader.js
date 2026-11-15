import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { PlatformMark } from './PlatformLoadingScreen';
import { PLATFORM_PATH } from '../../config/platformConsole';

/**
 * PlatformHeader - the header of the Platform console (/platform). User, 15 Nov 2026: "login in /platform goes to
 * /dashboard. recheck all /platform objects" → "logo pala" → "might need different logo or add Platform?".
 * The console no longer uses the customer app's Header (its Daloy logo and Dashboard / Tickets / Admin links all led
 * back into the customer app). Here:
 *   - the logo = PlatformMark (the Daloy "D" on a slate tile with an amber edge, three streams) + "Daloy Platform" +
 *     "KRAtiv staff console" - same family as Daloy, unmistakably the console - and it links to /platform;
 *   - "Open Daloy app" (the customer app, /dashboard) is a labelled link, never the logo;
 *   - the signed-in staff member and Sign out (after sign-out, ProtectedRoute sends to /platform/login).
 * Layer: shared component (context, shared, config).
 */
const PlatformHeader = () => {
  const { user, logout } = useUser();
  const name = user?.displayName || user?.email || 'Signed in';

  return (
    <header className="border-b-2 border-amber-500 bg-slate-900 text-slate-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link to={PLATFORM_PATH} className="flex items-center gap-3" aria-label="Daloy Platform - console home">
          <PlatformMark size={36} />
          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-tight">
              Daloy <span className="text-amber-400">Platform</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">KRAtiv staff console</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/dashboard" className="hidden rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white sm:inline">
            Open Daloy app
          </Link>
          <span className="hidden max-w-[14rem] truncate text-slate-400 md:inline" title={name}>{name}</span>
          <button type="button" onClick={() => logout()}
            className="rounded-md border border-slate-600 px-3 py-1 text-slate-100 hover:border-amber-400 hover:text-white">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};

export default PlatformHeader;
