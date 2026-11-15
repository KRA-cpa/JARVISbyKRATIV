/**
 * Where to go after sign-in: the signed-in page the visitor first opened (e.g. a notice link from an email,
 * /notices/:id), carried through /login in the router state by App.js ProtectedRoute.
 * Only paths inside this app are accepted - never another site ("//host", "https://..."), never /login itself -
 * so a crafted link can't send a user elsewhere after sign-in. Anything else → the dashboard.
 * Layer: utils (no imports).
 */

export const DEFAULT_AFTER_SIGN_IN = '/dashboard';

/** The path to return to, from a router state ({ from }) or a string; falls back to the dashboard. */
export const returnPathFrom = state => {
  const from = typeof state === 'string' ? state : state && state.from;
  if (typeof from !== 'string' || !from.startsWith('/')) return DEFAULT_AFTER_SIGN_IN;
  if (from.startsWith('//') || from.startsWith('/\\')) return DEFAULT_AFTER_SIGN_IN;
  if ([...from].some(ch => ch.charCodeAt(0) < 32)) return DEFAULT_AFTER_SIGN_IN; // no control characters
  const path = from.split(/[?#]/)[0];
  if (path === '/' || path === '/login' || path.startsWith('/login/')) return DEFAULT_AFTER_SIGN_IN;
  return from;
};

/** The router state ProtectedRoute passes to /login for a location. */
export const returnStateFor = location => ({
  from: `${location.pathname || ''}${location.search || ''}${location.hash || ''}`
});
