import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useTicketList, useTicketLookup, useCompanies, useTicketTypes, useTicketsForApproval, useTags, useSharedTickets } from '../../hooks/useAPI';
import { API } from '../../api/googleSheet';
import { useToast } from '../shared/Toast';
import { useConfirmation } from '../shared/ConfirmationModal';
import Icons from '../shared/Icons';
import { RESTRICTED_LABEL, isRestrictedStub } from '../../config/labels';
import TicketForm from './TicketForm';
import TicketDetail from './TicketDetail';
import TagSearchFilter from '../shared/TagSearchFilter';
import { DEFAULT_ZONE, dayInZone, formatDateOnly } from '../../utils/dateTime';

// Ticket statuses that end the workflow (AppScript TERMINAL_TICKET_STATUSES)
const TERMINAL_STATUSES = ['completed', 'rejected', 'cancelled'];

/**
 * TicketDashboard - ticket list for requesters and approvers (/tickets).
 *
 * - Show: all tickets / my tickets (requester_id) / waiting for my approval (AppScript v9.1
 *   getTicketsForApproval - the backend's own eligibility, not role names)
 * - Create opens TicketForm; a row opens TicketDetail (WorkflowStep approves / rejects / returns there)
 * - Bulk approve / reject applies to tickets in the approval inbox, one submitStepApproval per ticket, and
 *   reports the tickets that failed (e.g. a required comment, or the ticket moved on meanwhile)
 * - Tag filter (when a ticket type has tags on) and "Shared with me" (AppScript v9.3)
 * - Chained view (spec 3.4): a ticket created by a workflow step (AppScript v9.2 chained_children /
 *   chained_parent) is listed under its parent, which expands to show it
 * - AppScript v10.0 (M3): the list is read 50 at a time, newest first, with "Load more"; search (ticket number prefix or
 *   title words, 300 ms debounce), company, status and "My tickets" are filtered by the server, the other filters on
 *   the loaded tickets. "Waiting for my approval" / "Shared with me" list their own endpoints' tickets
 */
const SEARCH_DEBOUNCE_MS = 300;

const TicketDashboard = () => {
  const { user, effectiveZone, companyZone } = useUser();
  const currentUserId = user?.uid || user?.id;
  const { data: companies } = useCompanies();
  // v10.1: a company's zone from the list (an admin sees companies outside the profile)
  const listedZone = companyId => (companies || []).find(c => String(c.id) === String(companyId))?.timezone;
  const { data: ticketTypes } = useTicketTypes();
  const { data: approvalInbox, refetch: refetchInbox } = useTicketsForApproval(currentUserId);
  const { data: sharedWithMe, refetch: refetchShared } = useSharedTickets(currentUserId);
  // Tag filter only when some ticket type has tags turned on
  const tagsInUse = (ticketTypes || []).some(t => t.enable_tags === true || String(t.enable_tags).toUpperCase() === 'TRUE');
  const { data: allTags } = useTags(null, tagsInUse);
  const [tagFilter, setTagFilter] = useState(null);
  const [tagMatchIds, setTagMatchIds] = useState(null);
  const handleTagFilterChange = useCallback(filters => setTagFilter(filters), []);
  const [tagResetKey, setTagResetKey] = useState(0); // a new key remounts the tag filter empty (Clear)
  const { ToastContainer, success, error: showError, warning } = useToast();

  // Modal hooks
  const { confirm, ConfirmationModal } = useConfirmation();

  // ?sla=overdue | due_today | on_time | no_sla (the dashboard's SLA widgets link here) and ?show=approval
  const [searchParams] = useSearchParams();
  const SLA_FILTERS = ['overdue', 'due_today', 'on_time', 'no_sla'];
  const [filters, setFilters] = useState(() => ({
    search: '',
    company: '',
    status: '',
    priority: '',
    show: ['mine', 'approval', 'shared'].includes(searchParams.get('show')) ? searchParams.get('show') : 'all', // all | mine | approval | shared
    dateRange: 'all',
    slaStatus: SLA_FILTERS.includes(searchParams.get('sla')) ? searchParams.get('sla') : 'all'
  }));

  // Server-side part of the filters (v10.0 paged getTickets); the search waits 300 ms after the last key
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);
  // v10.0 review CR4-06: SLA, priority and date range go to the server too, so the SLA widget links (?sla=overdue)
  // find every matching ticket, not only the ones in the loaded pages
  const dateFrom = (() => {
    const days = { today: 0, week: 7, month: 30 }[filters.dateRange];
    if (days === undefined) return '';
    // v10.1: the server reads the day in the filtered company's zone (else the default), so compute it there too
    return dayInZone(new Date(Date.now() - days * 24 * 60 * 60 * 1000), filters.company ? companyZone(filters.company, listedZone(filters.company)) : DEFAULT_ZONE);
  })();
  const serverFilters = {
    q: debouncedSearch,
    company_id: filters.company,
    status: filters.status,
    priority: filters.priority,
    ...(filters.slaStatus !== 'all' ? { sla: filters.slaStatus } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(filters.show === 'mine' ? { mine: true } : {})
  };
  const { data: listTickets, loading: listLoading, loadingMore, error, hasMore, loadMore, refetch } = useTicketList(serverFilters, 50);
  // The list on screen: the paged tickets, or the approval inbox / shared tickets for those views
  const tickets = filters.show === 'approval' ? approvalInbox : filters.show === 'shared' ? sharedWithMe : listTickets;
  const loading = filters.show === 'approval' || filters.show === 'shared' ? !tickets : listLoading;

  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  // ?ticket=<id> opens that ticket (the notification bell links here, AppScript v9.5)
  const [openTicketId, setOpenTicketId] = useState(() => searchParams.get('ticket'));
  const linkedTicketId = searchParams.get('ticket');
  useEffect(() => {
    if (linkedTicketId) setOpenTicketId(linkedTicketId);
  }, [linkedTicketId]);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const approvalIds = new Set((approvalInbox || []).map(t => String(t.id)));
  const sharedIds = new Set((sharedWithMe || []).map(t => String(t.id)));
  // Every ticket loaded on this screen (paged list + inbox + shared), so chained children and links resolve
  const ticketById = new Map([...(listTickets || []), ...(approvalInbox || []), ...(sharedWithMe || [])].map(t => [String(t.id), t]));

  const toggleExpanded = (ticketId) => setExpandedIds(prev => {
    const next = new Set(prev);
    const key = String(ticketId);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  // A ?ticket= link to a ticket that isn't in the loaded page is fetched on its own (v10.0)
  const loadedOpenTicket = openTicketId ? ticketById.get(String(openTicketId)) : null;
  const { data: lookedUpTicket } = useTicketLookup(openTicketId && !loadedOpenTicket ? openTicketId : null);
  const openTicket = loadedOpenTicket ||
    (openTicketId && lookedUpTicket && String(lookedUpTicket.id) === String(openTicketId) ? lookedUpTicket : null);

  const refreshAll = () => {
    refetch();
    refetchInbox();
    refetchShared();
  };

  // Ask the backend which tickets match the tag filter (AND / OR / excluded tags)
  const tagFilterKey = tagFilter?.hasFilters
    ? JSON.stringify([tagFilter.selectedTags.map(t => t.id), tagFilter.excludedTags.map(t => t.id), tagFilter.operator])
    : '';
  useEffect(() => {
    if (!tagFilterKey) {
      setTagMatchIds(null);
      return;
    }
    let cancelled = false;
    API.Tags.search({
      tagIds: tagFilter.selectedTags.map(t => t.id),
      excludeTagIds: tagFilter.excludedTags.map(t => t.id),
      operator: tagFilter.operator
    })
      .then(ids => { if (!cancelled) setTagMatchIds(new Set(ids.map(String))); })
      .catch(err => { if (!cancelled) showError(err.message || 'Tag search failed'); });
    return () => { cancelled = true; };
    // tagFilter is summed up by tagFilterKey; showError is new each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilterKey]);

  // Filter and sort tickets
  const filteredTickets = tickets?.filter(ticket => {
    const search = filters.search.toLowerCase();
    const searchMatch = !filters.search ||
      ticket.title?.toLowerCase().includes(search) ||
      String(ticket.ticket_number || '').toLowerCase().includes(search) ||
      ticket.description?.toLowerCase().includes(search);

    const companyMatch = !filters.company || String(ticket.company_id) === String(filters.company);
    const statusMatch = !filters.status || ticket.status === filters.status;
    const priorityMatch = !filters.priority || ticket.priority === filters.priority;
    const showMatch = filters.show === 'all' ||
      (filters.show === 'mine' && String(ticket.requester_id) === String(currentUserId)) ||
      (filters.show === 'approval' && approvalIds.has(String(ticket.id))) ||
      (filters.show === 'shared' && sharedIds.has(String(ticket.id)));
    const tagMatch = !tagMatchIds || tagMatchIds.has(String(ticket.id));

    const dateMatch = (() => {
      if (filters.dateRange === 'all') return true;
      if (!ticket.created_at) return false;

      const ticketDate = new Date(ticket.created_at);
      const now = new Date();

      switch (filters.dateRange) {
        case 'today': return ticketDate.toDateString() === now.toDateString();
        case 'week': return (now - ticketDate) <= 7 * 24 * 60 * 60 * 1000;
        case 'month': return (now - ticketDate) <= 30 * 24 * 60 * 60 * 1000;
        default: return true;
      }
    })();

    // SLA Status filtering
    const slaMatch = (() => {
      if (filters.slaStatus === 'all') return true;
      // A closed ticket has no SLA running, even if a cancelled one kept its due date
      const isClosed = TERMINAL_STATUSES.includes(String(ticket.status || '').toLowerCase());
      if (!ticket.step_due_date || isClosed) return filters.slaStatus === 'no_sla';

      const now = new Date();
      const dueDate = new Date(ticket.step_due_date);
      const isOverdue = now > dueDate;
      const zone = companyZone(ticket.company_id, listedZone(ticket.company_id)); // v10.1: the company's today, as the server counts it
      const isDueToday = dayInZone(dueDate, zone) === dayInZone(now, zone);

      switch (filters.slaStatus) {
        case 'overdue': return isOverdue;
        case 'due_today': return isDueToday && !isOverdue;
        case 'on_time': return !isDueToday && !isOverdue;
        case 'no_sla': return false;
        default: return true;
      }
    })();

    return searchMatch && companyMatch && statusMatch && priorityMatch && showMatch && tagMatch && dateMatch && slaMatch;
  }) || [];

  // A chained child whose parent is also in the list is shown under the parent, not at the top level
  const filteredIds = new Set(filteredTickets.map(t => String(t.id)));
  const topLevelTickets = filteredTickets.filter(t => !(t.chained_parent && filteredIds.has(String(t.chained_parent))));

  // Sort tickets
  const sortedTickets = [...topLevelTickets].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    // Handle date sorting
    if (sortBy.endsWith('_at') || sortBy.endsWith('_date')) {
      aValue = new Date(aValue || 0);
      bValue = new Date(bValue || 0);
    }

    // Handle string sorting
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = String(bValue || '').toLowerCase();
    }

    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedTickets.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTickets = sortedTickets.slice(startIndex, startIndex + pageSize);

  // Get unique values for filter dropdowns
  const uniqueStatuses = [...new Set(tickets?.map(t => t.status).filter(Boolean) || [])];
  const uniquePriorities = [...new Set(tickets?.map(t => t.priority).filter(Boolean) || [])];

  // A selected ticket that left the inbox (approved elsewhere, moved on) is dropped from the selection
  useEffect(() => {
    setSelectedTickets(prev => prev.filter(id => approvalIds.has(String(id))));
    // approvalIds is rebuilt each render from approvalInbox
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalInbox]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Clears every filter including the tag filter (before 9 Nov 2026 the tags stayed set); the toolbar's Clear keeps
  // the Show pill, the empty-list button resets it too
  const clearFilters = ({ keepShow = false } = {}) => {
    setFilters(prev => ({
      search: '',
      company: '',
      status: '',
      priority: '',
      show: keepShow ? prev.show : 'all',
      dateRange: 'all',
      slaStatus: 'all'
    }));
    setTagFilter(null);
    setTagMatchIds(null);
    setTagResetKey(key => key + 1);
    setCurrentPage(1);
  };

  // Filters folded under "More filters" (company, priority, date, tags) - the toggle shows how many are set
  const hiddenFilterCount = [filters.company, filters.priority, filters.dateRange !== 'all', tagFilter?.hasFilters]
    .filter(Boolean).length;
  const anyFilterSet = Boolean(filters.search || filters.status || filters.slaStatus !== 'all') || hiddenFilterCount > 0;
  const [showMoreFilters, setShowMoreFilters] = useState(() => hiddenFilterCount > 0);

  const handleTicketSelect = (ticketId, selected) => {
    setSelectedTickets(prev =>
      selected
        ? [...prev, ticketId]
        : prev.filter(id => id !== ticketId)
    );
  };

  // One submitStepApproval per selected ticket, at the step it is on now
  const handleBulkAction = async (decision) => {
    if (selectedTickets.length === 0) {
      showError('No tickets selected');
      return;
    }
    if (decision === 'reject' && !bulkComment.trim()) {
      warning('Add a comment to reject the selected tickets');
      return;
    }

    const label = decision === 'approve' ? 'Approve' : 'Reject';
    const confirmed = await confirm({
      title: `${label} Tickets`,
      message: `Are you sure you want to ${decision} ${selectedTickets.length} selected ticket${selectedTickets.length !== 1 ? 's' : ''}?`,
      type: decision === 'reject' ? 'error' : 'warning',
      confirmText: label,
      cancelText: 'Cancel'
    });
    if (!confirmed) return;

    setBulkRunning(true);
    const failures = [];
    for (const ticketId of selectedTickets) {
      const ticket = (approvalInbox || []).find(t => String(t.id) === String(ticketId));
      try {
        await API.StepApprovals.submitApproval(ticketId, ticket?.current_step_id, currentUserId, decision, bulkComment);
      } catch (err) {
        failures.push(`${ticket?.ticket_number || ticketId}: ${err.message}`);
      }
    }
    setBulkRunning(false);

    const done = selectedTickets.length - failures.length;
    if (done > 0) success(`${label}d ${done} ticket${done !== 1 ? 's' : ''}`);
    if (failures.length > 0) showError(`Not ${decision}d: ${failures.join('; ')}`);
    setSelectedTickets([]);
    setBulkComment('');
    refreshAll();
  };

  const handleCreated = () => {
    setShowCreate(false);
    refreshAll();
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Statuses come from each workflow step's status_on_reach, so match on words, not fixed values
  const getStatusColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return 'text-green-600 bg-green-50 border-green-200';
    if (s === 'rejected') return 'text-red-600 bg-red-50 border-red-200';
    if (s === 'cancelled') return 'text-gray-600 bg-gray-100 border-gray-300';
    if (s.includes('return')) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (s.includes('pending') || s.includes('approval')) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (s === 'new') return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-purple-600 bg-purple-50 border-purple-200';
  };

  // SLA Status Component for individual tickets
  const SLAStatusBadge = ({ stepDueDate, closed }) => {
    const [slaStatus, setSlaStatus] = useState(null);

    useEffect(() => {
      if (stepDueDate && !closed) {
        // Calculate SLA status client-side for performance
        import('../../utils/slaCalculator').then(({ getSLAStatus }) => {
          setSlaStatus(getSLAStatus(stepDueDate));
        });
      }
    }, [stepDueDate, closed]);

    if (!slaStatus) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          No SLA
        </span>
      );
    }

    const colorMap = {
      gray: 'bg-gray-100 text-gray-800',
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800'
    };

    const iconMap = {
      no_sla: Icons.Clock,
      on_time: Icons.Success,
      due_today: Icons.Urgent,
      overdue: Icons.Warning
    };

    const StatusIcon = iconMap[slaStatus.type] || Icons.Clock;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorMap[slaStatus.color]}`}>
        <StatusIcon size={12} className="mr-1" />
        {slaStatus.label}
      </span>
    );
  };

  const renderTicketRow = (ticket, depth = 0) => {
    const company = companies?.find(c => String(c.id) === String(ticket.company_id));
    const ticketType = ticketTypes?.find(t => String(t.id) === String(ticket.ticket_type_id));
    const inInbox = approvalIds.has(String(ticket.id));
    const isSelected = selectedTickets.includes(ticket.id);
    const isMine = String(ticket.requester_id) === String(currentUserId);
    const closed = TERMINAL_STATUSES.includes(String(ticket.status || '').toLowerCase());
    const chainedChildren = (ticket.chained_children || []).map(id => ticketById.get(String(id))).filter(Boolean);
    const expanded = expandedIds.has(String(ticket.id));
    const chainedParent = ticket.chained_parent ? ticketById.get(String(ticket.chained_parent)) : null;

    return (
      <div key={ticket.id}>
      <div className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'}`}>
        <div className="flex items-start space-x-3">
          {inInbox ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleTicketSelect(ticket.id, e.target.checked)}
              className="mt-1 rounded border-gray-300 focus:ring-blue-500"
              title="Select for bulk approve / reject"
            />
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}

          <Icons.Ticket size={20} className="text-gray-400 flex-shrink-0 mt-1" />

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => setOpenTicketId(ticket.id)}
                  className="text-sm font-medium text-blue-700 hover:underline truncate text-left"
                >
                  {ticket.ticket_number || `TICKET-${ticket.id}`}
                </button>
                <p className="text-sm text-gray-600 mt-1">
                  {isRestrictedStub(ticket) ? `🔒 ${RESTRICTED_LABEL}` : (ticket.title || 'No title provided')}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                  {company && <span>{company.name}</span>}
                  {ticketType && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>{ticketType.name}</span>
                    </>
                  )}
                  {isMine && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>Requested by you</span>
                    </>
                  )}
                  {ticket.created_at && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>{formatDateOnly(ticket.created_at, effectiveZone(ticket.company_id, listedZone(ticket.company_id)))}</span>
                    </>
                  )}
                  {inInbox && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="font-medium text-blue-700">Waiting for your approval</span>
                    </>
                  )}
                  {depth === 0 && chainedParent && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>Chained from {chainedParent.ticket_number || `#${chainedParent.id}`}</span>
                    </>
                  )}
                  {chainedChildren.length > 0 && (
                    <>
                      <span className="text-gray-300">•</span>
                      <button
                        onClick={() => toggleExpanded(ticket.id)}
                        className="inline-flex items-center font-medium text-purple-700 hover:underline"
                        aria-expanded={expanded}
                      >
                        {expanded ? <Icons.ChevronDown size={12} className="mr-1" /> : <Icons.ChevronRight size={12} className="mr-1" />}
                        {chainedChildren.length} chained ticket{chainedChildren.length !== 1 ? 's' : ''}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority || 'Normal'}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                  {ticket.status || 'New'}
                </span>
                <SLAStatusBadge stepDueDate={ticket.step_due_date} closed={closed} />

                <button
                  onClick={() => setOpenTicketId(ticket.id)}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                  title="View Details"
                >
                  <Icons.Info size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Chained children (a few levels deep at most - chains are created step by step) */}
      {expanded && depth < 4 && chainedChildren.length > 0 && (
        <div className="ml-6 mt-2 pl-3 space-y-2 border-l-2 border-purple-100">
          {chainedChildren.map(child => renderTicketRow(child, depth + 1))}
        </div>
      )}
      </div>
    );
  };

  return (
    <>
      <ToastContainer />
      <ConfirmationModal />

      {/* Create ticket */}
      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 flex items-start justify-center p-4">
          <div className="w-full max-w-3xl my-8">
            <TicketForm onSave={handleCreated} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}

      {/* Ticket detail (approve / reject / return in its Workflow tab) */}
      {openTicket && (
        <TicketDetail
          ticket={openTicket}
          onClose={() => setOpenTicketId(null)}
          onStatusChange={refreshAll}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tickets</h2>
            <p className="text-gray-600">
              {approvalInbox?.length
                ? `${approvalInbox.length} waiting for your approval`
                : 'Create, track and approve tickets'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={refreshAll}
              className="p-2 rounded text-gray-400 hover:text-gray-600"
              title="Refresh"
            >
              <Icons.Refresh size={16} />
            </button>
            {currentUserId && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Icons.Create size={20} />
                <span>Create New Ticket</span>
              </button>
            )}
          </div>
        </div>

        {/* Show: all / mine / approval */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All tickets' },
            { id: 'mine', label: 'My tickets' },
            { id: 'approval', label: `Waiting for my approval (${approvalInbox?.length || 0})` },
            ...(sharedWithMe?.length ? [{ id: 'shared', label: `Shared with me (${sharedWithMe.length})` }] : [])
          ].map(option => (
            <button
              key={option.id}
              onClick={() => handleFilterChange('show', option.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${filters.show === option.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* One toolbar: search, Status, SLA, More filters, Clear (compact filters, 9 Nov 2026) */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[12rem]">
              <Icons.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                aria-label="Search tickets"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              aria-label="Status"
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All statuses</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={filters.slaStatus}
              onChange={(e) => handleFilterChange('slaStatus', e.target.value)}
              aria-label="SLA status"
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Filter by SLA status"
            >
              <option value="all">Any SLA</option>
              <option value="overdue">🔴 Overdue</option>
              <option value="due_today">🟡 Due Today</option>
              <option value="on_time">🟢 On Time</option>
              <option value="no_sla">⚫ No SLA</option>
            </select>

            <button
              type="button"
              onClick={() => setShowMoreFilters(prev => !prev)}
              aria-expanded={showMoreFilters}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border flex items-center gap-1 ${showMoreFilters || hiddenFilterCount > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              <Icons.Filter size={14} />
              <span>More filters{hiddenFilterCount > 0 ? ` (${hiddenFilterCount})` : ''}</span>
              {showMoreFilters ? <Icons.ChevronUp size={14} /> : <Icons.ChevronDown size={14} />}
            </button>

            {anyFilterSet && (
              <button
                type="button"
                onClick={() => clearFilters({ keepShow: true })}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* More filters - collapsed by default; kept mounted so the tag filter keeps its state while folded */}
          <div className={showMoreFilters ? 'flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100' : 'hidden'}>
            <select
              value={filters.company}
              onChange={(e) => handleFilterChange('company', e.target.value)}
              aria-label="Company"
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All companies</option>
              {companies?.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>

            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              aria-label="Priority"
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All priorities</option>
              {uniquePriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority?.charAt(0).toUpperCase() + priority?.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              aria-label="Created"
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Any time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>

            {/* Tag filter - only when a ticket type has tags turned on; a new key clears it */}
            {tagsInUse && (
              <TagSearchFilter
                key={tagResetKey}
                compact
                availableTags={allTags || []}
                onFilterChange={handleTagFilterChange}
                className="sm:ml-2"
              />
            )}
          </div>
        </div>

        {/* Bulk Actions - tickets in the approval inbox only */}
        {selectedTickets.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-blue-900">
                  {selectedTickets.length} ticket{selectedTickets.length !== 1 ? 's' : ''} selected
                </h3>
                <p className="text-sm text-blue-700">Each is approved or rejected at the step it is on now</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <input
                  type="text"
                  value={bulkComment}
                  onChange={(e) => setBulkComment(e.target.value)}
                  placeholder="Comment (required to reject)"
                  className="px-3 py-1 border border-gray-300 rounded text-sm sm:w-64"
                />
                <button
                  onClick={() => handleBulkAction('approve')}
                  disabled={bulkRunning}
                  className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded disabled:opacity-50"
                >
                  Approve All
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  disabled={bulkRunning}
                  className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded disabled:opacity-50"
                >
                  Reject All
                </button>
                <button
                  onClick={() => setSelectedTickets([])}
                  disabled={bulkRunning}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Count + sort + page size on one slim line */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 text-sm text-gray-600">
          <span className="font-medium text-gray-700">
            {sortedTickets.length} ticket{sortedTickets.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">·</span>
          <label className="flex items-center gap-1">
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-0.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="step_due_date">Step due</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="title">Title</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            aria-label={sortOrder === 'asc' ? 'Sorted ascending - switch to descending' : 'Sorted descending - switch to ascending'}
          >
            {sortOrder === 'asc' ? <Icons.ChevronUp size={14} /> : <Icons.ChevronDown size={14} />}
          </button>
          <span className="text-gray-300">·</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            aria-label="Tickets per page"
            className="px-2 py-0.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>

        {/* Tickets List */}
        <div className="bg-white border border-gray-200 rounded-lg">
          {loading ? (
            <div className="p-6 text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading tickets...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <Icons.Warning size={32} className="mx-auto text-red-400 mb-4" />
              <p className="text-red-600 mb-4">Failed to load tickets</p>
              <button
                onClick={refetch}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          ) : paginatedTickets.length > 0 ? (
            <div className="p-4 space-y-4">
              {paginatedTickets.map(ticket => renderTicketRow(ticket))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Icons.Ticket size={32} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">
                {tickets?.length ? 'No tickets match your filters' : 'No tickets yet'}
              </p>
              <button
                onClick={() => clearFilters()}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* More from the server (v10.0 paged getTickets) */}
        {hasMore && filters.show !== 'approval' && filters.show !== 'shared' && (
          <div className="text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-gray-200 hover:bg-blue-50 rounded-lg disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : `Load more tickets (${(listTickets || []).length} loaded)`}
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(startIndex + pageSize, sortedTickets.length)} of {sortedTickets.length} tickets
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default TicketDashboard;
