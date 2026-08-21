#!/usr/bin/env bash
# =============================================================================
# cloudflare-edge-hardening.sh
#
# One-shot Cloudflare edge configuration for acreetionos.org:
#   1. Response Header Transform Rule -> security headers site-wide
#      (strong HSTS, CSP w/ frame-ancestors, COOP, Permissions-Policy,
#       Referrer-Policy). The repo's <meta> CSPs stay as defense-in-depth;
#       frame-ancestors is ONLY delivered here (ignored inside <meta>).
#   2. Cache Rules -> long-lived caching for static assets
#      (css/js 7d, images/fonts 30d) overriding GitHub Pages' max-age=600.
#   3. Purge everything once at the end so new rules apply cleanly.
#
# WHY THIS EXISTS: GitHub Pages ignores the repo's `_headers` file, so these
# must be applied at the Cloudflare edge (zone db323c9c253366cf392af8d90d2b7f69).
#
# USAGE — needs ONE of:
#   export CF_API_TOKEN=<token with Zone.Transform Rules + Zone.Cache Rules +
#                          Zone Settings + Zone.Cache Purge = Edit>
# or legacy global key pairing:
#   export CF_EMAIL=<account email> CF_API_KEY=<global api key>
#
# Then:  bash scripts/cloudflare-edge-hardening.sh
#
# Idempotent: re-running replaces the managed rules (descriptions tagged
# "managed-by: acreetionos-edge-script").
# =============================================================================

set -euo pipefail

API="https://api.cloudflare.com/client/v4"
ZONE_ID="db323c9c253366cf392af8d90d2b7f69"
TAG="managed-by: acreetionos-edge-script"

if [[ -n "${CF_API_TOKEN:-}" ]]; then
  AUTH=(-H "Authorization: Bearer $CF_API_TOKEN")
elif [[ -n "${CF_API_KEY:-}" && -n "${CF_EMAIL:-}" ]]; then
  AUTH=(-H "X-Auth-Key: $CF_API_KEY" -H "X-Auth-Email: $CF_EMAIL")
else
  echo "ERROR: set CF_API_TOKEN, or CF_EMAIL + CF_API_KEY" >&2; exit 1
fi

api() { # method path [json-body]
  local m=$1 p=$2 body=${3:-}
  if [[ -n $body ]]; then
    curl -sS -X "$m" "$API$p" "${AUTH[@]}" -H "Content-Type: application/json" -d "$body"
  else
    curl -sS -X "$m" "$API$p" "${AUTH[@]}"
  fi
}
check() { python3 -c '
import json,sys
d=json.load(sys.stdin)
if not d.get("success"):
    print("API ERROR:", json.dumps(d.get("errors")), file=sys.stderr); sys.exit(1)
print(json.dumps(d.get("result"), indent=None)[:300])
'; }

echo "== 1/3 Security response headers (Transform Rules) =="
CSP="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://ajax.cloudflare.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' https://api.github.com https://gitlab.acreetionos.org https://cloudflareinsights.com https://text.pollinations.ai https://www.google.com; frame-src 'self' https://www.google.com https://recaptcha.google.com; object-src 'none'; base-uri 'self'; form-action 'self' https://www.qwant.com; frame-ancestors 'none'"
BODY=$(cat <<EOF
{"rules":[{"id":"sec-headers","description":"$TAG security headers","enabled":true,
 "expression":"true",
 "action":"rewrite","action_parameters":{"headers":{
   "Strict-Transport-Security":{"operation":"set","value":"max-age=31536000; includeSubDomains; preload"},
   "Content-Security-Policy":{"operation":"set","value":$(python3 -c "import json,sys;print(json.dumps(sys.argv[1]))" "$CSP")},
   "Cross-Origin-Opener-Policy":{"operation":"set","value":"same-origin-allow-popups"},
   "Permissions-Policy":{"operation":"set","value":"camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()"},
   "Referrer-Policy":{"operation":"set","value":"strict-origin-when-cross-origin"}}},
 "ratelimit":null}]}
EOF
)
api PUT "/zones/$ZONE_ID/rulesets/phases/http_response_headers_transform/entrypoint" "$BODY" | check
echo "   headers rule installed."

echo "== 2/3 Cache rules for static assets =="
cache_rule() { # name expr edge_ttl_s browser_ttl_s desc
  cat <<EOF
{"rules":[{"id":"$1","description":"$5","enabled":true,"expression":"($2)",
 "action":"set_cache_settings","action_parameters":{
   "cache":true,"edge_ttl":{"mode":"override_origin","status_code_ttl":null,"default":$3},
   "browser_ttl":{"mode":"override_origin","default":$4},
   "serve_stale":{"disable_stale_while_updating":false}}}]}
EOF
}
api PUT "/zones/$ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" \
  "$(cache_rule css-js \
    "http.request.uri.path matches \"\\\\.(css|js)(\\\\?|\$)\"" 604800 604800 "$TAG css/js 7d")" | check
api PUT "/zones/$ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" \
  "$(cache_rule imgs-fonts \
    "http.request.uri.path matches \"\\\\.(webp|png|jpg|jpeg|gif|svg|ico|woff2?)(\\\\?|\$)\"" 2592000 2592000 "$TAG images/fonts 30d")" | check
echo "   cache rules installed."

echo "== 3/3 Purge cache =="
api POST "/zones/$ZONE_ID/purge_cache" '{"purge_everything":true}' | check >/dev/null
echo "DONE. Verify with:"
echo "  curl -sI https://acreetionos.org/ | grep -iE 'strict-transport|content-security|cross-origin-opener'"
