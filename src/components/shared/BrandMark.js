import React from 'react';

/**
 * BrandMark - the Daloy logo mark: a "D" with a stream running through it (daloy = "flow"). Chosen 1 Nov 2026 over a
 * flow-path and a waves mark (docs/design/daloy-brand/). The same drawing is public/favicon.svg and the PNG app icons.
 * Fixed brand colours (not theme colours) so the mark looks the same in light and dark mode.
 * `animated` (10 Nov 2026, the loader): the stream stays faint and a light highlight flows along it
 * (CSS `.daloy-stream-flow` in src/index.css; still under prefers-reduced-motion). `flowDelay` sets the animation's
 * start so the highlight can continue from the pre-React splash in public/index.html without a jump.
 * Layer: shared component (no imports beyond React).
 */
const STREAM = 'M5 17.5c3 0 3-3 6-3s3 3 6 3 3-3 6-3';

const BrandMark = ({ size = 28, className = '', title, animated = false, flowDelay }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={`flex-shrink-0 ${className}`}
    role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title || undefined} focusable="false">
    <rect width="32" height="32" rx="8" fill="#2563EB" />
    <path d="M10 7v18h5.5a9 9 0 0 0 0-18H10z" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" />
    {animated ? (
      <>
        <path className="daloy-stream-base" d={STREAM} fill="none" stroke="#93C5FD" strokeWidth="2.4" strokeLinecap="round" />
        <path className="daloy-stream-flow" d={STREAM} pathLength="100" fill="none" stroke="#FFFFFF" strokeWidth="2.4"
          strokeLinecap="round" style={flowDelay ? { animationDelay: flowDelay } : undefined} />
      </>
    ) : (
      <path d={STREAM} fill="none" stroke="#93C5FD" strokeWidth="2.4" strokeLinecap="round" />
    )}
  </svg>
);

export default BrandMark;
