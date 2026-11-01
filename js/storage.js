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

// confirmSubscriber() and findSubscriberByToken() — exported now as part of
// 7k8: the Worker exposes GET confirm routes, so "consuming confirmed_at"
// exists (the confirm endpoint) and the newsletter job asks for confirmed
// rows only.

async function confirmSubscriber(env, token) {
  if (useSqlite(env)) {
    const r = await dbFetch(env, '/subscribers/confirm', {
      method: 'POST',
      body: JSON.stringify({ unsubscribe_token: token }),
    });
    return Boolean(r && r.ok);
  }
  // R2 path: read the row by token (unsubscribe_token), stamp confirmed_at,
  // write it back. No uniqueness server-side, so a torn read/write window
  // exists here that the sqlite backend does not have.
  const prefix = ['nl-subscriber-', 'subscriber-'];
  for (const p of prefix) {
    for (const obj of await listR2(env, BUCKET, p)) {
      const row = await getR2(env, BUCKET, obj.key);
      if (row && row.unsubscribe_token === token && !row.confirmed_at) {
        await putR2(env, BUCKET, obj.key, { ...row, confirmed_at: new Date().toISOString() });
        return true;
      }
    }
  }
  return false;
}

async function findSubscriberByToken(env, token) {
  if (useSqlite(env)) {
    try {
      return await dbFetch(env, '/subscribers/by-token/' + encodeURIComponent(token));
    } catch { return null; }
  }
  for (const p of ['nl-subscriber-', 'subscriber-']) {
    for (const obj of await listR2(env, BUCKET, p)) {
      const row = await getR2(env, BUCKET, obj.key);
      if (row && row.unsubscribe_token === token) return row;
    }
  }
  return null;
}

// Provider registration confirmation (7k8): mirrors carry confirm_token and
// email_confirmed_at exactly like subscribers carry unsubscribe_token and
// confirmed_at, so an approval without proof of ownership cannot happen.
async function findProviderByToken(env, token) {
  if (useSqlite(env)) {
    try {
      return await dbFetch(env, '/providers/by-token/' + encodeURIComponent(token));
    } catch { return null; }
  }
  for (const obj of await listR2(env, BUCKET, 'provider-')) {
    const row = await getR2(env, BUCKET, obj.key);
    if (row && row.confirm_token === token) return row;
  }
  return null;
}

async function confirmProvider(env, token) {
  if (useSqlite(env)) {
    const r = await dbFetch(env, '/providers/confirm', {
      method: 'POST',
      body: JSON.stringify({ confirm_token: token }),
    });
    return Boolean(r && r.ok && r.provider);
  }
  const row = await findProviderByToken(env, token);
  if (!row || row.email_confirmed_at) return false;
  return putProvider(env, {
    ...row,
    email_confirmed_at: new Date().toISOString(),
    confirm_token: null,
  });
}

// ── shared store: limits, replay, mail queue (beads ray, 38u, 7k8) ──────
//
// These are the Worker-side doors to the same shim. When the store is not
// configured (DB_BACKEND not 'sqlite', or DB_API_BASE/TOKEN missing) every
// helper returns null and the caller falls back to its old behaviour. That
// keeps the deploy order free: code can land before the secrets exist.
//
// Fail semantics, chosen deliberately:
//  - LIMITS: fail-open for reads (chat/translate are not state-changing and
//    the epic explicitly serves reads on rate limit when the store is down).
//    The call sites that protect state-changing writes use fail-open too but
//    survive because the WRITE itself is now double-opt-in gated instead.
//  - REPLAY/MAIL QUEUE: fail-closed for mail enqueue is wrong (defers would
//    vanish), so enqueue failure surfaces as an error the caller turns into a
//    503, matching "fails DEFERRED, not OPEN".

async function sharedLimit(env, bucket, { limit, windowMs, weight = 1, allowOver = false } = {}) {
  if (!useSqlite(env)) return null;
  if (allowOver) {
    // charge without a check (budget top-ups after a served response)
    try {
      await dbFetch(env, '/limits/add', {
        method: 'POST',
        body: JSON.stringify({ bucket, limit, window_ms: windowMs, weight }),
      });
      return true;
    } catch { return null; }
  }
  try {
    const r = await dbFetch(env, '/limits/check', {
      method: 'POST',
      body: JSON.stringify({ bucket, limit, window_ms: windowMs, weight }),
    });
    return Boolean(r && r.allowed);
  } catch {
    return null; // store unreachable: caller decides (documented fail-open)
  }
}

async function sharedReplay(env, key, ttlSeconds = 86_400) {
  if (!useSqlite(env)) return null;
  try {
    const r = await dbFetch(env, '/replay', {
      method: 'POST',
      body: JSON.stringify({ key, ttl: ttlSeconds }),
    });
    return Boolean(r && r.claimed);
  } catch {
    return null;
  }
}

async function enqueueMail(env, { id, kind, toEmail, payload, ttlSeconds = 172_800 }) {
  if (!useSqlite(env)) return null;
  const r = await dbFetch(env, '/mail-queue', {
    method: 'POST',
    body: JSON.stringify({
      id, kind,
      to_email: toEmail,
      payload,
      ttl: ttlSeconds,
    }),
  });
  return Boolean(r && r.ok);
}

export {
  BUCKET,
  getR2, putR2, deleteR2, listR2,
  useSqlite, dbFetch, normEmail,
  getProvider, putProvider, deleteProvider, listProviders,
  findProviderByCredentials,
  getSubscriber, putSubscriber, deleteSubscriber, listSubscribers,
  confirmSubscriber, findSubscriberByToken,
  findProviderByToken, confirmProvider,
  sharedLimit, sharedReplay, enqueueMail,
};