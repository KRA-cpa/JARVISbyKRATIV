import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icons from '../shared/Icons';
import { useToast } from '../shared/Toast';
import { useTicketTypes, useCompanies } from '../../hooks/useAPI';
import { useUser } from '../../contexts/UserContext';
import { API } from '../../api/googleSheet';

// Sheet booleans arrive as true / 'TRUE'
const isOn = value => value === true || String(value).toUpperCase() === 'TRUE';

/**
 * AdminTicketTypeList Component
 *
 * Simplified list view for ticket types with navigation to dedicated pages:
 * - Removed modal logic completely
 * - Navigation to create/edit pages
 * - Enhanced list view with better actions
 * - Save-then-activate pattern support
 */
const AdminTicketTypeList = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { success, error, ToastContainer } = useToast();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTicketType, setDeletingTicketType] = useState(null);
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(null);

  // API data
  const { data: ticketTypes, loading: ticketTypesLoading, error: ticketTypesError, refetch: refetchTicketTypes } = useTicketTypes();
  const { data: companies, loading: companiesLoading } = useCompanies();

  // Handle create navigation
  const handleCreateTicketType = () => {
    navigate('/admin/ticket-types/create');
  };

  // Handle edit navigation
  const handleEditTicketType = (ticketType) => {
    navigate(`/admin/ticket-types/${ticketType.id}/edit`);
  };

  // Handle delete
  const handleDeleteTicketType = (ticketType) => {
    setDeletingTicketType(ticketType);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingTicketType) return;

    setLoading(true);
    try {
      await API.TicketTypes.delete(deletingTicketType.id);
      success('Ticket type deleted successfully');
      refetchTicketTypes();
      setShowDeleteConfirm(false);
      setDeletingTicketType(null);
    } catch (err) {
      error('Failed to delete ticket type: ' + err.message);
    }
    setLoading(false);
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
      setShowActivationDialog(false);
      setPendingActivation(null);
    } catch (err) {
      error(err.message || 'Failed to activate ticket type');
    } finally {
      setLoading(false);
    }
  };

  // Handle activation cancel
  const handleActivationCancel = () => {
    setShowActivationDialog(false);
    setPendingActivation(null);
  };

  // Handle toggle active (separate activation/deactivation)
  const handleToggleActive = async (ticketType) => {
    if (!ticketType.is_active) {
      // For activation, show confirmation dialog
      setPendingActivation(ticketType);
      setShowActivationDialog(true);
      return;
    }

    // For deactivation, proceed directly with confirmation
    if (!window.confirm(`Are you sure you want to deactivate "${ticketType.name}"? This will prevent new tickets from being created with this type.`)) {
      return;
    }

    setLoading(true);

    try {
      await API.TicketTypes.update(ticketType.id, {
        ...ticketType,
        is_active: false
      });
      success('Ticket type deactivated successfully');
      refetchTicketTypes();
    } catch (err) {
      error(err.message || 'Failed to deactivate ticket type');
    } finally {
      setLoading(false);
    }
  };

  // Tags / sharing switches (AppScript v9.3): off by default; the backend refuses turning one off once a
  // ticket of this type is tagged / shared, so nothing is orphaned
  const handleToggleFeature = async (ticketType, feature) => {
    const key = feature === 'tags' ? 'enable_tags' : 'enable_sharing';
    const turnOn = !isOn(ticketType[key]);
    setLoading(true);
    try {
      await API.TicketTypes.setFeatures(ticketType.id, { [key]: turnOn }, user?.uid || user?.id);
      success(`${feature === 'tags' ? 'Tags' : 'Sharing'} turned ${turnOn ? 'on' : 'off'} for ${ticketType.name}`);
      refetchTicketTypes();
    } catch (err) {
      error(err.message || 'Failed to change the setting');
    } finally {
      setLoading(false);
    }
  };

  // Visibility (AppScript v10.0, decision 2): private (default) = requesters see their own tickets and the ones they're
  // involved in, approver roles see all; collaborative = anyone with a role on the type + company sees all. No lock.
  const handleToggleVisibility = async (ticketType) => {
    const next = ticketType.visibility === 'collaborative' ? 'private' : 'collaborative';
    setLoading(true);
    try {
      await API.TicketTypes.setFeatures(ticketType.id, { visibility: next }, user?.uid || user?.id);
      success(`${ticketType.name} tickets are now ${next === 'private' ? 'private' : 'collaborative'}`);
      refetchTicketTypes();
    } catch (err) {
      error(err.message || 'Failed to change the visibility');
    } finally {
      setLoading(false);
    }
  };

  // Get company name
  const getCompanyName = (companyId) => {
    if (!companyId) return 'Global';
    const company = companies?.find(c => c.id === companyId);
    return company ? `${company.name} (${company.code})` : 'Unknown Company';
  };

  // Loading state
  if (ticketTypesLoading || companiesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading ticket types...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (ticketTypesError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <Icons.Error size={20} className="text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error Loading Ticket Types</h3>
            <p className="mt-1 text-sm text-red-700">{ticketTypesError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Ticket Type Management</h2>
            <p className="mt-1 text-sm text-gray-600">
              Configure ticket types, transaction IDs, and workflow requirements
            </p>
          </div>
          <button
            onClick={handleCreateTicketType}
            disabled={loading}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Icons.Plus size={16} className="mr-2" />
            Add Ticket Type
          </button>
        </div>

        {/* Ticket Types List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Ticket Types ({ticketTypes?.length || 0})
            </h3>
          </div>

          {ticketTypes && ticketTypes.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {ticketTypes.map((ticketType) => (
                <div key={ticketType.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ticketType.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {ticketType.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {ticketType.code}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {getCompanyName(ticketType.company_id)}
                        </span>
                      </div>
                      <h4 className="mt-2 text-lg font-medium text-gray-900">
                        {ticketType.name}
                      </h4>
                      <p className="mt-1 text-sm text-gray-600">
                        Transaction ID: <code className="bg-gray-100 px-1 rounded text-xs">{ticketType.transaction_id}</code>
                      </p>
                      {ticketType.description && (
                        <p className="mt-1 text-sm text-gray-600">{ticketType.description}</p>
                      )}
                      <div className="mt-2 flex space-x-4 text-xs text-gray-500">
                        {ticketType.require_attachment_on_create && (
                          <span className="flex items-center">
                            <Icons.Attachment size={12} className="mr-1" />
                            Attachment Required
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[['tags', 'Tags', 'enable_tags', Icons.Tag], ['sharing', 'Sharing', 'enable_sharing', Icons.Share]].map(([feature, label, key, FeatureIcon]) => (
                          <button
                            key={feature}
                            onClick={() => handleToggleFeature(ticketType, feature)}
                            disabled={loading}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border disabled:opacity-50 ${
                              isOn(ticketType[key]) ? 'bg-green-50 text-green-800 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                            title={isOn(ticketType[key])
                              ? `${label} on - can be turned off only while no ticket of this type uses it`
                              : `Turn ${label.toLowerCase()} on for this ticket type`}
                          >
                            <FeatureIcon size={12} className="mr-1" />
                            {label}: {isOn(ticketType[key]) ? 'on' : 'off'}
                          </button>
                        ))}
                        <button
                          onClick={() => handleToggleVisibility(ticketType)}
                          disabled={loading}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border disabled:opacity-50 ${
                            ticketType.visibility === 'collaborative' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                          title={ticketType.visibility === 'collaborative'
                            ? 'Collaborative: anyone with a role on this type in the company sees every ticket. Click to make it private'
                            : 'Private: requesters see their own tickets and the ones they are involved in; approvers see all. Click to make it collaborative'}
                        >
                          {ticketType.visibility === 'collaborative' ? <Icons.Users size={12} className="mr-1" /> : <Icons.Lock size={12} className="mr-1" />}
                          Visibility: {ticketType.visibility === 'collaborative' ? 'collaborative' : 'private'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleActive(ticketType)}
                        disabled={loading}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                          ticketType.is_active
                            ? 'bg-red-100 text-red-800 hover:bg-red-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                        title={ticketType.is_active ? 'Deactivate ticket type' : 'Activate ticket type'}
                      >
                        {ticketType.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        onClick={() => handleEditTicketType(ticketType)}
                        disabled={loading}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-full disabled:opacity-50"
                        title="Edit ticket type"
                      >
                        <Icons.Edit size={16} />
                      </button>

                      <button
                        onClick={() => handleDeleteTicketType(ticketType)}
                        disabled={loading}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-full disabled:opacity-50"
                        title="Delete ticket type"
                      >
                        <Icons.Delete size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Icons.Ticket size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Ticket Types</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first ticket type.</p>
              <button
                onClick={handleCreateTicketType}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Icons.Plus size={16} className="mr-2" />
                Add Ticket Type
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingTicketType && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Icons.Warning size={20} className="text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete Ticket Type
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete "{deletingTicketType.name}"? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingTicketType(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminTicketTypeList;