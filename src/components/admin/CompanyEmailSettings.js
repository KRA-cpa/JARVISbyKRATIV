import React, { useEffect, useState } from 'react';
import Icons from '../shared/Icons';
import { useCompanyEmailSettings } from '../../hooks/useAPI';

/**
 * CompanyEmailSettings (AppScript v9.6, Admin → Companies → Email)
 *
 * Per company: SLA email on / off (overrides each ticket type's setting; "default" keeps the ticket type / global
 * rule), sender name, Reply-To, optional CC (up to 5) and a footer, plus a test email. Mail still goes out from the
 * script owner's Google address (MailApp name / replyTo - no extra permission); the backend validates and decides.
 */
const MODE_LABELS = {
  default: 'Default - follow each ticket type / the global setting',
  on: 'On - email SLA notices for every ticket type',
  off: 'Off - in-app notices only'
};

const CompanyEmailSettings = ({ company, onClose, notify }) => {
  const { settings, loading, error, saving, save, sendTest } = useCompanyEmailSettings(company?.id);
  const [form, setForm] = useState({ email_enabled: 'default', email_sender_name: '', email_reply_to: '', email_cc: '', email_footer: '' });
  const [testTo, setTestTo] = useState('');

  useEffect(() => {
    if (settings) {
      setForm({
        email_enabled: settings.email_enabled || 'default',
        email_sender_name: settings.email_sender_name || '',
        email_reply_to: settings.email_reply_to || '',
        email_cc: settings.email_cc || '',
        email_footer: settings.email_footer || ''
      });
    }
  }, [settings]);

  const handleSave = async (event) => {
    event.preventDefault();
    try {
      await save(form);
      notify('success', `Email settings saved for ${company.name}`);
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleTest = async () => {
    try {
      const result = await sendTest(testTo.trim());
      notify('success', `Test email sent to ${result.to}`);
    } catch (err) {
      notify('error', err.message);
    }
  };

  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Email settings - {company.name}</h3>
          <p className="mt-1 text-sm text-gray-500">
            Used for SLA notices and invite emails of this company. Mail is sent from the system's Google account.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close email settings">
          <Icons.Close size={20} />
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading settings...</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 md:col-span-2">
            SLA email
            <select value={form.email_enabled} onChange={e => setForm({ ...form, email_enabled: e.target.value })} className={inputClass}>
              {Object.keys(MODE_LABELS).map(mode => <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>)}
            </select>
            {form.email_enabled === 'default' && settings && (
              <span className="mt-1 block text-xs font-normal text-gray-500">Global default is {settings.global_default}.</span>
            )}
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Sender name
            <input type="text" maxLength={100} value={form.email_sender_name} placeholder="e.g. Main Co Helpdesk"
              onChange={e => setForm({ ...form, email_sender_name: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Reply-To
            <input type="email" value={form.email_reply_to} placeholder="helpdesk@company.com"
              onChange={e => setForm({ ...form, email_reply_to: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700 md:col-span-2">
            CC (optional, up to 5, comma separated)
            <input type="text" value={form.email_cc} placeholder="audit@company.com, lead@company.com"
              onChange={e => setForm({ ...form, email_cc: e.target.value })} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700 md:col-span-2">
            Footer
            <textarea rows={3} maxLength={1000} value={form.email_footer} placeholder="Company name, address, disclaimer"
              onChange={e => setForm({ ...form, email_footer: e.target.value })} className={inputClass} />
          </label>
          <div className="md:col-span-2 flex flex-wrap items-end gap-3">
            <button type="submit" disabled={saving}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              <Icons.Save size={16} className="mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <label className="block text-sm font-medium text-gray-700">
              Test email to
              <input type="email" value={testTo} placeholder="your own address"
                onChange={e => setTestTo(e.target.value)} className={inputClass} />
            </label>
            <button type="button" onClick={handleTest} disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
              <Icons.Bell size={16} className="mr-2" />
              Send test email
            </button>
            {settings && (
              <span className="text-xs text-gray-500">Emails left today: {settings.quota_remaining}</span>
            )}
          </div>
          <p className="md:col-span-2 text-xs text-gray-500">The test uses the saved settings - save first.</p>
        </form>
      )}
    </div>
  );
};

export default CompanyEmailSettings;
