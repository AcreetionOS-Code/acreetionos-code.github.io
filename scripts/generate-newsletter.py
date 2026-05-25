#!/usr/bin/env python3
"""Generate the daily AcreetionOS newsletter using AI."""

import json
import os
import sys
from datetime import date
from urllib.request import Request, urlopen
from urllib.error import URLError

WORKER_URL = os.environ.get("WORKER_URL", "https://acreetionos.org/api")
NEWSLETTER_DIR = os.environ.get("NEWSLETTER_DIR", "newsletters")
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "90"))


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


def load_existing_list(newsletter_dir):
    list_path = os.path.join(newsletter_dir, "list.json")
    if os.path.exists(list_path):
        with open(list_path) as f:
            return json.load(f)
    return []


def save_list(newsletter_dir, entries):
    list_path = os.path.join(newsletter_dir, "list.json")
    entries.sort(key=lambda e: e.get("filename", ""), reverse=True)
    with open(list_path, "w") as f:
        json.dump(entries, f, indent=2)
    print(f"  list.json updated ({len(entries)} newsletters)")


def main():
    today = date.today()
    date_str = today.strftime("%Y-%m-%d")
    date_display = today.strftime("%B %d, %Y")
    filename = os.path.join(NEWSLETTER_DIR, f"{date_str}.json")

    os.makedirs(NEWSLETTER_DIR, exist_ok=True)

    if os.path.exists(filename):
        print(f"Newsletter already exists: {filename}")
        return

    print("Fetching news activity...")
    try:
        news = fetch_json(f"{WORKER_URL}/news")
    except Exception as e:
        print(f"Failed to fetch news: {e}")
        print("Using empty activity data.")
        news = {"articles": [], "activity": []}

    articles = news.get("articles", [])
    activity = news.get("activity", [])

    summary_lines = []
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
        "Keep the total length to about 300–500 words. "
        "Format with plain text, no markdown."
    )
    user_prompt = (
        f"Generate today's AcreetionOS newsletter for {date_display}. "
        f"Here is the recent activity to base it on:\n\n{activity_summary}\n\n"
        f"Write the newsletter body (plain text, no markdown). "
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
                    "max_tokens": 1024,
                }).encode(),
                timeout=120,
            )
            content = (
                ai_response
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if content:
                break
            raise ValueError("Empty AI response")
        except Exception as e:
            print(f"AI generation attempt {attempt + 1} failed ({e})", file=sys.stderr)
            if attempt < 2:
                import time
                time.sleep(5)

    if not content:
        content = (
            f"Daily AcreetionOS Update — {date_display}\n\n"
            "Today's AI-generated newsletter is not available.\n\n"
            "Please check back later for the latest AcreetionOS development updates, "
            "community news, and Linux tips."
        )

    newsletter = {
        "subject": f"Daily AcreetionOS Update — {date_display}",
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
