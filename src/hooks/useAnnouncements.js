import { useEffect, useState } from 'react';
import { parseAnnouncements, previewSampleAnnouncements } from '../config/announcements';

/**
 * useAnnouncements - the announcements file (/announcements.json on Firebase Hosting; src/config/announcements.js),
 * re-read every 5 minutes and when the tab becomes visible again, so a tab that is already open sees a new announcement
 * without a reload. A failed read keeps the last list (no error shown - announcements are a convenience; the email and
 * /status carry them too). `now` ticks every 30 seconds so phases (soon / live / ended) move without a read.
 * Previews add the samples of previewSampleAnnouncements (built once per page load).
 * @returns {{ announcements: Array, now: number }}
 */
export const ANNOUNCEMENTS_URL = '/announcements.json';
export const POLL_MS = 5 * 60 * 1000;
const TICK_MS = 30 * 1000;

const useAnnouncements = () => {
  const [fromFile, setFromFile] = useState([]);
  const [samples] = useState(() => previewSampleAnnouncements(Date.now()));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(ANNOUNCEMENTS_URL, { cache: 'no-store' });
        if (response.ok) {
          const list = parseAnnouncements(await response.json());
          if (active) setFromFile(list);
        }
      } catch (error) {
        // offline / not deployed yet: keep the last list
      }
      if (active) setNow(Date.now());
    };
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => { if (active) setNow(Date.now()); }, TICK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { announcements: [...fromFile, ...samples], now };
};

export default useAnnouncements;
