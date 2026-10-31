import React, { useMemo, useState } from 'react';
import Icons from '../shared/Icons';
import { useToast } from '../shared/Toast';
import { useCountryCalendars, useCountryHolidays } from '../../hooks/useAPI';
import { DEFAULT_ZONE, formatDateOnly, listTimeZones, zoneLabel } from '../../utils/dateTime';

/**
 * AdminCountryCalendars (AppScript v10.1, design §4 "Platform → Country calendars")
 *
 * Per country: the reference zone (its ticket YEAR), the zones its companies may use, the weekend days, default
 * business hours, and its holidays (built-in pack for the Philippines, CSV import for any country). A company picks
 * its country + zone in Admin → Companies → Region. The server validates every value and logs each change; from
 * v10.2 this screen is for platform admins.
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY_FORM = { country_code: '', name: '', calendar_tz: '', allowed_timezones: [], weekend_days: [0, 6], start: '08:00', end: '17:00' };
const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/** "2026-12-25,Christmas Day" lines (or tab separated, a header row is skipped) -> [{ date, name }] */
export const parseHolidayLines = text => String(text || '').split(/\r?\n/)
  .map(line => line.trim()).filter(Boolean)
  .map(line => {
    const [date, ...rest] = line.split(/\t|,/);
    return { date: (date || '').trim(), name: rest.join(',').trim().replace(/^"|"$/g, '') };
  })
  .filter(row => !/^date$/i.test(row.date));

const AdminCountryCalendars = () => {
  const { ToastContainer, success, error: showError } = useToast();
  const { calendars, loading, error, saving, save, importHolidays, addBuiltInHolidays } = useCountryCalendars();
  const zones = useMemo(() => listTimeZones(), []);
  const [form, setForm] = useState(null); // null = list only; EMPTY_FORM = add; a calendar = edit
  const [selected, setSelected] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { data: holidays, refetch: refetchHolidays } = useCountryHolidays(selected || null, year);
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState(null);

  const edit = calendar => setForm(calendar ? {
    editing: true,
    country_code: calendar.country_code, name: calendar.name, calendar_tz: calendar.calendar_tz,
    allowed_timezones: calendar.allowed_timezones.filter(z => z !== calendar.calendar_tz),
    weekend_days: calendar.weekend_days, start: calendar.default_business_hours.start, end: calendar.default_business_hours.end
  } : { ...EMPTY_FORM });

  const toggleWeekend = day => setForm(f => ({
    ...f, weekend_days: f.weekend_days.includes(day) ? f.weekend_days.filter(d => d !== day) : f.weekend_days.concat(day).sort()
  }));

  const handleSave = async event => {
    event.preventDefault();
    try {
      const saved = await save({
        country_code: form.country_code.trim().toUpperCase(), name: form.name.trim(), calendar_tz: form.calendar_tz,
        allowed_timezones: [form.calendar_tz].concat(form.allowed_timezones), weekend_days: form.weekend_days,
        default_business_hours: { start: form.start, end: form.end }
      });
      success(`Calendar for ${saved.country_code} saved`);
      setForm(null);
    } catch (err) {
      showError(err.message);
    }
  };

  const runImport = async dryRun => {
    try {
      const rows = parseHolidayLines(csv);
      if (!rows.length) {
        showError('Paste one holiday per line: yyyy-MM-dd,Name');
        return;
      }
      const result = await importHolidays(selected, rows, dryRun);
      setPreview(dryRun ? { kind: 'import', ...result } : null);
      if (!dryRun) {
        success(`${result.added} holiday(s) added to ${selected}`);
        setCsv('');
        refetchHolidays();
      }
    } catch (err) {
      showError(err.message);
    }
  };

  const runBuiltIn = async dryRun => {
    try {
      const result = await addBuiltInHolidays(selected, Number(year), dryRun);
      setPreview(dryRun ? { kind: 'builtin', ...result } : null);
      if (!dryRun) {
        success(`${result.added} holiday(s) added to ${selected}`);
        refetchHolidays();
      }
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Country calendars</h2>
          <p className="text-sm text-gray-600">
            A company follows its country's calendar: the ticket year, weekends and holidays. Its own time zone (one of
            the country's zones) is set in Companies → Region. Companies without a region use the Philippines ({DEFAULT_ZONE}).
          </p>
        </div>
        <button onClick={() => edit(null)} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Icons.Plus size={16} className="mr-1" /> Add country
        </button>
      </div>

      {form && (
        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm font-medium text-gray-700">
            Country code (ISO, 2 letters)
            <input value={form.country_code} maxLength={2} disabled={Boolean(form.editing)}
              onChange={e => setForm({ ...form, country_code: e.target.value.toUpperCase() })} className={inputClass} placeholder="SG" required />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Name
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Singapore" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Reference time zone (the ticket year)
            <select value={form.calendar_tz} onChange={e => setForm({ ...form, calendar_tz: e.target.value })} className={inputClass} required>
              <option value="">Choose...</option>
              {zones.map(z => <option key={z} value={z}>{z} ({zoneLabel(z)})</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Other zones companies may use (Ctrl / Cmd for several)
            <select multiple value={form.allowed_timezones} size={4}
              onChange={e => setForm({ ...form, allowed_timezones: Array.from(e.target.selectedOptions).map(o => o.value) })} className={inputClass}>
              {zones.filter(z => z !== form.calendar_tz).map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <div className="text-sm font-medium text-gray-700">
            Weekend days
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((label, day) => (
                <label key={label} className="inline-flex items-center gap-1 font-normal">
                  <input type="checkbox" checked={form.weekend_days.includes(day)} onChange={() => toggleWeekend(day)} /> {label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Business hours from
              <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              to
              <input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} className={inputClass} />
            </label>
          </div>
          <p className="md:col-span-2 text-xs text-gray-500">
            Changing a calendar moves the ticket year, weekends and holidays of every company in that country - it is logged.
          </p>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 bg-white border rounded-lg text-gray-700">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {loading && <p className="p-4 text-sm text-gray-500">Loading calendars...</p>}
        {error && <p className="p-4 text-sm text-red-700">{error}</p>}
        {calendars.map(c => (
          <div key={c.country_code} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 ${selected === c.country_code ? 'bg-blue-50' : ''}`}>
            <div className="text-sm">
              <p className="font-medium text-gray-900">{c.country_code} - {c.name || c.country_code}</p>
              <p className="text-gray-600">
                Year in {c.calendar_tz} ({zoneLabel(c.calendar_tz)}) · weekend {c.weekend_days.map(d => WEEKDAYS[d]).join(' / ') || 'none'} ·
                hours {c.default_business_hours.start}-{c.default_business_hours.end}
              </p>
              {c.allowed_timezones.length > 1 && <p className="text-xs text-gray-500">Company zones: {c.allowed_timezones.join(', ')}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setSelected(c.country_code); setPreview(null); }} className="px-3 py-1 text-sm border rounded-lg text-gray-700 hover:bg-gray-50">Holidays</button>
              <button onClick={() => edit(c)} className="px-3 py-1 text-sm border rounded-lg text-gray-700 hover:bg-gray-50">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <h3 className="text-base font-semibold text-gray-900 mr-auto">Holidays - {selected}</h3>
            <label className="text-sm text-gray-700">
              Year
              <input type="number" value={year} onChange={e => setYear(e.target.value)} className={`${inputClass} w-28`} />
            </label>
            {selected === 'PH' && (
              <button onClick={() => runBuiltIn(true)} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
                Philippine holidays for {year}...
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Import (one per line: yyyy-MM-dd,Name - a CSV or two columns pasted from a sheet)
              <textarea rows={4} value={csv} onChange={e => setCsv(e.target.value)} className={inputClass}
                placeholder={'2026-12-02,National Day\n2026-12-25,Christmas Day'} />
            </label>
            <button onClick={() => runImport(true)} disabled={!csv.trim()} className="mt-2 px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">
              Check the list...
            </button>
          </div>

          {preview && (
            <div className="p-4 bg-blue-50 rounded-lg text-sm space-y-2">
              {preview.kind === 'builtin' ? (
                <>
                  <p className="text-blue-800">{preview.holidays.filter(h => !h.exists).length} to add (Eid holidays and Chinese New Year are proclaimed each year - import them):</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-blue-900">
                    {preview.holidays.map(h => <li key={h.date} className={h.exists ? 'opacity-50' : ''}>{h.date} - {h.name}{h.exists ? ' (already there)' : ''}</li>)}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-blue-800">{preview.would_add} new holiday(s); days already there are skipped.</p>
                  {preview.errors.length > 0 && <p className="text-red-700">{preview.errors.slice(0, 5).join('; ')}</p>}
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => (preview.kind === 'builtin' ? runBuiltIn(false) : runImport(false))} className="px-3 py-1 bg-blue-600 text-white rounded-lg">Add them</button>
                <button onClick={() => setPreview(null)} className="px-3 py-1 bg-white border rounded-lg text-gray-700">Cancel</button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {(holidays || []).map(h => (
              <div key={h.id} className="py-2 text-sm flex justify-between">
                <span>{formatDateOnly(h.date)} - {h.name}</span>
                <span className="text-gray-400">{h.type}</span>
              </div>
            ))}
            {(holidays || []).length === 0 && <p className="py-2 text-sm text-gray-500">No holidays for {year}.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCountryCalendars;
