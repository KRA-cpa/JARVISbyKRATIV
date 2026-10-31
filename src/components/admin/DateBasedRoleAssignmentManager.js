import React, { useMemo, useState } from 'react';
import Icons from '../shared/Icons';
import { useToast } from '../shared/Toast';
import { useUserRoleAssignments, useRoles, useCompanies, useTicketTypes } from '../../hooks/useAPI';
import { API } from '../../api/googleSheet';
import { formatDateOnly } from '../../utils/dateTime';

/**
 * DateBasedRoleAssignmentManager Component (Phase 2 Role Maintenance)
 *
 * Manages one user's role assignments, with dates:
 * - Lists the assignments in force today (role, company, ticket type, type, start/end)
 * - Warns when an assignment ends within EXPIRY_WARNING_DAYS
 * - Assigns a role for a company (optionally one ticket type) as permanent, temporary,
 *   project-based, emergency or delegation, with start/end dates
 * - Edits an assignment's end date and notes; removes a single assignment
 *
 * Backend: AppScript v9.0+ (assignUserRole, getUserRoles, updateUserRoleAssignment,
 * deleteUserRoleAssignment). An end date covers that whole day.
 *
 * @param {Object} props
 * @param {Object} props.user - { user_id | id, display_name | name, email }
 * @param {Function} props.onClose - Close the panel
 * @param {Function} props.onChanged - Called after any change (e.g. to refresh the user list)
 */

const ASSIGNMENT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'project_based', label: 'Project-based' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'delegation', label: 'Delegation' }
];

// Every type except permanent needs an end date
const TYPES_NEEDING_END_DATE = ['temporary', 'project_based', 'emergency', 'delegation'];
const EXPIRY_WARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Date-only strings are local dates; anything else is parsed as-is
const parseDate = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

// v10.1: a yyyy-MM-dd end date is that calendar day in every zone; a moment is shown in the display zone
const formatDate = (value) => (parseDate(value) ? formatDateOnly(value) : '—');

// For <input type="date">: the stored value as YYYY-MM-DD in local time
const toInputDate = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Whole days until the end date (the end date itself still counts as in force)
const daysLeft = (endValue) => {
  const end = parseDate(endValue);
  if (!end) return null;
  const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  return Math.ceil((endOfDay.getTime() - Date.now()) / DAY_MS) - 1;
};

// A global role (blank company) fits any company; a company's own role only that company (review R-10)
const roleFitsCompany = (role, companyId) => !role.company_id || !companyId || String(role.company_id) === String(companyId);

const emptyForm = () => ({
  roleId: '',
  companyId: '',
  ticketTypeId: '',
  assignmentType: 'permanent',
  startDate: todayString(),
  endDate: '',
  notes: ''
});

const DateBasedRoleAssignmentManager = ({ user, onClose, onChanged }) => {
  const userId = user?.user_id || user?.id;
  const userName = user?.display_name || user?.name || user?.email || userId;

  const { success, error: showError, ToastContainer } = useToast();
  const { data: assignments, loading, error, refetch } = useUserRoleAssignments(userId);
  const { data: roles } = useRoles();
  const { data: companies } = useCompanies();
  const { data: ticketTypes } = useTicketTypes();

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ endDate: '', notes: '' });
  const [busyId, setBusyId] = useState(null);

  const nameOf = useMemo(() => {
    const index = (list) => Object.fromEntries((list || []).map(item => [String(item.id), item.name]));
    return { company: index(companies), ticketType: index(ticketTypes) };
  }, [companies, ticketTypes]);

  const needsEndDate = TYPES_NEEDING_END_DATE.includes(form.assignmentType);
  const formError = (() => {
    if (!form.roleId || !form.companyId) return 'Choose a role and a company';
    const role = (roles || []).find(r => String(r.id) === String(form.roleId));
    if (role && !roleFitsCompany(role, form.companyId)) return `"${role.name}" belongs to another company`;
    if (needsEndDate && !form.endDate) return 'This assignment type needs an end date';
    if (form.endDate && form.startDate && form.endDate < form.startDate) return 'The end date is before the start date';
    return null;
  })();

  const refresh = async () => {
    await refetch();
    onChanged?.();
  };

  const updateForm = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleAssign = async (e) => {
    e.preventDefault();
    if (formError) {
      showError(formError);
      return;
    }

    setSaving(true);
    try {
      await API.Users.assignRole(userId, form.roleId, form.companyId, {
        ticket_type_id: form.ticketTypeId || '',
        assignment_type: form.assignmentType,
        effective_start_date: form.startDate || todayString(),
        effective_end_date: form.endDate || '',
        assignment_notes: form.notes.trim()
      });
      success('Role assigned');
      setForm(emptyForm());
      await refresh();
    } catch (err) {
      showError(err.message || 'Failed to assign role');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (assignment) => {
    setEditingId(assignment.id);
    setEditValues({ endDate: toInputDate(assignment.effective_end_date), notes: assignment.assignment_notes || '' });
  };

  const handleSaveEdit = async (assignment) => {
    if (TYPES_NEEDING_END_DATE.includes(assignment.assignment_type) && !editValues.endDate) {
      showError('This assignment type needs an end date');
      return;
    }

    setBusyId(assignment.id);
    try {
      await API.Users.updateRoleAssignment(assignment.id, {
        effective_end_date: editValues.endDate || '',
        assignment_notes: editValues.notes.trim()
      });
      success('Assignment updated');
      setEditingId(null);
      await refresh();
    } catch (err) {
      showError(err.message || 'Failed to update assignment');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (assignment) => {
    setBusyId(assignment.id);
    try {
      await API.Users.deleteRoleAssignment(assignment.id);
      success(`Removed ${assignment.role_name}`);
      await refresh();
    } catch (err) {
      showError(err.message || 'Failed to remove assignment');
    } finally {
      setBusyId(null);
    }
  };

  const inputClass = 'mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <ToastContainer />
      <div className="relative top-10 mx-auto mb-10 p-6 border w-full max-w-3xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Roles for {userName}</h3>
            <p className="text-sm text-gray-500">Assignments in force today. An end date includes that whole day.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <Icons.Close size={20} />
          </button>
        </div>

        {/* Current assignments */}
        {loading ? (
          <div className="flex items-center py-6 text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
            Loading assignments...
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{error}</div>
        ) : !assignments || assignments.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">No roles in force for this user.</div>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md mb-6">
            {assignments.map((assignment) => {
              const left = daysLeft(assignment.effective_end_date || assignment.validity_end_date);
              const endingSoon = left !== null && left <= EXPIRY_WARNING_DAYS;
              const isEditing = editingId === assignment.id;

              return (
                <li key={assignment.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-medium text-gray-900">{assignment.role_name}</span>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                          {(ASSIGNMENT_TYPES.find(t => t.value === assignment.assignment_type) || {}).label || 'Permanent'}
                        </span>
                        {endingSoon && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                            <Icons.Clock size={12} className="mr-1" />
                            {left <= 0 ? 'Ends today' : `Ends in ${left} day${left === 1 ? '' : 's'}`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {nameOf.company[String(assignment.company_id)] || assignment.company_id}
                        {' • '}
                        {assignment.ticket_type_id ? (nameOf.ticketType[String(assignment.ticket_type_id)] || assignment.ticket_type_id) : 'All ticket types'}
                        {' • '}
                        {formatDate(assignment.effective_start_date)} → {assignment.effective_end_date || assignment.validity_end_date
                          ? formatDate(assignment.effective_end_date || assignment.validity_end_date) : 'no end date'}
                      </p>
                      {assignment.assignment_notes && !isEditing && (
                        <p className="text-xs text-gray-600 mt-1">{assignment.assignment_notes}</p>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => startEdit(assignment)}
                          disabled={busyId === assignment.id}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md text-xs text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Icons.Edit size={12} className="mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemove(assignment)}
                          disabled={busyId === assignment.id}
                          className="inline-flex items-center px-2 py-1 border border-red-300 rounded-md text-xs text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Icons.Delete size={12} className="mr-1" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">End date</label>
                        <input
                          type="date"
                          value={editValues.endDate}
                          onChange={(e) => setEditValues(prev => ({ ...prev, endDate: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Notes</label>
                        <input
                          type="text"
                          value={editValues.notes}
                          onChange={(e) => setEditValues(prev => ({ ...prev, notes: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSaveEdit(assignment)}
                          disabled={busyId === assignment.id}
                          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Assign form */}
        <form onSubmit={handleAssign} className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Assign a role</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Role *</label>
              <select value={form.roleId} onChange={updateForm('roleId')} className={inputClass}>
                <option value="">Select a role...</option>
                {/* Global roles, and roles of the chosen company (AppScript v9.1 refuses others - review R-10) */}
                {(roles || []).filter(role => roleFitsCompany(role, form.companyId)).map(role => (
                  <option key={role.id} value={role.id}>{role.name}{role.company_id ? '' : ' (global)'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Company *</label>
              <select value={form.companyId} onChange={updateForm('companyId')} className={inputClass}>
                <option value="">Select a company...</option>
                {(companies || []).map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ticket type</label>
              <select value={form.ticketTypeId} onChange={updateForm('ticketTypeId')} className={inputClass}>
                <option value="">All ticket types</option>
                {(ticketTypes || []).map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Assignment type</label>
              <select value={form.assignmentType} onChange={updateForm('assignmentType')} className={inputClass}>
                {ASSIGNMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Start date</label>
              <input type="date" value={form.startDate} onChange={updateForm('startDate')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End date{needsEndDate ? ' *' : ''}</label>
              <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={updateForm('endDate')} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={updateForm('notes')}
                placeholder="Reason, ticket or approval reference"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-500">{formError || 'Ready to assign'}</p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving || Boolean(formError)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
                <Icons.Plus size={14} className="mr-1" />
                Assign role
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DateBasedRoleAssignmentManager;
