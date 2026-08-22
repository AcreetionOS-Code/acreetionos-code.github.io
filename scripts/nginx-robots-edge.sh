#!/usr/bin/env bash
# =============================================================================
# nginx-robots-edge.sh — fix Google Search Console robots.txt crawl errors
# =============================================================================
# One-shot origin-side fix for the GSC robots.txt report (repo crawl.txt):
#
#   PROBLEM: alias/redirect subdomains (*.acreetionos.org) redirect
#   /robots.txt into HTML pages — or, in the case of matrix.acreetionos.org,
#   redirect the host TO ITSELF in an infinite loop. Googlebot must be able
#   to fetch a valid per-host robots.txt, so GSC shows "Not Fetched",
#   "Blocked due to other 4xx issue", and redirect-loop failures.
#
#   FIX:
#     1. New snippet snippets/acreetionos-robots-edge.conf — serves the apex
#        site's LIVE robots.txt (proxied from GitHub Pages with a Host
#        override) at location = /robots.txt, BEFORE any legacy redirect.
#     2. Affected vhosts rewritten (both schemes) with blanket returns moved
#        INTO `location / {}` — REQUIRED because a server-level `return`
#        fires in the SERVER_REWRITE phase, before location matching, and
#        would bypass the robots.txt location entirely.
#     3. matrix.acreetionos.org: replace the self-redirect loop — serve a
#        disallow-all robots.txt (same policy as iso/packages/jellyfin) and
#        301 everything else to the apex, preserving the path.
#     4. Pre-provision dedicated vhosts for darren + acreetionos-wiki.
#     5. 2026-08-21: the Cloudflare page rule "wiki.* -> acreetionos-wiki"
#        (path-dropping) was DELETED via the API, and the wiki vhost was
#        fixed to never bounce back to its own https:// URL — that self-
#        redirect looped forever because the zone runs SSL=flexible and the
#        edge fetches origin over :80. wiki.* now canonicalizes straight to
#        the apex wiki, preserving /wiki-guides/* paths. acreetionos-wiki is
#        vestigial (stale bookmarks only): "/" lands on the wiki hub.
#
# USAGE (on acreetion-us-server, passwordless sudo required):
#   sudo bash nginx-robots-edge.sh             # apply
#   sudo bash nginx-robots-edge.sh --verify    # post-checks only
#
# Idempotent: re-running overwrites managed files (tagged
# "managed-by: acreetionos-robots-edge"). A full /etc/nginx tar snapshot is
# taken before edits; nginx -t gates reload, and on test failure the snapshot
# is restored automatically.
# =============================================================================

set -euo pipefail

TAG="managed-by: acreetionos-robots-edge"
SNIP_EDGE="/etc/nginx/snippets/acreetionos-robots-edge.conf"
REDIR="/etc/nginx/redirects"
BACKUP_DIR="/var/backups/nginx-robots-edge/$(date +%Y%m%d-%H%M%S)"
NGINX_BIN="$(command -v nginx)"

log()  { printf '\n== %s ==\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

write_file() { # path (content on stdin) — snapshots /etc/nginx once, then writes
  local f=$1
  cat > "$f"
  echo "   wrote $f"
}

snapshot() {
  mkdir -p "$BACKUP_DIR"
  tar -czf "$BACKUP_DIR/etc-nginx-full.tgz" -C / etc/nginx
  echo "   snapshot: $BACKUP_DIR/etc-nginx-full.tgz"
}

rollback() {
  log "ROLLBACK — restoring /etc/nginx from snapshot"
  tar -xzf "$BACKUP_DIR/etc-nginx-full.tgz" -C /
  "$NGINX_BIN" -t && systemctl reload nginx || true
}

nginx_test_or_rollback() {
  if "$NGINX_BIN" -t 2>/tmp/nginx-test.err; then
    echo "   nginx -t OK"
    return 0
  fi
  cat /tmp/nginx-test.err >&2 || true
  rollback
  fail "config test failed after edit; previous config restored"
}

verify() {
  log "VERIFY (origin-side, Host header against 127.0.0.1)"
  local rc=0 host code ctype body loc
  for host in social.acreetionos.org discourse.acreetionos.org arttulos.acreetionos.org \
              wiki.acreetionos.org acreetionos-wiki.acreetionos.org darren.acreetionos.org \
              confluence.acreetionos.org cloudflared.acreetionos.org; do
    code=$(curl -sk -m8 -o /dev/null -w '%{http_code}' -H "Host: $host" https://127.0.0.1/robots.txt)
    ctype=$(curl -sk -m8 -o /dev/null -w '%{content_type}' -H "Host: $host" https://127.0.0.1/robots.txt)
    body=$(curl -sk -m8 -H "Host: $host" https://127.0.0.1/robots.txt)
    # Apex robots.txt begins with '#' comment lines; service hosts begin
    # with 'User-agent:'. Both are valid.
    if [[ $code == 200 && $ctype == text/plain* && ( $body == User-agent:* || $body == "#"* ) ]]; then
      echo "   OK    $host -> 200 text/plain (${#body} bytes)"
    else
      echo "   FAIL  $host -> code=$code type=$ctype"; rc=1
    fi
  done
  # Service host -> disallow-all
  body=$(curl -sk -m8 -H "Host: matrix.acreetionos.org" https://127.0.0.1/robots.txt)
  if [[ $body == *'Disallow: /'* ]]; then
    echo "   OK    matrix.acreetionos.org -> disallow-all"
  else
    echo "   FAIL  matrix robots: $body"; rc=1
  fi
  # Loop must be dead
  loc=$(curl -sk -m8 -o /dev/null -D - -H "Host: matrix.acreetionos.org" https://127.0.0.1/ | tr -d '\r' | grep -i '^location:' | awk '{print $2}')
  if [[ $loc == https://acreetionos.org* ]]; then
    echo "   OK    matrix / -> $loc (self-loop dead)"
  else
    echo "   FAIL  matrix still loops to: $loc"; rc=1
  fi
  return $rc
}

[[ ${1:-} == --verify ]] && { verify; exit $?; }

[[ $EUID -eq 0 ]] || fail "run with sudo (needs /etc/nginx write access)"
command -v curl >/dev/null || fail "curl required"

log "1/7 Snapshot current config"
snapshot

log "2/7 Preflight — GitHub Pages upstream reachable with apex Host"
up_code=$(curl -sk -m10 -o /dev/null -w '%{http_code}' -H 'Host: acreetionos.org' https://acreetionos-code.github.io/robots.txt)
[[ $up_code == 200 ]] || fail "upstream robots.txt not 200 (got $up_code)"
echo "   upstream OK ($up_code)"

log "3/7 Snippet: live-apex robots edge"
write_file "$SNIP_EDGE" <<EOF
# $TAG — serves the apex site's LIVE robots.txt directly for alias hosts so
# every *.acreetionos.org host returns a real 200 text/plain robots.txt
# BEFORE any legacy redirect fires. Single source of truth:
#   https://acreetionos.org/robots.txt  (generated by scripts/gen-robots.py)
location = /robots.txt {
    resolver 1.1.1.1 8.8.8.8 valid=300s ipv6=off;
    resolver_timeout 5s;
    set \$acreetion_pages "acreetionos-code.github.io";
    proxy_pass https://\$acreetion_pages;
    proxy_ssl_server_name on;
    proxy_ssl_name acreetionos-code.github.io;
    proxy_set_header Host acreetionos.org;
    proxy_set_header User-Agent "acreetionos-robots-edge/1.0";
    proxy_http_version 1.1;
    proxy_connect_timeout 5s;
    proxy_read_timeout 10s;
}
EOF

# Real newlines required (printf interprets \n; plain "" quoting would not).
ROBOTS_INC="$(printf '    # %s — real robots.txt before redirects (GSC crawl.txt fix)\n    include /etc/nginx/snippets/acreetionos-robots-edge.conf;\n' "$TAG")"

log "4/7 Vhosts: social / discourse / arttulos / wiki (blanket returns wrapped in locations)"
write_file "$REDIR/social-redirect.conf" <<EOF
# $TAG — robots.txt served directly (see snippets/acreetionos-robots-edge.conf);
# legacy redirect targets preserved.
server {
    listen 80;
    listen [::]:80;
    server_name social.acreetionos.org;

$ROBOTS_INC
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name social.acreetionos.org;

    ssl_certificate /etc/letsencrypt/live/matrix.acreetionos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/matrix.acreetionos.org/privkey.pem;

$ROBOTS_INC
    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}
EOF

write_file "$REDIR/discourse-redirect.conf" <<EOF
# $TAG — robots.txt served directly; legacy redirect targets preserved.
server {
    listen 80;
    listen [::]:80;
    server_name discourse.acreetionos.org;

$ROBOTS_INC
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name discourse.acreetionos.org;

    ssl_certificate /etc/letsencrypt/live/matrix.acreetionos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/matrix.acreetionos.org/privkey.pem;

$ROBOTS_INC
    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}
EOF

write_file "$REDIR/arttulos-redirect.conf" <<EOF
# $TAG — robots.txt served directly; ArttulOS became the Immutable edition,
# so page requests still land on /immutable.html.
server {
    listen 80;
    listen [::]:80;
    server_name arttulos.acreetionos.org;

$ROBOTS_INC
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name arttulos.acreetionos.org;

    ssl_certificate /etc/letsencrypt/live/matrix.acreetionos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/matrix.acreetionos.org/privkey.pem;

$ROBOTS_INC
    location / {
        return 301 https://acreetionos.org/immutable.html;
    }
}
EOF

write_file "$REDIR/wiki-redirect.conf" <<EOF
# $TAG — robots.txt served directly; pages canonicalize to the apex wiki.
# 2026-08-21: the old :80 block bounced back to our own https:// URL. This
# host is CF-proxied and the zone runs SSL=flexible, so the edge fetches
# origin over :80 — that bounce looped edge->origin forever. Both schemes
# now canonicalize straight to acreetionos.org, preserving real wiki paths:
#   /robots.txt          -> served here (200)
#   /wiki.html           -> acreetionos.org/wiki.html
#   /wiki-guides/<slug>  -> acreetionos.org/wiki-guides/<slug> (path kept)
#   anything else        -> acreetionos.org/wiki.html (hub)
server {
    listen 80;
    listen [::]:80;
    server_name wiki.acreetionos.org;

$ROBOTS_INC
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location ~ ^/wiki-guides/(.+)\$ {
        return 301 https://acreetionos.org/wiki-guides/\$1\$is_args\$args;
    }
    location = /wiki.html {
        return 301 https://acreetionos.org/wiki.html\$is_args\$args;
    }
    location / {
        return 301 https://acreetionos.org/wiki.html\$is_args\$args;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name wiki.acreetionos.org;

    ssl_certificate /etc/letsencrypt/live/wiki.acreetionos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wiki.acreetionos.org/privkey.pem;

$ROBOTS_INC
    location ~ ^/wiki-guides/(.+)\$ {
        return 301 https://acreetionos.org/wiki-guides/\$1\$is_args\$args;
    }
    location = /wiki.html {
        return 301 https://acreetionos.org/wiki.html\$is_args\$args;
    }
    location / {
        return 301 https://acreetionos.org/wiki.html\$is_args\$args;
    }
}
EOF

log "5/7 Catchall (+confluence/cloudflared): robots before homepage redirect"
write_file "$REDIR/catchall-redirect.conf" <<EOF
# $TAG — catch-all: any *.acreetionos.org subdomain with no dedicated vhost
# (dead/legacy subdomains GSC still tracks) now serves the apex robots.txt
# first, then redirects to the main site. Named server blocks (gitlab, iso,
# matrix, ...) match first, so this only fires for unknown hostnames.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

$ROBOTS_INC
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;

    ssl_certificate /etc/letsencrypt/live/acreetionos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/acreetionos.org/privkey.pem;

$ROBOTS_INC
    location / {
        return 301 https://acreetionos.org;
    }
}

server {
    listen 443 ssl ;
    listen [::]:443 ssl ;
    server_name cloudflared.acreetionos.org; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/cloudflared.acreetionos.org/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/cloudflared.acreetionos.org/privkey.pem; # managed by Certbot

$ROBOTS_INC
    location / {
        return 301 https://acreetionos.org;
    }
}

server {
    listen 443 ssl ;
    listen [::]:443 ssl ;
    server_name confluence.acreetionos.org; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/confluence.acreetionos.org/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/confluence.acreetionos.org/privkey.pem; # managed by Certbot

$ROBOTS_INC
    location / {
        return 301 https://acreetionos.org;
    }
}
EOF

log "6/7 matrix: kill self-loop + disallow-all robots"
write_file "$REDIR/matrix-redirect.conf" <<EOF
# $TAG (GSC crawl.txt fix).
# WAS: 443 block did \`return 301 https://matrix.acreetionos.org;\` — a
# self-referential redirect that looped forever (GSC: Not Fetched).
# The Matrix homeserver is decommissioned (nothing behind 8448), so:
#   * /robots.txt     -> disallow-all (service-host policy, like iso/packages/jellyfin)
#   * everything else -> main site, path preserved
server {
    listen 80;
    listen [::]:80;
    server_name matrix.acreetionos.org;

    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location = /robots.txt {
        default_type text/plain;
        add_header Cache-Control "public, max-age=3600" always;
        return 200 "User-agent: *
Disallow: /
";
    }

    location / {
        return 301 https://matrix.acreetionos.org\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name matrix.acreetionos.org;

    ssl_certificate /etc/letsencrypt/live/matrix.acreetionos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/matrix.acreetionos.org/privkey.pem;

    location = /robots.txt {
        default_type text/plain;
        add_header Cache-Control "public, max-age=3600" always;
        return 200 "User-agent: *
Disallow: /
";
    }

    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}
EOF

log "7/7 Pre-provision darren + acreetionos-wiki dedicated vhosts"
write_file "$REDIR/darren-redirect.conf" <<EOF
# $TAG.
# NOTE: currently shadowed by a Cloudflare edge rule that 302s
# darren.acreetionos.org/* -> https://acreetionos.org/ (drops the path).
# Once that edge rule is removed, this vhost serves a real robots.txt and
# preserves paths into the main site.
server {
    listen 80;
    listen [::]:80;
    server_name darren.acreetionos.org;

$ROBOTS_INC
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name darren.acreetionos.org;

    ssl_certificate /etc/letsencrypt/live/acreetionos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/acreetionos.org/privkey.pem;

$ROBOTS_INC
    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}
EOF

write_file "$REDIR/acreetionos-wiki-redirect.conf" <<EOF
# $TAG.
# Legacy band-aid host. Originally existed so the (now DELETED 2026-08-21)
# Cloudflare page rule "wiki.* -> acreetionos-wiki, path dropped" chain ended
# on a valid robots.txt for GSC. With that edge rule gone nothing routes
# through here except stale bookmarks: "/" now lands humans on the wiki hub,
# deep paths keep going to their apex equivalent, and /robots.txt is still
# served directly by the snippet.
server {
    listen 80;
    listen [::]:80;
    server_name acreetionos-wiki.acreetionos.org;

$ROBOTS_INC
    location /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
    }

    location = / {
        return 301 https://acreetionos.org/wiki.html;
    }

    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name acreetionos-wiki.acreetionos.org;

    ssl_certificate /etc/letsencrypt/live/acreetionos.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/acreetionos.org/privkey.pem;

$ROBOTS_INC
    location = / {
        return 301 https://acreetionos.org/wiki.html;
    }

    location / {
        return 301 https://acreetionos.org\$request_uri;
    }
}
EOF

log "Test + reload"
nginx_test_or_rollback
systemctl reload nginx && echo "   nginx reloaded"
# Reload is async — give new workers a moment or verify() races old ones.
sleep 2

verify
rc=$?
log "Done. Snapshot for rollback: $BACKUP_DIR"
exit $rc
