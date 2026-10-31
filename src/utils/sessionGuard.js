/**
 * Session guard (AppScript v9.6 release): idle sign-out after 60 minutes without interaction, shared across tabs,
 * and the one-time notice the login page shows after the app signed someone out.
 *
 * - Activity = click / key / scroll / touch / tab focus. The last activity time lives in localStorage, so every tab
 *   of the app counts the same activity; it is removed on sign-out, so a fresh sign-in starts a fresh clock.
 * - Reopening the app after more than 60 minutes of no activity counts as an idle timeout too.
 * - No warning before the sign-out (user decision, 31 Oct 2026).
 * - The notice is kept in sessionStorage and shown once: only after the app ended the session itself (idle, the
 *   12-hour cap, not invited, deactivated), never after a normal sign-out or on a first visit.
 * Storage can be unavailable (private mode, blocked site data): every access is wrapped and fails quietly.
 */

export const IDLE_LIMIT_MS = 60 * 60 * 1000;
export const LAST_ACTIVITY_KEY = 'jarvis_last_activity';
export const SESSION_NOTICE_KEY = 'jarvis_session_notice';
export const ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'touchstart'];
// Activity is written at most this often (scroll fires many events)
export const ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;

// Why the app ended a session -> what the login page says
export const SESSION_NOTICES = {
  IDLE: 'Session closed due to inactivity. Please sign in again.',
  SESSION_MAX_AGE: 'Your session reached 12 hours. Please sign in again.',
  SESSION_EXPIRED: 'Your session expired. Please sign in again.',
  NOT_INVITED: "Your account isn't set up yet. Ask your administrator for an invite.",
  ACCOUNT_DISABLED: 'Your account is deactivated. Ask your administrator.'
};

function safeStorage(kind) {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch (error) {
    return null;
  }
}

/** Last activity (ms since epoch), or null when none is stored. */
export function readLastActivity() {
  try {
    const value = Number(safeStorage('localStorage')?.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (error) {
    return null;
  }
}

export function writeLastActivity(time = Date.now()) {
  try {
    safeStorage('localStorage')?.setItem(LAST_ACTIVITY_KEY, String(time));
  } catch (error) {
    // storage unavailable: the in-memory timer of this tab still works
  }
}

export function clearLastActivity() {
  try {
    safeStorage('localStorage')?.removeItem(LAST_ACTIVITY_KEY);
  } catch (error) {
    // nothing stored
  }
}

/** Has the session been idle for longer than the limit? */
export function isIdleExpired(now = Date.now(), last = readLastActivity()) {
  return last !== null && now - last > IDLE_LIMIT_MS;
}

// The server's own text is used for these (the proxy's cap can be changed with MAX_SESSION_HOURS)
const SERVER_TEXT_CODES = ['SESSION_MAX_AGE'];

/** Remember why the app signed the user out (one of SESSION_NOTICES' keys); serverMessage = the backend's text. */
export function setSessionNotice(code, serverMessage = '') {
  if (!SESSION_NOTICES[code]) return;
  const message = SERVER_TEXT_CODES.includes(code) && serverMessage ? String(serverMessage) : SESSION_NOTICES[code];
  try {
    safeStorage('sessionStorage')?.setItem(SESSION_NOTICE_KEY, JSON.stringify({ code, message }));
  } catch (error) {
    // no notice then
  }
}

/**
 * The notice to show, or null. Reading does NOT remove it (the login page may mount more than once while the session
 * ends - a read-once notice was lost that way in the v9.6 browser check); clearSessionNotice() removes it when the
 * user signs in again.
 */
export function takeSessionNotice() {
  try {
    const storage = safeStorage('sessionStorage');
    const raw = storage?.getItem(SESSION_NOTICE_KEY);
    if (!raw) return null;
    const notice = JSON.parse(raw);
    return notice && SESSION_NOTICES[notice.code] ? { code: notice.code, message: notice.message || SESSION_NOTICES[notice.code] } : null;
  } catch (error) {
    return null;
  }
}

/** Forget the notice (the user is signing in again). */
export function clearSessionNotice() {
  try {
    safeStorage('sessionStorage')?.removeItem(SESSION_NOTICE_KEY);
  } catch (error) {
    // nothing stored
  }
}
