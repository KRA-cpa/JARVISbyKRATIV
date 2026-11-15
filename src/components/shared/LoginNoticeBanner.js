import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { activeNotices, isResolved } from '../../config/notices';

/**
 * LoginNoticeBanner - the sign-in notices from src/config/notices.js on every signed-in page (App.js ProtectedRoute):
 * shown for 7 days from postedAt, a link to the full notice (/notices/<id>) and a Hide button. User, 15 Nov 2026:
 * "banner upon login, effective for 7 days, user can hide" + "banner will provide link to breach notif".
 * Hidden notices are remembered per user in this browser (localStorage, wrapped: if storage is blocked the notice hides
 * for this visit only). Static: no API call. Layer: shared component (context + config).
 */

const STYLES = {
  A: { box: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-50', badge: 'bg-blue-600', label: 'Security notice' },
  B: { box: 'border-red-300 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-900/30 dark:text-red-50', badge: 'bg-red-600', label: 'Important' },
  B2: { box: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-50', badge: 'bg-amber-600', label: 'Update' }
};

const storageKey = uid => `daloy.hiddenNotices.${uid || 'guest'}`;

const readHidden = uid => {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(uid)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
};

const writeHidden = (uid, ids) => {
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(ids));
  } catch (e) {
    // storage blocked (private window, site data off): hidden for this visit only
  }
};

/** "[[Provider]]" placeholders of a sample read as plain words in the one-line banner. */
const plain = text => text.replace(/\[\[([^\]]+)\]\]/g, '$1');

const LoginNoticeBanner = () => {
  const { user, userCompanies } = useUser();
  const uid = user?.uid || user?.id;
  // Hidden in this visit (also covers blocked storage); read with the stored list on every render, so the right user's
  // list applies even if the profile arrives after the first render
  const [hiddenNow, setHiddenNow] = useState([]);
  const hidden = [...readHidden(uid), ...hiddenNow];
  const companyIds = (userCompanies || []).map(c => c.id);
  const notices = activeNotices(companyIds).filter(n => !hidden.includes(n.id));
  if (notices.length === 0) return null;

  const hide = id => {
    writeHidden(uid, [...readHidden(uid).filter(x => x !== id), id]);
    setHiddenNow(prev => [...prev, id]);
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-900 px-4 pt-3 sm:px-6 lg:px-8 space-y-2" aria-label="Notices">
      {notices.map(n => {
        const s = STYLES[n.template] || STYLES.A;
        return (
          <div key={n.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm ${s.box}`}
            role={n.template === 'B' ? 'alert' : 'status'}>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${s.badge}`}>
              {s.label}{isResolved(n) ? ' - resolved' : ''}{n.sample ? ' (sample)' : ''}
            </span>
            <span className="flex-1 min-w-[12rem] font-medium">{plain(n.banner)}</span>
            <Link to={`/notices/${encodeURIComponent(n.id)}`} className="font-semibold underline underline-offset-2 hover:no-underline">
              Read the notice
            </Link>
            <button type="button" onClick={() => hide(n.id)}
              className="rounded-lg px-2 py-1 text-xs font-medium opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={`Hide the notice: ${plain(n.title)}`}>
              Hide
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default LoginNoticeBanner;
