import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useDarkMode } from '../../contexts/DarkModeContext';
import { API } from '../../api/googleSheet';
import { useToast } from './Toast';
import Icons from './Icons';
import DisplayTimeZoneSelect from './DisplayTimeZoneSelect';
import { DEFAULT_ZONE } from '../../utils/dateTime';

/**
 * UserPreferencesPanel Component
 *
 * Allows users to manage their personal preferences:
 * - Dark mode toggle with profile sync
 * - Display time zone (v10.1: display_timezone, blank = the company zone)
 * - Language preferences
 * - Notification settings
 * - Dashboard layout options
 */
const UserPreferencesPanel = ({ isOpen, onClose }) => {
  const { user, companyZone, setDisplayTimezone } = useUser();
  // Firebase users carry uid; the dev mock user carries id
  const userId = user?.uid || user?.id;
  const { isDarkMode, setDarkMode } = useDarkMode();
  const { ToastContainer, success, error: showError } = useToast();

  const [preferences, setPreferences] = useState({
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

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'zh', label: 'Chinese' }
  ];

  const dashboardLayouts = [
    { value: 'grid', label: 'Grid View', description: 'Cards in a grid layout' },
    { value: 'list', label: 'List View', description: 'Compact list format' },
    { value: 'table', label: 'Table View', description: 'Detailed table format' }
  ];

  const itemsPerPageOptions = [10, 20, 50, 100];
  const refreshIntervals = [
    { value: 10000, label: '10 seconds' },
    { value: 30000, label: '30 seconds' },
    { value: 60000, label: '1 minute' },
    { value: 300000, label: '5 minutes' },
    { value: 0, label: 'Disabled' }
  ];


  useEffect(() => {
    // Sync dark mode state with preferences
    setPreferences(prev => ({
      ...prev,
      dark_mode: isDarkMode
    }));
  }, [isDarkMode]);

  const loadUserPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      const userPrefs = await API.Users.getPreferences(userId);
      setPreferences(prev => ({
        ...prev,
        ...userPrefs
      }));
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      showError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
    // showError is a new function each render; reloading on it would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserPreferences();
    }
  }, [isOpen, userId, loadUserPreferences]);

  const handleSavePreferences = async () => {
    try {
      setIsSaving(true);

      // Update dark mode if changed
      if (preferences.dark_mode !== isDarkMode) {
        await setDarkMode(preferences.dark_mode);
      }

      // Save all preferences
      await API.Users.updatePreferences(userId, preferences);
      setDisplayTimezone(preferences.display_timezone || '');
      success('Preferences saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save preferences:', error);
      showError(error.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <ToastContainer />
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Center the modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        {/* Modal content */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 sm:mx-0 sm:h-10 sm:w-10">
                  <Icons.Settings size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                    User Preferences
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Customize your experience and sync across devices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Icons.Close size={20} />
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading preferences...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Appearance Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appearance</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Dark Mode
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Switch between light and dark themes
                        </p>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={preferences.dark_mode}
                          onChange={(e) => handlePreferenceChange('dark_mode', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Dashboard Layout
                      </label>
                      <div className="space-y-2">
                        {dashboardLayouts.map((layout) => (
                          <div key={layout.value} className="flex items-center">
                            <input
                              type="radio"
                              id={layout.value}
                              name="dashboard_layout"
                              value={layout.value}
                              checked={preferences.dashboard_layout === layout.value}
                              onChange={(e) => handlePreferenceChange('dashboard_layout', e.target.value)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div className="ml-2">
                              <label htmlFor={layout.value} className="text-sm text-gray-900 dark:text-gray-100">
                                {layout.label}
                              </label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{layout.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Localization Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Localization</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display time zone
                      </label>
                      <DisplayTimeZoneSelect
                        value={preferences.display_timezone}
                        onChange={(zone) => handlePreferenceChange('display_timezone', zone)}
                        companyZone={companyZone()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Language
                      </label>
                      <select
                        value={preferences.language}
                        onChange={(e) => handlePreferenceChange('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {languages.map((lang) => (
                          <option key={lang.value} value={lang.value}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Notifications Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Notifications</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Email Notifications
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Receive notifications via email
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.email_notifications}
                        onChange={(e) => handlePreferenceChange('email_notifications', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Desktop Notifications
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Show browser notifications
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.desktop_notifications}
                        onChange={(e) => handlePreferenceChange('desktop_notifications', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                {/* Data & Performance Section */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Data & Performance</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Items per Page
                      </label>
                      <select
                        value={preferences.items_per_page}
                        onChange={(e) => handlePreferenceChange('items_per_page', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {itemsPerPageOptions.map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Auto Refresh
                      </label>
                      <select
                        value={preferences.refresh_interval}
                        onChange={(e) => handlePreferenceChange('refresh_interval', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {refreshIntervals.map((interval) => (
                          <option key={interval.value} value={interval.value}>
                            {interval.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.auto_refresh}
                        onChange={(e) => handlePreferenceChange('auto_refresh', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Enable automatic data refresh
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={handleSavePreferences}
              disabled={isSaving || isLoading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Icons.CheckCircle size={16} className="mr-2" />
                  Save Preferences
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPreferencesPanel;