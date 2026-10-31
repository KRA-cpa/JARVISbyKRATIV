import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useTickets, useDashboard } from '../hooks/useAPI';
import { useToast } from '../components/shared/Toast';
import { useInformation } from '../components/shared/ConfirmationModal';
import Header from '../components/shared/Header';
import Footer from '../components/shared/Footer';
import Icons from '../components/shared/Icons';
import { RESTRICTED_LABEL, isRestrictedStub } from '../config/labels';
import { DetailedClock } from '../components/shared/LiveClock';
// SLA widgets (spec 3.4: SLA status clearly visible) - a click opens /tickets filtered to that SLA status
import { SLASummaryWidgets } from '../components/shared/SLAWidgets';
import SLANotificationSystem from '../components/shared/SLANotificationSystem';
import DEV_CONFIG from '../config/development';

const DashboardPage = () => {
  const { user, userRoles, userCompanies, permissions, hasPermission } = useUser();
  // The ticket list is shared with the SLA widgets (one getTickets per load - identical reads are deduplicated)
  const { data: tickets, loading: ticketsLoading, error: ticketsError, refetch: refetchTickets } = useTickets();
  const currentUserId = user?.uid || user?.id;
  // Companies, ticket types and the approver inbox (the backend's own eligibility) in one call (AppScript v9.4)
  const { data: dashboard, refetch: refetchDashboard } = useDashboard(currentUserId);
  const companies = dashboard?.companies;
  const ticketTypes = dashboard?.ticket_types;
  const approvalInbox = dashboard?.approval_inbox;
  const navigate = useNavigate();
  const { ToastContainer } = useToast();

  // Modal hooks
  const { showInfo, InformationModal } = useInformation();

  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const isRefreshing = refreshing || ticketsLoading;

  // Filter tickets based on current selections
  const filteredTickets = tickets?.filter(ticket => {
    const companyMatch = !selectedCompany || String(ticket.company_id) === String(selectedCompany);
    const statusMatch = !selectedStatus || ticket.status === selectedStatus;
    const priorityMatch = !selectedPriority || ticket.priority === selectedPriority;

    return companyMatch && statusMatch && priorityMatch;
  }) || [];

  // Statistics on the ticket columns AppScript writes (status comes from each step's status_on_reach)
  const isClosed = t => ['Completed', 'Rejected', 'Cancelled'].includes(t.status);
  const inWorkflow = t => !isClosed(t) && Boolean(t.current_step_id);
  const stats = {
    total: filteredTickets.length,
    open: filteredTickets.filter(t => !isClosed(t)).length,
    pending: filteredTickets.filter(inWorkflow).length,
    overdue: filteredTickets.filter(t => inWorkflow(t) && t.step_due_date && new Date(t.step_due_date) < new Date()).length,
    myTickets: filteredTickets.filter(t => String(t.requester_id) === String(currentUserId)).length,
    completed: filteredTickets.filter(t => t.status === 'Completed').length,
    forApproval: (approvalInbox || []).length
  };
  const goToTickets = () => navigate('/tickets');

  // Get unique values for filter dropdowns
  const uniqueStatuses = [...new Set(tickets?.map(t => t.status) || [])];
  const uniquePriorities = [...new Set(tickets?.map(t => t.priority) || [])];

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

  const renderTicketRow = (ticket) => {
    const company = companies?.find(c => String(c.id) === String(ticket.company_id));
    const ticketType = ticketTypes?.find(t => String(t.id) === String(ticket.ticket_type_id));

    const getPriorityColor = (priority) => {
      switch (priority?.toLowerCase()) {
        case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
        case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
        case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        case 'low': return 'text-green-600 bg-green-50 border-green-200';
        default: return 'text-gray-600 bg-gray-50 border-gray-200';
      }
    };

    const getStatusColor = (status) => {
      switch (status?.toLowerCase()) {
        case 'open': return 'text-blue-600 bg-blue-50 border-blue-200';
        case 'in_progress': return 'text-purple-600 bg-purple-50 border-purple-200';
        case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        case 'completed': return 'text-green-600 bg-green-50 border-green-200';
        case 'closed': return 'text-gray-600 bg-gray-50 border-gray-200';
        default: return 'text-gray-600 bg-gray-50 border-gray-200';
      }
    };

    return (
      <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <Icons.Ticket size={20} className="text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {ticket.ticket_number || `TICKET-${ticket.id}`}
                </h3>
                <p className="text-sm text-gray-500 truncate">
                  {isRestrictedStub(ticket) ? `🔒 ${RESTRICTED_LABEL}` : (ticket.title || 'No title provided')}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {company && (
                    <span className="text-xs text-gray-500">
                      {company.name}
                    </span>
                  )}
                  {ticketType && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-gray-500">
                        {ticketType.name}
                      </span>
                    </>
                  )}
                  {ticket.step_due_date && !isClosed(ticket) && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-gray-500">
                        Step due: {new Date(ticket.step_due_date).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority || 'Normal'}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
              {ticket.status || 'Open'}
            </span>

            {(approvalInbox || []).some(t => String(t.id) === String(ticket.id)) && (
              <span className="px-2 py-1 rounded-full text-xs font-medium border text-purple-700 bg-purple-50 border-purple-200">
                Your approval
              </span>
            )}

            <button
              onClick={goToTickets}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
              title="Open in Tickets"
            >
              <Icons.Info size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <ToastContainer />
      <InformationModal />

      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        {/* Header */}
        <Header
          user={user}
          userRole={userRoles?.[0]?.name?.toLowerCase() || 'user'}
        />

        {/* Main Content */}
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Welcome Section */}
            <div className="mb-8">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      Ticket Dashboard
                    </h1>
                    <p className="mt-2 text-gray-600">
                      Welcome back, {user?.displayName || user?.email?.split('@')[0]}!
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span>Role: {userRoles?.[0]?.name || 'User'}</span>
                      <span>•</span>
                      <span>Companies: {userCompanies?.length || 0}</span>
                      <span>•</span>
                      <span>{permissions.canAccessAdmin ? 'Admin Access' : 'User Access'}</span>
                    </div>
                  </div>
                  <div className="hidden lg:block">
                    <DetailedClock />
                  </div>
                </div>
              </div>
            </div>

            {/* SLA Overview - open tickets only */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">SLA Overview</h3>
              <SLASummaryWidgets
                onOverdueClick={() => navigate('/tickets?sla=overdue')}
                onDueTodayClick={() => navigate('/tickets?sla=due_today')}
                onPerformanceClick={() => navigate('/tickets')}
              />
              <div className="mt-4">
                <SLANotificationSystem />
              </div>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
              {DEV_CONFIG.DASHBOARD_CARDS.SHOW_MY_TICKETS && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">My Tickets</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.myTickets}</p>
                    </div>
                    <Icons.Ticket size={32} className="text-blue-600" />
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    Assigned to or created by you
                  </div>
                </div>
              )}

              {DEV_CONFIG.DASHBOARD_CARDS.SHOW_PENDING_APPROVAL && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Approval</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
                    </div>
                    <Icons.Pending size={32} className="text-yellow-600" />
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    Awaiting approval
                  </div>
                </div>
              )}

              {DEV_CONFIG.DASHBOARD_CARDS.SHOW_COMPLETED && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Completed</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
                    </div>
                    <Icons.Success size={32} className="text-green-600" />
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    Successfully completed
                  </div>
                </div>
              )}

              {DEV_CONFIG.DASHBOARD_CARDS.SHOW_OVERDUE && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Overdue</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.overdue}</p>
                    </div>
                    <Icons.Overdue size={32} className="text-red-600" />
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    <span className="text-red-600">Needs attention</span>
                  </div>
                </div>
              )}

              {DEV_CONFIG.DASHBOARD_CARDS.SHOW_FOR_YOUR_APPROVAL && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">For Your Approval</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.forApproval}</p>
                    </div>
                    <Icons.Approval size={32} className="text-purple-600" />
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    Requires your approval
                  </div>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Companies</option>
                    {companies?.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Statuses</option>
                    {uniqueStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Priorities</option>
                    {uniquePriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority?.charAt(0).toUpperCase() + priority?.slice(1) || 'Normal'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSelectedCompany('');
                      setSelectedStatus('');
                      setSelectedPriority('');
                    }}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {currentUserId && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
                    <p className="text-gray-600">Common ticket operations</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={goToTickets}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
                    >
                      <Icons.Create size={16} />
                      <span>New Ticket</span>
                    </button>
                    {hasPermission('canViewReports') && (
                      <button
                        onClick={() => showInfo({
                          title: 'View Reports',
                          message: 'Advanced reporting features will be implemented in a future phase.',
                          type: 'info'
                        })}
                        className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2"
                      >
                        <Icons.Dashboard size={16} />
                        <span>Reports</span>
                      </button>
                    )}
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-75 disabled:cursor-wait"
                    >
                      <Icons.Refresh size={16} className={isRefreshing ? 'animate-spin' : ''} />
                      <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tickets List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Tickets ({filteredTickets.length})
                  </h3>
                  {filteredTickets.length > 0 && (
                    <div className="text-sm text-gray-500">
                      Showing {filteredTickets.length} of {tickets?.length || 0} total tickets
                    </div>
                  )}
                </div>
              </div>

              {ticketsLoading ? (
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
              ) : filteredTickets.length > 0 ? (
                <div className="p-4 space-y-4">
                  {filteredTickets.slice(0, 10).map(renderTicketRow)}
                  {filteredTickets.length > 10 && (
                    <div className="text-center pt-4">
                      <button
                        onClick={goToTickets}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      >
                        View All {filteredTickets.length} Tickets
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Icons.Ticket size={32} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">
                    {tickets?.length > 0 ? 'No tickets match your filters' : 'No tickets found'}
                  </p>
                  {currentUserId && (
                    <button
                      onClick={goToTickets}
                      className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    >
                      Create First Ticket
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
};

export default DashboardPage;