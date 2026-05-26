// Cloudflare Worker — AIDEN AI proxy + Page View Counter + Audio Transcription
// Holds the API key securely on the server, never exposed to the browser
// Maintainers: Natalie Spiva (spivanatalie64), Darren Clift (cobra3282000)
// Website: https://acreetionos.org — contact via the project channels for AIDEN
// The worker proxies the site to OpenRouter server-side. Pollinations.ai support removed.
// This worker provides:
//   GET  /api/news    — aggregates AcreetionOS news from GitHub, GitLab, and RSS, generates articles with AI
//   POST /api/chat    — server-side OpenRouter chat (free model)
//   POST /api/transcribe — audio transcription via OpenRouter Whisper (free)
//   GET  /api/counter — returns current active user count
//   POST /api/counter — increments and returns new count

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const WHISPER_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';
const TTS_URL = 'https://openrouter.ai/api/v1/audio/speech';
// Use only explicitly free community models. Keep the values in one place.
const FREE_MODEL = 'openrouter/auto';
const WHISPER_MODEL = 'openai/whisper-large-v3';
const TTS_MODEL = 'cartesia-ai/cartesia-tts';
const ALLOWED_ORIGINS = [
  'https://acreetionos.org',
  'https://www.acreetionos.org',
  'https://acreetionos-code.github.io',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000'
];

function securityHeaders() {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' https://api.github.com https://gitlab.acreetionos.org https://cloudflareinsights.com https://openrouter.ai; base-uri 'self'; form-action 'self' https://www.qwant.com"
  };
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Content-Encoding, Authorization',
    'Access-Control-Max-Age': '86400',
    ...securityHeaders()
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
  const GL_URL = 'https://gitlab.acreetionos.org';
  const RSS_FEEDS = [
    'https://news.google.com/rss/search?q=%22AcreetionOS%22&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=AcreetionOS+Arch+Linux&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=Arch+Linux+news&hl=en-US&gl=US&ceid=US:en'
  ];

  try {
    const [gh, gl, rss] = await Promise.all([
      (async () => {
        try {
          const reposRes = await fetch('https://api.github.com/orgs/' + GH_ORG + '/repos?per_page=5&sort=pushed');
          if (!reposRes.ok) return [];
          const repos = await reposRes.json();
          const repoFetches = repos.slice(0, 3).map(repo =>
            Promise.all([
              fetch('https://api.github.com/repos/' + GH_ORG + '/' + repo.name + '/commits?per_page=2'),
              fetch('https://api.github.com/repos/' + GH_ORG + '/' + repo.name + '/releases?per_page=1')
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
          const projectsRes = await fetch(GL_URL + '/api/v4/projects?per_page=5&order_by=last_activity_at');
          if (!projectsRes.ok) return [];
          const projects = await projectsRes.json();
          const projFetches = projects.slice(0, 3).map(proj =>
            fetch(GL_URL + '/api/v4/projects/' + proj.id + '/repository/commits?per_page=2')
              .then(async (commitsRes) => {
                const items = [];
                if (commitsRes.ok) {
                  const commits = await commitsRes.json();
                  for (const c of commits) {
                    items.push({ type: 'commit', repo: proj.path_with_namespace || proj.name, message: c.title || c.message || '', author: c.author_name || 'Unknown', date: c.created_at, url: c.web_url || (GL_URL + '/' + proj.path_with_namespace + '/-/commit/' + c.id), source: 'GitLab' });
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
          fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AcreetionOS-News-Bot)' } })
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

// ─── ISO Hosting Provider Management ───────────────────────────────

async function getR2(env, bucket, key) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${bucket}/objects/${key}`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.result;
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

function hashPassword(password) {
  let h = 0;
  for (let i = 0; i < password.length; i++) { const c = password.charCodeAt(i); h = ((h << 5) - h) + c; h |= 0; }
  return 'h' + Math.abs(h).toString(36);
}

function getCors() {
  return { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
}

async function sendDiscordWebhook(env, message) {
  const webhook = env.DISCORD_WEBHOOK_URL;
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
  const job = { to, subject, body, from: env.EMAIL_FROM || 'developers@acreetionos.org', created: new Date().toISOString() };
  const key = 'email-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  await putR2(env, 'acreetionos-hosting', key, job);
}

async function handleHostingGetProviders(env) {
  const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
  const providers = [];
  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (data) providers.push(data);
  }
  return new Response(JSON.stringify({ providers }), { headers: getCors() });
}

async function handleHostingRegister(request, env) {
  try {
    const body = await request.json();
    if (!body.org || !body.email || !body.password || !body.mirror_url || !body.location) {
      return new Response(JSON.stringify({ error: 'org, email, password, mirror_url, and location are required' }), { status: 400, headers: getCors() });
    }
    const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const provider = {
      id, org: body.org, email: body.email, website: body.website || '',
      mirror_url: body.mirror_url, location: body.location,
      bandwidth: body.bandwidth || '', notes: body.notes || '',
      password: hashPassword(body.password),
      status: 'pending', created: new Date().toISOString(),
      removal_requested: false,
      discord_user_id: body.discord_user_id || '',
      subscribed: body.subscribe === true
    };
    const ok = await putR2(env, 'acreetionos-hosting', 'provider-' + id, provider);
    if (!ok) return new Response(JSON.stringify({ error: 'Storage error' }), { status: 500, headers: getCors() });

    // Mailing list subscription
    if (body.subscribe && body.email) {
      await putR2(env, 'acreetionos-hosting', 'subscriber-' + body.email.replace(/[@.]/g, '_'), {
        email: body.email, org: body.org, subscribed: new Date().toISOString(), unsubscribe_token: Math.random().toString(36).slice(2, 10)
      });
    }

    // Notify Discord
    sendDiscordWebhook(env,
      `**New Hosting Provider Registration**\n**Organization:** ${body.org}\n**Email:** ${body.email}\n**Location:** ${body.location}\n**Mirror:** ${body.mirror_url}\n**Website:** ${body.website || 'N/A'}\n**Discord User ID:** ${body.discord_user_id || 'N/A'}\n**Subscribed:** ${body.subscribe ? 'Yes' : 'No'}\n**ID:** ${id}\n\nTo approve: POST to /api/hosting/admin/approve-removal with { provider_id: "${id}", admin_key: "YOUR_ADMIN_KEY" }\nTo reject: POST to /api/hosting/admin/reject-removal with same\nAdmin page: https://acreetionos.org/api/hosting/admin/pending`
    );

    return new Response(JSON.stringify({ success: true, message: 'Registration submitted for review', id }), { headers: getCors() });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: getCors() });
  }
}

async function handleHostingRemoveRequest(request, env) {
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'email and password required' }), { status: 400, headers: getCors() });
    }
    const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
    let found = null;
    for (const obj of objects) {
      const data = await getR2(env, 'acreetionos-hosting', obj.key);
      if (data && data.email === body.email && data.password === hashPassword(body.password)) { found = data; break; }
    }
    if (!found) return new Response(JSON.stringify({ error: 'Provider not found or password incorrect' }), { status: 404, headers: getCors() });
    found.removal_requested = true;
    found.removal_reason = body.notes || 'No reason given';
    await putR2(env, 'acreetionos-hosting', 'provider-' + found.id, found);
    sendDiscordWebhook(env, `**Removal Requested**\n**Provider:** ${found.org} (${found.email})\n**Reason:** ${body.notes || 'None'}\n**ID:** ${found.id}`);
    return new Response(JSON.stringify({ success: true, message: 'Removal request submitted for admin approval' }), { headers: getCors() });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: getCors() });
  }
}

async function handleHostingUpdateRequest(request, env) {
  try {
    const body = await request.json();
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'email and password required' }), { status: 400, headers: getCors() });
    }
    const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
    let found = null;
    for (const obj of objects) {
      const data = await getR2(env, 'acreetionos-hosting', obj.key);
      if (data && data.email === body.email && data.password === hashPassword(body.password)) { found = data; break; }
    }
    if (!found) return new Response(JSON.stringify({ error: 'Provider not found or password incorrect' }), { status: 404, headers: getCors() });
    found.notes = body.notes || found.notes;
    await putR2(env, 'acreetionos-hosting', 'provider-' + found.id, found);
    return new Response(JSON.stringify({ success: true, message: 'Listing updated' }), { headers: getCors() });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: getCors() });
  }
}

async function handleHostingAdminApprove(request, env) {
  try {
    const body = await request.json();
    if (!body.admin_key || body.admin_key !== env.ADMIN_KEY) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: getCors() });
    if (!body.provider_id) return new Response(JSON.stringify({ error: 'provider_id required' }), { status: 400, headers: getCors() });
    const data = await getR2(env, 'acreetionos-hosting', 'provider-' + body.provider_id);
    if (!data) return new Response(JSON.stringify({ error: 'Provider not found' }), { status: 404, headers: getCors() });
    if (body.action === 'approve-removal' || body.action === 'remove') {
      await deleteR2(env, 'acreetionos-hosting', 'provider-' + body.provider_id);
      sendDiscordWebhook(env, `**Provider Removed (Admin Approved)**\n**Provider:** ${data.org} (${data.email})`);
      // Notify mailing list about removal
      if (data.subscribed && data.email) {
        sendHostingEmail(env, data.email, 'AcreetionOS Hosting - Your Provider Has Been Removed',
          `Hi ${data.org},\n\nYour hosting provider listing for AcreetionOS has been removed as requested.\n\nThank you for your support.\n- AcreetionOS Team`);
      }
      triggerRedeploy(env);
      return new Response(JSON.stringify({ success: true, message: 'Provider removed and redeploy triggered' }), { headers: getCors() });
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
    triggerRedeploy(env);
    return new Response(JSON.stringify({ success: true, message: 'Provider approved and redeploy triggered' }), { headers: getCors() });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: getCors() });
  }
}

async function handleHostingAdminReject(request, env) {
  try {
    const body = await request.json();
    if (!body.admin_key || body.admin_key !== env.ADMIN_KEY) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: getCors() });
    if (!body.provider_id) return new Response(JSON.stringify({ error: 'provider_id required' }), { status: 400, headers: getCors() });
    await deleteR2(env, 'acreetionos-hosting', 'provider-' + body.provider_id);
    sendDiscordWebhook(env, `**Provider Registration Rejected**\n**ID:** ${body.provider_id}`);
    return new Response(JSON.stringify({ success: true, message: 'Provider registration rejected and removed' }), { headers: getCors() });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: getCors() });
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
  return new Response(JSON.stringify({ pending, total: all.length }), { headers: getCors() });
}

async function handleHostingSubscribe(request, env) {
  try {
    const body = await request.json();
    if (!body.email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: getCors() });
    const key = 'subscriber-' + body.email.replace(/[@.]/g, '_');
    const existing = await getR2(env, 'acreetionos-hosting', key);
    if (existing) return new Response(JSON.stringify({ success: true, message: 'Already subscribed' }), { headers: getCors() });
    await putR2(env, 'acreetionos-hosting', key, {
      email: body.email, org: body.org || '', subscribed: new Date().toISOString(), unsubscribe_token: Math.random().toString(36).slice(2, 10)
    });
    return new Response(JSON.stringify({ success: true, message: 'Subscribed to hosting updates' }), { headers: getCors() });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: getCors() });
  }
}

async function handleHostingUnsubscribe(request, env) {
  const email = request.url.searchParams?.get?.('email') || '';
  if (!email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: getCors() });
  const key = 'subscriber-' + email.replace(/[@.]/g, '_');
  await deleteR2(env, 'acreetionos-hosting', key);
  return new Response(JSON.stringify({ success: true, message: 'Unsubscribed' }), { headers: getCors() });
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
  const vtQuarantined = [];
  const vtDisabled = [];

  let quota = await getScanQuota(env);
  let useVt = !quota.vt_disabled && env.VIRUSTOTAL_API_KEY;

  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (!data || data.status !== 'active') continue;

    const isoUrl = data.mirror_url;
    if (!isoUrl) continue;

    let result;

    if (useVt) {
      try {
        const submitRes = await fetch('https://www.virustotal.com/api/v3/urls', {
          method: 'POST',
          headers: { 'x-apikey': env.VIRUSTOTAL_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
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
              headers: { 'x-apikey': env.VIRUSTOTAL_API_KEY }
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

  return { flagged, errors, vt_disabled: quota.vt_disabled, vt_quarantined: vtDisabled };
}

async function handleHostingScan(request, env) {
  // POST /api/hosting/scan — triggers full scan of all provider ISOs
  // Requires admin_key
  const body = await request.json().catch(() => ({}));
  if (body.admin_key !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: getCors() });
  }
  const result = await scanISOSuspicious(env);

  let needsClamav = false;

  // Auto-deregister flagged providers (VT-confirmed only)
  for (const flagged of result.flagged) {
    if (flagged.scan_method === 'virustotal' || (flagged.scan_method === 'local_quick' && flagged.malicious)) {
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

  // Trigger CI ClamAV deep scan for locally-flagged providers
  if (needsClamav) {
    triggerClamavScan(env);
  }

  if (result.flagged.length === 0 && result.errors.length === 0) {
    sendDiscordWebhook(env, '**ISO Malware Scan Complete** — No threats detected across all providers.');
  }

  if (result.errors.length > 0) {
    sendDiscordWebhook(env, `**ISO Scan Errors**\n${result.errors.join('\n')}`);
  }

  // Trigger redeploy if providers were removed
  if (result.flagged.length > 0) {
    triggerRedeploy(env);
  }

  return new Response(JSON.stringify(result), { headers: getCors() });
}

async function handleHostingCount(env) {
  const objects = await listR2(env, 'acreetionos-hosting', 'provider-');
  let active = 0;
  for (const obj of objects) {
    const data = await getR2(env, 'acreetionos-hosting', obj.key);
    if (data && data.status === 'active') active++;
  }
  return new Response(JSON.stringify({ count: active, threshold: 5, show_fastest: active >= 5 }), { headers: getCors() });
}

async function triggerClamavScan(env) {
  const ghToken = env.GH_TOKEN;
  if (!ghToken) return;
  try {
    await fetch('https://api.github.com/repos/AcreetionOS-Code/acreetionos-code.github.io/actions/workflows/scan-provider-isos.yml/dispatches', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ghToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AcreetionOS-Hosting' },
      body: JSON.stringify({ ref: 'main' })
    });
  } catch (e) { console.error('ClamAV scan trigger failed:', e); }
}

async function triggerRedeploy(env) {
  const ghToken = env.GH_TOKEN;
  if (!ghToken) return;
  try {
    await fetch('https://api.github.com/repos/AcreetionOS-Code/acreetionos-code.github.io/actions/workflows/deploy-hosting-providers.yml/dispatches', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ghToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AcreetionOS-Hosting' },
      body: JSON.stringify({ ref: 'main' })
    });
  } catch (e) { console.error('Redeploy trigger failed:', e); }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
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
        if (!fileRes.ok) return new Response('Not found', { status: 404 });
        return new Response(fileRes.body, {
          headers: {
            'Content-Type': 'application/x-iso9660-image',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'public, max-age=86400'
          }
        });
      } catch (e) {
        return new Response('Download error', { status: 500 });
      }
    }

    // Build system — trigger GitHub Actions builds and check status
    if (url.pathname === '/api/build/trigger' && request.method === 'POST') {
      try {
        const body = await request.json();
        const edition = body.edition;
        if (!edition) {
          return new Response(JSON.stringify({ error: 'edition required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        const ghToken = env.GH_TOKEN;
        if (!ghToken) {
          return new Response(JSON.stringify({ error: 'Build trigger not configured' }), {
            status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        const ghRes = await fetch('https://api.github.com/repos/AcreetionOS-Code/acreetionos-code.github.io/actions/workflows/build-all.yml/dispatches', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ghToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AcreetionOS-Build-Trigger'
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: { edition }
          })
        });
        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return new Response(JSON.stringify({ error: 'GitHub trigger failed', detail: errText.slice(0, 300) }), {
            status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        return new Response(JSON.stringify({ triggered: true, edition }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Trigger error: ' + err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
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

    // Audio transcription via OpenRouter Whisper (free)
    // POST /api/transcribe  — body: { audio: <base64 opus/webm>, mimeType: string }
    if (request.method === 'POST' && url.pathname === '/api/transcribe') {
      try {
        const body = await request.json();
        if (!body.audio) {
          return new Response(JSON.stringify({ error: 'audio data required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }

        const apiKey = env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'Transcription not configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }

        // Derive format from MIME type
        const mime = body.mimeType || 'audio/webm';
        const fmt = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm';

        const whisperRes = await fetch(WHISPER_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://acreetionos.org',
            'X-Title': 'AIDEN Whisper (AcreetionOS Voice Input)'
          },
          body: JSON.stringify({
            model: WHISPER_MODEL,
            input_audio: {
              data: body.audio,
              format: fmt
            }
          })
        });

        // OpenRouter may return 200 with empty body on format issues; check for that too
        const whisperText = await whisperRes.text();
        if (!whisperText || whisperText.trim().length === 0) {
          return new Response(JSON.stringify({ error: 'Empty transcription response' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }

        let whisperData;
        try {
          whisperData = JSON.parse(whisperText);
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid transcription response', raw: whisperText.slice(0, 200) }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }

        if (!whisperRes.ok) {
          return new Response(JSON.stringify({
            error: whisperData.error?.message || 'Transcription failed',
            status: whisperRes.status
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }

        return new Response(JSON.stringify({
          text: whisperData.text || '',
          model: WHISPER_MODEL
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: 'Transcription error: ' + err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
    }

    // Load persisted count on first request
    if (visitorCount === 0) {
      ctx.waitUntil(loadCount());
    }

    // AI news article generation
    if (request.method === 'POST' && url.pathname === '/api/news/ai') {
      try {
        const body = await request.json();
        const apiKey = env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'AI generation not configured' }), {
            status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        const openRouterRes = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://acreetionos.org',
            'X-Title': 'AcreetionOS News AI'
          },
          body: JSON.stringify({
            model: FREE_MODEL,
            messages: body.messages || [],
            max_tokens: body.max_tokens || 512
          })
        });
        const data = await openRouterRes.json();
        if (!openRouterRes.ok) {
          const errDetail = JSON.stringify(data).slice(0, 500);
          return new Response(JSON.stringify({
            error: data.error?.message || data.error || 'AI generation failed',
            detail: errDetail,
            status: openRouterRes.status
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'AI generation failed: ' + err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
    }

    // Text-to-Speech via OpenRouter (Cartesia TTS — natural human voice)
    if (request.method === 'POST' && url.pathname === '/api/tts') {
      try {
        const body = await request.json();
        if (!body.input) {
          return new Response(JSON.stringify({ error: 'input text required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        const apiKey = env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'TTS not configured' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        const ttsRes = await fetch(TTS_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://acreetionos.org',
            'X-Title': 'AIDEN TTS (AcreetionOS Voice Output)'
          },
          body: JSON.stringify({
            model: TTS_MODEL,
            input: body.input,
            voice: body.voice || 'nova',
            response_format: 'mp3'
          })
        });
        if (!ttsRes.ok) {
          const errText = await ttsRes.text();
          return new Response(JSON.stringify({ error: 'TTS failed', detail: errText.slice(0, 300) }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
          });
        }
        return new Response(ttsRes.body, {
          headers: {
            'Content-Type': ttsRes.headers.get('Content-Type') || 'audio/mpeg',
            ...corsHeaders(request)
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'TTS error: ' + err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
    }

    // ISO Hosting Provider management
    if (url.pathname === '/api/hosting/providers' && request.method === 'GET') {
      return handleHostingGetProviders(env);
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
      return handleHostingAdminPending(env);
    }
    if (url.pathname === '/api/hosting/subscribe' && request.method === 'POST') {
      return handleHostingSubscribe(request, env);
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

    // Chat endpoint
    if (request.method !== 'POST' || url.pathname !== '/api/chat') {
      const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' https://openrouter.ai https://api.github.com https://gitlab.acreetionos.org https://news.google.com https://api.allorigins.win https://cloudflareinsights.com; base-uri 'self'; form-action 'self' https://www.qwant.com";
      return new Response('AIDEN Proxy — POST /api/chat with {messages: [...]} | POST /api/transcribe with {audio: base64} | POST /api/news/ai with {messages: [...]}', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'Content-Security-Policy': csp, ...corsHeaders(request) }
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

      // Only allow explicitly whitelisted free models to be used
      let model = body.model || FREE_MODEL;
      if (model !== FREE_MODEL && !model.endsWith(':free')) {
        model = FREE_MODEL;
      }

      const isStream = body.stream === true;

      const openRouterRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://acreetionos.org',
          'X-Title': 'AIDEN (AcreetionOS Assistant)'
        },
        body: JSON.stringify(isStream ? {
          model: model,
          messages: body.messages,
          max_tokens: body.max_tokens || 800,
          stream: true
        } : {
          model: model,
          messages: body.messages,
          max_tokens: body.max_tokens || 800
        })
      });

      if (isStream) {
        // Forward SSE stream directly to client
        const headers = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders(request)
        };
        return new Response(openRouterRes.body, { headers });
      }

      const data = await openRouterRes.json();

      if (!openRouterRes.ok) {
        const errDetail = JSON.stringify(data).slice(0, 500);
        return new Response(JSON.stringify({
          error: data.error?.message || data.error || 'OpenRouter request failed',
          detail: errDetail,
          status: openRouterRes.status
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        const errDetail = JSON.stringify(data).slice(0, 500);
        return new Response(JSON.stringify({
          error: 'AI model returned empty response',
          detail: errDetail,
          model: data.model || FREE_MODEL
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }
      return new Response(JSON.stringify({
        content: content,
        model: data.model || FREE_MODEL,
        backend: 'openrouter'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
      });
    }
  }
};
