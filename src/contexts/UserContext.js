import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { API, AUTH_EVENT, SIGN_OUT_CODES } from '../api/googleSheet';
import DEV_CONFIG, { MOCK_USER } from '../config/development';
import {
  ACTIVITY_EVENTS, ACTIVITY_WRITE_INTERVAL_MS, clearLastActivity, isIdleExpired, readLastActivity,
  setSessionNotice, writeLastActivity
} from '../utils/sessionGuard';

// User Context
const UserContext = createContext();

// Action Types
const USER_ACTION_TYPES = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_USER_ROLES: 'SET_USER_ROLES',
  SET_USER_COMPANIES: 'SET_USER_COMPANIES',
  SET_CURRENT_COMPANY: 'SET_CURRENT_COMPANY',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  LOGOUT: 'LOGOUT'
};

// Initial State
const initialState = {
  user: null,
  loading: true,
  error: null,
  userRoles: [],
  userCompanies: [],
  currentCompany: null,
  permissions: {},
  isAdmin: false,
  isAuthenticated: false
};

// User Reducer
function userReducer(state, action) {
  switch (action.type) {
    case USER_ACTION_TYPES.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };

    case USER_ACTION_TYPES.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        loading: false,
        error: null
      };

    case USER_ACTION_TYPES.SET_USER_ROLES:
      const roles = action.payload || [];
      const isAdmin = roles.some(role => role.name.toLowerCase().includes('admin'));

      return {
        ...state,
        userRoles: roles,
        isAdmin,
        permissions: calculatePermissions(roles)
      };

    case USER_ACTION_TYPES.SET_USER_COMPANIES:
      const companies = action.payload || [];
      return {
        ...state,
        userCompanies: companies,
        currentCompany: state.currentCompany || (companies.length > 0 ? companies[0] : null)
      };

    case USER_ACTION_TYPES.SET_CURRENT_COMPANY:
      return {
        ...state,
        currentCompany: action.payload
      };

    case USER_ACTION_TYPES.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };

    case USER_ACTION_TYPES.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case USER_ACTION_TYPES.LOGOUT:
      return {
        ...initialState,
        loading: false
      };

    default:
      return state;
  }
}

// Helper function to calculate user permissions
function calculatePermissions(roles) {
  const permissions = {
    canAccessAdmin: false,
    canCreateTickets: false,
    canApproveTickets: false,
    canManageCompanies: false,
    canManageRoles: false,
    canManageTicketTypes: false,
    canViewReports: false,
    canManageDropdowns: false
  };

  roles.forEach(role => {
    const roleName = role.name.toLowerCase();

    switch (roleName) {
      case 'admin':
      case 'global admin':
        // Admins have all permissions
        Object.keys(permissions).forEach(key => {
          permissions[key] = true;
        });
        break;

      case 'manager':
        permissions.canCreateTickets = true;
        permissions.canApproveTickets = true;
        permissions.canViewReports = true;
        break;

      case 'user':
      case 'employee':
        permissions.canCreateTickets = true;
        break;

      case 'approver':
        permissions.canApproveTickets = true;
        permissions.canViewReports = true;
        break;

      case 'finance':
      case 'hr':
      case 'it':
        permissions.canCreateTickets = true;
        permissions.canApproveTickets = true;
        permissions.canViewReports = true;
        break;

      default:
        // Custom roles - basic permissions
        permissions.canCreateTickets = true;
        break;
    }
  });

  return permissions;
}

// User Provider Component
export const UserProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);
  // v9.6: set while the app ends a session itself, so the auth listener doesn't treat it as a new sign-in
  const endingRef = useRef(false);

  /**
   * End the session because of `reason` (IDLE, SESSION_MAX_AGE, SESSION_EXPIRED, NOT_INVITED, ACCOUNT_DISABLED):
   * the login page shows the matching notice once. Protected routes redirect to /login once the user is gone.
   */
  const endSession = React.useCallback(async (reason, serverMessage = '') => {
    if (endingRef.current) return;
    endingRef.current = true;
    setSessionNotice(reason, serverMessage);
    clearLastActivity();
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
    dispatch({ type: USER_ACTION_TYPES.LOGOUT });
    endingRef.current = false;
  }, []);

  // Firebase Auth State Listener with Development Toggle
  useEffect(() => {
    // Use mock user in development mode
    if (DEV_CONFIG.DISABLE_AUTH) {
      console.log('Development mode: Using mock user data');
      dispatch({ type: USER_ACTION_TYPES.SET_USER, payload: MOCK_USER });
      dispatch({ type: USER_ACTION_TYPES.SET_USER_ROLES, payload: MOCK_USER.roles });
      dispatch({ type: USER_ACTION_TYPES.SET_USER_COMPANIES, payload: MOCK_USER.companies });
      dispatch({ type: USER_ACTION_TYPES.SET_CURRENT_COMPANY, payload: MOCK_USER.companies[0] });
      dispatch({ type: USER_ACTION_TYPES.SET_LOADING, payload: false });
      return () => {}; // No cleanup needed for mock user
    }

    // Original Firebase auth logic for production
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // v9.6: reopening the app after more than 60 minutes without activity ends the session (no warning)
        if (isIdleExpired()) {
          await endSession('IDLE');
          return;
        }
        if (readLastActivity() === null) writeLastActivity();
        dispatch({ type: USER_ACTION_TYPES.SET_USER, payload: firebaseUser });

        // Fetch user roles and companies from backend
        await fetchUserData(firebaseUser);

        // Log login to backend
        try {
          await logUserLogin(firebaseUser);
        } catch (error) {
          console.warn('Failed to log user login:', error);
        }
      } else {
        dispatch({ type: USER_ACTION_TYPES.LOGOUT });
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // These functions are stable and don't need to be in the dependency array

  // v9.6: the API layer announces answers that end the sign-in (not invited, deactivated, 12-hour cap, expired)
  useEffect(() => {
    if (DEV_CONFIG.DISABLE_AUTH) return undefined;
    const onAuthCode = (event) => {
      const code = event && event.detail ? event.detail.code : null;
      if (SIGN_OUT_CODES.includes(code) && auth.currentUser) endSession(code, event.detail.message);
    };
    window.addEventListener(AUTH_EVENT, onAuthCode);
    return () => window.removeEventListener(AUTH_EVENT, onAuthCode);
  }, [endSession]);

  // v9.6: idle sign-out after 60 minutes without click / key / scroll / touch / tab focus, shared across tabs
  useEffect(() => {
    if (DEV_CONFIG.DISABLE_AUTH || !state.isAuthenticated) return undefined;
    let lastWrite = 0;
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_INTERVAL_MS) return;
      // Activity in another tab may be newer; the idle check below reads the shared value
      if (isIdleExpired(now)) return;
      lastWrite = now;
      writeLastActivity(now);
    };
    const check = () => {
      if (isIdleExpired()) endSession('IDLE');
    };
    const onFocus = () => {
      check();
      touch();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, touch, { passive: true, capture: true }));
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(check, 60 * 1000);
    return () => {
      ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, touch, { capture: true }));
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [state.isAuthenticated, endSession]);

  // Fetch user roles and companies from backend
  const fetchUserData = React.useCallback(async (user) => {
    try {
      dispatch({ type: USER_ACTION_TYPES.SET_LOADING, payload: true });

      // Fetch user profile with roles and companies from backend
      const userProfile = await API.Users.getProfile(user.uid);

      if (userProfile) {
        // Set user roles
        if (userProfile.roles && userProfile.roles.length > 0) {
          dispatch({ type: USER_ACTION_TYPES.SET_USER_ROLES, payload: userProfile.roles });
        }

        // Set user companies
        if (userProfile.companies && userProfile.companies.length > 0) {
          dispatch({ type: USER_ACTION_TYPES.SET_USER_COMPANIES, payload: userProfile.companies });

          // Set first company as current company if none selected
          if (!state.currentCompany) {
            dispatch({ type: USER_ACTION_TYPES.SET_CURRENT_COMPANY, payload: userProfile.companies[0] });
          }
        }
      } else {
        // If no user profile exists, create a basic user record
        console.warn('No user profile found, user may need to be assigned roles');
        dispatch({ type: USER_ACTION_TYPES.SET_USER_ROLES, payload: [] });
        dispatch({ type: USER_ACTION_TYPES.SET_USER_COMPANIES, payload: [] });
      }

      dispatch({ type: USER_ACTION_TYPES.SET_LOADING, payload: false });

    } catch (error) {
      console.error('Error fetching user data:', error);

      // v9.6: no mock Admin in production. Before, any failure (and so a NOT_INVITED user) got a mock Admin role
      // and company. A sign-in refusal ends the session through the jarvis-auth event; anything else is shown.
      if (!DEV_CONFIG.DISABLE_AUTH) {
        dispatch({ type: USER_ACTION_TYPES.SET_USER_ROLES, payload: [] });
        dispatch({ type: USER_ACTION_TYPES.SET_USER_COMPANIES, payload: [] });
        if (!SIGN_OUT_CODES.includes(error.code)) {
          dispatch({ type: USER_ACTION_TYPES.SET_ERROR, payload: `Could not load your account: ${error.message}` });
        }
        dispatch({ type: USER_ACTION_TYPES.SET_LOADING, payload: false });
        return;
      }

      // Development without auth only: fall back to mock data
      console.warn('Falling back to mock user data (development)');
      const mockRoles = [
        {
          id: 'role_1',
          name: 'Admin',
          company_id: null
        }
      ];

      const mockCompanies = [
        {
          id: 'comp_1',
          name: 'Main Corporation',
          code: 'MAIN'
        }
      ];

      dispatch({ type: USER_ACTION_TYPES.SET_USER_ROLES, payload: mockRoles });
      dispatch({ type: USER_ACTION_TYPES.SET_USER_COMPANIES, payload: mockCompanies });
      dispatch({ type: USER_ACTION_TYPES.SET_CURRENT_COMPANY, payload: mockCompanies[0] });
      dispatch({ type: USER_ACTION_TYPES.SET_LOADING, payload: false });
    }
  }, [state.currentCompany]);

  // Log user login to backend
  const logUserLogin = React.useCallback(async (user) => {
    try {
      await API.System.recordLogin({
        id: user.uid,
        email: user.email,
        ipAddress: 'N/A' // Could get from a service like ipapi.co
      });
      console.log('User login logged successfully');
    } catch (error) {
      console.error('Error logging user login:', error);
    }
  }, []);

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      dispatch({ type: USER_ACTION_TYPES.SET_LOADING, payload: true });
      dispatch({ type: USER_ACTION_TYPES.CLEAR_ERROR });

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      // v9.6: a fresh sign-in starts a fresh idle clock (before the auth listener checks it)
      clearLastActivity();
      const result = await signInWithPopup(auth, provider);
      writeLastActivity();

      // User will be set automatically by the auth state listener
      return result.user;

    } catch (error) {
      let errorMessage = 'Failed to sign in with Google';

      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in cancelled';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup blocked by browser. Please allow popups and try again.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Sign-in cancelled';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = error.message || 'Failed to sign in with Google';
      }

      dispatch({ type: USER_ACTION_TYPES.SET_ERROR, payload: errorMessage });
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    try {
      clearLastActivity();
      await signOut(auth);
      dispatch({ type: USER_ACTION_TYPES.LOGOUT });
    } catch (error) {
      console.error('Error signing out:', error);
      dispatch({ type: USER_ACTION_TYPES.SET_ERROR, payload: 'Failed to sign out' });
    }
  };

  // Switch company context
  const switchCompany = (company) => {
    dispatch({ type: USER_ACTION_TYPES.SET_CURRENT_COMPANY, payload: company });
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: USER_ACTION_TYPES.CLEAR_ERROR });
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    return state.permissions[permission] || false;
  };

  // Check if user can access specific company
  const canAccessCompany = (companyId) => {
    return state.userCompanies.some(company => company.id === companyId);
  };

  // Get user role for specific company
  const getUserRoleForCompany = (companyId) => {
    return state.userRoles.find(role =>
      role.company_id === companyId || role.company_id === null
    );
  };

  const value = {
    // State
    ...state,

    // Actions
    signInWithGoogle,
    logout,
    switchCompany,
    clearError,

    // Utilities
    hasPermission,
    canAccessCompany,
    getUserRoleForCompany
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook to use user context
export const useUser = () => {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }

  return context;
};

// HOC for protected routes
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, loading } = useUser();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      return <div>Access denied. Please sign in.</div>;
    }

    return <Component {...props} />;
  };
};

// HOC for admin-only routes
export const withAdminAuth = (Component) => {
  return function AdminAuthenticatedComponent(props) {
    const { isAuthenticated, isAdmin, loading } = useUser();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      return <div>Access denied. Please sign in.</div>;
    }

    if (!isAdmin) {
      return <div>Access denied. Admin privileges required.</div>;
    }

    return <Component {...props} />;
  };
};

export default UserContext;