import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { clearSessionNotice, takeSessionNotice } from '../utils/sessionGuard';

/**
 * useSignInFlow - the Google sign-in steps shared by the sign-in pages (LoginPageV2 preview, PlatformLoginPage):
 * the one-time session notice (why the app signed the user out), the sign-in itself, and going on to `returnTo` once
 * signed in (also when the page opens with a session already). LoginPage keeps its own copy until v2 replaces it.
 * @param {string} returnTo - where to go after sign-in
 * @returns {{ loading, error, clearError, notice, isSigningIn, signIn }}
 */
const useSignInFlow = returnTo => {
  const navigate = useNavigate();
  const { signInWithGoogle, loading, error, clearError, isAuthenticated, user } = useUser();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [notice, setNotice] = useState(null);

  // Re-checked when the auth state settles: an idle / refused session can end after the page mounted
  useEffect(() => {
    const pending = takeSessionNotice();
    if (pending) setNotice(pending);
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (isAuthenticated && user) navigate(returnTo, { replace: true });
  }, [isAuthenticated, user, navigate, returnTo]);

  const signIn = async () => {
    try {
      setIsSigningIn(true);
      clearError();
      setNotice(null);
      clearSessionNotice();
      await signInWithGoogle();
    } catch (e) {
      console.error('Sign in failed:', e);
      setIsSigningIn(false);
    }
  };

  return { loading, error, clearError, notice, isSigningIn, signIn };
};

export default useSignInFlow;
