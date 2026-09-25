#!/usr/bin/env python3
"""
Generate feed.xml (Atom 1.0) for acreetionos.org from newsletters/*.json.

Why this exists: feed.xml was originally a one-off snapshot added in
55477f0 ("feat(seo): Atom feed + newsletter archive static links") and was
never wired into any workflow, so it silently froze at 2026-08-14 while the
newsletter pipeline kept producing daily issues. This script makes the feed a
build artifact of the same pipeline that produces the issues.

Format is kept byte-compatible with the original hand-built feed so existing
subscribers see no change:
  - Atom 1.0, <entry> elements, newest first
  - <id>tag:acreetionos.org,YYYY-MM-DD:newsletter</id>
  - <summary> = body with blank lines collapsed to two spaces, cut to 300
    characters, with a trailing ellipsis

Only issues that have a corresponding newsletter-archive/<date>.html page are
included, so the feed can never advertise a dead link.

Usage:
    python3 scripts/gen-feed.py

Environment:
    NEWSLETTER_DIR — default "newsletters"
    ARCHIVE_DIR    — default "newsletter-archive"
    FEED_MAX_ENTRIES — default 150 (most recent N issues to keep in the feed).
        Set high enough that every entry ever published in feed.xml survives a
        regeneration; it only starts trimming once the backlog exceeds it.
        Lower it to trim history — nothing is lost, the archive index and
        sitemap.xml still link every issue.
"""

import glob
import html
import json
import os
import re
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWSLETTER_DIR = os.environ.get("NEWSLETTER_DIR") or os.path.join(ROOT_DIR, "newsletters")
ARCHIVE_DIR = os.environ.get("ARCHIVE_DIR") or os.path.join(ROOT_DIR, "newsletter-archive")
FEED_FILE = os.path.join(ROOT_DIR, "feed.xml")

BASE_URL = "https://acreetionos.org"
SUMMARY_MAX = 300


def build_summary(body, max_len=SUMMARY_MAX):
    """Flatten newsletter markdown to a plain-text summary and truncate.

    The original hand-built feed predates markdown bodies and could just cut
    the raw text. Recent issues are written in markdown, so emphasis, heading
    and list markers are stripped first (same treatment as the snippets in
    gen-newsletter-archive.py) — otherwise every reader shows literal '**'.
    """
    if not body:
        return "Daily update from the AcreetionOS Linux development team and community."

    text = body
    # Headings and list bullets become plain paragraph text.
    text = re.sub(r"^\s{0,3}#{1,6}\s+", "", text, flags=re.M)
    text = re.sub(r"^\s{0,3}[-*+]\s+", "", text, flags=re.M)
    # Emphasis, inline code and links.
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    text = text.replace("**", "").replace("__", "")
    text = text.replace("`", "")
    # Collapse all line breaks and runs of whitespace into single spaces.
    flat = " ".join(text.split())

    if len(flat) > max_len:
        flat = flat[:max_len] + "\u2026"
    return flat


def load_issues(newsletter_dir, archive_dir):
    """Return [(date_str, subject, summary)] newest first, skipping broken input."""
    issues = []
    skipped = []

    for path in sorted(glob.glob(os.path.join(newsletter_dir, "2026-*.json"))):
        date_str = os.path.basename(path)[:-5]

        # Only publish an entry once its static archive page exists, otherwise
        # the feed would link to a 404.
        if not os.path.exists(os.path.join(archive_dir, f"{date_str}.html")):
            skipped.append((date_str, "no archive page yet"))
            continue

        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError) as exc:
            skipped.append((date_str, f"unreadable JSON ({exc})"))
            continue

        subject = data.get("subject") or f"Daily AcreetionOS Update -- {date_str}"
        issues.append((date_str, subject, build_summary(data.get("body", ""))))

    # glob sorts ascending by date; the feed wants newest first.
    issues.reverse()
    return issues, skipped


def render_feed(issues):
    updated = f"{issues[0][0]}T00:00:00Z" if issues else ""

    entries = []
    for date_str, subject, summary in issues:
        entries.append(
            f"""  <entry>
    <title>{html.escape(subject)}</title>
    <link href="{BASE_URL}/newsletter-archive/{date_str}.html"/>
    <id>tag:acreetionos.org,{date_str}:newsletter</id>
    <updated>{date_str}T00:00:00Z</updated>
    <published>{date_str}T00:00:00Z</published>
    <summary>{html.escape(summary)}</summary>
  </entry>"""
        )

    return f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>AcreetionOS \u2014 News &amp; Updates</title>
  <subtitle>Daily project updates from the AcreetionOS team \u2014 an independent, privacy-focused Arch Linux distribution.</subtitle>
  <link href="{BASE_URL}/"/>
  <link rel="self" href="{BASE_URL}/feed.xml"/>
  <updated>{updated}</updated>
  <author><name>AcreetionOS Team</name><uri>{BASE_URL}/about.html</uri></author>
  <id>tag:acreetionos.org,2026:feed</id>
{chr(10).join(entries)}
</feed>
"""


def main():
    try:
        max_entries = int(os.environ.get("FEED_MAX_ENTRIES", "150"))
    except ValueError:
        print("FEED_MAX_ENTRIES is not an integer; defaulting to 150", file=sys.stderr)
        max_entries = 150

    issues, skipped = load_issues(NEWSLETTER_DIR, ARCHIVE_DIR)
    if not issues:
        print("No newsletters with archive pages found; refusing to clobber feed.xml", file=sys.stderr)
        return 1

    for date_str, reason in skipped:
        print(f"  skipping {date_str}: {reason}", file=sys.stderr)

    total = len(issues)
    issues = issues[:max_entries]

    with open(FEED_FILE, "w", encoding="utf-8") as f:
        f.write(render_feed(issues))

    newest = issues[0][0]
    oldest = issues[-1][0]
    note = f" (capped from {total})" if total > len(issues) else ""
    print(f"Generated feed.xml with {len(issues)} entries{note} ({newest} -> {oldest})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
