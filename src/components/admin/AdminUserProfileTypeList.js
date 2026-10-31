import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icons from '../shared/Icons';
import ErrorBoundary130 from '../shared/ErrorBoundary130';
import { useToast } from '../shared/Toast';
import { useUserProfileTypes, useUserProfileTypeMutations } from '../../hooks/useAPI';
import { formatDateOnly } from '../../utils/dateTime';

/**
 * AdminUserProfileTypeList Component
 *
 * Universal Entity Architecture - manages user profile types
 * - Lists all user profile types with actions
 * - Integrates with custom field creation
 * - Supports company-specific and global types
 * - CRUD operations for user profile type management
 */
const AdminUserProfileTypeList = () => {
  const navigate = useNavigate();
  const { success, error: showError, ToastContainer } = useToast();
  const [actionLoading, setActionLoading] = useState({});

  // API hooks
  const { data: userProfileTypes, loading, error, refetch } = useUserProfileTypes(null, true); // inactive too, so they can be reactivated
  const { updateUserProfileType, deleteUserProfileType } = useUserProfileTypeMutations();

  // Handle status toggle
  const handleToggleStatus = async (userProfileType) => {
    setActionLoading(prev => ({ ...prev, [userProfileType.id]: true }));

    try {
      await updateUserProfileType(userProfileType.id, {
        ...userProfileType,
        is_active: !userProfileType.is_active
      });

      success(`User profile type ${userProfileType.is_active ? 'deactivated' : 'activated'} successfully`);
      refetch();
    } catch (err) {
      showError(err.message || 'Failed to update user profile type status');
    } finally {
      setActionLoading(prev => ({ ...prev, [userProfileType.id]: false }));
    }
  };

  // Handle delete
  const handleDelete = async (userProfileType) => {
    if (!window.confirm(`Are you sure you want to delete "${userProfileType.name}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [`delete_${userProfileType.id}`]: true }));

    try {
      await deleteUserProfileType(userProfileType.id);
      success('User profile type deleted successfully');
      refetch();
    } catch (err) {
      showError(err.message || 'Failed to delete user profile type');
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${userProfileType.id}`]: false }));
    }
  };

  // Handle custom field creation
  const handleCreateCustomField = (userProfileType) => {
    navigate(`/admin/custom-fields/create?entityCategory=user_profile&entityType=${userProfileType.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading user profile types...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <Icons.Warning className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading user profile types</h3>
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
            <h2 className="text-lg font-medium text-gray-900">User Profile Types</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage user profile categories and their custom fields
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/user-profile-types/create')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Icons.Plus size={16} className="mr-2" />
            Create User Profile Type
          </button>
        </div>

        {/* User Profile Types List */}
        {!userProfileTypes || userProfileTypes.length === 0 ? (
          <div className="text-center py-12">
            <Icons.Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No user profile types yet</h3>
            <p className="text-gray-500 mb-6">Get started by creating your first user profile type</p>
            <button
              onClick={() => navigate('/admin/user-profile-types/create')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Icons.Plus size={16} className="mr-2" />
              Create User Profile Type
            </button>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {userProfileTypes.length} User Profile Type{userProfileTypes.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {userProfileTypes.map((userProfileType) => (
                <li key={userProfileType.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className={`flex-shrink-0 w-3 h-3 rounded-full ${
                          userProfileType.is_active ? 'bg-green-400' : 'bg-gray-400'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {userProfileType.name}
                            {userProfileType.code && (
                              <span className="ml-2 text-xs text-gray-500">({userProfileType.code})</span>
                            )}
                          </h4>
                          {userProfileType.description && (
                            <p className="text-sm text-gray-500 truncate">{userProfileType.description}</p>
                          )}
                          <div className="flex items-center mt-1 text-xs text-gray-500 space-x-4">
                            <span>{userProfileType.company_id ? 'Company-specific' : 'Global'}</span>
                            <span>•</span>
                            <span>Created {formatDateOnly(userProfileType.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Custom Fields Button */}
                      <button
                        onClick={() => handleCreateCustomField(userProfileType)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        title="Create custom fields for this user profile type"
                      >
                        <Icons.Plus size={12} className="mr-1" />
                        Custom Fields
                      </button>

                      {/* Status Toggle */}
                      <button
                        onClick={() => handleToggleStatus(userProfileType)}
                        disabled={actionLoading[userProfileType.id]}
                        className={`inline-flex items-center px-3 py-1 border rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                          userProfileType.is_active
                            ? 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                            : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {actionLoading[userProfileType.id] ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                        ) : userProfileType.is_active ? (
                          <Icons.EyeOff size={12} className="mr-1" />
                        ) : (
                          <Icons.Eye size={12} className="mr-1" />
                        )}
                        {userProfileType.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => navigate(`/admin/user-profile-types/${userProfileType.id}/edit`)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Icons.Edit size={12} className="mr-1" />
                        Edit
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(userProfileType)}
                        disabled={actionLoading[`delete_${userProfileType.id}`]}
                        className="inline-flex items-center px-3 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        {actionLoading[`delete_${userProfileType.id}`] ? (
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

export default AdminUserProfileTypeList;