import React from 'react';
import { Link } from 'react-router-dom';
import Icons from '../shared/Icons';
import {
  PLAN_ORDER, PLAN_NAMES, PLAN_TAGLINES, CORE_FEATURES, PLAN_FEATURE_GROUPS, PLAN_LIMIT_LABELS, PLAN_CATALOG_COPY,
  formatPlanLimit
} from '../../config/plans';

/**
 * PlanCatalog - the Basic / Advanced / Enterprise catalogue (AppScript v10.2) for the public /plans page. Static: it renders
 * the display copy in src/config/plans.js and makes no API call, so visitors who aren't signed in can see it. The server's
 * PLAN_CATALOG still decides what a company may do (compliance F1); `npm run check:api-contract` fails when the copy and
 * the server catalogue differ. A company's own plan + usage is shown on Company -> Plan & usage (v10.2 P5), not here.
 * Layer: feature component (shared + config only, per docs/reference/DEPENDENCY_MAPPING.md). Mounted by PlansPage.
 * @param {boolean} signedIn - shows Sign in (visitors) or Go to dashboard (signed-in users) in the closing line
 */

const PLAN_ACCENTS = {
  basic: 'border-gray-300 dark:border-gray-600',
  advanced: 'border-blue-500 dark:border-blue-400',
  enterprise: 'border-purple-500 dark:border-purple-400'
};

const byKey = Object.fromEntries(PLAN_CATALOG_COPY.plans.map(p => [p.plan, p]));
const PLANS = PLAN_ORDER.filter(key => byKey[key]).map(key => ({ ...byKey[key], features: new Set(byKey[key].features) }));
const LIMIT_KEYS = PLAN_CATALOG_COPY.limit_keys;

const Mark = ({ on }) => (on
  ? <span className="inline-flex text-green-600 dark:text-green-400" aria-label="Included"><Icons.CheckCircle size={18} /></span>
  : <span className="text-gray-300 dark:text-gray-600" aria-label="Not included">—</span>);

const addedCount = index => (index === 0 ? 0 : PLANS[index].features.size - PLANS[index - 1].features.size);

const PlanCatalog = ({ signedIn = false }) => (
  <div className="space-y-8">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plans</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Each company runs on one plan. A higher plan includes everything in the lower ones.
      </p>
    </div>

    <section aria-label="Plans" className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {PLANS.map((plan, index) => (
        <div key={plan.plan}
          className={`flex flex-col rounded-xl border-2 bg-white p-6 shadow-sm dark:bg-gray-800 ${PLAN_ACCENTS[plan.plan] || PLAN_ACCENTS.basic}`}>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name || PLAN_NAMES[plan.plan]}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{PLAN_TAGLINES[plan.plan]}</p>
          <p className="mt-4 text-sm font-medium text-gray-800 dark:text-gray-100">
            {index === 0 ? 'The core ticket loop' : `Everything in ${PLANS[index - 1].name}, plus ${addedCount(index)} features`}
          </p>
          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm dark:border-gray-700">
            {LIMIT_KEYS.map(key => (
              <div key={key} className="flex justify-between gap-4">
                <dt className="text-gray-600 dark:text-gray-400">{PLAN_LIMIT_LABELS[key] || key}</dt>
                <dd className="font-semibold tabular-nums text-gray-900 dark:text-white">{formatPlanLimit(plan.limits[key])}</dd>
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
              {PLANS.map(plan => (
                <th key={plan.plan} scope="col" className="w-28 px-4 py-3 text-center font-medium">{plan.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-gray-50 dark:bg-gray-900/40">
              <th scope="colgroup" colSpan={PLANS.length + 1} className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Every plan
              </th>
            </tr>
            {CORE_FEATURES.map(label => (
              <tr key={label} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-6 py-2.5 text-gray-800 dark:text-gray-100">{label}</td>
                {PLANS.map(plan => <td key={plan.plan} className="px-4 py-2.5 text-center"><Mark on /></td>)}
              </tr>
            ))}
            {PLAN_FEATURE_GROUPS.map(group => (
              <React.Fragment key={group.area}>
                <tr className="bg-gray-50 dark:bg-gray-900/40">
                  <th scope="colgroup" colSpan={PLANS.length + 1} className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {group.area}
                  </th>
                </tr>
                {Object.entries(group.features).map(([key, label]) => (
                  <tr key={key} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-6 py-2.5 text-gray-800 dark:text-gray-100">{label}</td>
                    {PLANS.map(plan => <td key={plan.plan} className="px-4 py-2.5 text-center"><Mark on={plan.features.has(key)} /></td>)}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
      <p>
        Trials last {PLAN_CATALOG_COPY.trial_default_days} days unless the platform team sets another end date. When a period ends without a
        renewal, the company keeps its plan for a grace period ({PLAN_CATALOG_COPY.grace_days.paid} days; {PLAN_CATALOG_COPY.grace_days.trial} after a trial),
        then becomes read-only until a plan is set. Tickets already moving always finish. Items marked v10.3 / v10.4 arrive in those releases.
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-200">
        Plans are set up by the platform team.{' '}
        {signedIn
          ? <Link to="/dashboard" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Go to dashboard</Link>
          : <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Sign in</Link>}
        {' · '}
        <Link to="/privacy" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</Link>
      </p>
    </div>
  </div>
);

export default PlanCatalog;
