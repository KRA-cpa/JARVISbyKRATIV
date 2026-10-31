// Vercel API Route: /api/appscript-proxy
// Verifies the caller's Firebase ID token, then forwards the request to Google Apps Script with the verified uid
// and the shared secret (compliance F6, AppScript v9.4+). Logic and tests: api/_lib/proxyCore.js,
// scripts/test-proxy-auth.js. Env: APPS_SCRIPT_URL, PROXY_SECRET, AUTH_MODE, FIREBASE_PROJECT_ID.

const { createProxyHandler } = require('./_lib/proxyCore');

module.exports = createProxyHandler();
