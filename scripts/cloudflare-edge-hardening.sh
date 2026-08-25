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
CSP="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://ajax.cloudflare.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' https://api.github.com https://gitlab.acreetionos.org https://cloudflareinsights.com https://static.cloudflareinsights.com https://text.pollinations.ai https://www.google.com; frame-src 'self' https://www.google.com https://recaptcha.google.com; object-src 'none'; base-uri 'self'; form-action 'self' https://www.qwant.com; frame-ancestors 'none'"
BODY=$(cat <<EOF
{"rules":[{"description":"$TAG security headers","enabled":true,
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
# NOTE: built in Python — bash->heredoc->JSON escaping of regexes broke here
# (error 400 "invalid character '\\\\'"); json.dumps handles it correctly.
ZONE_ID="$ZONE_ID" TAG="$TAG" python3 - <<'PYEOF'
import json, os, urllib.request
API = "https://api.cloudflare.com/client/v4"
ZONE = os.environ["ZONE_ID"]
TAG = os.environ["TAG"]
AUTH = {
    "X-Auth-Email": os.environ["CF_EMAIL"],
    "X-Auth-Key": os.environ["CF_API_KEY"],
    "Content-Type": "application/json",
}
def put(path, body):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), method="PUT", headers=AUTH)
    try:
        d = json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print("API ERROR:", e.read().decode()[:300]); raise SystemExit(1)
    if not d.get("success"):
        print("API ERROR:", d.get("errors")); raise SystemExit(1)
def cache_ruleset(expr, edge_ttl, browser_ttl, desc):
    return {"rules": [{
        "description": f"{TAG} {desc}", "enabled": True, "expression": expr,
        "action": "set_cache_settings",
        "action_parameters": {
            "cache": True,
            "edge_ttl": {"mode": "override_origin", "status_code_ttl": None, "default": edge_ttl},
            "browser_ttl": {"mode": "override_origin", "default": browser_ttl},
            "serve_stale": {"disable_stale_while_updating": False},
        },
    }]}
path_ = "/zones/%s/rulesets/phases/http_request_cache_settings/entrypoint" % ZONE
# NOTE: regex operator `matches` requires a Business plan — use ends_with().
# IMPORTANT: ONE PUT with BOTH rules — each PUT replaces the entire
# entrypoint, so sequential puts would silently drop earlier rules.
css_js = "(%s)" % " or ".join(f'ends_with(http.request.uri.path, "{e}")' for e in (".css", ".js"))
imgs = "(%s)" % " or ".join(
    f'ends_with(http.request.uri.path, "{e}")'
    for e in (".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2"))
body = {"rules": [
    cache_ruleset(css_js, 604800, 604800, "css/js 7d")["rules"][0],
    cache_ruleset(imgs, 2592000, 2592000, "images/fonts 30d")["rules"][0],
]}
put(path_, body)
print("   cache rules installed.")
PYEOF

echo "== 3/3 Purge cache =="
api POST "/zones/$ZONE_ID/purge_cache" '{"purge_everything":true}' | check >/dev/null
echo "DONE. Verify with:"
echo "  curl -sI https://acreetionos.org/ | grep -iE 'strict-transport|content-security|cross-origin-opener'"
