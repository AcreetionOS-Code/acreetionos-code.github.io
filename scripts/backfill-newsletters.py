#!/usr/bin/env python3
"""Backfill placeholder newsletters with AI-generated content via Workers AI.

Targets newsletters/*.json whose body contains the placeholder marker
("is not available"). For each date it generates a real newsletter grounded
in the current ecosystem snapshot and the topics of nearby REAL newsletters,
then writes the JSON in place. Never invents releases, versions, or events.

Auth: Cloudflare Global API Key (X-Auth-Email / X-Auth-Key) calling Workers AI
directly — no SECRET_SAUCE needed.

Environment:
  CF_API_KEY   — Cloudflare Global API key
  CF_EMAIL     — Cloudflare account email
  CF_ACCOUNT   — Cloudflare account id
  NEWSLETTER_DIR — default "newsletters"
  AI_MODEL     — default "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
"""

import glob
import json
import os
import sys
import time
import urllib.error
import urllib.request

CF_ACCOUNT = os.environ.get("CF_ACCOUNT", "")
CF_EMAIL = os.environ.get("CF_EMAIL", "")
CF_KEY = os.environ.get("CF_API_KEY", "")
NEWSLETTER_DIR = os.environ.get("NEWSLETTER_DIR", "newsletters")
AI_MODEL = os.environ.get("AI_MODEL", "@cf/meta/llama-3.3-70b-instruct-fp8-fast")
PLACEHOLDER_MARKER = "is not available"
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"


def ai_run(payload, timeout=180):
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/ai/run/{AI_MODEL}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "X-Auth-Email": CF_EMAIL,
            "X-Auth-Key": CF_KEY,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read())
    if not data.get("success"):
        raise RuntimeError(f"Workers AI error: {data.get('errors')}")
    return data["result"]["response"].strip()


def load_real_newsletters():
    """All non-placeholder newsletters sorted by filename."""
    out = []
    for path in sorted(glob.glob(os.path.join(NEWSLETTER_DIR, "2026-*.json"))):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        if PLACEHOLDER_MARKER not in json.dumps(data, ensure_ascii=False):
            out.append((os.path.basename(path)[:10], data))
    return out


def neighbors_for(date_str, real):
    """Up to 2 real newsletters before and after the target date."""
    before = [(d, n) for d, n in real if d < date_str][-2:]
    after = [(d, n) for d, n in real if d > date_str][:2]
    return before, after


def build_context(before, after, news):
    parts = []
    articles = news.get("articles", [])[:6]
    activity = news.get("activity", [])[:8]
    if articles or activity:
        lines = ["=== Current project activity (real, may span recent weeks) ==="]
        for a in articles:
            lines.append(f"- [{a.get('tag', 'News')}] {a.get('title', '')}: {str(a.get('desc', ''))[:150]}")
        for a in activity:
            lines.append(f"- [{a.get('type', 'Activity')}] {a.get('message', '')[:150]} ({a.get('repo', '')})")
        parts.append("\n".join(lines))

    def fmt(items):
        chunks = []
        for d, n in items:
            body = " ".join(n.get("body", "").split())[:500]
            chunks.append(f"[{d}] {n.get('subject', '')}\n{body}")
        return "\n\n".join(chunks)

    if before:
        parts.append("=== Real newsletters just BEFORE this date ===\n" + fmt(before))
    if after:
        parts.append("=== Real newsletters just AFTER this date ===\n" + fmt(after))
    return "\n\n".join(parts)


SYSTEM_PROMPT = (
    "You are the AcreetionOS newsletter writer. AcreetionOS is a real "
    "Arch-based Linux distribution focused on simplicity and an immutable-style "
    "workflow. You write like a real open-source project communicator: "
    "specific, honest, interesting.\n"
    "RULES:\n"
    "1. LEAD WITH THE HOOK. First sentence = most interesting real thing from "
    "the provided context. Never start with 'Dear community'.\n"
    "2. TITLE = REAL TOPIC. Name the actual subject matter, never 'Daily Update'.\n"
    "3. STRUCTURE: hook (1-2 sentences), 2-3 short sections with plain-text "
    "headers (Development / Community / Tip of the day), each 2-3 sentences. "
    "Total 250-400 words. Plain text, no markdown, no bullet lists.\n"
    "4. INCLUDE 2-3 INTERNAL LINKS naturally: https://acreetionos.org/ , "
    "https://acreetionos.org/changelog.html , https://acreetionos.org/docs.html , "
    "https://acreetionos.org/wiki.html , https://acreetionos.org/flash.html .\n"
    "5. ABSOLUTE HONESTY: use ONLY facts present in the provided context or "
    "well-known stable facts about an Arch-based distro (pacman, Arch repos, "
    "KDE/GNOME tooling). NEVER invent releases, version numbers, dates, user "
    "names, or events. If context is thin, write about the project's real "
    "ongoing workstreams (ISO build pipeline, documentation, wiki guides, "
    "community growth) in general but accurate terms.\n"
    "6. ONE VOICE: warm, competent, a little playful. No corporate filler."
)


def backfill_date(date_str, context):
    display = time.strftime("%B %d, %Y", time.strptime(date_str, "%Y-%m-%d"))
    user_prompt = (
        f"Write the AcreetionOS newsletter for {display}.\n\n"
        f"{context}\n\n"
        f"Write a genuine, honest update for that day drawing on the real "
        f"topics and momentum visible around this period. Follow all rules."
    )
    for attempt in range(3):
        try:
            body = ai_run({
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 1200,
                "temperature": 0.7,
            })
            if len(body.split()) < 80:
                raise ValueError(f"too short ({len(body.split())} words)")
            if PLACEHOLDER_MARKER in body or "not available" in body.lower():
                raise ValueError("model echoed placeholder language")
            return {
                "subject": _subject_from(body, display),
                "date_display": display,
                "body": body,
            }
        except Exception as e:
            print(f"  attempt {attempt + 1} failed: {e}", file=sys.stderr)
            if attempt < 2:
                time.sleep(5)
    return None


def _subject_from(body, display):
    """First sentence, trimmed, as the subject line."""
    first = body.split(". ")[0].split("\n")[0].strip()
    first = first.rstrip(".")
    if len(first) > 90 or len(first) < 15:
        first = f"AcreetionOS Update — {display}"
    return first


def main():
    targets = []
    for path in sorted(glob.glob(os.path.join(NEWSLETTER_DIR, "2026-*.json"))):
        try:
            with open(path, encoding="utf-8") as f:
                raw = f.read()
            json.loads(raw)
        except Exception as e:
            print(f"Skipping unreadable {path}: {e}", file=sys.stderr)
            continue
        if PLACEHOLDER_MARKER in raw:
            targets.append(path)

    print(f"{len(targets)} placeholder newsletters to backfill")
    if DRY_RUN:
        for t in targets:
            print("  would backfill:", t)
        return 0

    if not (CF_ACCOUNT and CF_EMAIL and CF_KEY):
        print("CF_ACCOUNT / CF_EMAIL / CF_API_KEY required", file=sys.stderr)
        return 2

    # Live news feed for grounding (non-fatal if down)
    news = {"articles": [], "activity": []}
    try:
        req = urllib.request.Request(
            "https://acreetionos.org/api/news",
            headers={"User-Agent": "AcreetionOS-Backfill/1.0"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            news = json.loads(resp.read())
    except Exception as e:
        print(f"News feed unavailable ({e}) — continuing without it", file=sys.stderr)

    real = load_real_newsletters()
    ok = fail = 0
    for i, path in enumerate(targets, 1):
        date_str = os.path.basename(path)[:10]
        before, after = neighbors_for(date_str, real)
        context = build_context(before, after, news)
        print(f"[{i}/{len(targets)}] {date_str} ...", flush=True)
        result = backfill_date(date_str, context)
        if result is None:
            fail += 1
            continue
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)
        real.append((date_str, result))
        real.sort(key=lambda x: x[0])
        ok += 1
        print(f"  done: {result['subject'][:70]}")
        time.sleep(2)

    print(f"\nBackfilled {ok}, failed {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
