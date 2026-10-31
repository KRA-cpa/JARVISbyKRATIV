import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import Icons from '../components/shared/Icons';
import { useToast } from '../components/shared/Toast';
import { useCompanies, useTicketTypes } from '../hooks/useAPI';
import { API } from '../api/googleSheet';

/**
 * AdminTicketTypeCreatePage Component
 *
 * Dedicated page for creating new ticket types with:
 * - Full-page form layout with better spacing
 * - Save-then-activate pattern implementation
 * - Enhanced validation and error handling
 * - Breadcrumb navigation
 */
const AdminTicketTypeCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { success, error, ToastContainer } = useToast();
  const [loading, setLoading] = useState(false);

  // API data
  const { data: companies } = useCompanies();
  const { data: existingTicketTypes, refetch: refetchTicketTypes } = useTicketTypes();

  // Form state
  const [formData, setFormData] = useState({
    transaction_id: '',
    code: '',
    name: '',
    description: '',
    is_active: false,  // Start as inactive, require explicit activation
    require_attachment_on_create: false,
    company_id: 'global'
  });

  // Comment requirements state
  const [commentRequirements, setCommentRequirements] = useState({
    require_on_approve: false,
    require_on_return: false,
    require_on_reject: false,
    require_on_cancel: false
  });

  // Tags / sharing switches (AppScript v9.3), saved after the type exists; off by default. Once a ticket of
  // the type is tagged / shared they can't be turned off again.
  // v10.0: visibility 'private' (default) | 'collaborative' - set with the other switches after the type is saved
  const [features, setFeatures] = useState({ enable_tags: false, enable_sharing: false, visibility: 'private' });

  // Activation state
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(null);

  const [formErrors, setFormErrors] = useState({});
  const [draftSaved, setDraftSaved] = useState(false);

  // Check for duplicate ticket type names (case-insensitive)
  const checkDuplicateName = (name) => {
    if (!name?.trim() || !existingTicketTypes) return false;

    const trimmedName = name.trim().toLowerCase();
    return existingTicketTypes.some(ticketType =>
      ticketType.name.toLowerCase() === trimmedName
    );
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.transaction_id.trim()) {
      errors.transaction_id = 'Transaction ID is required';
    }

    if (!formData.code.trim()) {
      errors.code = 'Code is required';
    } else if (!/^[A-Z0-9_-]+$/i.test(formData.code)) {
      errors.code = 'Code can only contain letters, numbers, hyphens, and underscores';
    }

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (checkDuplicateName(formData.name)) {
      errors.name = 'A ticket type with this name already exists (case-insensitive)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const ticketTypeData = {
        ...formData,
        company_id: formData.company_id === 'global' ? null : formData.company_id
      };

      // Always save as inactive first
      const savedTicketType = await API.TicketTypes.create({ ...ticketTypeData, is_active: false });
      success('Ticket type saved successfully');

      // Save comment requirements if any are set
      const hasCommentRequirements = Object.values(commentRequirements).some(Boolean);
      if (hasCommentRequirements) {
        // AppScript v9.1: a company type's rule is that company's row; a global type's rule is the global row
        await API.TicketTypes.saveCommentRequirements(savedTicketType.id, commentRequirements, ticketTypeData.company_id);
      }

      if (features.enable_tags || features.enable_sharing || features.visibility !== 'private') {
        await API.TicketTypes.setFeatures(savedTicketType.id, features, user?.uid || user?.id);
      }

      // If user wants to activate immediately, show activation dialog
      if (formData.is_active) {
        setPendingActivation({ ...ticketTypeData, id: savedTicketType.id });
        setShowActivationDialog(true);
      } else {
        // Navigate back to list
        refetchTicketTypes();
        navigate('/admin?tab=ticket-types');
      }
    } catch (err) {
      error(err.message || 'Failed to create ticket type');
    } finally {
      setLoading(false);
    }
  };

  // Handle activation confirmation
  const handleActivationConfirm = async () => {
    if (!pendingActivation) return;

    setLoading(true);

    try {
      await API.TicketTypes.update(pendingActivation.id, {
        ...pendingActivation,
        is_active: true
      });
      success('Ticket type activated successfully');
      refetchTicketTypes();
      navigate('/admin?tab=ticket-types');
    } catch (err) {
      error(err.message || 'Failed to activate ticket type');
    } finally {
      setLoading(false);
      setShowActivationDialog(false);
      setPendingActivation(null);
    }
  };

  // Handle activation cancel
  const handleActivationCancel = () => {
    setShowActivationDialog(false);
    setPendingActivation(null);
    refetchTicketTypes();
    navigate('/admin?tab=ticket-types');
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Real-time validation for name field to check duplicates
    if (name === 'name' && newValue?.trim()) {
      if (checkDuplicateName(newValue)) {
        setFormErrors(prev => ({
          ...prev,
          name: 'A ticket type with this name already exists (case-insensitive)'
        }));
      } else {
        // Clear name error if no duplicate found
        setFormErrors(prev => ({ ...prev, name: '' }));
      }
    } else if (formErrors[name]) {
      // Clear error when user starts typing in other fields
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Mark draft as modified
    setDraftSaved(false);
  };

  const handleCommentRequirementChange = (e) => {
    const { name, checked } = e.target;
    setCommentRequirements(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Auto-save draft functionality
  const saveDraft = () => {
    // In a real implementation, this would save to localStorage or API
    localStorage.setItem('ticketTypeDraft', JSON.stringify({ formData, commentRequirements }));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <ToastContainer />

      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex mb-6" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <button
                  onClick={() => navigate('/admin')}
                  className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  <Icons.Home size={14} className="mr-2" />
                  Admin
                </button>
              </li>
              <li>
                <div className="flex items-center">
                  <Icons.ChevronRight size={14} className="text-gray-400" />
                  <button
                    onClick={() => navigate('/admin?tab=ticket-types')}
                    className="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ml-2"
                  >
                    Ticket Types
                  </button>
                </div>
              </li>
              <li aria-current="page">
                <div className="flex items-center">
                  <Icons.ChevronRight size={14} className="text-gray-400" />
                  <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">Create New</span>
                </div>
              </li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create New Ticket Type</h1>
            <p className="mt-2 text-sm text-gray-600">
              Configure a new ticket type with transaction ID, workflow requirements, and business rules.
            </p>
            {draftSaved && (
              <div className="mt-2 flex items-center text-sm text-green-600">
                <Icons.CheckCircle size={16} className="mr-1" />
                Draft saved automatically
              </div>
            )}
          </div>

          {/* Main Form */}
          <div className="bg-white shadow rounded-lg">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Transaction ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Transaction ID *
                      </label>
                      <input
                        type="text"
                        name="transaction_id"
                        value={formData.transaction_id}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          formErrors.transaction_id ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="e.g., PURCHASE_REQUEST_2024"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Unique business identifier for this ticket type
                      </p>
                      {formErrors.transaction_id && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.transaction_id}</p>
                      )}
                    </div>

                    {/* Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Code *
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={formData.code}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          formErrors.code ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="e.g., PR"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Short code used in ticket numbering (e.g., MYCO-PR-2024-00000001)
                      </p>
                      {formErrors.code && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.code}</p>
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          formErrors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="e.g., Purchase Request"
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Describe the purpose and use case for this ticket type"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Company */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Company
                      </label>
                      <select
                        name="company_id"
                        value={formData.company_id}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="global">Global (All Companies)</option>
                        {companies?.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name} ({company.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Configuration Options */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">Configuration</h3>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Activate immediately after saving
                        </label>
                        <div className="ml-2">
                          <span className="text-xs text-gray-500">
                            (Will be saved first, then activated separately)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="require_attachment_on_create"
                          checked={formData.require_attachment_on_create}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Require attachment on creation
                        </label>
                      </div>

                      {[['enable_tags', 'Allow tags on these tickets'], ['enable_sharing', 'Allow sharing these tickets with other users or companies']].map(([key, label]) => (
                        <div key={key} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={features[key]}
                            onChange={(e) => setFeatures(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="ml-2 block text-sm text-gray-900">{label}</label>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500">
                        Tags and sharing can be turned off again only until the first ticket uses them.
                      </p>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Who sees these tickets</label>
                        <select
                          value={features.visibility}
                          onChange={(e) => setFeatures(prev => ({ ...prev, visibility: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="private">Private - requesters see their own and the ones they are involved in; approvers see all</option>
                          <option value="collaborative">Collaborative - anyone with a role on this type in the company sees all</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Admins always see every ticket. This can be changed later.</p>
                      </div>
                    </div>

                    {/* Comment Requirements */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">Comment Requirements</h3>
                      <p className="text-sm text-gray-600">
                        Specify when comments are mandatory for ticket actions
                      </p>

                      <div className="space-y-3">
                        {Object.entries({
                          require_on_approve: 'Require comment on approval',
                          require_on_return: 'Require comment on return',
                          require_on_reject: 'Require comment on rejection',
                          require_on_cancel: 'Require comment on cancellation'
                        }).map(([key, label]) => (
                          <div key={key} className="flex items-center">
                            <input
                              type="checkbox"
                              name={key}
                              checked={commentRequirements[key]}
                              onChange={handleCommentRequirementChange}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-900">
                              {label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate('/admin?tab=ticket-types')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Icons.ArrowLeft size={16} className="mr-2" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <Icons.Save size={16} className="mr-2" />
                    Save Draft
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Icons.Plus size={16} className="mr-2" />
                      Create Ticket Type
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Activation Confirmation Dialog */}
      {showActivationDialog && pendingActivation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Icons.CheckCircle size={20} className="text-green-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Activate Ticket Type
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to activate "{pendingActivation.name}"?
                      </p>
                      <div className="mt-3 p-3 bg-yellow-50 rounded-md">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <Icons.Warning size={16} className="text-yellow-400" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                              <strong>Important:</strong> Once activated, users will be able to create tickets of this type. Make sure all configurations are correct.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleActivationConfirm}
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Activating...
                    </>
                  ) : (
                    'Activate'
                  )}
                </button>
                <button
                  onClick={handleActivationCancel}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Save Without Activating
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTicketTypeCreatePage;