import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCompanyPlans } from '../hooks/useAPI';
import PlatformHeader from '../components/shared/PlatformHeader';
import PlatformLoadingScreen, { PlatformMark } from '../components/shared/PlatformLoadingScreen';
import { IS_PREVIEW_BUILD } from '../config/platform';
import { PLATFORM_GROUPS, PLATFORM_MODULES, WIREFRAME_OVERVIEW } from '../config/platformConsole';

/**
 * PlatformPage - /platform, the Platform manager console (KRAtiv staff). WIREFRAME today (user, 15 Nov 2026: "create
 * login button for platform admin and wireframe homepage of platform i can access"): the left rail of the final design
 * (docs/planning/PLAN_PlatformManager_20261106.md v2.0.0 - 16 modules in 4 groups) and the Overview with invented sample
 * data; the other modules show what they will do and their build phase. No API call except the access check; no
 * customer data.
 * Access: signed in (App.js ProtectedRoute), then - on previews any signed-in user (for review); in production only a
 * platform admin (the server's is_platform_admin, AppScript v10.2 getCompanyPlan; PM1 moves it to platform_admins).
 * Kept out of search engines (noindex) and lazy-loaded (App.js).
 * Header: PlatformHeader (console logo → /platform; the customer app only through a labelled link). No customer
 * banners here (App.js WithNotices console). Loader: PlatformLoadingScreen (also the first-load splash on /platform).
 * Layer: page (shared components, hooks, config).
 */

const TONES = {
  red: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100',
  amber: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100',
  gray: 'border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
};

/** Out of search engines; the tab says "Daloy Platform" (restored when leaving the console). */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Daloy Platform - KRAtiv staff console';
    return () => { meta.remove(); document.title = title; };
  }, []);
}

const PhaseChip = ({ phase }) => (
  <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200">{phase}</span>
);

const Overview = ({ onOpen }) => (
  <div className="space-y-6">
    <section aria-labelledby="attention-title">
      <h2 id="attention-title" className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Needs attention ({WIREFRAME_OVERVIEW.attention.length})
      </h2>
      <ul className="mt-2 space-y-2">
        {WIREFRAME_OVERVIEW.attention.map(item => (
          <li key={item.text} className={`rounded-lg border px-3 py-2 text-sm ${TONES[item.tone] || TONES.gray}`}>{item.text}</li>
        ))}
      </ul>
    </section>

    <section aria-label="Figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {WIREFRAME_OVERVIEW.tiles.map(tile => (
        <button key={tile.label} type="button" onClick={() => onOpen(tile.module)}
          className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-blue-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{tile.label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{tile.value}</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{tile.detail}</p>
        </button>
      ))}
    </section>

    <section aria-labelledby="actions-title">
      <h2 id="actions-title" className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Last platform actions</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">What</th><th className="px-3 py-2">Reason</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {WIREFRAME_OVERVIEW.lastActions.map(a => (
              <tr key={a.at + a.what} className="text-gray-800 dark:text-gray-100">
                <td className="whitespace-nowrap px-3 py-2">{a.at}</td>
                <td className="px-3 py-2">{a.who}</td>
                <td className="px-3 py-2">{a.what}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{a.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </div>
);

const ModulePlaceholder = ({ module }) => (
  <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 dark:border-gray-600 dark:bg-gray-800">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{module.code}</span>
      <PhaseChip phase={module.phase} />
    </div>
    <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{module.name}</h2>
    <p className="mt-2 max-w-2xl text-gray-700 dark:text-gray-200">{module.summary}</p>
    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
      Not built yet - arrives in phase {module.phase} of the Platform manager plan. Screen sketches: the plan, §7.
    </p>
  </div>
);

const PlatformConsole = () => {
  const [active, setActive] = useState('overview');
  const current = PLATFORM_MODULES.find(m => m.id === active) || PLATFORM_MODULES[0];
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
      {/* Left rail; a select on small screens */}
      <nav aria-label="Platform modules" className="lg:w-64 lg:flex-shrink-0">
        <label className="block lg:hidden">
          <span className="sr-only">Module</span>
          <select value={active} onChange={e => setActive(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
            {PLATFORM_MODULES.map(m => <option key={m.id} value={m.id}>{m.group} · {m.name}</option>)}
          </select>
        </label>
        <div className="hidden space-y-5 lg:block">
          {PLATFORM_GROUPS.map(group => (
            <div key={group}>
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group}</p>
              <ul className="mt-1 space-y-0.5">
                {PLATFORM_MODULES.filter(m => m.group === group).map(m => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setActive(m.id)} aria-current={active === m.id ? 'page' : undefined}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${active === m.id
                        ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-gray-700'}`}>
                      <span>{m.name}</span>
                      <span className={`text-[10px] font-semibold ${active === m.id ? 'text-blue-100' : 'text-gray-400'}`}>{m.phase}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <main className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <PlatformMark size={28} title="Daloy Platform" />
            {current.id === 'overview' ? 'Platform overview' : current.name}
          </h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">KRAtiv staff only · every action checked on the server</span>
        </div>
        {current.id === 'overview' ? <Overview onOpen={setActive} /> : <ModulePlaceholder module={current} />}
      </main>
    </div>
  );
};

const PlatformPage = () => {
  useNoIndex();
  // Production: only platform admins; previews: any signed-in user, for review (the page holds sample data only)
  const { isPlatformAdmin, loading } = useCompanyPlans({ enabled: !IS_PREVIEW_BUILD });
  const allowed = IS_PREVIEW_BUILD || isPlatformAdmin;
  // Previews: /platform?loader=1 shows the console's loader on its own, for review (it is usually on screen for a moment)
  const { search } = useLocation();
  if (IS_PREVIEW_BUILD && new URLSearchParams(search).has('loader')) return <PlatformLoadingScreen />;

  if (!IS_PREVIEW_BUILD && loading) return <PlatformLoadingScreen />;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <PlatformHeader />
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
        Wireframe - sample data only, nothing here is live. Design: Platform manager plan v2.0.0.
      </div>
      <div className="flex-1">
        {allowed ? <PlatformConsole /> : (
          <div className="mx-auto max-w-xl px-4 py-16 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform console</h1>
            <p className="mt-3 text-gray-700 dark:text-gray-200">This area is for KRAtiv staff. Your account isn't a platform admin.</p>
            <Link to="/dashboard" className="mt-6 inline-block font-medium text-blue-600 hover:underline dark:text-blue-400">Open the Daloy app</Link>
          </div>
        )}
      </div>
      <footer className="border-t border-gray-200 px-4 py-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Daloy Platform · KRAtiv staff console · every action is checked on the server and recorded
      </footer>
    </div>
  );
};

export default PlatformPage;
