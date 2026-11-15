import React from 'react';
import LegalPage from './LegalPage';
import { DATA_LOCATION_STATEMENT } from '../config/legal/dataLocation';

/**
 * DataLocationPage - /data-location and /data-location/draft, PUBLIC, no API call: "Where your data is stored", the
 * statement for new clients (migration step 0.10; docs/planning/DISCLOSURE_DataLocation_NewClients_20261115.md).
 * Renders src/config/legal/dataLocation.js through LegalPage (draft on previews and /data-location/draft, placeholder
 * in production until published).
 * Layer: page (imports a page + config only).
 * @param {boolean} draft - true on /data-location/draft: show the draft text in every build
 */
const DataLocationPage = ({ draft = false }) => <LegalPage doc={DATA_LOCATION_STATEMENT} draft={draft} />;

export default DataLocationPage;
