# Daloy production image for Google Cloud Run (asia-southeast1). Guide: docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md
# The React app is built BEFORE the image (scripts/deploy-cloudrun.sh runs `npm run build` with the production
# REACT_APP_* values from .env.production.local), so the image holds only the server, the proxy core and the build.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Runtime dependencies at /app so both server/ and api/_lib/ resolve them (express, jose - versions in server/package.json)
COPY server/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server/app.js server/index.js server/cronSync.js ./server/
COPY api/_lib/ ./api/_lib/
# Migration 1.1: the Sheet -> Neon sync behind /api/cron/sync (server/cronSync.js) - the same code as `npm run
# db:sync-sheets`; TABLE_SCHEMAS as JSON (scripts/deploy-cloudrun.sh writes server/table-schemas.json from the newest
# APPSCRIPT file), so no Apps Script source goes into the image
COPY server/table-schemas.json ./server/
COPY scripts/gen-ddl.js scripts/db-load-sheets.js scripts/db-migrate.js ./scripts/
COPY scripts/db/ddl-rules.js ./scripts/db/
COPY scripts/lib/sheetsExport.js scripts/lib/sheetsSync.js scripts/lib/syncRun.js scripts/lib/companyScope.js ./scripts/lib/
COPY build/ ./build/

USER node
EXPOSE 8080
CMD ["node", "server/index.js"]
