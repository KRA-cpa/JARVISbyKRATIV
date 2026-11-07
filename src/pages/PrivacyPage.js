import React from 'react';
import LegalPage from './LegalPage';
import { PRIVACY_POLICY } from '../config/legal/privacy';

/**
 * PrivacyPage - /privacy and /privacy/draft, PUBLIC (docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md phase L3a).
 * Renders src/config/legal/privacy.js through LegalPage (draft on previews and /privacy/draft, placeholder in
 * production until published; "Last updated" on every view). No API call.
 * Layer: page (imports a page + config only, per docs/reference/DEPENDENCY_MAPPING.md).
 * @param {boolean} draft - true on /privacy/draft: show the draft text in every build
 */
const PrivacyPage = ({ draft = false }) => <LegalPage doc={PRIVACY_POLICY} draft={draft} />;

export default PrivacyPage;
