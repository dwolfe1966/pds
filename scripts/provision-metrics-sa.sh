#!/usr/bin/env bash
# Provision a read-only service account + key for scripts/metrics.mjs (GA4 + Search Console).
#
# Prereqs (one-time, interactive — I can't do these for you as they auth AS you):
#   1. gcloud installed        →  brew install --cask google-cloud-sdk
#   2. gcloud auth login       →  run `! gcloud auth login` in this session (opens a browser)
#   3. a GCP project selected  →  gcloud config set project <PROJECT_ID>   (any project; create one if needed)
#
# Then run:  bash scripts/provision-metrics-sa.sh
#
# The service account needs NO project IAM roles — it only has to be added as a GA4 "Viewer" (the final
# manual step this script prints). Least privilege by design.
set -euo pipefail

PROJECT="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
[ -z "$PROJECT" ] && { echo "✖ No project. Run: gcloud config set project <PROJECT_ID>"; exit 1; }

SA_NAME="idl-metrics"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
KEY_OUT="secrets/ga-service-account.json"

echo "Project: $PROJECT"
echo "→ enabling APIs (Analytics Data + Search Console)…"
gcloud services enable analyticsdata.googleapis.com searchconsole.googleapis.com --project="$PROJECT"

echo "→ creating service account (idempotent)…"
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="IDLookup metrics reader (GA4+GSC)" --project="$PROJECT" 2>/dev/null \
  || echo "  (already exists)"

mkdir -p secrets
echo "→ minting JSON key → $KEY_OUT (gitignored)…"
gcloud iam service-accounts keys create "$KEY_OUT" --iam-account="$SA_EMAIL" --project="$PROJECT"

cat <<EOF

✅ Key written to $KEY_OUT

FINAL manual step (GA-side, ~30s — can't be scripted):
  GA4 Admin → Property (542993529) → Property Access Management → "+" → Add users
    email:  $SA_EMAIL
    role:   Viewer

Then verify:  GA4_PROPERTY_ID=542993529 npm run metrics
EOF
