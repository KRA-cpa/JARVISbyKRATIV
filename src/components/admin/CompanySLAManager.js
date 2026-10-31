import React, { useState } from 'react';
import { useCompanies, useTicketTypes } from '../../hooks/useAPI';
import { API } from '../../api/googleSheet';
import { useToast } from '../shared/Toast';
import Icons from '../shared/Icons';

/**
 * CompanySLAManager Component
 *
 * Manages company-specific SLA rules and escalations:
 * - Configure SLA rules per company and ticket type
 * - Set escalation policies and notification chains
 * - Override global SLA settings with company-specific rules
 * - Manage business hours and holiday calendars per company
 */
const CompanySLAManager = () => {
  const { data: companies, loading: companiesLoading } = useCompanies();
  const { data: ticketTypes, loading: ticketTypesLoading } = useTicketTypes();
  const { ToastContainer, success, error: showError } = useToast();

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState('');
  const [slaRules, setSlaRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sla-rules');

  const [formData, setFormData] = useState({
    stepName: '',
    duration: '',
    unit: 'hours', // hours, days, business_hours, business_days
    excludeWeekends: false,
    excludeHolidays: false,
    escalationEnabled: false,
    escalationDelay: '',
    escalationUnit: 'hours',
    escalationRecipients: '',
    warningThreshold: 75, // percentage of SLA before warning
    businessHoursStart: '09:00',
    businessHoursEnd: '17:00',
    businessDays: [1, 2, 3, 4, 5], // Monday to Friday
    timezone: 'Asia/Manila'
  });

  const slaUnits = [
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Calendar Days' },
    { value: 'business_hours', label: 'Business Hours' },
    { value: 'business_days', label: 'Business Days' }
  ];

  const timezones = [
    { value: 'Asia/Manila', label: 'Asia/Manila (UTC+8)' },
    { value: 'UTC', label: 'UTC (UTC+0)' },
    { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
    { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' }
  ];

  const weekDays = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 0, label: 'Sunday' }
  ];

  const loadSLARules = async () => {
    if (!selectedCompanyId || !selectedTicketTypeId) return;

    setIsLoading(true);
    try {
      const rules = await API.SLA.getCompanyRules(selectedCompanyId, selectedTicketTypeId);
      setSlaRules(rules || []);
    } catch (error) {
      console.error('Failed to load SLA rules:', error);
      showError(error.message || 'Failed to load SLA rules');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSLARule = async () => {
    if (!selectedCompanyId || !selectedTicketTypeId) {
      showError('Please select a company and ticket type');
      return;
    }

    if (!formData.stepName || !formData.duration) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const ruleData = {
        company_id: selectedCompanyId,
        ticket_type_id: selectedTicketTypeId,
        step_name: formData.stepName,
        duration: parseInt(formData.duration),
        unit: formData.unit,
        exclude_weekends: formData.excludeWeekends,
        exclude_holidays: formData.excludeHolidays,
        escalation_enabled: formData.escalationEnabled,
        escalation_delay: formData.escalationEnabled ? parseInt(formData.escalationDelay) : null,
        escalation_unit: formData.escalationUnit,
        escalation_recipients: formData.escalationRecipients.split(',').map(email => email.trim()).filter(Boolean),
        warning_threshold: formData.warningThreshold,
        business_hours_start: formData.businessHoursStart,
        business_hours_end: formData.businessHoursEnd,
        business_days: formData.businessDays,
        timezone: formData.timezone
      };

      await API.SLA.createCompanyRule(ruleData);
      success('SLA rule saved successfully');
      loadSLARules();
      resetForm();
    } catch (error) {
      console.error('Failed to save SLA rule:', error);
      showError(error.message || 'Failed to save SLA rule');
    }
  };

  const handleDeleteSLARule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this SLA rule?')) return;

    try {
      await API.SLA.deleteCompanyRule(ruleId);
      success('SLA rule deleted successfully');
      loadSLARules();
    } catch (error) {
      console.error('Failed to delete SLA rule:', error);
      showError(error.message || 'Failed to delete SLA rule');
    }
  };

  const resetForm = () => {
    setFormData({
      stepName: '',
      duration: '',
      unit: 'hours',
      excludeWeekends: false,
      excludeHolidays: false,
      escalationEnabled: false,
      escalationDelay: '',
      escalationUnit: 'hours',
      escalationRecipients: '',
      warningThreshold: 75,
      businessHoursStart: '09:00',
      businessHoursEnd: '17:00',
      businessDays: [1, 2, 3, 4, 5],
      timezone: 'Asia/Manila'
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleBusinessDayToggle = (dayValue) => {
    setFormData(prev => ({
      ...prev,
      businessDays: prev.businessDays.includes(dayValue)
        ? prev.businessDays.filter(d => d !== dayValue)
        : [...prev.businessDays, dayValue].sort()
    }));
  };

  const calculateSLADuration = (rule) => {
    const { duration, unit, exclude_weekends, business_hours_start, business_hours_end } = rule;

    switch (unit) {
      case 'business_hours':
        const hoursPerDay = calculateBusinessHoursPerDay(business_hours_start, business_hours_end);
        const days = Math.ceil(duration / hoursPerDay);
        return `${duration} business hours (~${days} days)`;
      case 'business_days':
        return `${duration} business days`;
      case 'days':
        return exclude_weekends ? `${duration} weekdays` : `${duration} calendar days`;
      case 'hours':
        return `${duration} hours`;
      default:
        return `${duration} ${unit}`;
    }
  };

  const calculateBusinessHoursPerDay = (start, end) => {
    const startTime = new Date(`2000-01-01T${start}:00`);
    const endTime = new Date(`2000-01-01T${end}:00`);
    return (endTime - startTime) / (1000 * 60 * 60);
  };

  React.useEffect(() => {
    if (selectedCompanyId && selectedTicketTypeId) {
      loadSLARules();
    }
    // loadSLARules is rebuilt each render; the selection is what should reload the rules
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, selectedTicketTypeId]);

  if (companiesLoading || ticketTypesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading SLA manager...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company-Specific SLA Manager</h2>
          <p className="text-gray-600 mt-1">
            Configure SLA rules and escalations for specific companies and ticket types
          </p>
          <p className="text-xs text-gray-500 mt-1">
            These are the company's SLA targets, escalation contacts and business hours (saved with AppScript v9.3).
            A ticket's due date still comes from the SLA set on each workflow step (Admin - Workflows).
          </p>
        </div>
      </div>

      {/* Company and Ticket Type Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Context</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company *
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a company</option>
              {companies?.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ticket Type *
            </label>
            <select
              value={selectedTicketTypeId}
              onChange={(e) => setSelectedTicketTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a ticket type</option>
              {ticketTypes?.map((ticketType) => (
                <option key={ticketType.id} value={ticketType.id}>
                  {ticketType.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedCompanyId && selectedTicketTypeId && (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'sla-rules', label: 'SLA Rules', icon: Icons.Clock },
                { id: 'business-hours', label: 'Business Hours', icon: Icons.Calendar },
                { id: 'escalations', label: 'Escalations', icon: Icons.AlertTriangle }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* SLA Rules Tab */}
          {activeTab === 'sla-rules' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create New SLA Rule */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create SLA Rule</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Step Name *
                    </label>
                    <input
                      type="text"
                      name="stepName"
                      value={formData.stepName}
                      onChange={handleInputChange}
                      placeholder="e.g., Manager Approval, Finance Review"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration *
                      </label>
                      <input
                        type="number"
                        name="duration"
                        value={formData.duration}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit
                      </label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {slaUnits.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="excludeWeekends"
                        checked={formData.excludeWeekends}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Exclude weekends
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="excludeHolidays"
                        checked={formData.excludeHolidays}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Exclude company holidays
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Warning Threshold (%)
                    </label>
                    <input
                      type="range"
                      name="warningThreshold"
                      value={formData.warningThreshold}
                      onChange={handleInputChange}
                      min="10"
                      max="95"
                      step="5"
                      className="w-full"
                    />
                    <div className="text-sm text-gray-600 text-center">
                      {formData.warningThreshold}% - Warning sent when SLA reaches this threshold
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSLARule}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Icons.Plus size={16} className="inline mr-2" />
                    Add SLA Rule
                  </button>
                </div>
              </div>

              {/* Existing SLA Rules */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Current SLA Rules</h3>
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : slaRules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Icons.Clock size={48} className="mx-auto mb-2 text-gray-400" />
                    <p>No SLA rules configured yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {slaRules.map((rule) => (
                      <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{rule.step_name}</h4>
                          <button
                            onClick={() => handleDeleteSLARule(rule.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Icons.Delete size={16} />
                          </button>
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>Duration: {calculateSLADuration(rule)}</div>
                          <div>Warning: {rule.warning_threshold}%</div>
                          {rule.escalation_enabled && (
                            <div>Escalation: {rule.escalation_delay} {rule.escalation_unit}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Business Hours Tab */}
          {activeTab === 'business-hours' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Business Hours Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Days
                  </label>
                  <div className="space-y-2">
                    {weekDays.map((day) => (
                      <div key={day.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.businessDays.includes(day.value)}
                          onChange={() => handleBusinessDayToggle(day.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          {day.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Hours Start
                    </label>
                    <input
                      type="time"
                      name="businessHoursStart"
                      value={formData.businessHoursStart}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Hours End
                    </label>
                    <input
                      type="time"
                      name="businessHoursEnd"
                      value={formData.businessHoursEnd}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timezone
                    </label>
                    <select
                      name="timezone"
                      value={formData.timezone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {timezones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-blue-700">
                      <strong>Business Hours Summary:</strong><br />
                      {formData.businessDays.map(d => weekDays.find(wd => wd.value === d)?.label).join(', ')}<br />
                      {formData.businessHoursStart} - {formData.businessHoursEnd}<br />
                      {calculateBusinessHoursPerDay(formData.businessHoursStart, formData.businessHoursEnd)} hours per day
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Escalations Tab */}
          {activeTab === 'escalations' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Escalation Configuration</h3>
              {/* AppScript v9.5: escalation has its own rules (several levels per step, roles, in-app + email). The
                  escalation fields of this form are kept on the rule for rules made before v9.5; the editor function
                  migrateCompanyEscalationsToRules() turns them into escalation levels. */}
              <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800 space-y-2">
                <p>
                  Escalation is set up in <strong>Admin → SLA Escalations</strong>: several timed levels per step (a % of the
                  SLA, before or after the due date), notices to approvers, the requester, roles or email addresses, and
                  escalation to a role that may then act on the step.
                </p>
                <p>
                  This SLA rule still sets the due date (it wins over the step's own SLA) and its business hours, business
                  days and holidays count for escalation times too.
                </p>
                {formData.escalationEnabled && (
                  <p className="text-blue-700">
                    This rule has a pre-v9.5 escalation ({formData.escalationDelay} {formData.escalationUnit}); an admin can
                    convert it with migrateCompanyEscalationsToRules() in the Apps Script editor.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CompanySLAManager;