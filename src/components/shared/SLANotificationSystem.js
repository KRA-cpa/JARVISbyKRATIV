import React, { useEffect, useMemo, useRef } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useTickets, useNotifications } from '../../hooks/useAPI';
import { useToast } from './Toast';
import Icons from './Icons';
import { getSLAStatus } from '../../utils/slaCalculator';

const SLA_TYPES = ['sla_warning', 'sla_overdue', 'sla_escalated'];
const manilaTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const formatTime = iso => {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? '' : manilaTime.format(date);
};

/**
 * SLA Notification System (Dashboard)
 *
 * Shows the SLA picture and the signed-in user's SLA notices. The escalations themselves run on the server
 * (AppScript v9.5 runSLAEscalations, every 15 minutes) and land in the user's notifications - this component
 * only reads them (compliance F1). New unread notices pop up once as a toast.
 */
const SLANotificationSystem = () => {
  const { user, hasPermission } = useUser();
  const userId = user?.uid || user?.id;
  const { data: tickets } = useTickets({ status: 'open' }); // v10.0: open tickets only, read page by page
  const { notifications, markRead } = useNotifications(userId);
  // Its own toast container: useToast keeps its toasts in this component's state
  const { ToastContainer, warning, error } = useToast();
  const shown = useRef(null);

  const shouldShow = hasPermission('canViewTickets') || hasPermission('canApproveTickets');

  // Statuses are 'Completed' / 'Rejected' / 'Cancelled' (AppScript TERMINAL_TICKET_STATUSES)
  const stats = useMemo(() => {
    const active = (tickets || []).filter(ticket =>
      ticket.step_due_date && !['completed', 'closed', 'rejected', 'cancelled'].includes(String(ticket.status || '').toLowerCase()));
    const statuses = active.map(ticket => getSLAStatus(ticket.step_due_date).type);
    return {
      ticketsMonitored: active.length,
      overdueTickets: statuses.filter(type => type === 'overdue').length,
      dueTodayTickets: statuses.filter(type => type === 'due_today').length
    };
  }, [tickets]);

  const slaNotices = notifications.filter(n => SLA_TYPES.includes(n.type));
  const unreadSla = slaNotices.filter(n => !n.is_read).map(n => n.id);

  // A toast for each unread SLA notice that arrived since the page opened (the first load only marks them seen)
  useEffect(() => {
    if (!notifications.length) return;
    if (shown.current === null) {
      shown.current = new Set(notifications.map(n => n.id));
      return;
    }
    notifications.filter(n => !n.is_read && SLA_TYPES.includes(n.type) && !shown.current.has(n.id)).forEach(n => {
      shown.current.add(n.id);
      (n.type === 'sla_warning' ? warning : error)(`${n.title}: ${n.message}`);
    });
    // warning / error are new each render; listing them would re-run this on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  if (!shouldShow) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <ToastContainer />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <h3 className="text-lg font-medium text-gray-900">SLA Monitoring</h3>
        </div>
        {unreadSla.length > 0 && (
          <button
            onClick={() => markRead(unreadSla)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Mark SLA notices read
          </button>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.ticketsMonitored}</div>
          <div className="text-sm text-gray-600">With an SLA</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats.overdueTickets}</div>
          <div className="text-sm text-gray-600">Overdue</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.dueTodayTickets}</div>
          <div className="text-sm text-gray-600">Due Today</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{unreadSla.length}</div>
          <div className="text-sm text-gray-600">Unread notices</div>
        </div>
      </div>

      {/* Recent SLA notices */}
      {slaNotices.length > 0 ? (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Your SLA notices</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {slaNotices.slice(0, 5).map(notice => (
              <div
                key={notice.id}
                className={`p-2 rounded-lg text-xs ${
                  notice.type === 'sla_warning' ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-700'
                } ${notice.is_read ? 'opacity-60' : ''}`}
              >
                <div className="font-medium">{notice.title}</div>
                <div className="truncate">{notice.message}</div>
                <div className="text-gray-500 mt-1">{formatTime(notice.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2 p-3 bg-green-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Icons.Success size={16} className="text-green-600" />
            <span className="text-sm text-green-700">
              No SLA notices for you. The server checks every ticket's SLA every 15 minutes.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SLANotificationSystem;
