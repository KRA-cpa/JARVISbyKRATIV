/**
 * Local Google Apps Script Mock Server
 * Simulates the Google Apps Script API endpoints for local testing
 *
 * Mirrors AppScript v9.0 behaviour for what it mocks: POST bodies are flat ({ action, ...fields }, the way
 * src/api/googleSheet.js sends them; { action, payload } still works), failures carry status: 'error', and the
 * Phase 10.0 + approval-path reads return fixed data for the dev user (dev-user-123). Writes outside the core
 * entities are not mocked - use run-frontend.bat live for those.
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = Number(process.env.MOCK_PORT) || 3001; // MOCK_PORT: run a second copy beside run-backend.bat

// Middleware
app.use(cors());
app.use(express.json());

// Mock data storage
let mockData = {
  companies: [
    { id: 'comp_1', name: 'Main Corporation', code: 'MAIN', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'comp_2', name: 'Tech Solutions Inc.', code: 'TECH', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ],
  roles: [
    { id: 'role_1', name: 'Global Admin', company_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'role_2', name: 'Manager', company_id: 'comp_1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ],
  dropdownLists: [
    {
      id: 'dd_1',
      name: 'Departments',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      options: [
        { id: 'opt_1', dropdown_list_id: 'dd_1', label: 'Engineering', value: 'eng', parent_option_id: '' },
        { id: 'opt_2', dropdown_list_id: 'dd_1', label: 'Marketing', value: 'mkt', parent_option_id: '' }
      ]
    }
  ],
  ticketTypes: [
    {
      id: 'tt_1',
      transaction_id: 'TR001',
      code: 'PR',
      name: 'Purchase Request',
      description: 'Request for purchasing items',
      is_active: true,
      require_attachment_on_create: true,
      company_id: 'comp_1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  customFields: [
    {
      id: 'cf_1',
      ticket_type_id: 'tt_1',
      name: 'item_description',
      label: 'Item Description',
      type: 'paragraph',
      is_required: true,
      is_hidden: false,
      sort_order: 1,
      dropdown_list_id: null,
      depends_on_field_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'cf_2',
      ticket_type_id: 'tt_1',
      name: 'estimated_cost',
      label: 'Estimated Cost',
      type: 'amount',
      is_required: true,
      is_hidden: false,
      sort_order: 2,
      dropdown_list_id: null,
      depends_on_field_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  // Phase 10.0 + approval path (read-only mocks)
  userProfileTypes: [
    { id: 'upt_1', name: 'Standard Employee', code: 'EMP', description: 'Regular employee', company_id: '', is_active: true },
    { id: 'upt_2', name: 'Contractor', code: 'CTR', description: 'External contractor', company_id: '', is_active: false }
  ],
  roleTypes: [
    { id: 'rt_1', name: 'Approval Roles', code: 'APR', description: 'Roles that approve steps', company_id: '', is_active: true }
  ],
  userProfiles: [
    {
      user_id: 'dev-user-123', id: 'dev-user-123', display_name: 'Dev User', name: 'Dev User', email: 'dev@localhost',
      is_active: true, general_role: 'both',
      roles: [{ id: 'role_2', name: 'Manager', company_id: 'comp_1', assignment_id: 'ura_1' }]
    }
  ],
  roleAssignments: [
    {
      id: 'ura_1', user_id: 'dev-user-123', role_id: 'role_2', role_name: 'Manager', company_id: 'comp_1', ticket_type_id: '',
      assignment_type: 'permanent', effective_start_date: '2026-01-01', effective_end_date: '', is_active: true
    }
  ],
  workflowSteps: [
    {
      id: 'ws_1', ticket_type_id: 'tt_1', company_id: 'comp_1', name: 'Manager Approval', status_on_reach: 'Pending Manager',
      step_type: 'approval', approver_logic: 'any', sort_order: 1, is_active: true
    }
  ],
  stepApprovers: [{ step_id: 'ws_1', role_id: 'role_2' }],
  // v9.1 core loop (in memory): created tickets, their history, links, comment rules, number counters
  tickets: [],
  ticketHistory: [],
  ticketLinks: [],
  commentRequirements: [],
  counters: {},
  // v9.2 (in memory): routes per step (saved, not evaluated - the mock always takes the next step), report
  // columns per ticket type + company, admin log entries written by the v9.2 saves
  stepConditions: {},
  reportConfigs: [],
  adminLogs: [],
  // v9.3 (in memory): dropdown access, company SLA rules, ticket type switches, tags, tag assignments, shares
  dropdownAccess: {},
  slaRules: [],
  typeFeatures: {},
  tags: [],
  tagAssignments: [],
  shares: []
};

const isOn = v => v === true || String(v).toUpperCase() === 'TRUE';
const ticketTypeOf = ticketId => {
  const ticket = mockData.tickets.find(t => String(t.id) === String(ticketId));
  return ticket ? { ticket, features: mockData.typeFeatures[ticket.ticket_type_id] || {} } : null;
};
const ticketTagsOf = ticketId => mockData.tagAssignments
  .filter(a => String(a.ticket_id) === String(ticketId))
  .map(a => ({ ...(mockData.tags.find(t => t.id === a.tag_id) || {}), assignment_id: a.id, assigned_at: a.created_at }));

const STANDARD_REPORT_COLUMNS = [
  { field_name: 'ticket_number', display_name: 'Ticket #', field_type: 'standard' },
  { field_name: 'title', display_name: 'Title', field_type: 'standard' },
  { field_name: 'status', display_name: 'Status', field_type: 'standard' },
  { field_name: 'current_step_name', display_name: 'Current Step', field_type: 'standard' },
  { field_name: 'sla_status', display_name: 'SLA Status', field_type: 'standard' },
  { field_name: 'created_at', display_name: 'Created', field_type: 'standard' }
];
const reportConfigFor = (ticketTypeId, companyId) => {
  const rows = mockData.reportConfigs.filter(r => r.ticket_type_id === ticketTypeId);
  const chosen = rows.find(r => companyId && r.company_id === companyId) || rows.find(r => !r.company_id);
  return { ticket_type_id: ticketTypeId, company_id: companyId || '', source: chosen ? (chosen.company_id ? 'company' : 'global') : 'default',
    columns: chosen ? chosen.columns : STANDARD_REPORT_COLUMNS, available: STANDARD_REPORT_COLUMNS };
};
const adminLog = (userId, actionType, entity, targetId, details) => mockData.adminLogs.unshift({ id: generateId('al'),
  admin_user_id: userId || 'dev', action_type: actionType, target_entity: entity, target_id: targetId, details, timestamp: new Date().toISOString() });

// --- v9.1 mock ticket flow: one approver (the dev user) can act on every open ticket ------------------
const TERMINAL = ['Completed', 'Rejected', 'Cancelled'];
const stepsFor = (ticket) => mockData.workflowSteps
  .filter(s => s.ticket_type_id === ticket.ticket_type_id && s.company_id === ticket.company_id && s.is_active !== false)
  .sort((a, b) => a.sort_order - b.sort_order);
const nextNumber = (companyId, ticketTypeId, reserve) => {
  const company = mockData.companies.find(c => c.id === companyId) || { code: 'UNK' };
  const type = mockData.ticketTypes.find(t => t.id === ticketTypeId) || { code: 'TKT' };
  const key = `${company.code}-${type.code}`;
  const next = (mockData.counters[key] || 0) + 1;
  if (reserve) mockData.counters[key] = next;
  return `${key}-${new Date().getFullYear()}-${String(next).padStart(8, '0')}`;
};
const addHistory = (ticket, userId, action, comment, fromStep, toStep, fromStatus) => {
  mockData.ticketHistory.push({ id: generateId('th'), ticket_id: ticket.id, user_id: userId, action, comment,
    timestamp: new Date().toISOString(), from_status: fromStatus, to_status: ticket.status, from_step_id: fromStep || '', to_step_id: toStep || '' });
};
const moveTicket = (ticket, step) => {
  ticket.current_step_id = step ? step.id : '';
  ticket.step_due_date = step ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : '';
  ticket.updated_at = new Date().toISOString();
};

// Utility functions
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createResponse(success, data = null, error = null) {
  return {
    success,
    ...(success ? {} : { status: 'error' }), // like AppScript v9.0: makes makeRequest() throw
    data,
    error,
    timestamp: new Date().toISOString()
  };
}

// Phase 10.0 handlers return { status, data, message }; the frontend unwraps it (unwrapHandlerResult)
const handlerResult = (data) => ({ status: 'success', data, message: 'mock' });
const activeOnly = (list, query) => (String(query.include_inactive) === 'true' ? list : list.filter(item => item.is_active !== false));

// API Routes - Simulate Google Apps Script endpoints
app.get('/exec', (req, res) => {
  const { action } = req.query;
  console.log(`GET /exec - Action: ${action}`);

  try {
    switch (action) {
      case 'ping':
        res.json(createResponse(true, {
          status: 'API is running',
          timestamp: new Date().toISOString(),
          version: '2.4-local',
          message: 'Local Google Apps Script Mock Server'
        }));
        break;

      case 'getCompanies':
        res.json(createResponse(true, mockData.companies));
        break;

      case 'getRoles':
        res.json(createResponse(true, mockData.roles));
        break;

      case 'getDropdownLists':
        res.json(createResponse(true, mockData.dropdownLists));
        break;

      case 'getTicketTypes':
        res.json(createResponse(true, mockData.ticketTypes));
        break;

      case 'getCompany':
        res.json(createResponse(true, mockData.companies.find(c => c.id === req.query.companyId) || null));
        break;

      case 'getDropdownOptions': {
        const list = mockData.dropdownLists.find(dl => dl.id === req.query.listId);
        res.json(createResponse(true, list ? list.options : []));
        break;
      }

      case 'getUserPreferences':
        res.json(createResponse(true, { user_id: req.query.user_id, dark_mode: false, timezone: 'Asia/Manila' }));
        break;

      case 'getUserProfileTypes':
        res.json(createResponse(true, handlerResult(activeOnly(mockData.userProfileTypes, req.query))));
        break;

      case 'getRoleTypes':
        res.json(createResponse(true, handlerResult(activeOnly(mockData.roleTypes, req.query))));
        break;

      case 'getWorkflowSteps':
        res.json(createResponse(true, mockData.workflowSteps.filter(s =>
          (!req.query.ticket_type_id || s.ticket_type_id === req.query.ticket_type_id) &&
          (!req.query.company_id || s.company_id === req.query.company_id))));
        break;

      case 'getSystemHealth':
        res.json(createResponse(true, { status: 'healthy', api_version: 'mock', server_time: new Date().toISOString(), tables: {}, issues: [] }));
        break;

      case 'getCustomFields':
        const { ticket_type_id } = req.query;
        let customFields = mockData.customFields;
        if (ticket_type_id) {
          customFields = customFields.filter(cf => cf.ticket_type_id === ticket_type_id);
        }
        res.json(createResponse(true, customFields));
        break;

      // v9.1 reads
      case 'getTickets':
        res.json(createResponse(true, mockData.tickets));
        break;

      case 'getNextTicketNumber':
        res.json(createResponse(true, { ticket_number: nextNumber(req.query.company_id, req.query.ticket_type_id, false) }));
        break;

      case 'getTicketType':
        res.json(createResponse(true, mockData.ticketTypes.find(t => t.id === req.query.ticket_type_id) || null));
        break;

      case 'getCustomField':
        res.json(createResponse(true, mockData.customFields.find(f => f.id === req.query.field_id) || null));
        break;

      case 'getTicketLinks':
        res.json(createResponse(true, mockData.ticketLinks));
        break;

      case 'validateTicketDependencies':
        res.json(createResponse(true, { total_links: mockData.ticketLinks.length, circular_dependencies: [], orphaned_tickets: [], validation_passed: true }));
        break;

      case 'checkCompanyLockStatus': {
        const company = mockData.companies.find(c => c.id === req.query.id) || {};
        const count = mockData.tickets.filter(t => t.company_id === req.query.id).length;
        res.json(createResponse(true, { company_id: req.query.id, code: company.code, code_locked: count > 0, ticket_count: count }));
        break;
      }

      case 'getCommentRequirements': {
        const rule = mockData.commentRequirements.find(r => r.ticket_type_id === req.query.ticket_type_id) || {};
        res.json(createResponse(true, { ticket_type_id: req.query.ticket_type_id, source: rule.ticket_type_id ? 'global' : 'none',
          require_on_approve: !!rule.require_on_approve, require_on_return: !!rule.require_on_return,
          require_on_reject: !!rule.require_on_reject, require_on_cancel: !!rule.require_on_cancel }));
        break;
      }

      case 'getTicketHistory':
        res.json(createResponse(true, mockData.ticketHistory.filter(h => String(h.ticket_id) === String(req.query.ticket_id)).reverse()));
        break;

      case 'getTicketsForApproval':
        res.json(createResponse(true, mockData.tickets
          .filter(t => t.current_step_id && !TERMINAL.includes(t.status))
          .map(t => ({ ...t, current_step_name: (mockData.workflowSteps.find(s => s.id === t.current_step_id) || {}).name, approver_logic: 'any', eligible_role_ids: ['role_2'] }))));
        break;

      // v9.5 reads: SLA escalation, notifications, holidays (empty in the mock - the escalation run is server-side)
      case 'getNotifications':
        res.json(createResponse(true, { items: [], unread_count: 0, total: 0 }));
        break;

      case 'getSLAEscalationRules':
      case 'getSLAEscalationEvents':
      case 'getCompanyHolidays':
        res.json(createResponse(true, []));
        break;

      case 'testSLAEscalations':
        res.json(createResponse(true, { dry_run: true, skipped: false, checked: mockData.tickets.length, fired: [], notifications: 0, capped: false }));
        break;

      case 'getSLANotificationSettings':
        res.json(createResponse(true, { email_default: 'off', quota_remaining: 100,
          ticket_types: mockData.ticketTypes.map(t => ({ ticket_type_id: String(t.id), name: t.name, sla_email: 'default', email_on: false })) }));
        break;

      // v9.4 read: what the dashboard needs besides the ticket list
      case 'getDashboard': {
        const open = mockData.tickets.filter(t => !TERMINAL.includes(t.status));
        const inbox = open.filter(t => t.current_step_id)
          .map(t => ({ ...t, current_step_name: (mockData.workflowSteps.find(s => s.id === t.current_step_id) || {}).name, approver_logic: 'any', eligible_role_ids: ['role_2'] }));
        res.json(createResponse(true, {
          companies: mockData.companies,
          ticket_types: mockData.ticketTypes,
          approval_inbox: inbox,
          counts: {
            total: mockData.tickets.length, open: open.length, closed: mockData.tickets.length - open.length,
            mine: mockData.tickets.filter(t => String(t.requester_id) === String(req.query.user_id)).length,
            overdue: 0, due_today: 0, for_my_approval: inbox.length
          }
        }));
        break;
      }

      // v9.2 reads
      case 'getStepConditions':
        res.json(createResponse(true, mockData.stepConditions[req.query.step_id] || { step_id: req.query.step_id, enabled: false, routes: [] }));
        break;

      case 'getReportConfig':
        res.json(createResponse(true, reportConfigFor(req.query.ticket_type_id, req.query.company_id)));
        break;

      case 'getReportData': {
        const config = reportConfigFor(req.query.ticket_type_id, req.query.company_id);
        const rows = mockData.tickets
          .filter(t => t.ticket_type_id === req.query.ticket_type_id && (!req.query.company_id || t.company_id === req.query.company_id))
          .map(t => {
            const row = { ticket_id: String(t.id) };
            config.columns.forEach(c => {
              row[c.field_name] = c.field_name === 'current_step_name' ? ((mockData.workflowSteps.find(st => st.id === t.current_step_id) || {}).name || '')
                : c.field_name === 'sla_status' ? (TERMINAL.includes(t.status) ? 'Closed' : (t.step_due_date ? 'On Track' : 'No SLA'))
                : String(t[c.field_name] ?? '');
            });
            return row;
          });
        res.json(createResponse(true, { columns: config.columns, rows, total: rows.length, scope: 'all', config_source: config.source }));
        break;
      }

      case 'getAdminActionLogs': {
        const limit = Number(req.query.limit) || 50;
        const offset = Number(req.query.offset) || 0;
        const logs = mockData.adminLogs.filter(l => !req.query.action_type || l.action_type === req.query.action_type);
        res.json(createResponse(true, { logs: logs.slice(offset, offset + limit), total: logs.length, limit, offset,
          action_types: [...new Set(mockData.adminLogs.map(l => l.action_type))],
          target_entities: [...new Set(mockData.adminLogs.map(l => l.target_entity))] }));
        break;
      }

      case 'getTicketActionLogs':
        res.json(createResponse(true, []));
        break;

      // v9.3 reads
      case 'getDropdownCompanyAssignments':
        res.json(createResponse(true, mockData.dropdownAccess[req.query.dropdown_list_id] || []));
        break;

      case 'getCompanySLARules':
        res.json(createResponse(true, mockData.slaRules.filter(r => r.company_id === req.query.company_id &&
          (!req.query.ticket_type_id || r.ticket_type_id === req.query.ticket_type_id))));
        break;

      case 'getTags':
        res.json(createResponse(true, mockData.tags.filter(t => !req.query.company_id || !t.company_id || t.company_id === req.query.company_id)));
        break;

      case 'getTicketTags':
        res.json(createResponse(true, ticketTagsOf(req.query.ticket_id)));
        break;

      case 'searchTicketsByTags': {
        const wanted = String(req.query.tag_ids || '').split(',').filter(Boolean);
        const excluded = String(req.query.exclude_tag_ids || '').split(',').filter(Boolean);
        const all = String(req.query.operator || 'OR').toUpperCase() === 'AND';
        const ids = mockData.tickets.map(t => String(t.id)).filter(id => {
          const tags = mockData.tagAssignments.filter(a => String(a.ticket_id) === id).map(a => a.tag_id);
          if (excluded.some(tag => tags.includes(tag))) return false;
          if (wanted.length === 0) return excluded.length > 0;
          return all ? wanted.every(tag => tags.includes(tag)) : wanted.some(tag => tags.includes(tag));
        });
        res.json(createResponse(true, { ticket_ids: ids, operator: all ? 'AND' : 'OR' }));
        break;
      }

      case 'getTicketShares':
        res.json(createResponse(true, mockData.shares.filter(sh => String(sh.ticket_id) === String(req.query.ticket_id))));
        break;

      case 'getSharedTickets':
        res.json(createResponse(true, mockData.shares
          .filter(sh => sh.shared_with_user_id === req.query.user_id)
          .map(sh => ({ ...(mockData.tickets.find(t => String(t.id) === String(sh.ticket_id)) || {}), share: { id: sh.id, permission_level: sh.permission_level, via: 'user' } }))));
        break;

      default:
        res.json(createResponse(false, null, `Unknown action: ${action}`));
    }
  } catch (error) {
    console.error('GET Error:', error);
    res.json(createResponse(false, null, error.message));
  }
});

app.post('/exec', (req, res) => {
  // The frontend sends { action, ...fields }; older callers send { action, payload }
  const { action, payload: wrappedPayload, ...flatFields } = req.body || {};
  const payload = wrappedPayload || flatFields;
  console.log(`POST /exec - Action: ${action}`, payload ? 'with payload' : 'no payload');

  try {
    switch (action) {
      // v9.5: nothing to mark in the mock
      case 'markNotificationsRead':
        res.json(createResponse(true, { marked: 0 }));
        break;
      case 'ping':
        res.json(createResponse(true, {
          status: 'API is running',
          timestamp: new Date().toISOString(),
          version: '2.4-local',
          message: 'Local Google Apps Script Mock Server'
        }));
        break;

      case 'getCompanies':
        res.json(createResponse(true, mockData.companies));
        break;

      // Approval path reads (v9.0 routes, unwrapped like createDataResponse)
      case 'getUsers':
        res.json(createResponse(true, mockData.userProfiles));
        break;

      case 'getUserProfile': {
        const profile = mockData.userProfiles.find(p => p.user_id === (payload.userId || payload.user_id));
        res.json(createResponse(true, profile
          ? { ...profile, companies: mockData.companies.filter(c => profile.roles.some(r => r.company_id === c.id)) }
          : null));
        break;
      }

      case 'getUserRoles':
        res.json(createResponse(true, mockData.roleAssignments.filter(a => a.user_id === (payload.userId || payload.user_id))));
        break;

      case 'getUserGeneralRole': {
        const profile = mockData.userProfiles.find(p => p.user_id === (payload.userId || payload.user_id));
        res.json(createResponse(true, { user_id: payload.userId || payload.user_id, general_role: profile ? profile.general_role : 'viewer' }));
        break;
      }

      case 'getStepApprovers':
        res.json(createResponse(true, mockData.stepApprovers.filter(a => a.step_id === payload.step_id)));
        break;

      case 'getWorkflowStep':
        res.json(createResponse(true, mockData.workflowSteps.find(s => s.id === payload.step_id) || null));
        break;

      case 'canUserApprove':
        res.json(createResponse(true, {
          can_approve: true, can_act: true, already_approved: false, approver_logic: 'any',
          eligible_role_ids: ['role_2'], required_role_ids: ['role_2'], approved_role_ids: []
        }));
        break;

      // v9.1 mock ticket flow
      case 'createTicket': {
        if (!payload.title || !payload.ticket_type_id || !payload.company_id || !payload.requester_id) {
          return res.json(createResponse(false, null, 'title, ticket_type_id, company_id and requester_id are required'));
        }
        const now = new Date().toISOString();
        const ticket = { id: mockData.tickets.length + 1, ticket_number: nextNumber(payload.company_id, payload.ticket_type_id, true),
          title: payload.title, description: payload.description || '', priority: payload.priority || 'medium',
          ticket_type_id: payload.ticket_type_id, company_id: payload.company_id, requester_id: payload.requester_id,
          status: 'New', current_step_id: '', step_due_date: '', created_at: now, updated_at: now, is_active: true };
        mockData.tickets.push(ticket);
        addHistory(ticket, payload.requester_id, 'Created', 'Ticket submitted by user.', '', '', '');
        const first = stepsFor(ticket)[0];
        if (first) {
          ticket.status = first.status_on_reach || 'Pending';
          moveTicket(ticket, first);
          addHistory(ticket, payload.requester_id, 'WORKFLOW_STARTED', `Workflow started at step: ${first.name}`, '', first.id, 'New');
        }
        res.json(createResponse(true, { id: ticket.id, ticketId: ticket.id, ticket_number: ticket.ticket_number, ticketNumber: ticket.ticket_number,
          workflow: { started: !!first, step_id: first ? first.id : null }, customFieldErrors: [] }));
        break;
      }

      case 'getTicket':
        res.json(createResponse(true, mockData.tickets.find(t => String(t.id) === String(payload.ticketId || payload.id)) || null));
        break;

      case 'submitStepApproval': {
        const ticket = mockData.tickets.find(t => String(t.id) === String(payload.ticket_id));
        if (!ticket || !ticket.current_step_id) return res.json(createResponse(false, null, 'Ticket has no current workflow step'));
        const steps = stepsFor(ticket);
        const index = steps.findIndex(s => s.id === ticket.current_step_id);
        const fromStep = ticket.current_step_id;
        const fromStatus = ticket.status;
        const decision = String(payload.decision || '').toLowerCase();
        if (decision === 'approve') {
          const next = steps[index + 1];
          ticket.status = next ? (next.status_on_reach || 'Pending') : 'Completed';
          moveTicket(ticket, next);
          addHistory(ticket, payload.user_id, 'APPROVED', payload.comment, fromStep, next ? next.id : '', fromStatus);
        } else if (decision === 'complete') {
          // v9.2: a task step moves on like an approval
          if ((steps[index] || {}).step_type !== 'task') {
            return res.json(createResponse(false, null, 'Only a task step can be marked complete - approve this step instead'));
          }
          const next = steps[index + 1];
          ticket.status = next ? (next.status_on_reach || 'Pending') : 'Completed';
          moveTicket(ticket, next);
          addHistory(ticket, payload.user_id, 'COMPLETED', payload.comment, fromStep, next ? next.id : '', fromStatus);
        } else if (decision === 'reject') {
          ticket.status = 'Rejected';
          addHistory(ticket, payload.user_id, 'REJECTED', payload.comment, fromStep, '', fromStatus);
        } else if (decision === 'return') {
          const previous = steps[index - 1];
          ticket.status = previous ? (previous.status_on_reach || 'Pending') : 'Returned to Requester';
          moveTicket(ticket, previous);
          addHistory(ticket, payload.user_id, 'RETURNED', payload.comment, fromStep, previous ? previous.id : '', fromStatus);
        } else {
          return res.json(createResponse(false, null, `Invalid action: ${payload.decision}`));
        }
        res.json(createResponse(true, { ticket_id: ticket.id, action_performed: decision, new_status: ticket.status, partial: false }));
        break;
      }

      case 'updateTicketStatus': {
        const ticket = mockData.tickets.find(t => String(t.id) === String(payload.id));
        if (!ticket) return res.json(createResponse(false, null, 'Ticket not found'));
        if (!payload.user_id) return res.json(createResponse(false, null, 'user_id is required'));
        const status = String(payload.status || '').toLowerCase();
        const fromStatus = ticket.status;
        if (status === 'cancelled') {
          ticket.status = 'Cancelled';
          addHistory(ticket, payload.user_id, 'CANCELLED', payload.comment || 'Cancelled', ticket.current_step_id, '', fromStatus);
        } else if (status === 'reopened') {
          const first = stepsFor(ticket)[0];
          ticket.status = first ? (first.status_on_reach || 'Pending') : 'New';
          moveTicket(ticket, first);
          addHistory(ticket, payload.user_id, 'REOPENED', 'Ticket reopened', '', first ? first.id : '', fromStatus);
        } else {
          return res.json(createResponse(false, null, `Status '${payload.status}' can't be set directly`));
        }
        res.json(createResponse(true, ticket));
        break;
      }

      case 'createWorkflowStep': {
        if (!payload.company_id) return res.json(createResponse(false, null, 'Missing required field: company_id'));
        const step = { id: generateId('ws'), ticket_type_id: payload.ticket_type_id, company_id: payload.company_id, name: payload.name,
          status_on_reach: payload.status_on_reach, step_type: payload.step_type, approver_logic: payload.approver_logic || 'any',
          sort_order: Number(payload.sort_order) || 1, sla_duration: payload.sla_duration || '', sla_unit: payload.sla_unit || '', is_active: true };
        mockData.workflowSteps.push(step);
        res.json(createResponse(true, step));
        break;
      }

      case 'updateWorkflowStep': {
        const step = mockData.workflowSteps.find(s => s.id === payload.step_id);
        if (!step) return res.json(createResponse(false, null, 'Workflow step not found'));
        ['name', 'status_on_reach', 'step_type', 'approver_logic', 'sort_order', 'sla_duration', 'sla_unit'].forEach(k => {
          if (payload[k] !== undefined) step[k] = payload[k];
        });
        res.json(createResponse(true, step));
        break;
      }

      case 'deleteWorkflowStep': {
        const step = mockData.workflowSteps.find(s => s.id === payload.step_id);
        if (step) step.is_active = false;
        res.json(createResponse(true, { id: payload.step_id, deactivated: !!step }));
        break;
      }

      case 'setStepApprovers':
        mockData.stepApprovers = mockData.stepApprovers.filter(a => a.step_id !== payload.step_id)
          .concat((payload.role_ids || []).map(role_id => ({ step_id: payload.step_id, role_id })));
        res.json(createResponse(true, { step_id: payload.step_id, role_ids: payload.role_ids || [] }));
        break;

      // v9.2 writes
      case 'saveStepConditions': {
        const enabled = payload.enabled !== false && Array.isArray(payload.routes) && payload.routes.length > 0;
        mockData.stepConditions[payload.step_id] = { step_id: payload.step_id, enabled, routes: enabled ? payload.routes : [] };
        adminLog(payload.user_id, 'SAVE_STEP_CONDITIONS', 'workflow_step', payload.step_id, { routes: enabled ? payload.routes.length : 0 });
        res.json(createResponse(true, mockData.stepConditions[payload.step_id]));
        break;
      }

      case 'saveReportConfig':
        if (!Array.isArray(payload.columns) || payload.columns.length === 0) {
          return res.json(createResponse(false, null, 'Pick at least one column'));
        }
        mockData.reportConfigs = mockData.reportConfigs
          .filter(r => !(r.ticket_type_id === payload.ticket_type_id && (r.company_id || '') === (payload.company_id || '')))
          .concat([{ ticket_type_id: payload.ticket_type_id, company_id: payload.company_id || '',
            columns: payload.columns.map(c => ({ ...(STANDARD_REPORT_COLUMNS.find(st => st.field_name === c.field_name) || { field_type: 'custom' }), ...c })) }]);
        adminLog(payload.user_id, 'SAVE_REPORT_CONFIG', 'ticket_type', payload.ticket_type_id, { company_id: payload.company_id || '' });
        res.json(createResponse(true, reportConfigFor(payload.ticket_type_id, payload.company_id)));
        break;

      // v9.3 writes
      case 'updateDropdownCompanyAssignments': {
        const global = (payload.assignments || []).some(a => a.is_global);
        mockData.dropdownAccess[payload.dropdown_list_id] = global
          ? [{ id: generateId('dca'), dropdown_list_id: payload.dropdown_list_id, company_id: '', is_global: true, is_active: true }]
          : (payload.assignments || []).map(a => ({ id: generateId('dca'), dropdown_list_id: payload.dropdown_list_id, company_id: a.company_id, is_global: false, is_active: true }));
        res.json(createResponse(true, mockData.dropdownAccess[payload.dropdown_list_id]));
        break;
      }

      case 'assignDropdownToCompany':
      case 'assignDropdownGlobally':
      case 'removeDropdownCompanyAssignment':
        res.json(createResponse(true, mockData.dropdownAccess[payload.dropdown_list_id] || []));
        break;

      case 'createCompanySLARule': {
        const rule = { ...payload, id: generateId('csla'), is_active: true, created_at: new Date().toISOString() };
        mockData.slaRules.push(rule);
        res.json(createResponse(true, rule));
        break;
      }

      case 'updateCompanySLARule': {
        const rule = mockData.slaRules.find(r => r.id === payload.rule_id);
        if (!rule) return res.json(createResponse(false, null, 'SLA rule not found'));
        Object.assign(rule, payload);
        res.json(createResponse(true, rule));
        break;
      }

      case 'deleteCompanySLARule':
        mockData.slaRules = mockData.slaRules.filter(r => r.id !== payload.rule_id);
        res.json(createResponse(true, { id: payload.rule_id, deleted: true }));
        break;

      case 'exportConfiguration':
        res.json(createResponse(true, { format: 'jarvis-config', api_version: 'mock', company: { id: payload.company_id },
          workflow_steps: mockData.workflowSteps.filter(st => st.company_id === payload.company_id), counts: {} }));
        break;

      case 'createConfigurationBackup':
        res.json(createResponse(true, { file_id: 'mock_file', url: 'https://drive.google.com/', name: 'mock-backup.json', size: 0 }));
        break;

      case 'importConfiguration':
        res.json(createResponse(true, { dry_run: payload.dry_run !== false, actions: [{ area: 'workflows', action: 'skip', detail: 'Mock server: import is not simulated' }], counts: { skip: 1 } }));
        break;

      case 'setTicketTypeFeatures': {
        const current = mockData.typeFeatures[payload.ticket_type_id] || {};
        ['enable_tags', 'enable_sharing'].forEach(key => { if (payload[key] !== undefined) current[key] = isOn(payload[key]); });
        mockData.typeFeatures[payload.ticket_type_id] = current;
        const type = mockData.ticketTypes.find(t => t.id === payload.ticket_type_id);
        if (type) Object.assign(type, current);
        res.json(createResponse(true, { ticket_type_id: payload.ticket_type_id, ...current, tags_locked: false, sharing_locked: false }));
        break;
      }

      case 'createTag': {
        const tag = { id: generateId('tag'), name: payload.name, color: payload.color || '#3B82F6', company_id: payload.company_id || '', usage_count: 0, is_global: !payload.company_id };
        mockData.tags.push(tag);
        res.json(createResponse(true, tag));
        break;
      }

      case 'updateTag': {
        const tag = mockData.tags.find(t => t.id === payload.tag_id);
        if (tag) Object.assign(tag, payload);
        res.json(createResponse(!!tag, tag || null, tag ? null : 'Tag not found'));
        break;
      }

      case 'deleteTag':
        mockData.tags = mockData.tags.filter(t => t.id !== payload.tag_id);
        res.json(createResponse(true, { id: payload.tag_id, deleted: true }));
        break;

      case 'assignTags': {
        const found = ticketTypeOf(payload.ticket_id);
        if (!found || !found.features.enable_tags) return res.json(createResponse(false, null, 'Tags are turned off for this ticket type'));
        [].concat(payload.tag_ids || []).forEach(tagId => {
          if (!mockData.tagAssignments.some(a => String(a.ticket_id) === String(payload.ticket_id) && a.tag_id === tagId)) {
            mockData.tagAssignments.push({ id: generateId('tta'), ticket_id: payload.ticket_id, tag_id: tagId, created_at: new Date().toISOString() });
          }
        });
        res.json(createResponse(true, ticketTagsOf(payload.ticket_id)));
        break;
      }

      case 'removeTags':
        mockData.tagAssignments = mockData.tagAssignments.filter(a => !(String(a.ticket_id) === String(payload.ticket_id) && [].concat(payload.tag_ids || []).includes(a.tag_id)));
        res.json(createResponse(true, ticketTagsOf(payload.ticket_id)));
        break;

      case 'shareTicket': {
        const found = ticketTypeOf(payload.ticket_id);
        if (!found || !found.features.enable_sharing) return res.json(createResponse(false, null, 'Sharing is turned off for this ticket type'));
        const share = { ...payload, id: generateId('share'), shared_by_user_id: payload.user_id, shared_at: new Date().toISOString(),
          shared_with_user_name: payload.shared_with_user_id, shared_with_company_name: payload.shared_with_company_id, shared_by_user_name: payload.user_id };
        mockData.shares.push(share);
        res.json(createResponse(true, share));
        break;
      }

      case 'revokeTicketShare':
        mockData.shares = mockData.shares.filter(sh => sh.id !== payload.collaboration_id);
        res.json(createResponse(true, { id: payload.collaboration_id, revoked: true }));
        break;

      case 'saveCommentRequirements':
        mockData.commentRequirements = mockData.commentRequirements.filter(r => r.ticket_type_id !== payload.ticket_type_id).concat([payload]);
        res.json(createResponse(true, payload));
        break;

      case 'getStepApprovals':
        res.json(createResponse(true, []));
        break;

      case 'createCompany':
        if (!payload.name || !payload.code) {
          return res.json(createResponse(false, null, 'Company name and code are required'));
        }

        const newCompany = {
          id: generateId('comp'),
          name: payload.name.trim(),
          code: payload.code.toUpperCase().trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        mockData.companies.push(newCompany);
        res.json(createResponse(true, newCompany));
        break;

      case 'createRole':
        if (!payload.name) {
          return res.json(createResponse(false, null, 'Role name is required'));
        }

        const newRole = {
          id: generateId('role'),
          name: payload.name.trim(),
          company_id: payload.company_id === 'global' ? null : payload.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        mockData.roles.push(newRole);
        res.json(createResponse(true, newRole));
        break;

      case 'createDropdownList':
        if (!payload.name) {
          return res.json(createResponse(false, null, 'Dropdown list name is required'));
        }

        const newList = {
          id: generateId('dd'),
          name: payload.name.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          options: payload.options || []
        };

        mockData.dropdownLists.push(newList);
        res.json(createResponse(true, newList));
        break;

      case 'createTicketType':
        if (!payload.name || !payload.code) {
          return res.json(createResponse(false, null, 'Ticket type name and code are required'));
        }

        const newTicketType = {
          id: generateId('tt'),
          transaction_id: payload.transaction_id || generateId('tr'),
          code: payload.code.toUpperCase().trim(),
          name: payload.name.trim(),
          description: payload.description || '',
          is_active: payload.is_active !== false,
          require_attachment_on_create: payload.require_attachment_on_create || false,
          company_id: payload.company_id === 'global' ? null : payload.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        mockData.ticketTypes.push(newTicketType);
        res.json(createResponse(true, newTicketType));
        break;

      case 'updateTicketType':
        if (!payload.ticket_type_id) {
          return res.json(createResponse(false, null, 'Ticket type ID is required'));
        }

        const ticketTypeIndex = mockData.ticketTypes.findIndex(tt => tt.id === payload.ticket_type_id);
        if (ticketTypeIndex === -1) {
          return res.json(createResponse(false, null, 'Ticket type not found'));
        }

        mockData.ticketTypes[ticketTypeIndex] = {
          ...mockData.ticketTypes[ticketTypeIndex],
          ...payload,
          updated_at: new Date().toISOString()
        };

        res.json(createResponse(true, mockData.ticketTypes[ticketTypeIndex]));
        break;

      case 'deleteTicketType':
        if (!payload.ticket_type_id) {
          return res.json(createResponse(false, null, 'Ticket type ID is required'));
        }

        const ticketTypeToDelete = mockData.ticketTypes.findIndex(tt => tt.id === payload.ticket_type_id);
        if (ticketTypeToDelete === -1) {
          return res.json(createResponse(false, null, 'Ticket type not found'));
        }

        mockData.ticketTypes.splice(ticketTypeToDelete, 1);
        res.json(createResponse(true, { deleted: true }));
        break;

      case 'createCustomField':
        if (!payload.ticket_type_id || !payload.name || !payload.label) {
          return res.json(createResponse(false, null, 'Ticket type ID, name, and label are required'));
        }

        const newCustomField = {
          id: generateId('cf'),
          ticket_type_id: payload.ticket_type_id,
          name: payload.name.trim(),
          label: payload.label.trim(),
          type: payload.type || 'text',
          is_required: payload.is_required || false,
          is_hidden: payload.is_hidden || false,
          sort_order: payload.sort_order || 1,
          dropdown_list_id: payload.dropdown_list_id || null,
          depends_on_field_id: payload.depends_on_field_id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        mockData.customFields.push(newCustomField);
        res.json(createResponse(true, newCustomField));
        break;

      case 'updateCustomField':
        if (!payload.field_id) {
          return res.json(createResponse(false, null, 'Field ID is required'));
        }

        const fieldIndex = mockData.customFields.findIndex(cf => cf.id === payload.field_id);
        if (fieldIndex === -1) {
          return res.json(createResponse(false, null, 'Custom field not found'));
        }

        mockData.customFields[fieldIndex] = {
          ...mockData.customFields[fieldIndex],
          ...payload,
          updated_at: new Date().toISOString()
        };

        res.json(createResponse(true, mockData.customFields[fieldIndex]));
        break;

      case 'deleteCustomField':
        if (!payload.field_id) {
          return res.json(createResponse(false, null, 'Field ID is required'));
        }

        const fieldToDelete = mockData.customFields.findIndex(cf => cf.id === payload.field_id);
        if (fieldToDelete === -1) {
          return res.json(createResponse(false, null, 'Custom field not found'));
        }

        mockData.customFields.splice(fieldToDelete, 1);
        res.json(createResponse(true, { deleted: true }));
        break;

      default:
        res.json(createResponse(false, null, `Unknown action: ${action}`));
    }
  } catch (error) {
    console.error('POST Error:', error);
    res.json(createResponse(false, null, error.message));
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mockData: {
      companies: mockData.companies.length,
      roles: mockData.roles.length,
      dropdownLists: mockData.dropdownLists.length,
      ticketTypes: mockData.ticketTypes.length
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Local Google Apps Script Mock Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/exec`);
  console.log(`\n📋 Mock data loaded:`);
  console.log(`   - ${mockData.companies.length} companies`);
  console.log(`   - ${mockData.roles.length} roles`);
  console.log(`   - ${mockData.dropdownLists.length} dropdown lists`);
  console.log(`   - ${mockData.ticketTypes.length} ticket types`);
  console.log(`\n🧪 Test endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/exec?action=ping`);
  console.log(`   POST http://localhost:${PORT}/exec {"action":"getCompanies"}`);
  console.log(`\n💡 Update your React app's apiConfig.js baseURL to:`);
  console.log(`     http://localhost:${PORT}/exec`);
});

module.exports = app;