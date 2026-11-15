import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { requestsInFlight } from '../api/googleSheet';
import { ACTIVITY_EVENTS } from '../utils/sessionGuard';

/**
 * useSafeMoment - when a modal may open without getting in the user's way (announcements, src/config/announcements.js).
 * User, 15 Nov 2026: "modal forces user attention - but gets [in the way] if user is mid activity".
 * A moment comes: on page load, on a route change, when the tab becomes visible again, and while the user has been idle
 * for 30 seconds (checked every 5 s). At that moment it is safe only when the user isn't busy (isBusy): no text field /
 * select / editable area has focus, no API request is running, and no element on the page says it holds unsaved input
 * (data-unsaved="true" - a page sets it on a form with changes).
 * @returns {number} a counter that grows at every SAFE moment (0 until the first one) - a modal opens when it changes
 */

const TYPING_INPUTS = ['INPUT', 'TEXTAREA', 'SELECT'];
const NOT_TYPING_TYPES = ['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'];
export const IDLE_MS = 30 * 1000;
const IDLE_CHECK_MS = 5 * 1000;

/** Is the user mid-activity right now? */
export const isBusy = (doc = document, inFlight = requestsInFlight()) => {
  const el = doc.activeElement;
  if (el) {
    if (el.isContentEditable) return true;
    if (TYPING_INPUTS.includes(el.tagName) && !(el.tagName === 'INPUT' && NOT_TYPING_TYPES.includes((el.type || '').toLowerCase()))) return true;
  }
  if (inFlight > 0) return true;
  return Boolean(doc.querySelector('[data-unsaved="true"]'));
};

const useSafeMoment = () => {
  const location = useLocation();
  const [safeCount, setSafeCount] = useState(0);
  const lastActivity = useRef(Date.now());

  const moment = useRef(null);
  moment.current = () => { if (!isBusy()) setSafeCount(c => c + 1); };

  // Page load and every route change
  useEffect(() => {
    const t = setTimeout(() => moment.current(), 300);
    return () => clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    const onActivity = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    const onVisible = () => { if (document.visibilityState === 'visible') moment.current(); };
    document.addEventListener('visibilitychange', onVisible);
    const idle = setInterval(() => {
      if (Date.now() - lastActivity.current >= IDLE_MS) moment.current();
    }, IDLE_CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(idle);
    };
  }, []);

  return safeCount;
};

export default useSafeMoment;
