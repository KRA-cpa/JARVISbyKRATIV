import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useCompanies, useTicketTypes, useUsers, useTicketHistory, useTicketMutations, useCommentRequirements, useTicketActionLogs, useSLAEscalationEvents } from '../../hooks/useAPI';
import { getSLAStatus } from '../../utils/slaCalculator';
import { useToast } from '../shared/Toast';
import WorkflowStep from './WorkflowStep';
import TicketTagManager from './TicketTagManager';
import TicketCollaborationManager from './TicketCollaborationManager';
import TicketLinksManager from './TicketLinksManager';
import Icons from '../shared/Icons';
import { API } from '../../api/googleSheet';
import { RESTRICTED_LABEL, RESTRICTED_TICKET_MESSAGE, isRestrictedStub } from '../../config/labels';

// Ticket statuses that end the workflow (AppScript TERMINAL_TICKET_STATUSES)
const TERMINAL_STATUSES = ['Completed', 'Rejected', 'Cancelled'];

// ticket_history.action -> label
const HISTORY_LABELS = {
  Created: 'Created',
  WORKFLOW_STARTED: 'Workflow started',
  APPROVED: 'Approved',
  PARTIAL_APPROVAL: 'Approved (waiting for other approver roles)',
  REJECTED: 'Rejected',
  RETURNED: 'Returned',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REOPENED: 'Reopened',
  UPDATED: 'Updated',
  // AppScript v9.6 attachment links
  LINK_ADDED: 'Link added',
  LINK_REMOVED: 'Link removed',
  LINK_REPORTED: 'Link reported broken',
  LINK_FIXED: 'Link fixed'
};

/**
 * TicketDetail - one ticket in a modal: details, workflow (WorkflowStep approves / rejects / returns), its
 * real history (AppScript v9.1 getTicketHistory), and the requester / admin actions:
 * cancel (requester or admin), reopen a rejected / cancelled ticket (admin), resubmit a returned one
 * (requester or admin) - the backend checks the same rules (review R-05).
 *
 * Props: ticket, onClose, onStatusChange() - called after any change so the list refetches.
 */
const TicketDetail = ({ ticket, onClose, onStatusChange }) => {
  const { user, isAdmin } = useUser();
  const currentUserId = user?.uid || user?.id;
  const { data: companies } = useCompanies();
  const { data: ticketTypes } = useTicketTypes();
  const { data: users } = useUsers();
  const { data: history, loading: historyLoading, refetch: refetchHistory } = useTicketHistory(ticket?.id);
  // SLA escalations the server fired on this ticket (AppScript v9.5)
  const { data: escalations } = useSLAEscalationEvents(ticket?.id);
  const { data: commentRules } = useCommentRequirements(ticket?.ticket_type_id, ticket?.company_id);
  const { updateTicketStatus, loading: isPerformingAction } = useTicketMutations();
  const toast = useToast();
  const { ToastContainer, success, error: showError } = toast;
  const notify = (type, message) => {
    (toast[type] || toast.info)(message);
    if (type === 'success') refetchHistory(); // link changes add history lines
  };

  const [activeTab, setActiveTab] = useState('details');
  const [actionComment, setActionComment] = useState('');
  // Admins can switch the History tab to the system log (ticket_action_logs, AppScript v9.2)
  const [showSystemLog, setShowSystemLog] = useState(false);
  const { data: systemLog, loading: systemLogLoading } = useTicketActionLogs(ticket?.id, currentUserId, Boolean(isAdmin && showSystemLog));
  // AppScript v10.0 M4: Restricted - an admin's logged reveal of a stub, and the admin switch on a full ticket
  const [revealReason, setRevealReason] = useState('');
  const [revealed, setRevealed] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [restrictReason, setRestrictReason] = useState('');
  const [restrictSaving, setRestrictSaving] = useState(false);

  if (!ticket) return null;

  const isStub = isRestrictedStub(ticket);
  const isRestricted = isStub || ticket.is_confidential === true || String(ticket.is_confidential).toUpperCase() === 'TRUE';

  const handleReveal = async () => {
    setRevealing(true);
    try {
      setRevealed(await API.Tickets.reveal(ticket.id, revealReason.trim(), currentUserId));
    } catch (err) {
      showError(err.message || 'Could not reveal the ticket');
    } finally {
      setRevealing(false);
    }
  };

  const handleSetRestricted = async (on) => {
    if (!restrictReason.trim()) {
      showError('Give a reason');
      return;
    }
    setRestrictSaving(true);
    try {
      const result = await API.Tickets.setRestricted(ticket.id, on, restrictReason.trim(), currentUserId);
      success(on ? `Ticket is now ${RESTRICTED_LABEL}${result?.shares_revoked ? ` - ${result.shares_revoked} share(s) removed` : ''}`
        : `Ticket is no longer ${RESTRICTED_LABEL} (shares are not restored)`);
      setRestrictReason('');
      if (onStatusChange) onStatusChange();
    } catch (err) {
      showError(err.message || 'Could not change the setting');
    } finally {
      setRestrictSaving(false);
    }
  };

  // A Restricted ticket outside its chain: only its stub came back (number, status, company, type, created)
  if (isStub) {
    return (
      <>
        <ToastContainer />
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Icons.Lock size={18} className="mr-2 text-amber-600" />
                {ticket.ticket_number || `TICKET-${ticket.id}`}
              </h2>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded" title="Close">
                <Icons.Close size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">🔒 {RESTRICTED_TICKET_MESSAGE}.</p>
              <p className="text-sm text-gray-500">Status: {ticket.status || '-'}</p>
              {isAdmin && !revealed && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
                  <label className="block text-sm font-medium text-amber-900">Reveal as admin (logged with your reason)</label>
                  <input
                    type="text"
                    value={revealReason}
                    onChange={(e) => setRevealReason(e.target.value)}
                    placeholder="Why do you need to see it?"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleReveal}
                    disabled={revealing}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded disabled:opacity-50"
                  >
                    {revealing ? 'Revealing...' : 'Reveal'}
                  </button>
                </div>
              )}
              {revealed && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
                  <p className="text-xs text-amber-700">Revealed - this was written to the admin log.</p>
                  <p><span className="font-medium">Title:</span> {revealed.ticket?.title}</p>
                  <p className="whitespace-pre-wrap"><span className="font-medium">Description:</span> {revealed.ticket?.description || '-'}</p>
                  {Object.entries(revealed.field_values || {}).map(([fieldId, value]) => (
                    <p key={fieldId}><span className="font-medium">{fieldId}:</span> {value}</p>
                  ))}
                  <p className="text-xs text-gray-500">{(revealed.history || []).length} history entries</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const company = companies?.find(c => String(c.id) === String(ticket.company_id));
  const ticketType = ticketTypes?.find(t => String(t.id) === String(ticket.ticket_type_id));
  const nameOf = (userId) => users?.find(u => String(u.id || u.user_id) === String(userId))?.name || userId || 'Unknown';
  const sla = ticket.step_due_date && !TERMINAL_STATUSES.includes(ticket.status) ? getSLAStatus(ticket.step_due_date) : null;

  const isRequester = String(ticket.requester_id) === String(currentUserId);
  const isClosed = TERMINAL_STATUSES.includes(ticket.status);
  const isReturned = ticket.status === 'Returned to Requester';
  const canCancel = !isClosed && (isRequester || isAdmin);
  const canReopen = (['Rejected', 'Cancelled'].includes(ticket.status) && isAdmin) || (isReturned && (isRequester || isAdmin));
  const cancelNeedsComment = Boolean(commentRules?.require_on_cancel);

  const refreshAfterChange = () => {
    refetchHistory();
    onStatusChange?.();
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
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? String(dateString) : date.toLocaleString();
  };

  // 'Cancelled' | 'Reopened' - the only direct status changes (approve / reject / return are in Workflow)
  const handleStatusAction = async (status) => {
    if (status === 'Cancelled' && cancelNeedsComment && !actionComment.trim()) {
      showError('A comment is required to cancel this ticket');
      return;
    }
    try {
      await updateTicketStatus(ticket.id, status, actionComment, currentUserId);
      success(status === 'Cancelled' ? 'Ticket cancelled' : isReturned ? 'Ticket resubmitted' : 'Ticket reopened');
      setActionComment('');
      refreshAfterChange();
    } catch (err) {
      showError(err.message || 'Failed to update the ticket');
    }
  };

  const SLAStatusDisplay = () => {
    const colorMap = {
      gray: 'bg-gray-100 text-gray-800 border-gray-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      red: 'bg-red-100 text-red-800 border-red-200'
    };
    const iconMap = {
      no_sla: Icons.Clock,
      on_time: Icons.Success,
      due_today: Icons.Urgent,
      overdue: Icons.Warning
    };
    const StatusIcon = (sla && iconMap[sla.type]) || Icons.Clock;

    return (
      <div className="border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">SLA Status</span>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${sla ? colorMap[sla.color] : colorMap.gray}`}>
            <StatusIcon size={12} className="mr-1" />
            {sla ? sla.label : 'No SLA'}
          </span>
        </div>
        {sla && (
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Step due:</span>
            <span>{formatDate(ticket.step_due_date)}</span>
          </div>
        )}
      </div>
    );
  };

  const renderDetailsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Title</label>
            <p className="text-gray-900">{ticket.title}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <p className="text-gray-900 whitespace-pre-wrap">{ticket.description || 'No description'}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Company</label>
            <p className="text-gray-900">{company?.name || 'Unknown Company'}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Ticket Type</label>
            <p className="text-gray-900">{ticketType?.name || 'Unknown Type'}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
              {ticket.status || 'New'}
            </span>
            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority || 'Normal'}
            </span>
          </div>

          <SLAStatusDisplay />

          <div>
            <label className="text-sm font-medium text-gray-700">Requested By</label>
            <p className="text-gray-900">{isRequester ? 'You' : nameOf(ticket.requester_id)}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Created</label>
            <p className="text-gray-900">{formatDate(ticket.created_at)}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Last Updated</label>
            <p className="text-gray-900">{formatDate(ticket.updated_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystemLog = () => (
    <div className="space-y-3">
      {systemLogLoading && <p className="text-sm text-gray-500">Loading system log...</p>}
      {(systemLog || []).map((log, index) => (
        <div key={log.id || index} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">
              {log.action_type}
              <span className="font-normal text-gray-500"> by {nameOf(log.user_id)}</span>
            </p>
            <span className="text-sm text-gray-500">{formatDate(log.timestamp)}</span>
          </div>
          {log.details && (
            <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap break-all">
              {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
            </pre>
          )}
        </div>
      ))}
      {!systemLogLoading && (systemLog || []).length === 0 && (
        <p className="text-center py-8 text-gray-500">No system log entries</p>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <label className="inline-flex items-center text-sm text-gray-700">
            <input type="checkbox" checked={showSystemLog} onChange={() => setShowSystemLog(v => !v)} className="mr-2" />
            System log (admin)
          </label>
        </div>
      )}
      {isAdmin && showSystemLog ? renderSystemLog() : (
      <>
      {historyLoading && <p className="text-sm text-gray-500">Loading history...</p>}

      {(history || []).map((item, index) => (
        <div key={item.id || index} className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <Icons.History size={16} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">
                {HISTORY_LABELS[item.action] || item.action}
                <span className="font-normal text-gray-500"> by {String(item.user_id) === String(currentUserId) ? 'you' : nameOf(item.user_id)}</span>
              </p>
              <span className="text-sm text-gray-500">{formatDate(item.timestamp)}</span>
            </div>
            {item.comment && <p className="text-sm text-gray-600">{item.comment}</p>}
            {item.from_status && item.to_status && item.from_status !== item.to_status && (
              <p className="text-xs text-gray-500 mt-1">{item.from_status} → {item.to_status}</p>
            )}
          </div>
        </div>
      ))}

      {!historyLoading && (history || []).length === 0 && (
        <div className="text-center py-8">
          <Icons.History size={32} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No history available</p>
        </div>
      )}

      {(escalations || []).length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">SLA escalations</h4>
          {escalations.map(event => (
            <div key={event.id} className="flex items-start space-x-3 mb-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                event.escalation_action === 'escalate_role' ? 'bg-orange-100' : 'bg-yellow-100'
              }`}>
                <Icons.Warning size={16} className={event.escalation_action === 'escalate_role' ? 'text-orange-600' : 'text-yellow-600'} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    Level {event.level}{event.rule_name ? ` - ${event.rule_name}` : ''}
                    <span className="font-normal text-gray-500">
                      {event.escalation_action === 'escalate_role' ? ' escalated' : ' notified'} {event.recipient_user_ids.length} user(s)
                    </span>
                  </p>
                  <span className="text-sm text-gray-500">{formatDate(event.fired_at)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Step due {formatDate(event.due_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );

  const renderActionsTab = () => (
    <div className="space-y-6">
      {isAdmin && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-amber-900">
            {isRestricted ? `This ticket is ${RESTRICTED_LABEL}` : `Make this ticket ${RESTRICTED_LABEL}`}
          </p>
          <p className="text-xs text-amber-800">
            {isRestricted
              ? 'Removing it does not restore the shares that were removed.'
              : 'Only its approval chain will see its content; every share is removed and nobody is told.'}
          </p>
          <input
            type="text"
            value={restrictReason}
            onChange={(e) => setRestrictReason(e.target.value)}
            placeholder="Reason (logged)"
            className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
          />
          <button
            onClick={() => handleSetRestricted(!isRestricted)}
            disabled={restrictSaving}
            className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded disabled:opacity-50"
          >
            {restrictSaving ? 'Saving...' : isRestricted ? `Remove ${RESTRICTED_LABEL}` : `Make ${RESTRICTED_LABEL}`}
          </button>
        </div>
      )}
      {canCancel || canReopen ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comment {canCancel && cancelNeedsComment && <span className="text-red-500">* (required to cancel)</span>}
            </label>
            <textarea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Reason for this action..."
              disabled={isPerformingAction}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {canReopen && (
              <button
                onClick={() => handleStatusAction('Reopened')}
                disabled={isPerformingAction}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {isReturned ? 'Resubmit' : 'Reopen'}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => handleStatusAction('Cancelled')}
                disabled={isPerformingAction}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                Cancel Ticket
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Approve, reject and return are on the Workflow tab, for the ticket's current approvers.
          </p>
        </div>
      ) : (
        <div className="text-center py-8">
          <Icons.Close size={32} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No actions available for this ticket</p>
        </div>
      )}
    </div>
  );

  const renderWorkflowTab = () => (
    <div className="space-y-6">
      <WorkflowStep
        ticket={ticket}
        onTicketUpdate={() => {
          refreshAfterChange();
          success('Ticket updated');
        }}
      />
    </div>
  );

  // Tags / Sharing tabs only when the ticket type has them turned on (AppScript v9.3 setTicketTypeFeatures)
  const isOn = value => value === true || String(value).toUpperCase() === 'TRUE';
  const tagsOn = isOn(ticketType?.enable_tags);
  // v10.0 M4: a Restricted ticket can't be shared
  const sharingOn = isOn(ticketType?.enable_sharing) && !isRestricted;

  const tabs = [
    { id: 'details', name: 'Details', icon: Icons.Info },
    { id: 'workflow', name: 'Workflow', icon: Icons.Workflow },
    { id: 'history', name: 'History', icon: Icons.History, count: (history || []).length },
    { id: 'links', name: 'Links', icon: Icons.Link },
    ...(tagsOn ? [{ id: 'tags', name: 'Tags', icon: Icons.Tag }] : []),
    ...(sharingOn ? [{ id: 'sharing', name: 'Sharing', icon: Icons.Share }] : []),
    { id: 'actions', name: 'Actions', icon: Icons.Create }
  ];

  return (
    <>
      <ToastContainer />

      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  {ticket.ticket_number || `TICKET-${ticket.id}`}
                  {isRestricted && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                      title="Only the people in its approval chain see its content">
                      <Icons.Lock size={12} className="mr-1" /> {RESTRICTED_LABEL}
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-500">{ticket.title}</p>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors duration-200"
                title="Close"
              >
                <Icons.Close size={20} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon size={16} />
                  <span>{tab.name}</span>
                  {tab.count !== undefined && (
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {activeTab === 'details' && renderDetailsTab()}
            {activeTab === 'history' && renderHistoryTab()}
            {activeTab === 'actions' && renderActionsTab()}
            {activeTab === 'workflow' && renderWorkflowTab()}
            {activeTab === 'links' && (
              <TicketLinksManager ticketId={ticket.id} nameOf={nameOf} notify={notify} />
            )}
            {activeTab === 'tags' && tagsOn && (
              <TicketTagManager
                ticketId={ticket.id}
                companyId={ticket.company_id}
                currentUserId={currentUserId}
                canEdit={!isClosed}
              />
            )}
            {activeTab === 'sharing' && sharingOn && (
              <TicketCollaborationManager
                ticketId={ticket.id}
                companyId={ticket.company_id}
                currentUserId={currentUserId}
                canShare={isRequester || Boolean(isAdmin)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TicketDetail;
