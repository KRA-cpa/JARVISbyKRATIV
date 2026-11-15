import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useCompanyPlans } from '../../hooks/useAPI';
import { noticeHistory, isResolved, isPublicVisible, bannerEndsAt, plainText } from '../../config/notices';
import { formatDateTime } from '../../utils/dateTime';

/**
 * AdminSecurityNotices - Admin → Security Notices: the history of security notices (src/config/notices.js).
 * User, 15 Nov 2026: "security notices should be available historically in platform admin and for all admin users".
 *   - Admins: every notice addressed to their organizations, at any time - also after the sign-in banner ended (3 days
 *     for A, 7 for B / B2).
 *   - Platform admins (the server's is_platform_admin, AppScript v10.2 getCompanyPlan; false when the route isn't
 *     deployed): a switch to every organization's notices, with whom each went to.
 * Each row links to the full notice (/notices/:id) and, when there is one, its public version.
 * Static list: one API call (the platform check). Layer: admin component (contexts, hooks, config, utils).
 */

const BADGES = {
  A: { text: 'Security notice', cls: 'bg-blue-600' },
  B: { text: 'Important', cls: 'bg-red-600' },
  B2: { text: 'Update', cls: 'bg-amber-600' }
};

const linkCls = 'font-medium text-blue-600 hover:underline dark:text-blue-400';

const Chip = ({ ok, children }) => (
  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ok
    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'}`}>
    {children}
  </span>
);

const AdminSecurityNotices = () => {
  const { userCompanies } = useUser();
  const { isPlatformAdmin } = useCompanyPlans();
  const [scope, setScope] = useState('mine');
  const all = isPlatformAdmin && scope === 'all';
  const companyNames = Object.fromEntries((userCompanies || []).map(c => [String(c.id), c.name || c.code || String(c.id)]));
  const notices = noticeHistory((userCompanies || []).map(c => c.id), { all });
  const now = Date.now();

  /** Who a notice went to - shown in the platform view only. */
  const addressedTo = n => {
    if (!n.companyIds || n.companyIds.length === 0) return 'All organizations';
    return n.companyIds.map(id => companyNames[String(id)] || `company ${id}`).join(', ');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Security notices</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            Every security notice sent to {all ? 'any organization' : 'your organization'}, newest first. Users see each one
            as a banner after sign-in - 3 days when the organization's data was not affected, 7 days when it may have
            been; it stays here, and its page stays readable, after that. Administrators also received each notice by
            email.
          </p>
        </div>
        {isPlatformAdmin && (
          <div className="inline-flex rounded-lg border border-gray-300 p-0.5 text-sm dark:border-gray-600" role="group" aria-label="Which notices">
            {[['mine', 'My organizations'], ['all', 'All organizations (platform)']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                aria-pressed={scope === value}
                className={`rounded-md px-3 py-1 ${scope === value ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {notices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
          No security notices so far. If an incident at one of Daloy's providers affects or may affect your
          organization, the notice appears here and stays here.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {notices.map(n => {
            const badge = BADGES[n.template] || BADGES.A;
            const ends = bannerEndsAt(n);
            const bannerText = n.sample ? 'Sample - previews only'
              : ends === null ? null
                : ends > now ? `Banner until ${formatDateTime(new Date(ends).toISOString())}` : 'Banner ended';
            return (
              <li key={n.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${badge.cls}`}>{badge.text}</span>
                  <Chip ok={isResolved(n)}>{isResolved(n) ? `Resolved ${formatDateTime(n.resolvedAt)}` : 'Ongoing'}</Chip>
                  {n.public === true && <Chip ok>Public</Chip>}
                </div>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white">{plainText(n.title)}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Reference {n.id}
                  {n.postedAt && <> · Posted {formatDateTime(n.postedAt)}</>}
                  {bannerText && <> · {bannerText}</>}
                  {all && <> · To: {addressedTo(n)}</>}
                </p>
                <p className="mt-2 text-sm">
                  <Link to={`/notices/${encodeURIComponent(n.id)}`} className={linkCls}>Open notice</Link>
                  {isPublicVisible(n) && (
                    <> · <Link to={`/notices/${encodeURIComponent(n.id)}/public`} className={linkCls}>
                      Public version{n.public === true ? '' : ' (not published)'}
                    </Link></>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AdminSecurityNotices;
