import React, { useState } from 'react';

/**
 * PlatformLoadingScreen - the loader of the Platform console (/platform, KRAtiv staff). User, 15 Nov 2026: "create a
 * different loader for platform admin - use Daloy Flow loader as reference".
 * Same family as LoadingScreen (the Daloy mark: a "D" with a stream running through it, a light highlight flowing
 * along the stream - BrandMark `animated`), made different on purpose so staff always know they are in the console:
 *   - a dark slate tile with an amber edge instead of the brand blue;
 *   - THREE streams through the "D" (many organizations' flows at once); their highlights run one after another
 *     (the same `daloy-flow` keyframes, 0.6 s apart) - a ripple across the platform;
 *   - "Daloy Platform" + "KRAtiv staff console" under it.
 * Same rules as LoadingScreen: shown only after 300 ms (`.daloy-loader`, src/index.css), page ground bg-gray-100 /
 * dark:bg-gray-900, no spinner or "Loading..." text, still under prefers-reduced-motion (the CSS hides the highlights).
 * Fixed colours (not theme colours) so the mark looks the same in light and dark mode.
 * Layer: shared component (React only).
 */

const FLOW_MS = 1800;
const STREAMS = [
  'M5 12.5c3 0 3-1.8 6-1.8s3 1.8 6 1.8 3-1.8 6-1.8',
  'M5 17.5c3 0 3-1.8 6-1.8s3 1.8 6 1.8 3-1.8 6-1.8',
  'M5 22.5c3 0 3-1.8 6-1.8s3 1.8 6 1.8 3-1.8 6-1.8'
];

/** The platform mark: slate tile, amber edge, the "D", three streams. `animated` = the loader highlights. */
export const PlatformMark = ({ size = 28, animated = false, phase = 0, title }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className="flex-shrink-0" focusable="false"
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title || undefined}>
    <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.5" fill="#0F172A" stroke="#F59E0B" strokeWidth="1.5" />
    <path d="M10 7v18h5.5a9 9 0 0 0 0-18H10z" fill="none" stroke="#F8FAFC" strokeWidth="2.4" strokeLinejoin="round" />
    {STREAMS.map((d, i) => (
      <React.Fragment key={d}>
        <path className="daloy-stream-base" d={d} fill="none" stroke="#FCD34D" strokeOpacity={animated ? 0.45 : 1}
          strokeWidth="1.8" strokeLinecap="round" />
        {animated && (
          <path className="daloy-stream-flow" d={d} pathLength="100" fill="none" stroke="#FFFFFF" strokeWidth="1.8"
            strokeLinecap="round" style={{ animationDelay: `-${Math.round((phase + (STREAMS.length - i) * 600) % FLOW_MS)}ms` }} />
        )}
      </React.Fragment>
    ))}
  </svg>
);

const FADE_DELAY_MS = 300;

/**
 * Highlights continue on the page clock, and the fade-in waits only what is left of the 300 ms when the pre-React splash
 * (public/index.html, which shows this same drawing on /platform addresses) is still on screen - as LoadingScreen does.
 */
const timing = () => {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const fromSplash = typeof document !== 'undefined' && document.getElementById('daloy-splash') !== null;
  return { phase: Math.round(now % FLOW_MS), fadeDelay: `${Math.round(fromSplash ? Math.max(0, FADE_DELAY_MS - now) : FADE_DELAY_MS)}ms` };
};

const PlatformLoadingScreen = () => {
  const [{ phase, fadeDelay }] = useState(timing);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div role="status" className="daloy-loader flex flex-col items-center gap-3" style={{ animationDelay: fadeDelay }}>
        <PlatformMark size={56} animated phase={phase} />
        <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Daloy <span className="text-amber-600 dark:text-amber-400">Platform</span>
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">KRAtiv staff console</span>
        <span className="sr-only">Loading the Daloy Platform console</span>
      </div>
    </div>
  );
};

export default PlatformLoadingScreen;
