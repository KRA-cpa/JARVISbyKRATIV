/**
 * Announcements to signed-in users - maintenance windows, outages, information (docs/planning/PLAN_Announcements_20261115.md).
 * User, 15 Nov 2026: "add user broadcast modal - for currently logged in users - or what is better if we announce
 * maintenance or company needs to announce downtime" + "modal forces user attention - but gets [in the way] if user is
 * mid activity".
 *
 * Source (A1): the static file /announcements.json on Firebase Hosting (public/announcements.json, served no-cache),
 * re-read by the app every 5 minutes and when the tab regains focus (src/hooks/useAnnouncements.js) - open tabs see a new
 * announcement without a reload, and it still works while Cloud Run / Apps Script is down. Publish: edit the file,
 * `firebase deploy --only hosting` (deploy guide §I). The file is PUBLIC: texts never name a customer; an entry for some
 * organizations lists opaque company ids. Company announcements (A2, server) and the platform console (A3) come later.
 *
 * An entry: { id, kind: 'maintenance' | 'outage' | 'info', title, message, startsAt, endsAt (null = until removed),
 *   showFrom (default: startsAt - 3 days for maintenance, else startsAt), companyIds ([] = everyone), link (default
 *   '/status'), readOnly (true = changes can't be saved during the window) } - times ISO with an offset.
 * Phases: hidden → upcoming → soon (15 min before the start) → live → ended.
 * Banner: at once, every phase but hidden / ended; the user may hide it, except a live maintenance window.
 * Modal (maintenance + outage only, never info): at a safe moment (src/hooks/useSafeMoment.js), once per stage per user -
 *   'notice' (announced), 'soon' (save your work), 'live' (maintenance with readOnly in progress). A later stage's
 *   "got it" covers the earlier ones.
 * Layer: config (imports config/platform only).
 */
import { IS_PREVIEW_BUILD } from './platform';

export const ANNOUNCEMENT_KINDS = ['maintenance', 'outage', 'info'];
export const SOON_MS = 15 * 60 * 1000;
export const MAINTENANCE_LEAD_MS = 3 * 24 * 60 * 60 * 1000;
export const MODAL_STAGES = ['notice', 'soon', 'live'];
const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** ms of an ISO time WITH an offset, else NaN (a time without a zone is ambiguous). */
const timeMs = value => (typeof value === 'string' && OFFSET_RE.test(value.trim()) ? Date.parse(value) : NaN);

/** One entry checked and normalized (times as ms), or null when it can't be shown safely. */
export const normalizeAnnouncement = raw => {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!id || !title || !ANNOUNCEMENT_KINDS.includes(raw.kind)) return null;
  const start = timeMs(raw.startsAt);
  if (Number.isNaN(start)) return null;
  let end = null;
  if (raw.endsAt !== undefined && raw.endsAt !== null && raw.endsAt !== '') {
    end = timeMs(raw.endsAt);
    if (Number.isNaN(end) || end <= start) return null;
  }
  let showFrom = raw.kind === 'maintenance' ? start - MAINTENANCE_LEAD_MS : start;
  if (raw.showFrom) {
    const given = timeMs(raw.showFrom);
    if (Number.isNaN(given)) return null;
    showFrom = Math.min(given, start);
  }
  const link = typeof raw.link === 'string' && raw.link.startsWith('/') && !raw.link.startsWith('//') ? raw.link : '/status';
  return {
    id,
    kind: raw.kind,
    title,
    message: typeof raw.message === 'string' ? raw.message.trim() : '',
    startsAt: start,
    endsAt: end,
    showFrom,
    companyIds: Array.isArray(raw.companyIds) ? raw.companyIds.map(String) : [],
    link,
    readOnly: raw.readOnly === true,
    sample: raw.sample === true
  };
};

/** The file's content ({ announcements: [...] } or a bare array) → valid entries only; anything else → []. */
export const parseAnnouncements = json => {
  const list = Array.isArray(json) ? json : (json && Array.isArray(json.announcements) ? json.announcements : []);
  const seen = new Set();
  return list.map(normalizeAnnouncement).filter(a => a && !seen.has(a.id) && seen.add(a.id));
};

/** 'hidden' | 'upcoming' | 'soon' | 'live' | 'ended' for a normalized entry. */
export const announcementPhase = (a, now = Date.now()) => {
  if (a.endsAt !== null && now >= a.endsAt) return 'ended';
  if (now >= a.startsAt) return 'live';
  if (now < a.showFrom) return 'hidden';
  return now >= a.startsAt - SOON_MS ? 'soon' : 'upcoming';
};

/** For a user of these companies ([] on the entry = everyone). */
export const announcementForCompanies = (a, companyIds = []) =>
  a.companyIds.length === 0 || a.companyIds.some(id => companyIds.map(String).includes(id));

/** The entries to show now (banner), soonest first; companyIds = null → only the ones for everyone (public pages). */
export const activeAnnouncements = (list, companyIds, now = Date.now()) => (list || [])
  .filter(a => !['hidden', 'ended'].includes(announcementPhase(a, now)))
  .filter(a => (companyIds === null ? a.companyIds.length === 0 : announcementForCompanies(a, companyIds)))
  .slice()
  .sort((x, y) => x.startsAt - y.startsAt);

/** Can the user hide the banner now? Not a maintenance window in progress. */
export const canHideBanner = (a, now = Date.now()) => !(a.kind === 'maintenance' && announcementPhase(a, now) === 'live');

/** The modal stage due now (before any "got it"), or null. */
export const modalStageNow = (a, now = Date.now()) => {
  if (a.kind === 'info') return null;
  const phase = announcementPhase(a, now);
  if (phase === 'hidden' || phase === 'ended') return null;
  if (a.kind === 'outage') return 'notice';
  if (phase === 'upcoming') return 'notice';
  if (phase === 'soon') return 'soon';
  return a.readOnly ? 'live' : null;
};

/** The stage key remembered after "got it". */
export const ackKey = (a, stage) => `${a.id}:${stage}`;

/**
 * The first modal to show now for this user: an entry whose current stage isn't acknowledged, and no later stage is
 * either. acked = the stored keys. Returns { announcement, stage } or null.
 */
export const pendingModal = (list, companyIds, acked = [], now = Date.now()) => {
  for (const a of activeAnnouncements(list, companyIds, now)) {
    const stage = modalStageNow(a, now);
    if (!stage) continue;
    const later = MODAL_STAGES.slice(MODAL_STAGES.indexOf(stage));
    if (!later.some(s => acked.includes(ackKey(a, s)))) return { announcement: a, stage };
  }
  return null;
};

/** Keys to store when the user acknowledges a stage: that stage and every earlier one. */
export const ackKeysFor = (a, stage) => MODAL_STAGES.slice(0, MODAL_STAGES.indexOf(stage) + 1).map(s => ackKey(a, s));

/**
 * Preview samples (Vercel previews / local only): a maintenance window starting in 20 minutes (the banner at once,
 * the 'notice' modal at the first safe moment, 'soon' 5 minutes later) and an information line. Built once per page
 * load from `now`, so they always look current.
 */
export const previewSampleAnnouncements = (now = Date.now()) => {
  if (!IS_PREVIEW_BUILD) return [];
  const iso = ms => new Date(ms).toISOString();
  return parseAnnouncements([
    {
      id: 'SAMPLE-MAINT',
      sample: true,
      kind: 'maintenance',
      title: 'Planned maintenance (sample)',
      message: 'Daloy will be read-only while we move to new servers in Singapore. You can still view tickets; saving, approving and new tickets will wait until the window ends.',
      startsAt: iso(now + 20 * 60 * 1000),
      endsAt: iso(now + 80 * 60 * 1000),
      readOnly: true
    },
    {
      id: 'SAMPLE-INFO',
      sample: true,
      kind: 'info',
      title: 'New: Admin → Security Notices keeps every notice (sample)',
      message: 'Administrators can find every security notice sent to their organization under Admin → Security Notices.',
      startsAt: iso(now - 60 * 1000),
      endsAt: iso(now + 24 * 60 * 60 * 1000)
    }
  ]);
};
