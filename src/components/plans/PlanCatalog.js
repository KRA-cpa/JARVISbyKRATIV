import React, { useMemo } from 'react';
import { usePlanCatalog, useCompanyPlans, useCompanies } from '../../hooks/useAPI';
import Icons from '../shared/Icons';
import {
  PLAN_ORDER, PLAN_NAMES, PLAN_TAGLINES, CORE_FEATURES, PLAN_FEATURE_GROUPS, PLAN_LIMIT_LABELS, PLAN_STATE_LABELS,
  FALLBACK_PLAN_CATALOG, formatPlanLimit
} from '../../config/plans';

/**
 * PlanCatalog - the Basic / Advanced / Enterprise catalogue (AppScript v10.2 getPlanCatalog) with the plans of the
 * caller's companies (getCompanyPlan). Display only: the server decides what a company may do (compliance F1).
 * When the server doesn't answer getPlanCatalog (a deployment older than v10.2) it shows the built-in copy and says so.
 * Layer: feature component (hooks + shared + config, per docs/reference/DEPENDENCY_MAPPING.md). Mounted by PlansPage.
 */

const PLAN_ACCENTS = {
  basic: 'border-gray-300 dark:border-gray-600',
  advanced: 'border-blue-500 dark:border-blue-400',
  enterprise: 'border-purple-500 dark:border-purple-400'
};

const STATE_BADGES = {
  trial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  grace: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  read_only: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  unassigned: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
};

const Mark = ({ on }) => (on
  ? <span className="inline-flex text-green-600 dark:text-green-400" aria-label="Included"><Icons.CheckCircle size={18} /></span>
  : <span className="text-gray-300 dark:text-gray-600" aria-label="Not included">—</span>);

const PlanCatalog = () => {
  const { catalog: serverCatalog, loading, error } = usePlanCatalog();
  const { companies: companyPlans } = useCompanyPlans();
  const { data: companyList } = useCompanies();

  const fromServer = !!(serverCatalog && Array.isArray(serverCatalog.plans) && serverCatalog.plans.length);
  const catalog = fromServer ? serverCatalog : FALLBACK_PLAN_CATALOG;

  const plans = useMemo(() => {
    const byKey = {};
    (catalog.plans || []).forEach(p => { byKey[p.plan] = p; });
    return PLAN_ORDER.filter(key => byKey[key]).map(key => ({ ...byKey[key], features: new Set(byKey[key].features || []) }));
  }, [catalog]);

  // Features the server lists that this copy has no label for still show (by key), so nothing is hidden
  const groups = useMemo(() => {
    const labelled = new Set(PLAN_FEATURE_GROUPS.flatMap(g => Object.keys(g.features)));
    const extra = (catalog.features || []).map(f => f.key).filter(key => !labelled.has(key));
    return extra.length
      ? PLAN_FEATURE_GROUPS.concat([{ area: 'Other', features: Object.fromEntries(extra.map(key => [key, key])) }])
      : PLAN_FEATURE_GROUPS;
  }, [catalog]);

  const companyNames = useMemo(() => {
    const names = {};
    (Array.isArray(companyList) ? companyList : []).forEach(c => { names[String(c.id)] = c.name || c.code || String(c.id); });
    return names;
  }, [companyList]);

  const myPlans = Object.values(companyPlans || {});
  const myPlanKeys = new Set(myPlans.map(v => v.plan));
  const limitKeys = catalog.limit_keys || Object.keys(PLAN_LIMIT_LABELS);
  const addedCount = index => (index === 0 ? 0 : plans[index].features.size - plans[index - 1].features.size);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 dark:text-gray-400">
        <Icons.Loading size={24} className="animate-spin mr-3" />
        <span>Loading plans…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plans</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Each company runs on one plan. A higher plan includes everything in the lower ones. Plans are set by the platform admin.
        </p>
      </div>

      {!fromServer && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
          <Icons.AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            The server didn't send its plan catalogue{error ? ` (${error.message || error})` : ''}, so this is the built-in copy.
            It becomes live once AppScript v10.2 is deployed.
          </span>
        </div>
      )}

      {myPlans.length > 0 && (
        <section aria-labelledby="my-plans">
          <h2 id="my-plans" className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Your companies</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {myPlans.map(view => (
              <div key={view.company_id} className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{companyNames[view.company_id] || view.company_id}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{view.plan_name || PLAN_NAMES[view.plan]}</span>
                  <span className={`rounded-full px-2 py-0.5 ${STATE_BADGES[view.state] || STATE_BADGES.unassigned}`}>
                    {PLAN_STATE_LABELS[view.state] || view.state}
                  </span>
                  {view.period_end && ['trial', 'active'].includes(view.state) && view.days_left !== null && (
                    <span className="text-gray-500 dark:text-gray-400">{view.days_left} day{view.days_left === 1 ? '' : 's'} left</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Plans" className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan, index) => (
          <div key={plan.plan}
            className={`flex flex-col rounded-xl border-2 bg-white p-6 shadow-sm dark:bg-gray-800 ${PLAN_ACCENTS[plan.plan] || PLAN_ACCENTS.basic}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name || PLAN_NAMES[plan.plan]}</h2>
              {myPlanKeys.has(plan.plan) && (
                <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">Your plan</span>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{PLAN_TAGLINES[plan.plan]}</p>
            <p className="mt-4 text-sm font-medium text-gray-800 dark:text-gray-100">
              {index === 0 ? 'The core ticket loop' : `Everything in ${plans[index - 1].name}, plus ${addedCount(index)} features`}
            </p>
            <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm dark:border-gray-700">
              {limitKeys.map(key => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="text-gray-600 dark:text-gray-400">{PLAN_LIMIT_LABELS[key] || key}</dt>
                  <dd className="font-semibold tabular-nums text-gray-900 dark:text-white">{formatPlanLimit(plan.limits ? plan.limits[key] : null)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section aria-labelledby="compare" className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 id="compare" className="border-b border-gray-200 px-6 py-4 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
          Compare features
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-6 py-3 font-medium">Feature</th>
                {plans.map(plan => (
                  <th key={plan.plan} scope="col" className="w-28 px-4 py-3 text-center font-medium">{plan.name || PLAN_NAMES[plan.plan]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50 dark:bg-gray-900/40">
                <th scope="colgroup" colSpan={plans.length + 1} className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Every plan
                </th>
              </tr>
              {CORE_FEATURES.map(label => (
                <tr key={label} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-6 py-2.5 text-gray-800 dark:text-gray-100">{label}</td>
                  {plans.map(plan => <td key={plan.plan} className="px-4 py-2.5 text-center"><Mark on /></td>)}
                </tr>
              ))}
              {groups.map(group => (
                <React.Fragment key={group.area}>
                  <tr className="bg-gray-50 dark:bg-gray-900/40">
                    <th scope="colgroup" colSpan={plans.length + 1} className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {group.area}
                    </th>
                  </tr>
                  {Object.entries(group.features).map(([key, label]) => (
                    <tr key={key} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-6 py-2.5 text-gray-800 dark:text-gray-100">{label}</td>
                      {plans.map(plan => <td key={plan.plan} className="px-4 py-2.5 text-center"><Mark on={plan.features.has(key)} /></td>)}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Trials last {catalog.trial_default_days || 30} days unless the platform admin sets another end date. When a period ends without a renewal,
        the company keeps its plan for a grace period ({(catalog.grace_days && catalog.grace_days.paid) || 14} days; {(catalog.grace_days && catalog.grace_days.trial) || 7} after
        a trial), then becomes read-only until a plan is set. Tickets already moving always finish. Items marked v10.3 / v10.4 arrive in those releases.
      </p>
    </div>
  );
};

export default PlanCatalog;
