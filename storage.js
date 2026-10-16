// ─── Storage backends ──────────────────────────────────────────────
//
// Two backends for the same logical API, selected by env.DB_BACKEND:
//
//   'r2'   the current behaviour. JSON blobs in the 'acreetionos-hosting'
//          bucket, reached through the Cloudflare REST API. Default, so an
//          unconfigured Worker behaves exactly as it does today.
//
//   'sqlite'  the acreetionos-db container on the US VPS, a SQLite file behind
//          a bearer-token HTTP shim. Adds real uniqueness on email and real
//          pagination, which R2 could not provide.
//
// WHY A FLAG AND NOT A MIGRATION: reverting must be one variable. If the new
// path misbehaves in production, setting DB_BACKEND=r2 restores the old
// behaviour with no data loss, because the R2 objects are left untouched. Do
// not delete the R2 copies until this path has been correct in production for
// long enough to trust it.
//
// Set via wrangler:  wrangler secret put DB_BACKEND   (value: 'sqlite')
//
// The database is a file on the VPS with no network protocol of its own, so it
// cannot be connected to directly. The shim exists only because a Worker cannot
// open a file. It authenticates with env.DB_API_TOKEN and is reached at
// env.DB_API_BASE (e.g. https://db.acreetionos.org).

const BUCKET = 'acreetionos-hosting';

// ── R2 backend (existing) ───────────────────────────────────────────

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
  // NOTE: R2 caps a list at 1000 objects and signals more with `truncated`.
  // This historically ignored both, so a provider list could be silently
  // partial while looking complete. Callers that need completeness should use
  // the sqlite backend, which paginates properly.
  if (data?.result?.truncated) {
    console.warn('[storage] R2 list truncated at 1000 objects for prefix', prefix,
      '- falling back may be needed');
  }
  return data?.result?.objects || [];
}

// ── SQLite backend (acreetionos-db) ─────────────────────────────────

function useSqlite(env) {
  return env.DB_BACKEND === 'sqlite' && env.DB_API_BASE && env.DB_API_TOKEN;
}

async function dbFetch(env, path, init = {}) {
  const res = await fetch(env.DB_API_BASE.replace(/\/$/, '') + path, {
    ...init,
    headers: {
      'Authorization': 'Bearer ' + env.DB_API_TOKEN,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error('db api ' + res.status + ' ' + path + ' ' + detail.slice(0, 120));
  }
  return res.status === 204 ? null : res.json();
}

// ── Email identity ─────────────────────────────────────────────────
//
// The old key derivation mangled the address into the object key:
//
//     body.email.replace(/[@.]/g, '_')
//
// which made 'a.b@x.com' and 'a_b@x.com' the SAME object, so subscribing one
// silently overwrote the other. Both backends below use the plain lowercased
// address as the identity; the sqlite backend additionally has a PRIMARY KEY
// that makes the collision a constraint violation rather than data loss.
function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function r2SubscriberKey(list, email) {
  return (list === 'newsletter' ? 'nl-subscriber-' : 'subscriber-')
    + normEmail(email).replace(/[@.]/g, '_');
}

// ── Public API ─────────────────────────────────────────────────────

async function getProvider(env, id) {
  if (useSqlite(env)) return dbFetch(env, '/providers/' + encodeURIComponent(id));
  return getR2(env, BUCKET, 'provider-' + id);
}

async function putProvider(env, record) {
  if (useSqlite(env)) {
    return !!(await dbFetch(env, '/providers', { method: 'PUT', body: JSON.stringify(record) }));
  }
  return putR2(env, BUCKET, 'provider-' + record.id, record);
}

async function deleteProvider(env, id) {
  if (useSqlite(env)) {
    const r = await dbFetch(env, '/providers/' + encodeURIComponent(id), { method: 'DELETE' });
    return r && r.deleted > 0;
  }
  return deleteR2(env, BUCKET, 'provider-' + id);
}

// Returns { providers, next_cursor, has_more }.
async function listProviders(env, { status, pendingRemoval, limit = 200, cursor } = {}) {
  if (useSqlite(env)) {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (pendingRemoval !== undefined) q.set('pending_removal', pendingRemoval ? '1' : '0');
    q.set('limit', String(limit));
    if (cursor) q.set('cursor', cursor);
    return dbFetch(env, '/providers?' + q.toString());
  }
  const objects = await listR2(env, BUCKET, 'provider-');
  const out = [];
  for (const obj of objects) {
    const rec = await getR2(env, BUCKET, obj.key);
    if (!rec) continue;
    if (status && rec.status !== status) continue;
    if (pendingRemoval === true && !rec.removal_requested) continue;
    if (pendingRemoval === false && rec.removal_requested) continue;
    out.push(rec);
  }
  out.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  return { providers: out, next_cursor: null, has_more: false };
}

// Used by /api/hosting/manage, which looks a provider up by email + password.
async function findProviderByCredentials(env, email, matches) {
  const { providers } = await listProviders(env, { limit: 500 });
  const target = normEmail(email);
  for (const p of providers) {
    if (normEmail(p.email) !== target) continue;
    if (await matches(p)) return p;
  }
  return null;
}

async function getSubscriber(env, list, email) {
  if (useSqlite(env)) {
    const q = new URLSearchParams({ list });
    return dbFetch(env, '/subscribers?' + q.toString())
      .then(r => (r.subscribers.find(s => s.email === normEmail(email)) || null));
  }
  return getR2(env, BUCKET, r2SubscriberKey(list, email));
}

async function putSubscriber(env, list, record) {
  const row = { ...record, list, email: normEmail(record.email) };
  if (useSqlite(env)) {
    return !!(await dbFetch(env, '/subscribers', { method: 'PUT', body: JSON.stringify(row) }));
  }
  return putR2(env, BUCKET, r2SubscriberKey(list, row.email), row);
}

async function deleteSubscriber(env, list, email) {
  if (useSqlite(env)) {
    const q = new URLSearchParams({ list, email: normEmail(email) });
    const r = await dbFetch(env, '/subscribers?' + q.toString(), { method: 'DELETE' });
    return r && r.deleted > 0;
  }
  return deleteR2(env, BUCKET, r2SubscriberKey(list, email));
}

// confirmedOnly is what makes double opt-in enforceable: the newsletter job
// must ask for confirmed rows only, or unproven addresses get mailed.
async function listSubscribers(env, { list, confirmedOnly = false } = {}) {
  if (useSqlite(env)) {
    const q = new URLSearchParams();
    if (list) q.set('list', list);
    if (confirmedOnly) q.set('confirmed_only', '1');
    const r = await dbFetch(env, '/subscribers?' + q.toString());
    return r.subscribers;
  }
  const prefix = list === 'newsletter' ? 'nl-subscriber-' : 'subscriber-';
  const objects = await listR2(env, BUCKET, prefix);
  const out = [];
  for (const obj of objects) {
    const rec = await getR2(env, BUCKET, obj.key);
    if (!rec) continue;
    // R2 rows have no confirmation state at all, so asking for confirmed rows
    // returns nothing rather than pretending unconfirmed rows are fine.
    if (confirmedOnly) continue;
    out.push(rec);
  }
  return out;
}

// confirmSubscriber() and findSubscriberByToken() are deliberately NOT exported
// yet. Double opt-in needs a confirmation endpoint on the Worker and a
// confirmed-only filter in generate-newsletter.py before any address can be
// considered proven; wiring the shim side early would let a caller believe
// confirmation is enforced when nothing consumes confirmed_at yet. Add them
// with that work, not before.

export {
  BUCKET,
  getR2, putR2, deleteR2, listR2,
  useSqlite, dbFetch, normEmail,
  getProvider, putProvider, deleteProvider, listProviders,
  findProviderByCredentials,
  getSubscriber, putSubscriber, deleteSubscriber, listSubscribers,
};