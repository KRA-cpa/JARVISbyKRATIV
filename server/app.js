/**
 * server/app.js - the Daloy production server for Google Cloud Run (asia-southeast1, Singapore).
 *
 * User decision (8 Nov 2026, session 61523343): production moves off Vercel to Cloud Run behind Firebase Hosting at
 * daloy.blueknight.xyz; Vercel keeps the previews. See docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md.
 *
 * What it serves:
 *   /api/appscript-proxy  the SAME handler Vercel runs (api/_lib/proxyCore.js: Firebase token check, identity fields
 *                          stripped, PROXY_SECRET added, forwarded to Apps Script) - nothing re-implemented
 *   /healthz              liveness for Cloud Run (no auth, no Apps Script call)
 *   everything else       the React build (optional: Firebase Hosting serves the site in production; serving it here
 *                          too lets a tagged Cloud Run revision be tested on its own URL)
 * Later (Postgres migration): /api/rpc mounts here next to the proxy (PLAN_Migration_NeonVercel_20261030.md §2).
 *
 * Dependencies: express + jose, both already in the root package.json (no new packages).
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const { createProxyHandler } = require('../api/_lib/proxyCore');

/** Vercel's request body limit (4.5 MB) - kept so both hosts accept the same requests. */
const BODY_LIMIT = '4.5mb';
const PROXY_PATH = '/api/appscript-proxy';

/**
 * Build the Express app.
 * @param {Object} options
 * @param {Object} [options.env] - environment (default process.env)
 * @param {string|null} [options.buildDir] - the React build folder; null = API only
 * @param {Function} [options.proxyHandler] - (req, res) handler for the proxy route (tests inject a fake)
 * @returns {import('express').Express}
 */
function createApp({ env = process.env, buildDir = path.join(__dirname, '..', 'build'), proxyHandler = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Behind Cloud Run / Firebase Hosting: trust the first proxy so req.ip and req.protocol are the client's
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

  // API answers are per user: never cached by Firebase Hosting's CDN or the browser
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // The proxy reads req.body as a string (or object) and req.query for GET - the same shape Vercel passes
  const handler = proxyHandler || createProxyHandler({ env });
  app.all(PROXY_PATH, express.text({ type: () => true, limit: BODY_LIMIT }), (req, res) => {
    Promise.resolve(handler(req, res)).catch(error => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, status: 'error', error: 'Server error', details: error.message });
      }
    });
  });

  // Unknown API paths answer as JSON, never with the SPA's index.html
  app.all('/api/*splat', (req, res) => res.status(404).json({ success: false, status: 'error', error: 'Not found' }));

  if (buildDir && fs.existsSync(path.join(buildDir, 'index.html'))) {
    // Hashed bundles never change: cache for a year. Everything else (index.html, manifest, favicons) revalidates.
    app.use('/static', express.static(path.join(buildDir, 'static'), { immutable: true, maxAge: '365d', index: false }));
    app.use(express.static(buildDir, { index: false, maxAge: 0 }));
    // SPA fallback for GET / HEAD only (Express 5: '/{*splat}' also matches '/'); express.static refuses ../ paths
    app.get('/{*splat}', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(buildDir, 'index.html'));
    });
  }

  app.use((req, res) => res.status(404).json({ success: false, status: 'error', error: 'Not found' }));
  // Body too large / malformed: JSON error in the API's shape
  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = error.status || error.statusCode || 500;
    res.status(status).json({ success: false, status: 'error', error: status === 413 ? 'Request too large' : 'Bad request' });
  });

  return app;
}

module.exports = { createApp, PROXY_PATH, BODY_LIMIT };
