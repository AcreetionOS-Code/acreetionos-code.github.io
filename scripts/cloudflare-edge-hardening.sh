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
#      (css/js 30d, images/fonts 30d) overriding GitHub Pages' max-age=600.
#   3. Single Redirects -> the retired-page and canonical-host redirects
#      declared in the repo's `_redirects` (see the second WHY note below).
#   4. Purge everything once at the end so new rules apply cleanly.
#
# WHY THIS EXISTS: GitHub Pages ignores the repo's `_headers` file, so these
# must be applied at the Cloudflare edge (zone db323c9c253366cf392af8d90d2b7f69).
#
# SAME REASON FOR REDIRECTS: `_redirects` is Netlify/Cloudflare-Pages syntax.
# GitHub Pages ignores that too, so every rule in `_redirects` was a silent
# no-op — /git-tracker.html and /unofficial/sway.html 404'd instead of
# redirecting, and /index.html + the www host served duplicate 200s. Keep
# `_redirects` as the readable source of intent, but the enforcing copy has
# to live here.
#
# USAGE — needs ONE of:
#   export CF_API_TOKEN=<token with Zone.Rulesets + Zone.Cache Rules +
#                          Zone.Settings + Zone.Cache Purge = Edit>
# or legacy global key pairing:
#   export CF_EMAIL=<account email> CF_API_KEY=<global api key>
#
# NOTE: the token MUST be the bearer-token kind. The global-key pairing is
# legacy and may not carry the Rulesets scope on newer zones.
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

echo "== 1/4 Security response headers (Transform Rules) =="
CSP="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://ajax.cloudflare.com https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' https://api.github.com https://gitlab.acreetionos.org https://iso.acreetionos.org:8448 https://wiki.archlinux.org https://cloudflareinsights.com https://static.cloudflareinsights.com https://text.pollinations.ai https://www.google.com; frame-src 'self' https://www.google.com https://recaptcha.google.com; object-src 'none'; base-uri 'self'; form-action 'self' https://www.qwant.com; frame-ancestors 'none'"
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

echo "== 2/4 Cache rules for static assets =="
# NOTE: built in Python — bash->heredoc->JSON escaping of regexes broke here
# (error 400 "invalid character '\\\\'"); json.dumps handles it correctly.
ZONE_ID="$ZONE_ID" TAG="$TAG" python3 - <<'PYEOF'
import json, os, urllib.request
API = "https://api.cloudflare.com/client/v4"
ZONE = os.environ["ZONE_ID"]
TAG = os.environ["TAG"]

def auth_headers():
    # Mirror the bash branch above. This used to read CF_EMAIL/CF_API_KEY
    # unconditionally, which raised KeyError and aborted the whole script
    # whenever only CF_API_TOKEN was set — which is exactly what
    # .github/workflows/edge-hardening.yml provides. Every CI run failed.
    tok = os.environ.get("CF_API_TOKEN")
    if tok:
        return {"Authorization": "Bearer " + tok}
    key, mail = os.environ.get("CF_API_KEY"), os.environ.get("CF_EMAIL")
    if key and mail:
        return {"X-Auth-Email": mail, "X-Auth-Key": key}
    raise SystemExit("ERROR: set CF_API_TOKEN, or CF_EMAIL + CF_API_KEY")

AUTH = dict(auth_headers(), **{"Content-Type": "application/json"})

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers=AUTH)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print("API ERROR:", e.read().decode()[:300]); raise SystemExit(1)

def put(path, body):
    d = call("PUT", path, body)
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
    # 30d, not the 7d this script originally declared: production was hand-
    # edited to 30d on 2026-08-25 (and the rule renamed to "css/js 30d").
    # Since CI never ran successfully, the 7d here was never applied — but
    # leaving it would silently revert that deliberate change the first time
    # this script does run. Keep this in sync with the live rule.
    cache_ruleset(css_js, 2592000, 2592000, "css/js 30d")["rules"][0],
    cache_ruleset(imgs, 2592000, 2592000, "images/fonts 30d")["rules"][0],
]}
put(path_, body)
print("   cache rules installed.")
PYEOF

echo "== 3/4 Single Redirects (the rules GitHub Pages ignores in _redirects) =="
ZONE_ID="$ZONE_ID" TAG="$TAG" python3 - <<'PYEOF'
import json, os, urllib.request
API = "https://api.cloudflare.com/client/v4"
ZONE = os.environ["ZONE_ID"]
TAG = os.environ["TAG"]

def auth_headers():
    tok = os.environ.get("CF_API_TOKEN")
    if tok:
        return {"Authorization": "Bearer " + tok}
    key, mail = os.environ.get("CF_API_KEY"), os.environ.get("CF_EMAIL")
    if key and mail:
        return {"X-Auth-Email": mail, "X-Auth-Key": key}
    raise SystemExit("ERROR: set CF_API_TOKEN, or CF_EMAIL + CF_API_KEY")

AUTH = dict(auth_headers(), **{"Content-Type": "application/json"})

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers=AUTH)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print("API ERROR:", e.read().decode()[:300]); raise SystemExit(1)

def put(path, body):
    d = call("PUT", path, body)
    if not d.get("success"):
        print("API ERROR:", d.get("errors")); raise SystemExit(1)

APEX = "https://acreetionos.org"
HOST_APEX = '(http.host eq "acreetionos.org")'

# (description, expression, static_target, dynamic_target_expression)
REDIRECTS = [
    # NOTE: there is deliberately NO www -> apex rule here.
    #
    # `_redirects` asks for one, but it is not achievable with a zone-level
    # Single Redirect, and a rule that installs green while never firing is
    # worse than no rule at all. This zone normalises the www host to the
    # apex BEFORE the ruleset engine evaluates, so every way of naming the
    # original host was tried and none matched:
    #
    #   http.host eq "www.acreetionos.org"                 never fired
    #   http.request.headers["host"][0] eq "www..."        never fired
    #   starts_with(http.request.full_uri, "https://www...") never fired
    #
    # All three validate cleanly against the API, so validation is not proof
    # of matching. The evidence that normalisation is the cause: an
    # apex+PATH rule from this same list (e.g. /index.html) *does* match www
    # requests, while a www-only host condition never does. Whatever handles
    # www upstream rewrites the host to the apex.
    #
    # This is not currently a problem: www serves byte-identical content and
    # index.html ships <link rel="canonical" href="https://acreetionos.org/">,
    # so search engines already consolidate onto the apex. That canonical tag,
    # not a redirect, is what makes the www host safe. Revisit only if the
    # www host starts serving different content.
    ("/index.html -> / (canonical root)",
     f'{HOST_APEX} and http.request.uri.path eq "/index.html"', APEX + "/", None),
    ("/git-tracker.html -> /changelog.html (retired 2026-08-21)",
     f'{HOST_APEX} and http.request.uri.path eq "/git-tracker.html"',
     APEX + "/changelog.html", None),
    ("/git-tracker-all.js -> /changelog.html (retired 2026-08-21)",
     f'{HOST_APEX} and http.request.uri.path eq "/git-tracker-all.js"',
     APEX + "/changelog.html", None),
    ("/unofficial/sway.html -> /unofficial.html (old wiki-style path)",
     f'{HOST_APEX} and http.request.uri.path eq "/unofficial/sway.html"',
     APEX + "/unofficial.html", None),
]

def redirect_rule(desc, expr, static, dynamic):
    target = {"value": static} if static else {"expression": dynamic}
    return {
        "description": f"{TAG} {desc}", "enabled": True, "expression": expr,
        "action": "redirect",
        "action_parameters": {"from_value": {"status_code": 301, "target_url": target}},
    }

managed = [redirect_rule(*r) for r in REDIRECTS]

# MERGE, never blind-PUT. A PUT to a phase entrypoint replaces every rule in
# it, so overwriting blindly would delete the hand-made
# /wiki.html -> wiki-ai.acreetionos.org rule, which carries no TAG. Keep all
# untagged rules verbatim and only replace the ones this script owns.
path_ = "/zones/%s/rulesets/phases/http_request_dynamic_redirect/entrypoint" % ZONE
d = call("GET", path_)
existing = (d.get("result") or {}).get("rules") or []
# Strip server-managed fields before echoing a rule back in a PUT.
DROP = {"id", "ref", "version", "last_updated"}
preserved = [
    {k: v for k, v in r.items() if k not in DROP}
    for r in existing if TAG not in (r.get("description") or "")
]
print(f"   preserving {len(preserved)} hand-made rule(s): "
      + ", ".join((r.get("description") or "?") for r in preserved))

put(path_, {"rules": managed + preserved})
print(f"   {len(managed)} redirect rule(s) installed.")
PYEOF

echo "== 4/4 Purge cache =="
api POST "/zones/$ZONE_ID/purge_cache" '{"purge_everything":true}' | check >/dev/null
echo "DONE. Verify with:"
echo "  curl -sI https://acreetionos.org/ | grep -iE 'strict-transport|content-security|cross-origin-opener'"
echo "  curl -sI https://acreetionos.org/git-tracker.html | grep -iE '^HTTP|^location'"
