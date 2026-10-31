import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { API } from '../../api/googleSheet';
import Icons from '../shared/Icons';
import { formatDateTime } from '../../utils/dateTime';

const PAGE_SIZE = 50;
const EMPTY_FILTERS = { actionType: '', targetEntity: '', targetId: '', dateFrom: '', dateTo: '' };

/** A log's details object as "key: value" lines (nested values as JSON). */
const detailLines = (details) => {
  if (details === null || details === undefined || details === '') return [];
  if (typeof details !== 'object') return [String(details)];
  return Object.entries(details).map(([key, value]) =>
    `${key}: ${value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
};

/**
 * AdminAuditLogViewer - Admin -> Audit Log (spec 3.5 Admin Action Logging).
 *
 * Reads admin_action_logs through AppScript v9.2 getAdminActionLogs (admins only - the backend checks the
 * user's roles): every admin change and every login (USER_LOGIN), newest first, filtered by action, entity,
 * target id and date, 50 per page.
 */
const AdminAuditLogViewer = () => {
  const { user } = useUser();
  const userId = user?.uid || user?.id;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const data = await API.AuditLogs.getAdminLogs({ userId, ...applied, limit: PAGE_SIZE, offset });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to load the audit log');
    } finally {
      setLoading(false);
    }
  }, [userId, applied, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = () => {
    setOffset(0);
    setApplied(filters);
  };
  const clear = () => {
    setFilters(EMPTY_FILTERS);
    setOffset(0);
    setApplied(EMPTY_FILTERS);
  };
  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const total = result?.total || 0;
  const logs = result?.logs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
          <p className="mt-1 text-sm text-gray-600">Configuration changes made in the Admin Panel, and user logins</p>
        </div>
        <button onClick={load} className="p-2 rounded text-gray-400 hover:text-gray-600" title="Refresh">
          <Icons.Refresh size={16} />
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
          <select value={filters.actionType} onChange={e => setFilter('actionType', e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Any</option>
            {(result?.action_types || []).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Entity</label>
          <select value={filters.targetEntity} onChange={e => setFilter('targetEntity', e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md">
            <option value="">Any</option>
            {(result?.target_entities || []).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Target id</label>
          <input value={filters.targetId} onChange={e => setFilter('targetId', e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md" placeholder="e.g. tt_1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
          <input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
          <input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)}
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded-md" />
        </div>
        <div className="flex gap-2">
          <button onClick={apply} className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Filter</button>
          <button onClick={clear} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Clear</button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        {error ? (
          <div className="p-6 text-center text-red-600">{error}</div>
        ) : loading && !result ? (
          <div className="p-6 text-center text-gray-600">Loading audit log...</div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No log entries match</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['When', 'Who', 'Action', 'Entity', 'Target', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log, index) => {
                  const key = `${log.id || index}`;
                  const lines = detailLines(log.details);
                  return (
                    <React.Fragment key={key}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatDateTime(log.timestamp)}</td>
                        <td className="px-3 py-2 text-gray-700 break-all">{log.admin_user_id}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{log.action_type}</td>
                        <td className="px-3 py-2 text-gray-700">{log.target_entity}</td>
                        <td className="px-3 py-2 text-gray-700 break-all">{log.target_id}</td>
                        <td className="px-3 py-2 text-right">
                          {lines.length > 0 && (
                            <button onClick={() => setExpanded(expanded === key ? null : key)} className="text-blue-700 hover:underline whitespace-nowrap">
                              {expanded === key ? 'Hide' : 'Details'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === key && (
                        <tr>
                          <td colSpan={6} className="px-3 py-2 bg-gray-50">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all">{lines.join('\n')}</pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>{offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0 || loading}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50">Previous</button>
              <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total || loading}
                className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogViewer;
