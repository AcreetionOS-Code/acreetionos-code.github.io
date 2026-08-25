#!/usr/bin/env bash
# =============================================================================
# mirror-robots-origin.sh — deindex grey-cloud service hosts (GSC cleanup)
# =============================================================================
# Companion to nginx-robots-edge.sh. Cloudflare rules cannot touch DNS-only
# (grey-cloud) records, so these fixes must run on the origin:
#   acreetion-us-server — ssh -p 2400 natalie@us.iso.acreetionos.org
#
# For every listed host this guarantees:
#   * GET /robots.txt -> 200 text/plain "User-agent: *\nDisallow: /"
#   * every response carries: X-Robots-Tag: noindex, nofollow
#
# Strategy:
#   1. Python block-patcher walks EVERY server{} block in conf.d,
#      sites-enabled and redirects/*; inserts the two snippet includes after
#      the server_name directive of any block missing them. Skips internal
#      backends (server_name localhost / listen 127.*) which may carry their
#      own robots.txt location. Per-block check => idempotent.
#   2. Hosts with no vhost anywhere get a fresh pair of :80/:443 blocks in
#      /etc/nginx/conf.d/, using their own LE cert when present, else the
#      wildcard at /etc/letsencrypt/live/acreetionos.org/.
#   3. GITLAB OMNIBUS (if ever reintroduced): use gitlab.rb
#      nginx['custom_gitlab_server_config'] as documented in FIXES-REPORT.md.
#
# USAGE (on acreetion-us-server):
#   sudo bash mirror-robots-origin.sh            # apply
#   sudo bash mirror-robots-origin.sh --verify   # post-checks only
#
# Idempotent; snapshots /etc/nginx first; nginx -t gates reload w/ rollback.
# Applied & verified 2026-08-24 (15/15 hosts OK; package downloads intact).
# =============================================================================

set -euo pipefail

SNIP_ROBOTS="/etc/nginx/snippets/acreetionos-disallow-all.conf"
SNIP_HEADER="/etc/nginx/snippets/acreetionos-noindex-header.conf"
CONF_ROOT="/etc/nginx"
SCAN_DIRS=("$CONF_ROOT/conf.d" "$CONF_ROOT/sites-enabled" "$CONF_ROOT/redirects")
BACKUP_DIR="/var/backups/nginx-mirror-robots/$(date +%Y%m%d-%H%M%S)"
NGINX_BIN="$(command -v nginx)"
WILDCARD_CERT_DIR="/etc/letsencrypt/live/acreetionos.org"

HOSTS=(
  gitlab.acreetionos.org registry.gitlab.acreetionos.org
  duo.gitlab.acreetionos.org us.gitlab.acreetionos.org
  iso.acreetionos.org us.iso.acreetionos.org eu.iso.acreetionos.org
  packages.acreetionos.org jellyfin.acreetionos.org
  s3.acreetionos.org minio.acreetionos.org mail.acreetionos.org
  pds.acreetionos.org llm.acreetionos.org stoat.acreetionos.org
)

log()  { printf '\n== %s ==\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

verify() {
  local rc=0 code body hdr h
  for h in "${HOSTS[@]}"; do
    code=$(curl -sk -m8 -o /dev/null -w '%{http_code}' -H "Host: $h" https://127.0.0.1/robots.txt || true)
    body=$(curl -sk -m8 -H "Host: $h" https://127.0.0.1/robots.txt | head -2 | tr '\n' ' ')
    hdr=$(curl -sk -m8 -o /dev/null -D - -H "Host: $h" https://127.0.0.1/ | grep -i '^x-robots-tag:' || true)
    if [[ $code == 200 && $body == User-agent:*Disallow:* ]] && [[ $hdr == *"noindex"* ]]; then
      echo "   OK    $h"
    else
      echo "   FAIL  $h code=$code hdr='$hdr' body='${body:0:40}'"; rc=1
    fi
  done
  return $rc
}

[[ ${1:-} == --verify ]] && { verify; exit $?; }
[[ $EUID -eq 0 ]] || fail "run with sudo"

log "1/5 Snapshot /etc/nginx"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/etc-nginx-full.tgz" -C / etc/nginx

log "2/5 Snippets"
cat > "$SNIP_ROBOTS" <<'EOF'
# managed-by: acreetionos-mirrors-robots — disallow-all for service/mirror hosts
location = /robots.txt {
    default_type text/plain;
    add_header Cache-Control "public, max-age=3600" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    return 200 "User-agent: *
Disallow: /
";
}
EOF
cat > "$SNIP_HEADER" <<'EOF'
# managed-by: acreetionos-mirrors-robots — keep mirrors out of every index
add_header X-Robots-Tag "noindex, nofollow" always;
EOF
echo "   wrote snippets"

log "3/5 Patch existing server blocks (per-block, idempotent)"
HOSTS_JSON=$(printf '%s\n' "${HOSTS[@]}" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().split()))')
SCAN_JSON=$(printf '%s\n' "${SCAN_DIRS[@]}" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().split()))')
HOSTS_JSON="$HOSTS_JSON" SCAN_JSON="$SCAN_JSON" SNIP_H="$SNIP_HEADER" SNIP_R="$SNIP_ROBOTS" \
TAG_TXT="managed-by: acreetionos-mirrors-robots" python3 - <<'PY'
import json, os, re, sys
hosts = set(json.loads(os.environ["HOSTS_JSON"]))
dirs = json.loads(os.environ["SCAN_JSON"])
HDR, ROB = os.environ["SNIP_H"], os.environ["SNIP_R"]
TAG = "    # %s\n" % os.environ["TAG_TXT"]
INJ = "\n" + TAG + HDR + ROB

def patch_block(block):
    """Insert includes once, right after the first server_name directive."""
    if "acreetionos-noindex-header" in block and "acreetionos-disallow-all" in block:
        return block                      # already done
    names = re.findall(r"server_name\s+([^;]+);", block)
    hit = any(h in n for n in names for h in hosts)
    if not hit:
        return block
    msn = re.search(r"(\n\s*server_name[^;]+;\n)", block)
    add = TAG + HDR + ROB
    if msn:
        i = msn.end()
        return block[:i] + add + block[i:]
    return block.replace("{\n", "{\n" + add, 1)

changed = []
for d in dirs:
    if not os.path.isdir(d):
        continue
    for fn in sorted(os.listdir(d)):
        p = os.path.join(d, fn)
        if not os.path.isfile(p) or not fn.endswith((".conf", "")) or fn.endswith(".bak"):
            continue
        try:
            s = open(p).read()
        except UnicodeDecodeError:
            continue
        if "server_name" not in s:
            continue
        out, i, touched = [], 0, False
        pat = re.compile(r"server\s*\{")
        for m in pat.finditer(s):
            depth, e = 0, m.end() - 1
            for idx in range(m.start(), len(s)):
                if s[idx] == "{": depth += 1
                elif s[idx] == "}":
                    depth -= 1
                    if depth == 0:
                        e = idx; break
            block = s[m.start():e+1]
            nb = patch_block(block)
            # never touch internal backends
            if re.search(r"server_name\s+localhost\b|listen\s+127\.0\.0\.1:", block) and \
               "acreetionos-noindex-header" not in block:
                nb = block
            if nb != block:
                touched = True
            out.append((m.start(), e+1, nb))
        if not touched:
            continue
        res, last = [], 0
        for st, en, nb in out:
            res.append(s[last:st]); res.append(nb); last = en
        res.append(s[last:])
        open(p, "w").write("".join(res))
        changed.append(p)
print("   patched:", *changed, sep="\n     ")
PY

log "4/5 Create vhosts for unhosted targets (own cert, else wildcard)"
WILD_SSL=""
[[ -f "$WILDCARD_CERT_DIR/fullchain.pem" ]] && WILD_SSL="yes"
for h in "${HOSTS[@]}"; do
  grep -rls "server_name[^;]*\b${h//./\\.}\b" "${SCAN_DIRS[@]}" >/dev/null 2>&1 && continue
  out="$CONF_ROOT/conf.d/mirror-${h//./-}.conf"
  [[ -f $out ]] && { echo "   ok    $h (vhost exists)"; continue; }
  cert="/etc/letsencrypt/live/$h"
  [[ -d $cert ]] || cert="$([[ -n $WILD_SSL ]] && echo "$WILDCARD_CERT_DIR" || true)"
  if [[ -z ${cert:-} ]]; then echo "   SKIP  $h — no vhost, no cert"; continue; fi
  cat > "$out" <<EOF
# managed-by: acreetionos-mirrors-robots
server {
    listen 80;
    listen [::]:80;
    server_name $h;
    include $SNIP_HEADER;
    include $SNIP_ROBOTS;
    location / { return 301 https://acreetionos.org\$request_uri; }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $h;
    ssl_certificate $cert/fullchain.pem;
    ssl_certificate_key $cert/privkey.pem;
    include $SNIP_HEADER;
    include $SNIP_ROBOTS;
    location / { return 301 https://acreetionos.org\$request_uri; }
}
EOF
  echo "   created $out"
done

log "5/5 Test + reload + verify"
if ! "$NGINX_BIN" -t 2>/tmp/nginx-test.err; then
  cat /tmp/nginx-test.err >&2
  tar -xzf "$BACKUP_DIR/etc-nginx-full.tgz" -C /
  fail "config test failed; snapshot restored ($BACKUP_DIR)"
fi
systemctl reload nginx
sleep 2
verify || fail "some hosts failed verification"
echo "Done. Rollback snapshot: $BACKUP_DIR"
