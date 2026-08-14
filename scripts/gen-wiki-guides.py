#!/usr/bin/env python3
"""
Pre-generate static, crawlable wiki guide pages for popular topics.

Why: the interactive wiki (wiki.html) generates AI guides on demand, but
those guides are invisible to search engines and require a visit. These
static pages give Google/Bing/AI crawlers the actual content to index, so
people find "AcreetionOS WiFi guide" in search results instead of having
to come to the site and ask.

Usage:
    python3 scripts/gen-wiki-guides.py            # all topics
    python3 scripts/gen-wiki-guides.py wifi       # one topic slug

Requires:
    ADMIN_KEY env (SECRET_SAUCE) — the worker's /api/chat admin bypass
    (deployed with the worker; see d9dbd0f). Without it, requests that
    hit reCAPTCHA fail with 403.
"""

import json
import os
import re
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

WORKER_URL = os.environ.get("WORKER_URL", "https://acreetionos.org/api")
ADMIN_KEY = os.environ.get("ADMIN_KEY", "")
OUT_DIR = "wiki-guides"
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "180"))

TOPICS = [
    ("system-maintenance", "System maintenance", "Keeping your AcreetionOS system updated and healthy with pacman, systemd, and regular maintenance."),
    ("installing-software", "Installing software", "How to install software on AcreetionOS using the GUI package manager, pacman, and the AUR."),
    ("wifi", "WiFi", "Connecting to WiFi on AcreetionOS with NetworkManager, including troubleshooting."),
    ("bluetooth", "Bluetooth", "Pairing and using Bluetooth devices on AcreetionOS, plus common fixes."),
    ("printer-setup", "Printer setup", "Setting up a printer on AcreetionOS with CUPS, including driver and network printer notes."),
    ("nvidia-drivers", "NVIDIA drivers", "Installing NVIDIA drivers on AcreetionOS — GUI and terminal methods, plus troubleshooting."),
    ("firewall", "Firewall", "Using the firewall on AcreetionOS to keep your system secure."),
]

GUIDE_SYSTEM_PROMPT = (
    "You are a patient Linux teacher for beginners on AcreetionOS (Cinnamon Desktop, Arch-based). "
    "Write clear step-by-step guides in plain English. GUI first, terminal as \"(Advanced)\". "
    "Format: 1. What is this? 2. What you need 3. Step-by-step 4. Troubleshooting. Markdown only."
)


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def markdown_to_html(md):
    """Very small markdown renderer for the guides (headings, lists, code, bold, links)."""
    lines = md.split("\n")
    out, in_list, in_code = [], False, False
    for line in lines:
        if line.strip().startswith("```"):
            if in_code:
                out.append("</pre>")
                in_code = False
            else:
                out.append("<pre>")
                in_code = True
            continue
        if in_code:
            out.append(esc(line))
            continue
        s = line.strip()
        if not s:
            if in_list:
                out.append("</ul>")
                in_list = False
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            if in_list:
                out.append("</ul>"); in_list = False
            lvl = len(m.group(1))
            out.append(f"<h{lvl+1}>{esc(m.group(2))}</h{lvl+1}>")
            continue
        m = re.match(r"^[-*]\s+(.*)$", s)
        if m:
            if not in_list:
                out.append("<ul>"); in_list = True
            out.append(f"<li>{esc(m.group(1))}</li>")
            continue
        m = re.match(r"^\d+\.\s+(.*)$", s)
        if m:
            if not in_list:
                out.append("<ol>"); in_list = True
            out.append(f"<li>{esc(m.group(1))}</li>")
            continue
        if in_list:
            out.append("</ul>"); in_list = False
        # inline: code, bold
        txt = esc(s)
        txt = re.sub(r"`([^`]+)`", r"<code>\1</code>", txt)
        txt = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", txt)
        out.append(f"<p>{txt}</p>")
    if in_list:
        out.append("</ul>")
    if in_code:
        out.append("</pre>")
    return "\n".join(out)


def fetch_guide(topic_name):
    """Call the worker's /api/chat with the admin key (same endpoint as the wiki)."""
    prompt = (f"## Topic: {topic_name}\n\n"
              f"## Technical Context\nAcreetionOS is an Arch-based Linux distribution with the Cinnamon desktop.\n\n"
              f"## Format\n1. What is this?\n2. What you need\n3. Step-by-step\n4. Troubleshooting\n\nMarkdown only.")
    payload = json.dumps({
        "messages": [
            {"role": "system", "content": GUIDE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 2048,
    }).encode()
    req = Request(f"{WORKER_URL}/chat", data=payload,
                  headers={"Content-Type": "application/json", "X-Admin-Key": ADMIN_KEY})
    with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        return json.loads(resp.read())


def render_page(slug, title, description, content):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)} — AcreetionOS Guide</title>
  <meta name="description" content="{esc(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://acreetionos.org/wiki-guides/{slug}.html">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://acreetionos.org/wiki-guides/{slug}.html">
  <meta property="og:title" content="{esc(title)} — AcreetionOS Guide">
  <meta property="og:site_name" content="AcreetionOS">
  <meta property="og:image" content="https://acreetionos.org/og-image.webp">
  <script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{esc(title)} — AcreetionOS Guide",
  "description": "{esc(description)}",
  "publisher": {{
    "@type": "Organization",
    "name": "AcreetionOS",
    "url": "https://acreetionos.org",
    "logo": {{"@type": "ImageObject", "url": "https://acreetionos.org/logo.webp"}}
  }},
  "mainEntityOfPage": "https://acreetionos.org/wiki-guides/{slug}.html",
  "inLanguage": "en"
}}
  </script>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; color: #ddd; background: #121212; }}
    h1 {{ color: #2ecc71; font-size: 1.7rem; }}
    h2, h3, h4 {{ color: #2ecc71; margin-top: 1.8rem; }}
    pre {{ background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 1rem; overflow-x: auto; }}
    code {{ background: #1a1a1a; padding: .1rem .35rem; border-radius: 4px; font-size: .9em; }}
    a {{ color: #2ecc71; }}
    .back {{ display: block; margin: 1.5rem 0; }}
    .note {{ color: #888; font-size: .85rem; border-top: 1px solid #222; margin-top: 2.5rem; padding-top: 1rem; }}
  </style>
</head>
<body>
  <a class="back" href="../wiki.html">← AcreetionOS Wiki</a>
  <article>
    <h1>{esc(title)}</h1>
    {content}
  </article>
  <p class="note">Generated by AcreetionOS AI (free model routing). Interactive search: <a href="../wiki.html">wiki.acreetionos.org</a> · <a href="../docs.html">Documentation</a></p>
</body>
</html>"""


def build_index(pages):
    rows = "\n".join(
        f'    <li><a href="{slug}.html"><strong>{esc(title)}</strong></a><br><span style="color:#888;font-size:.85rem">{esc(desc)}</span></li>'
        for slug, title, desc in pages
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wiki Guides — AcreetionOS</title>
  <meta name="description" content="AI-generated beginner guides for AcreetionOS: WiFi, NVIDIA drivers, printer setup, Bluetooth, firewall, and more.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://acreetionos.org/wiki-guides/index.html">
  <script type="application/ld+json">
{{"@context":"https://schema.org","@type":"CollectionPage","name":"AcreetionOS Wiki Guides","url":"https://acreetionos.org/wiki-guides/index.html","isPartOf":{{"@id":"https://acreetionos.org/#website"}}}}
  </script>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #ddd; background: #121212; }}
    h1 {{ color: #2ecc71; }}
    ul {{ list-style: none; padding: 0; }}
    li {{ padding: .9rem 0; border-bottom: 1px solid #222; }}
    a {{ color: #2ecc71; text-decoration: none; }}
  </style>
</head>
<body>
  <h1>AcreetionOS Wiki Guides</h1>
  <p>Beginner-friendly, AI-generated guides tailored for AcreetionOS (Cinnamon Desktop, Arch-based).</p>
  <ul>
{rows}
  </ul>
  <p style="margin-top:2rem"><a href="../wiki.html">← Interactive AI wiki search</a></p>
</body>
</html>"""


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    if len(sys.argv) > 1:
        wanted = set(sys.argv[1:])
        topics = [t for t in TOPICS if t[0] in wanted or t[1].lower() in wanted]
    else:
        topics = TOPICS

    generated = []
    for slug, title, desc in topics:
        target = os.path.join(OUT_DIR, f"{slug}.html")
        if os.path.exists(target):
            print(f"  exists: {slug} (keeping — delete to regenerate)")
            generated.append((slug, title, desc))
            continue
        print(f"  generating: {slug} ({title}) ...")
        for attempt in range(3):
            try:
                data = fetch_guide(title)
                content = data.get("content", "").strip()
                if len(content) < 100:
                    raise ValueError("guide too short")
                html_body = markdown_to_html(content)
                page = render_page(slug, title, desc, html_body)
                with open(target, "w") as f:
                    f.write(page)
                print(f"    -> {target} ({len(content)} chars)")
                generated.append((slug, title, desc))
                break
            except HTTPError as e:
                print(f"    attempt {attempt+1} HTTP {e.code}: {e.read().decode()[:120]}", file=sys.stderr)
                if attempt < 2:
                    time.sleep(10)
            except Exception as e:
                print(f"    attempt {attempt+1} failed: {e}", file=sys.stderr)
                if attempt < 2:
                    time.sleep(10)
        else:
            print(f"  FAILED to generate {slug} after 3 attempts", file=sys.stderr)

    if generated:
        with open(os.path.join(OUT_DIR, "index.html"), "w") as f:
            f.write(build_index(generated))
        print(f"index written with {len(generated)} guides")


if __name__ == "__main__":
    main()
