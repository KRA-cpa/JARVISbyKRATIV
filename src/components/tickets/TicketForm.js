import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useCompanies, useTicketTypeChoices, useCustomFields, useDropdownOptions } from '../../hooks/useAPI';
import { useToast } from '../shared/Toast';
import { previewTicketNumber } from '../../utils/ticketNumber';
import { ticketAPI } from '../../api/googleSheet';
import DateRangeInput from '../shared/DateRangeInput';
import Icons from '../shared/Icons';

/** Cell / form value -> boolean (sheet booleans can arrive as 'TRUE'). */
const isTrue = value => value === true || String(value).toUpperCase() === 'TRUE';

/**
 * A dropdown custom field: loads its list's options (DropdownAPI.getOptions). The value is the option id -
 * AppScript setCustomFieldValue stores an opt_* id in dropdown_option_id.
 */
const DropdownFieldInput = ({ listId, value, onChange, className, disabled, label }) => {
  const { data: options, loading } = useDropdownOptions(listId);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className} disabled={disabled || loading}>
      <option value="">{loading ? 'Loading options...' : `Select ${label}`}</option>
      {(options || []).filter(option => isTrue(option.is_active ?? true)).map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

/**
 * Turn the form's custom field values into the createTicket customData map (field id -> value):
 * amount -> number, daterange -> { start_date, end_date }, others as entered; blanks are left out.
 */
const toCustomData = (fields, values) => {
  const data = {};
  fields.forEach(field => {
    const value = values[field.id];
    if (value === undefined || value === null || value === '') return;
    if (field.type === 'amount') {
      data[field.id] = Number(value);
    } else if (field.type === 'daterange') {
      if (value.startDate && value.endDate) data[field.id] = { start_date: value.startDate, end_date: value.endDate };
    } else if (field.type !== 'file') {
      data[field.id] = value;
    }
  });
  return data;
};

/**
 * TicketForm - create a ticket (or edit title / description / priority of an existing one).
 *
 * Create: AppScript createTicket numbers the ticket, saves its custom field values and starts its
 * workflow at the company's first step (there is no client-side workflow setup any more).
 * Props: ticket (edit mode), onSave(result), onCancel.
 */
const TicketForm = ({ ticket = null, onSave, onCancel }) => {
  const { user } = useUser();
  const currentUserId = user?.uid || user?.id;
  const isEditing = !!ticket;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    company_id: '',
    ticket_type_id: '',
    priority: 'medium',
    custom_fields: {}
  });

  const { data: allCompanies } = useCompanies();
  // AppScript v10.0 (decision 1): a new ticket can only be of a type the user has a role on in that company - the
  // server decides (getCreatableTicketTypes) and refuses the rest, so the form offers only those companies and types
  const { data: typeChoices, loading: typesLoading } = useTicketTypeChoices(isEditing, formData.company_id || null);
  const creatableIn = type => (Array.isArray(type.creatable_company_ids) ? type.creatable_company_ids.map(String) : []);
  const companies = isEditing
    ? allCompanies
    : (allCompanies || []).filter(c => (typeChoices || []).some(t => creatableIn(t).includes(String(c.id))));
  const ticketTypes = isEditing
    ? typeChoices
    : (typeChoices || []).filter(t => formData.company_id && creatableIn(t).includes(String(formData.company_id)));
  const nothingToCreate = !isEditing && !typesLoading && Array.isArray(typeChoices) && typeChoices.length === 0;
  const { data: customFieldList, loading: fieldsLoading } = useCustomFields(formData.ticket_type_id || null);
  const { ToastContainer, success, error: showError } = useToast();

  const customFields = formData.ticket_type_id
    ? (customFieldList || []).filter(field => !isTrue(field.is_hidden))
    : [];

  const [ticketNumberPreview, setTicketNumberPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form data
  useEffect(() => {
    if (ticket) {
      setFormData({
        title: ticket.title || '',
        description: ticket.description || '',
        company_id: ticket.company_id ? String(ticket.company_id) : '',
        ticket_type_id: ticket.ticket_type_id ? String(ticket.ticket_type_id) : '',
        priority: ticket.priority || 'medium',
        custom_fields: {}
      });
    }
  }, [ticket]);

  const selectedCompany = companies?.find(c => String(c.id) === String(formData.company_id)) || null;
  const selectedTicketType = ticketTypes?.find(t => String(t.id) === String(formData.ticket_type_id)) || null;

  // Ticket number preview (AppScript v9.1 getNextTicketNumber peeks without reserving a number)
  useEffect(() => {
    if (!selectedCompany || !selectedTicketType || isEditing) {
      setTicketNumberPreview('');
      return undefined;
    }
    let cancelled = false;
    setTicketNumberPreview(previewTicketNumber(selectedCompany, selectedTicketType));
    ticketAPI.getNextTicketNumber(selectedCompany.id, selectedTicketType.id)
      .then(nextNumber => { if (!cancelled) setTicketNumberPreview(nextNumber); })
      .catch(err => console.warn('Failed to get next ticket number:', err));
    return () => { cancelled = true; };
  }, [selectedCompany, selectedTicketType, isEditing]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.company_id) {
      newErrors.company_id = 'Company is required';
    }

    if (!formData.ticket_type_id) {
      newErrors.ticket_type_id = 'Ticket type is required';
    }

    // Required custom fields (file upload isn't available yet, so a file field can't be required)
    if (!isEditing) {
      customFields.forEach(field => {
        if (!isTrue(field.is_required) || field.type === 'file') return;
        const value = formData.custom_fields[field.id];
        const missing = field.type === 'daterange'
          ? !(value && value.startDate && value.endDate)
          : value === undefined || value === null || String(value).trim() === '';
        if (missing) newErrors[`custom_${field.id}`] = `${field.label} is required`;
        if (field.type === 'daterange' && value && value.isValid === false) newErrors[`custom_${field.id}`] = value.error;
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      let result;
      if (isEditing) {
        result = await ticketAPI.update(ticket.id, {
          title: formData.title.trim(),
          description: formData.description,
          priority: formData.priority,
          user_id: currentUserId
        });
        success('Ticket updated successfully!');
      } else {
        result = await ticketAPI.create({
          title: formData.title,
          description: formData.description,
          company_id: formData.company_id,
          ticket_type_id: formData.ticket_type_id,
          priority: formData.priority,
          requester_id: currentUserId,
          customData: toCustomData(customFields, formData.custom_fields)
        });
        const started = result?.workflow?.started;
        success(started
          ? `Ticket ${result.ticket_number} created and sent for approval`
          : `Ticket ${result?.ticket_number || ''} created - this company has no workflow for the ticket type yet, so it stays at "New"`);
        if (result?.customFieldErrors?.length) {
          showError(`Some custom field values were not saved: ${result.customFieldErrors.join('; ')}`);
        }
      }
      onSave?.(result);
    } catch (error) {
      console.error('Ticket operation failed:', error);
      showError(error.message || 'Failed to save ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // A different company has its own ticket types; a different type has its own fields
      ...(field === 'company_id' ? { ticket_type_id: '', custom_fields: {} } : {}),
      ...(field === 'ticket_type_id' ? { custom_fields: {} } : {})
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleCustomFieldChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [fieldId]: value
      }
    }));

    // Clear error when user starts typing
    const errorKey = `custom_${fieldId}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const renderCustomField = (field) => {
    const value = formData.custom_fields[field.id] ?? '';
    const errorKey = `custom_${field.id}`;
    const hasError = !!errors[errorKey];
    const required = isTrue(field.is_required) && field.type !== 'file';

    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      hasError ? 'border-red-300' : 'border-gray-300'
    }`;

    const renderLabel = () => (
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    );

    const renderError = () => hasError && (
      <p className="text-sm text-red-600 mt-1">{errors[errorKey]}</p>
    );

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id}>
            {renderLabel()}
            <input
              type="text"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              className={baseClasses}
              disabled={isSubmitting}
            />
            {renderError()}
          </div>
        );

      case 'paragraph':
        return (
          <div key={field.id} className="md:col-span-2">
            {renderLabel()}
            <textarea
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              rows={3}
              className={baseClasses}
              disabled={isSubmitting}
            />
            {renderError()}
          </div>
        );

      case 'dropdown':
        return (
          <div key={field.id}>
            {renderLabel()}
            <DropdownFieldInput
              listId={field.dropdown_list_id}
              value={value}
              onChange={(v) => handleCustomFieldChange(field.id, v)}
              className={baseClasses}
              disabled={isSubmitting}
              label={field.label}
            />
            {renderError()}
          </div>
        );

      case 'date':
        return (
          <div key={field.id}>
            {renderLabel()}
            <input
              type="date"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              className={baseClasses}
              disabled={isSubmitting}
            />
            {renderError()}
          </div>
        );

      case 'daterange':
        return (
          <div key={field.id} className="md:col-span-2">
            <DateRangeInput
              label={field.label}
              required={required}
              value={value || { startDate: '', endDate: '' }}
              onChange={(range) => handleCustomFieldChange(field.id, range)}
              disabled={isSubmitting}
              error={errors[errorKey] || ''}
            />
          </div>
        );

      case 'amount':
        return (
          <div key={field.id}>
            {renderLabel()}
            <input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              className={baseClasses}
              disabled={isSubmitting}
            />
            {renderError()}
          </div>
        );

      case 'file':
        return (
          <div key={field.id}>
            {renderLabel()}
            <p className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg px-3 py-2">
              File upload isn't available yet - attach files after the feature ships.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <ToastContainer />

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              {isEditing ? 'Edit Ticket' : 'Create New Ticket'}
            </h2>
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <Icons.Close size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Ticket Number Preview */}
          {!isEditing && ticketNumberPreview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Icons.Ticket size={20} className="text-blue-600" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900">Ticket Number Preview</h3>
                  <p className="text-lg font-mono text-blue-700 mt-1">{ticketNumberPreview}</p>
                  <p className="text-xs text-blue-600 mt-1">The next number in sequence; it is assigned when the ticket is created</p>
                </div>
              </div>
            </div>
          )}

          {/* Existing Ticket Number Display */}
          {isEditing && ticket?.ticket_number && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Icons.Ticket size={20} className="text-gray-600" />
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Ticket Number</h3>
                  <p className="text-lg font-mono text-gray-900 mt-1">{ticket.ticket_number}</p>
                </div>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter ticket title"
                disabled={isSubmitting}
              />
              {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Describe the issue or request"
              disabled={isSubmitting}
            />
            {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => handleInputChange('company_id', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.company_id ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting || isEditing}
              >
                <option value="">Select Company</option>
                {companies?.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              {errors.company_id && <p className="text-sm text-red-600 mt-1">{errors.company_id}</p>}
              {nothingToCreate && (
                <p className="text-sm text-amber-700 mt-1">
                  You don't have a role on any ticket type yet, so you can't create tickets. Ask your administrator.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ticket Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.ticket_type_id}
                onChange={(e) => handleInputChange('ticket_type_id', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.ticket_type_id ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isSubmitting || isEditing || !formData.company_id}
              >
                <option value="">{formData.company_id ? 'Select Ticket Type' : 'Select a company first'}</option>
                {ticketTypes?.filter(type => isTrue(type.is_active ?? true)).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {errors.ticket_type_id && <p className="text-sm text-red-600 mt-1">{errors.ticket_type_id}</p>}
            </div>
          </div>

          {/* Custom Fields (new tickets; editing values isn't part of updateTicket yet) */}
          {!isEditing && formData.ticket_type_id && (fieldsLoading ? (
            <p className="text-sm text-gray-500">Loading fields...</p>
          ) : customFields.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFields.map(renderCustomField)}
              </div>
            </div>
          ))}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !currentUserId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{isEditing ? 'Update Ticket' : 'Create Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default TicketForm;
