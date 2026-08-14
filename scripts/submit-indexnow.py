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
KEY = "fc6913fec92a55410fec94f8354c378d"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
ENDPOINTS = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
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
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(
                ep, data=payload,
                headers={"Content-Type": "application/json; charset=utf-8"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                print(f"  {ep} -> HTTP {resp.status}")
        except urllib.error.HTTPError as e:
            print(f"  {ep} -> HTTP {e.code}: {e.read().decode()[:120]}")
        except Exception as e:
            print(f"  {ep} -> ERROR: {e}")


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
