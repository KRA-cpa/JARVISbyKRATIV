import React, { useState } from 'react';
import BrandMark from './BrandMark';

/**
 * LoadingScreen - the full-screen loading state: the Daloy mark with its stream flowing, the name under it.
 * No spinner, no "Loading..." text (review L1, docs/design/REVIEW_UIErgonomics_20261110.md; decisions doc item 8).
 *
 * - Shown only after 300 ms (CSS `.daloy-loader`, src/index.css), so fast loads never flash it.
 * - The same markup is the pre-React splash in public/index.html (`#daloy-splash`, inside #root). A LoadingScreen in
 *   React's first render takes over from it: the splash is still in the DOM while that render runs (React clears #root
 *   at commit), so the fade-in delay is what is left of the splash's 300 ms (none if the splash is already showing),
 *   and the stream's highlight continues at the same point (both run on the page clock, performance.now()).
 *   Later LoadingScreens (route / Suspense fallbacks) wait the full 300 ms.
 * - On the page ground: bg-gray-100 / dark:bg-gray-900, like the signed-in pages, so there is no colour jump.
 * - prefers-reduced-motion: the stream is still; only the fade remains.
 * Layer: shared component (imports BrandMark).
 */
const FADE_DELAY_MS = 300;
const FLOW_MS = 1800;

const timing = () => {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const fromSplash = typeof document !== 'undefined' && document.getElementById('daloy-splash') !== null;
  const fadeDelay = fromSplash ? Math.max(0, FADE_DELAY_MS - now) : FADE_DELAY_MS;
  return { fadeDelay: `${Math.round(fadeDelay)}ms`, flowDelay: `-${Math.round(now % FLOW_MS)}ms` };
};

const LoadingScreen = () => {
  const [{ fadeDelay, flowDelay }] = useState(timing);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div role="status" className="daloy-loader flex flex-col items-center gap-3" style={{ animationDelay: fadeDelay }}>
        <BrandMark size={56} animated flowDelay={flowDelay} />
        <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Daloy</span>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">by KRAtiv</span>
        <span className="sr-only">Loading Daloy</span>
      </div>
    </div>
  );
};

export default LoadingScreen;
