import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useTicketList, useDashboard, useNotifications } from '../hooks/useAPI';
import Header from '../components/shared/Header';
import Footer from '../components/shared/Footer';
import Icons from '../components/shared/Icons';
import { RESTRICTED_LABEL, isRestrictedStub } from '../config/labels';
import LiveClock from '../components/shared/LiveClock';
import DEV_CONFIG from '../config/development';
import { formatDateOnly } from '../utils/dateTime';

// Dashboard A (handoff 9 Nov 2026): every number comes from the server's getDashboard counts (compliance F1) and the
// page makes about 2 calls on load - getDashboard + one 10-ticket page; the notifications are shared with the header
// bell (compliance F5). Each card links to the Tickets page filtered the same way.
const RECENT_PAGE_SIZE = 10;
const INBOX_PREVIEW = 5;
const CLOSED_STATUSES = ['Completed', 'Rejected', 'Cancelled'];

const priorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-green-600 bg-green-50 border-green-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const statusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'open': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'in_progress': return 'text-purple-600 bg-purple-50 border-purple-200';
    case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'completed': return 'text-green-600 bg-green-50 border-green-200';
    case 'closed': return 'text-gray-600 bg-gray-50 border-gray-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

// tone: 'alert' (red when > 0), 'highlight' (purple when > 0), 'plain'
const StatCard = ({ label, value, hint, icon: Icon, tone, onClick }) => {
  const active = Number(value) > 0;
  const toneClasses = !active || tone === 'plain'
    ? 'border-gray-200 bg-white'
    : tone === 'alert' ? 'border-red-300 bg-red-50' : 'border-purple-300 bg-purple-50';
  const numberClasses = !active || tone === 'plain'
    ? 'text-gray-900'
    : tone === 'alert' ? 'text-red-700' : 'text-purple-700';
  const iconClasses = tone === 'alert' ? 'text-red-500' : tone === 'highlight' ? 'text-purple-500' : 'text-blue-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${toneClasses}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <Icon size={20} className={iconClasses} />
      </div>
      <p className={`mt-1 text-2xl font-bold ${numberClasses}`}>{value ?? '–'}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </button>
  );
};

const DashboardPage = () => {
  const { user, userRoles, userCompanies, permissions, effectiveZone } = useUser();
  const currentUserId = user?.uid || user?.id;
  // Companies, ticket types, the approver inbox and the counts in one call (AppScript v9.4+ getDashboard)
  const { data: dashboard, loading: dashboardLoading, refetch: refetchDashboard } = useDashboard(currentUserId);
  // One page of the newest tickets - the full list, filters and paging live on the Tickets page
  const {
    data: recentTickets, loading: ticketsLoading, error: ticketsError, refetch: refetchTickets
  } = useTicketList({}, RECENT_PAGE_SIZE);
  // Same query key as the header bell, so this reuses its data instead of a new call
  const { unreadCount } = useNotifications(currentUserId);
  const navigate = useNavigate();

  const companies = dashboard?.companies;
  const ticketTypes = dashboard?.ticket_types;
  const approvalInbox = dashboard?.approval_inbox || [];
  const counts = dashboard?.counts || {};
  const showCount = key => (dashboardLoading && !dashboard ? '…' : (counts[key] ?? 0));

  const [refreshing, setRefreshing] = useState(false);
  const isRefreshing = refreshing || ticketsLoading;

  // Manual refresh: spin for at least 600 ms - a local or failing request can finish
  // before the browser paints, so the loading flag alone would never show the spin
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchTickets(), refetchDashboard(), new Promise(resolve => setTimeout(resolve, 600))]);
    } finally {
      setRefreshing(false);
    }
  };

  const openTicket = id => navigate(`/tickets?ticket=${encodeURIComponent(id)}`);
  const inboxIds = new Set(approvalInbox.map(t => String(t.id)));
  const cards = DEV_CONFIG.DASHBOARD_CARDS;

  const renderTicketRow = (ticket) => {
    const company = companies?.find(c => String(c.id) === String(ticket.company_id));
    const ticketType = ticketTypes?.find(t => String(t.id) === String(ticket.ticket_type_id));
    const isClosed = CLOSED_STATUSES.includes(ticket.status);

    return (
      <div key={ticket.id} className="px-4 py-3 hover:bg-gray-50 transition-colors duration-150">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <Icons.Ticket size={18} className="text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {ticket.ticket_number || `TICKET-${ticket.id}`}
                <span className="ml-2 font-normal text-gray-600">
                  {isRestrictedStub(ticket) ? `🔒 ${RESTRICTED_LABEL}` : (ticket.title || 'No title provided')}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                {company && <span>{company.name}</span>}
                {ticketType && <><span className="text-gray-300">•</span><span>{ticketType.name}</span></>}
                {ticket.step_due_date && !isClosed && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>Step due: {formatDateOnly(ticket.step_due_date, effectiveZone(ticket.company_id))}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColor(ticket.priority)}`}>
              {ticket.priority || 'Normal'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(ticket.status)}`}>
              {ticket.status || 'Open'}
            </span>
            {inboxIds.has(String(ticket.id)) && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium border text-purple-700 bg-purple-50 border-purple-200">
                Your approval
              </span>
            )}
            <button
              onClick={() => openTicket(ticket.id)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
              title="Open in Tickets"
            >
              <Icons.ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <Header
        user={user}
        userRole={userRoles?.[0]?.name?.toLowerCase() || 'user'}
      />

      <main className="flex-1 w-full py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Slim welcome strip - the only clock since the header clock was removed (a9f0f4f) */}
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                Welcome back, {user?.displayName || user?.email?.split('@')[0]}
              </h1>
              <p className="text-xs text-gray-500">
                {userRoles?.[0]?.name || 'User'} · {userCompanies?.length || 0} {userCompanies?.length === 1 ? 'company' : 'companies'}
                {permissions.canAccessAdmin ? ' · Admin access' : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <LiveClock showSeconds={false} showDate={true} showTimezone={true} size="normal" />
              </div>
              <button
                onClick={() => navigate('/tickets')}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-1"
              >
                <Icons.Create size={16} />
                <span>New ticket</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh"
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 disabled:opacity-75 disabled:cursor-wait"
              >
                <Icons.Refresh size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* SLA notices - only when there are unread ones (data shared with the header bell) */}
          {unreadCount > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span className="flex items-center gap-2">
                <Icons.Bell size={16} />
                {unreadCount} unread SLA {unreadCount === 1 ? 'notice' : 'notices'} - open the bell above to read
              </span>
              <button onClick={() => navigate('/tickets?sla=overdue')} className="font-medium underline hover:no-underline whitespace-nowrap">
                Overdue tickets
              </button>
            </div>
          )}

          {/* One row of counts from getDashboard - each card opens the Tickets page with the same filter */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cards.SHOW_FOR_YOUR_APPROVAL && (
              <StatCard label="For your approval" value={showCount('for_my_approval')} hint="Waiting on you"
                icon={Icons.Approval} tone="highlight" onClick={() => navigate('/tickets?show=approval')} />
            )}
            {cards.SHOW_OVERDUE && (
              <StatCard label="Overdue" value={showCount('overdue')} hint="Past the step due date"
                icon={Icons.Overdue} tone="alert" onClick={() => navigate('/tickets?sla=overdue')} />
            )}
            <StatCard label="Due today" value={showCount('due_today')} hint="Step due today"
              icon={Icons.Clock} tone="plain" onClick={() => navigate('/tickets?sla=due_today')} />
            {cards.SHOW_PENDING_APPROVAL && (
              <StatCard label="Open" value={showCount('open')} hint="Not yet closed"
                icon={Icons.Pending} tone="plain" onClick={() => navigate('/tickets')} />
            )}
            {cards.SHOW_MY_TICKETS && (
              <StatCard label="My requests" value={showCount('mine')} hint="Tickets you requested"
                icon={Icons.User} tone="plain" onClick={() => navigate('/tickets?show=mine')} />
            )}
          </div>

          {/* Waiting for your approval - top of the inbox already in getDashboard */}
          {approvalInbox.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-base font-medium text-gray-900">Waiting for your approval</h2>
                {approvalInbox.length > INBOX_PREVIEW && (
                  <button onClick={() => navigate('/tickets?show=approval')} className="text-sm font-medium text-blue-600 hover:underline">
                    See all {approvalInbox.length}
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {approvalInbox.slice(0, INBOX_PREVIEW).map(ticket => (
                  <div key={ticket.id} className="px-4 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {ticket.ticket_number || `TICKET-${ticket.id}`}
                        <span className="ml-2 font-normal text-gray-600">
                          {isRestrictedStub(ticket) ? `🔒 ${RESTRICTED_LABEL}` : (ticket.title || 'No title provided')}
                        </span>
                      </p>
                      {ticket.status && <p className="text-xs text-gray-500">{ticket.status}</p>}
                    </div>
                    <button
                      onClick={() => openTicket(ticket.id)}
                      className="px-3 py-1 text-sm font-medium text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors duration-200 flex-shrink-0"
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent tickets - one page of 10 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900">Recent tickets</h2>
              <button onClick={() => navigate('/tickets')} className="text-sm font-medium text-blue-600 hover:underline">
                See all in Tickets
              </button>
            </div>

            {ticketsLoading && !recentTickets ? (
              <div className="p-6 text-center">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Loading tickets...</p>
              </div>
            ) : ticketsError ? (
              <div className="p-6 text-center">
                <Icons.Warning size={32} className="mx-auto text-red-400 mb-4" />
                <p className="text-red-600 mb-4">Failed to load tickets</p>
                <button
                  onClick={refetchTickets}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            ) : recentTickets?.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {recentTickets.map(renderTicketRow)}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Icons.Ticket size={32} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">No tickets yet</p>
                {currentUserId && (
                  <button
                    onClick={() => navigate('/tickets')}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  >
                    Create First Ticket
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DashboardPage;
