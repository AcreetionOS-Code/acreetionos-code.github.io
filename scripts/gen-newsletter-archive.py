#!/usr/bin/env python3
"""
Generate and update all static HTML pages in newsletter-archive/ from newsletters/*.json.

Ensures:
  - Every newsletter has an HTML page with full OpenGraph, Twitter Cards, and NewsArticle JSON-LD.
  - newsletter-archive/index.html is completely up-to-date with all newsletters.
  - Prevents 404s and crawl exclusions.

Usage:
    python3 scripts/gen-newsletter-archive.py
"""

import glob
import html
import json
import os
import re
from datetime import datetime

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWSLETTER_DIR = os.path.join(ROOT_DIR, "newsletters")
ARCHIVE_DIR = os.path.join(ROOT_DIR, "newsletter-archive")
BASE_URL = "https://acreetionos.org"


def markdown_to_html(text):
    """Simple converter for newsletter markdown content to clean semantic HTML."""
    if not text:
        return ""
    paras = text.split("\n\n")
    out = []
    for p in paras:
        p = p.strip()
        if not p:
            continue
        # Convert headers
        if p.startswith("### "):
            out.append(f"<h3>{html.escape(p[4:])}</h3>")
        elif p.startswith("## "):
            out.append(f"<h2>{html.escape(p[3:])}</h2>")
        elif p.startswith("# "):
            out.append(f"<h2>{html.escape(p[2:])}</h2>")
        elif p.startswith("* ") or p.startswith("- "):
            # Bullet list
            items = [line.strip()[2:] for line in p.split("\n") if line.strip().startswith(("* ", "- "))]
            items_html = "".join(f"<li>{html.escape(item)}</li>" for item in items)
            out.append(f"<ul>{items_html}</ul>")
        else:
            # Inline bold / code / links
            clean = html.escape(p)
            clean = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", clean)
            clean = re.sub(r"`([^`]+)`", r"<code>\1</code>", clean)
            clean = re.sub(r"(https?://[^\s]+)", r'<a href="\1" target="_blank" rel="noopener noreferrer">\1</a>', clean)
            out.append(f"<p>{clean}</p>")
    return "\n".join(out)


def get_first_paragraph_snippet(body_text, max_len=150):
    if not body_text:
        return "Daily update from the AcreetionOS Linux development team and community."
    cleaned = re.sub(r"[#*`]", "", body_text)
    paras = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    if paras:
        snippet = " ".join(paras[0].split())
        if len(snippet) > max_len:
            snippet = snippet[:max_len - 3] + "..."
        return snippet
    return "Daily update from the AcreetionOS Linux development team and community."


def render_issue_html(date_str, data):
    subject = data.get("subject", f"Daily AcreetionOS Update -- {date_str}")
    date_display = data.get("date_display", date_str)
    body = data.get("body", "")
    content_html = markdown_to_html(body)
    snippet = get_first_paragraph_snippet(body, 150)
    meta_desc = f"{subject} — {snippet}"
    if len(meta_desc) > 160:
        meta_desc = meta_desc[:157] + "..."

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="msvalidate.01" content="8738943710B70112309DBE6476B55A91">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <title>{html.escape(subject)} | AcreetionOS Newsletter</title>
  <meta name="description" content="{html.escape(meta_desc)}">
  <link rel="canonical" href="{BASE_URL}/newsletter-archive/{date_str}.html">
  <link rel="alternate" type="application/atom+xml" title="AcreetionOS News" href="{BASE_URL}/feed.xml">

  <!-- OpenGraph -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="{BASE_URL}/newsletter-archive/{date_str}.html">
  <meta property="og:title" content="{html.escape(subject)}">
  <meta property="og:description" content="{html.escape(meta_desc)}">
  <meta property="og:site_name" content="AcreetionOS">
  <meta property="og:image" content="{BASE_URL}/og-image.png">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@acreetionos">
  <meta name="twitter:title" content="{html.escape(subject)}">
  <meta name="twitter:description" content="{html.escape(meta_desc)}">
  <meta name="twitter:image" content="{BASE_URL}/og-image.png">

  <link rel="icon" type="image/webp" href="../acreetionoslogo.webp">
  <link rel="stylesheet" href="../fonts.css">

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "NewsArticle",
        "@id": "{BASE_URL}/newsletter-archive/{date_str}.html#article",
        "headline": "{html.escape(subject)}",
        "datePublished": "{date_str}",
        "dateModified": "{date_str}",
        "description": "{html.escape(meta_desc)}",
        "publisher": {{
          "@type": "Organization",
          "name": "AcreetionOS",
          "url": "{BASE_URL}",
          "logo": {{
            "@type": "ImageObject",
            "url": "{BASE_URL}/logo.webp"
          }}
        }},
        "mainEntityOfPage": "{BASE_URL}/newsletter-archive/{date_str}.html",
        "inLanguage": "en"
      }},
      {{
        "@type": "BreadcrumbList",
        "@id": "{BASE_URL}/newsletter-archive/{date_str}.html#breadcrumb",
        "itemListElement": [
          {{
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "{BASE_URL}/"
          }},
          {{
            "@type": "ListItem",
            "position": 2,
            "name": "Newsletter",
            "item": "{BASE_URL}/newsletter.html"
          }},
          {{
            "@type": "ListItem",
            "position": 3,
            "name": "Archive",
            "item": "{BASE_URL}/newsletter-archive/index.html"
          }},
          {{
            "@type": "ListItem",
            "position": 4,
            "name": "{date_str}",
            "item": "{BASE_URL}/newsletter-archive/{date_str}.html"
          }}
        ]
      }}
    ]
  }}
  </script>

  <style>
    :root {{
      --green: #2ecc71;
      --bg: #121212;
      --panel: #1a1a1a;
      --border: #333;
      --text: #ddd;
      --muted: #888;
      --font-sans: 'Roboto', system-ui, sans-serif;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      font-family: var(--font-sans);
      max-width: 740px;
      margin: 2rem auto;
      padding: 0 1.25rem 3rem;
      line-height: 1.7;
      color: var(--text);
      background: var(--bg);
    }}
    h1 {{ color: var(--green); font-size: 1.75rem; margin-bottom: 0.25rem; }}
    h2 {{ color: var(--green); font-size: 1.3rem; margin-top: 1.8rem; margin-bottom: 0.5rem; }}
    h3 {{ color: #a3e635; font-size: 1.1rem; margin-top: 1.2rem; }}
    .date {{ color: var(--muted); font-size: 0.95rem; margin-bottom: 1.75rem; }}
    p {{ margin: 0.85rem 0; }}
    ul {{ margin: 0.85rem 0 1rem 1.75rem; }}
    li {{ margin-bottom: 0.4rem; }}
    a {{ color: var(--green); text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    .back {{ display: inline-block; margin-bottom: 1.5rem; font-weight: 500; }}
    .breadcrumbs {{ font-size: 0.85rem; color: var(--muted); margin-bottom: 1.5rem; }}
    .breadcrumbs a {{ color: var(--muted); }}
    .breadcrumbs a:hover {{ color: var(--green); }}
    footer {{
      margin-top: 3.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.88rem;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
    }}
  </style>
</head>
<body>
  <div class="breadcrumbs">
    <a href="../index.html">Home</a> &gt; <a href="../newsletter.html">Newsletter</a> &gt; <a href="index.html">Archive</a> &gt; <span>{date_str}</span>
  </div>

  <a class="back" href="index.html">← All newsletters</a>

  <article>
    <h1>{html.escape(subject)}</h1>
    <div class="date">{html.escape(date_display)}</div>
    {content_html}
  </article>

  <a class="back" style="margin-top: 2rem;" href="index.html">← Back to all newsletters</a>

  <footer>
    <div>&copy; 2026 AcreetionOS Project. Open Source under GPLv3.</div>
    <div>
      <a href="../newsletter.html">Subscribe</a> · <a href="../feed.xml">RSS Feed</a> · <a href="../index.html">Home</a>
    </div>
  </footer>
</body>
</html>"""


def render_archive_index(entries):
    rows = []
    for e in entries:
        filename = e.get("filename", "")
        slug = os.path.splitext(filename)[0]
        subject = e.get("subject", f"AcreetionOS Update ({slug})")
        date_display = e.get("date_display", slug)
        rows.append(f"""    <li class="archive-item">
      <div class="date">{html.escape(date_display)}</div>
      <a href="{slug}.html"><strong>{html.escape(subject)}</strong></a>
    </li>""")

    items_html = "\n".join(rows)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="msvalidate.01" content="8738943710B70112309DBE6476B55A91">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <title>AcreetionOS Daily Newsletter Archive – Project News & Updates</title>
  <meta name="description" content="Browse the complete archive of daily AcreetionOS newsletters. Track Arch Linux distribution updates, development commits, community news, and tips.">
  <meta name="keywords" content="AcreetionOS newsletter archive, Linux distro news, Arch Linux daily updates, open source newsletter">
  <link rel="canonical" href="{BASE_URL}/newsletter-archive/index.html">
  <link rel="alternate" type="application/atom+xml" title="AcreetionOS News" href="{BASE_URL}/feed.xml">

  <!-- OpenGraph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="{BASE_URL}/newsletter-archive/index.html">
  <meta property="og:title" content="AcreetionOS Daily Newsletter Archive">
  <meta property="og:description" content="Browse the complete archive of daily AcreetionOS newsletters and development updates.">
  <meta property="og:image" content="{BASE_URL}/og-image.png">
  <meta property="og:site_name" content="AcreetionOS">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@acreetionos">
  <meta name="twitter:title" content="AcreetionOS Daily Newsletter Archive">
  <meta name="twitter:description" content="Browse all daily updates and community newsletters for AcreetionOS.">
  <meta name="twitter:image" content="{BASE_URL}/og-image.png">

  <link rel="icon" type="image/webp" href="../acreetionoslogo.webp">
  <link rel="stylesheet" href="../fonts.css">

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "CollectionPage",
        "@id": "{BASE_URL}/newsletter-archive/index.html#collection",
        "name": "AcreetionOS Daily Newsletter Archive",
        "description": "Complete historical archive of daily AcreetionOS project newsletters and updates.",
        "url": "{BASE_URL}/newsletter-archive/index.html",
        "isPartOf": {{
          "@id": "{BASE_URL}/#website"
        }}
      }},
      {{
        "@type": "BreadcrumbList",
        "@id": "{BASE_URL}/newsletter-archive/index.html#breadcrumb",
        "itemListElement": [
          {{
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "{BASE_URL}/"
          }},
          {{
            "@type": "ListItem",
            "position": 2,
            "name": "Newsletter",
            "item": "{BASE_URL}/newsletter.html"
          }},
          {{
            "@type": "ListItem",
            "position": 3,
            "name": "Archive",
            "item": "{BASE_URL}/newsletter-archive/index.html"
          }}
        ]
      }}
    ]
  }}
  </script>

  <style>
    :root {{
      --green: #2ecc71;
      --bg: #121212;
      --panel: #1a1a1a;
      --border: #333;
      --text: #ddd;
      --muted: #888;
      --font-sans: 'Roboto', system-ui, sans-serif;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      font-family: var(--font-sans);
      max-width: 780px;
      margin: 2rem auto;
      padding: 0 1.25rem 3rem;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
    }}
    h1 {{ color: var(--green); font-size: 1.9rem; margin-bottom: 0.5rem; }}
    .lead {{ color: var(--muted); font-size: 1.05rem; margin-bottom: 2rem; }}
    .breadcrumbs {{ font-size: 0.85rem; color: var(--muted); margin-bottom: 1.5rem; }}
    .breadcrumbs a {{ color: var(--muted); text-decoration: none; }}
    .breadcrumbs a:hover {{ color: var(--green); }}
    ul.archive-list {{ list-style: none; padding: 0; }}
    .archive-item {{
      padding: 0.9rem 0;
      border-bottom: 1px solid #222;
      display: flex;
      align-items: baseline;
      gap: 1.2rem;
      flex-wrap: wrap;
    }}
    .archive-item .date {{
      color: var(--muted);
      font-size: 0.88rem;
      min-width: 140px;
    }}
    .archive-item a {{
      color: var(--green);
      text-decoration: none;
      font-size: 1.02rem;
    }}
    .archive-item a:hover {{ text-decoration: underline; }}
    footer {{
      margin-top: 3.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.88rem;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
    }}
    footer a {{ color: var(--green); text-decoration: none; }}
  </style>
</head>
<body>
  <div class="breadcrumbs">
    <a href="../index.html">Home</a> &gt; <a href="../newsletter.html">Newsletter</a> &gt; <span>Archive</span>
  </div>

  <h1>AcreetionOS Daily Newsletter Archive</h1>
  <p class="lead">Historical record of daily development updates, Linux ecosystem highlights, and community announcements.</p>

  <ul class="archive-list">
{items_html}
  </ul>

  <footer>
    <div>&copy; 2026 AcreetionOS Project. Open Source under GPLv3.</div>
    <div>
      <a href="../newsletter.html">Subscribe</a> · <a href="../feed.xml">RSS Feed</a> · <a href="../index.html">Home</a>
    </div>
  </footer>
</body>
</html>"""


def main():
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    json_files = sorted(glob.glob(os.path.join(NEWSLETTER_DIR, "2026-*.json")), reverse=True)
    print(f"Found {len(json_files)} newsletter JSON files in '{NEWSLETTER_DIR}'...")

    entries = []
    for jf in json_files:
        basename = os.path.basename(jf)
        date_str = os.path.splitext(basename)[0]
        try:
            with open(jf, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  Error reading {jf}: {e}", file=sys.stderr)
            continue

        entries.append({
            "filename": basename,
            "subject": data.get("subject", f"AcreetionOS Update ({date_str})"),
            "date_display": data.get("date_display", date_str),
        })

        out_html = os.path.join(ARCHIVE_DIR, f"{date_str}.html")
        html_content = render_issue_html(date_str, data)
        with open(out_html, "w", encoding="utf-8") as f:
            f.write(html_content)

    print(f"Generated {len(entries)} newsletter HTML issue pages.")

    index_html = render_archive_index(entries)
    index_path = os.path.join(ARCHIVE_DIR, "index.html")
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(index_html)
    print(f"Updated: newsletter-archive/index.html with {len(entries)} entries.")


if __name__ == "__main__":
    main()
