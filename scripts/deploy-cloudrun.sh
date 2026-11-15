#!/usr/bin/env bash
# deploy-cloudrun.sh v1.4 - build the React app and deploy Daloy to Google Cloud Run (asia-southeast1, Singapore).
# v1.1 (9 Nov 2026): servers in project krativ-daloy; sign-in (Firebase Auth) stays in jarvisbyerp until Better Auth
#   (unified plan D12) - the two project ids are separate settings, checked against .env.production.local.
# v1.2 (9 Nov 2026): no Git Bash path rewriting of REACT_APP_API_BASE_URL; REACT_APP_HOSTING=cloudrun (/status lists
#   Google only); the build is checked for both before deploying.
# v1.3 (15 Nov 2026): keeps the live forced sign-out cutoff SESSIONS_VALID_AFTER (scripts/revoke-sessions.sh) - --set-env-vars
#   replaces every variable, so without this a deploy right after a forced sign-out would let the old sign-ins back in.
# v1.4 (16 Nov 2026): migration 1.1 - the Sheet -> Neon production sync at /api/cron/sync (server/cronSync.js): secret
#   daloy-db-prod-url -> SYNC_DATABASE_URL (NOT DATABASE_URL: /api/rpc stays on Apps Script until 1.2), SYNC_SHEET_ID,
#   TS_UTC_SINCE, CRON_INVOKER, CRON_AUDIENCE; server/table-schemas.json written from the newest APPSCRIPT file.
#   SKIP_HOSTING=1 with `production`: route Cloud Run only, leave the website on Firebase Hosting as it is.
# Guide: docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md
#
# Usage (Git Bash, from the repo root, after `gcloud auth login` and `firebase login`):
#   AUTH_MODE=<off|warn|enforce> scripts/deploy-cloudrun.sh test <tag>   # new revision with NO traffic, own URL:
#                                                                        #   https://<tag>---daloy-<hash>.<region>.run.app
#   AUTH_MODE=<off|warn|enforce> scripts/deploy-cloudrun.sh production   # all traffic to the new revision, then
#                                                                        #   firebase deploy --only hosting (daloy.blueknight.xyz)
# AUTH_MODE is required on purpose: copy the value production uses today (Vercel -> Settings -> Environment Variables),
# so a deploy can never quietly weaken the sign-in check. Secrets come from Secret Manager (never on the command line):
#   daloy-proxy-secret     -> PROXY_SECRET   (same value as Vercel's and the Apps Script Script Property)
#   daloy-apps-script-url  -> APPS_SCRIPT_URL
set -euo pipefail

PROJECT="${GCP_PROJECT:-krativ-daloy}"                # servers: Cloud Run, Firebase Hosting, Secret Manager
AUTH_PROJECT="${FIREBASE_AUTH_PROJECT:-jarvisbyerp}"  # sign-in: the Firebase project that issues the ID tokens
REGION="asia-southeast1"
SERVICE="daloy"
# Migration 1.1 sync settings (not secrets - PLAN_Migration_Unified 1.1)
SYNC_SHEET_ID="${SYNC_SHEET_ID:-1EjFpr_yktSU6QAeBSAvcr6iWVtmaOCV1t5unvImmot4}"
TS_UTC_SINCE="${TS_UTC_SINCE:-2026-10-31T08:13:50.821Z}"
CRON_INVOKER="daloy-scheduler@${PROJECT}.iam.gserviceaccount.com"

MODE="${1:-}"
TAG="${2:-}"

case "${AUTH_MODE:-}" in
  off|warn|enforce) ;;
  *) echo "AUTH_MODE must be off, warn or enforce (copy production's value from Vercel)." >&2; exit 2 ;;
esac

case "$MODE" in
  test)
    if ! [[ "$TAG" =~ ^[a-z][a-z0-9-]{0,40}$ ]]; then
      echo "Usage: AUTH_MODE=... $0 test <tag>  (tag: lowercase letters, digits, dashes)" >&2; exit 2
    fi ;;
  production) ;;
  *) echo "Usage: AUTH_MODE=... $0 test <tag> | production" >&2; exit 2 ;;
esac

command -v gcloud >/dev/null || { echo "gcloud CLI not found (https://cloud.google.com/sdk/docs/install)." >&2; exit 2; }
if [ "$MODE" = "production" ]; then
  command -v firebase >/dev/null || { echo "firebase CLI not found: npm install -g firebase-tools" >&2; exit 2; }
fi
[ -f .env.production.local ] || { echo ".env.production.local missing (the production REACT_APP_* values)." >&2; exit 2; }
# The browser signs in with the Firebase project in .env.production.local; the server must check tokens for that same
# project, or every sign-in fails with a 401.
ENV_AUTH_PROJECT="$(grep -E '^REACT_APP_FIREBASE_PROJECT_ID=' .env.production.local | tail -n 1 | cut -d= -f2- | tr -d "\r\"' ")"
if [ "$ENV_AUTH_PROJECT" != "$AUTH_PROJECT" ]; then
  echo "Sign-in project mismatch: .env.production.local has '$ENV_AUTH_PROJECT', FIREBASE_AUTH_PROJECT is '$AUTH_PROJECT'." >&2
  exit 2
fi

echo "1/3 Building the React app (production values, API on the same origin)..."
# Shell env wins over .env files in Create React App: the API goes to this host's /api/appscript-proxy.
# Git Bash rewrites env values that look like Unix paths for Windows programs ("/api/x" -> "C:/Program Files/Git/api/x"),
# which broke every API call of the first test revision (9 Nov 2026) - turn that off for the build, then check the result.
API_BASE="/api/appscript-proxy"
# REACT_APP_HOSTING=cloudrun: the /status page lists Google only (src/config/site.js STATUS).
MSYS_NO_PATHCONV=1 MSYS2_ENV_CONV_EXCL="REACT_APP_" REACT_APP_API_BASE_URL="$API_BASE" REACT_APP_HOSTING="cloudrun" \
  npm run build
if ! grep -q "REACT_APP_API_BASE_URL:\"$API_BASE\"" build/static/js/main.*.js; then
  echo "The build does not use the API address $API_BASE (path rewritten?) - not deploying." >&2
  exit 3
fi
if ! grep -q 'REACT_APP_HOSTING:"cloudrun"' build/static/js/main.*.js; then
  echo "The build is missing REACT_APP_HOSTING=cloudrun - not deploying." >&2
  exit 3
fi

# TABLE_SCHEMAS for the sync in the image (the Apps Script source itself stays out of it)
node -e 'const g=require("./scripts/gen-ddl");const fs=require("fs");fs.writeFileSync("server/table-schemas.json",JSON.stringify(g.loadTableSchemas(fs.readFileSync(g.newestAppScript(),"utf8"))))'
[ -s server/table-schemas.json ] || { echo "server/table-schemas.json was not written - not deploying." >&2; exit 3; }

# The scheduler's token is checked against the service URL (the audience Cloud Scheduler signs for)
CRON_AUDIENCE="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
[ -n "$CRON_AUDIENCE" ] || { echo "Could not read the service URL for CRON_AUDIENCE." >&2; exit 3; }

# The forced sign-out cutoff in force now (empty when none) - carried into the new revision unless given explicitly
if [ -z "${SESSIONS_VALID_AFTER+x}" ]; then
  SESSIONS_VALID_AFTER="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format=json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const e=(JSON.parse(s).spec.template.spec.containers[0].env||[]).find(v=>v.name==="SESSIONS_VALID_AFTER");process.stdout.write(e&&e.value?e.value:"")}catch(_){}})')"
fi
ENV_VARS="AUTH_MODE=$AUTH_MODE,FIREBASE_PROJECT_ID=$AUTH_PROJECT,MAX_SESSION_HOURS=${MAX_SESSION_HOURS:-12}"
ENV_VARS="$ENV_VARS,SYNC_SHEET_ID=$SYNC_SHEET_ID,TS_UTC_SINCE=$TS_UTC_SINCE,CRON_INVOKER=$CRON_INVOKER,CRON_AUDIENCE=$CRON_AUDIENCE"
if [ -n "$SESSIONS_VALID_AFTER" ]; then
  echo "    keeping the forced sign-out cutoff SESSIONS_VALID_AFTER=$SESSIONS_VALID_AFTER"
  ENV_VARS="$ENV_VARS,SESSIONS_VALID_AFTER=$SESSIONS_VALID_AFTER"
fi

echo "2/3 Deploying $SERVICE to Cloud Run ($REGION, $MODE)..."
DEPLOY_ARGS=(
  run deploy "$SERVICE"
  --source .
  --project "$PROJECT"
  --region "$REGION"
  --allow-unauthenticated
  --set-secrets "PROXY_SECRET=daloy-proxy-secret:latest,APPS_SCRIPT_URL=daloy-apps-script-url:latest,SYNC_DATABASE_URL=daloy-db-prod-url:latest"
  --set-env-vars "$ENV_VARS"
  --min-instances 0
  --max-instances 3
  --cpu 1
  --memory 512Mi
  --timeout 60
  --concurrency 80
)
if [ "$MODE" = "test" ]; then
  # --no-traffic is refused when the service is created; the very first deploy takes the traffic (nothing points at
  # the service yet - Firebase Hosting and the domain come later)
  if gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" >/dev/null 2>&1; then
    DEPLOY_ARGS+=(--no-traffic)
  fi
  DEPLOY_ARGS+=(--tag "$TAG")
fi
gcloud "${DEPLOY_ARGS[@]}"

if [ "$MODE" = "test" ]; then
  echo "3/3 Test revision ready (no traffic). Its URL:"
  gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" \
    --format="value(status.traffic[].url)" | tr ';' '\n' | grep -- "$TAG---" || true
  echo "Add that host to Firebase -> project $AUTH_PROJECT -> Authentication -> Settings -> Authorized domains to sign in on it."
  exit 0
fi

echo "3/3 Routing all traffic to the new revision and publishing Firebase Hosting..."
gcloud run services update-traffic "$SERVICE" --project "$PROJECT" --region "$REGION" --to-latest
if [ "${SKIP_HOSTING:-}" = "1" ]; then
  echo "SKIP_HOSTING=1: Firebase Hosting (the website) left as it is - only the server changed."
  exit 0
fi
firebase deploy --only hosting --project "$PROJECT"
echo "Done: https://daloy.blueknight.xyz (and https://$PROJECT.web.app)."
