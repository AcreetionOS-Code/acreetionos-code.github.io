// Cloudflare Worker — AIDEN AI proxy + Page View Counter
// Holds the API key securely on the server, never exposed to the browser
// Maintainers: Natalie Spiva (spivanatalie64), Darren Clift (cobra3282000)
// Website: https://acreetionos.org — contact via the project channels for AIDEN
// The worker proxies the site to OpenRouter server-side. Pollinations.ai support removed.
// This worker provides /api/chat (server-side OpenRouter) and /api/counter (visitor counter).
// GET /api/counter — returns current active user count
// POST /api/counter — increments and returns new count

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Use only explicitly free community models. Keep the value in one place.
const FREE_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
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
    'Access-Control-Allow-Headers': 'Content-Type',
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Page view counter — GET returns count, POST increments
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

    // Load persisted count on first request
    if (visitorCount === 0) {
      ctx.waitUntil(loadCount());
    }

    // Only handle /api/chat
    if (request.method !== 'POST' || url.pathname !== '/api/chat') {
      return new Response('AIDEN Proxy — POST /api/chat with {messages: [...]}', {
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
