import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useLocation } from 'react-router-dom';
import Header from '../components/shared/Header';
import Footer from '../components/shared/Footer';
import Icons from '../components/shared/Icons';
import DarkModeToggle from '../components/shared/DarkModeToggle';
import UserPreferencesPanel from '../components/shared/UserPreferencesPanel';
import { useToast } from '../components/shared/Toast';
import { useUserPreferences } from '../hooks/useAPI';
import DisplayTimeZoneSelect from '../components/shared/DisplayTimeZoneSelect';
import { DEFAULT_ZONE, formatDateTime } from '../utils/dateTime';

/**
 * ProfilePage Component
 *
 * User profile settings and preferences management
 */
const ProfilePage = () => {
  const { user, userRoles, companyZone, effectiveZone, setDisplayTimezone } = useUser();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);

  // Handle query parameter to set initial section
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['profile', 'preferences', 'notifications', 'security'].includes(tabParam)) {
      setActiveSection(tabParam);
    }
  }, [location.search]);

  // Saved preferences (user_preferences tab, AppScript getUserPreferences / updateUserPreferences)
  const userId = user?.uid || user?.id;
  const { data: savedPreferences, loading: preferencesLoading, refetch: refetchPreferences, save: savePreferences } = useUserPreferences(userId);
  const { ToastContainer, success, error: showError } = useToast();
  const [showMoreSettings, setShowMoreSettings] = useState(false);
  const [userPreferences, setUserPreferences] = useState({
    dark_mode: false,
    timezone: DEFAULT_ZONE,
    display_timezone: '',
    language: 'en',
    email_notifications: true,
    desktop_notifications: true,
    dashboard_layout: 'grid',
    items_per_page: 20,
    auto_refresh: true,
    refresh_interval: 30000
  });

  // Show what is saved once it loads
  useEffect(() => {
    if (savedPreferences) {
      setUserPreferences(prev => ({ ...prev, ...savedPreferences }));
    }
  }, [savedPreferences]);

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      await savePreferences(userPreferences);
      setDisplayTimezone(userPreferences.display_timezone || '');
      success('Preferences saved');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      showError(error.message || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    {
      id: 'profile',
      name: 'Profile Information',
      icon: Icons.User,
      description: 'Basic profile information and contact details'
    },
    {
      id: 'preferences',
      name: 'Preferences',
      icon: Icons.Settings,
      description: 'Application preferences and display settings'
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: Icons.Bell,
      description: 'Notification preferences and alert settings'
    },
    {
      id: 'security',
      name: 'Security',
      icon: Icons.Shield,
      description: 'Security settings and access management'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <ToastContainer />
      <UserPreferencesPanel
        isOpen={showMoreSettings}
        onClose={() => {
          setShowMoreSettings(false);
          refetchPreferences();
        }}
      />
      <Header user={user} userRole={userRoles?.[0]?.name} />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage your account settings and preferences
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <DarkModeToggle />
              <button
                onClick={handleSavePreferences}
                disabled={loading || preferencesLoading || !userId}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Icons.Loading className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icons.Save className="-ml-1 mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="divide-y divide-gray-200 lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
            {/* Left Sidebar */}
            <aside className="py-6 lg:col-span-3">
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`group rounded-md px-3 py-2 flex items-center text-sm font-medium w-full text-left ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <section.icon
                      className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 ${
                        activeSection === section.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    <span className="truncate">{section.name}</span>
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main Content */}
            <div className="py-6 px-4 sm:p-6 lg:pb-8 lg:col-span-9">
              {activeSection === 'profile' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Your profile information is managed through Firebase Authentication.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="flex items-center space-x-6">
                      <div className="flex-shrink-0">
                        <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center">
                          <Icons.User size={32} className="text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900">
                          {user?.displayName || 'User'}
                        </h4>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {userRoles?.map((role) => (
                            <span
                              key={role.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex">
                        <Icons.Info className="h-5 w-5 text-yellow-400" />
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Profile Management
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>
                              Profile information is managed through Firebase Authentication.
                              Contact your administrator to update your display name or email address.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'preferences' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900">Application Preferences</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Customize your application experience and display settings.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-base font-medium text-gray-900">Theme</label>
                      <p className="text-sm text-gray-500">Choose your preferred application theme</p>
                      <div className="mt-4">
                        <DarkModeToggle />
                      </div>
                    </div>

                    <div>
                      <label className="text-base font-medium text-gray-900">Display time zone</label>
                      <p className="text-sm text-gray-500">
                        How dates and times are shown to you. The company time zone is the default; SLA days, holidays
                        and ticket years always follow the company's calendar.
                      </p>
                      <div className="mt-4 max-w-md">
                        <DisplayTimeZoneSelect
                          value={userPreferences.display_timezone}
                          onChange={(zone) => setUserPreferences(prev => ({ ...prev, display_timezone: zone }))}
                          companyZone={companyZone()}
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          Now: {formatDateTime(new Date(), userPreferences.display_timezone || companyZone())}
                          {effectiveZone() !== (userPreferences.display_timezone || companyZone()) ? ' (save to apply)' : ''}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-base font-medium text-gray-900">Dashboard Layout</label>
                      <div className="mt-4 space-y-2">
                        {['grid', 'list', 'table'].map((layout) => (
                          <label key={layout} className="flex items-center">
                            <input
                              type="radio"
                              name="dashboard_layout"
                              value={layout}
                              checked={userPreferences.dashboard_layout === layout}
                              onChange={(e) => setUserPreferences(prev => ({ ...prev, dashboard_layout: e.target.value }))}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="ml-3 text-sm text-gray-700 capitalize">{layout} View</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-base font-medium text-gray-900">Items Per Page</label>
                      <select
                        value={userPreferences.items_per_page}
                        onChange={(e) => setUserPreferences(prev => ({ ...prev, items_per_page: parseInt(e.target.value) }))}
                        className="mt-2 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      >
                        <option value={10}>10 items</option>
                        <option value={20}>20 items</option>
                        <option value={50}>50 items</option>
                        <option value={100}>100 items</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={userPreferences.auto_refresh}
                          onChange={(e) => setUserPreferences(prev => ({ ...prev, auto_refresh: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700">Enable auto-refresh</span>
                      </label>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setShowMoreSettings(true)}
                        disabled={!userId}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
                      >
                        <Icons.Settings size={16} className="mr-2" />
                        More settings (time zone, language, refresh interval)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'notifications' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900">Notification Settings</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Configure how you receive notifications and alerts.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={userPreferences.email_notifications}
                          onChange={(e) => setUserPreferences(prev => ({ ...prev, email_notifications: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700">Email notifications</span>
                      </label>
                      <p className="ml-7 text-xs text-gray-500">Receive email alerts for ticket updates and system notifications</p>
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={userPreferences.desktop_notifications}
                          onChange={(e) => setUserPreferences(prev => ({ ...prev, desktop_notifications: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700">Desktop notifications</span>
                      </label>
                      <p className="ml-7 text-xs text-gray-500">Show browser notifications for real-time updates</p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'security' && (
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Manage your account security and access controls.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex">
                      <Icons.Shield className="h-5 w-5 text-blue-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                          Security Management
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p>
                            Security settings including password changes and two-factor authentication
                            are managed through Firebase Authentication. Contact your administrator for assistance.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProfilePage;