import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Configuration
import DEV_CONFIG from './config/development';

// Context Providers
import { UserProvider, useUser } from './contexts/UserContext';
import { DarkModeProvider } from './contexts/DarkModeContext';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import AdminTicketTypeCreatePage from './pages/AdminTicketTypeCreatePage';
import AdminCustomFieldCreatePage from './pages/AdminCustomFieldCreatePage';
import AdminRoleTypeCreatePage from './pages/AdminRoleTypeCreatePage';
import AdminUserProfileTypeCreatePage from './pages/AdminUserProfileTypeCreatePage';
import ProfilePage from './pages/ProfilePage';
import TicketsPage from './pages/TicketsPage';
import ReportsPage from './pages/ReportsPage';
import PlansPage from './pages/PlansPage';

// Shared Components
import LoadingScreen from './components/shared/LoadingScreen';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ErrorBoundary130, { useError130Detection } from './components/shared/ErrorBoundary130';
import DevPanel from './components/shared/DevPanel';

// Smart Redirect Component for Root Route
const SmartRedirect = () => {
  const { isAuthenticated, loading } = useUser();

  // Skip authentication check in development mode or when direct access is allowed
  if (DEV_CONFIG.DISABLE_AUTH || DEV_CONFIG.ALLOW_DIRECT_ACCESS) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show loading while checking authentication
  if (loading) {
    return <LoadingScreen />;
  }

  // Redirect based on authentication status
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  } else {
    return <Navigate to="/login" replace />;
  }
};

// Protected Route Component with Development Toggle
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, loading } = useUser();

  // Skip authentication in development mode or when direct access is allowed
  if (DEV_CONFIG.DISABLE_AUTH || DEV_CONFIG.ALLOW_DIRECT_ACCESS) {
    return children;
  }

  // Original authentication logic for production
  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

// Public Route Component with Development Toggle
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useUser();

  // Skip authentication in development mode
  if (DEV_CONFIG.DISABLE_AUTH) {
    return children;
  }

  // Original authentication logic for production
  if (loading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// App Routes Component (needs to be inside UserProvider)
const AppRoutes = () => {
  // Global Error #130 detection hook
  useError130Detection();

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tickets"
            element={
              <ProtectedRoute>
                <TicketsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* v10.2: the plan catalogue (any signed-in user) */}
          <Route
            path="/plans"
            element={
              <ProtectedRoute>
                <PlansPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Admin Sub-Pages */}
          <Route
            path="/admin/ticket-types/create"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminTicketTypeCreatePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/custom-fields/create"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminCustomFieldCreatePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/custom-fields/:id/edit"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminCustomFieldCreatePage />
              </ProtectedRoute>
            }
          />

          {/* Universal Entity Architecture Routes */}
          <Route
            path="/admin/role-types/create"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminRoleTypeCreatePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/role-types/:id/edit"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminRoleTypeCreatePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/user-profile-types/create"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminUserProfileTypeCreatePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/user-profile-types/:id/edit"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminUserProfileTypeCreatePage />
              </ProtectedRoute>
            }
          />

          {/* Unauthorized Access Page */}
          <Route
            path="/unauthorized"
            element={<UnauthorizedPage />}
          />

          {/* Default Route - Smart Redirect */}
          <Route
            path="/"
            element={<SmartRedirect />}
          />

          {/* Catch-all route */}
          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />
        </Routes>

        {/* Development Panel */}
        <DevPanel />
      </div>
    </Router>
  );
};

// Wrapper to provide user context to DarkModeProvider
const AppWithProviders = () => {
  const { user } = useUser();

  return (
    <DarkModeProvider user={user}>
      <AppRoutes />
    </DarkModeProvider>
  );
};

// Main App Component
function App() {
  return (
    <ErrorBoundary130>
      <ErrorBoundary>
        <UserProvider>
          <AppWithProviders />
          <SpeedInsights />
        </UserProvider>
      </ErrorBoundary>
    </ErrorBoundary130>
  );
}

export default App;