/**
 * server/index.js - start the Daloy server (Cloud Run sets PORT, default 8080).
 * Local try-out: `npm run build` then `node server/index.js` (needs APPS_SCRIPT_URL / PROXY_SECRET / AUTH_MODE /
 * FIREBASE_PROJECT_ID in the environment, the same variables as the Vercel proxy).
 */

const { createApp } = require('./app');

const port = Number(process.env.PORT) || 8080;
const server = createApp().listen(port, () => {
  console.log(JSON.stringify({ event: 'listening', port, auth_mode: process.env.AUTH_MODE || 'warn' }));
});

// Cloud Run sends SIGTERM before stopping an instance: finish open requests, then exit
process.on('SIGTERM', () => server.close(() => process.exit(0)));
