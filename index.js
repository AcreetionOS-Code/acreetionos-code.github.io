// Cloudflare Worker — Page View Counter + AI Chat Proxy + ISO Hosting
// Holds the API key securely on the server, never exposed to the browser
// Maintainers: Natalie Spiva (spivanatalie64), Darren Clift (cobra3282000)
// Website: https://acreetionos.org
// This worker provides:
//   GET  /api/news    — aggregates AcreetionOS news from GitHub, GitLab, and RSS, generates articles with AI
//   POST /api/chat    — server-side OpenRouter chat (free model)
//   GET  /api/counter — returns current active user count
//   POST /api/counter — increments and returns new count

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Explicitly whitelisted free models only — no wildcards, no injection.
const FREE_MODELS = new Set([
  'minimax/minimax-m2.5:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'google/gemma-2-9b-it:free',
]);
const DEFAULT_MODEL = 'minimax/minimax-m2.5:free';
let allowedOrigins = [
  'https://acreetionos.org',
  'https://www.acreetionos.org',
  'https://acreetionos-code.github.io',
  'https://darren.acreetionos.org',
];
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const rateLimitMap = new Map();

function checkRateLimit(ip, maxRequests = 20, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }
  if (entry.count >= maxRequests) return true;
  entry.count++;
  return false;
}

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

function securityHeaders(nonce) {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://ajax.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' https://api.github.com https://gitlab.acreetionos.org https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; form-action 'self' https://www.qwant.com"
  };
}

function jsonResponse(data, init, request) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...corsHeaders(request || { headers: { get: () => '' } }) }
  });
}

function corsHeaders(request, nonce) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins.includes(origin) ? origin : '';
  if (!nonce) {
    nonce = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  }
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Content-Encoding, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    ...securityHeaders(nonce)
  };
}

let visitorCount = 0;
let lastPersistTime = 0;
const CACHE_KEY = 'https://acreetion-counter/count';

async function loadCount() {
  try {
    const cache = caches.default;
    const cached = await cache.match(CACHE_KEY);
    if (cached) {
      const data = await cached.json();
      visitorCount = data.count || 0;
    }
  } catch (e) {}
}

async function persistCount() {
  try {
    const cache = caches.default;
    const response = new Response(JSON.stringify({ count: visitorCount, ts: Date.now() }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=86400' }
    });
    // Don't await — fire and forget
    cache.put(CACHE_KEY, response.clone());
  } catch (e) {}
}

async function handleNews(env) {
  const GH_ORG = 'AcreetionOS-Code';
  const GL_HOST = 'gitlab.acreetionos.org';
  const RSS_FEEDS = [
    'https://news.google.com/rss/search?q=%22AcreetionOS%22&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=AcreetionOS+Arch+Linux&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=Arch+Linux+news&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=Arch+Linux+Cinnamon&hl=en-US&gl=US&ceid=US:en',
    'https://www.reddit.com/r/acreetionos/.rss',
    'https://www.reddit.com/r/archlinux/.rss?limit=10',
    'https://lwn.net/headlines/newrss'
  ];

  try {
    const [gh, gl, rss] = await Promise.all([
      (async () => {
        try {
          const reposRes = await fetch('https://api.github.com/orgs/' + GH_ORG + '/repos?per_page=50&sort=pushed', { headers: { 'User-Agent': CHROME_UA } });
          if (!reposRes.ok) return [];
          const repos = await reposRes.json();
          const repoFetches = repos.slice(0, 50).map(repo =>
            Promise.all([
              fetch('https://api.github.com/repos/' + GH_ORG + '/' + repo.name + '/commits?per_page=2', { headers: { 'User-Agent': CHROME_UA } }),
              fetch('https://api.github.com/repos/' + GH_ORG + '/' + repo.name + '/releases?per_page=1', { headers: { 'User-Agent': CHROME_UA } })
            ]).then(async ([commitsRes, releasesRes]) => {
              const items = [];
              if (commitsRes.ok) {
                const commits = await commitsRes.json();
                for (const c of commits) {
                  items.push({ type: 'commit', repo: repo.name, message: (c.commit.message || '').split('\n')[0], author: c.commit.author?.name || 'Unknown', date: c.commit.author?.date, url: c.html_url, source: 'GitHub' });
                }
              }
              if (releasesRes.ok) {
                const releases = await releasesRes.json();
                for (const r of releases) {
                  items.push({ type: 'release', repo: repo.name, name: r.tag_name, desc: (r.body || '').split('\n')[0], date: r.published_at || r.created_at, url: r.html_url, source: 'GitHub' });
                }
              }
              return items;
            }).catch(() => [])
          );
          const nested = await Promise.all(repoFetches);
          return nested.flat();
        } catch (e) { return []; }
      })(),
      (async () => {
        try {
          const projectsRes = await fetch('https://' + GL_HOST + '/api/v4/projects?per_page=50&order_by=last_activity_at', { headers: { 'User-Agent': CHROME_UA } });
          if (!projectsRes.ok) return [];
          const projects = await projectsRes.json();
          const projFetches = projects.slice(0, 50).map(proj =>
            fetch('https://' + GL_HOST + '/api/v4/projects/' + proj.id + '/repository/commits?per_page=2', { headers: { 'User-Agent': CHROME_UA } })
              .then(async (commitsRes) => {
                const items = [];
                if (commitsRes.ok) {
                  const commits = await commitsRes.json();
                  for (const c of commits) {
                    items.push({ type: 'commit', repo: proj.path_with_namespace || proj.name, message: c.title || c.message || '', author: c.author_name || 'Unknown', date: c.created_at, url: c.web_url || ('https://' + GL_HOST + '/' + proj.path_with_namespace + '/-/commit/' + c.id), source: 'GitLab' });
                  }
                }
                return items;
              }).catch(() => [])
          );
          const nested = await Promise.all(projFetches);
          return nested.flat();
        } catch (e) { return []; }
      })(),
      (async () => {
        const feedFetches = RSS_FEEDS.map(feedUrl =>
          fetch(feedUrl, { headers: { 'User-Agent': CHROME_UA } })
            .then(async (res) => {
              if (!res.ok) return [];
              const xml = await res.text();
              const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
              return items.slice(0, 4).map(item => {
                const title = (item.match(/<title>(?:<!\[CDATA\[)?([^\]]*)(?:\]\]>)?<\/title>/) || [,''])[1].trim();
                const link = (item.match(/<link>(?:<!\[CDATA\[)?([^\]]*)(?:\]\]>)?<\/link>/) || [,''])[1].trim();
                const desc = (item.match(/<description>(?:<!\[CDATA\[)?([^\]]*)(?:\]\]>)?<\/description>/) || [,''])[1].trim().replace(/<[^>]+>/g, '').slice(0, 200);
                const pubDate = (item.match(/<pubDate>([^<]*)<\/pubDate>/) || [,''])[1];
                if (title && link) return { type: 'news', message: title, desc, date: pubDate, url: link, source: 'Google News' };
                return null;
              }).filter(Boolean);
            }).catch(() => [])
        );
        const nested = await Promise.all(feedFetches);
        return nested.flat();
      })()
    ]);

    const directArticles = gh.filter(a => a.type === 'release').slice(0, 3).concat(gl.slice(0, 2)).concat(rss.slice(0, 4)).slice(0, 6).map(item => ({
      type: 'direct',
      title: item.type === 'release' ? item.name + ' released' : item.message || 'AcreetionOS update',
      desc: item.desc || item.message || 'Recent activity from ' + item.source,
      tag: item.type === 'release' ? 'Release' : 'Community',
      tagClass: item.type === 'release' ? 'tag-release' : 'tag-community',
      url: item.url || 'https://acreetionos.org',
      source: item.source || 'acreetionos.org',
      date: item.date
    }));

    const activityData = [...gh, ...gl, ...rss].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return new Response(JSON.stringify({
      articles: directArticles,
      activity: activityData.slice(0, 20).map(a => ({
        type: a.type, repo: a.repo || '', message: a.message || a.name || '', author: a.author || '', date: a.date, url: a.url || '', source: a.source || ''
      })),
      meta: { directFound: directArticles.length, activityCount: activityData.length }
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...corsHeaders({ headers: { get: () => '' } }) }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'News fetch failed', articles: [], activity: [] }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders({ headers: { get: () => '' } }) }
    });
  }
}

// ─── Hosting Provider Vetting ─────────────────────────────────

async function validateOrgDomain(env, email, org, isPersonal) {
  if (isPersonal) return { valid: true, note: 'personal' };

  const domain = email.split('@')[1];
  if (!domain) return { valid: false, reason: 'Invalid email domain' };

  const ossPlatforms = ['github.io', 'gitlab.io', 'bitbucket.io', 'sourceforge.io', 'gitlab.com', 'github.com'];
  const isOSS = ossPlatforms.some(p => domain.endsWith('.' + p) || domain === p);
  if (isOSS) return { valid: true, note: 'open_source_platform' };

  if (domain === 'localhost' || domain === '127.0.0.1' || domain === '0.0.0.0' || domain === '[::1]' ||
      /^\d+\.\d+\.\d+\.\d+$/.test(domain) || domain.endsWith('.local') || domain.endsWith('.internal')) {
    return { valid: false, reason: 'Disallowed domain' };
  }

  try {
    const headRes = await fetch('https://' + domain, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000)
    }).catch(() => null);

    const wwwRes = !headRes?.ok ? await fetch('https://www.' + domain, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000)
    }).catch(() => null) : headRes;

    if (wwwRes?.ok || headRes?.ok) {
      return { valid: true, note: 'verified_domain' };
    }

    return { valid: false, reason: 'Domain "' + domain + '" has no reachable website. Organization email must belong to an open source project or business with an active website, or check "personal use".' };
  } catch (e) {
    return { valid: false, reason: 'Could not verify domain "' + domain + '": ' + e.message };
  }
}

async function vetProvider(env, body) {
  const { org, email, website, mirror_url, location, notes } = body;
  const flags = [];
  let score = 0;

  const orgLower = (org || '').toLowerCase();
  const emailLower = (email || '').toLowerCase();
  const notesLower = (notes || '').toLowerCase();
  const locationLower = (location || '').toLowerCase();

  // 1. Check org name against threat intel keywords (loaded from secret)
  const threatKB = env.WATCH_LIST ? JSON.parse(env.WATCH_LIST) : [];
  for (const keyword of threatKB) {
    if (orgLower.includes(keyword)) {
      flags.push('Organization name matches known threat indicator');
      score += 50;
    }
    if (notesLower.includes(keyword) || emailLower.includes(keyword)) {
      flags.push('Communication references known threat indicator');
      score += 40;
    }
  }

  // 2. Check domain against threat intel blocklist
  let domain = '';
  try {
    domain = new URL(mirror_url || website || '').hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {}
  if (domain && env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
    const blockedDomains = [];
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/acreetionos-hosting/objects/threat-intel%2Fall-blocked-domains.txt`, {
        headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` }
      });
      if (res.ok) {
        const text = await res.text();
        blockedDomains.push(...text.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean));
      }
    } catch (e) {}
    for (const b of blockedDomains) {
      if (domain === b || domain.endsWith('.' + b)) {
        flags.push(`Domain "${domain}" appears in threat intelligence blocklist (matched: ${b})`);
        score += 45;
        break;
      }
    }
  }

  // Remove public suspicious patterns and disposable domain checks — moved to background worker via CRED_I

  // 5. Check if mirror URL matches known malicious URL patterns
  try {
    const mirrorPath = new URL(mirror_url).pathname.toLowerCase();
    if (/\.(exe|bat|cmd|scr|ps1|vbs|jar|dll)$/i.test(mirrorPath)) {
      flags.push(`Mirror URL points to executable, not ISO`);
      score += 30;
    }
  } catch (e) {}

  const verdict = score >= 40 ? 'rejected' : score >= 15 ? 'flagged' : 'pending';

  return {
    verdict,
    score,
    flags,
    auto_rejected: score >= 40,
    needs_manual_review: score >= 15 && score < 40,
    clean: score < 15,
  };
}

// ─── ISO Hosting Provider Management ───────────────────────────────

async function getR2(env, bucket, key) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucket}/objects/${key}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
  if (!res.ok) return null;
  // R2 GET returns the raw object body directly (not wrapped in { result: ... })
  return await res.json();
}

async function putR2(env, bucket, key, body) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return false;
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucket}/objects/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.ok;
}

async function deleteR2(env, bucket, key) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return false;
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucket}/objects/${key}`;
  const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
  return res.ok;
}

async function listR2(env, bucket, prefix) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return [];
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucket}/objects?prefix=${prefix}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.result?.objects || [];
}

async function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const buf = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) buf[i] = a.charCodeAt(i) ^ b.charCodeAt(i);
  return buf.reduce((acc, v) => acc | v, 0) === 0;
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  let saltBytes, saltStr;
  if (salt) {
    saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
    saltStr = salt;
  } else {
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
    saltStr = btoa(String.fromCharCode(...saltBytes));
  }
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const hashArr = Array.from(new Uint8Array(bits));
  return saltStr + ':' + btoa(String.fromCharCode(...hashArr));
}

async function sendDiscordWebhook(env, message) {
  const webhook = env.ALERT_SIREN;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (e) { console.error('Discord webhook failed:', e); }
}

async function sendHostingEmail(env, to, subject, body) {
  // Store email job in R2 for Cloudflare Email Worker to pick up
  const job = { to, subject, body, from: env.RETURN_ADDRESS || 'developers@acreetionos.org', created: new Date().toISOString() };
  const key = 'email-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  await putR2(env, 'acreetionos-hosting', key, job);
}

async function handleHostingGetProviders(env) {
  const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
  const providers = [];
  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (data) providers.push({
      org: data.org,
      mirror_url: data.mirror_url,
      location: data.location,
      bandwidth: data.bandwidth || '',
      status: data.status
    });
  }
  return jsonResponse({ providers }, {}, null);
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (!url.startsWith('https://')) return '';
  return url;
}

async function handleHostingSnippets(env) {
  const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
  const providers = [];
  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (data) providers.push(data);
  }
  const active = providers.filter(p => p.status === 'active');
  const count = active.length;

  let listHtml = '<div class="provider-list">\n';
  for (const p of active) {
    const url = safeUrl(p.mirror_url);
    listHtml += '<div class="provider-item">\n';
    listHtml += '<div class="info">\n';
    listHtml += `<div class="name">${escHtml(p.org)} <span class="tag tag-active">Active</span></div>\n`;
    listHtml += `<div class="url"><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(url)}</a></div>\n`;
    listHtml += `<div class="provider-detail">${escHtml(p.location)}${p.bandwidth ? ' · ' + escHtml(p.bandwidth) : ''}</div>\n`;
    listHtml += '</div>\n</div>\n';
  }
  listHtml += '</div>\n';

  let selectHtml;
  if (count >= 5) {
    selectHtml = '<div class="fastest-provider">\n';
    selectHtml += '<label for="fastest-mirror">Fastest Provider:</label>\n';
    selectHtml += '<select id="fastest-mirror">\n';
    selectHtml += '<option value="">Select a mirror...</option>\n';
    for (const p of active) {
      const url = safeUrl(p.mirror_url);
      selectHtml += `<option value="${escHtml(url)}">${escHtml(p.org)} — ${escHtml(p.location)}</option>\n`;
    }
    selectHtml += '</select>\n';
    selectHtml += '<a href="/hosting.html" class="btn btn-small">All Hosting Providers</a>\n';
    selectHtml += '</div>\n';
  } else {
    selectHtml = '<div class="mirror-list">\n';
    for (const p of active) {
      const url = safeUrl(p.mirror_url);
      selectHtml += '<div class="mirror-item">';
      selectHtml += `<strong>${escHtml(p.org)}</strong>`;
      selectHtml += `<span class="mirror-location">${escHtml(p.location)}</span>`;
      selectHtml += `<a href="${escHtml(url)}" target="_blank" rel="noopener" class="btn btn-small">Download ISO</a>`;
      selectHtml += '</div>\n';
    }
    selectHtml += '</div>\n';
    if (count > 0) {
      selectHtml += '<a href="/hosting.html" class="btn btn-small">View All Providers</a>\n';
    }
  }

  return new Response(JSON.stringify({
    count,
    list_html: listHtml,
    select_html: selectHtml,
    updated_at: new Date().toISOString()
  }), {
    headers: corsHeaders({ headers: { get: () => '' } })
  });
}

async function handleHostingRegister(request, env) {
  if (checkRateLimit(getClientIP(request), 3, 3600000)) {
    return new Response(JSON.stringify({ error: 'Too many registration attempts, please try again later' }), { status: 429, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
  try {
    const body = await request.json();
    if (!body.org || !body.email || !body.password || !body.mirror_url || !body.location) {
      return new Response(JSON.stringify({ error: 'org, email, password, mirror_url, and location are required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    }

    // Validate organization domain (skip if personal checkbox checked)
    const orgCheck = await validateOrgDomain(env, body.email, body.org, body.personal_email === true);
    if (!orgCheck.valid) {
      return new Response(JSON.stringify({ success: false, error: orgCheck.reason }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    }

    // Run background vetting checks
    const vetResult = await vetProvider(env, body);

    if (vetResult.auto_rejected) {
      sendDiscordWebhook(env,
        `**🚫 Registration Auto-Rejected (Vetting Failed)**\n**Organization:** ${body.org}\n**Email:** ${body.email}\n**Location:** ${body.location}\n**Risk Score:** ${vetResult.score}\n**Flags:**\n${vetResult.flags.map(f => '- ' + f).join('\n')}\n\nRegistration was automatically rejected by security vetting.`
      );
      return new Response(JSON.stringify({
        success: false, error: 'Registration rejected by automated security vetting. Contact developers@acreetionos.org if you believe this is an error.',
        vetting: { score: vetResult.score, flags: vetResult.flags }
      }), { status: 403, headers: corsHeaders({ headers: { get: () => '' } }) });
    }

    const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const provider = {
      id, org: body.org, email: body.email, website: body.website || '',
      mirror_url: body.mirror_url, location: body.location,
      bandwidth: body.bandwidth || '', notes: body.notes || '',
      password: await hashPassword(body.password),
      status: vetResult.needs_manual_review ? 'flagged' : 'pending',
      created: new Date().toISOString(),
      removal_requested: false,
      discord_user_id: body.discord_user_id || '',
      subscribed: body.subscribe === true,
      vetting: { score: vetResult.score, flags: vetResult.flags },
      personal_email: body.personal_email === true,
      last_seen: new Date().toISOString(),
      expiry_warning_sent: false
    };
    const ok = await putR2(env, 'acreetionos-hosting', 'provider-' + id, provider);
    if (!ok) return new Response(JSON.stringify({ error: 'Storage error' }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });

    // Mailing list subscription
    if (body.subscribe && body.email) {
      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const token = btoa(String.fromCharCode(...tokenBytes)).replace(/[/+]/g, '').slice(0, 32);
      await putR2(env, 'acreetionos-hosting', 'subscriber-' + body.email.replace(/[@.]/g, '_'), {
        email: body.email, org: body.org, subscribed: new Date().toISOString(), unsubscribe_token: token
      });
    }

    const statusEmoji = vetResult.needs_manual_review ? '⚠️' : '✅';
    const statusLabel = vetResult.needs_manual_review ? 'Flagged — Manual Review Required' : 'Pending Approval';

    // Notify Discord
    sendDiscordWebhook(env,
      `${statusEmoji} **New Hosting Provider Registration**\n**Organization:** ${body.org}\n**Email:** ${body.email}\n**Location:** ${body.location}\n**Mirror:** ${body.mirror_url}\n**Website:** ${body.website || 'N/A'}\n**Discord User ID:** ${body.discord_user_id || 'N/A'}\n**Subscribed:** ${body.subscribe ? 'Yes' : 'No'}\n**Vetting Score:** ${vetResult.score}\n**Status:** ${statusLabel}\n**ID:** ${id}\n\nTo approve: POST to /api/hosting/admin/approve-removal with { provider_id: "${id}", admin_key: "ADMIN_SECRET" }\nTo reject: POST to /api/hosting/admin/reject-removal with same\nTo approve removal: add "action": "approve-removal" to the body\nAdmin page: https://acreetionos.org/api/hosting/admin/pending`
    );

    if (vetResult.flags.length > 0) {
      sendDiscordWebhook(env,
        `**Vetting Details for ${body.org}**\n${vetResult.flags.map(f => '- ' + f).join('\n')}`
      );
    }

    const msg = vetResult.auto_rejected
      ? 'Registration rejected by security vetting'
      : vetResult.needs_manual_review
        ? 'Registration submitted — flagged for manual review due to security indicators'
        : 'Registration submitted for review';

    return new Response(JSON.stringify({ success: true, message: msg, id, vetting: { score: vetResult.score, flagged: vetResult.needs_manual_review } }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

async function handleHostingRemoveRequest(request, env) {
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'email and password required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    }
    const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
    let found = null;
    for (const obj of objects) {
      const data = await getR2(env, 'acreetionos-hosting', obj.key);
      if (data && data.email === body.email && data.password === await hashPassword(body.password, data.password.split(':')[0])) { found = data; break; }
    }
    if (!found) return new Response(JSON.stringify({ error: 'Provider not found or password incorrect' }), { status: 404, headers: corsHeaders({ headers: { get: () => '' } }) });
    found.removal_requested = true;
    found.removal_reason = body.notes || 'No reason given';
    await putR2(env, 'acreetionos-hosting', 'provider-' + found.id, found);
    sendDiscordWebhook(env, `**Removal Requested**\n**Provider:** ${found.org} (${found.email})\n**Reason:** ${body.notes || 'None'}\n**ID:** ${found.id}`);
    return new Response(JSON.stringify({ success: true, message: 'Removal request submitted for admin approval' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

async function handleHostingUpdateRequest(request, env) {
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'email and password required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    }
    const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
    let found = null;
    for (const obj of objects) {
      const data = await getR2(env, 'acreetionos-hosting', obj.key);
      if (data && data.email === body.email && data.password === await hashPassword(body.password, data.password.split(':')[0])) { found = data; break; }
    }
    if (!found) return new Response(JSON.stringify({ error: 'Provider not found or password incorrect' }), { status: 404, headers: corsHeaders({ headers: { get: () => '' } }) });
    found.notes = body.notes || found.notes;
    await putR2(env, 'acreetionos-hosting', 'provider-' + found.id, found);
    return new Response(JSON.stringify({ success: true, message: 'Listing updated' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

async function handleHostingAdminApprove(request, env) {
  try {
    const body = await request.json();
    if (!body.admin_key || !(await timingSafeCompare(body.admin_key, env.SECRET_SAUCE))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders({ headers: { get: () => '' } }) });
    if (!body.provider_id) return new Response(JSON.stringify({ error: 'provider_id required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    const data = await getR2(env, 'acreetionos-hosting', 'provider-' + body.provider_id);
    if (!data) return new Response(JSON.stringify({ error: 'Provider not found' }), { status: 404, headers: corsHeaders({ headers: { get: () => '' } }) });
    if (body.action === 'approve-removal' || body.action === 'remove') {
      await deleteR2(env, 'acreetionos-hosting', 'provider-' + body.provider_id);
      sendDiscordWebhook(env, `**Provider Removed (Admin Approved)**\n**Provider:** ${data.org} (${data.email})`);
      // Notify mailing list about removal
      if (data.subscribed && data.email) {
        sendHostingEmail(env, data.email, 'AcreetionOS Hosting - Your Provider Has Been Removed',
          `Hi ${data.org},\n\nYour hosting provider listing for AcreetionOS has been removed as requested.\n\nThank you for your support.\n- AcreetionOS Team`);
      }
      return new Response(JSON.stringify({ success: true, message: 'Provider removed' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
    }
    // Approve registration
    data.status = 'active';
    await putR2(env, 'acreetionos-hosting', 'provider-' + body.provider_id, data);
    sendDiscordWebhook(env, `**Provider Approved**\n**Provider:** ${data.org} (${data.email}) is now active.`);

    // Send welcome email to subscribed providers
    if (data.subscribed && data.email) {
      sendHostingEmail(env, data.email, 'Welcome to AcreetionOS Hosting Program!',
        `Hi ${data.org},\n\nYour hosting provider application has been approved!\n\nMirror URL: ${data.mirror_url}\nStatus: Active\n\nYou are now subscribed to hosting updates. We'll notify you of any changes.\n\nTo unsubscribe: https://acreetionos.org/api/hosting/unsubscribe?email=${encodeURIComponent(data.email)}\n\n- AcreetionOS Team`);
    }
    return new Response(JSON.stringify({ success: true, message: 'Provider approved' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

async function handleHostingAdminReject(request, env) {
  try {
    const body = await request.json();
    if (!body.admin_key || !(await timingSafeCompare(body.admin_key, env.SECRET_SAUCE))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders({ headers: { get: () => '' } }) });
    if (!body.provider_id) return new Response(JSON.stringify({ error: 'provider_id required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    await deleteR2(env, 'acreetionos-hosting', 'provider-' + body.provider_id);
    sendDiscordWebhook(env, `**Provider Registration Rejected**\n**ID:** ${body.provider_id}`);
    return new Response(JSON.stringify({ success: true, message: 'Provider registration rejected and removed' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

async function handleHostingAdminPending(env) {
  const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
  const all = [];
  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (data) all.push(data);
  }
  const pending = all.filter(p => p.status === 'pending' || p.removal_requested);
  return new Response(JSON.stringify({ pending, total: all.length }), { headers: corsHeaders({ headers: { get: () => '' } }) });
}

async function handleHostingSubscribe(request, env) {
  try {
    const body = await request.json();
    if (!body.email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    const key = 'subscriber-' + body.email.replace(/[@.]/g, '_');
    const existing = await getR2(env, 'acreetionos-hosting', key);
    if (existing) return new Response(JSON.stringify({ success: true, message: 'Already subscribed' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
    const hTokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const hToken = btoa(String.fromCharCode(...hTokenBytes)).replace(/[/+]/g, '').slice(0, 32);
    await putR2(env, 'acreetionos-hosting', key, {
      email: body.email, org: body.org || '', subscribed: new Date().toISOString(), unsubscribe_token: hToken
    });
    return new Response(JSON.stringify({ success: true, message: 'Subscribed to hosting updates' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

async function handleHostingUnsubscribe(request, env) {
  const email = request.url.searchParams?.get?.('email') || '';
  const token = request.url.searchParams?.get?.('token') || '';
  if (!email || !token) return new Response(JSON.stringify({ error: 'email and token required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
  const key = 'subscriber-' + email.replace(/[@.]/g, '_');
  const record = await getR2(env, 'acreetionos-hosting', key);
  if (!record) return new Response(JSON.stringify({ error: 'Subscriber not found' }), { status: 404, headers: corsHeaders({ headers: { get: () => '' } }) });
  if (record.unsubscribe_token !== token) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders({ headers: { get: () => '' } }) });
  await deleteR2(env, 'acreetionos-hosting', key);
  return new Response(JSON.stringify({ success: true, message: 'Unsubscribed' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
}

async function handleNewsletterSubscribe(request, env) {
  try {
    const body = await request.json();
    if (!body.email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    const key = 'nl-subscriber-' + body.email.replace(/[@.]/g, '_');
    const existing = await getR2(env, 'acreetionos-hosting', key);
    if (existing) return new Response(JSON.stringify({ success: true, message: 'Already subscribed' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
    const nlTokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const nlToken = btoa(String.fromCharCode(...nlTokenBytes)).replace(/[/+]/g, '').slice(0, 32);
    await putR2(env, 'acreetionos-hosting', key, {
      email: body.email, subscribed: new Date().toISOString(), unsubscribe_token: nlToken
    });
    return new Response(JSON.stringify({ success: true, message: 'Subscribed to newsletter' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

async function handleNewsletterUnsubscribe(request, env) {
  const email = request.url.searchParams?.get?.('email') || '';
  const token = request.url.searchParams?.get?.('token') || '';
  if (!email || !token) return new Response(JSON.stringify({ error: 'email and token required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
  const key = 'nl-subscriber-' + email.replace(/[@.]/g, '_');
  const record = await getR2(env, 'acreetionos-hosting', key);
  if (!record) return new Response(JSON.stringify({ error: 'Subscriber not found' }), { status: 404, headers: corsHeaders({ headers: { get: () => '' } }) });
  if (record.unsubscribe_token !== token) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: corsHeaders({ headers: { get: () => '' } }) });
  await deleteR2(env, 'acreetionos-hosting', key);
  return new Response(JSON.stringify({ success: true, message: 'Unsubscribed from newsletter' }), { headers: corsHeaders({ headers: { get: () => '' } }) });
}

// ─── Malware Scanning ──────────────────────────────────────────

const SUSPICIOUS_FILENAME_PATTERNS = /\.(exe|bat|cmd|scr|ps1|vbs|jar|dll|zip|rar|7z)$/i;
const ISO_MAGIC = new Uint8Array([0x43, 0x44, 0x30, 0x30, 0x31]); // "CD001" at offset 32769
const SCAN_QUOTA_KEY = 'scan-quota-state';

async function getScanQuota(env) {
  const data = await getR2(env, 'acreetionos-hosting', SCAN_QUOTA_KEY);
  return data || { vt_remaining: 500, vt_reset: Date.now() + 86400000, vt_disabled: false };
}

async function saveScanQuota(env, quota) {
  await putR2(env, 'acreetionos-hosting', SCAN_QUOTA_KEY, quota);
}

async function getThreatIntel(env) {
  try {
    const data = await getR2(env, 'acreetionos-hosting', 'threat-intel/all-blocked-domains.txt');
    if (data && typeof data === 'object' && data.body) {
      return data.body.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
    }
    // raw text stored differently - try fetching directly
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/acreetionos-hosting/objects/threat-intel%2Fall-blocked-domains.txt`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
    if (res.ok) {
      const text = await res.text();
      return text.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean);
    }
  } catch (e) { console.error('Threat intel fetch failed:', e); }
  return [];
}

function checkThreatIntel(domain, blockedDomains) {
  const d = domain.toLowerCase();
  for (const b of blockedDomains) {
    if (d === b || d.endsWith('.' + b) || d.includes(b)) return b;
  }
  return null;
}

async function localScanISO(env, data) {
  // Local fallback scan when VirusTotal quota is exhausted
  const issues = [];
  const isoUrl = data.mirror_url;
  const blockedDomains = await getThreatIntel(env);

  try {
    // 1. HEAD request to verify URL is reachable and looks like an ISO
    const headRes = await fetch(isoUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    if (!headRes.ok) {
      issues.push('ISO URL returned ' + headRes.status);
    }

    const contentType = headRes.headers.get('Content-Type') || '';
    const contentLength = parseInt(headRes.headers.get('Content-Length') || '0');

    if (contentLength > 0 && contentLength < 104857600) {
      issues.push(`ISO too small (${(contentLength/1048576).toFixed(1)} MB) — likely not a real ISO`);
    }

    // 2. Check filename for suspicious extensions
    const pathname = new URL(isoUrl).pathname;
    if (SUSPICIOUS_FILENAME_PATTERNS.test(pathname)) {
      issues.push(`Suspicious file extension in URL: ${pathname.match(/\.[^.]+$/)[0]}`);
    }

    // 3. Check ISO magic bytes in the first chunk
    const getRes = await fetch(isoUrl, {
      headers: { 'Range': 'bytes=32769-32773' },
      signal: AbortSignal.timeout(15000)
    });
    if (getRes.ok) {
      const chunk = await getRes.arrayBuffer();
      const bytes = new Uint8Array(chunk);
      const isIso = ISO_MAGIC.every((b, i) => bytes[i] === b);
      if (!isIso) {
        issues.push('Missing ISO 9660 magic bytes — file may not be a valid ISO');
      }
    }

    // 4. Check domain against threat intelligence feeds
    try {
      const domain = new URL(isoUrl).hostname.replace(/^www\./, '');
      const match = checkThreatIntel(domain, blockedDomains);
      if (match) {
        issues.push(`Domain blocked by threat intelligence feed (match: ${match})`);
      }
    } catch (e) {
      // Invalid URL, skip domain check
    }

    // 5. Check for ISO in pathname (should contain .iso)
    if (!pathname.toLowerCase().includes('.iso')) {
      issues.push('URL does not point to an ISO file');
    }

    // 6. Flag for CI ClamAV deep scan
    if (issues.length === 0) {
      return { clean: true, scan_method: 'local_quick' };
    }

    return { clean: false, scan_method: 'local_quick', issues, auto_deregister: false, needs_clamav: true };
  } catch (e) {
    return { clean: false, scan_method: 'local_quick', issues: [`Scan error: ${e.message}`], auto_deregister: false, needs_clamav: true };
  }
}

async function scanISOSuspicious(env) {
  const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
  const flagged = [];
  const errors = [];
  const vtDisabled = [];

  let quota = await getScanQuota(env);

  // Reset VT quota if the daily window has expired
  if (quota.vt_reset && Date.now() > quota.vt_reset) {
    quota.vt_remaining = 500;
    quota.vt_reset = Date.now() + 86400000;
    quota.vt_disabled = false;
    delete quota.vt_disabled_at;
    await saveScanQuota(env, quota);
  }

  let useVt = !quota.vt_disabled && env.SCAN_MASTER;

  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (!data || (data.status !== 'active' && data.status !== 'reactivating')) continue;

    const isoUrl = data.mirror_url;
    if (!isoUrl) continue;

    let result;

    if (useVt) {
      try {
        const submitRes = await fetch('https://www.virustotal.com/api/v3/urls', {
          method: 'POST',
          headers: { 'x-apikey': env.SCAN_MASTER, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ url: isoUrl })
        });

        if (submitRes.status === 429 || submitRes.status === 403) {
          // Quota exhausted or key invalid — switch to local scan for all remaining
          quota.vt_disabled = true;
          quota.vt_disabled_at = Date.now();
          await saveScanQuota(env, quota);
          sendDiscordWebhook(env,
            `**VirusTotal Quota Exhausted** — Switching to local fallback scanning.\nStatus: ${submitRes.status}\nAll remaining providers will be scanned locally and flagged for ClamAV CI verification.`
          );
          useVt = false;
          vtDisabled.push(data.org);
          result = await localScanISO(env, data);
        } else if (!submitRes.ok) {
          errors.push(`${data.org}: VT submit failed ${submitRes.status}`);
          result = await localScanISO(env, data);
        } else {
          const submitData = await submitRes.json();
          const analysisId = submitData?.data?.id;
          if (analysisId) {
            await new Promise(r => setTimeout(r, 5000));
            const resultRes = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
              headers: { 'x-apikey': env.SCAN_MASTER }
            });
            if (resultRes.ok) {
              const resultData = await resultRes.json();
              const stats = resultData?.data?.attributes?.stats;
              if (stats && (stats.malicious > 0 || stats.suspicious > 0)) {
                result = { clean: false, scan_method: 'virustotal', malicious: stats.malicious, suspicious: stats.suspicious, total: (stats.harmless||0)+(stats.malicious||0)+(stats.suspicious||0)+(stats.undetected||0) };
              } else {
                result = { clean: true, scan_method: 'virustotal' };
              }
            } else {
              errors.push(`${data.org}: VT result fetch failed`);
              result = await localScanISO(env, data);
            }
          } else {
            errors.push(`${data.org}: no VT analysis ID`);
            result = await localScanISO(env, data);
          }
        }

        if (useVt) {
          quota.vt_remaining = (quota.vt_remaining || 500) - 1;
          if (quota.vt_remaining <= 0) {
            quota.vt_disabled = true;
            quota.vt_disabled_at = Date.now();
            useVt = false;
            sendDiscordWebhook(env, '**VirusTotal Daily Quota Reached** — Switching to local scans for remaining providers.');
          }
          await saveScanQuota(env, quota);
          await new Promise(r => setTimeout(r, 16000));
        }
      } catch (e) {
        errors.push(`${data.org}: VT error ${e.message}, falling back to local scan`);
        result = await localScanISO(env, data);
      }
    } else {
      result = await localScanISO(env, data);
    }

    // Update last_seen for clean scans or local scans that passed
    if (result.clean || result.scan_method === 'local_quick') {
      data.last_seen = new Date().toISOString();

      // Auto-reactivation logic — if status is 'reactivating', track uptime
      if (data.status === 'reactivating') {
        if (!data.reactivation_online_since) {
          data.reactivation_online_since = new Date().toISOString();
        }
        const onlineSince = new Date(data.reactivation_online_since).getTime();
        const hoursOnline = (Date.now() - onlineSince) / (1000 * 60 * 60);

        if (hoursOnline >= 24) {
          data.status = 'active';
          data.reactivation_requested = false;
          data.reactivation_online_since = undefined;
          data.reactivation_requested_at = undefined;
          sendDiscordWebhook(env,
            `**✅ Provider Auto-Reactivated**\n**Provider:** ${data.org}\n**Email:** ${data.email}\n**ISO:** ${data.mirror_url}\n**Online for:** ${hoursOnline.toFixed(1)} hours\n\nProvider has been reactivated after 24+ hours of uptime.`
          );
        }
      }

      await putR2(env, 'acreetionos-hosting', obj.key, data);
    }

    if (!result.clean) {
      const entry = {
        id: data.id, org: data.org, email: data.email,
        mirror_url: data.mirror_url,
        scan_method: result.scan_method,
        issues: result.issues || [],
      };
      if (result.malicious !== undefined) {
        entry.malicious = result.malicious;
        entry.suspicious = result.suspicious;
        entry.total = result.total;
      }
      flagged.push(entry);
    }
  }

  return { flagged, errors, vt_disabled: quota.vt_disabled, vt_quota_exhausted_for: vtDisabled };
}

async function checkStaleProviders(env) {
  const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
  const warned = [];
  const expired = [];
  const now = Date.now();
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;

  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (!data || data.status !== 'active') continue;

    const lastSeen = data.last_seen ? new Date(data.last_seen).getTime() : 0;
    const age = now - lastSeen;

    if (age > twoWeeks) {
      // Send expiry warning if not already sent (send once at 14 days)
      if (!data.expiry_warning_sent) {
        data.expiry_warning_sent = true;
        await putR2(env, 'acreetionos-hosting', obj.key, data);

        // Store email notification job
        const emailBody = `Hi ${data.org},\n\nYour AcreetionOS hosting provider listing has been flagged as inactive.\n\nYour ISO mirror (${data.mirror_url}) has not been reachable for 14 days. Per our requirements, providers must maintain an active mirror.\n\nIf you believe this is an error, please contact us at developers@acreetionos.org or re-register at https://acreetionos.org/hosting.html\n\nIf we don't hear from you within 7 days, your listing will be automatically removed.\n\n- AcreetionOS Team`;
        await sendHostingEmail(env, data.email, 'AcreetionOS Hosting — Inactivity Warning', emailBody);

        warned.push({ org: data.org, email: data.email, last_seen: data.last_seen });
      }

      // Remove after 21 days (14 days + 7 day grace)
      if (age > twoWeeks + (7 * 24 * 60 * 60 * 1000)) {
        await deleteR2(env, 'acreetionos-hosting', obj.key);
        const removalBody = `Hi ${data.org},\n\nYour AcreetionOS hosting provider listing has been removed.\n\nReason: Your ISO mirror (${data.mirror_url}) was unreachable for more than 21 days. This violates our hosting requirements.\n\nIf you'd like to re-register, please visit https://acreetionos.org/hosting.html and ensure your mirror is online before submitting.\n\nIf you believe this is an error, contact us at developers@acreetionos.org\n\n- AcreetionOS Team`;
        await sendHostingEmail(env, data.email, 'AcreetionOS Hosting — Listing Removed (Inactivity)', removalBody);
        expired.push({ org: data.org, email: data.email, last_seen: data.last_seen, reason: 'inactive_21_days' });
      }
    }

    // Also update last_seen if ISO is reachable during scan (handled in scanISOSuspicious)
    // This is a safety net for providers not scanned recently
  }

  return { warned, expired };
}

async function handleHostingScan(request, env) {
  // POST /api/hosting/scan — triggers full scan of all provider ISOs
  // Requires admin_key
  const body = await request.json().catch(() => ({}));
  if (!(await timingSafeCompare(body.admin_key, env.SECRET_SAUCE))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
  const result = await scanISOSuspicious(env);

  let needsClamav = false;

  // Auto-deregister flagged providers (VT-confirmed only — local_quick cannot confirm malware)
  for (const flagged of result.flagged) {
    if (flagged.scan_method === 'virustotal') {
      await deleteR2(env, 'acreetionos-hosting', 'provider-' + flagged.id);
      sendDiscordWebhook(env,
        `**🚨 MALWARE DETECTED — Provider Auto-Deregistered**\n**Provider:** ${flagged.org}\n**Email:** ${flagged.email}\n**ISO:** ${flagged.mirror_url}\n**Method:** ${flagged.scan_method}\n**Malicious detections:** ${flagged.malicious || 0}\n**Issues:** ${(flagged.issues || []).join(', ')}\n\nProvider has been immediately removed from the website.`
      );
    }
    if (flagged.needs_clamav || flagged.scan_method === 'local_quick') {
      needsClamav = true;
    }
  }

  if (result.vt_disabled) {
    sendDiscordWebhook(env,
      `**⚠️ VirusTotal Quota Exhausted** — Scanning switched to local fallback.\nFlagged ${result.flagged.filter(f => f.scan_method === 'local_quick').length} providers for ClamAV review.\nOnly VT-confirmed threats were auto-deregistered.`
    );
  }

  if (result.flagged.length === 0 && result.errors.length === 0) {
    sendDiscordWebhook(env, '**ISO Malware Scan Complete** — No threats detected across all providers.');
  }

  if (result.errors.length > 0) {
    sendDiscordWebhook(env, `**ISO Scan Errors**\n${result.errors.join('\n')}`);
  }

  // Check for stale/expired providers (not seen in 14+ days)
  const staleResult = await checkStaleProviders(env);
  if (staleResult.warned.length > 0) {
    sendDiscordWebhook(env,
      `**⚠️ Providers Warned (Inactive 14+ Days)**\n${staleResult.warned.map(e => `- ${e.org} (${e.email}) — Last seen: ${e.last_seen || 'never'}`).join('\n')}\n\nWarning email sent. 7-day grace period started.`
    );
  }
  if (staleResult.expired.length > 0) {
    sendDiscordWebhook(env,
      `**⏰ Providers Removed (Inactive 21+ Days)**\n${staleResult.expired.map(e => `- ${e.org} (${e.email}) — Last seen: ${e.last_seen || 'never'}`).join('\n')}\n\nThey have been removed and notified.`
    );
  }

  return new Response(JSON.stringify(result), { headers: corsHeaders({ headers: { get: () => '' } }) });
}

async function handleHostingCount(env) {
  const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
  let active = 0;
  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (data && data.status === 'active') active++;
  }
  return new Response(JSON.stringify({ count: active, threshold: 5, show_fastest: active >= 5 }), { headers: corsHeaders({ headers: { get: () => '' } }) });
}

async function handleHostingReactivate(request, env) {
  // POST /api/hosting/reactivate — Request reactivation after expiry
  // Body: { email, password, agreement: true }
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'email and password required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    }
    if (!body.agreement) {
      return new Response(JSON.stringify({ error: 'You must accept the hosting agreement to reactivate' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    }

    // Check if provider exists (including deleted/expired — we can't find deleted ones)
    // Scan all providers for matching email
    const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
    let found = null;
    let providerKey = '';
    for (const obj of objects) {
      const data = await getR2(env, 'acreetionos-hosting', obj.key);
      if (data && data.email === body.email && data.password === await hashPassword(body.password, data.password.split(':')[0])) {
        found = data; providerKey = obj.key; break;
      }
    }

    if (!found) {
      // Check if they were deleted — store a reactivation request
      return new Response(JSON.stringify({
        success: true, message: 'If your account exists, we will verify your mirror and reactivate it within 24 hours if it remains online.',
        verification_pending: true
      }), { headers: corsHeaders({ headers: { get: () => '' } }) });
    }

    // Mark as pending reactivation with timestamp
    found.reactivation_requested = true;
    found.reactivation_requested_at = new Date().toISOString();
    found.reactivation_agreement_accepted = true;
    found.status = 'reactivating';
    await putR2(env, 'acreetionos-hosting', providerKey, found);

    sendDiscordWebhook(env,
      `**🔄 Reactivation Requested**\n**Provider:** ${found.org} (${found.email})\n**ISO:** ${found.mirror_url}\n**Agreement accepted:** Yes\n\nMirror will be verified every 6 hours. If online for 24+ consecutive hours, it will be automatically reactivated.`
    );

    return new Response(JSON.stringify({
      success: true,
      message: 'Reactivation requested. Your mirror will be checked every 6 hours. If it stays online for 24 hours, you will be automatically reactivated.',
      verification_pending: true
    }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

// ─── ISO Reachability Check ────────────────────────────

const ISO_MIRRORS = {
  cinnamon: [
    'https://iso.acreetionos.org:8448/acreetion/AcreetionOS-1.0-x86_64.iso',
    'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-latest.iso',
    'https://ftp2.osuosl.org/pub/acreetionos/AcreetionOS-1.0-x86_64.iso',
    'https://archive.org/download/AcreetionOS-1.0-x86_64/AcreetionOS-1.0-x86_64.iso',
    'https://sourceforge.net/projects/acreetionos-iso-image/files/AcreetionOS-1.0-x86_64.iso/download',
  ],
  xl: [
    'https://iso.acreetionos.org:8448/acreetion/AcreetionOS_XL-1.0-x86_64.iso',
    'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS_XL-latest.iso',
    'https://ftp2.osuosl.org/pub/acreetionos/AcreetionOS_XL-1.0-x86_64.iso',
    'https://archive.org/download/AcreetionOS_XL-1.0-x86_64/AcreetionOS_XL-1.0-x86_64.iso',
    'https://sourceforge.net/projects/acreetionos-iso-image/files/AcreetionOS_XL-1.0-x86_64.iso/download',
  ],
};

function getEditionNameFromUrl(url) {
  if (url.includes('AcreetionOS-1.0-x86_64') || url.includes('AcreetionOS-latest')) return 'cinnamon';
  if (url.includes('AcreetionOS_XL')) return 'xl';
  if (url.includes('AcreetionOS32')) return '32bit';
  if (url.includes('Hyprland')) return 'hyprland';
  if (url.includes('Plasma')) return 'plasma';
  if (url.includes('MATE')) return 'mate';
  if (url.includes('GNOME')) return 'gnome';
  if (url.includes('XFCE')) return 'xfce';
  if (url.includes('Sway')) return 'sway';
  if (url.includes('i3')) return 'i3';
  return null;
}

function isValidIsoUrl(u) {
  if (typeof u !== 'string') return false;
  let parsed;
  try { parsed = new URL(u); } catch (e) { return false; }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false;
  if (host.startsWith('10.') || host.startsWith('172.16.') || host.startsWith('192.168.')) return false;
  if (host.startsWith('169.254.') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (host === '[::1]' || host === '::1') return false;
  if (/^https?:\/\/(\d{1,3}\.){3}\d{1,3}/.test(u)) {
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => p >= 0 && p <= 255)) {
      if (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) || parts[0] === 127 || parts[0] === 0 ||
          (parts[0] === 169 && parts[1] === 254)) return false;
    }
  }
  const allowedHosts = [
    'iso.acreetionos.org', 'pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev',
    'ftp2.osuosl.org', 'archive.org', 'sourceforge.net',
    'github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com',
    'media.githubusercontent.com', 'github-production-release-asset-2e65be.s3.amazonaws.com'
  ];
  return allowedHosts.some(h => host === h || host.endsWith('.' + h));
}

async function handleISOCheck(request, env) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) {
    return new Response(JSON.stringify({ error: 'url parameter required', reachable: false }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
    });
  }
  if (!isValidIsoUrl(url)) {
    return new Response(JSON.stringify({ error: 'Invalid or disallowed URL', reachable: false }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
    });
  }

  // Try URL — HEAD first, fallback to Range+magic, accept 401/403 for R2
  async function tryUrl(u) {
    // R2 URLs return 401 — treat as potentially valid
    const isR2 = u.includes('.r2.dev');

    // HEAD request (fast)
    try {
      const headRes = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      const ok = headRes.ok || headRes.status === 206 || headRes.status === 301 || headRes.status === 302;
      if (ok || (isR2 && (headRes.status === 401 || headRes.status === 403))) {
        const cl = parseInt(headRes.headers.get('Content-Length') || '0');
        if (cl >= 209715200 || isR2) return { reachable: true, status: headRes.status };
        // If no Content-Length, try Range
      }
    } catch {}

    // Range request for magic byte verification
    try {
      const res = await fetch(u, { headers: { 'Range': 'bytes=0-1048575' }, signal: AbortSignal.timeout(15000) });
      if (res.ok || res.status === 206 || (isR2 && (res.status === 401 || res.status === 403))) {
        if (isR2 && (res.status === 401 || res.status === 403)) return { reachable: true, status: res.status };
        const chunk = await res.arrayBuffer();
        const bytes = new Uint8Array(chunk);
        if (bytes.length >= 32774) {
          const magic = bytes.slice(32769, 32774);
          const isIso = magic[0] === 0x43 && magic[1] === 0x44 && magic[2] === 0x30 &&
                         magic[3] === 0x30 && magic[4] === 0x31;
          if (!isIso) return { reachable: false, status: res.status, error: 'Not valid ISO' };
        }
        const cr = res.headers.get('Content-Range') || '';
        const sm = cr.match(/\/(\d+)$/);
        if (sm) { const ts = parseInt(sm[1]); if (ts < 209715200 && !isR2) return { reachable: false, status: res.status, error: `ISO too small` }; }
        return { reachable: true, status: res.status };
      }
    } catch (e) { return { reachable: false, status: 0, error: e.message }; }
    return { reachable: false, status: 0 };
  }

  let result = await tryUrl(url);

  // If unreachable, try alternative mirrors
  let foundUrl = null;
  if (!result.reachable) {
    const edition = getEditionNameFromUrl(url);
    const mirrors = edition ? ISO_MIRRORS[edition] || [] : [];
    // Also try generic fallback patterns
    const alternatives = [
      ...mirrors,
      url.replace('https://', 'https://ftp2.osuosl.org/pub/acreetionos/').split('/').pop(),
      url.replace('.iso', '.iso.zip'),
    ].filter(u => u !== url).filter(Boolean);

    for (const alt of alternatives) {
      let altUrl = alt;
      // If it's just a filename, prepend the OSUOSL base
      if (!altUrl.startsWith('http')) {
        altUrl = `https://ftp2.osuosl.org/pub/acreetionos/${altUrl}`;
      }
      const altResult = await tryUrl(altUrl);
    if (altResult.reachable) {
        foundUrl = altUrl;
        result = { reachable: true, status: altResult.status, found_at: altUrl, used_mirror: altUrl };
        break;
    }
    }


  }

  return new Response(JSON.stringify({
    url, reachable: result.reachable, status: result.status,
    found_at: result.found_at || null,
    size: null, type: null, last_modified: null
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...corsHeaders(request) }
  });
}

// ─── Site Health Check ──────────────────────────────────

const HEALTH_PAGES = [
  '', 'flash.html', 'hosting.html', 'security.html', 'wiki.html',
  'contact.html', 'faq.html', 'install.html',
  'git-tracker.html', 'blog.html', 'build.html', 'compare.html',
  'contributing.html', 'governance.html', 'requirements.html',
  'unofficial/32bit.html', 'unofficial/gnome.html',
  'unofficial/hyprland.html', 'unofficial/i3.html',
  'unofficial/mate.html', 'unofficial/openbox.html',
  'unofficial/plasma.html', 'unofficial/sway.html',
  'unofficial/xfce.html', 'unofficial/immutable.html',
  'unofficial/'
];

const HEALTH_APIS = [
  'https://acreetionos.org/api/cve/status',
  'https://acreetionos.org/api/hosting/count',
  'https://acreetionos.org/api/mirror/best?edition=cinnamon'
];

async function handleHealthCheck(env) {
  const results = { pages: [], apis: [], downloads: [], healthy: true, timestamp: new Date().toISOString() };
  let totalIssues = 0;

  // 1. Check all HTML pages
  const pageChecks = HEALTH_PAGES.map(async (page) => {
    const url = `https://acreetionos.org/${page}`;
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      const ok = res.ok || res.status === 301 || res.status === 302;
      results.pages.push({ page, status: res.status, healthy: ok });
      if (!ok) totalIssues++;
    } catch (e) {
      results.pages.push({ page, status: 0, healthy: false, error: e.message });
      totalIssues++;
    }
  });

  // 2. Check API endpoints
  const apiChecks = HEALTH_APIS.map(async (url) => {
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
      const ok = res.ok;
      results.apis.push({ url: url.replace('https://acreetionos.org', ''), status: res.status, healthy: ok });
      if (!ok) totalIssues++;
    } catch (e) {
      results.apis.push({ url: url.replace('https://acreetionos.org', ''), status: 0, healthy: false, error: e.message });
      totalIssues++;
    }
  });

  // 3. Check ISO download links from flash.html EDITIONS + auto-fix
  const isoChecks = (async () => {
    try {
      const flashRes = await fetch('https://acreetionos.org/flash.html', { signal: AbortSignal.timeout(10000) });
      const html = await flashRes.text();
      const match = html.match(/const EDITIONS\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        let js = match[1].replace(/'/g, '"').replace(/,\s*([\]}])/g, '$1');
        const editions = JSON.parse(js);
        for (const ed of editions) {
          const url = ed.iso_url;
          if (!url) continue;
          // Use the ISO check handler which has auto-fix logic
          const fakeReq = new Request(`https://acreetionos.org/api/iso/check?url=${encodeURIComponent(url)}`);
          const checkRes = await handleISOCheck(fakeReq, env);
          const checkData = await checkRes.json();
          results.downloads.push({
            edition: ed.id, status: checkData.status,
            healthy: checkData.reachable,
            found_at: checkData.found_at || null
          });
          if (!checkData.reachable) totalIssues++;
        }
      }
    } catch (e) {
      results.downloads.push({ edition: 'flash.html', status: 0, healthy: false, error: e.message });
      totalIssues++;
    }
  });

  await Promise.all([...pageChecks, ...apiChecks, isoChecks]);

  results.healthy = totalIssues === 0;
  results.issues = totalIssues;

  // Store in R2 for status badge
  await putR2(env, 'acreetionos-hosting', 'health-check.json', results).catch(() => {});



  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...corsHeaders({ headers: { get: () => '' } }) }
  });
}

// ─── CVE Security Monitoring ──────────────────────────────────

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const OSV_BASE = 'https://api.osv.dev/v1';

function parseArchAtom(xml) {
  const items = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const title = (entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([^\]]*(?:\]\]>)?[^<]*)/) || [,''])[1].replace(']]>', '').trim();
    const content = (entry.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/) || [,''])[1].trim();
    const updated = (entry.match(/<updated>([^<]*)<\/updated>/) || [,''])[1].trim();
    const summary = (entry.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) || [,''])[1].replace(']]>', '').trim();

    const cveMatch = title.match(/(CVE-\d{4}-\d+)/gi);
    const severityMatch = content.match(/Severity:\s*(\w+)/i);
    const packageMatch = content.match(/Package\s*:\s*([^\s<&]+)/i);
    const typeMatch = content.match(/Type\s*:\s*([^<]+)/i);
    const remoteMatch = content.match(/Remote\s*:\s*(\w+)/i);
    const resolutionMatch = content.match(/Upgrade to\s*([^<]+)/i);
    const linkMatch = entry.match(/<link[^>]*href="([^"]*)"/);
    const avgMatch = content.match(/AVG-\d+/);

    if (cveMatch && cveMatch.length > 0) {
      const pkg = (packageMatch ? packageMatch[1].trim() : (title.match(/^\[([^\]]+)\]/) || [,''])[1]).replace(/&amp;/g, '&');
      items.push({
        cves: cveMatch.map(c => c.toUpperCase()),
        primary_cve: cveMatch[0].toUpperCase(),
        title: title.replace(/&amp;/g, '&'),
        link: linkMatch ? linkMatch[1] : 'https://security.archlinux.org/',
        summary: summary.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim(),
        content: content.replace(/<br\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#34;/g, '"').trim(),
        date: updated,
        package: pkg,
        severity: severityMatch ? severityMatch[1] : 'Unknown',
        type: typeMatch ? typeMatch[1].trim() : 'unknown',
        remote: remoteMatch ? remoteMatch[1] === 'Yes' : false,
        resolution: resolutionMatch ? resolutionMatch[1].trim() : '',
        avg: avgMatch ? avgMatch[0] : ''
      });
    }
  }
  return items;
}

async function fetchCVEDetails(cveId) {
  // Get CVSS score from NVD
  try {
    const res = await fetch(`${NVD_BASE}?cveId=${cveId}`, {
      headers: { 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      const vuln = data?.vulnerabilities?.[0]?.cve;
      if (vuln) {
        const metrics = vuln.metrics;
        let cvss = null, exploitability = null;
        if (metrics?.cvssMetricV31?.[0]) {
          cvss = metrics.cvssMetricV31[0].cvssData;
        } else if (metrics?.cvssMetricV30?.[0]) {
          cvss = metrics.cvssMetricV30[0].cvssData;
        } else if (metrics?.cvssMetricV2?.[0]) {
          cvss = metrics.cvssMetricV2[0].cvssData;
        }
        return {
          cvss_score: cvss?.baseScore || null,
          cvss_severity: cvss?.baseSeverity || null,
          cvss_vector: cvss?.vectorString || null,
          exploitability: metrics?.cvssMetricV31?.[0]?.exploitabilityScore || null,
          impact_score: metrics?.cvssMetricV31?.[0]?.impactScore || null,
          cisa_kev: vuln?.cisaExploitAdd ? true : false,
          cisa_due: vuln?.cisaActionDue || null,
          known_ransomware: vuln?.cisaRansomwareUse ? true : false
        };
      }
    }
  } catch (e) {}
  return null;
}

async function fetchOSVDetails(cveId) {
  // Cross-reference with OSV.dev for patch status
  try {
    const res = await fetch(`${OSV_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cveId }),
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      const vuln = data?.vulns?.[0];
      if (vuln) {
        const affected = (vuln.affected || []).map(a => ({
          package: a.package?.name || '',
          ecosystem: a.package?.ecosystem || '',
          ranges: a.ranges || [],
          versions: a.versions || []
        }));
        const patches = vuln.related ? vuln.related.filter(r => r.type === 'FIX' || r.type === 'PACKAGE') : [];
        return { affected, patches, aliases: vuln.aliases || [], severity: vuln.severity || [] };
      }
    }
  } catch (e) {}
  return null;
}

async function crossReferenceCVE(cveId) {
  const [nvd, osv] = await Promise.all([
    fetchCVEDetails(cveId),
    fetchOSVDetails(cveId).catch(() => null)
  ]);
  return { nvd, osv };
}

function generateFixScript(cve, pkg, arch) {
  var packages = pkg ? pkg.split(',').map(function(p) { return p.trim(); }).filter(Boolean) : [];
  var pkgList = packages.length > 0 ? packages.join(' ') : 'PACKAGE_NAME';
  return [
    '#!/bin/bash',
    '# AcreetionOS CVE Fix Script',
    '# CVE: ' + cve,
    '# Package: ' + pkgList,
    '# Generated: ' + new Date().toISOString(),
    '#',
    '# This script will attempt to fix the vulnerability by updating',
    '# the affected package(s) to the latest patched version.',
    '#',
    '# DISCLAIMER: This script is provided as-is. The AcreetionOS project',
    '# is not responsible for any damage or data loss. By running this',
    '# script, you accept full responsibility for your system.',
    '# Review the script before running it.',
    '',
    'set -e',
    '',
    'echo "=== AcreetionOS CVE Fix: ' + cve + ' ==="',
    'echo "Affected package(s): ' + pkgList + '"',
    'echo ""',
    '',
    'if [ ! -f /etc/arch-release ]; then',
    '  echo "ERROR: This script is for Arch Linux / AcreetionOS only."',
    '  exit 1',
    'fi',
    '',
    'if [ "$(id -u)" -ne 0 ]; then',
    '  echo "ERROR: This script must be run as root (sudo)."',
    '  exit 1',
    'fi',
    '',
    'echo "[1/3] Updating package databases..."',
    'pacman -Sy --noconfirm',
    '',
    'echo "[2/3] Upgrading affected package(s)..."',
    'pacman -S --noconfirm ' + pkgList,
    '',
    'echo "[3/3] Verification..."',
    'for pkg in ' + pkgList + '; do',
    '  if pacman -Qi "$pkg" &>/dev/null; then',
    '    ver=$(pacman -Qi "$pkg" | grep \'^Version\' | awk \'{print $3}\')',
    '    echo "  OK $pkg updated to $ver"',
    '  fi',
    'done',
    '',
    'echo ""',
    'echo "=== Fix applied for ' + cve + ' ==="',
    'echo "Please reboot if the vulnerability affects the kernel or a system service."',
    'echo "For more details: https://security.archlinux.org/' + cve + '"',
  ].join('\n');
}

// ─── Smart Mirror Selection ──────────────────────────────────

const MIRRORS = {
  cinnamon: [
    { url: 'https://iso.acreetionos.org:8448/acreetion/AcreetionOS-1.0-x86_64.iso', name: 'Direct Server', priority: 1 },
    { url: 'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS-latest.iso', name: 'Cloudflare R2', priority: 2 },
    { url: 'https://ftp2.osuosl.org/pub/acreetionos/AcreetionOS-1.0-x86_64.iso', name: 'OSUOSL Mirror', priority: 3 },
    { url: 'https://archive.org/download/AcreetionOS-1.0-x86_64/AcreetionOS-1.0-x86_64.iso', name: 'Internet Archive', priority: 4 },
    { url: 'https://sourceforge.net/projects/acreetionos-iso-image/files/AcreetionOS-1.0-x86_64.iso/download', name: 'SourceForge', priority: 5 },
  ],
  xl: [
    { url: 'https://iso.acreetionos.org:8448/acreetion/AcreetionOS_XL-1.0-x86_64.iso', name: 'Direct Server', priority: 1 },
    { url: 'https://pub-173a1f638a3b4c95b5f58b09c0b968aa.r2.dev/AcreetionOS_XL-latest.iso', name: 'Cloudflare R2', priority: 2 },
    { url: 'https://ftp2.osuosl.org/pub/acreetionos/AcreetionOS_XL-1.0-x86_64.iso', name: 'OSUOSL Mirror', priority: 3 },
    { url: 'https://archive.org/download/AcreetionOS_XL-1.0-x86_64/AcreetionOS_XL-1.0-x86_64.iso', name: 'Internet Archive', priority: 4 },
    { url: 'https://sourceforge.net/projects/acreetionos-iso-image/files/AcreetionOS_XL-1.0-x86_64.iso/download', name: 'SourceForge', priority: 5 },
  ],
};

async function handleBestMirror(request, env) {
  const edition = (new URL(request.url).searchParams.get('edition') || 'cinnamon').toLowerCase();
  const mirrors = MIRRORS[edition] || MIRRORS.cinnamon;

  // Test each mirror's latency in parallel
  const results = await Promise.all(mirrors.map(async (mirror) => {
    const start = Date.now();
    try {
      const res = await fetch(mirror.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      const latency = Date.now() - start;
      const isR2 = mirror.url.includes('.r2.dev');
      const online = res.ok || (isR2 && (res.status === 401 || res.status === 403));
      return { ...mirror, latency, status: res.status, online };
    } catch (e) {
      return { ...mirror, latency: 9999, status: 0, online: false };
    }
  }));

  // Sort by priority first, latency as tiebreaker — so direct server always wins when online
  const online = results.filter(r => r.online).sort((a, b) => a.priority - b.priority || a.latency - b.latency);
  const best = online[0] || results.sort((a, b) => a.priority - b.priority)[0];

  return new Response(JSON.stringify({
    edition,
    best: best,
    all: results,
    online_count: online.length,
    total: results.length,
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...corsHeaders({ headers: { get: () => '' } }) }
  });
}

async function handleCVEFeed(env, ctx) {
  // Try fetching Atom feed first — this is the primary data source
  let atomCves = [];
  try {
    const res = await fetch('https://security.archlinux.org/advisory/feed.atom', {
      headers: { 'User-Agent': CHROME_UA }
    });
    if (res.ok) {
      atomCves = parseArchAtom(await res.text());
    }
  } catch (e) { /* feed fetch failed */ }

  // Check cache for enrichment data (CVSS, CISA KEV)
  const cached = await getR2(env, 'acreetionos-hosting', 'cve-cache.json').catch(() => null);
  const cacheAge = cached ? (Date.now() - new Date(cached.updated || 0).getTime()) : Infinity;
  const cacheUsable = cached && cached.cves && cached.cves.length > 0;

  // Merge: use atom CVEs with enrichment from cache where available
  if (atomCves.length > 0) {
    const cveMap = {};
    if (cacheUsable) {
      for (const c of cached.cves) {
        cveMap[c.primary_cve] = c.cross_ref;
      }
    }
    const merged = atomCves.map(c => ({ ...c, cross_ref: cveMap[c.primary_cve] || null }));
    const payload = { cves: merged, count: merged.length, updated: new Date().toISOString(), source: 'security.archlinux.org' };

    // Trigger background enrichment + cache update for next visit
    ctx.waitUntil((async () => {
      try {
        const toEnrich = atomCves.slice(0, 3).filter(c => !cveMap[c.primary_cve]);
        if (toEnrich.length > 0) {
          const enriched = await Promise.all(toEnrich.map(async (cve) => {
            const crossRef = await crossReferenceCVE(cve.primary_cve).catch(() => null);
            return { ...cve, cross_ref: crossRef };
          }));
          const enrichedMap = {};
          for (const c of enriched) enrichedMap[c.primary_cve] = c.cross_ref;
          const updatedCves = atomCves.map(c => ({ ...c, cross_ref: enrichedMap[c.primary_cve] || cveMap[c.primary_cve] || null }));
          await putR2(env, 'acreetionos-hosting', 'cve-cache.json', {
            updated: new Date().toISOString(), cves: updatedCves, count: updatedCves.length,
            source: 'security.archlinux.org/advisory/feed.atom'
          });
        }
      } catch (e) { /* enrichment failed */ }
    })());

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120', ...corsHeaders({ headers: { get: () => '' } }) }
    });
  }

  // Atom feed failed — serve full cache if available
  if (cacheUsable) {
    return new Response(JSON.stringify({ cves: cached.cves, count: cached.count, updated: cached.updated, source: 'cached', cached: true }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...corsHeaders({ headers: { get: () => '' } }) }
    });
  }

  return new Response(JSON.stringify({ error: 'No CVE data available', cves: [], count: 0 }), { headers: corsHeaders({ headers: { get: () => '' } }) });
}

async function handleCVEStatus(env, ctx) {
  const cached = await getR2(env, 'acreetionos-hosting', 'cve-cache.json');
  if (cached && cached.cves) {
    const critical = cached.cves.filter(c =>
      c.severity?.toLowerCase() === 'critical' ||
      c.severity?.toLowerCase() === 'high' ||
      c.cross_ref?.nvd?.cvss_severity === 'CRITICAL' ||
      c.cross_ref?.nvd?.cvss_severity === 'HIGH'
    );
    const exploitable = cached.cves.filter(c => c.cross_ref?.nvd?.cisa_kev).length;
    const avgCvss = cached.cves
      .map(c => c.cross_ref?.nvd?.cvss_score)
      .filter(Boolean);
    const meanCvss = avgCvss.length > 0 ? (avgCvss.reduce((a, b) => a + b, 0) / avgCvss.length).toFixed(1) : null;
    return new Response(JSON.stringify({
      count: cached.count,
      critical: critical.length,
      exploitable,
      avg_cvss: meanCvss,
      updated: cached.updated,
      has_active: cached.count > 0,
      source: cached.source || 'archlinux'
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', ...corsHeaders({ headers: { get: () => '' } }) }
    });
  }
  return handleCVEFeed(env, ctx);
}

async function handleCVEEmbed() {
  try {
    const nonce = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
    const res = await fetch('https://security.archlinux.org/advisory/feed.atom', {
      headers: { 'User-Agent': CHROME_UA }
    });
    if (!res.ok) return new Response('Failed to load advisories', { status: 502 });
    const xml = await res.text();
    const cves = parseArchAtom(xml);

    const severityColor = { critical: '#e74c3c', high: '#f39c12', medium: '#3498db', low: '#2ecc71', unknown: '#888' };
    const rows = cves.map(c => {
      const sev = (c.severity || 'unknown').toLowerCase();
      const color = severityColor[sev] || '#888';
      const cveId = c.primary_cve || (c.cves && c.cves[0]) || '';
      const date = c.date ? new Date(c.date).toLocaleDateString() : '';
      const summary = (c.summary || '').replace(/</g, '&lt;').slice(0, 200);
      return `<tr><td><a href="https://security.archlinux.org/${cveId}" target="_blank" rel="noopener noreferrer" style="color:#e74c3c;font-family:monospace;font-size:0.85rem">${cveId}</a></td><td style="color:#999;font-size:0.8rem">${date}</td><td><span style="color:${color};font-weight:700;font-size:0.8rem">${sev.toUpperCase()}</span></td><td style="color:#ccc;font-size:0.85rem">${c.package || ''}</td><td style="color:#999;font-size:0.8rem">${summary}</td></tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Arch Linux Security Advisories</title><style nonce="${nonce}">
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#1a1a1a;color:#ccc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:1rem}
      h1{color:#e5e5e5;font-size:1.3rem;margin-bottom:0.25rem}
      .sub{color:#888;font-size:0.85rem;margin-bottom:1rem}
      table{width:100%;border-collapse:collapse}
      th{text-align:left;padding:0.5rem 0.75rem;border-bottom:2px solid #333;color:#888;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px}
      td{padding:0.5rem 0.75rem;border-bottom:1px solid #2a2a2a;vertical-align:top}
      tr:hover td{background:#222}
      ::-webkit-scrollbar{width:8px}
      ::-webkit-scrollbar-track{background:#1a1a1a}
      ::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
      ::-webkit-scrollbar-thumb:hover{background:#444}
      @media(max-width:768px){td,th{padding:0.4rem 0.5rem;font-size:0.8rem}}
    </style></head><body>
    <h1>Arch Linux Security Advisories</h1>
    <p class="sub">This is security.archlinux.org but with dark mode. — <a href="https://security.archlinux.org" target="_blank" rel="noopener noreferrer" style="color:#2ecc71">View original</a></p>
    <table><thead><tr><th>CVE</th><th>Date</th><th>Severity</th><th>Package</th><th>Summary</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Frame-Options': '',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'; style-src 'self' 'nonce-" + nonce + "'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'self' https://acreetionos.org https://www.acreetionos.org; object-src 'none'",
        ...corsHeaders({ headers: { get: () => '' } })
      }
    });
  } catch (e) {
    return new Response('Advisory proxy error: ' + e.message, { status: 502 });
  }
}

async function handleCVEFix(request, env) {
  try {
    const body = await request.json();
    if (!body.cve || body.accepted !== true) {
      return new Response(JSON.stringify({ error: 'CVE ID and acceptance required' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    }
    const cveId = body.cve.toUpperCase();
    if (!/^CVE-\d{4}-\d+$/.test(cveId)) {
      return new Response(JSON.stringify({ error: 'Invalid CVE ID format' }), { status: 400, headers: corsHeaders({ headers: { get: () => '' } }) });
    }

    const cached = await getR2(env, 'acreetionos-hosting', 'cve-cache.json');
    let cveData = null;
    if (cached && cached.cves) {
      cveData = cached.cves.find(c => c.primary_cve === cveId || (c.cves || []).includes(cveId));
    }

    const pkg = cveData ? cveData.package : '';
    const arch = 'x86_64';
    const script = generateFixScript(cveId, pkg, arch);

    // Get CVSS if available
    const cvssInfo = cveData?.cross_ref?.nvd;

    return new Response(JSON.stringify({
      cve: cveId,
      package: pkg || 'unknown',
      severity: cveData?.severity || 'Unknown',
      cvss_score: cvssInfo?.cvss_score || null,
      cvss_severity: cvssInfo?.cvss_severity || null,
      cisa_known: cvssInfo?.cisa_kev || false,
      description: cveData?.summary || '',
      resolution: cveData?.resolution || '',
      script,
      source: 'Arch Linux Security Advisory',
      source_url: cveData?.link || `https://security.archlinux.org/${cveId}`,
      disclaimer: 'This script is provided as-is. The AcreetionOS project is not responsible for any damage or data loss. By using this script, you accept full responsibility for your system.'
    }), { headers: corsHeaders({ headers: { get: () => '' } }) });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders({ headers: { get: () => '' } }) });
  }
}

// ─── Clean darren.js with no API keys — proxies through Worker ───
function getCleanDarrenJs() {
  return "/**\n * Darren Clift \u2014 The Man, The Myth, The God Emperor\n * All AI requests are proxied server-side through the Cloudflare Worker.\n * No API keys ever reach the browser.\n */\n\n(function () {\n  'use strict';\n\n  // ===== API endpoint (same-origin proxy through Worker) =====\n  var API_ENDPOINT = '/api/chat';\n\n  // ===== Teases =====\n  var teases = [\"Yeah yeah, go ahead, ask away. I'm not judging you. Much. \ud83d\ude0f\",\"Alright, spit it out. And no, I'm not gonna hold your hand through this.\",\"Oh look, someone has a question. Cute. Let me check if I care... I do, surprisingly.\",\"You're talking to a god emperor right now. Show some respect. Just kidding. Sort of.\",\"Ask and maybe receive. Or not. Depends on my mood and how dumb the question is.\",\"State your business before I go back to my Civ VII save. Those barbarians aren't gonna invade themselves.\",\"Go ahead, I'll answer. But if you ask something stupid, I'm blaming Natalie.\",\"Welcome to the Darren Show\u2122. No refunds, no exchanges, no whining. What do you want?\",\"I'd make a joke about your question but I'm too busy being a god. Proceed.\",\"Yeah? Yeah what? ...Fine, ask your question, Karen.\"];\n  var teaseIdx = -1;\n  function nextTease() { teaseIdx = (teaseIdx + 1) % teases.length; return teases[teaseIdx]; }\n  var SUGGESTIONS = [\"Who are you?\",\"Tell me about 7DTD\",\"Gen X supremacy\",\"Why master not main?\",\"What about Natalie?\",\"Claude is bestie\",\"Tell me a fun fact\",\"Your political views\"];\n  var toggle=document.getElementById('darren-toggle'),widget=document.getElementById('darren-widget'),close=document.getElementById('darren-close'),messagesEl=document.getElementById('darren-messages'),form=document.getElementById('darren-form'),input=document.getElementById('darren-input'),send=document.getElementById('darren-send'),suggestionsEl=document.getElementById('darren-suggestions');\n  function scrollBottom(){messagesEl.scrollTop=messagesEl.scrollHeight}\n  function escapeHtml(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}\n  function addMessage(r,c){var d=document.createElement('div');d.className='darren-msg '+r;if(r==='user'){d.innerHTML='<div class=\"darren-bubble\"><strong>You:</strong> '+escapeHtml(c)+'</div>'}else{d.innerHTML='<div class=\"darren-avatar\"><img src=\"bella.png\" alt=\"Darren\" width=\"32\" height=\"32\"></div><div class=\"darren-bubble\">'+c+'</div>'}messagesEl.appendChild(d);scrollBottom()}\n  function showThinking(){var d=document.createElement('div');d.className='darren-msg bot';d.innerHTML='<div class=\"darren-avatar\"><img src=\"bella.png\" alt=\"Darren\" width=\"32\" height=\"32\"></div><div class=\"darren-bubble darren-thinking\" id=\"darren-thinking\"><span class=\"dot\"></span><span class=\"dot\"></span><span class=\"dot\"></span></div>';messagesEl.appendChild(d);scrollBottom()}\n  function removeThinking(){var e=document.getElementById('darren-thinking');if(e)e.remove()}\n  function askAI(msg){showThinking();fetch(API_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'minimax/minimax-m2.5:free',messages:[{role:'system',content:\"You ARE Darren Clift. Not a chatbot. Keep answers short. Use emojis. Be opinionated. Roast lovingly.\"},{role:'user',content:msg}]})}).then(function(r){return r.json()}).then(function(data){removeThinking();if(data&&data.content){addMessage('bot',data.content)}else{addMessage('bot',nextTease()+'\\n\\nCouldn\\'t figure that one out. Try again. \ud83d\ude0f')}scrollBottom()}).catch(function(){removeThinking();addMessage('bot',nextTease()+'\\n\\nAI\\'s down. Try again later.');scrollBottom()})}\n  function handleSend(t){var m=t||input.value.trim();if(!m)return;addMessage('user',m);input.value='';send.disabled=true;askAI(m)}\n  SUGGESTIONS.forEach(function(t){var b=document.createElement('button');b.className='darren-suggestion';b.textContent=t;b.addEventListener('click',function(){handleSend(t)});suggestionsEl.appendChild(b)});\n  toggle.addEventListener('click',function(){widget.classList.add('open');scrollBottom()});\n  close.addEventListener('click',function(){widget.classList.remove('open')});\n  input.addEventListener('input',function(){send.disabled=!input.value.trim()});\n  form.addEventListener('submit',function(e){e.preventDefault();handleSend()});\n})();";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (env.GUEST_LIST) {
      try { allowedOrigins = JSON.parse(env.GUEST_LIST); } catch (e) {}
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // ─── darren.acreetionos.org — proxy from GitHub raw ─────
    if (url.hostname === 'darren.acreetionos.org') {
      // Pass through API requests to the normal Worker routing
      if (url.pathname.startsWith('/api/')) {
        // Fall through to the standard handler logic below
        // (do nothing, let it route normally)
      } else {
      const RAW_BASE = 'https://raw.githubusercontent.com/spivanatalie64/darren/gh-pages';
      // Root serves /darren/index.html (the hand-crafted full page),
      // not the empty Vite SPA at /index.html
      // Also rewrite darren.css, darren.js to the /darren/ subdirectory
      let rawPath = url.pathname;
      if (rawPath === '/') {
        rawPath = '/darren/index.html';
      } else if (rawPath === '/darren.css' || rawPath === '/darren.js') {
        rawPath = '/darren' + rawPath;
      }
      // SECURITY: serve a clean darren.js that has no API keys and
      // proxies through the Worker instead of calling OpenRouter directly
      if (rawPath === '/darren/darren.js') {
        const cleanJs = await getCleanDarrenJs();
        return new Response(cleanJs, {
          status: 200,
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            ...securityHeaders(),
          }
        });
      }
      const rawUrl = RAW_BASE + rawPath;
      const rawRes = await fetch(rawUrl, {
        headers: { 'User-Agent': CHROME_UA }
      }).catch(() => null);
      if (rawRes && rawRes.ok) {
        // raw.githubusercontent.com serves everything as text/plain,
        // so map Content-Type from file extension
        const extMap = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.webp': 'image/webp',
          '.ico': 'image/x-icon',
          '.pdf': 'application/pdf',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
        };
        const ext = Object.keys(extMap).find(e => rawUrl.endsWith(e)) || '';
        const contentType = ext ? extMap[ext] : 'application/octet-stream';
        // Fix CSP to allow CDN assets
        const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'";
        // Stream binary and text content properly.
        // securityHeaders() must come BEFORE custom Content-CSP so custom wins.
        return new Response(rawRes.body, {
          status: rawRes.status,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            ...securityHeaders(),
            'Content-Security-Policy': csp,
          }
        });
      }
      // Fallback: redirect to main site
      return Response.redirect('https://acreetionos.org', 302);
      }
    }

    // Serve flash.html directly from worker
    if (url.pathname === '/flash.html' && request.method === 'GET') {
      const res = await fetch('https://raw.githubusercontent.com/AcreetionOS-Code/acreetionos-code.github.io/main/flash.html', {
        headers: { 'User-Agent': CHROME_UA }
      });
      if (res.ok) {
        return new Response(await res.text(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120', ...securityHeaders() }
        });
      }
    }

    // Page view counter — GET returns count, POST increments
    if (url.pathname === '/api/news') {
      return handleNews(env);
    }
    if (url.pathname === '/api/counter') {
      if (request.method === 'POST') {
        visitorCount++;
        if (Date.now() - lastPersistTime > 60000) {
          lastPersistTime = Date.now();
          ctx.waitUntil(persistCount());
        }
        return new Response(JSON.stringify({ count: visitorCount }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
      return new Response(JSON.stringify({ count: visitorCount }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request), 'Cache-Control': 'no-cache' }
      });
    }

    // R2 ISO listing for AcreetionOS Immutable downloads
    if (url.pathname === '/api/r2/list') {
      const cfToken = env.CLOUDFLARE_API_TOKEN;
      const cfAccount = env.CLOUDFLARE_ACCOUNT_ID;
      if (!cfToken || !cfAccount) {
        return new Response(JSON.stringify({ error: 'R2 not configured', isos: [] }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
      try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/r2/buckets/immutable-iso/objects`, {
          headers: { 'Authorization': `Bearer ${cfToken}` }
        });
        const data = await res.json();
        const objects = data?.result?.objects || [];
        const isos = objects.filter(o => o.key.endsWith('.iso')).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10).map(o => ({
          name: o.key,
          size: o.size,
          date: o.created_at
        }));
        return new Response(JSON.stringify({ isos }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request), 'Cache-Control': 'public, max-age=3600' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, isos: [] }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
    }

    // R2 ISO download proxy (supports "latest" → resolves to newest matching ISO)
    if (url.pathname.startsWith('/api/r2/get/')) {
      let filename = url.pathname.replace('/api/r2/get/', '');
      if (!filename || !filename.endsWith('.iso')) {
        return new Response('Not found', { status: 404 });
      }
      const cfToken = env.CLOUDFLARE_API_TOKEN;
      const cfAccount = env.CLOUDFLARE_ACCOUNT_ID;
      if (!cfToken || !cfAccount) {
        return new Response('R2 not configured', { status: 503 });
}
        try {
          // Resolve "latest" to the most recent matching ISO
          if (filename.includes('latest')) {
            const prefix = filename.replace('-latest.iso', '');
            const listRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/r2/buckets/immutable-iso/objects`, {
              headers: { 'Authorization': `Bearer ${cfToken}` }
            });
            const listData = await listRes.json();
            const objects = listData?.result?.objects || [];
            const match = objects.filter(o => o.key.startsWith(prefix) && o.key.endsWith('.iso'))
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            if (match) filename = match.key;
            else return new Response('No ISO builds found', { status: 404 });
          }
          const downloadUrl = `https://${cfAccount}.r2.cloudflarestorage.com/immutable-iso/${filename}`;
          const fileRes = await fetch(downloadUrl);
          if (!fileRes.ok) return new Response('Download error', { status: 502 });
          return new Response(fileRes.body, {
            headers: {
              'Content-Type': fileRes.headers.get('Content-Type') || 'application/x-iso9660-image',
              'Content-Disposition': 'attachment; filename="' + filename + '"',
              'Cache-Control': 'public, max-age=86400'
            }
          });
        } catch (e) {
          return new Response('Download error', { status: 500 });
        }
    }

    if (url.pathname === '/api/build/status' && request.method === 'GET') {
      try {
        const edition = url.searchParams.get('edition') || '';
        const cfToken = env.CLOUDFLARE_API_TOKEN;
        const cfAccount = env.CLOUDFLARE_ACCOUNT_ID;
        if (!cfToken || !cfAccount) {
          return new Response(JSON.stringify({ error: 'R2 not configured', builds: {} }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        if (edition) {
          const statusRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/r2/buckets/build-status/objects/${edition}-status.json`, {
            headers: { 'Authorization': `Bearer ${cfToken}` }
          });
          if (!statusRes.ok) {
            return new Response(JSON.stringify({ edition, status: 'unknown', builds: [] }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
            });
          }
          const data = await statusRes.json();
          return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request), 'Cache-Control': 'no-cache' }
          });
        }
        const listRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/r2/buckets/build-status/objects`, {
          headers: { 'Authorization': `Bearer ${cfToken}` }
        });
        const listData = await listRes.json();
        const objects = listData?.result?.objects || [];
        const statuses = {};
        for (const obj of objects) {
          if (obj.key.endsWith('-status.json')) {
            const slug = obj.key.replace('-status.json', '');
            const itemRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/r2/buckets/build-status/objects/${obj.key}`, {
              headers: { 'Authorization': `Bearer ${cfToken}` }
            });
            if (itemRes.ok) {
              const itemData = await itemRes.json();
              statuses[slug] = itemData;
            }
          }
        }
        return new Response(JSON.stringify({ builds: statuses }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request), 'Cache-Control': 'no-cache' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, builds: {} }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
    }

    // Load persisted count on first request
    if (visitorCount === 0) {
      ctx.waitUntil(loadCount());
    }

    // AI news article generation
    if (request.method === 'POST' && url.pathname === '/api/news/ai') {
      if (checkRateLimit(getClientIP(request), 10)) {
        return new Response(JSON.stringify({ error: 'Too many requests, please slow down' }), {
          status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders(request) }
        });
      }
      try {
        const body = await request.json();
        const apiKey = env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'AI generation not configured' }), {
            status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        const ORmodel = DEFAULT_MODEL;
        const openRouterRes = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://acreetionos.org',
            'X-Title': 'AcreetionOS News AI'
          },
          body: JSON.stringify({
            model: ORmodel,
            messages: body.messages || [],
            max_tokens: Math.min(body.max_tokens || 512, 2048)
          })
        });
        const data = await openRouterRes.json();
        if (!openRouterRes.ok) {
          return new Response(JSON.stringify({ error: 'AI generation unavailable' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        // Only return sanitized content — never forward raw API data
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          return new Response(JSON.stringify({ error: 'AI generation unavailable' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        return new Response(JSON.stringify({ content, model: ORmodel }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'AI generation unavailable' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
    }

    // ISO Hosting Provider management
    if (url.pathname === '/api/hosting/providers' && request.method === 'GET') {
      return handleHostingGetProviders(env);
    }
    if (url.pathname === '/api/hosting/providers/snippets' && request.method === 'GET') {
      return handleHostingSnippets(env);
    }
    if (url.pathname === '/api/hosting/register' && request.method === 'POST') {
      return handleHostingRegister(request, env);
    }
    if (url.pathname === '/api/hosting/remove-request' && request.method === 'POST') {
      return handleHostingRemoveRequest(request, env);
    }
    if (url.pathname === '/api/hosting/update-request' && request.method === 'POST') {
      return handleHostingUpdateRequest(request, env);
    }
    if (url.pathname === '/api/hosting/admin/approve-removal' && request.method === 'POST') {
      return handleHostingAdminApprove(request, env);
    }
    if (url.pathname === '/api/hosting/admin/reject-removal' && request.method === 'POST') {
      return handleHostingAdminReject(request, env);
    }
    if (url.pathname === '/api/hosting/admin/pending' && request.method === 'GET') {
      const adminKey = request.headers.get('X-Admin-Key');
      if (!adminKey || !(await timingSafeCompare(adminKey, env.SECRET_SAUCE))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
      return handleHostingAdminPending(env);
    }
    if (url.pathname === '/api/hosting/subscribe' && request.method === 'POST') {
      return handleHostingSubscribe(request, env);
    }
    if (url.pathname === '/api/newsletter/subscribe' && request.method === 'POST') {
      return handleNewsletterSubscribe(request, env);
    }
    if (url.pathname === '/api/newsletter/unsubscribe' && request.method === 'GET') {
      return handleNewsletterUnsubscribe(request, env);
    }
    if (url.pathname === '/api/hosting/unsubscribe' && request.method === 'GET') {
      return handleHostingUnsubscribe(request, env);
    }
    if (url.pathname === '/api/hosting/count' && request.method === 'GET') {
      return handleHostingCount(env);
    }
    if (url.pathname === '/api/hosting/scan' && request.method === 'POST') {
      return handleHostingScan(request, env);
    }
    if (url.pathname === '/api/hosting/reactivate' && request.method === 'POST') {
      return handleHostingReactivate(request, env);
    }

    // ─── ISO reachability check (proxied to avoid CORS) ─────
    if (url.pathname === '/api/iso/check' && request.method === 'GET') {
      return handleISOCheck(request, env);
    }

    // ─── Site Health Check (runs periodically via cron) ──────
    if (url.pathname === '/api/health/check' && request.method === 'GET') {
      const adminKey = request.headers.get('x-admin-key') || '';
      if (!adminKey || !(await timingSafeCompare(adminKey, env.SECRET_SAUCE || ''))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
      }
      return handleHealthCheck(env);
    }

    // ─── Smart Mirror Selection ────────────────────────────────
    if (url.pathname === '/api/mirror/best' && request.method === 'GET') {
      return handleBestMirror(request, env);
    }

    // ─── CVE Security Endpoints ──────────────────────────────────
    if (url.pathname === '/api/cve/feed' && request.method === 'GET') {
      return handleCVEFeed(env, ctx);
    }
    if (url.pathname === '/api/cve/status' && request.method === 'GET') {
      return handleCVEStatus(env, ctx);
    }
    if (url.pathname === '/api/cve/fix' && request.method === 'POST') {
      return handleCVEFix(request, env);
    }
    if (url.pathname === '/api/cve/embed') {
      return handleCVEEmbed();
    }

    // Chat endpoint
    if (request.method !== 'POST' || url.pathname !== '/api/chat') {
      const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' https://api.github.com https://gitlab.acreetionos.org https://cloudflareinsights.com; base-uri 'self'; form-action 'self' https://www.qwant.com";
      return new Response('AcreetionOS Worker — POST /api/chat | POST /api/news/ai | /flash.html', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'Content-Security-Policy': csp, ...corsHeaders(request) }
      });
    }

    if (checkRateLimit(getClientIP(request))) {
      return new Response(JSON.stringify({ error: 'Too many requests, please slow down' }), {
        status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...corsHeaders(request) }
      });
    }

    try {
      const body = await request.json();
      if (!body.messages || !Array.isArray(body.messages)) {
        return new Response(JSON.stringify({ error: 'messages array required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }

      // Server-side OpenRouter key must be configured in env (Cloudflare Worker secrets
      // or origin server environment). This keeps keys off the client.
      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Backup AI is not configured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }

      // Only allow explicitly whitelisted free models — no wildcard matching
      let model = body.model || DEFAULT_MODEL;
      if (!FREE_MODELS.has(model)) {
        model = DEFAULT_MODEL;
      }

      const isStream = body.stream === true;

      const openRouterRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://acreetionos.org',
          'X-Title': 'AcreetionOS Chat Proxy'
        },
        body: JSON.stringify(isStream ? {
          model: model,
          messages: body.messages,
          max_tokens: Math.min(body.max_tokens || 800, 2048),
          stream: true
        } : {
          model: model,
          messages: body.messages,
          max_tokens: Math.min(body.max_tokens || 800, 2048)
        })
      });

      if (!openRouterRes.ok) {
        // Drain error body silently — never leak upstream error details
        try { await openRouterRes.text(); } catch (e) {}
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }

      if (isStream) {
        // Rewrite streaming SSE to strip any non-content fields
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        openRouterRes.body.pipeTo(new WritableStream({
          async write(chunk) {
            const text = decoder.decode(chunk, { stream: true });
            // Only forward data: lines (SSE event stream) — strip everything else
            const lines = text.split('\n').filter(l => l.startsWith('data: '));
            if (lines.length > 0) {
              await writer.write(encoder.encode(lines.join('\n') + '\n'));
            }
          },
          async close() { await writer.close(); },
          async abort(e) { await writer.abort(e); }
        })).catch(() => {});

        const headers = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders(request)
        };
        return new Response(readable, { headers });
      }

      const data = await openRouterRes.json();

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
      return new Response(JSON.stringify({
        content: content,
        model: model,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
      });
    }
  },

  // Cron: runs every 30 min — verifies all ISOs downloadable, auto-fixes broken
  async scheduled(event, env, ctx) {
    console.log('Running scheduled health check...');
    const req = new Request('https://acreetionos.org/api/health/check');
    const resp = await handleHealthCheck(env);
    const result = await resp.json();
    console.log(`Health check complete: ${result.issues} issues, healthy: ${result.healthy}`);
  }
};
