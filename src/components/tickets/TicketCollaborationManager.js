import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../../api/googleSheet';
import { useUsers, useCompanies } from '../../hooks/useAPI';
import Icons from '../shared/Icons';
import { formatDateOnly } from '../../utils/dateTime';

const EMPTY_SHARE = { target: 'user', shared_with_user_id: '', shared_with_company_id: '', permission_level: 'view', expiration_date: '', share_reason: '' };

/**
 * TicketCollaborationManager - the Sharing tab of TicketDetail (AppScript v9.3).
 *
 * Lists who the ticket is shared with and, for the requester or an admin (canShare), shares it with one
 * user or one company - view, or view + comment - optionally until a date, and removes shares. Approving
 * always stays with the workflow's roles. Only shown when the ticket type has sharing turned on.
 *
 * Props: ticketId, companyId, currentUserId, canShare, onCollaborationUpdated()
 */
const TicketCollaborationManager = ({
  ticketId,
  companyId,
  currentUserId,
  canShare = false,
  onCollaborationUpdated,
  className = ''
}) => {
  const { data: users } = useUsers();
  const { data: companies } = useCompanies();
  const [shares, setShares] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_SHARE);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setIsLoading(true);
    setError(null);
    try {
      setShares(await API.Sharing.getForTicket(ticketId));
    } catch (err) {
      setError(err.message || 'Failed to load shares');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleShare = async () => {
    const target = form.target === 'user' ? form.shared_with_user_id : form.shared_with_company_id;
    if (!target) {
      setError(form.target === 'user' ? 'Pick a user' : 'Pick a company');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await API.Sharing.share(ticketId, {
        shared_with_user_id: form.target === 'user' ? form.shared_with_user_id : '',
        shared_with_company_id: form.target === 'company' ? form.shared_with_company_id : '',
        permission_level: form.permission_level,
        expiration_date: form.expiration_date,
        share_reason: form.share_reason
      }, currentUserId);
      setForm(EMPTY_SHARE);
      setShowForm(false);
      await load();
      onCollaborationUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to share the ticket');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async (share) => {
    setIsSaving(true);
    setError(null);
    try {
      await API.Sharing.revoke(share.id, currentUserId, 'Removed in ticket details');
      await load();
      onCollaborationUpdated?.();
    } catch (err) {
      setError(err.message || 'Failed to remove the share');
    } finally {
      setIsSaving(false);
    }
  };

  const userOptions = (users || [])
    .map(u => ({ id: String(u.user_id || u.id), label: u.display_name || u.name || u.email || String(u.user_id || u.id) }))
    .filter(u => u.id && u.id !== String(currentUserId));
  const companyOptions = (companies || []).filter(c => String(c.id) !== String(companyId));
  const canRevoke = share => canShare || String(share.shared_by_user_id) === String(currentUserId);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icons.Users size={18} className="text-gray-500" />
          <h4 className="text-sm font-medium text-gray-900">Shared with {shares.length > 0 && `(${shares.length})`}</h4>
        </div>
        <div className="flex items-center gap-2">
          {(isLoading || isSaving) && <Icons.Loading size={16} className="text-gray-400" />}
          {canShare && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-2 py-1 text-sm font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
            >
              <Icons.Share size={14} className="mr-1" /> Share
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mb-4 p-3 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
          <div className="flex gap-4 text-sm">
            {['user', 'company'].map(target => (
              <label key={target} className="inline-flex items-center">
                <input type="radio" name="share_target" checked={form.target === target} onChange={() => setField('target', target)} className="mr-2" />
                {target === 'user' ? 'A user' : 'A company'}
              </label>
            ))}
          </div>
          {form.target === 'user' ? (
            <select value={form.shared_with_user_id} onChange={e => setField('shared_with_user_id', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
              <option value="">Choose a user...</option>
              {userOptions.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          ) : (
            <select value={form.shared_with_company_id} onChange={e => setField('shared_with_company_id', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
              <option value="">Choose a company...</option>
              {companyOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.permission_level} onChange={e => setField('permission_level', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md">
              <option value="view">Can view</option>
              <option value="comment">Can view and comment</option>
            </select>
            <input type="date" value={form.expiration_date} onChange={e => setField('expiration_date', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md" title="Until (optional)" />
          </div>
          <input type="text" value={form.share_reason} onChange={e => setField('share_reason', e.target.value)}
            placeholder="Why (optional)" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          <p className="text-xs text-gray-600">Approving stays with the workflow's roles - a share only lets them see the ticket.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_SHARE); }} disabled={isSaving}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
            <button onClick={handleShare} disabled={isSaving}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">Share</button>
          </div>
        </div>
      )}

      {shares.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {shares.map(share => (
            <li key={share.id} className="py-2 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                {share.shared_with_user_id
                  ? <Icons.User size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  : <Icons.Building size={16} className="text-green-600 mt-0.5 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {share.shared_with_user_name || share.shared_with_company_name}
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {share.permission_level === 'comment' ? 'view + comment' : 'view'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Shared by {share.shared_by_user_name}
                    {share.shared_at && ` · ${formatDateOnly(share.shared_at)}`}
                    {share.expiration_date && ` · until ${formatDateOnly(share.expiration_date)}`}
                  </p>
                  {share.share_reason && <p className="text-xs text-gray-600">{share.share_reason}</p>}
                </div>
              </div>
              {canRevoke(share) && (
                <button onClick={() => handleRevoke(share)} disabled={isSaving}
                  className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50" title="Remove share">
                  <Icons.UserMinus size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !isLoading && <p className="text-sm text-gray-500">Not shared with anyone</p>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <Icons.Alert size={16} />
          {error}
        </div>
      )}
    </div>
  );
};

export default TicketCollaborationManager;
