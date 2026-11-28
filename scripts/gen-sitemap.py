#!/usr/bin/env python3
"""
Generate sitemap.xml for acreetionos.org.

Includes:
  - All primary static HTML content pages
  - All video review pages and reviews directory
  - All static wiki guides
  - Every daily newsletter archive page and the newsletter archive index

Usage:
    python3 scripts/gen-sitemap.py
"""

import glob
import os
from datetime import date

BASE = "https://acreetionos.org"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Static pages: (path, changefreq, priority)
STATIC_PAGES = [
    ("/", "daily", "1.0"),
    ("/about.html", "monthly", "0.8"),
    ("/announcement-2026-11.html", "monthly", "0.9"),
    ("/beginner.html", "monthly", "0.8"),
    ("/blog.html", "daily", "0.9"),
    ("/changelog.html", "weekly", "0.8"),
    ("/community-reviews.html", "monthly", "0.8"),
    ("/community.html", "monthly", "0.7"),
    ("/compare.html", "monthly", "0.8"),
    ("/contact.html", "yearly", "0.4"),
    ("/contributors.html", "monthly", "0.7"),
    ("/docs.html", "monthly", "0.8"),
    ("/faq.html", "monthly", "0.8"),
    ("/features.html", "monthly", "0.8"),
    ("/flash.html", "monthly", "0.9"),
    ("/governance.html", "monthly", "0.6"),
    ("/hosting.html", "monthly", "0.6"),
    ("/immutable.html", "monthly", "0.7"),
    ("/lightweight.html", "monthly", "0.8"),
    ("/mirrors.html", "weekly", "0.8"),
    ("/newsletter.html", "weekly", "0.7"),
    ("/analytics.html", "yearly", "0.4"),
    ("/privacy.html", "yearly", "0.4"),
    ("/private-browsing-myths.html", "monthly", "0.6"),
    ("/how-it-works.html", "monthly", "0.6"),
    ("/requirements.html", "monthly", "0.7"),
    ("/status.html", "daily", "0.6"),
    ("/translator.html", "monthly", "0.7"),
    ("/unofficial.html", "monthly", "0.6"),
]

# Video review pages
REVIEW_PAGES = [
    ("/Reviews/", "weekly", "0.7"),
    ("/Reviews/index.html", "weekly", "0.7"),
    ("/Reviews/DjYcoqAfz7w.html", "monthly", "0.6"),
    ("/Reviews/IRwD-U4uVPo.html", "monthly", "0.6"),
    ("/Reviews/UUKP5SS9m9M.html", "monthly", "0.6"),
    ("/Reviews/xCvXtSuNHRw.html", "monthly", "0.6"),
]


def file_lastmod(rel_path):
    """Last-modified date (YYYY-MM-DD) of a repo file, or None if unknown."""
    try:
        mtime = os.path.getmtime(os.path.join(ROOT, rel_path))
    except OSError:
        return None
    return date.fromtimestamp(mtime).isoformat()


def url_entry(loc, freq, prio, rel_path):
    """One <url> entry; <lastmod> is the backing file's real mtime date,
    omitted when the file (and therefore the date) is unknown."""
    lines = ["  <url>", f"    <loc>{loc}</loc>"]
    lastmod = file_lastmod(rel_path)
    if lastmod:
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
    lines.append(f"    <changefreq>{freq}</changefreq>")
    lines.append(f"    <priority>{prio}</priority>")
    lines.append("  </url>")
    return "\n".join(lines)


def main():
    entries = []

    # 1. Main Static Pages
    for path, freq, prio in STATIC_PAGES:
        rel = "index.html" if path == "/" else path.lstrip("/")
        entries.append(url_entry(f"{BASE}{path}", freq, prio, rel))

    # 2. Reviews Directory & Pages
    for path, freq, prio in REVIEW_PAGES:
        rel = "Reviews/index.html" if path == "/Reviews/" else path.lstrip("/")
        entries.append(url_entry(f"{BASE}{path}", freq, prio, rel))

    # 3. Wiki Guides (Static, crawlable)
    guides = sorted(glob.glob(os.path.join(ROOT, "wiki-guides", "*.html")))
    for guide in guides:
        name = os.path.basename(guide)
        freq = "weekly" if name == "index.html" else "monthly"
        entries.append(url_entry(f"{BASE}/wiki-guides/{name}", freq, "0.7", f"wiki-guides/{name}"))

    # 4. Newsletter Archive Pages
    archive = sorted(glob.glob(os.path.join(ROOT, "newsletter-archive", "2026-*.html")))
    for page in archive:
        name = os.path.basename(page)
        entries.append(url_entry(f"{BASE}/newsletter-archive/{name}", "yearly", "0.5", f"newsletter-archive/{name}"))

    # 5. Newsletter Archive Index
    entries.append(url_entry(f"{BASE}/newsletter-archive/index.html", "daily", "0.8", "newsletter-archive/index.html"))

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(entries)}
</urlset>
"""

    out_file = os.path.join(ROOT, "sitemap.xml")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(xml)

    print(f"Generated sitemap.xml with {len(entries)} URLs at {out_file}")


if __name__ == "__main__":
    main()
