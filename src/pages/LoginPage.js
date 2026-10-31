import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { takeSessionNotice } from '../utils/sessionGuard';
import Icons from '../components/shared/Icons';
import LoadingScreen from '../components/shared/LoadingScreen';

const LoginPage = () => {
  const navigate = useNavigate();
  const { signInWithGoogle, loading, error, clearError, isAuthenticated, user } = useUser();
  const [isSigningIn, setIsSigningIn] = useState(false);
  // v9.6: why the app signed the user out (idle, 12-hour cap, not invited, deactivated) - shown once
  const [notice, setNotice] = useState(null);

  // Re-checked when the auth state settles too: an idle / refused session can end after this page mounted
  useEffect(() => {
    const pending = takeSessionNotice();
    if (pending) setNotice(pending);
  }, [isAuthenticated, loading]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      clearError();
      setNotice(null);
      await signInWithGoogle();
      // Navigation will be handled by the useEffect above
    } catch (error) {
      console.error('Sign in failed:', error);
      setIsSigningIn(false);
    }
  };

  // Show loading screen during initial auth check
  if (loading && !error) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <Icons.Ticket size={48} className="text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            TicketFlow
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ticketing & Workflow Orchestration System
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Please sign in to continue
          </p>
        </div>

        {/* v9.6: session notice (only after the app ended the session) */}
        {notice && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4" role="status">
            <div className="flex items-center space-x-2">
              <Icons.Info size={20} className="text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">{notice.message}</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Icons.Error size={20} className="text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Sign In Error
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  {error}
                </p>
              </div>
            </div>
            <button
              onClick={clearError}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Sign In Form */}
        <div className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="group relative w-full flex justify-center items-center space-x-3 py-3 px-4 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isSigningIn ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                By signing in, you agree to our terms of service
              </p>
            </div>
          </div>

          {/* Features Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Icons.Info size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  System Features
                </h3>
                <ul className="mt-2 text-sm text-blue-700 space-y-1">
                  <li>• Multi-tenant ticket management</li>
                  <li>• Dynamic workflow orchestration</li>
                  <li>• Role-based access control</li>
                  <li>• Real-time Philippine Time (UTC+8)</li>
                  <li>• Comprehensive audit logging</li>
                </ul>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>System Status: Online</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Powered by Google Workspace & Firebase
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;