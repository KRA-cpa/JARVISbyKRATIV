import React, { useState } from 'react';
import Icons from '../shared/Icons';
import { useCompanies, useRoles, useUserInvites } from '../../hooks/useAPI';
import { formatDateTime } from '../../utils/dateTime';

// Times in Manila (compliance F3)
// v10.1: in the display zone (dateTime.js), not a fixed Manila

/**
 * AdminUserInvites (AppScript v9.6, Admin → Users → Invite)
 *
 * Invite a person by email: on their first Google sign-in with that email the backend creates their user profile
 * and the chosen role assignments (plan §4.12). The email carries only the app address - no token; the verified
 * Google sign-in is the proof. Pending / expired invites can be resent (14 more days) or revoked.
 * The backend checks the admin rule (ADMIN_ONLY); this screen only shows the results.
 */
const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'all', label: 'All' }
];

const STATUS_STYLES = {
  pending: 'bg-blue-100 text-blue-800',
  expired: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  revoked: 'bg-gray-100 text-gray-600'
};

const emptyForm = { email: '', display_name: '', company_id: '', role_ids: [], send_email: true };

const AdminUserInvites = ({ users = [], onClose, notify }) => {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [form, setForm] = useState(emptyForm);
  const [approverId, setApproverId] = useState('');
  const { data: companies } = useCompanies();
  const { data: roles } = useRoles(form.company_id || null);
  const { invites, loading, error, saving, createInvite, resendInvite, revokeInvite } = useUserInvites(statusFilter);

  const companyName = (id) => ((companies || []).find(c => String(c.id) === String(id)) || {}).name || id;
  const availableRoles = (roles || []).filter(r => !r.company_id || String(r.company_id) === String(form.company_id));

  const toggleRole = (roleId) => {
    setForm(prev => ({
      ...prev,
      role_ids: prev.role_ids.includes(roleId) ? prev.role_ids.filter(id => id !== roleId) : [...prev.role_ids, roleId]
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await createInvite({
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        company_id: form.company_id,
        role_grants: form.role_ids.map(roleId => ({ role_id: roleId, company_id: form.company_id })),
        immediate_approver_id: approverId || undefined,
        send_email: form.send_email
      });
      const mailNote = result.email_status === 'sent' ? ' and emailed' : (form.send_email ? ` (email ${result.email_status})` : '');
      notify('success', `Invite created for ${result.email}${mailNote}`);
      setForm(emptyForm);
      setApproverId('');
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleResend = async (invite) => {
    try {
      const result = await resendInvite(invite.id);
      notify(result.email_status === 'sent' ? 'success' : 'warning',
        result.email_status === 'sent' ? `Invite sent again to ${invite.email}` : `Invite extended; email ${result.email_status}`);
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleRevoke = async (invite) => {
    if (!window.confirm(`Revoke the invite for ${invite.email}?`)) return;
    try {
      await revokeInvite(invite.id, 'Revoked by admin');
      notify('success', `Invite for ${invite.email} revoked`);
    } catch (err) {
      notify('error', err.message);
    }
  };

  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Invite users</h3>
          <p className="mt-1 text-sm text-gray-500">
            The person signs in with Google using this email; their profile and roles are created then. Invites last 14 days.
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close invites">
            <Icons.Close size={20} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700">
          Email
          <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            className={inputClass} placeholder="name@company.com" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Display name
          <input type="text" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
            className={inputClass} placeholder="Juan Dela Cruz" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Company
          <select required value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value, role_ids: [] })} className={inputClass}>
            <option value="">Select a company</option>
            {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Immediate approver (optional)
          <select value={approverId} onChange={e => setApproverId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {users.map(u => {
              const id = u.user_id || u.id;
              return <option key={id} value={id}>{u.display_name || u.name || u.email || id}</option>;
            })}
          </select>
        </label>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium text-gray-700">Roles granted on acceptance</legend>
          {!form.company_id ? (
            <p className="mt-1 text-xs text-gray-500">Choose a company first.</p>
          ) : availableRoles.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">No roles for this company.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-3">
              {availableRoles.map(role => (
                <label key={role.id} className="inline-flex items-center text-sm text-gray-700">
                  <input type="checkbox" className="mr-2" checked={form.role_ids.includes(String(role.id))}
                    onChange={() => toggleRole(String(role.id))} />
                  {role.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <label className="inline-flex items-center text-sm text-gray-700 md:col-span-2">
          <input type="checkbox" className="mr-2" checked={form.send_email} onChange={e => setForm({ ...form, send_email: e.target.checked })} />
          Send the invite email now (uses the company's sender name and Reply-To)
        </label>
        <div className="md:col-span-2">
          <button type="submit" disabled={saving}
            className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            <Icons.UserPlus size={16} className="mr-2" />
            {saving ? 'Saving...' : 'Create invite'}
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">Invites</h4>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm" aria-label="Invite status">
            {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading invites...</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-gray-500">No {statusFilter === 'all' ? '' : statusFilter} invites.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
            {invites.map(invite => (
              <li key={invite.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{invite.display_name || invite.email}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs ${STATUS_STYLES[invite.status] || STATUS_STYLES.revoked}`}>{invite.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {invite.email} · {companyName(invite.company_id)} · {(invite.role_grants || []).length} role(s)
                    {invite.expires_at && invite.status === 'pending' ? ` · until ${formatDateTime(invite.expires_at)}` : ''}
                    {invite.send_count ? ` · sent ${invite.send_count}×` : ' · not emailed'}
                  </p>
                </div>
                {(invite.status === 'pending' || invite.status === 'expired') && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleResend(invite)} disabled={saving}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                      <Icons.Refresh size={12} className="mr-1" /> Resend
                    </button>
                    <button type="button" onClick={() => handleRevoke(invite)} disabled={saving}
                      className="inline-flex items-center px-3 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50">
                      <Icons.UserMinus size={12} className="mr-1" /> Revoke
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminUserInvites;
