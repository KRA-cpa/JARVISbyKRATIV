# Daloy production image for Google Cloud Run (asia-southeast1). Guide: docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md
# The React app is built BEFORE the image (scripts/deploy-cloudrun.sh runs `npm run build` with the production
# REACT_APP_* values from .env.production.local), so the image holds only the server, the proxy core and the build.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Runtime dependencies at /app so both server/ and api/_lib/ resolve them (express, jose - versions in server/package.json)
COPY server/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server/app.js server/index.js ./server/
COPY api/_lib/ ./api/_lib/
COPY build/ ./build/

USER node
EXPOSE 8080
CMD ["node", "server/index.js"]
