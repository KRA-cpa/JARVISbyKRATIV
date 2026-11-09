import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useCompanies, useRoles, useDropdownLists, useTickets, useUsers, useTicketTypes, useUserProfileTypes, useRoleTypes } from '../hooks/useAPI';
import Header from '../components/shared/Header';
import Icons from '../components/shared/Icons';
import DEV_CONFIG from '../config/development';
import AdminCompanyManager from '../components/admin/AdminCompanyManager';
import AdminRoleManager from '../components/admin/AdminRoleManager';
import AdminDropdownManager from '../components/admin/AdminDropdownManager';
import DropdownListCreate from '../components/admin/DropdownListCreate';
import AdminTicketTypeList from '../components/admin/AdminTicketTypeList';
import AdminCustomFieldList from '../components/admin/AdminCustomFieldList';
import AdminUserProfileTypeList from '../components/admin/AdminUserProfileTypeList';
import AdminRoleTypeList from '../components/admin/AdminRoleTypeList';
import AdminUserList from '../components/admin/AdminUserList';
import AdminWorkflowBuilder from '../components/admin/AdminWorkflowBuilder';
import CrossCompanyTicketLinker from '../components/admin/CrossCompanyTicketLinker';
import AdminReportConfigManager from '../components/admin/AdminReportConfigManager';
import AdminAuditLogViewer from '../components/admin/AdminAuditLogViewer';
import CompanySLAManager from '../components/admin/CompanySLAManager';
import AdminSLAEscalationManager from '../components/admin/AdminSLAEscalationManager';
import AdminCountryCalendars from '../components/admin/AdminCountryCalendars';
import AdminSystemBackup from '../components/admin/AdminSystemBackup';
import APIConnectionStatus from '../components/admin/APIConnectionStatus';
import Footer from '../components/shared/Footer';

const AdminPage = () => {
  const { user, userRoles } = useUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [showBackendInfo, setShowBackendInfo] = useState(false);
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');

  // Fetch real data from API with manual refresh capability
  const { data: companies, loading: companiesLoading, error: companiesError, refetch: refetchCompanies } = useCompanies();
  const { data: roles, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = useRoles();
  const { data: dropdownLists, loading: dropdownsLoading, error: dropdownsError, refetch: refetchDropdowns } = useDropdownLists();
  const { data: tickets, loading: ticketsLoading, error: ticketsError, refetch: refetchTickets } = useTickets();
  const { data: users, loading: usersLoading, error: usersError, refetch: refetchUsers } = useUsers();
  const { data: ticketTypes, loading: ticketTypesLoading, error: ticketTypesError, refetch: refetchTicketTypes } = useTicketTypes();
  const { data: userProfileTypes, loading: userProfileTypesLoading, error: userProfileTypesError, refetch: refetchUserProfileTypes } = useUserProfileTypes();
  const { data: roleTypes, loading: roleTypesLoading, error: roleTypesError, refetch: refetchRoleTypes } = useRoleTypes();

  // Manual refresh all data - memoized to prevent infinite loops
  const refreshAllData = React.useCallback(async () => {
    try {
      await Promise.all([
        refetchCompanies(),
        refetchRoles(),
        refetchDropdowns(),
        refetchTickets(),
        refetchUsers(),
        refetchTicketTypes(),
        refetchUserProfileTypes(),
        refetchRoleTypes()
      ]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [refetchCompanies, refetchRoles, refetchDropdowns, refetchTickets, refetchUsers, refetchTicketTypes, refetchUserProfileTypes, refetchRoleTypes]);

  // Simple API health status with minimal logic to prevent infinite loops
  const apiHealth = React.useMemo(() => {
    const hasErrors = Boolean(companiesError || rolesError || dropdownsError || ticketsError || usersError || ticketTypesError || userProfileTypesError || roleTypesError);
    const isLoading = Boolean(companiesLoading || rolesLoading || dropdownsLoading || ticketsLoading || usersLoading || ticketTypesLoading || userProfileTypesLoading || roleTypesLoading);

    if (hasErrors) {
      return {
        status: 'error',
        message: 'API connection issues detected'
      };
    }

    if (isLoading) {
      return {
        status: 'loading',
        message: 'Loading data...'
      };
    }

    return {
      status: 'healthy',
      message: 'All systems operational'
    };
  }, [
    companiesError, rolesError, dropdownsError, ticketsError, usersError, ticketTypesError, userProfileTypesError, roleTypesError,
    companiesLoading, rolesLoading, dropdownsLoading, ticketsLoading, usersLoading, ticketTypesLoading, userProfileTypesLoading, roleTypesLoading
  ]);

  // Calculate statistics from real data
  const getCompanyStats = () => {
    if (companiesLoading) return { count: 'Loading...', active: 'Loading...' };
    const activeCompanies = companies?.filter(company => company.name && company.code) || [];
    return {
      count: activeCompanies.length,
      active: `${activeCompanies.length} active companies`
    };
  };

  const getUserStats = () => {
    if (usersLoading) return { total: 'Loading...', activeThisMonth: 'Loading...' };
    const totalUsers = users?.length || 0;
    // For demo purposes, simulate active users this month (20% of total)
    const activeThisMonth = Math.ceil(totalUsers * 0.2);
    return {
      total: totalUsers,
      activeThisMonth: `${activeThisMonth} active users this month`
    };
  };

  const getTicketTypeStats = () => {
    if (ticketTypesLoading || ticketsLoading) return { total: 'Loading...', mostActive: 'Loading...' };

    const activeTicketTypes = ticketTypes?.filter(tt => tt.name && tt.code) || [];

    // Calculate most active ticket type this month
    const ticketsByType = {};
    if (tickets && Array.isArray(tickets)) {
      tickets.forEach(ticket => {
        if (ticket.ticket_type_id) {
          ticketsByType[ticket.ticket_type_id] = (ticketsByType[ticket.ticket_type_id] || 0) + 1;
        }
      });
    }

    // Find most active ticket type
    let mostActiveType = null;
    let maxCount = 0;
    Object.entries(ticketsByType).forEach(([typeId, count]) => {
      if (count > maxCount) {
        maxCount = count;
        const ticketType = ticketTypes?.find(tt => tt.id === typeId);
        mostActiveType = ticketType?.name || ticketType?.description || typeId;
      }
    });

    return {
      total: activeTicketTypes.length,
      mostActive: mostActiveType
        ? `Most active this month: ${mostActiveType} - ${maxCount} tickets`
        : 'No ticket activity this month'
    };
  };

  // Consolidated admin tabs configuration with grouped sections
  const adminTabs = [
    {
      id: 'overview',
      name: 'Overview',
      icon: Icons.Dashboard,
      description: 'System overview and statistics'
    },
    {
      id: 'companies',
      name: 'Companies',
      icon: Icons.Company,
      description: 'Manage company configurations',
      component: AdminCompanyManager
    },
    {
      id: 'ticket-types',
      name: 'Ticket Types',
      icon: Icons.Workflow,
      description: 'Configure ticket types and transaction IDs',
      component: AdminTicketTypeList
    },
    {
      id: 'custom-fields',
      name: 'Custom Fields',
      icon: Icons.Edit,
      description: 'Build dynamic form fields for ticket types',
      component: AdminCustomFieldList
    },
    {
      id: 'workflows',
      name: 'Workflows',
      icon: Icons.Approval,
      description: 'Approval steps, approver roles and SLAs per company and ticket type',
      component: AdminWorkflowBuilder
    },
    {
      id: 'ticket-links',
      name: 'Ticket Links',
      icon: Icons.ExternalLink,
      description: 'Link tickets (blocks, depends on, related) and check dependencies',
      component: CrossCompanyTicketLinker
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: Icons.Documents,
      description: 'Report columns per ticket type (global or per company)',
      component: AdminReportConfigManager
    },
    {
      id: 'audit-log',
      name: 'Audit Log',
      icon: Icons.History,
      description: 'Admin changes and logins (admin_action_logs)',
      component: AdminAuditLogViewer
    },
    {
      id: 'sla-rules',
      name: 'SLA Rules',
      icon: Icons.Clock,
      description: 'Company SLA targets, escalation and business hours per ticket type step',
      component: CompanySLAManager
    },
    {
      id: 'sla-escalations',
      name: 'SLA Escalations',
      icon: Icons.Notification,
      description: 'Timed notices and escalation levels per step, holidays and SLA email (AppScript v9.5)',
      component: AdminSLAEscalationManager
    },
    {
      id: 'country-calendars',
      name: 'Country Calendars',
      icon: Icons.Calendar,
      description: 'Ticket year, weekends, business hours and holidays per country; company time zones (AppScript v10.1)',
      component: AdminCountryCalendars
    },
    {
      id: 'system',
      name: 'System & Backup',
      icon: Icons.Settings,
      description: 'Schema health, configuration backup to Drive, export and company-to-company import',
      component: AdminSystemBackup
    },
    {
      id: 'dropdowns',
      name: 'Dropdown Lists',
      icon: Icons.ChevronDown,
      description: 'Manage dropdown lists and company assignments',
      hasSubTabs: true,
      subTabs: [
        {
          id: 'dropdown-create',
          name: 'Create Lists',
          description: 'Create new dropdown lists with options',
          component: DropdownListCreate
        },
        {
          id: 'dropdown-manage',
          name: 'Manage Lists',
          description: 'Manage company assignments and deactivate lists',
          component: AdminDropdownManager
        }
      ]
    },
    {
      id: 'users',
      name: 'Users',
      icon: Icons.Users,
      description: 'User management and profile configuration',
      hasSubTabs: true,
      subTabs: [
        {
          id: 'user-profiles',
          name: 'User Admin',
          description: 'Per-user management and permissions',
          component: AdminUserList
        },
        {
          id: 'user-profile-types',
          name: 'Profile Types',
          description: 'Define user profile categories with custom fields',
          component: AdminUserProfileTypeList
        }
      ]
    },
    {
      id: 'roles',
      name: 'Roles',
      icon: Icons.Shield,
      description: 'Role management and configuration',
      hasSubTabs: true,
      subTabs: [
        {
          id: 'role-assignments',
          name: 'Role Admin',
          description: 'Define user roles and permissions',
          component: AdminRoleManager
        },
        {
          id: 'role-types',
          name: 'Role Types',
          description: 'Configure role categories with custom permissions',
          component: AdminRoleTypeList
        }
      ]
    }
  ];

  // Open the tab named in ?tab= - create/edit pages link back with a tab id (ticket-types)
  // or a sub-tab id (user-profile-types), so a sub-tab id also selects its parent tab
  useEffect(() => {
    if (!requestedTab) return;
    const parentTab = adminTabs.find(t => t.id === requestedTab || t.subTabs?.some(st => st.id === requestedTab));
    if (!parentTab) return;

    setActiveTab(parentTab.id);
    if (parentTab.id !== requestedTab) {
      setActiveSubTab(requestedTab);
    } else {
      setActiveSubTab(parentTab.subTabs?.find(st => !st.disabled)?.id || null);
    }
    // adminTabs is static config rebuilt each render; only a new ?tab= should re-run this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab]);

  // Generate admin modules with real data
  const getModuleStats = (moduleId) => {
    switch (moduleId) {
      case 'companies':
        if (companiesLoading) return 'Loading...';
        return `${companies?.length || 0} companies`;
      case 'ticket-types':
        return 'Phase 8.5 - Available';
      case 'custom-fields':
        return 'Phase 8.5 - Available';
      case 'workflows':
        return 'Per company';
      case 'ticket-links':
        return 'Dependencies';
      case 'reports':
        return 'Columns per type';
      case 'audit-log':
        return 'Who changed what';
      case 'sla-rules':
        return 'Per company';
      case 'sla-escalations':
        return 'Levels per step';
      case 'system':
        return 'Health + backup';
      case 'dropdowns':
        if (dropdownsLoading) return 'Loading...';
        return `${dropdownLists?.length || 0} lists`;
      case 'users':
        const userCount = users?.length || 0;
        const profileCount = userProfileTypes?.length || 0;
        return `${userCount} users, ${profileCount} profile types`;
      case 'roles':
        const roleCount = roles?.length || 0;
        const roleTypeCount = roleTypes?.length || 0;
        return `${roleCount} roles, ${roleTypeCount} types`;
      default:
        return 'Coming Soon';
    }
  };

  // Handle tab selection with sub-tab support
  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
    const tab = adminTabs.find(t => t.id === tabId);
    if (tab?.hasSubTabs && tab.subTabs.length > 0) {
      // Auto-select first available sub-tab
      const firstAvailableSubTab = tab.subTabs.find(st => !st.disabled);
      setActiveSubTab(firstAvailableSubTab?.id || null);
    } else {
      setActiveSubTab(null);
    }
  };

  // Get currently active component
  const getActiveComponent = () => {
    const currentTab = adminTabs.find(t => t.id === activeTab);

    if (currentTab?.hasSubTabs && activeSubTab) {
      const currentSubTab = currentTab.subTabs.find(st => st.id === activeSubTab);
      return currentSubTab?.component || null;
    }

    return currentTab?.component || null;
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <Header
        user={user}
        userRole={userRoles?.[0]?.name?.toLowerCase() || 'admin'}
      />

      {/* Main Content */}
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Admin Header */}
          <div className="mb-8">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center space-x-4">
                <Icons.Admin size={48} className="text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
                  <p className="text-gray-600">
                    System configuration and management
                  </p>
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                    <span>Logged in as: {user?.email}</span>
                    <span>•</span>
                    <span>Admin Role: {userRoles?.[0]?.name || 'System Admin'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contract documents - the DPA is shown only here, to admins (user, 1 Nov 2026) */}
          {activeTab === 'overview' && (
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-white px-4 py-3 text-sm shadow">
              <span className="font-medium text-gray-700">Your subscription contract:</span>
              <Link to="/admin/dpa" className="font-medium text-blue-600 hover:underline">Data Processing Agreement</Link>
              <Link to="/terms" className="font-medium text-blue-600 hover:underline">General Terms of Service</Link>
              <Link to="/privacy" className="font-medium text-blue-600 hover:underline">Privacy Policy</Link>
            </div>
          )}

          {/* System Overview Controls - Above Stats */}
          {activeTab === 'overview' && (
            <div className="mb-6">
              <div className="bg-white shadow rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">System Overview and Statistics</h2>
                    <p className="text-sm text-gray-600">Monitor system health and refresh data</p>
                  </div>
                  <button
                    onClick={refreshAllData}
                    disabled={companiesLoading || rolesLoading || dropdownsLoading || ticketsLoading || usersLoading || ticketTypesLoading}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed border border-green-200"
                    title="Refresh all data"
                  >
                    <Icons.Refresh size={16} className={`mr-2 ${(companiesLoading || rolesLoading || dropdownsLoading || ticketsLoading || usersLoading || ticketTypesLoading) ? 'animate-spin' : ''}`} />
                    Refresh All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Stats - Re-arranged */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {/* Companies (Active Companies) */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Companies</p>
                  <p className="text-3xl font-bold text-gray-900">{getCompanyStats().count}</p>
                </div>
                <Icons.Company size={32} className="text-purple-600" />
              </div>
              <div className="mt-4 text-sm text-gray-500">
                {getCompanyStats().active}
              </div>
            </div>

            {/* Total Users (Total Active Users) */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{getUserStats().total}</p>
                </div>
                <Icons.User size={32} className="text-blue-600" />
              </div>
              <div className="mt-4 text-sm text-gray-500">
                {getUserStats().activeThisMonth}
              </div>
            </div>

            {/* Ticket Types (Total Active Ticket Types) */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Ticket Types</p>
                  <p className="text-3xl font-bold text-gray-900">{getTicketTypeStats().total}</p>
                </div>
                <Icons.Workflow size={32} className="text-green-600" />
              </div>
              <div className="mt-4 text-sm text-gray-500">
                {getTicketTypeStats().mostActive}
              </div>
            </div>

            {/* API Health */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">API Health</p>
                  <div className="flex items-center space-x-2">
                    <p className={`text-3xl font-bold ${
                      apiHealth.status === 'healthy' ? 'text-green-600' :
                      apiHealth.status === 'loading' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {apiHealth.status === 'healthy' ? '✓' :
                       apiHealth.status === 'loading' ? '⟳' : '✗'}
                    </p>
                    {apiHealth.code && (
                      <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {apiHealth.code}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  {apiHealth.status === 'healthy' && <Icons.Success size={32} className="text-green-600" />}
                  {apiHealth.status === 'loading' && <Icons.Loading size={32} className="text-yellow-600 animate-spin" />}
                  {apiHealth.status === 'error' && <Icons.Error size={32} className="text-red-600" />}
                  <button
                    onClick={refreshAllData}
                    disabled={apiHealth.status === 'loading'}
                    className="p-1 text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                    title="Refresh all data"
                  >
                    <Icons.Refresh size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">{apiHealth.message}</p>
                {apiHealth.status === 'error' && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm font-medium text-red-800">{apiHealth.details}</p>
                    <p className="text-xs text-red-600 mt-1">💡 {apiHealth.solution}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* API Error Banner */}
          {apiHealth.status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Icons.Error size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-800">
                    Apps Script API Error ({apiHealth.code})
                  </h3>
                  <div className="mt-1 text-sm text-red-700">
                    <p><strong>{apiHealth.type}:</strong> {apiHealth.message}</p>
                    <p className="mt-1"><strong>Details:</strong> {apiHealth.details}</p>
                    <p className="mt-1"><strong>Solution:</strong> {apiHealth.solution}</p>
                  </div>
                  <div className="mt-3 flex space-x-3">
                    <button
                      onClick={refreshAllData}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Icons.Refresh size={14} className="mr-1" />
                      Retry Connection
                    </button>
                    <a
                      href="https://script.google.com/home"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Icons.ExternalLink size={14} className="mr-1" />
                      Check Apps Script
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Navigation Tabs */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex flex-wrap gap-2 sm:space-x-8 sm:gap-0 px-4 sm:px-6" aria-label="Tabs">
                {adminTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && handleTabSelect(tab.id)}
                    className={`py-3 px-2 sm:py-4 sm:px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors duration-200 flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : tab.disabled
                        ? 'border-transparent text-gray-400 cursor-not-allowed'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    disabled={tab.disabled}
                  >
                    <tab.icon size={16} />
                    <span>{tab.name}</span>
                    {tab.disabled && (
                      <Icons.Clock size={14} className="text-gray-400" />
                    )}
                  </button>
                ))}
              </nav>

              {/* Sub-tab Navigation */}
              {(() => {
                const currentTab = adminTabs.find(t => t.id === activeTab);
                if (currentTab?.hasSubTabs && currentTab.subTabs.length > 0) {
                  return (
                    <div className="px-4 sm:px-6 py-2 bg-gray-50 border-t border-gray-100">
                      <nav className="flex space-x-6" aria-label="Sub Tabs">
                        {currentTab.subTabs.map((subTab) => (
                          <button
                            key={subTab.id}
                            onClick={() => !subTab.disabled && setActiveSubTab(subTab.id)}
                            className={`py-2 px-3 text-sm font-medium rounded-md transition-colors duration-200 ${
                              activeSubTab === subTab.id
                                ? 'bg-blue-100 text-blue-700'
                                : subTab.disabled
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                            }`}
                            disabled={subTab.disabled}
                          >
                            {subTab.name}
                            {subTab.disabled && (
                              <Icons.Clock size={12} className="ml-1 inline text-gray-400" />
                            )}
                          </button>
                        ))}
                      </nav>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Tab Description */}
            <div className="px-6 py-3 bg-gray-50">
              <p className="text-sm text-gray-600">
                {(() => {
                  const currentTab = adminTabs.find(tab => tab.id === activeTab);
                  if (currentTab?.hasSubTabs && activeSubTab) {
                    const currentSubTab = currentTab.subTabs.find(st => st.id === activeSubTab);
                    return currentSubTab?.description || currentTab.description;
                  }
                  return currentTab?.description;
                })()}
              </p>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white shadow rounded-lg p-6">
            {activeTab === 'overview' ? (
              <div className="space-y-6">
                {/* API Connection Status */}
                <APIConnectionStatus />

                {/* Admin Stats - with toggle */}
                {DEV_CONFIG.STATS_DISPLAY.SHOW_MODULE_STATS && (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {adminTabs.filter(tab => tab.component || tab.hasSubTabs).map((tab) => (
                      <div
                        key={tab.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
                        onClick={() => handleTabSelect(tab.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <tab.icon size={24} className="text-blue-600" />
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {tab.name}
                              </h3>
                              <p className="mt-1 text-sm text-gray-600">
                                {tab.description}
                              </p>
                            </div>
                          </div>
                          <Icons.ChevronRight size={20} className="text-gray-400" />
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm text-gray-500">
                            {getModuleStats(tab.id)}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Available
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Coming Soon Modules */}
                    {adminTabs.filter(tab => tab.disabled).map((tab) => (
                      <div key={tab.id} className="bg-gray-50 border border-gray-200 rounded-lg p-6 opacity-60">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <tab.icon size={24} className="text-gray-400" />
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {tab.name}
                              </h3>
                              <p className="mt-1 text-sm text-gray-600">
                                {tab.description}
                              </p>
                            </div>
                          </div>
                          <Icons.Clock size={20} className="text-gray-400" />
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm text-gray-500">Coming Soon</span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Phase 6+
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              (() => {
                const Component = getActiveComponent();
                return Component ? <Component /> : (
                  <div className="text-center py-12">
                    <Icons.Clock size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
                    <p className="text-gray-600">This feature will be available in a future update.</p>
                  </div>
                );
              })()
            )}
          </div>

          {/* Backend Integration Status - Collapsible.
              FLAG (unified migration plan step 3.6, user 9 Nov 2026): the text below is fixed and says Apps Script.
              Once the core is off Apps Script, show each organization's data store from the server (x-backend: pg =
              Postgres; Sheets-option organizations keep "Google Sheets + Apps Script" with their bridge status). */}
          {DEV_CONFIG.STATS_DISPLAY.SHOW_BACKEND_INFO && (
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg">
              <button
                onClick={() => setShowBackendInfo(!showBackendInfo)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-blue-100 transition-colors duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="flex items-center space-x-3">
                  <Icons.Info size={24} className="text-blue-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-blue-800">
                      Backend Integration Status
                    </h3>
                    <p className="text-sm text-blue-600">
                      {showBackendInfo ? 'Click to collapse' : 'Click to expand backend details'}
                    </p>
                  </div>
                </div>
                <Icons.ChevronDown
                  size={20}
                  className={`text-blue-600 transition-transform duration-200 ${
                    showBackendInfo ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {showBackendInfo && (
                <div className="px-6 pb-6 border-t border-blue-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-4">
                    <div>
                      <p className="font-medium text-blue-700">✅ Available APIs:</p>
                      <ul className="mt-2 space-y-1 text-blue-600">
                        <li>• Companies CRUD</li>
                        <li>• Roles CRUD</li>
                        <li>• Dropdown Lists CRUD</li>
                        <li>• User Management</li>
                        <li>• Universal Entity Architecture</li>
                        <li>• Ticket Creation & Workflows</li>
                        <li>• Custom Fields System</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-blue-700">🚧 Implementation Status:</p>
                      <ul className="mt-2 space-y-1 text-blue-600">
                        <li>• Google Apps Script: Production Ready</li>
                        <li>• Frontend Integration: Phase 10.1</li>
                        <li>• Universal Entity Architecture: Complete</li>
                        <li>• Admin Interface: Phase 10.1</li>
                        <li>• Testing Infrastructure: Complete</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminPage;