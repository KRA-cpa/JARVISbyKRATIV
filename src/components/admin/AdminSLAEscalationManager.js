import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import {
  useCompanies, useTicketTypes, useRoles, useWorkflowSteps, useSLAEscalationRules, useSLAEscalationMutations,
  useCompanyHolidays, useSLANotificationSettings
} from '../../hooks/useAPI';
import { API } from '../../api/googleSheet';
import { useToast } from '../shared/Toast';
import { useConfirmation } from '../shared/ConfirmationModal';
import Icons from '../shared/Icons';
import {
  ESCALATION_TRIGGERS, ESCALATION_ACTIONS, ESCALATION_UNITS, TRIGGER_LABELS, ACTION_LABELS, UNIT_LABELS, SLA_EMAIL_MODES,
  emptyEscalationRule, validateEscalationRule, describeRule
} from '../../utils/slaEscalation';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const listText = list => (list || []).join(', ');
const splitList = text => String(text || '').split(',').map(s => s.trim()).filter(Boolean);

/**
 * AdminSLAEscalationManager - Admin -> SLA Escalations (AppScript v9.5, Phase 5.2)
 *
 * Rules: escalation levels per company + ticket type + step ("all steps" rows apply where a step has no rule of
 * that level). Each level fires once per visit of a step: at a % of the SLA, before the due date or after it, and
 * notifies the current approvers / requester / roles / emails - or escalates to roles, whose holders may then act
 * on the step. The server runs them every 15 minutes; Preview shows what would fire now.
 * Holidays: count against business hours / days when a company SLA rule excludes holidays.
 * Email: in-app notices always; email per ticket type (or the global default) and the user's preference.
 */
const AdminSLAEscalationManager = () => {
  const { user } = useUser();
  const userId = user?.uid || user?.id;
  const { ToastContainer, success, error: showError } = useToast();
  const { confirm, ConfirmationModal } = useConfirmation();
  const { data: companies } = useCompanies();
  const { data: ticketTypes } = useTicketTypes();
  const { data: roles } = useRoles();

  const [panel, setPanel] = useState('rules');
  const [companyId, setCompanyId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const { data: steps } = useWorkflowSteps(ticketTypeId || null, companyId || null);
  const { data: rules, loading: rulesLoading, refetch: refetchRules } = useSLAEscalationRules(companyId || null, ticketTypeId || null);
  const mutations = useSLAEscalationMutations(userId);

  const [form, setForm] = useState(null);       // rule being edited ({ id? , ...values })
  const [formErrors, setFormErrors] = useState([]);
  const [preview, setPreview] = useState(null);

  const roleName = id => (roles || []).find(r => String(r.id) === String(id))?.name || id;
  const stepName = id => (id ? ((steps || []).find(s => String(s.id) === String(id))?.name || id) : 'All steps');
  const companyRoles = (roles || []).filter(r => !r.company_id || String(r.company_id) === String(companyId));

  const openForm = rule => {
    setFormErrors([]);
    if (rule) {
      setForm({ ...rule, notify_emails_text: listText(rule.notify_emails) });
    } else {
      const used = (rules || []).filter(r => !r.step_id).map(r => r.level);
      const level = used.length ? Math.max(...used) + 1 : 1;
      setForm({ ...emptyEscalationRule(level), notify_emails_text: '' });
    }
  };

  const saveForm = async () => {
    const values = {
      level: Number(form.level),
      name: form.name,
      step_id: form.step_id || '',
      trigger: form.trigger,
      trigger_value: Number(form.trigger_value),
      trigger_unit: form.trigger_unit,
      escalation_action: form.escalation_action,
      notify_current_approvers: !!form.notify_current_approvers,
      notify_requester: !!form.notify_requester,
      notify_role_ids: form.notify_role_ids || [],
      notify_emails: splitList(form.notify_emails_text),
      message: form.message || ''
    };
    const check = validateEscalationRule(values);
    if (!check.isValid) {
      setFormErrors(check.errors);
      return;
    }
    try {
      if (form.id) {
        await mutations.updateEscalationRule(form.id, values);
        success('Escalation rule saved');
      } else {
        await mutations.createEscalationRule({ ...values, company_id: companyId, ticket_type_id: ticketTypeId });
        success('Escalation rule created');
      }
      setForm(null);
      refetchRules();
    } catch (err) {
      setFormErrors([err.message]);
    }
  };

  const removeRule = async rule => {
    const ok = await confirm({
      title: 'Remove escalation rule',
      message: `Remove level ${rule.level} (${stepName(rule.step_id)})? Tickets already notified keep their notices.`,
      type: 'error',
      confirmText: 'Remove',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    try {
      await mutations.deleteEscalationRule(rule.id);
      success('Escalation rule removed');
      refetchRules();
    } catch (err) {
      showError(err.message);
    }
  };

  const runPreview = async () => {
    try {
      setPreview(await mutations.testEscalations());
    } catch (err) {
      showError(err.message);
    }
  };

  const runNow = async () => {
    const ok = await confirm({
      title: 'Run escalations now',
      message: 'Send the notices that are due now (the same as the 15-minute run)?',
      type: 'warning',
      confirmText: 'Run now',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    try {
      const result = await mutations.runEscalationsNow(false);
      setPreview(result);
      success(result?.skipped ? 'Another run is busy - try again shortly' : `${(result?.fired || []).length} ticket(s) escalated`);
    } catch (err) {
      showError(err.message);
    }
  };

  const toggleRole = id => {
    const current = form.notify_role_ids || [];
    setForm({ ...form, notify_role_ids: current.includes(id) ? current.filter(r => r !== id) : [...current, id] });
  };

  return (
    <>
      <ToastContainer />
      <ConfirmationModal />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">SLA Escalations</h2>
            <p className="text-gray-600">Timed notices and escalation levels per company, ticket type and step. The server checks every 15 minutes.</p>
          </div>
          <div className="flex space-x-2">
            {['rules', 'holidays', 'email'].map(id => (
              <button
                key={id}
                onClick={() => setPanel(id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${panel === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {id === 'rules' ? 'Rules' : id === 'holidays' ? 'Holidays' : 'Email'}
              </button>
            ))}
          </div>
        </div>

        {panel === 'rules' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <select value={companyId} onChange={e => { setCompanyId(e.target.value); setForm(null); }} className={inputClass}>
                    <option value="">Select a company...</option>
                    {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ticket Type</label>
                  <select value={ticketTypeId} onChange={e => { setTicketTypeId(e.target.value); setForm(null); }} className={inputClass}>
                    <option value="">Select a ticket type...</option>
                    {(ticketTypes || []).map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                  </select>
                </div>
                <div className="flex items-end space-x-2">
                  <button
                    onClick={() => openForm(null)}
                    disabled={!companyId || !ticketTypeId}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Icons.Create size={16} />
                    <span>Add Level</span>
                  </button>
                  <button
                    onClick={runPreview}
                    disabled={mutations.loading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    title="What would fire now (nothing is sent)"
                  >
                    Preview
                  </button>
                  <button
                    onClick={runNow}
                    disabled={mutations.loading}
                    className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50"
                  >
                    Run now
                  </button>
                </div>
              </div>
            </div>

            {form && (
              <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6 space-y-4">
                <h3 className="text-lg font-medium text-gray-900">{form.id ? `Edit level ${form.level}` : 'New level'}</h3>
                {formErrors.length > 0 && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formErrors.map(e => <div key={e}>{e}</div>)}</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                    <input type="number" min="1" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Step</label>
                    <select value={form.step_id || ''} onChange={e => setForm({ ...form, step_id: e.target.value })} className={inputClass}>
                      <option value="">All steps</option>
                      {(steps || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={`Level ${form.level}`} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">When</label>
                    <select value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} className={inputClass}>
                      {Object.values(ESCALATION_TRIGGERS).map(t => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{form.trigger === ESCALATION_TRIGGERS.PERCENT_ELAPSED ? 'Percent' : 'Value'}</label>
                    <input type="number" min="1" value={form.trigger_value} onChange={e => setForm({ ...form, trigger_value: e.target.value })} className={inputClass} />
                  </div>
                  {form.trigger !== ESCALATION_TRIGGERS.PERCENT_ELAPSED && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <select value={form.trigger_unit} onChange={e => setForm({ ...form, trigger_unit: e.target.value })} className={inputClass}>
                        {ESCALATION_UNITS.filter(u => form.trigger !== ESCALATION_TRIGGERS.BEFORE_DUE || !u.startsWith('business'))
                          .map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                    <select value={form.escalation_action} onChange={e => setForm({ ...form, escalation_action: e.target.value })} className={inputClass}>
                      {Object.values(ESCALATION_ACTIONS).map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">Recipients</span>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" checked={!!form.notify_current_approvers} onChange={e => setForm({ ...form, notify_current_approvers: e.target.checked })} />
                      <span>Current approvers</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" checked={!!form.notify_requester} onChange={e => setForm({ ...form, notify_requester: e.target.checked })} />
                      <span>Requester</span>
                    </label>
                  </div>
                  <div className="mt-3">
                    <span className="block text-xs text-gray-500 mb-1">
                      Roles {form.escalation_action === ESCALATION_ACTIONS.ESCALATE_ROLE ? '(their holders may act on the step after this level fires)' : ''}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {companyRoles.map(r => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => toggleRole(String(r.id))}
                          className={`px-2 py-1 rounded-full text-xs border ${(form.notify_role_ids || []).includes(String(r.id))
                            ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600'}`}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-1">Other emails (comma-separated, sent only when email is on)</label>
                    <input value={form.notify_emails_text || ''} onChange={e => setForm({ ...form, notify_emails_text: e.target.value })} className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
                  <input value={form.message || ''} onChange={e => setForm({ ...form, message: e.target.value })} className={inputClass} />
                </div>

                <div className="flex justify-end space-x-2">
                  <button onClick={() => setForm(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
                  <button onClick={saveForm} disabled={mutations.loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2">
                    <Icons.Save size={16} />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            )}

            {companyId && ticketTypeId && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Levels ({(rules || []).length})</h3>
                </div>
                {rulesLoading ? (
                  <div className="p-6 text-center text-gray-500">Loading escalation rules...</div>
                ) : (rules || []).length ? (
                  <div className="divide-y divide-gray-200">
                    {rules.map(rule => (
                      <div key={rule.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Level {rule.level}</span>
                            <span className="text-sm font-medium text-gray-900">{rule.name}</span>
                            <span className="text-xs text-gray-500">{stepName(rule.step_id)}</span>
                            {rule.escalation_action === ESCALATION_ACTIONS.ESCALATE_ROLE && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">escalates</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{describeRule(rule, roleName)}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => openForm(rule)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title="Edit"><Icons.Edit size={16} /></button>
                          <button onClick={() => removeRule(rule)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Remove"><Icons.Delete size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500">No escalation levels for this company and ticket type yet.</div>
                )}
              </div>
            )}

            {preview && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {preview.dry_run ? 'Preview - would fire now' : 'Run result'}
                </h3>
                {preview.skipped ? (
                  <p className="text-sm text-gray-600">Skipped: another run or a write held the lock.</p>
                ) : (preview.fired || []).length ? (
                  <ul className="text-sm text-gray-700 space-y-1">
                    {preview.fired.map(f => (
                      <li key={`${f.ticket_id}-${f.levels.join('-')}`}>
                        {f.ticket_number || f.ticket_id}: level {f.levels.join(', ')} ({f.type.replace('sla_', '')}) to {f.recipients.length} user(s)
                        {f.granted_role_ids.length ? ` - escalated to ${f.granted_role_ids.map(roleName).join(', ')}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">Nothing is due ({preview.checked || 0} ticket(s) checked).</p>
                )}
                {preview.capped && <p className="text-xs text-gray-500 mt-2">More than 200 notices were due; the rest go out on the next run.</p>}
              </div>
            )}
          </>
        )}

        {panel === 'holidays' && <HolidaysPanel userId={userId} companies={companies} onError={showError} onSuccess={success} />}
        {panel === 'email' && <EmailPanel userId={userId} onError={showError} onSuccess={success} />}
      </div>
    </>
  );
};

/** Holidays: count against business time when a company SLA rule excludes holidays (AppScript v9.5). */
const HolidaysPanel = ({ userId, companies, onError, onSuccess }) => {
  const [companyId, setCompanyId] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { data: holidays, refetch } = useCompanyHolidays(companyId || null, year);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [phPreview, setPhPreview] = useState(null);
  const companyName = id => (id ? ((companies || []).find(c => String(c.id) === String(id))?.name || id) : 'All companies');

  const add = async () => {
    try {
      await API.SLA.createHoliday(userId, { ...newHoliday, company_id: companyId });
      setNewHoliday({ date: '', name: '' });
      onSuccess('Holiday added');
      refetch();
    } catch (err) {
      onError(err.message);
    }
  };

  const remove = async id => {
    try {
      await API.SLA.deleteHoliday(userId, id);
      refetch();
    } catch (err) {
      onError(err.message);
    }
  };

  const addPhilippine = async dryRun => {
    try {
      const result = await API.SLA.addPhilippineHolidays(userId, Number(year), companyId, dryRun);
      setPhPreview(dryRun ? result : null);
      if (!dryRun) {
        onSuccess(`${result.added} holiday(s) added`);
        refetch();
      }
    } catch (err) {
      onError(err.message);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} className={inputClass}>
            <option value="">All companies</option>
            {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <input type="number" value={year} onChange={e => setYear(e.target.value)} className={inputClass} />
        </div>
        <div className="flex items-end">
          <button onClick={() => addPhilippine(true)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Philippine holidays for {year}...
          </button>
        </div>
      </div>

      {phPreview && (
        <div className="p-4 bg-blue-50 rounded-lg text-sm">
          <p className="text-blue-800 mb-2">
            {phPreview.holidays.filter(h => !h.exists).length} to add for {companyName(phPreview.company_id)} (Eid holidays and Chinese New Year are proclaimed each year - add them by hand):
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-blue-900">
            {phPreview.holidays.map(h => <li key={h.date} className={h.exists ? 'opacity-50' : ''}>{h.date} - {h.name}{h.exists ? ' (already there)' : ''}</li>)}
          </ul>
          <div className="mt-3 flex space-x-2">
            <button onClick={() => addPhilippine(false)} className="px-3 py-1 bg-blue-600 text-white rounded-lg">Add them</button>
            <button onClick={() => setPhPreview(null)} className="px-3 py-1 bg-white text-gray-700 rounded-lg border">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-2">
        <input type="date" value={newHoliday.date} onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })} className={inputClass} />
        <input placeholder="Name" value={newHoliday.name} onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })} className={inputClass} />
        <button onClick={add} disabled={!newHoliday.date || !newHoliday.name} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">Add</button>
      </div>

      <div className="divide-y divide-gray-100">
        {(holidays || []).map(h => (
          <div key={h.id} className="py-2 flex items-center justify-between text-sm">
            <span>{h.date} - {h.name} <span className="text-gray-400">({companyName(h.company_id)})</span></span>
            <button onClick={() => remove(h.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Remove"><Icons.Delete size={14} /></button>
          </div>
        ))}
        {(holidays || []).length === 0 && <p className="text-sm text-gray-500 py-2">No holidays for {year}.</p>}
      </div>
    </div>
  );
};

/** Email for SLA notices: global default + per ticket type; the user's own preference still applies (v9.5). */
const EmailPanel = ({ userId, onError, onSuccess }) => {
  const { data: settings, refetch } = useSLANotificationSettings();

  const save = async changes => {
    try {
      await API.SLA.saveNotificationSettings(userId, changes);
      onSuccess('Email settings saved');
      refetch();
    } catch (err) {
      onError(err.message);
    }
  };

  if (!settings) return <div className="p-6 text-gray-500">Loading email settings...</div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <p className="text-sm text-gray-600">
        SLA notices always appear in the app (the bell). Email is sent as one digest per person per run when it is on for the
        ticket type and the person hasn't turned email off in their profile. Mail quota left today: {settings.quota_remaining}.
      </p>
      <label className="flex items-center space-x-2 text-sm">
        <input type="checkbox" checked={settings.email_default === 'on'} onChange={e => save({ email_default: e.target.checked ? 'on' : 'off' })} />
        <span>Email by default (ticket types set to "default")</span>
      </label>
      <div className="divide-y divide-gray-100">
        {settings.ticket_types.map(t => (
          <div key={t.ticket_type_id} className="py-2 flex items-center justify-between text-sm">
            <span>{t.name} <span className="text-gray-400">({t.email_on ? 'email on' : 'in-app only'})</span></span>
            <select value={t.sla_email} onChange={e => save({ ticket_types: { [t.ticket_type_id]: e.target.value } })} className="px-2 py-1 border border-gray-300 rounded-lg">
              {SLA_EMAIL_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSLAEscalationManager;
