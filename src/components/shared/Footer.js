import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_NAME, BRAND_PARENT_LINE, BRAND_TAGLINE_LOCAL, BRAND_COPYRIGHT_OWNER } from '../../config/site';
import { PRIVACY_POLICY } from '../../config/legal/privacy';
import { TERMS_OF_SERVICE } from '../../config/legal/terms';

// A notice of an upcoming MAJOR change (config pendingChange) is linked from every page footer (user, 1 Nov 2026)
const PENDING_CHANGES = [[TERMS_OF_SERVICE, '/terms'], [PRIVACY_POLICY, '/privacy']]
  .filter(([doc]) => doc.pendingChange)
  .map(([doc, path]) => ({ title: doc.title, path: doc.pendingChange.path || path, effectiveDate: doc.pendingChange.effectiveDate }));

/**
 * Footer Component
 *
 * Copyright masthead for all pages, three lines: brand + local tagline; Proof of Concept + designer (+ the build credit,
 * signed-in pages only - `publicSite` hides it on the website); copyright year + Privacy Policy link (every page links to
 * /privacy, docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md §3) and Terms; an upcoming major change of either document adds
 * a notice line above. The year is the current one, so it never goes stale.
 */
const Footer = ({ className = "", publicSite = false }) => {
  return (
    <footer className={`bg-white border-t border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="text-sm text-gray-500">
            {PENDING_CHANGES.map(change => (
              <p key={change.title} className="mb-2 rounded-md bg-amber-50 px-3 py-1.5 text-amber-900" role="note">
                <strong>Upcoming change:</strong> our {change.title} change on {change.effectiveDate}.{' '}
                <Link to={change.path} className="font-medium underline">Read what changes</Link>
              </p>
            ))}
            <p>
              <span className="font-medium text-gray-700">{BRAND_NAME} · {BRAND_PARENT_LINE}</span>
              {' · '}<span className="italic">{BRAND_TAGLINE_LOCAL}</span>
            </p>
            <p className="mt-1">
              <span className="font-medium">Proof of Concept</span>
              {' · '}Designed by <span className="font-medium text-gray-700">Kenneth Advento</span>
              {!publicSite && <>{' · '}Developed through <span className="font-medium text-gray-700">Claude.ai and Claude CLI</span></>}
            </p>
            <p className="mt-1 text-xs sm:text-sm">
              {/* smaller on phones (two rows there); each part stays whole: on phones the line breaks only between parts */}
              <span className="whitespace-nowrap">© {new Date().getFullYear()} {BRAND_COPYRIGHT_OWNER}</span>
              {' · '}<span className="whitespace-nowrap">All rights reserved</span>{' · '}
              <Link to="/privacy" className="whitespace-nowrap font-medium text-blue-600 hover:underline">Privacy Policy</Link>
              {' · '}<Link to="/terms" className="whitespace-nowrap font-medium text-blue-600 hover:underline">Terms</Link>
              {' · '}<Link to="/status" className="whitespace-nowrap font-medium text-blue-600 hover:underline">Status</Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;