#!/usr/bin/env python3
"""Generate the daily AcreetionOS newsletter using AI.

Scrapes ecosystem pages + news activity, sends to Worker API for AI analysis,
saves structured JSON to newsletters/ directory for rendering on newsletter.html.
"""

import json
import os
import re
import sys
import time
from datetime import date
from urllib.request import Request, urlopen
from urllib.error import URLError

WORKER_URL = os.environ.get("WORKER_URL", "https://acreetionos.org/api")
NEWSLETTER_DIR = os.environ.get("NEWSLETTER_DIR", "newsletters")
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "90"))

# Sources to scrape for ecosystem context
ECOSYSTEM_PAGES = [
    ("acreetionos.org", "https://acreetionos.org"),
    ("natalie.acreetionos.org", "https://natalie.acreetionos.org"),
    ("darren.acreetionos.org", "https://darren.acreetionos.org"),
    ("GitHub: AcreetionOS-Code", "https://github.com/AcreetionOS-Code"),
    ("GitHub: spivanatalie64", "https://github.com/spivanatalie64"),
    ("GitHub: cobra3282000", "https://github.com/cobra3282000"),
    ("GitLab: cobra3282000", "https://gitlab.acreetionos.org/cobra3282000"),
    ("GitLab: natalie", "https://gitlab.acreetionos.org/natalie"),
]


def fetch_text(url, timeout=None):
    """Fetch a URL and return the text content, or None on failure."""
    req = Request(url, headers={"User-Agent": "AcreetionOS-Newsletter-Bot/1.0"})
    try:
        with urlopen(req, timeout=timeout or REQUEST_TIMEOUT) as resp:
            raw = resp.read()
            # Try to decode as UTF-8, fall back to latin-1
            try:
                return raw.decode("utf-8", errors="replace")
            except Exception:
                return raw.decode("latin-1")
    except Exception as e:
        print(f"  Failed to fetch {url}: {e}", file=sys.stderr)
        return None


def fetch_json(url, data=None, timeout=None):
    req = Request(url, data=data, headers={"User-Agent": "AcreetionOS-Newsletter-Bot/1.0"})
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urlopen(req, timeout=timeout or REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read())
    except URLError as e:
        print(f"  HTTP error: {e.status} {e.reason}", file=sys.stderr)
        raise
    except Exception as e:
        print(f"  Request failed: {e}", file=sys.stderr)
        raise


def strip_html(html):
    """Strip HTML tags, collapse whitespace, truncate to reasonable length."""
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    # Truncate to avoid blowing token limits
    if len(text) > 3000:
        text = text[:3000] + "..."
    return text


def load_existing_list(newsletter_dir):
    list_path = os.path.join(newsletter_dir, "list.json")
    if os.path.exists(list_path):
        with open(list_path) as f:
            return json.load(f)
    return []


def save_list(newsletter_dir, entries):
    list_path = os.path.join(newsletter_dir, "list.json")
    # Deduplicate by filename, keeping the last occurrence
    seen = {}
    for e in entries:
        seen[e.get("filename", "")] = e
    entries = list(seen.values())
    entries.sort(key=lambda e: e.get("filename", ""), reverse=True)
    with open(list_path, "w") as f:
        json.dump(entries, f, indent=2)
    print(f"  list.json updated ({len(entries)} newsletters)")


def scrape_ecosystem():
    """Scrape ecosystem pages and return a summary."""
    print("Scraping AcreetionOS ecosystem pages...")
    parts = []
    for name, url in ECOSYSTEM_PAGES:
        print(f"  Fetching {name}...")
        html = fetch_text(url, timeout=30)
        if html:
            text = strip_html(html)
            parts.append(f"=== {name} ===\n{text}")
        else:
            parts.append(f"=== {name} ===\n(Unavailable)")
    return "\n\n".join(parts)


def fetch_news_activity():
    """Fetch structured news/activity from the Worker API."""
    print("Fetching news activity from Worker API...")
    try:
        return fetch_json(f"{WORKER_URL}/news")
    except Exception as e:
        print(f"Failed to fetch news: {e}", file=sys.stderr)
        return {"articles": [], "activity": []}


def main():
    today = date.today()
    date_str = today.strftime("%Y-%m-%d")
    date_display = today.strftime("%B %d, %Y")
    filename = os.path.join(NEWSLETTER_DIR, f"{date_str}.json")

    os.makedirs(NEWSLETTER_DIR, exist_ok=True)

    if os.path.exists(filename):
        print(f"Newsletter already exists: {filename}")
        return

    # --- Scrape ecosystem pages for rich context ---
    ecosystem_text = scrape_ecosystem()

    # --- Fetch structured news activity ---
    news = fetch_news_activity()
    articles = news.get("articles", [])
    activity = news.get("activity", [])

    summary_lines = []
    summary_lines.append("=== Recent Activity ===")
    for a in articles[:6]:
        summary_lines.append(f"- [{a.get('tag', 'News')}] {a.get('title', '')}: {a.get('desc', '')}")
    for a in activity[:10]:
        summary_lines.append(f"- [{a.get('type', 'Activity')}] {a.get('message', '')} in {a.get('repo', '')}")

    activity_summary = "\n".join(summary_lines) if summary_lines else "No recent activity found."

    print("Generating newsletter with AI...")
    system_prompt = (
        "You are the AcreetionOS newsletter writer. "
        "Write a daily newsletter update in a professional but friendly tone. "
        "Include sections for: 1) Development Updates, 2) Community News, 3) Tips & Highlights. "
        "Write exactly 9 paragraphs. Each paragraph should be 2-4 sentences. "
        "Use plain text, no markdown, no bullet lists."
    )
    user_prompt = (
        f"Generate today's AcreetionOS newsletter for {date_display}.\n\n"
        f"Here is the current ecosystem state:\n\n"
        f"{ecosystem_text}\n\n"
        f"Here is the recent development activity:\n\n{activity_summary}\n\n"
        f"Write the newsletter body (plain text, no markdown, exactly 9 paragraphs). "
        f"Start with a subject line like 'Daily AcreetionOS Update - {date_display}'."
    )

    content = None
    for attempt in range(3):
        try:
            ai_response = fetch_json(
                f"{WORKER_URL}/news/ai",
                data=json.dumps({
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": 4096,
                }).encode(),
                timeout=180,
            )
            # Worker /api/news/ai returns { content, model }, NOT OpenRouter format
            content = (
                ai_response.get("content", "")
                .strip()
            )
            if content:
                break
            raise ValueError("Empty AI response")
        except Exception as e:
            print(f"AI generation attempt {attempt + 1} failed ({e})", file=sys.stderr)
            if attempt < 2:
                time.sleep(5)

    if not content:
        content = (
            f"Daily AcreetionOS Update -- {date_display}\n\n"
            "Today's AI-generated newsletter is not available.\n\n"
            "Please check back later for the latest AcreetionOS development updates, "
            "community news, and Linux tips."
        )

    newsletter = {
        "subject": f"Daily AcreetionOS Update -- {date_display}",
        "date_display": date_display,
        "body": content,
    }

    with open(filename, "w") as f:
        json.dump(newsletter, f, indent=2)
    print(f"Saved: {filename}")

    entries = load_existing_list(NEWSLETTER_DIR)
    entries.append({
        "filename": f"{date_str}.json",
        "subject": newsletter["subject"],
        "date_display": date_display,
    })
    save_list(NEWSLETTER_DIR, entries)


if __name__ == "__main__":
    main()
