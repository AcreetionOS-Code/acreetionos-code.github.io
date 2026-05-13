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
// Use only explicitly free community models. Keep the values in one place.
const FREE_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
const WHISPER_MODEL = 'openai/whisper-1';
const ALLOWED_ORIGINS = [
  'https://acreetionos.org',
  'https://www.acreetionos.org',
  'https://acreetionos-code.github.io',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000'
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Content-Encoding',
    'Access-Control-Max-Age': '86400'
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
    'https://news.google.com/rss/search?q=AcreetionOS+Linux&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=%22AcreetionOS%22&hl=en-US&gl=US&ceid=US:en'
  ];

  async function fetchGitHub() {
    const results = [];
    try {
      const reposRes = await fetch('https://api.github.com/orgs/' + GH_ORG + '/repos?per_page=10&sort=pushed');
      if (!reposRes.ok) return results;
      const repos = await reposRes.json();
      for (const repo of repos.slice(0, 5)) {
        try {
          const [commitsRes, releasesRes] = await Promise.all([
            fetch('https://api.github.com/repos/' + GH_ORG + '/' + repo.name + '/commits?per_page=3'),
            fetch('https://api.github.com/repos/' + GH_ORG + '/' + repo.name + '/releases?per_page=2')
          ]);
          if (commitsRes.ok) {
            const commits = await commitsRes.json();
            for (const c of commits) {
              results.push({ type: 'commit', repo: repo.name, message: (c.commit.message || '').split('\n')[0], author: c.commit.author?.name || 'Unknown', date: c.commit.author?.date, url: c.html_url });
            }
          }
          if (releasesRes.ok) {
            const releases = await releasesRes.json();
            for (const r of releases) {
              results.push({ type: 'release', repo: repo.name, name: r.tag_name, desc: (r.body || '').split('\n')[0], date: r.published_at || r.created_at, url: r.html_url });
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    return results;
  }

  async function fetchGitLab() {
    const results = [];
    try {
      const projectsRes = await fetch(GL_URL + '/api/v4/projects?per_page=10&order_by=last_activity_at');
      if (!projectsRes.ok) return results;
      const projects = await projectsRes.json();
      for (const proj of projects.slice(0, 5)) {
        try {
          const commitsRes = await fetch(GL_URL + '/api/v4/projects/' + proj.id + '/repository/commits?per_page=3');
          if (commitsRes.ok) {
            const commits = await commitsRes.json();
            for (const c of commits) {
              results.push({ type: 'commit', repo: proj.path_with_namespace || proj.name, message: c.title || c.message || '', author: c.author_name || 'Unknown', date: c.created_at, url: c.web_url || (GL_URL + '/' + proj.path_with_namespace + '/-/commit/' + c.id) });
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    return results;
  }

  async function fetchRSS() {
    const results = [];
    for (const feedUrl of RSS_FEEDS) {
      try {
        const res = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AcreetionOS-News-Bot)' } });
        if (!res.ok) continue;
        const xml = await res.text();
        // Simple RSS item extraction
        const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
        for (const item of items.slice(0, 5)) {
          const title = (item.match(/<title>(?:<!\[CDATA\[)?([^\]]*)(?:\]\]>)?<\/title>/) || [,''])[1].trim();
          const link = (item.match(/<link>(?:<!\[CDATA\[)?([^\]]*)(?:\]\]>)?<\/link>/) || [,''])[1].trim();
          const desc = (item.match(/<description>(?:<!\[CDATA\[)?([^\]]*)(?:\]\]>)?<\/description>/) || [,''])[1].trim().replace(/<[^>]+>/g, '').slice(0, 200);
          const pubDate = (item.match(/<pubDate>([^<]*)<\/pubDate>/) || [,''])[1];
          if (title && link) {
            results.push({ type: 'news', repo: 'Google News', message: title, author: 'Web', desc: desc, date: pubDate, url: link });
          }
        }
      } catch (e) {}
    }
    return results;
  }

  const [gh, gl, rss] = await Promise.all([fetchGitHub(), fetchGitLab(), fetchRSS()]);
  const allData = [...gh, ...gl, ...rss].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // If there's RSS news, include those as direct articles
  const directArticles = rss.slice(0, 6).map(item => ({
    title: item.message,
    desc: item.desc || 'AcreetionOS mentioned in recent news.',
    tag: 'Community',
    tagClass: 'tag-community',
    url: item.url,
    source: 'Google News',
    date: item.date
  }));

  // Also generate AI articles from combined data
  const apiKey = env.OPENROUTER_API_KEY;
  let aiArticles = [];

  if (apiKey && allData.length > 0) {
    try {
      const activityText = allData.map(d => {
        if (d.type === 'release') return '[RELEASE] ' + d.repo + ' - ' + (d.name || '') + ': ' + (d.desc || '');
        if (d.type === 'news') return '[NEWS] ' + (d.message || '') + ' - ' + (d.desc || '');
        return '[COMMIT] ' + d.repo + ' - ' + (d.message || '') + ' (by ' + d.author + ')';
      }).join('\n');

      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
          'HTTP-Referer': 'https://acreetionos.org',
          'X-Title': 'AcreetionOS News Generator'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [
            { role: 'system', content: 'You generate news articles about AcreetionOS Linux distribution. Given raw activity data, write 2-4 concise news articles. Each article has: title (max 60 chars), summary (1-2 sentences), tag (Release/Development/Community/Infrastructure), url (most relevant URL). Respond with ONLY a valid JSON array. No markdown.' },
            { role: 'user', content: 'Recent AcreetionOS activity:\n' + activityText }
          ],
          max_tokens: 1024
        })
      });

      if (res.ok) {
        const data = await res.json();
        let content = data.choices?.[0]?.message?.content || '';
        content = content.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          aiArticles = parsed.map(a => ({
            title: a.title || 'Untitled',
            desc: a.summary || a.desc || '',
            tag: a.tag || 'Development',
            tagClass: 'tag-' + ((a.tag || 'dev').toLowerCase().includes('release') ? 'release' : (a.tag || 'dev').toLowerCase().includes('community') ? 'community' : (a.tag || 'dev').toLowerCase().includes('infra') ? 'infra' : 'commit'),
            url: a.url || 'https://acreetionos.org',
            source: 'AI Generated',
            date: new Date().toISOString()
          }));
        }
      }
    } catch (e) {}
  }

  // Combine: AI articles first, then direct RSS articles, limit to 12
  const allArticles = [...aiArticles, ...directArticles].slice(0, 12);

  return new Response(JSON.stringify({
    articles: allArticles.length > 0 ? allArticles : [
      { title: 'No Recent News', desc: 'Check back soon for the latest AcreetionOS news and updates.', tag: 'Community', tagClass: 'tag-community', url: 'https://acreetionos.org', source: 'acreetionos.org', date: new Date().toISOString() }
    ],
    meta: { totalActivities: allData.length, aiGenerated: aiArticles.length, rssFound: rss.length }
  }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...corsHeaders({ headers: { get: () => '' } }) }
  });
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

        // Decode base64 audio to a buffer
        const audioBytes = Uint8Array.from(atob(body.audio), c => c.charCodeAt(0));

        const whisperRes = await fetch(WHISPER_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://acreetionos.org',
            'X-Title': 'AIDEN Whisper (AcreetionOS Voice Input)'
          },
          body: JSON.stringify({
            model: WHISPER_MODEL,
            // Whisper API expects a file upload; OpenRouter's compatible endpoint accepts base64
            audio: body.audio,
            // hint: body.mimeType || 'audio/webm;codecs=opus'
          })
        });

        const whisperData = await whisperRes.json();

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

    // Chat endpoint
    if (request.method !== 'POST' || url.pathname !== '/api/chat') {
      return new Response('AIDEN Proxy — POST /api/chat with {messages: [...]} | POST /api/transcribe with {audio: base64}', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders(request) }
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
      const model = FREE_MODEL;

      const openRouterRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://acreetionos.org',
          'X-Title': 'AIDEN (AcreetionOS Assistant)'
        },
        body: JSON.stringify({
          model: model,
          messages: body.messages,
          max_tokens: body.max_tokens || 800
        })
      });

      const data = await openRouterRes.json();

      if (!openRouterRes.ok) {
        return new Response(JSON.stringify({
          error: data.error?.message || 'OpenRouter request failed',
          status: openRouterRes.status
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) }
        });
      }

      return new Response(JSON.stringify({
        content: data.choices?.[0]?.message?.content || '',
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
