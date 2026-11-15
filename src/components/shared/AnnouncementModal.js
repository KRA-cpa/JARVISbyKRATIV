import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../utils/dateTime';

/**
 * AnnouncementModal - one announcement that needs the user's attention (maintenance / outage; src/config/announcements.js
 * modalStageNow). Opened by AnnouncementBanner only at a safe moment (src/hooks/useSafeMoment.js), never while the user
 * is mid-activity; closed only by "OK, got it" (or Esc, the same), which is remembered per user and stage.
 * Never blocks the page behind it beyond the overlay. Layer: shared component (utils only).
 * @param {{ announcement: Object, stage: 'notice'|'soon'|'live', onAcknowledge: Function }} props
 */

const HEADINGS = {
  maintenance: { notice: 'Planned maintenance', soon: 'Maintenance starts soon - save your work', live: 'Maintenance in progress' },
  outage: { notice: 'Service disruption', soon: 'Service disruption', live: 'Service disruption' }
};

const when = a => {
  const start = formatDateTime(new Date(a.startsAt).toISOString());
  if (a.endsAt === null) return `Since ${start}`;
  return `${start} to ${formatDateTime(new Date(a.endsAt).toISOString())} (your time)`;
};

const AnnouncementModal = ({ announcement: a, stage, onAcknowledge }) => {
  const button = useRef(null);
  useEffect(() => {
    if (button.current) button.current.focus();
    const onKey = e => { if (e.key === 'Escape') onAcknowledge(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAcknowledge]);

  const heading = (HEADINGS[a.kind] || HEADINGS.outage)[stage];
  const minutes = Math.max(1, Math.round((a.startsAt - Date.now()) / 60000));
  const amber = a.kind === 'maintenance';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${amber ? 'bg-amber-600' : 'bg-red-600'}`}>
          {amber ? 'Maintenance' : 'Service disruption'}{a.sample ? ' (sample)' : ''}
        </span>
        <h2 id="announcement-modal-title" className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{heading}</h2>
        <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">{a.title}</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{when(a)}</p>
        {stage === 'soon' && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
            Starts in about {minutes} minute{minutes === 1 ? '' : 's'}. Finish or save what you are doing.
          </p>
        )}
        {a.message && <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">{a.message}</p>}
        {a.readOnly && (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">
            {stage === 'live' ? 'Changes can\'t be saved until it ends.' : 'During this time you can view tickets but not save changes.'}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Link to={a.link} onClick={onAcknowledge} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            Service status
          </Link>
          <button ref={button} type="button" onClick={onAcknowledge}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            OK, got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
