/**
 * Development Configuration
 * Controls feature toggles for development vs production
 */

const DEV_CONFIG = {
  // Authentication bypass for development
  DISABLE_AUTH: process.env.REACT_APP_DISABLE_AUTH === 'true' || process.env.NODE_ENV === 'development',

  // Allow direct access to pages without authentication (for setup phase). Closed by default in production builds
  // (31 Oct 2026: an unset variable left the live site open to anyone); open by default in `npm start` unless 'false'
  ALLOW_DIRECT_ACCESS: process.env.REACT_APP_ALLOW_DIRECT_ACCESS === 'true' ||
    (process.env.NODE_ENV === 'development' && process.env.REACT_APP_ALLOW_DIRECT_ACCESS !== 'false'),

  // API configuration
  USE_MOCK_DATA: process.env.REACT_APP_USE_MOCK_DATA === 'true',

  // Debug features
  SHOW_DEBUG_INFO: process.env.REACT_APP_SHOW_DEBUG === 'true',

  // Development tools
  SHOW_API_PANEL: process.env.REACT_APP_SHOW_API_PANEL === 'true' || process.env.NODE_ENV === 'development',

  // Stats display toggles for live environment
  STATS_DISPLAY: {
    SHOW_USER_COUNT: process.env.REACT_APP_SHOW_USER_COUNT !== 'false',
    SHOW_TICKET_COUNT: process.env.REACT_APP_SHOW_TICKET_COUNT !== 'false',
    SHOW_COMPANY_COUNT: process.env.REACT_APP_SHOW_COMPANY_COUNT !== 'false',
    SHOW_SYSTEM_HEALTH: process.env.REACT_APP_SHOW_SYSTEM_HEALTH !== 'false',
    SHOW_MODULE_STATS: process.env.REACT_APP_SHOW_MODULE_STATS !== 'false',
    SHOW_API_STATUS: process.env.REACT_APP_SHOW_API_STATUS !== 'false',
    SHOW_BACKEND_INFO: process.env.REACT_APP_SHOW_BACKEND_INFO !== 'false'
  },

  // Dashboard card arrangement toggles
  DASHBOARD_CARDS: {
    SHOW_MY_TICKETS: process.env.REACT_APP_SHOW_MY_TICKETS !== 'false',
    SHOW_PENDING_APPROVAL: process.env.REACT_APP_SHOW_PENDING_APPROVAL !== 'false',
    SHOW_COMPLETED: process.env.REACT_APP_SHOW_COMPLETED !== 'false',
    SHOW_OVERDUE: process.env.REACT_APP_SHOW_OVERDUE !== 'false',
    SHOW_FOR_YOUR_APPROVAL: process.env.REACT_APP_SHOW_FOR_YOUR_APPROVAL !== 'false'
  }
};

// Mock user for development when auth is disabled
export const MOCK_USER = {
  uid: 'dev-user-123',
  email: 'admin@development.local',
  displayName: 'Development Admin',
  photoURL: '',
  roles: [
    {
      id: 'dev-role-1',
      name: 'System Admin',
      company_id: null
    }
  ],
  companies: [
    {
      id: 'dev-company-1',
      name: 'Development Company',
      code: 'DEV'
    }
  ]
};

export default DEV_CONFIG;