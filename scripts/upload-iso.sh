#!/usr/bin/env bash
set -euo pipefail

# Usage: upload-iso.sh <iso-file> <edition-slug> <date-stamp>
ISO_FILE="$1"
SLUG="$2"
DATE="$3"
ISO_NAME="${SLUG}-${DATE}.iso"
R2_KEY="${ISO_NAME}"

echo "=== Uploading ${ISO_NAME} ==="

# --- Cloudflare R2 ---
if [ -n "${CF_ACCOUNT:-}" ] && [ -n "${CF_TOKEN:-}" ]; then
  echo "--- R2 ---"
  curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/r2/buckets" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -d '{"name":"acreetionos-builds"}' || true
  U=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/r2/buckets/acreetionos-builds/objects/${R2_KEY}/upload" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -d '{}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('uploadURL',''))")
  if [ -n "$U" ]; then
    curl -s -X PUT "$U" --data-binary @"$ISO_FILE" && echo "  Uploaded to R2: ${R2_KEY}"
  else
    curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/r2/buckets/acreetionos-builds/objects/${R2_KEY}" \
      -H "Authorization: Bearer $CF_TOKEN" \
      --data-binary @"$ISO_FILE" && echo "  Uploaded to R2 (direct): ${R2_KEY}"
  fi
  # Also upload as -latest.iso for stable download URL
  LATEST_KEY="${SLUG}-latest.iso"
  U=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/r2/buckets/acreetionos-builds/objects/${LATEST_KEY}/upload" \
    -H "Authorization: Bearer $CF_TOKEN" \
    -d '{}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('uploadURL',''))")
  if [ -n "$U" ]; then
    curl -s -X PUT "$U" --data-binary @"$ISO_FILE" && echo "  Uploaded to R2: ${LATEST_KEY}"
  else
    curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/r2/buckets/acreetionos-builds/objects/${LATEST_KEY}" \
      -H "Authorization: Bearer $CF_TOKEN" \
      --data-binary @"$ISO_FILE" && echo "  Uploaded to R2 (direct): ${LATEST_KEY}"
  fi
else
  echo "  SKIP R2: CF_ACCOUNT or CF_TOKEN not set"
fi

# --- Internet Archive ---
# Uses S3-compatible API
if [ -n "${IA_ACCESS_KEY:-}" ] && [ -n "${IA_SECRET_KEY:-}" ]; then
  echo "--- Internet Archive ---"
  IA_ITEM="acreetionos-${SLUG}"
  IA_COLLECTION="opensource"
  curl -s --location \
    --header "authorization: LOW ${IA_ACCESS_KEY}:${IA_SECRET_KEY}" \
    --header "x-archive-meta01-collection: ${IA_COLLECTION}" \
    --header "x-archive-meta01-title: AcreetionOS ${SLUG} (${DATE})" \
    --header "x-archive-meta01-creator: AcreetionOS Project" \
    --header "x-archive-meta01-description: Automated build of AcreetionOS ${SLUG} edition. Built on ${DATE}." \
    --header "x-archive-meta01-mediatype: software" \
    --header "x-archive-meta01-license: GPL-3.0" \
    --upload-file "$ISO_FILE" \
    "https://s3.us.archive.org/${IA_ITEM}/${ISO_NAME}" && echo "  Uploaded to IA: ${IA_ITEM}/${ISO_NAME}"
else
  echo "  SKIP IA: IA_ACCESS_KEY or IA_SECRET_KEY not set"
fi

# --- SourceForge ---
if [ -n "${SF_USERNAME:-}" ] && [ -n "${SF_PASSWORD:-}" ]; then
  echo "--- SourceForge ---"
  # SourceForge file release via HTTPS PUT
  SF_PROJECT="acreetionos-iso-image"
  curl -s --user "${SF_USERNAME}:${SF_PASSWORD}" \
    -T "$ISO_FILE" \
    "https://frs.sourceforge.net/${SF_PROJECT}/${SLUG}/${ISO_NAME}" && echo "  Uploaded to SF: ${SLUG}/${ISO_NAME}"
  # Also upload as latest
  curl -s --user "${SF_USERNAME}:${SF_PASSWORD}" \
    -T "$ISO_FILE" \
    "https://frs.sourceforge.net/${SF_PROJECT}/${SLUG}/${SLUG}-latest.iso" && echo "  Uploaded to SF: ${SLUG}/${SLUG}-latest.iso"
else
  echo "  SKIP SF: SF_USERNAME or SF_PASSWORD not set"
fi

echo "=== Upload complete for ${ISO_NAME} ==="
