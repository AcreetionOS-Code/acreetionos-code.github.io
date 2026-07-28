#!/bin/bash

# Deploy changelog-worker via Cloudflare API
# Usage: CLOUDFLARE_TOKEN=<token> bash deploy-changelog-worker.sh

if [ -z "$CLOUDFLARE_TOKEN" ]; then
  echo "Error: CLOUDFLARE_TOKEN environment variable not set"
  exit 1
fi

ACCOUNT_ID="86a77a981dd5e5a634330a4819aaa2e0"
WORKER_NAME="changelog-worker"
SCRIPT_FILE="changelog-worker.js"

echo "Deploying $WORKER_NAME to Cloudflare..."

# Read the worker script
SCRIPT_CONTENT=$(cat "$SCRIPT_FILE")

# Deploy worker script
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/javascript" \
  -d "$SCRIPT_CONTENT" \
  -s | jq .

echo "Deployment complete!"
