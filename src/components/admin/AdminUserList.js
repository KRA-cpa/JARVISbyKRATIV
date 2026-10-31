import React, { useState } from 'react';
import Icons from '../shared/Icons';
import ErrorBoundary130 from '../shared/ErrorBoundary130';
import { useToast } from '../shared/Toast';
import { useUsers } from '../../hooks/useAPI';
import DateBasedRoleAssignmentManager from './DateBasedRoleAssignmentManager';
import UserGeneralRoleSelector, { GeneralRoleBadge, filterUsersByGeneralRole } from './UserGeneralRoleSelector';
import AdminUserInvites from './AdminUserInvites';

/**
 * AdminUserList Component
 *
 * User administration interface without Firebase dependency
 * - Lists user profiles with their roles in force and general role (maker / approver / both / viewer)
 * - Filters by general role (UserGeneralRoleSelector)
 * - Date-based role assignment per user (DateBasedRoleAssignmentManager)
 * - Disables features requiring Firebase authentication
 *
 * Users come from getUsers (AppScript v9.0+): user_profiles rows plus id, name, roles[], general_role.
 * v9.6: Invite (AdminUserInvites) - new users get in by invite; their profile and roles are created on the first
 * Google sign-in with the invited email.
 */
const AdminUserList = () => {
  const toast = useToast();
  const { warning, ToastContainer } = toast;
  const [selectedUser, setSelectedUser] = useState(null);
  const [showInvites, setShowInvites] = useState(false);
  const notify = (type, message) => (toast[type] || toast.info)(message);
  const [roleFilter, setRoleFilter] = useState('all');

  // API hooks
  const { data: users, loading, error, refetch } = useUsers();

  // Firebase-dependent features flag
  const FIREBASE_FEATURES_ENABLED = false;

  // Handle user actions (disabled for Firebase features)
  const handleResetPassword = () => {
    warning('Password reset requires Firebase authentication setup. Please contact your system administrator.');
  };

  const handleDeleteUser = () => {
    warning('User deletion requires Firebase authentication setup. Please contact your system administrator.');
  };

  const userId = (user) => user.user_id || user.id;
  const userName = (user) => user.display_name || user.name || user.email || userId(user);
  const visibleUsers = filterUsersByGeneralRole(users, roleFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading users...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <Icons.Warning className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading users</h3>
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
            <h2 className="text-lg font-medium text-gray-900">User Administration</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage user roles and their dates
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowInvites(open => !open)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Icons.UserPlus size={16} className="mr-2" />
              Invite
            </button>
          </div>
        </div>

        {/* v9.6: invites */}
        {showInvites && (
          <AdminUserInvites users={users || []} onClose={() => setShowInvites(false)} notify={notify} />
        )}

        {/* Firebase Status Notice */}
        {!FIREBASE_FEATURES_ENABLED && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <Icons.Warning className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Limited Functionality</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>Password reset and deletion are handled by Google sign-in, not here.</p>
                  <p className="mt-1">Available: invite users, view users, assign and end roles.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users List */}
        {!users || users.length === 0 ? (
          <div className="text-center py-12">
            <Icons.Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500 mb-6">Users appear here once they have a user profile</p>
            <button
              onClick={() => setShowInvites(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Icons.UserPlus size={16} className="mr-2" />
              Invite the first user
            </button>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 space-y-3">
              <h3 className="text-lg font-medium text-gray-900">
                {visibleUsers.length} of {users.length} User{users.length !== 1 ? 's' : ''}
              </h3>
              <UserGeneralRoleSelector users={users} value={roleFilter} onChange={setRoleFilter} />
            </div>
            {visibleUsers.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-500 text-center">No users match this filter.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {visibleUsers.map((user) => (
                  <li key={userId(user)} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-4">
                          {/* User Avatar */}
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <Icons.User size={20} className="text-gray-600" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {userName(user)}
                              </h4>
                              <GeneralRoleBadge generalRole={user.general_role} />
                            </div>
                            <p className="text-sm text-gray-500 truncate">{user.email}</p>
                            <div className="flex flex-wrap items-center mt-1 gap-1">
                              {(user.roles || []).length === 0 ? (
                                <span className="text-xs text-gray-400">No roles in force</span>
                              ) : (
                                user.roles.map(role => (
                                  <span
                                    key={role.assignment_id || `${role.id}_${role.company_id}`}
                                    className="inline-flex px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                                  >
                                    {role.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Roles Button */}
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Icons.Shield size={12} className="mr-1" />
                          Roles
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={handleResetPassword}
                          disabled={!FIREBASE_FEATURES_ENABLED}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icons.Key size={12} className="mr-1" />
                          Reset Password
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={handleDeleteUser}
                          disabled={!FIREBASE_FEATURES_ENABLED}
                          className="inline-flex items-center px-3 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icons.Delete size={12} className="mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Role Assignment Manager */}
        {selectedUser && (
          <DateBasedRoleAssignmentManager
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onChanged={refetch}
          />
        )}
      </div>
    </ErrorBoundary130>
  );
};

export default AdminUserList;
