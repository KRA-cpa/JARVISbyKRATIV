import { useEffect } from 'react';

/** The console's tab icon (public/). */
export const PLATFORM_FAVICON = '/favicon-platform.svg';

/**
 * useConsoleTab - the browser tab of the Platform console (/platform, /platform/login): its own title, its own icon
 * (public/favicon-platform.svg - the console mark: slate tile, amber edge, three streams; user, 16 Nov 2026: "change ico
 * in Daloy platform") and noindex. Everything is put back when the page unmounts (leaving the console for the app).
 * public/index.html sets the same icon before React starts on /platform addresses, so the tab never flashes the app's.
 * Layer: hook (no imports from the app).
 * @param {string} title - the tab title while the page is shown
 */
export default function useConsoleTab(title) {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = title;
    // Every icon link points at the console mark (the .ico link too, so no browser falls back to the app's icon)
    const icons = Array.from(document.querySelectorAll('link[rel~="icon"]')).map(link => ({
      link, href: link.getAttribute('href'), type: link.getAttribute('type')
    }));
    icons.forEach(({ link }) => {
      link.setAttribute('href', PLATFORM_FAVICON);
      link.setAttribute('type', 'image/svg+xml');
    });
    return () => {
      meta.remove();
      document.title = previousTitle;
      icons.forEach(({ link, href, type }) => {
        // index.html may have switched it already: restore the app's own icons from the data attribute when present
        link.setAttribute('href', link.dataset.appHref || href);
        const appType = link.dataset.appHref ? link.dataset.appType : type;
        if (appType) link.setAttribute('type', appType); else link.removeAttribute('type');
      });
    };
  }, [title]);
}
