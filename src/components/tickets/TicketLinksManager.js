import React, { useState } from 'react';
import Icons from '../shared/Icons';
import { useTicketAttachments } from '../../hooks/useAPI';
import { formatDateTime } from '../../utils/dateTime';

/**
 * TicketLinksManager (AppScript v9.6, TicketDetail → Links)
 *
 * Links on a ticket (URL + name, optional description): no upload, no Drive permission. The server decides who may
 * add / remove / fix (requester, current approvers, admin - it returns can_manage) and checks the URL: from AppScript
 * v9.7 https on an allowed host only (Script Property LINK_ALLOWED_HOSTS, default docs.google.com + drive.google.com),
 * and a name. A link saved earlier on another host comes back with link_allowed: false and is shown as plain text. Anyone who can see the ticket may report a link broken; a reported link can then be fixed in place by
 * someone who can manage links - also on a closed ticket - and the fix clears the report (plan §4.13).
 * Mounted only while the Links tab is open, so opening a ticket costs no extra call (F5).
 */
// v10.1: in the display zone (dateTime.js)
const formatWhen = (iso) => formatDateTime(iso);
const isWebLink = (url) => /^https?:\/\//i.test(String(url || '').trim());

const TicketLinksManager = ({ ticketId, nameOf = (id) => id, notify }) => {
  const { attachments, canManage, closed, loading, error, saving, addLink, removeLink, reportBroken, fixLink } = useTicketAttachments(ticketId);
  const [form, setForm] = useState({ fileUrl: '', fileName: '', description: '' });
  const [reporting, setReporting] = useState(null); // attachment id
  const [reportNote, setReportNote] = useState('');
  const [fixing, setFixing] = useState(null); // { id, fileUrl, fileName, description }

  const run = async (fn, message) => {
    try {
      await fn();
      notify('success', message);
      return true;
    } catch (err) {
      notify('error', err.message);
      return false;
    }
  };

  // The name is required (user, 31 Oct 2026); the server enforces it from AppScript v10.0
  const nameMissing = (name) => {
    if (String(name || '').trim()) return false;
    notify('error', 'Enter a name for the link');
    return true;
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (nameMissing(form.fileName)) return;
    if (await run(() => addLink({ ...form, fileName: form.fileName.trim() }), 'Link added')) setForm({ fileUrl: '', fileName: '', description: '' });
  };

  const handleReport = async (id) => {
    if (await run(() => reportBroken(id, reportNote.trim()), 'Link reported broken')) {
      setReporting(null);
      setReportNote('');
    }
  };

  const handleFix = async (event) => {
    event.preventDefault();
    if (nameMissing(fixing.fileName)) return;
    if (await run(() => fixLink(fixing.id, { ...fixing, fileName: fixing.fileName.trim() }), 'Link fixed')) setFixing(null);
  };

  const handleRemove = async (link) => {
    if (!window.confirm(`Remove the link "${link.file_name}"?`)) return;
    await run(() => removeLink(link.id, 'Removed from ticket'), 'Link removed');
  };

  const inputClass = 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const canAdd = canManage && !closed;

  if (loading) return <p className="text-sm text-gray-500">Loading links...</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;

  return (
    <div className="space-y-6">
      {attachments.length === 0 ? (
        <div className="text-center py-6">
          <Icons.Link size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">No links on this ticket yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
          {attachments.map(link => {
            const reported = link.link_status === 'reported_broken';
            return (
              <li key={link.id} className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icons.Link size={14} className="text-gray-500 flex-shrink-0" />
                      {/* AppScript v9.7: a link on a host that isn't allowed (saved earlier) is never clickable */}
                      {link.link_allowed !== false && isWebLink(link.file_url) ? (
                        <a href={link.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate">
                          {link.file_name || link.file_url}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-gray-900 truncate">{link.file_name}</span>
                      )}
                      {reported && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">🔗 Reported broken</span>
                      )}
                      {link.link_allowed === false && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800"
                          title={link.file_url}>⚠️ Not an allowed domain - not opened</span>
                      )}
                    </div>
                    {link.description && <p className="text-xs text-gray-600 mt-1">{link.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">Added by {nameOf(link.uploader_id)} · {formatWhen(link.created_at)}</p>
                    {reported && (
                      <p className="text-xs text-red-700 mt-1">
                        Reported by {nameOf(link.reported_by)} · {formatWhen(link.reported_at)}{link.report_note ? ` - ${link.report_note}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {reporting !== link.id && (
                      <button type="button" onClick={() => { setReporting(link.id); setReportNote(link.report_note || ''); }} disabled={saving}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                        <Icons.AlertTriangle size={12} className="mr-1" /> {reported ? 'Update report' : 'Report broken'}
                      </button>
                    )}
                    {reported && canManage && (!fixing || fixing.id !== link.id) && (
                      <button type="button" disabled={saving}
                        onClick={() => setFixing({ id: link.id, fileUrl: link.file_url, fileName: link.file_name, description: link.description })}
                        className="inline-flex items-center px-3 py-1 border border-blue-300 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50">
                        <Icons.Edit size={12} className="mr-1" /> Fix link
                      </button>
                    )}
                    {canAdd && (
                      <button type="button" onClick={() => handleRemove(link)} disabled={saving}
                        className="inline-flex items-center px-3 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50">
                        <Icons.Delete size={12} className="mr-1" /> Remove
                      </button>
                    )}
                  </div>
                </div>

                {reporting === link.id && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" maxLength={500} value={reportNote} onChange={e => setReportNote(e.target.value)}
                      placeholder="What's wrong? (e.g. 404, no access)" className={`${inputClass} flex-1 min-w-[12rem]`} />
                    <button type="button" onClick={() => handleReport(link.id)} disabled={saving}
                      className="px-3 py-2 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">Report</button>
                    <button type="button" onClick={() => setReporting(null)} className="px-3 py-2 text-xs text-gray-600">Cancel</button>
                  </div>
                )}

                {fixing && fixing.id === link.id && (
                  <form onSubmit={handleFix} className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input type="url" required value={fixing.fileUrl} onChange={e => setFixing({ ...fixing, fileUrl: e.target.value })}
                      placeholder="https://docs.google.com/... or https://drive.google.com/..." className={`${inputClass} md:col-span-2`} aria-label="New URL" />
                    <input type="text" required maxLength={200} value={fixing.fileName} onChange={e => setFixing({ ...fixing, fileName: e.target.value })}
                      placeholder="Name (required)" className={inputClass} aria-label="Name" />
                    <input type="text" maxLength={1000} value={fixing.description} onChange={e => setFixing({ ...fixing, description: e.target.value })}
                      placeholder="Description (optional)" className={inputClass} aria-label="Description" />
                    <div className="md:col-span-2 flex gap-2">
                      <button type="submit" disabled={saving}
                        className="px-3 py-2 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Save fix</button>
                      <button type="button" onClick={() => setFixing(null)} className="px-3 py-2 text-xs text-gray-600">Cancel</button>
                      {closed && <span className="text-xs text-gray-500 self-center">The ticket is closed: the fix is logged.</span>}
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canAdd ? (
        <form onSubmit={handleAdd} className="border border-gray-200 rounded-md p-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <h4 className="md:col-span-2 text-sm font-medium text-gray-900">Add a link</h4>
          <input type="url" required value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })}
            placeholder="https://docs.google.com/... or https://drive.google.com/..." className={`${inputClass} md:col-span-2`} aria-label="URL" />
          <p className="md:col-span-2 -mt-2 text-xs text-gray-500">Google Docs, Sheets, Slides and Drive links only (https).</p>
          <input type="text" required maxLength={200} value={form.fileName} onChange={e => setForm({ ...form, fileName: e.target.value })}
            placeholder="Name (required, e.g. Quotation)" className={inputClass} aria-label="Name" />
          <input type="text" maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)" className={inputClass} aria-label="Description" />
          <div className="md:col-span-2">
            <button type="submit" disabled={saving}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              <Icons.Plus size={16} className="mr-2" /> {saving ? 'Saving...' : 'Add link'}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-gray-500">
          {closed ? 'This ticket is closed: links can only be fixed after a broken-link report.' : 'Only the requester, the current approvers or an admin can add links. You can report a link broken.'}
        </p>
      )}
    </div>
  );
};

export default TicketLinksManager;
