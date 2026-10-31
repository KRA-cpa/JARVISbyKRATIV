/**
 * v9.6 browser check 4 (31 Oct 2026): a Google account with no profile / role / invite signs in. The backend answers
 * NOT_INVITED; the app must sign it out and the login page must say "Your account isn't set up yet…".
 * Real UserContext + LoginPage + src/api/googleSheet.js; Firebase and fetch are faked.
 */
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

let mockAuthCallback = null;
const mockFakeUser = { uid: 'uid_stranger', email: 'stranger@example.com', getIdToken: async () => 'token' };

jest.mock('../config/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('../config/development', () => ({
  __esModule: true,
  default: { DISABLE_AUTH: false, ALLOW_DIRECT_ACCESS: false, STATS_DISPLAY: {} },
  MOCK_USER: {}
}));
jest.mock('firebase/auth', () => {
  const { auth } = require('../config/firebase');
  return {
    onAuthStateChanged: (_auth, cb) => { mockAuthCallback = cb; return () => {}; },
    GoogleAuthProvider: function GoogleAuthProvider() { this.setCustomParameters = () => {}; },
    signInWithPopup: async () => { auth.currentUser = mockFakeUser; await mockAuthCallback(mockFakeUser); return { user: mockFakeUser }; },
    signOut: async () => { auth.currentUser = null; await mockAuthCallback(null); }
  };
});

// eslint-disable-next-line import/first
import { UserProvider, useUser } from './UserContext';
// eslint-disable-next-line import/first
import LoginPage from '../pages/LoginPage';

const Protected = ({ children }) => {
  const { isAuthenticated, loading } = useUser();
  if (loading) return <div>loading</div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};
const Public = ({ children }) => {
  const { isAuthenticated, loading } = useUser();
  if (loading) return <div>loading</div>;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

test('NOT_INVITED: signed out and the login page shows the invite message', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true, status: 200, statusText: 'OK',
    json: async () => ({ success: false, status: 'error', code: 'NOT_INVITED',
      error: "Your account isn't set up yet. Ask your administrator for an invite." })
  }));
  render(
    <UserProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Public><LoginPage /></Public>} />
          <Route path="/dashboard" element={<Protected><div>DASHBOARD</div></Protected>} />
        </Routes>
      </MemoryRouter>
    </UserProvider>
  );
  await act(async () => { await mockAuthCallback(null); });
  await act(async () => { fireEvent.click(await screen.findByText('Sign in with Google')); });
  await act(async () => { await new Promise(r => setTimeout(r, 50)); });
  expect(await screen.findByText(/Your account isn't set up yet/)).toBeTruthy();
  expect(screen.queryByText('DASHBOARD')).toBeNull();
});
