/**
 * server/index.js - start the Daloy server (Cloud Run sets PORT, default 8080).
 * Local try-out: `npm run build` then `node server/index.js` (needs APPS_SCRIPT_URL / PROXY_SECRET / AUTH_MODE /
 * FIREBASE_PROJECT_ID in the environment, the same variables as the Vercel proxy; DATABASE_URL optional - /api/rpc).
 */

const { createApp } = require('./app');

const port = Number(process.env.PORT) || 8080;
const server = createApp().listen(port, () => {
  // database: whether /api/rpc can answer from Postgres - never the URL itself
  console.log(JSON.stringify({ event: 'listening', port, auth_mode: process.env.AUTH_MODE || 'warn',
    database: process.env.DATABASE_URL ? 'configured' : 'none' }));
});

// Cloud Run sends SIGTERM before stopping an instance: finish open requests, then exit
process.on('SIGTERM', () => server.close(() => process.exit(0)));
