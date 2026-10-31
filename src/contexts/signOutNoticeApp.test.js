/**
 * Same as signOutNotice.test.js, through the real <App /> (providers, routes, DarkModeProvider, dashboard).
 */
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';

let mockAuthCallback = null;
const mockFakeUser = { uid: 'uid_stranger', email: 'stranger@example.com', getIdToken: async () => 'token' };

jest.mock('../config/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('../config/development', () => ({
  __esModule: true,
  default: { DISABLE_AUTH: false, ALLOW_DIRECT_ACCESS: false, SHOW_API_PANEL: false, SHOW_DEBUG_INFO: false, USE_MOCK_DATA: false,
    STATS_DISPLAY: {} },
  MOCK_USER: {}
}));
jest.mock('@vercel/speed-insights/react', () => ({ SpeedInsights: () => null }), { virtual: true });
jest.mock('firebase/auth', () => {
  const { auth } = require('../config/firebase');
  return {
    onAuthStateChanged: (_auth, cb) => { mockAuthCallback = cb; setTimeout(() => cb(null), 0); return () => {}; },
    GoogleAuthProvider: function GoogleAuthProvider() { this.setCustomParameters = () => {}; },
    signInWithPopup: async () => { auth.currentUser = mockFakeUser; setTimeout(() => mockAuthCallback(mockFakeUser), 0); return { user: mockFakeUser }; },
    signOut: async () => { auth.currentUser = null; setTimeout(() => mockAuthCallback(null), 0); }
  };
});

// eslint-disable-next-line import/first
import App from '../App';

test('real App: NOT_INVITED -> back on /login with the invite message', async () => {
  global.fetch = jest.fn(async () => ({
    ok: true, status: 200, statusText: 'OK',
    json: async () => ({ success: false, status: 'error', code: 'NOT_INVITED',
      error: "Your account isn't set up yet. Ask your administrator for an invite." })
  }));
  window.history.pushState({}, '', '/login');
  render(<App />);
  await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  await act(async () => { fireEvent.click(await screen.findByText('Sign in with Google')); });
  await act(async () => { await new Promise(r => setTimeout(r, 300)); });
  console.info('PATH', window.location.pathname, 'NOTICE KEY', window.sessionStorage.getItem('jarvis_session_notice'));
  expect(screen.queryByText(/Your account isn't set up yet/)).toBeTruthy();
});
