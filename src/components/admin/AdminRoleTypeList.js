import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icons from '../shared/Icons';
import ErrorBoundary130 from '../shared/ErrorBoundary130';
import { useToast } from '../shared/Toast';
import { useRoleTypes, useRoleTypeMutations } from '../../hooks/useAPI';
import { formatDateOnly } from '../../utils/dateTime';

/**
 * AdminRoleTypeList Component
 *
 * Universal Entity Architecture - manages role types
 * - Lists all role types with actions
 * - Integrates with custom field creation
 * - Supports company-specific and global types
 * - CRUD operations for role type management
 */
const AdminRoleTypeList = () => {
  const navigate = useNavigate();
  const { success, error: showError, ToastContainer } = useToast();
  const [actionLoading, setActionLoading] = useState({});

  // API hooks
  const { data: roleTypes, loading, error, refetch } = useRoleTypes(null, true); // inactive too, so they can be reactivated
  const { updateRoleType, deleteRoleType } = useRoleTypeMutations();

  // Handle status toggle
  const handleToggleStatus = async (roleType) => {
    setActionLoading(prev => ({ ...prev, [roleType.id]: true }));

    try {
      await updateRoleType(roleType.id, {
        ...roleType,
        is_active: !roleType.is_active
      });

      success(`Role type ${roleType.is_active ? 'deactivated' : 'activated'} successfully`);
      refetch();
    } catch (err) {
      showError(err.message || 'Failed to update role type status');
    } finally {
      setActionLoading(prev => ({ ...prev, [roleType.id]: false }));
    }
  };

  // Handle delete
  const handleDelete = async (roleType) => {
    if (!window.confirm(`Are you sure you want to delete "${roleType.name}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [`delete_${roleType.id}`]: true }));

    try {
      await deleteRoleType(roleType.id);
      success('Role type deleted successfully');
      refetch();
    } catch (err) {
      showError(err.message || 'Failed to delete role type');
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${roleType.id}`]: false }));
    }
  };

  // Handle custom field creation
  const handleCreateCustomField = (roleType) => {
    navigate(`/admin/custom-fields/create?entityCategory=role&entityType=${roleType.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading role types...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <Icons.Warning className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading role types</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary130>
      <ToastContainer />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Role Types</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage role categories and their custom fields
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/role-types/create')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Icons.Plus size={16} className="mr-2" />
            Create Role Type
          </button>
        </div>

        {/* Role Types List */}
        {!roleTypes || roleTypes.length === 0 ? (
          <div className="text-center py-12">
            <Icons.Shield size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No role types yet</h3>
            <p className="text-gray-500 mb-6">Get started by creating your first role type</p>
            <button
              onClick={() => navigate('/admin/role-types/create')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Icons.Plus size={16} className="mr-2" />
              Create Role Type
            </button>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {roleTypes.length} Role Type{roleTypes.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {roleTypes.map((roleType) => (
                <li key={roleType.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className={`flex-shrink-0 w-3 h-3 rounded-full ${
                          roleType.is_active ? 'bg-green-400' : 'bg-gray-400'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {roleType.name}
                            {roleType.code && (
                              <span className="ml-2 text-xs text-gray-500">({roleType.code})</span>
                            )}
                          </h4>
                          {roleType.description && (
                            <p className="text-sm text-gray-500 truncate">{roleType.description}</p>
                          )}
                          <div className="flex items-center mt-1 text-xs text-gray-500 space-x-4">
                            <span>{roleType.company_id ? 'Company-specific' : 'Global'}</span>
                            <span>•</span>
                            <span>Created {formatDateOnly(roleType.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Custom Fields Button */}
                      <button
                        onClick={() => handleCreateCustomField(roleType)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        title="Create custom fields for this role type"
                      >
                        <Icons.Plus size={12} className="mr-1" />
                        Custom Fields
                      </button>

                      {/* Status Toggle */}
                      <button
                        onClick={() => handleToggleStatus(roleType)}
                        disabled={actionLoading[roleType.id]}
                        className={`inline-flex items-center px-3 py-1 border rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                          roleType.is_active
                            ? 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                            : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {actionLoading[roleType.id] ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                        ) : roleType.is_active ? (
                          <Icons.EyeOff size={12} className="mr-1" />
                        ) : (
                          <Icons.Eye size={12} className="mr-1" />
                        )}
                        {roleType.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => navigate(`/admin/role-types/${roleType.id}/edit`)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Icons.Edit size={12} className="mr-1" />
                        Edit
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(roleType)}
                        disabled={actionLoading[`delete_${roleType.id}`]}
                        className="inline-flex items-center px-3 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        {actionLoading[`delete_${roleType.id}`] ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                        ) : (
                          <Icons.Delete size={12} className="mr-1" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ErrorBoundary130>
  );
};

export default AdminRoleTypeList;