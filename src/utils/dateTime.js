/**
 * Dates in a time zone (v10.1, docs/planning/PLAN_CountryCalendars_TimeZones_20261031.md §4; compliance F3 v3).
 *
 * The server stores real UTC (A17). The browser shows dates in the EFFECTIVE zone: the user's display zone when set,
 * else the company's zone (UserContext.effectiveZone). Every date shown on screen goes through this file - never
 * `toLocaleString()` (the browser's zone) or a fixed "+8 h" shift (`npm run check:code-rules` checks it).
 *
 * - formatInZone / formatDateTime / formatDateOnly / formatTimeOnly: text for the screen.
 * - dayInZone: the yyyy-MM-dd day of a moment in a zone (filters, "due today").
 * - wallClockIn / fromWallClock: a Date whose LOCAL fields show the zone's wall clock, and back to the real moment -
 *   only for day math with date-fns (slaCalculator); never send a wall-clock Date to the server.
 * Layer: utils (no React, no API; imports only config). UserContext imports it like utils/sessionGuard (a leaf module).
 */
import { DEFAULT_ZONE } from '../config/timeZones';

/** The default zone (src/config/timeZones.js): the Philippines calendar - companies without a region. */
export { DEFAULT_ZONE };

const DEFAULT_LOCALE = 'en-PH';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Named styles for formatInZone. */
export const DATE_STYLES = {
  datetime: { dateStyle: 'medium', timeStyle: 'short' },
  datetimeSeconds: { dateStyle: 'medium', timeStyle: 'medium' },
  date: { dateStyle: 'medium' },
  time: { timeStyle: 'short' },
  timeSeconds: { timeStyle: 'medium' }
};

// The zone used when a caller passes none: set by UserContext once the user's companies / preferences are known
let displayZone = DEFAULT_ZONE;
const formatters = new Map();
const validZones = new Map();

/** Is this a time zone the browser knows (IANA name such as Asia/Singapore, or UTC)? */
export function isValidZone(zone) {
  if (!zone || typeof zone !== 'string') return false;
  if (validZones.has(zone)) return validZones.get(zone);
  let ok = true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0);
  } catch (error) {
    ok = false;
  }
  validZones.set(zone, ok);
  return ok;
}

/** The zone used when none is passed (the signed-in user's effective zone). */
export function getDisplayZone() {
  return displayZone;
}

/** Set by UserContext: the effective zone of the current company (unknown zones fall back to the default). */
export function setDisplayZone(zone) {
  displayZone = isValidZone(zone) ? zone : DEFAULT_ZONE;
  return displayZone;
}

/** A zone to use: the one given when valid, else the display zone. */
export function resolveZone(zone) {
  return isValidZone(zone) ? zone : displayZone;
}

function formatter(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat(locale, options));
  return formatters.get(key);
}

/** A Date from a Date / ISO string / ms, or null when blank or invalid. */
export function toDateValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * A moment as text in a zone.
 * @param {Date|string|number} value - The moment (an invalid value comes back as its own text, blank as '')
 * @param {string} [zone] - IANA zone (default: the display zone)
 * @param {string|Object} [style='datetime'] - A DATE_STYLES name or Intl.DateTimeFormat options
 * @param {string} [locale='en-PH']
 * @returns {string}
 */
export function formatInZone(value, zone, style = 'datetime', locale = DEFAULT_LOCALE) {
  const date = toDateValue(value);
  if (!date) return value === null || value === undefined ? '' : String(value);
  const options = typeof style === 'string' ? (DATE_STYLES[style] || DATE_STYLES.datetime) : style;
  return formatter(locale, { ...options, timeZone: resolveZone(zone) }).format(date);
}

/** Date + time in a zone ("1 Nov 2026, 9:30 am"). */
export function formatDateTime(value, zone) {
  return formatInZone(value, zone, 'datetime');
}

/**
 * A date in a zone ("1 Nov 2026"). A date-only value (yyyy-MM-dd: role end dates, holidays) is a calendar day,
 * not a moment, so it is shown as that day in every zone.
 */
export function formatDateOnly(value, zone) {
  if (typeof value === 'string' && DATE_ONLY.test(value.trim())) {
    return formatter(DEFAULT_LOCALE, { ...DATE_STYLES.date, timeZone: 'UTC' }).format(new Date(`${value.trim()}T00:00:00Z`));
  }
  return formatInZone(value, zone, 'date');
}

/** The time of day in a zone ("9:30 am"; seconds when asked). */
export function formatTimeOnly(value, zone, { seconds = false } = {}) {
  return formatInZone(value, zone, seconds ? 'timeSeconds' : 'time');
}

/** The parts of a moment in a zone: { year, month, day, hour, minute, second, weekday (0 = Sunday) }. */
export function zoneParts(value, zone) {
  const date = toDateValue(value) || new Date();
  const parts = {};
  formatter('en-US', {
    timeZone: resolveZone(zone), hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(date).forEach(p => { parts[p.type] = p.value; });
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour) % 24, minute: Number(parts.minute), second: Number(parts.second),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  };
}

/** The yyyy-MM-dd day of a moment in a zone (a yyyy-MM-dd value is already a day and comes back as is). */
export function dayInZone(value, zone) {
  if (typeof value === 'string' && DATE_ONLY.test(value.trim())) return value.trim();
  const p = zoneParts(value, zone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Today in a zone (yyyy-MM-dd). */
export function todayInZone(zone) {
  return dayInZone(new Date(), zone);
}

/** Minutes the zone is ahead of UTC at that moment (+480 for Manila; DST-aware). */
export function zoneOffsetMinutes(zone, at = new Date()) {
  const date = toDateValue(at) || new Date();
  const p = zoneParts(date, zone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - (date.getTime() - date.getMilliseconds())) / 60000);
}

/**
 * A Date whose LOCAL fields (getHours, getDay, date-fns format) show the zone's wall clock at that moment.
 * For day math only - its getTime() is not the real moment. Back with fromWallClock.
 */
export function wallClockIn(value, zone) {
  const date = toDateValue(value) || new Date();
  const p = zoneParts(date, zone);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, date.getMilliseconds());
}

/** The real moment of a wall-clock Date (its local fields read as the zone's wall clock). */
export function fromWallClock(wall, zone) {
  const w = toDateValue(wall);
  if (!w) return null;
  const asUTC = Date.UTC(w.getFullYear(), w.getMonth(), w.getDate(), w.getHours(), w.getMinutes(), w.getSeconds(), w.getMilliseconds());
  // two passes: the offset at the guessed moment, then at the corrected one (daylight-saving edges)
  let moment = asUTC - zoneOffsetMinutes(zone, new Date(asUTC)) * 60000;
  moment = asUTC - zoneOffsetMinutes(zone, new Date(moment)) * 60000;
  return new Date(moment);
}

/** A short zone label for the screen ("GMT+8", "EST"). */
export function zoneLabel(zone, at = new Date()) {
  const part = formatter('en-US', { timeZone: resolveZone(zone), timeZoneName: 'short' })
    .formatToParts(toDateValue(at) || new Date()).find(p => p.type === 'timeZoneName');
  return part ? part.value : resolveZone(zone);
}

/** Zone names for a picker (the browser's list when it has one, else a short list). */
export function listTimeZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  } catch (error) {
    // older browsers: the short list below
  }
  return ['UTC', DEFAULT_ZONE, 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Dubai', 'Asia/Kolkata',
    'Australia/Sydney', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles'];
}
