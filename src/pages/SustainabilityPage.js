import React from 'react';
import LegalPage from './LegalPage';
import { SUSTAINABILITY_STATEMENT } from '../config/legal/sustainability';

/**
 * SustainabilityPage - /sustainability and /sustainability/draft, PUBLIC, no API call: the ESG page
 * (docs/planning/PLAN_ESGPage_20261115.md, E1). Renders src/config/legal/sustainability.js through LegalPage (draft on
 * previews and /sustainability/draft, placeholder in production until published).
 * Layer: page (imports a page + config only).
 * @param {boolean} draft - true on /sustainability/draft: show the draft text in every build
 */
const SustainabilityPage = ({ draft = false }) => <LegalPage doc={SUSTAINABILITY_STATEMENT} draft={draft} />;

export default SustainabilityPage;
