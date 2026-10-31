/**
 * Custom React hooks for API operations
 * Provides reusable hooks for common API interactions
 */

import { useState, useEffect, useCallback } from 'react';
import { API } from '../api/googleSheet';
import { APILoopDetector } from '../utils/infiniteLoopPrevention';

// Generic API hook with infinite loop protection
export const useAPI = (apiCall, dependencies = [], endpointName = 'unknown') => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [callCount, setCallCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      // Check for infinite loop before making call
      if (APILoopDetector.isLoopDetected(endpointName)) {
        console.error(`Infinite loop detected for ${endpointName}. Blocking call.`);
        setError(`Infinite loop detected. Please refresh the page.`);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setCallCount(prev => prev + 1);

      const result = await apiCall();
      setData(result);
      APILoopDetector.recordSuccess(endpointName);
    } catch (err) {
      APILoopDetector.recordFailure(endpointName);

      if (err.code === 'INFINITE_LOOP_DETECTED') {
        setError('Infinite loop detected. Please refresh the page to continue.');
      } else {
        setError(err.message);
      }
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  // Callers pass the deps; apiCall is usually an inline arrow, so listing it would refetch every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, callCount };
};

// Enhanced API hook with caching and advanced options
export const useAPIData = (key, apiCall, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { enabled = true } = options;
  // Refetch when the key changes (e.g. the ticket moved to the next step), not only when enabled flips.
  // A string, so an inline key array doesn't refetch on every render.
  const keyString = JSON.stringify(key);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, keyString]); // apiCall left out on purpose: a new closure every render would loop

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

// Companies hooks
export const useCompanies = () => {
  return useAPI(() => API.Companies.getAll(), [], 'getCompanies');
};

export const useCompany = (id) => {
  return useAPI(() => API.Companies.getById(id), [id], 'getCompany');
};

export const useCompanyMutations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createCompany = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Companies.create(data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCompany = async (id, data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Companies.update(id, data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCompany = async (id) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Companies.delete(id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createCompany, updateCompany, deleteCompany, loading, error };
};

// Ticket Types hooks
export const useTicketTypes = (companyId = null) => {
  return useAPI(() => API.TicketTypes.getAll(companyId), [companyId], 'getTicketTypes');
};

// TicketForm's type list (AppScript v10.0): creating offers only the types the user may create - a role on the type +
// company, decided by the server (getCreatableTicketTypes; each type carries creatable_company_ids); editing lists the
// types of the ticket's company (the selects are read-only then). One call either way (compliance F5).
export const useTicketTypeChoices = (isEditing, companyId = null) => {
  return useAPIData(['ticketTypeChoices', isEditing, isEditing ? companyId : null],
    () => (isEditing ? API.TicketTypes.getAll(companyId) : API.TicketTypes.getCreatable()));
};

// Roles hooks
export const useRoles = (companyId = null) => {
  return useAPI(() => API.Roles.getAll(companyId), [companyId], 'getRoles');
};

export const useRoleMutations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createRole = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Roles.create(data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (id, data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Roles.update(id, data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteRole = async (id) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Roles.delete(id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createRole, updateRole, deleteRole, loading, error };
};

// Dropdown hooks
export const useDropdownLists = (companyId = null) => {
  return useAPI(() => API.Dropdowns.getLists(companyId), [companyId], 'getDropdownLists');
};

export const useDropdownOptions = (listId) => {
  return useAPI(() => API.Dropdowns.getOptions(listId), [listId], 'getDropdownOptions');
};

export const useDropdownMutations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createList = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Dropdowns.createList(data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateList = async (id, data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Dropdowns.updateList(id, data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteList = async (id) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Dropdowns.deleteList(id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createList, updateList, deleteList, loading, error };
};

// Custom Fields hooks
// One ticket type's fields when an id is given (getAll() ignores arguments and returns every type's fields)
export const useCustomFields = (ticketTypeId = null) => {
  return useAPI(
    () => (ticketTypeId ? API.CustomFields.getByTicketType(ticketTypeId) : API.CustomFields.getAll()),
    [ticketTypeId],
    'getCustomFields'
  );
};

export const useCustomField = (id) => {
  return useAPI(() => API.CustomFields.getById(id), [id]);
};

export const useCustomFieldMutations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createField = async (fieldData) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.CustomFields.create(fieldData);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateField = async (id, fieldData) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.CustomFields.update(id, fieldData);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteField = async (id) => {
    try {
      setLoading(true);
      setError(null);
      await API.CustomFields.delete(id);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createField, updateField, deleteField, loading, error };
};

// Tickets hooks
export const useTickets = (filters = {}) => {
  return useAPI(() => API.Tickets.getAll(filters), [JSON.stringify(filters)], 'getTickets');
};

export const useTicket = (id) => {
  return useAPI(() => API.Tickets.getById(id), [id], 'getTicket');
};

export const useTicketMutations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createTicket = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Tickets.create(data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTicket = async (id, data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Tickets.update(id, data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // userId is required by AppScript v9.1: cancel = requester or admin, reopen = admin (review R-05)
  const updateTicketStatus = async (id, status, comment = '', userId = null) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.Tickets.updateStatus(id, status, comment, userId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createTicket, updateTicket, updateTicketStatus, loading, error };
};

// A ticket's history, newest first (AppScript v9.1)
export const useTicketHistory = (ticketId) => {
  return useAPIData(
    ['ticket_history', ticketId],
    () => API.Tickets.getHistory(ticketId),
    { enabled: !!ticketId }
  );
};

// Approver inbox: open tickets whose current step this user can approve now (AppScript v9.1)
export const useTicketsForApproval = (userId) => {
  return useAPIData(
    ['tickets_for_approval', userId],
    () => API.Tickets.getForApproval(userId),
    { enabled: !!userId }
  );
};

// Companies + ticket types + approval inbox + counts in one call (AppScript v9.4 getDashboard, compliance F5)
export const useDashboard = (userId) => {
  return useAPIData(
    ['dashboard', userId],
    () => API.Tickets.getDashboard(userId),
    { enabled: !!userId }
  );
};

// Which actions need a comment for a ticket type / company (AppScript v9.1)
export const useCommentRequirements = (ticketTypeId, companyId = null) => {
  return useAPIData(
    ['comment_requirements', ticketTypeId, companyId],
    () => API.TicketTypes.getCommentRequirements(ticketTypeId, companyId),
    { enabled: !!ticketTypeId }
  );
};

// A user's saved preferences (user_preferences; defaults when none saved) + save(preferences)
export const useUserPreferences = (userId) => {
  const query = useAPIData(
    ['user_preferences', userId],
    () => API.Users.getPreferences(userId),
    { enabled: !!userId }
  );
  const save = async (preferences) => {
    const result = await API.Users.updatePreferences(userId, preferences);
    await query.refetch();
    return result;
  };
  return { ...query, save };
};

// Live tags (a company's own + global when companyId is given); only fetched when enabled (AppScript v9.3)
export const useTags = (companyId = null, enabled = true) => {
  return useAPIData(
    ['tags', companyId],
    () => API.Tags.getAll(companyId),
    { enabled }
  );
};

// Tickets shared with the user, each with .share (AppScript v9.3)
export const useSharedTickets = (userId) => {
  return useAPIData(
    ['shared_tickets', userId],
    () => API.Sharing.getSharedWithMe(userId),
    { enabled: !!userId }
  );
};

// A workflow step's conditional routes (AppScript v9.2)
export const useStepConditions = (stepId) => {
  return useAPIData(
    ['step_conditions', stepId],
    () => API.WorkflowSteps.getConditions(stepId),
    { enabled: !!stepId }
  );
};

// A ticket type's report columns for a company - company config, else global, else defaults (AppScript v9.2)
export const useReportConfig = (ticketTypeId, companyId = null) => {
  return useAPIData(
    ['report_config', ticketTypeId, companyId],
    () => API.Reports.getConfig(ticketTypeId, companyId),
    { enabled: !!ticketTypeId }
  );
};

// A ticket's system log (ticket_action_logs) - admins only, so only fetched when enabled (AppScript v9.2)
export const useTicketActionLogs = (ticketId, userId, enabled = true) => {
  return useAPIData(
    ['ticket_action_logs', ticketId, userId],
    () => API.AuditLogs.getTicketLogs(ticketId, userId),
    { enabled: enabled && !!ticketId && !!userId }
  );
};

// User hooks
export const useUsers = () => {
  return useAPI(() => API.Users.getAll(), [], 'getUsers');
};

// System hooks
export const useSystemHealth = () => {
  return useAPI(() => API.System.getSystemHealth());
};

export const useAPITest = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runTest = async () => {
    try {
      setLoading(true);
      setError(null);
      const testResult = await API.System.runTest();
      setResult(testResult);
      return testResult;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { runTest, result, loading, error };
};

// API Connection Test Hook
export const useAPIConnection = () => {
  const [status, setStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const checkConnection = useCallback(async () => {
    try {
      setLoading(true);
      await API.System.ping();
      setStatus('connected');
      setLastChecked(new Date());
    } catch (error) {
      console.error('API connection test failed:', error);
      setStatus('disconnected');
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return { status, loading, lastChecked, checkConnection };
};

/**
 * Hook for workflow steps data
 */
export const useWorkflowSteps = (ticketTypeId, companyId = null) => {
  return useAPIData(
    ['workflow_steps', ticketTypeId, companyId],
    () => API.WorkflowSteps.getByTicketType(ticketTypeId, companyId),
    {
      enabled: !!ticketTypeId,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  );
};

/**
 * Hook for step approvals
 */
export const useStepApprovals = (ticketId, stepId) => {
  return useAPIData(
    ['step_approvals', ticketId, stepId],
    () => API.StepApprovals.getStepApprovals(ticketId, stepId),
    {
      enabled: !!(ticketId && stepId),
      staleTime: 30 * 1000 // 30 seconds (more frequent updates)
    }
  );
};

/**
 * Hook for checking if user can approve a step
 */
export const useCanUserApprove = (userId, stepId, ticketId = null) => {
  return useAPIData(
    ['can_user_approve', userId, stepId, ticketId],
    () => API.StepApprovals.canUserApprove(userId, stepId, ticketId),
    {
      enabled: !!(userId && stepId),
      staleTime: 2 * 60 * 1000 // 2 minutes
    }
  );
};

/**
 * Hook for the full approval eligibility of a user on a ticket's step:
 * { can_approve, already_approved, approver_logic, eligible_role_ids, required_role_ids, approved_role_ids }
 */
export const useApprovalEligibility = (userId, stepId, ticketId = null) => {
  return useAPIData(
    ['approval_eligibility', userId, stepId, ticketId],
    () => API.StepApprovals.getApprovalEligibility(userId, stepId, ticketId),
    {
      enabled: !!(userId && stepId),
      staleTime: 30 * 1000
    }
  );
};

/**
 * Hook for a user's role assignments in force today (role names attached)
 */
export const useUserRoleAssignments = (userId) => {
  return useAPI(
    () => (userId ? API.Users.getRoles(userId) : Promise.resolve([])),
    [userId],
    'getUserRoles'
  );
};

/**
 * Hook for a user's general role: { general_role: 'maker' | 'approver' | 'both' | 'viewer', ... }
 */
export const useUserGeneralRole = (userId, companyId = null) => {
  return useAPI(
    () => (userId ? API.Users.getGeneralRole(userId, companyId) : Promise.resolve(null)),
    [userId, companyId],
    'getUserGeneralRole'
  );
};

/**
 * SLA-related hooks for monitoring due dates and status
 * Enhanced with per-company SLA performance tracking - Phase 8.95
 */

/**
 * Hook for getting SLA performance statistics by company
 * @param {string} companyId - Optional company ID filter
 * @returns {Object} Company-specific SLA performance data
 */
export const useSLAPerformanceByCompany = (companyId = null) => {
  return useAPIData(
    ['sla_performance_company', companyId],
    async () => {
      const response = await fetch(`${process.env.REACT_APP_API_URL}?action=getSLAPerformanceByCompany${companyId ? `&company_id=${companyId}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch SLA performance by company');
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to fetch SLA performance data');
      return result.data;
    },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );
};

/**
 * Hook for getting SLA performance statistics by ticket type and company
 * @param {string} ticketTypeId - Optional ticket type ID filter
 * @param {string} companyId - Optional company ID filter
 * @returns {Object} Ticket type and company-specific SLA performance matrix
 */
export const useSLAPerformanceByTicketType = (ticketTypeId = null, companyId = null) => {
  return useAPIData(
    ['sla_performance_ticket_type', ticketTypeId, companyId],
    async () => {
      const params = new URLSearchParams({
        action: 'getSLAPerformanceByTicketType'
      });
      if (ticketTypeId) params.append('ticket_type_id', ticketTypeId);
      if (companyId) params.append('company_id', companyId);

      const response = await fetch(`${process.env.REACT_APP_API_URL}?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch SLA performance by ticket type');
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to fetch SLA performance data');
      return result.data;
    },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );
};

/**
 * Hook for getting global SLA performance across all companies
 * @returns {Object} System-wide SLA performance metrics
 */
export const useGlobalSLAPerformance = () => {
  return useAPIData(
    ['global_sla_performance'],
    async () => {
      const response = await fetch(`${process.env.REACT_APP_API_URL}?action=getGlobalSLAPerformance`);
      if (!response.ok) throw new Error('Failed to fetch global SLA performance');
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to fetch global SLA performance data');
      return result.data;
    },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );
};

/**
 * Hook for getting SLA status of a specific ticket
 */
export const useSLAStatus = (ticketId) => {
  return useAPIData(
    ['sla_status', ticketId],
    async () => {
      if (!ticketId) return null;

      // Get ticket with current step and due date
      const ticket = await API.Tickets.getById(ticketId);
      if (!ticket || !ticket.current_step_id) return null;

      // Get current workflow step
      const step = await API.WorkflowSteps.getById(ticket.current_step_id);
      if (!step) return null;

      // Calculate SLA status using our SLA calculator
      const { getSLAStatus } = await import('../utils/slaCalculator');
      return getSLAStatus(ticket.step_due_date);
    },
    {
      enabled: !!ticketId,
      staleTime: 30 * 1000, // 30 seconds - SLA status changes frequently
      refetchInterval: 60 * 1000 // Refresh every minute for real-time updates
    }
  );
};

/**
 * Hook for getting SLA configuration of a workflow step
 */
export const useWorkflowStepSLA = (stepId) => {
  return useAPIData(
    ['workflow_step_sla', stepId],
    async () => {
      if (!stepId) return null;

      const step = await API.WorkflowSteps.getById(stepId);
      if (!step) return null;

      // Extract SLA configuration using our SLA calculator
      const { SLACalculator } = await import('../utils/slaCalculator');
      return SLACalculator.getStepSLAConfig(step);
    },
    {
      enabled: !!stepId,
      staleTime: 5 * 60 * 1000 // 5 minutes - SLA configs don't change often
    }
  );
};

// A ticket that can still miss its SLA: has a step due date and is not completed / rejected / cancelled
const isOpenWithSLA = ticket => Boolean(ticket.step_due_date) &&
  !['completed', 'rejected', 'cancelled'].includes(String(ticket.status || '').toLowerCase());

/**
 * Hook for getting all overdue tickets across the system
 */
export const useSLAOverdueTickets = () => {
  return useAPIData(
    ['sla_overdue_tickets'],
    async () => {
      // Get all active tickets
      const tickets = await API.Tickets.getAll();
      if (!tickets || tickets.length === 0) return [];

      // Filter for overdue tickets
      const { getSLAStatus } = await import('../utils/slaCalculator');

      const overdueTickets = tickets
        .filter(isOpenWithSLA)
        .map(ticket => ({
          ...ticket,
          sla_status: getSLAStatus(ticket.step_due_date)
        }))
        .filter(ticket => ticket.sla_status.isOverdue);

      return overdueTickets;
    },
    {
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000 // Refresh every minute for real-time monitoring
    }
  );
};

/**
 * Hook for getting all tickets due today
 */
export const useSLADueTodayTickets = () => {
  return useAPIData(
    ['sla_due_today_tickets'],
    async () => {
      // Get all active tickets
      const tickets = await API.Tickets.getAll();
      if (!tickets || tickets.length === 0) return [];

      // Filter for tickets due today
      const { getSLAStatus } = await import('../utils/slaCalculator');

      const dueTodayTickets = tickets
        .filter(isOpenWithSLA)
        .map(ticket => ({
          ...ticket,
          sla_status: getSLAStatus(ticket.step_due_date)
        }))
        .filter(ticket => ticket.sla_status.isDueToday);

      return dueTodayTickets;
    },
    {
      staleTime: 60 * 1000, // 1 minute
      refetchInterval: 2 * 60 * 1000 // Refresh every 2 minutes
    }
  );
};

/**
 * SLA escalation rules of a company (+ ticket type, + step) - AppScript v9.5 getSLAEscalationRules.
 * The server runs the escalations (every 15 minutes); the browser only shows and edits the rules (compliance F1).
 */
export const useSLAEscalationRules = (companyId, ticketTypeId = null, stepId = null) => {
  return useAPIData(
    ['sla_escalation_rules', companyId, ticketTypeId, stepId],
    () => API.SLA.getEscalationRules(companyId, ticketTypeId, stepId),
    { enabled: !!companyId }
  );
};

/**
 * Escalation rule writes + the admin preview / run (AppScript v9.5). userId is the signed-in admin.
 */
export const useSLAEscalationMutations = (userId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    try {
      setLoading(true);
      setError(null);
      return await fn();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createEscalationRule = useCallback(rule => run(() => API.SLA.createEscalationRule(userId, rule)), [run, userId]);
  const updateEscalationRule = useCallback((ruleId, rule) => run(() => API.SLA.updateEscalationRule(userId, ruleId, rule)), [run, userId]);
  const deleteEscalationRule = useCallback(ruleId => run(() => API.SLA.deleteEscalationRule(userId, ruleId)), [run, userId]);
  const testEscalations = useCallback(() => run(() => API.SLA.testEscalations(userId)), [run, userId]);
  const runEscalationsNow = useCallback((dryRun = true) => run(() => API.SLA.runEscalationsNow(userId, dryRun)), [run, userId]);

  return { loading, error, createEscalationRule, updateEscalationRule, deleteEscalationRule, testEscalations, runEscalationsNow };
};

/** What fired on a ticket (AppScript v9.5 getSLAEscalationEvents), for the ticket timeline. */
export const useSLAEscalationEvents = (ticketId) => {
  return useAPIData(
    ['sla_escalation_events', ticketId],
    () => API.SLA.getEscalationEvents(ticketId),
    { enabled: !!ticketId }
  );
};

/**
 * The signed-in user's in-app notifications (AppScript v9.5): items, unread count, mark read. Refreshes every
 * minute and when the window regains focus.
 */
export const useNotifications = (userId) => {
  const { data, loading, error, refetch } = useAPIData(
    ['notifications', userId],
    () => API.Notifications.getAll(userId),
    { enabled: !!userId }
  );

  useEffect(() => {
    if (!userId) return undefined;
    const interval = setInterval(refetch, 60 * 1000);
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, refetch]);

  const markRead = useCallback(async (ids = null) => {
    if (!userId) return;
    await API.Notifications.markRead(userId, ids);
    await refetch();
  }, [userId, refetch]);

  return {
    notifications: data?.items || [],
    unreadCount: data?.unread_count || 0,
    loading,
    error,
    refetch,
    markRead
  };
};

/** Holidays of a company plus the ones for every company (AppScript v9.5 getCompanyHolidays). */
export const useCompanyHolidays = (companyId = null, year = null) => {
  return useAPIData(
    ['company_holidays', companyId, year],
    () => API.SLA.getHolidays(companyId, year)
  );
};

/** Email settings for SLA notices: global default + per ticket type (AppScript v9.5). */
export const useSLANotificationSettings = () => {
  return useAPIData(['sla_notification_settings'], () => API.SLA.getNotificationSettings());
};

// --- AppScript v9.6: invites, company email settings, ticket attachment links ---------------------------------

/** Runs a write: loading / error state, the error re-thrown for the caller's message (shared by the v9.6 hooks). */
const useWriteRunner = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async (fn) => {
    try {
      setLoading(true);
      setError(null);
      return await fn();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  return { loading, error, run };
};

/** Invites (admins): the list for a status + create / resend / revoke, each followed by a refetch (F5). */
export const useUserInvites = (status = 'pending', enabled = true) => {
  const { data, loading, error, refetch } = useAPIData(['user_invites', status], () => API.Invites.getAll({ status }), { enabled });
  const { loading: saving, error: saveError, run } = useWriteRunner();
  const after = useCallback(async (fn) => {
    const result = await run(fn);
    await refetch();
    return result;
  }, [run, refetch]);
  return {
    invites: data || [],
    loading,
    error,
    refetch,
    saving,
    saveError,
    createInvite: useCallback(invite => after(() => API.Invites.create(invite)), [after]),
    resendInvite: useCallback(id => after(() => API.Invites.resend(id)), [after]),
    revokeInvite: useCallback((id, reason) => after(() => API.Invites.revoke(id, reason)), [after])
  };
};

/** A company's email settings (admins) + save / send test email. */
export const useCompanyEmailSettings = (companyId) => {
  const { data, loading, error, refetch } = useAPIData(['company_email', companyId], () => API.CompanyEmail.get(companyId), { enabled: !!companyId });
  const { loading: saving, error: saveError, run } = useWriteRunner();
  const save = useCallback(async (settings) => {
    const result = await run(() => API.CompanyEmail.save(companyId, settings));
    await refetch();
    return result;
  }, [run, refetch, companyId]);
  const sendTest = useCallback(to => run(() => API.CompanyEmail.sendTest(companyId, to)), [run, companyId]);
  return { settings: data, loading, error, refetch, saving, saveError, save, sendTest };
};

/** A ticket's attachment links + add / remove / report broken / fix (the server decides who may do what). */
export const useTicketAttachments = (ticketId) => {
  const { data, loading, error, refetch } = useAPIData(['ticket_attachments', ticketId], () => API.Attachments.getForTicket(ticketId), { enabled: !!ticketId });
  const { loading: saving, error: saveError, run } = useWriteRunner();
  const after = useCallback(async (fn) => {
    const result = await run(fn);
    await refetch();
    return result;
  }, [run, refetch]);
  return {
    attachments: data?.attachments || [],
    canManage: !!data?.can_manage,
    closed: !!data?.closed,
    loading,
    error,
    refetch,
    saving,
    saveError,
    addLink: useCallback(link => after(() => API.Attachments.addLink(ticketId, link)), [after, ticketId]),
    removeLink: useCallback((id, reason) => after(() => API.Attachments.remove(id, reason)), [after]),
    reportBroken: useCallback((id, note) => after(() => API.Attachments.reportBroken(id, note)), [after]),
    fixLink: useCallback((id, link) => after(() => API.Attachments.fixLink(id, link)), [after])
  };
};

// Universal Entity Architecture hooks
// includeInactive: admin lists show deactivated types too, so they can be reactivated
export const useUserProfileTypes = (companyId = null, includeInactive = false) => {
  return useAPI(() => API.UserProfileTypes.getAll(companyId, includeInactive), [companyId, includeInactive], 'getUserProfileTypes');
};

export const useUserProfileTypeMutations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createUserProfileType = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.UserProfileTypes.create(data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfileType = async (id, data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.UserProfileTypes.update(id, data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteUserProfileType = async (id) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.UserProfileTypes.delete(id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createUserProfileType, updateUserProfileType, deleteUserProfileType, loading, error };
};

export const useRoleTypes = (companyId = null, includeInactive = false) => {
  return useAPI(() => API.RoleTypes.getAll(companyId, includeInactive), [companyId, includeInactive], 'getRoleTypes');
};

export const useRoleTypeMutations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createRoleType = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.RoleTypes.create(data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateRoleType = async (id, data) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.RoleTypes.update(id, data);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteRoleType = async (id) => {
    try {
      setLoading(true);
      setError(null);
      const result = await API.RoleTypes.delete(id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createRoleType, updateRoleType, deleteRoleType, loading, error };
};

const useAPIModule = {
  useAPI,
  useCompanies,
  useRoles,
  useDropdownLists,
  useTickets,
  useTicketTypes,
  useTicketTypeChoices,
  useUsers,
  useWorkflowSteps,
  useStepApprovals,
  useCanUserApprove,
  useCompany,
  useCompanyMutations,
  useRoleMutations,
  useDropdownOptions,
  useDropdownMutations,
  useTicket,
  useTicketMutations,
  useTicketHistory,
  useTicketsForApproval,
  useCommentRequirements,
  useUserPreferences,
  useTags,
  useSharedTickets,
  useStepConditions,
  useReportConfig,
  useTicketActionLogs,
  useSystemHealth,
  useAPITest,
  useAPIConnection,
  // SLA hooks
  useSLAStatus,
  useWorkflowStepSLA,
  useSLAOverdueTickets,
  useSLADueTodayTickets,
  // Per-Company SLA Performance hooks (Phase 8.95)
  useSLAPerformanceByCompany,
  useSLAPerformanceByTicketType,
  useGlobalSLAPerformance,
  // SLA Escalation hooks (AppScript v9.5)
  useSLAEscalationRules,
  useSLAEscalationMutations,
  useSLAEscalationEvents,
  useNotifications,
  useCompanyHolidays,
  useSLANotificationSettings,
  // AppScript v9.6
  useUserInvites,
  useCompanyEmailSettings,
  useTicketAttachments,
  // Universal Entity Architecture hooks
  useUserProfileTypes,
  useUserProfileTypeMutations,
  useRoleTypes,
  useRoleTypeMutations
};

export default useAPIModule;