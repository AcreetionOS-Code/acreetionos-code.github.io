#!/usr/bin/env python3
"""Generate the daily AcreetionOS newsletter using AI and send via Gmail SMTP.

Scrapes ecosystem pages + news activity, sends to Worker API for AI analysis,
saves structured JSON to newsletters/ directory, and emails all subscribers.

Environment variables:
  EMAIL_ADDRESS      — Gmail address to send FROM (e.g. developers@acreetionos.org)
  EMAIL_APP_PASSWORD — Gmail App Password for the above account
  ADMIN_KEY          — SECRET_SAUCE admin key for Worker API
  WORKER_URL         — Base URL for Worker API (default: https://acreetionos.org/api)
  NEWSLETTER_DIR     — Directory for newsletter JSON files (default: newsletters)
"""

import json
import os
import re
import smtplib
import ssl
import sys
import time
from datetime import date
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate
from urllib.request import Request, urlopen
from urllib.error import URLError

WORKER_URL = os.environ.get("WORKER_URL", "https://acreetionos.org/api")
NEWSLETTER_DIR = os.environ.get("NEWSLETTER_DIR", "newsletters")
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "90"))
EMAIL_ADDRESS = os.environ.get("EMAIL_ADDRESS", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_APP_PASSWORD", "")
ADMIN_KEY = os.environ.get("ADMIN_KEY", "")

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
    req = Request(url, headers={"User-Agent": "AcreetionOS-Newsletter-Bot/1.0"})
    try:
        with urlopen(req, timeout=timeout or REQUEST_TIMEOUT) as resp:
            raw = resp.read()
            try:
                return raw.decode("utf-8", errors="replace")
            except Exception:
                return raw.decode("latin-1")
    except Exception as e:
        print(f"  Failed to fetch {url}: {e}", file=sys.stderr)
        return None


def fetch_json(url, data=None, timeout=None, headers=None):
    req_headers = {"User-Agent": "AcreetionOS-Newsletter-Bot/1.0"}
    if headers:
        req_headers.update(headers)
    req = Request(url, data=data, headers=req_headers)
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
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
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
    seen = {}
    for e in entries:
        seen[e.get("filename", "")] = e
    entries = list(seen.values())
    entries.sort(key=lambda e: e.get("filename", ""), reverse=True)
    with open(list_path, "w") as f:
        json.dump(entries, f, indent=2)
    print(f"  list.json updated ({len(entries)} newsletters)")


def scrape_ecosystem():
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
    print("Fetching news activity from Worker API...")
    try:
        return fetch_json(f"{WORKER_URL}/news")
    except Exception as e:
        print(f"Failed to fetch news: {e}", file=sys.stderr)
        return {"articles": [], "activity": []}


def fetch_subscribers():
    """Fetch subscriber list from Worker API using admin key."""
    if not ADMIN_KEY:
        print("No ADMIN_KEY set — skipping subscriber fetch", file=sys.stderr)
        return []
    try:
        req = Request(f"{WORKER_URL}/newsletter/subscribers")
        req.add_header("X-Admin-Key", ADMIN_KEY)
        req.add_header("User-Agent", "AcreetionOS-Newsletter-Bot/1.0")
        with urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            return data.get("subscribers", [])
    except Exception as e:
        print(f"Failed to fetch subscribers: {e}", file=sys.stderr)
        return []


def send_email_smtp(to_email, subject, body_text, unsubscribe_url=""):
    """Send an email via Gmail SMTP using App Password."""
    if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
        print("EMAIL_ADDRESS or EMAIL_APP_PASSWORD not set — skipping email send", file=sys.stderr)
        return False

    html_parts = []
    for paragraph in body_text.strip().split("\n\n"):
        p = paragraph.strip()
        if p:
            html_parts.append(f"<p>{p.replace(chr(10), '<br>')}</p>")

    html_body = "<html><body style='font-family:Roboto,sans-serif;color:#e5e5e5;background:#121212;padding:20px;max-width:600px;margin:0 auto'>"
    html_body += "<div style='text-align:center;margin-bottom:20px'>"
    html_body += "<img src='https://acreetionos.org/acreetionoslogo.webp' alt='AcreetionOS' width='60' height='60' style='border-radius:12px'>"
    html_body += "</div>"
    html_body += "".join(html_parts)
    if unsubscribe_url:
        html_body += f"<p style='margin-top:30px;font-size:12px;color:#777'><a href='{unsubscribe_url}' style='color:#2ecc71'>Unsubscribe</a> from these emails.</p>"
    html_body += "</body></html>"

    msg = MIMEText(html_body, "html")
    msg["Subject"] = subject
    msg["From"] = formataddr(("AcreetionOS Newsletter", EMAIL_ADDRESS))
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    msg["List-Unsubscribe"] = f"<{unsubscribe_url}>" if unsubscribe_url else ""

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"  Failed to send email to {to_email}: {e}", file=sys.stderr)
        return False


def generate_newsletter(date_str, date_display, filename):
    """Generate today's newsletter. Returns the newsletter dict, or None on AI failure.

    Never writes placeholder content — if the AI chain is down we return None and
    the caller exits non-zero, so the run is visible as failed and the next run
    retries instead of committing a fake "not available" newsletter.
    """
    ecosystem_text = scrape_ecosystem()
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
            # Same AI endpoint as the wiki (/api/chat) — server-to-server
            # calls authenticate with X-Admin-Key and skip reCAPTCHA.
            ai_response = fetch_json(
                f"{WORKER_URL}/chat",
                data=json.dumps({
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": 4096,
                }).encode(),
                timeout=180,
                headers={"X-Admin-Key": ADMIN_KEY},
            )
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
        print("AI generation failed after 3 attempts — not writing a placeholder newsletter.", file=sys.stderr)
        return None

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

    return newsletter


def send_to_subscribers(newsletter):
    """Email the newsletter to all subscribers. Only runs when SEND_EMAIL=1."""
    if not (EMAIL_ADDRESS and EMAIL_PASSWORD):
        print("EMAIL_ADDRESS/EMAIL_APP_PASSWORD not set — skipping email delivery. Set these in environment to send.")
        return False
    content = newsletter.get("body", "")
    print("Fetching subscribers...")
    subscribers = fetch_subscribers()
    if not subscribers:
        print("No subscribers to email")
        return False
    print(f"Sending newsletter to {len(subscribers)} subscribers via Gmail SMTP...")
    success_count = 0
    for sub in subscribers:
        email = sub.get("email", "")
        token = sub.get("unsubscribe_token", "")
        unsubscribe_url = f"https://acreetionos.org/api/newsletter/unsubscribe?email={email}&token={token}" if email and token else ""
        if email:
            ok = send_email_smtp(email, newsletter["subject"], content, unsubscribe_url)
            if ok:
                success_count += 1
            print(f"  {'OK' if ok else 'FAIL'} {email}")
        time.sleep(0.5)
    print(f"Sent {success_count}/{len(subscribers)} emails successfully")
    return True



def post_to_discord(newsletter):
    """Post a newsletter summary to the Discord webhook (no subscription needed).

    Uses the same incoming webhook as the n8n Discord nodes — the community
    channel people are already in. Never fails the run: Discord being down
    must not block email delivery.
    """
    webhook = os.environ.get("DISCORD_WEBHOOK_URL", "")
    if not webhook:
        print("No DISCORD_WEBHOOK_URL — skipping Discord push", file=sys.stderr)
        return
    subject = newsletter.get("subject", "AcreetionOS Update")
    body = newsletter.get("body", "")
    # First 3 paragraphs as the Discord snippet
    paras = [p.strip() for p in body.split("\n\n") if p.strip()]
    snippet = "\n\n".join(paras[:3])
    if len(snippet) > 1800:
        snippet = snippet[:1800] + "…"
    date_display = newsletter.get("date_display", "")
    payload = {
        "content": f"📬 **{subject}**\n\n{snippet}\n\n"
                   f"Read the full newsletter: https://acreetionos.org/newsletter.html "
                   f"| Archive: https://acreetionos.org/newsletter-archive/",
        "username": "AcreetionOS Bot",
    }
    try:
        req = Request(webhook, data=json.dumps(payload).encode(),
                      headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=15) as resp:
            if resp.status not in (200, 204):
                print(f"Discord push: HTTP {resp.status}", file=sys.stderr)
            else:
                print(f"Discord push sent ({date_display})")
    except Exception as e:
        print(f"Discord push failed (non-fatal): {e}", file=sys.stderr)


def main():
    today = date.today()
    date_str = today.strftime("%Y-%m-%d")
    date_display = today.strftime("%B %d, %Y")
    filename = os.path.join(NEWSLETTER_DIR, f"{date_str}.json")

    os.makedirs(NEWSLETTER_DIR, exist_ok=True)

    # SEND_EMAIL=1 is the "daily delivery" mode (send-newsletter.yml).
    # Without it we only build the file, never email (intelligence-sync.yml).
    send_email = os.environ.get("SEND_EMAIL", "0") == "1"

    newsletter = None
    if os.path.exists(filename):
        print(f"Newsletter already exists: {filename}")
        try:
            with open(filename, encoding="utf-8") as f:
                newsletter = json.load(f)
        except Exception as e:
            print(f"Failed to read existing newsletter: {e}", file=sys.stderr)
            newsletter = None
    else:
        newsletter = generate_newsletter(date_str, date_display, filename)
        if newsletter is None:
            # AI is down — fail the workflow so the next scheduled run retries.
            sys.exit(1)

    # Push to Discord (#upland) — reaches the community without them
    # subscribing to email. Runs whenever a newsletter was generated or
    # already exists (guarded by DISCORD_WEBHOOK_URL being set).
    if newsletter and os.environ.get("DISCORD_WEBHOOK_URL"):
        post_to_discord(newsletter)

    if send_email:
        if newsletter:
            send_to_subscribers(newsletter)
    else:
        print("SEND_EMAIL not set — skipping email delivery.")


if __name__ == "__main__":
    main()
