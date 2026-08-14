#!/usr/bin/env python3
"""
Submit acreetionos.org URLs to IndexNow (real-time indexing for
Bing/Seznam/Yandex/Naver) after a deploy.

Usage:
    python3 scripts/submit-indexnow.py            # submit all sitemap URLs
    python3 scripts/submit-indexnow.py https://acreetionos.org/faq.html ...

Prereqs:
    - Key file hosted at https://acreetionos.org/<KEY>.txt (already in repo root)
    - Also mirrored at /.well-known/indexnow.txt

Notes:
    - HTTP 202 = accepted; 200 = ok; 403 = key not yet verifiable (key file
      must be live on the domain first); 429 = rate limited.
    - Crawl quota: every IndexNow submission counts against Bing's crawl
      budget, so only submit changed/added URLs, not the whole site on a
      schedule. The default (sitemap URLs) is fine right after a big launch.
"""

import json
import sys
import urllib.request
import urllib.error
import re

HOST = "acreetionos.org"
KEY = "2e369f12018dcc78a68d9ed417f3a8b4"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
ENDPOINTS = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
    # Yandex's endpoint validates the key live and returns 202 on success —
    # a useful canary when Bing holds a negative cache from an early
    # submission (the site was pushed after the first ping, so Bing cached
    # a 404 for the key file; it re-validates on its own schedule).
    "https://yandex.com/indexnow",
]


def load_urls_from_sitemap():
    try:
        with open("sitemap.xml") as f:
            return re.findall(r"<loc>(https://acreetionos\.org/[^<]*)</loc>", f.read())
    except FileNotFoundError:
        return []


def submit(urls):
    payload = json.dumps({
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }).encode()
    results = []
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(
                ep, data=payload,
                headers={"Content-Type": "application/json; charset=utf-8"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                print(f"  {ep} -> HTTP {resp.status}")
                results.append(True)
        except urllib.error.HTTPError as e:
            print(f"  {ep} -> HTTP {e.code}: {e.read().decode()[:120]}")
            results.append(False)
        except Exception as e:
            print(f"  {ep} -> ERROR: {e}")
            results.append(False)
    # Fail loudly if NO endpoint accepted — a silent miss means no re-crawl.
    # Note: a 403 here usually means Bing hasn't accepted the key yet (new
    # key file, or domain not yet verified in Bing Webmaster Tools). The
    # Ping IndexNow workflow retries on every push, so this resolves once
    # Bing's key-file crawl succeeds.
    if not any(results):
        print("IndexNow submission FAILED on all endpoints", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        urls = sys.argv[1:]
    else:
        urls = load_urls_from_sitemap()
    if not urls:
        print("no URLs (pass them as args or run from repo root)")
        sys.exit(1)
    print(f"submitting {len(urls)} URLs to IndexNow...")
    submit(urls)
