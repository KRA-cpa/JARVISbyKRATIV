import React, { useEffect, useState } from 'react';
import Icons from '../shared/Icons';
import { useCompanyRegion, useCountryCalendars } from '../../hooks/useAPI';
import { DEFAULT_COUNTRY } from '../../config/timeZones';
import { formatDateTime, zoneLabel } from '../../utils/dateTime';

/**
 * CompanyRegionSettings (AppScript v10.1, Admin → Companies → Region; design §4)
 *
 * The company's country (its calendar: ticket year, weekends, holidays) and its time zone (one of the country's zones:
 * SLA business hours, "due today", dates on screen). Blank = Philippines / Asia/Manila. Once the company has tickets
 * (code locked), changing the COUNTRY moves its ticket year and holidays, so the server asks for a reason and logs
 * it (from v10.2 a platform admin only). Changing only the zone is allowed any time.
 */
const CompanyRegionSettings = ({ company, onClose, notify, isLocked = false }) => {
  const { calendars, loading } = useCountryCalendars();
  const { saving, setRegion } = useCompanyRegion();
  const [country, setCountry] = useState(company?.country_code || DEFAULT_COUNTRY);
  const [zone, setZone] = useState(company?.timezone || '');
  const [reason, setReason] = useState('');

  const calendar = calendars.find(c => c.country_code === country);
  const zones = calendar ? calendar.allowed_timezones : [];
  const countryChanged = country !== (company?.country_code || DEFAULT_COUNTRY);
  const needsReason = isLocked && countryChanged;

  // A zone that isn't one of the chosen country's zones falls back to the country's reference zone
  useEffect(() => {
    if (calendar && !calendar.allowed_timezones.includes(zone)) setZone(calendar.calendar_tz);
  }, [calendar, zone]);

  const handleSave = async event => {
    event.preventDefault();
    try {
      await setRegion(company.id, { country_code: country, timezone: zone, reason: reason.trim() || undefined });
      notify('success', `Region saved for ${company.name}: ${country} / ${zone}`);
      onClose(true);
    } catch (err) {
      notify('error', err.message);
    }
  };

  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Region - {company.name}</h3>
          <p className="mt-1 text-sm text-gray-500">
            Country calendar (ticket year, weekends, holidays) and the company's time zone (business hours, dates).
          </p>
        </div>
        <button type="button" onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close region settings">
          <Icons.Close size={20} />
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading calendars...</p>
      ) : (
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Country
            <select value={country} onChange={e => setCountry(e.target.value)} className={inputClass}>
              {calendars.map(c => <option key={c.country_code} value={c.country_code}>{c.country_code} - {c.name || c.country_code}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-gray-500">Add countries in Country calendars.</span>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Time zone
            <select value={zone} onChange={e => setZone(e.target.value)} className={inputClass}>
              {zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')} ({zoneLabel(z)})</option>)}
            </select>
            {zone && <span className="mt-1 block text-xs font-normal text-gray-500">Now there: {formatDateTime(new Date(), zone)}</span>}
          </label>
          {needsReason && (
            <label className="block text-sm font-medium text-gray-700 md:col-span-2">
              Reason (required: the company has tickets - its ticket year and holidays move to the new country)
              <input value={reason} onChange={e => setReason(e.target.value)} className={inputClass} required />
            </label>
          )}
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={saving || !zone || (needsReason && !reason.trim())}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              <Icons.Save size={16} className="mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CompanyRegionSettings;
