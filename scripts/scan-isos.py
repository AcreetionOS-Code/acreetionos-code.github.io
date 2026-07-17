#!/usr/bin/env python3
"""Scan AcreetionOS ISO download URLs with VirusTotal.

Respects VirusTotal free-tier quota:
  - 500 requests/day (resets ~midnight UTC)
  - ~15,000/month
  - Rate limit: 4 requests/minute (URL scanning)

Usage:
  export VIRUSTOTAL_API_KEY="your-key"
  python3 scripts/scan-isos.py

Outputs GitHub Actions annotations for any malicious/suspicious results.
"""

import json
import os
import sys
import time
from datetime import date, datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

API_KEY = os.environ.get("VIRUSTOTAL_API_KEY", "")
VT_API = "https://www.virustotal.com/api/v3"
MAX_SCANS = int(os.environ.get("MAX_VT_SCANS", "10"))  # scans per workflow run
RATE_LIMIT_DELAY = 16  # seconds between URL scans (VT free tier: ~4/min)
MAX_RETRIES = 3
RETRY_DELAY = 10

# ISO sources to scan — mirrors from known hosting providers
# Fallback hardcoded list if Provider API is unreachable
FALLBACK_ISOS = [
    "https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/acreetionos-isos/acreetionos-latest.iso",
]


def log(msg, level="info"):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    prefix = {"info": "  ", "warn": "::warning::", "err": "::error::"}.get(level, "  ")
    print(f"{prefix}[{ts}] {msg}", file=sys.stderr if level in ("warn", "err") else sys.stdout)


def fetch_json(url, headers=None, data=None, timeout=30):
    req = Request(url, data=data, headers=headers or {})
    req.add_header("User-Agent", "AcreetionOS-Scan-Bot/1.0")
    if data:
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            # Handle non-JSON responses gracefully
            if "json" not in content_type.lower():
                return {"raw": raw.decode("utf-8", errors="replace")}
            return json.loads(raw)
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        raise Exception(f"HTTP {e.code}: {body}")
    except Exception as e:
        raise Exception(f"Request failed: {e}")


def fetch_provider_isos():
    """Fetch active hosting provider ISO URLs from the Worker API."""
    worker_url = os.environ.get("WORKER_URL", "https://acreetionos.org/api")
    try:
        data = fetch_json(f"{worker_url}/hosting/providers", timeout=15)
        providers = data if isinstance(data, list) else data.get("providers", [])
        urls = []
        for p in providers:
            if p.get("status") in ("active", "reactivating") and p.get("mirror_url"):
                urls.append((p.get("org", "unknown"), p["mirror_url"]))
        if urls:
            return urls
    except Exception as e:
        log(f"Provider API unreachable: {e}", "warn")

    log("Falling back to hardcoded ISO list", "warn")
    return [("acreetionos-latest", url) for url in FALLBACK_ISOS]


def submit_url_scan(org, url):
    """Submit a URL to VirusTotal for scanning. Returns analysis ID or raises."""
    headers = {"x-apikey": API_KEY}
    body = f"url={url}".encode()
    resp = fetch_json(
        f"{VT_API}/urls",
        headers=headers,
        data=body,
        timeout=30,
    )
    return resp.get("data", {}).get("id", "")


def get_analysis_result(analysis_id):
    """Poll VirusTotal for analysis result. Returns stats dict."""
    headers = {"x-apikey": API_KEY}
    for attempt in range(MAX_RETRIES):
        time.sleep(5)
        try:
            resp = fetch_json(
                f"{VT_API}/analyses/{analysis_id}",
                headers=headers,
                timeout=20,
            )
            attrs = resp.get("data", {}).get("attributes", {})
            status = attrs.get("status", "")
            if status == "completed":
                return attrs.get("stats", {})
            elif status in ("queued", "in-progress"):
                log(f"  Analysis still {status}, waiting...")
                continue
            else:
                log(f"  Unexpected status: {status}", "warn")
                return None
        except Exception as e:
            log(f"  Poll attempt {attempt+1} failed: {e}", "warn")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
    return None


def main():
    if not API_KEY:
        log("VIRUSTOTAL_API_KEY not set", "err")
        sys.exit(1)

    log("Fetching ISO providers...")
    isos = fetch_provider_isos()
    log(f"Found {len(isos)} ISO source(s)")

    scan_count = 0
    malicious_found = 0
    suspicious_found = 0
    errors = []

    for org, url in isos:
        if scan_count >= MAX_SCANS:
            log(f"Reached max scan limit ({MAX_SCANS}), stopping")
            break

        scan_count += 1
        log(f"[{scan_count}/{MAX_SCANS}] Scanning {org}: {url[:80]}...")

        try:
            # Submit URL to VirusTotal
            analysis_id = submit_url_scan(org, url)
            if not analysis_id:
                log(f"  No analysis ID returned", "warn")
                errors.append(f"{org}: no analysis ID")
                continue

            log(f"  Analysis ID: {analysis_id[:20]}...")
            stats = get_analysis_result(analysis_id)

            if stats is None:
                log(f"  Could not retrieve analysis result", "warn")
                errors.append(f"{org}: analysis timeout")
                continue

            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)
            harmless = stats.get("harmless", 0)
            undetected = stats.get("undetected", 0)
            total = malicious + suspicious + harmless + undetected

            log(f"  Results: {malicious} malicious, {suspicious} suspicious, "
                f"{harmless} harmless, {undetected} undetected (total: {total} engines)")

            if malicious > 0 or suspicious > 0:
                malicious_found += 1
                suspicious_found += 1
                log(
                    f"SECURITY ALERT: {org} — {malicious} malicious, {suspicious} suspicious "
                    f"(ISO: {url})",
                    "err",
                )

            # Rate limit: wait between URL submissions (VT free: ~4/min)
            if scan_count < min(MAX_SCANS, len(isos)):
                log(f"  Waiting {RATE_LIMIT_DELAY}s to respect rate limit...")
                time.sleep(RATE_LIMIT_DELAY)

        except Exception as e:
            log(f"  Scan failed: {e}", "err")
            errors.append(f"{org}: {e}")

    # Summary
    print()
    log("=" * 50)
    log(f"Scan Summary: {scan_count} scanned, "
        f"{malicious_found} malicious, {suspicious_found} suspicious, "
        f"{len(errors)} errors")
    log("=" * 50)

    if malicious_found > 0:
        log(f"{malicious_found} ISO(s) flagged as MALICIOUS", "err")
        sys.exit(1)

    if errors:
        log(f"{len(errors)} scan(s) had errors (see above)", "warn")


if __name__ == "__main__":
    main()
