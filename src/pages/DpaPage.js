import React from 'react';
import LegalPage from './LegalPage';
import { DATA_PROCESSING_AGREEMENT } from '../config/legal/dpa';

/**
 * DpaPage - /admin/dpa: the Data Processing Agreement, for company / organization ADMINS only (user, 1 Nov 2026: "Data
 * processing agreement available only at company/org admin page"). Mounted behind ProtectedRoute requireAdmin and
 * code-split (React.lazy in App.js), so visitors and non-admin users never load it. Note: the gate is in the app; the
 * text itself is static and not secret (prospects receive the DPA on request) - a server-served copy can replace this
 * when the cloud server exists (PLAN_ServerCore).
 * Previews / local dev also mount it at /dpa/draft without sign-in, for review (user, 15 Nov 2026: "also the data
 * processing agreement"); production builds don't register that route (App.js, IS_PREVIEW_BUILD).
 * Layer: page (imports a page + config only).
 * @param {boolean} publicSite - true on /dpa/draft (public footer; the visitor may not be signed in)
 */
const DpaPage = ({ publicSite = false }) => <LegalPage doc={DATA_PROCESSING_AGREEMENT} draft publicSite={publicSite} />;

export default DpaPage;
