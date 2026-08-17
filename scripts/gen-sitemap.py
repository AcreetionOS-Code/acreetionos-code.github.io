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
    ("/beginner.html", "monthly", "0.8"),
    ("/blog.html", "daily", "0.9"),
    ("/changelog.html", "weekly", "0.8"),
    ("/community-reviews.html", "monthly", "0.8"),
    ("/compare.html", "monthly", "0.8"),
    ("/contact.html", "yearly", "0.4"),
    ("/contributors.html", "monthly", "0.7"),
    ("/docs.html", "monthly", "0.8"),
    ("/faq.html", "monthly", "0.8"),
    ("/features.html", "monthly", "0.8"),
    ("/flash.html", "monthly", "0.9"),
    ("/git-tracker.html", "weekly", "0.6"),
    ("/governance.html", "monthly", "0.6"),
    ("/hosting.html", "monthly", "0.6"),
    ("/immutable.html", "monthly", "0.7"),
    ("/lightweight.html", "monthly", "0.8"),
    ("/newsletter.html", "weekly", "0.7"),
    ("/privacy.html", "yearly", "0.4"),
    ("/requirements.html", "monthly", "0.7"),
    ("/status.html", "daily", "0.6"),
    ("/unofficial.html", "monthly", "0.6"),
    ("/wiki.html", "monthly", "0.8"),
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


def main():
    today = date.today().isoformat()
    entries = []

    # 1. Main Static Pages
    for path, freq, prio in STATIC_PAGES:
        entries.append(f"""  <url>
    <loc>{BASE}{path}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>""")

    # 2. Reviews Directory & Pages
    for path, freq, prio in REVIEW_PAGES:
        entries.append(f"""  <url>
    <loc>{BASE}{path}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>""")

    # 3. Wiki Guides (Static, crawlable)
    guides = sorted(glob.glob(os.path.join(ROOT, "wiki-guides", "*.html")))
    for g in guides:
        name = os.path.basename(g)
        if name == "index.html":
            entries.append(f"""  <url>
    <loc>{BASE}/wiki-guides/index.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>""")
        else:
            entries.append(f"""  <url>
    <loc>{BASE}/wiki-guides/{name}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>""")

    # 4. Newsletter Archive Pages
    archive = sorted(glob.glob(os.path.join(ROOT, "newsletter-archive", "2026-*.html")))
    for a in archive:
        name = os.path.basename(a)
        entries.append(f"""  <url>
    <loc>{BASE}/newsletter-archive/{name}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>""")

    # 5. Newsletter Archive Index
    entries.append(f"""  <url>
    <loc>{BASE}/newsletter-archive/index.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>""")

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
