import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import useAnnouncements from '../../hooks/useAnnouncements';
import useSafeMoment from '../../hooks/useSafeMoment';
import { activeAnnouncements, announcementPhase, canHideBanner, pendingModal, ackKeysFor } from '../../config/announcements';
import { formatDateTime } from '../../utils/dateTime';
import AnnouncementModal from './AnnouncementModal';

/**
 * AnnouncementBanner - announcements on every signed-in page (App.js WithNotices, next to the security-notice banner):
 * maintenance (amber), outage (red), information (blue) from /announcements.json (src/config/announcements.js).
 *   - Banner at once; the user may hide it until a maintenance window starts (then it comes back and stays).
 *   - Maintenance / outage also open AnnouncementModal - only at a safe moment (src/hooks/useSafeMoment.js: not while
 *     typing, saving or holding unsaved input), once per stage per user.
 * Hidden / acknowledged ids: localStorage per user, wrapped (blocked storage = this visit only), like LoginNoticeBanner.
 * Layer: shared component (context, hooks, config, utils).
 */

const STYLES = {
  maintenance: { box: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-50', badge: 'bg-amber-600', label: 'Maintenance' },
  outage: { box: 'border-red-300 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-900/30 dark:text-red-50', badge: 'bg-red-600', label: 'Service disruption' },
  info: { box: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-50', badge: 'bg-blue-600', label: 'Announcement' }
};

const readList = key => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
};

const writeList = (key, list) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(-200)));
  } catch (e) {
    // storage blocked: this visit only
  }
};

const whenText = (a, phase) => {
  const start = formatDateTime(new Date(a.startsAt).toISOString());
  const end = a.endsAt === null ? null : formatDateTime(new Date(a.endsAt).toISOString());
  if (phase === 'live') return end ? `Until ${end}` : `Since ${start}`;
  return end ? `${start} to ${end}` : `From ${start}`;
};

const AnnouncementBanner = () => {
  const { user, userCompanies } = useUser();
  const uid = user?.uid || user?.id || 'guest';
  const hiddenKey = `daloy.hiddenAnnouncements.${uid}`;
  const ackKey = `daloy.ackAnnouncements.${uid}`;
  const { announcements, now } = useAnnouncements();
  const safeCount = useSafeMoment();
  const [hiddenNow, setHiddenNow] = useState([]);
  const [ackedNow, setAckedNow] = useState([]);
  const [modal, setModal] = useState(null);

  const companyIds = (userCompanies || []).map(c => c.id);
  const acked = [...readList(ackKey), ...ackedNow];
  const hidden = [...readList(hiddenKey), ...hiddenNow];
  const active = activeAnnouncements(announcements, companyIds, now);
  const pending = pendingModal(announcements, companyIds, acked, now);
  const pendingKey = pending ? `${pending.announcement.id}:${pending.stage}` : null;

  // Open the pending modal at the next safe moment only (never in the middle of what the user is doing)
  useEffect(() => {
    if (safeCount > 0 && pending && !modal) setModal(pending);
    // pendingKey stands for pending; modal is read, not watched (a closed modal waits for the next safe moment)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCount, pendingKey]);

  const acknowledge = () => {
    if (!modal) return;
    const keys = ackKeysFor(modal.announcement, modal.stage);
    writeList(ackKey, [...readList(ackKey).filter(k => !keys.includes(k)), ...keys]);
    setAckedNow(prev => [...prev, ...keys]);
    setModal(null);
  };

  const hide = id => {
    writeList(hiddenKey, [...readList(hiddenKey).filter(x => x !== id), id]);
    setHiddenNow(prev => [...prev, id]);
  };

  const shown = active.filter(a => !hidden.includes(a.id) || !canHideBanner(a, now));

  return (
    <>
      {shown.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-900 px-4 pt-3 sm:px-6 lg:px-8 space-y-2" aria-label="Announcements">
          {shown.map(a => {
            const s = STYLES[a.kind] || STYLES.info;
            const phase = announcementPhase(a, now);
            return (
              <div key={a.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm ${s.box}`}
                role={a.kind === 'info' ? 'status' : 'alert'}>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${s.badge}`}>
                  {s.label}{phase === 'live' && a.kind === 'maintenance' ? ' - in progress' : ''}
                </span>
                <span className="flex-1 min-w-[12rem]">
                  <span className="font-medium">{a.title}</span>
                  <span className="opacity-80"> · {whenText(a, phase)}</span>
                  {a.readOnly && <span className="opacity-80"> · read-only</span>}
                </span>
                <Link to={a.link} className="font-semibold underline underline-offset-2 hover:no-underline">Details</Link>
                {canHideBanner(a, now) && (
                  <button type="button" onClick={() => hide(a.id)}
                    className="rounded-lg px-2 py-1 text-xs font-medium opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label={`Hide the announcement: ${a.title}`}>
                    Hide
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {modal && <AnnouncementModal announcement={modal.announcement} stage={modal.stage} onAcknowledge={acknowledge} />}
    </>
  );
};

/**
 * AnnouncementLines - the announcements for everyone (no company scope) as plain lines for public pages: /status (every
 * active one) and the sign-in page (only the ones starting within 15 minutes or in progress: liveOnly).
 */
export const AnnouncementLines = ({ liveOnly = false, className = '' }) => {
  const { announcements, now } = useAnnouncements();
  const list = activeAnnouncements(announcements, null, now)
    .filter(a => !liveOnly || ['soon', 'live'].includes(announcementPhase(a, now)));
  if (list.length === 0) return null;
  return (
    <section className={`space-y-2 ${className}`} aria-label="Announcements">
      {list.map(a => {
        const s = STYLES[a.kind] || STYLES.info;
        const phase = announcementPhase(a, now);
        return (
          <div key={a.id} className={`rounded-lg border p-4 text-sm ${s.box}`} role={a.kind === 'info' ? 'status' : 'alert'}>
            <p>
              <span className="font-semibold">{s.label}{phase === 'live' && a.kind === 'maintenance' ? ' in progress' : ''}: </span>
              {a.title} <span className="opacity-80">({whenText(a, phase)}{a.readOnly ? ', read-only' : ''})</span>
              {a.sample && <span className="opacity-70"> - sample, previews only</span>}
            </p>
            {a.message && <p className="mt-1 opacity-90">{a.message}</p>}
          </div>
        );
      })}
    </section>
  );
};

export default AnnouncementBanner;
