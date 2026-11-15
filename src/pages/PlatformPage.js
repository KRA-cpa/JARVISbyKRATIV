import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCompanyPlans } from '../hooks/useAPI';
import useConsoleTab from '../hooks/useConsoleTab';
import PlatformHeader from '../components/shared/PlatformHeader';
import PlatformLoadingScreen, { PlatformMark } from '../components/shared/PlatformLoadingScreen';
import { IS_PREVIEW_BUILD } from '../config/platform';
import { PLATFORM_GROUPS, PLATFORM_MODULES, WIREFRAME_COSTS, WIREFRAME_OVERVIEW } from '../config/platformConsole';

/**
 * PlatformPage - /platform, the Platform manager console (KRAtiv staff). WIREFRAME today (user, 15 Nov 2026: "create
 * login button for platform admin and wireframe homepage of platform i can access"): the left rail of the final design
 * (docs/planning/PLAN_PlatformManager_20261106.md v2.0.0 - 16 modules in 4 groups, + M17 Costs proposed 16 Nov 2026) and
 * the Overview + Costs with invented sample data; the other modules show what they will do and their build phase. No API call except the access check; no
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

const usd = n => `$${n.toFixed(2)}`;
const SectionTitle = ({ id, children }) => (
  <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{children}</h2>
);

/** Daily spend, one series: bars anchored to the baseline; hover / focus shows that day's figure above the plot. */
const DailyBars = ({ values, month }) => {
  const [hover, setHover] = useState(null);
  const max = Math.max(...values, 0.01);
  const day = hover === null ? values.length - 1 : hover;
  const short = month.split(' ')[0].slice(0, 3);
  return (
    <div>
      <p className="text-sm text-gray-700 dark:text-gray-200" aria-live="polite">
        <span className="font-semibold">{day + 1} {short}</span>: {usd(values[day])}
        {hover === null && <span className="text-gray-500 dark:text-gray-400"> (latest - point at a bar for its day)</span>}
      </p>
      <div className="mt-2 flex h-28 items-end gap-0.5 border-b border-gray-300 dark:border-gray-600">
        {values.map((v, i) => (
          <button key={i} type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`${i + 1} ${short}: ${usd(v)}`}
            className="flex h-full flex-1 items-end focus:outline-none">
            <span className={`block w-full rounded-t ${hover === i ? 'bg-blue-700 dark:bg-blue-300' : 'bg-blue-500 dark:bg-blue-400'}`}
              style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400"><span>1 {short}</span><span>{values.length} {short}</span></div>
    </div>
  );
};

/** Used and forecast against a hard limit, with the state in words (never colour alone). */
const LimitMeter = ({ item }) => {
  const pct = v => Math.min(100, (v / item.limit) * 100);
  let state = { label: 'On track', tone: 'text-green-700 dark:text-green-300', bar: 'bg-green-600' };
  if (item.forecast >= item.limit) state = { label: 'Over the limit by month end', tone: 'text-red-700 dark:text-red-300', bar: 'bg-red-500' };
  else if (item.forecast >= item.limit * 0.8) state = { label: 'Close to the limit', tone: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' };
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-gray-900 dark:text-white">{item.label}</span>
        <span className="text-gray-700 dark:text-gray-200">{item.used} of {item.limit} {item.unit} · forecast {item.forecast}</span>
      </div>
      <div className="relative mt-1 h-3 overflow-hidden rounded bg-gray-200 dark:bg-gray-700"
        role="meter" aria-valuemin={0} aria-valuemax={item.limit} aria-valuenow={item.used} aria-label={item.label}>
        <span className="absolute inset-y-0 left-0 rounded bg-gray-400/60 dark:bg-gray-500/60" style={{ width: `${pct(item.forecast)}%` }} />
        <span className={`absolute inset-y-0 left-0 rounded ${state.bar}`} style={{ width: `${pct(item.used)}%` }} />
      </div>
      <p className={`mt-1 text-xs font-medium ${state.tone}`}>
        {state.label}{item.note ? <span className="font-normal text-gray-600 dark:text-gray-300"> - {item.note}</span> : null}
      </p>
    </div>
  );
};

/** M17 Costs (proposed - OPEN_PlatformManager O14). WIREFRAME with invented figures. */
const Costs = () => {
  const c = WIREFRAME_COSTS;
  const php = n => `PHP ${(n * c.rate.usdPhp).toFixed(2)}`;
  const tiles = [
    { label: 'This month so far', value: usd(c.monthToDateUsd), detail: php(c.monthToDateUsd) },
    { label: 'Forecast for the month', value: usd(c.forecastUsd), detail: `last month ${usd(c.lastMonthUsd)}` },
    { label: 'Budget', value: usd(c.budget.usd), detail: `forecast ${Math.round((c.forecastUsd / c.budget.usd) * 100)} % · alerts at ${c.budget.alertsAt.join(' / ')} %` },
    { label: 'Neon Free compute', value: `${c.neon[0].used} CU-h`, detail: `of ${c.neon[0].limit} · forecast ${c.neon[0].forecast}` }
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {c.month} · updated {c.asOf} · {c.lagNote} Amounts only - no card or invoice details are kept. PHP at the {c.rate.source}.
      </p>
      <section aria-label="Cost figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(t => (
          <div key={t.label} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{t.value}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{t.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-labelledby="daily-title" className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <SectionTitle id="daily-title">Daily cost, all providers</SectionTitle>
          <div className="mt-3"><DailyBars values={c.daily} month={c.month} /></div>
        </section>
        <section aria-labelledby="neon-title" className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <SectionTitle id="neon-title">Neon Free limits this month</SectionTitle>
          <div className="mt-3 space-y-4">{c.neon.map(item => <LimitMeter key={item.label} item={item} />)}</div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Solid = used so far, light = forecast for the month. The Sheet sync is planned at about 81 CU-h.
          </p>
        </section>
      </div>

      <section aria-labelledby="providers-title">
        <SectionTitle id="providers-title">By provider and service</SectionTitle>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr><th className="px-3 py-2">Service</th><th className="px-3 py-2 text-right">This month</th><th className="px-3 py-2">Detail</th></tr>
            </thead>
            {c.providers.map(p => (
              <tbody key={p.provider} className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th scope="rowgroup" colSpan={3} className="px-3 py-2 text-gray-900 dark:text-white">
                    {p.provider}{' '}
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                      · {usd(p.services.reduce((a, x) => a + x.usd, 0))} · {p.source}
                    </span>
                  </th>
                </tr>
                {p.services.map(x => (
                  <tr key={x.name} className="text-gray-800 dark:text-gray-100">
                    <td className="px-3 py-2">{x.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{usd(x.usd)}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{x.note}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <details className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
        <summary className="cursor-pointer font-medium text-gray-900 dark:text-white">Daily figures as a table</summary>
        <div className="mt-2 grid grid-cols-4 gap-x-4 gap-y-1 text-gray-700 sm:grid-cols-8 dark:text-gray-200">
          {c.daily.map((v, i) => <span key={i} className="tabular-nums">{i + 1}: {usd(v)}</span>)}
        </div>
      </details>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Where the numbers come from: Google Cloud - the Cloud Billing export to BigQuery (Singapore), read once a day; Neon -
        the project usage figures; the domain and GitHub - typed in here. Owner and billing roles only.
      </p>
    </div>
  );
};

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
        {current.id === 'overview' ? <Overview onOpen={setActive} />
          : current.id === 'costs' ? <Costs /> : <ModulePlaceholder module={current} />}
      </main>
    </div>
  );
};

const PlatformPage = () => {
  // Out of search engines; the tab says "Daloy Platform" with the console's own icon (restored when leaving)
  useConsoleTab('Daloy Platform - KRAtiv staff console');
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
