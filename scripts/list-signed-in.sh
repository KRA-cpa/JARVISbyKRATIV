#!/usr/bin/env bash
# list-signed-in.sh v1.0 (15 Nov 2026) - who may still be signed in to Daloy (production, Cloud Run), from the request logs.
# Read-only. User, 15 Nov 2026: "a check of all signed in users and force logout will still be needed".
# Counts users whose verified requests carry a sign-in younger than MAX_SESSION_HOURS (12) and not before the forced
# sign-out cutoff (SESSIONS_VALID_AFTER); "active" = a request in the last 60 minutes. Prints uids, not emails.
# Needs the log field signed_in_at (api/_lib/proxyCore.js from 15 Nov 2026): requests served by older revisions are
# not counted. Force sign-out: scripts/revoke-sessions.sh. The console version: Platform manager M15.
#
# Usage (Git Bash, repo root, after `gcloud auth login`):  scripts/list-signed-in.sh
set -euo pipefail

PROJECT="${GCP_PROJECT:-krativ-daloy}"
REGION="asia-southeast1"
SERVICE="daloy"
HOURS="${MAX_SESSION_HOURS:-12}"

command -v gcloud >/dev/null || { echo "gcloud CLI not found." >&2; exit 2; }
CUTOFF="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format=json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=(JSON.parse(s).spec.template.spec.containers[0].env||[]).find(v=>v.name==="SESSIONS_VALID_AFTER");process.stdout.write(e&&e.value?e.value:"")})')"

ARGS=(--hours "$HOURS")
[ -n "$CUTOFF" ] && ARGS+=(--cutoff "$CUTOFF")

gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICE\" AND jsonPayload.auth=\"verified\" AND jsonPayload.signed_in_at:*" \
  --project "$PROJECT" --freshness "${HOURS}h" --format=json --limit 100000 \
  | node scripts/signed-in-users.js "${ARGS[@]}"
