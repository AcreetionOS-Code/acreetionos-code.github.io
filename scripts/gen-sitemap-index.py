#!/usr/bin/env python3
"""
Generate sitemap_index.xml for acreetionos.org.

A sitemap index is the only mechanism that lets the apex advertise sitemaps that
live on other hosts. Without it, every subdomain sitemap is orphaned: the apex
robots.txt declares only acreetionos.org/sitemap.xml, so a crawler has no path
from the apex to docs./wiki./iso.

This matters most for docs.acreetionos.org, which serves a sitemap index of its
own covering 93 URLs (wiki 39, admin-guide 21, install-guide 12, contributor 10,
editions 6, release-notes 5). Those pages are published, crawlable, and have an
open robots.txt — they are simply unreachable from the apex. Nesting a sitemap
index inside a sitemap index is explicitly permitted by the sitemaps.org spec,
so pointing at docs.acreetionos.org/sitemap.xml is valid.

lastmod is emitted only for the apex entry, where it is read from the local
sitemap.xml mtime and is therefore actually true. The spec makes it optional and
a sitemap-index lastmod is only a hint, so inventing dates for the remote
subdomains would be noise. Update those by hand when a subdomain republishes.

Usage:
    python3 scripts/gen-sitemap-index.py
"""

import os
from datetime import date

BASE = "https://acreetionos.org"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Subdomain sitemaps to advertise from the apex. (loc, use_local_mtime)
# The apex entry reads sitemap.xml's mtime; the rest are remote and omit lastmod.
SUBORDINATE_SITEMAPS = [
    (f"{BASE}/sitemap.xml", True),
    ("https://docs.acreetionos.org/sitemap.xml", False),
    ("https://wiki.acreetionos.org/sitemap.xml", False),
    ("https://iso.acreetionos.org/sitemap.xml", False),
]


def main():
    apex_sitemap = os.path.join(ROOT, "sitemap.xml")
    entries = []

    for loc, use_local_mtime in SUBORDINATE_SITEMAPS:
        if use_local_mtime and os.path.exists(apex_sitemap):
            stamp = date.fromtimestamp(os.path.getmtime(apex_sitemap)).isoformat()
            entries.append(f"""<sitemap>
<loc>{loc}</loc>
<lastmod>{stamp}</lastmod>
</sitemap>""")
        else:
            entries.append(f"""<sitemap>
<loc>{loc}</loc>
</sitemap>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(entries)}
</sitemapindex>
"""

    out_file = os.path.join(ROOT, "sitemap_index.xml")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(xml)

    print(f"Generated sitemap_index.xml with {len(entries)} sitemaps at {out_file}")


if __name__ == "__main__":
    main()
