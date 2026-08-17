#!/usr/bin/env python3
"""
Submit acreetionos.org URLs to the Bing Webmaster Tools REST API.

Microsoft is retiring legacy SOAP and POX APIs on August 31, 2026.
This script uses the modern Bing Webmaster REST JSON API endpoints:
  - SubmitUrlbatch: POST https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey={API_KEY}
  - SubmitUrl:      POST https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey={API_KEY}

Usage:
    export BING_API_KEY="your_api_key_from_bing_webmaster"
    python3 scripts/submit-bing-rest.py            # Submits all URLs in sitemap.xml
    python3 scripts/submit-bing-rest.py https://acreetionos.org/faq.html https://acreetionos.org/blog.html

Also works alongside IndexNow (scripts/submit-indexnow.py) for comprehensive real-time indexing.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

SITE_URL = "https://acreetionos.org"
BING_REST_BATCH_ENDPOINT = "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch"
BING_REST_SINGLE_ENDPOINT = "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl"
MAX_BATCH_SIZE = 500  # Bing allows up to 500 URLs per batch submission


def load_urls_from_sitemap():
    sitemap_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sitemap.xml")
    try:
        with open(sitemap_path, "r", encoding="utf-8") as f:
            return re.findall(r"<loc>(https://acreetionos\.org/[^<]*)</loc>", f.read())
    except FileNotFoundError:
        return []


def submit_batch(api_key, urls):
    """Submits a batch of URLs using the Bing Webmaster Tools REST JSON API."""
    url = f"{BING_REST_BATCH_ENDPOINT}?apikey={urllib.parse.quote(api_key)}"
    payload = json.dumps({
        "siteUrl": SITE_URL,
        "urlList": urls,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            print(f"  [REST] Bing SubmitUrlbatch ({len(urls)} URLs) -> HTTP {resp.status}")
            if body:
                print(f"  Response: {body[:200]}")
            return True
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")[:300]
        print(f"  [REST] Bing SubmitUrlbatch failed -> HTTP {e.code}: {err_msg}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  [REST] Bing SubmitUrlbatch error: {e}", file=sys.stderr)
        return False


def main():
    api_key = os.environ.get("BING_API_KEY") or os.environ.get("BING_WEBMASTER_API_KEY")
    if not api_key:
        print("Note: BING_API_KEY environment variable is not set.", file=sys.stderr)
        print("To submit via Bing Webmaster REST API, set BING_API_KEY=<your_key>.", file=sys.stderr)
        print("Falling back to IndexNow protocol (scripts/submit-indexnow.py)...", file=sys.stderr)
        # Execute submit-indexnow.py as companion
        indexnow_script = os.path.join(os.path.dirname(__file__), "submit-indexnow.py")
        if os.path.exists(indexnow_script):
            os.execv(sys.executable, [sys.executable, indexnow_script] + sys.argv[1:])
        sys.exit(0)

    if len(sys.argv) > 1:
        urls = sys.argv[1:]
    else:
        urls = load_urls_from_sitemap()

    if not urls:
        print("No URLs found to submit. Pass URLs as arguments or ensure sitemap.xml exists.", file=sys.stderr)
        sys.exit(1)

    print(f"Submitting {len(urls)} URLs to Bing Webmaster REST API ({SITE_URL})...")

    # Split into chunks if necessary
    success = True
    for i in range(0, len(urls), MAX_BATCH_SIZE):
        chunk = urls[i:i + MAX_BATCH_SIZE]
        if not submit_batch(api_key, chunk):
            success = False

    if not success:
        sys.exit(1)
    print("Bing Webmaster REST API submission completed successfully.")


if __name__ == "__main__":
    main()
