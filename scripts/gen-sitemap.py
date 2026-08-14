#!/usr/bin/env python3
"""Generate sitemap.xml for acreetionos.org.

Includes: all static HTML pages, the wiki guides, and EVERY newsletter
archive page (previously only the recent ~21 made it in — the rest were
invisible to crawlers).

Usage: python3 scripts/gen-sitemap.py
"""
import glob
import json
import os
from datetime import date

BASE = "https://acreetionos.org"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Static pages: (path, changefreq, priority)
STATIC = [
    ("/", "daily", "1.0"),
    ("/about.html", "monthly", "0.8"),
    ("/beginner.html", "monthly", "0.8"),
    ("/changelog.html", "weekly", "0.7"),
    ("/compare.html", "monthly", "0.8"),
    ("/contact.html", "yearly", "0.3"),
    ("/contributors.html", "monthly", "0.6"),
    ("/docs.html", "monthly", "0.8"),
    ("/faq.html", "monthly", "0.8"),
    ("/features.html", "monthly", "0.8"),
    ("/flash.html", "monthly", "0.8"),
    ("/git-tracker.html", "weekly", "0.5"),
    ("/governance.html", "monthly", "0.6"),
    ("/hosting.html", "monthly", "0.6"),
    ("/immutable.html", "monthly", "0.7"),
    ("/lightweight.html", "monthly", "0.7"),
    ("/newsletter.html", "weekly", "0.6"),
    ("/privacy.html", "yearly", "0.3"),
    ("/requirements.html", "monthly", "0.7"),
    ("/status.html", "daily", "0.5"),
    ("/unofficial.html", "monthly", "0.5"),
    ("/wiki.html", "monthly", "0.8"),
    ("/blog.html", "daily", "0.9"),
]

# Wiki guides (static, crawlable)
guides = sorted(glob.glob(os.path.join(ROOT, "wiki-guides", "*.html")))
for g in guides:
    name = os.path.basename(g)
    if name == "index.html":
        STATIC.append(("/wiki-guides/index.html", "weekly", "0.7"))
    else:
        STATIC.append((f"/wiki-guides/{name}", "monthly", "0.6"))

# Newsletter archive: EVERY page
archive = sorted(glob.glob(os.path.join(ROOT, "newsletter-archive", "2026-*.html")))

today = date.today().isoformat()

entries = []
for path, freq, prio in STATIC:
    entries.append(f"""  <url>
    <loc>{BASE}{path}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>""")

for a in archive:
    name = os.path.basename(a)
    entries.append(f"""  <url>
    <loc>{BASE}/newsletter-archive/{name}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>""")

# The archive index itself
entries.append(f"""  <url>
    <loc>{BASE}/newsletter-archive/index.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>""")

xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(entries)}
</urlset>
"""

with open(os.path.join(ROOT, "sitemap.xml"), "w") as f:
    f.write(xml)

print(f"sitemap.xml: {len(STATIC)} static + {len(archive)} newsletter + 1 index = {len(entries)} URLs")
