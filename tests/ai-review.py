#!/usr/bin/env python3
"""AI-powered website reviewer — validates HTML pages using an offsite AI.
Reads API key from AI_TEST_API_KEY env var or .env file.
Uses OpenAI-compatible chat completions endpoint.
"""

import os, sys, re, json, urllib.request, pathlib

# ── Config ──
ENDPOINT = os.environ.get('AI_TEST_ENDPOINT', 'https://openrouter.ai/api/v1/chat/completions')
MODEL = os.environ.get('AI_TEST_MODEL', 'meta-llama/llama-3.2-3b-instruct:free')
API_KEY = os.environ.get('AI_TEST_API_KEY', '') or os.environ.get('OPENROUTER_API_KEY', '')

# Try reading from .env
if not API_KEY:
    env_path = pathlib.Path(__file__).parent.parent / '.env'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith('AI_TEST_API_KEY='):
                API_KEY = line.split('=', 1)[1].strip()
            elif line.startswith('OPENROUTER_API_KEY=') and not API_KEY:
                API_KEY = line.split('=', 1)[1].strip()

ROOT = pathlib.Path(__file__).parent.parent
PAGES = [
    'index.html', 'install.html', 'faq.html', 'contact.html',
    'compare.html', 'requirements.html', 'developers.html', 'wiki.html',
    'blog.html', 'contributing.html', 'governance.html',
]

SYSTEM_PROMPT = """You are a QA tester reviewing HTML pages for the AcreetionOS Linux website.
For each page, check:
1. Is there a proper <title> tag? Is it descriptive?
2. Is there a <meta name="description"> tag?
3. Is there a <h1> or main heading?
4. Does the page have proper navigation and footer?
5. Are there any obvious issues (broken tags, missing closing tags, suspicious content)?
6. Does the page look like it has a consistent dark theme?
7. Are there links to external resources that should be checked?
8. Is the page accessible (skip-link, aria labels, alt text on images)?
9. Are there any security issues (inline event handlers with suspicious content)?

Return your review in this JSON format:
{"pass": true/false, "issues": ["issue1", "issue2"], "score": 1-10, "summary": "one sentence"}
Only return valid JSON, nothing else."""

def review_page(filepath, content):
    """Send page content to AI for review."""
    # Truncate to avoid token limits
    snippet = content[:6000]
    if len(content) > 6000:
        snippet += '\n\n[content truncated...]'

    body = {
        'model': MODEL,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': f'Review this page ({filepath}):\n\n{snippet}'}
        ],
        'max_tokens': 300,
        'temperature': 0.1
    }

    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}',
            'HTTP-Referer': 'https://acreetionos.org',
            'X-Title': 'AcreetionOS AI Test'
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read().decode())
            raw = data['choices'][0]['message']['content']
            # Extract JSON from response (may have markdown fences)
            json_match = re.search(r'\{[\s\S]*"pass"[\s\S]*\}', raw)
            if json_match:
                return json.loads(json_match.group())
            return {'pass': True, 'issues': [], 'score': 5, 'summary': raw[:200]}
    except Exception as e:
        return {'pass': False, 'issues': [str(e)], 'score': 0, 'summary': 'AI review failed'}

def main():
    if not API_KEY:
        print('ERROR: AI_TEST_API_KEY not set. Set it in .env or environment.')
        print('  echo "AI_TEST_API_KEY=sk-..." >> .env')
        sys.exit(1)

    results = []
    for page in PAGES:
        filepath = ROOT / page
        if not filepath.exists():
            results.append({'page': page, 'pass': False, 'issues': ['File not found'], 'score': 0, 'summary': 'Missing'})
            print(f'  ✗ {page} — not found')
            continue

        content = filepath.read_text(encoding='utf-8', errors='ignore')
        review = review_page(page, content)

        review['page'] = page
        results.append(review)
        status = '✓' if review.get('pass') else '✗'
        print(f'  {status} {page} (score: {review.get("score", "?")}/10) — {review.get("summary", "")[:120]}')

    # Summary
    total = len(results)
    passed = sum(1 for r in results if r.get('pass'))
    avg_score = sum(r.get('score', 0) for r in results) / total if total > 0 else 0

    print(f'\n{"="*60}')
    print(f'Results: {passed}/{total} passed | Avg score: {avg_score:.1f}/10')

    # Print issues
    for r in results:
        if r.get('issues'):
            print(f'\n{r["page"]}:')
            for issue in r['issues']:
                print(f'  - {issue}')

    # Exit code for CI
    if passed < total:
        sys.exit(1)

if __name__ == '__main__':
    main()
