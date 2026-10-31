import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useTicketTypes, useCompanies, useTicketLookup } from '../../hooks/useAPI';
import { API } from '../../api/googleSheet';
import { downloadCSV } from '../../utils/csvExport';
import Icons from '../shared/Icons';
import TicketDetail from './TicketDetail';

const SLA_COLORS = {
  Overdue: 'bg-red-100 text-red-800',
  'Due Today': 'bg-yellow-100 text-yellow-800',
  'On Track': 'bg-green-100 text-green-800',
  Closed: 'bg-gray-100 text-gray-700',
  'No SLA': 'bg-gray-100 text-gray-500'
};

const DATE_COLUMNS = ['created_at', 'updated_at', 'step_due_date'];

/**
 * TicketReport - the /reports screen (spec 3.4 Reporting).
 *
 * Pick a ticket type (columns come from its report configuration - Admin -> Reports - via AppScript v9.2
 * getReportData), optionally a company, status and created-date range, then view the rows, open a ticket's
 * details and workflow history, or export the rows to CSV. Admins see every ticket; others see the tickets
 * they can see (AppScript v10.0 canViewTicket - the backend decides). Without dates the backend reports the last 90
 * days (max 1 year, 5,000 rows).
 */
const TicketReport = () => {
  const { user } = useUser();
  const userId = user?.uid || user?.id;
  const { data: ticketTypes } = useTicketTypes();
  const { data: companies } = useCompanies();

  const [criteria, setCriteria] = useState({ ticketTypeId: '', companyId: '', status: '', dateFrom: '', dateTo: '' });
  const [report, setReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [openTicketId, setOpenTicketId] = useState(null);

  // v10.0: the opened ticket is fetched on its own (the report no longer loads every ticket)
  const { data: lookedUp, refetch: refetchOpenTicket } = useTicketLookup(openTicketId);
  const openTicket = openTicketId && lookedUp && String(lookedUp.id) === String(openTicketId) ? lookedUp : null;
  const ticketType = (ticketTypes || []).find(t => String(t.id) === String(criteria.ticketTypeId));

  const setCriterion = (key, value) => setCriteria(prev => ({ ...prev, [key]: value }));

  const runReport = async () => {
    if (!criteria.ticketTypeId) {
      setError('Pick a ticket type');
      return;
    }
    setRunning(true);
    setError('');
    try {
      const data = await API.Reports.getData({ userId, ...criteria });
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to run the report');
      setReport(null);
    } finally {
      setRunning(false);
    }
  };

  const displayValue = (column, value) => {
    if (DATE_COLUMNS.includes(column.field_name) && value) {
      const date = new Date(value);
      return isNaN(date) ? value : date.toLocaleString();
    }
    return value;
  };

  const exportCSV = () => {
    if (!report) return;
    // Dates as shown on screen; the CSV keeps the column names chosen in the report configuration
    const rows = report.rows.map(row => {
      const out = { ...row };
      report.columns.forEach(c => { out[c.field_name] = displayValue(c, row[c.field_name]); });
      return out;
    });
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadCSV(`report-${ticketType?.code || 'tickets'}-${day}.csv`, report.columns, rows);
  };

  return (
    <div className="space-y-6">
      {openTicket && (
        <TicketDetail
          ticket={openTicket}
          onClose={() => setOpenTicketId(null)}
          onStatusChange={() => { refetchOpenTicket(); runReport(); }}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
        <p className="text-gray-600">Ticket status reports per ticket type, with CSV export</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticket type *</label>
            <select
              value={criteria.ticketTypeId}
              onChange={e => setCriterion('ticketTypeId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose...</option>
              {(ticketTypes || []).map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <select
              value={criteria.companyId}
              onChange={e => setCriterion('companyId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All companies</option>
              {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={criteria.status}
              onChange={e => setCriterion('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any</option>
              <option value="open">Open</option>
              <option value="closed">Closed (completed, rejected, cancelled)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:col-span-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input type="date" value={criteria.dateFrom} onChange={e => setCriterion('dateFrom', e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input type="date" value={criteria.dateTo} onChange={e => setCriterion('dateTo', e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runReport}
              disabled={running || !userId}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {running ? <Icons.Loading size={16} className="mr-2" /> : <Icons.Search size={16} className="mr-2" />}
              Run
            </button>
            <button
              onClick={exportCSV}
              disabled={!report || report.rows.length === 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Export to CSV"
            >
              <Icons.Download size={16} className="mr-1" /> CSV
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {report && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <span>
              {report.total} ticket{report.total !== 1 ? 's' : ''}
              {!criteria.dateFrom && !criteria.dateTo ? ' · last 90 days' : ''}
            </span>
            <span>
              {report.scope === 'all' ? 'All tickets (admin)' : 'Tickets you can see'}
              {report.config_source === 'default' ? ' · default columns' : ''}
            </span>
          </div>
          {report.truncated && (
            <div className="px-4 py-2 text-sm bg-amber-50 text-amber-800 border-b border-amber-200">
              Only the first {report.total} tickets are shown - narrow the dates to see the rest.
            </div>
          )}
          {report.rows.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No tickets match</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {report.columns.map(c => (
                      <th key={c.field_name} className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">{c.display_name}</th>
                    ))}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.rows.map(row => (
                    <tr key={row.ticket_id} className="hover:bg-gray-50">
                      {report.columns.map(c => (
                        <td key={c.field_name} className="px-3 py-2 text-gray-800 align-top">
                          {c.field_name === 'sla_status' ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SLA_COLORS[row.sla_status] || 'bg-gray-100 text-gray-700'}`}>
                              {row.sla_status}
                            </span>
                          ) : displayValue(c, row[c.field_name])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setOpenTicketId(row.ticket_id)}
                          className="inline-flex items-center text-blue-700 hover:underline whitespace-nowrap"
                          title="Ticket details and workflow history"
                        >
                          <Icons.View size={14} className="mr-1" /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TicketReport;
