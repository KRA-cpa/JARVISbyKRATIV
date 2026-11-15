#!/usr/bin/env bash
# revoke-sessions.sh v1.0 (15 Nov 2026) - forced sign-out of EVERY signed-in user of Daloy (production, Cloud Run).
# User, 15 Nov 2026: "ok if we have 12hr limit, but a check of all signed in users and force logout will still be needed".
#
# Sets SESSIONS_VALID_AFTER on the Cloud Run service to now: the server (api/_lib/proxyCore.js createAuthenticator) then
# refuses every sign-in made before that time with SESSION_REVOKED, and the app signs the user out on their next request
# ("You were signed out for a security reason. Please sign in again."). Signing in again works at once.
#   - Needs AUTH_MODE=enforce on the service (warn only drops the uid; the script refuses to run otherwise).
#   - A tab that sends no request keeps showing what it already loaded until its next request.
#   - Creates a new revision (same image, one variable changed) and keeps it on all traffic; scripts/deploy-cloudrun.sh
#     carries the cutoff into later deploys.
#   - Per organization / per user and the list of signed-in users: Platform manager M14 (PLAN_PlatformManager §2).
# Runbook: docs/planning/TEMPLATE_BreachNotice_ProviderIncident_20261115.md §6 stage 5.
#
# Usage (Git Bash, repo root, after `gcloud auth login`):
#   scripts/revoke-sessions.sh            # shows what it would do (dry run)
#   scripts/revoke-sessions.sh --apply    # signs everyone out now
set -euo pipefail

PROJECT="${GCP_PROJECT:-krativ-daloy}"
REGION="asia-southeast1"
SERVICE="daloy"
APPLY="${1:-}"

command -v gcloud >/dev/null || { echo "gcloud CLI not found." >&2; exit 2; }
command -v node >/dev/null || { echo "node not found." >&2; exit 2; }

ENV_JSON="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format=json)"
envvar() {
  printf '%s' "$ENV_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=(JSON.parse(s).spec.template.spec.containers[0].env||[]).find(v=>v.name===process.argv[1]);process.stdout.write(e&&e.value?e.value:"")})' "$1"
}
MODE_NOW="$(envvar AUTH_MODE)"
CUTOFF_NOW="$(envvar SESSIONS_VALID_AFTER)"
# Recorded UTC time (compliance S4); the server reads it as an ISO time with an offset
NEW_CUTOFF="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "Service:      $SERVICE ($PROJECT, $REGION)"
echo "AUTH_MODE:    ${MODE_NOW:-<unset = warn>}"
echo "Cutoff now:   ${CUTOFF_NOW:-<none>}"
echo "New cutoff:   $NEW_CUTOFF (every sign-in before this is signed out)"

if [ "$MODE_NOW" != "enforce" ]; then
  echo "AUTH_MODE is not enforce: a forced sign-out would not refuse anyone. Deploy with AUTH_MODE=enforce first." >&2
  exit 3
fi
if [ "$APPLY" != "--apply" ]; then
  echo "Dry run - nothing changed. Run again with --apply to sign everyone out."
  exit 0
fi

gcloud run services update "$SERVICE" --project "$PROJECT" --region "$REGION" \
  --update-env-vars "SESSIONS_VALID_AFTER=$NEW_CUTOFF"
echo "Done: sign-ins before $NEW_CUTOFF are refused (SESSION_REVOKED). Record the time in the incident record (template §4)."
