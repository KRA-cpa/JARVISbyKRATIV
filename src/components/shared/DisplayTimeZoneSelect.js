import React, { useMemo } from 'react';
import { listTimeZones, zoneLabel } from '../../utils/dateTime';

/**
 * DisplayTimeZoneSelect (v10.1, design §4 "Profile → Display time zone")
 *
 * How dates are SHOWN to this user. Blank = the company's own zone (the default). The server keeps real UTC and
 * still counts SLA days and ticket years in the company's calendar - this only changes the display.
 * Used by ProfilePage (Preferences) and UserPreferencesPanel. From v10.2 it is gated to Advanced and Enterprise.
 *
 * @param {string} value - The saved display_timezone ('' = the company zone)
 * @param {Function} onChange - (zone) => void, '' for the company zone
 * @param {string} companyZone - The current company's zone (shown on the blank option)
 * @param {string} [className]
 */
const DisplayTimeZoneSelect = ({ value = '', onChange, companyZone, className = '' }) => {
  const zones = useMemo(() => {
    const now = new Date();
    return listTimeZones().map(zone => ({ value: zone, label: `${zone.replace(/_/g, ' ')} (${zoneLabel(zone, now)})` }));
  }, []);
  const known = !value || zones.some(z => z.value === value);

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={className || 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white'}
    >
      <option value="">Company time zone{companyZone ? ` - ${companyZone.replace(/_/g, ' ')} (${zoneLabel(companyZone)})` : ''}</option>
      {!known && <option value={value}>{value}</option>}
      {zones.map(zone => (
        <option key={zone.value} value={zone.value}>{zone.label}</option>
      ))}
    </select>
  );
};

export default DisplayTimeZoneSelect;
