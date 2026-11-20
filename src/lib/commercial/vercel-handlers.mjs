import {timingSafeEqual} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createOutboundHandler, cleanupOutbound} from './outbound-service.mjs';
import {getVercelStore, checkRateLimit} from './vercel-store.mjs';

export function makeOutbound({env = process.env, getStore = () => getVercelStore(env), routeRows = []} = {}) {
  const handler = createOutboundHandler({routes: routeRows, getStore});
  return async request => {
    if (env.VERCEL_ENV !== 'production') return new Response('Referrals unavailable in this environment', {status: 403, headers: {'Cache-Control': 'no-store'}});
    const url = new URL(request.url);
    // Preserve normal rejection semantics without touching storage for GETs or
    // cross-origin requests. Vercel overwrites x-forwarded-for at its edge.
    if (request.method === 'POST' && url.origin === 'https://mygridpermit.com' &&
        request.headers.get('origin') === url.origin && request.headers.get('sec-fetch-site') === 'same-origin') {
      try {
        if (!await checkRateLimit(request, env, getStore(), 'outbound')) return new Response('Too many requests', {status: 429, headers: {'Cache-Control': 'no-store', 'Retry-After': '60'}});
      } catch {
        return new Response('Referral temporarily unavailable', {status: 503, headers: {'Cache-Control': 'no-store'}});
      }
    }
    return handler(request);
  };
}

export function makeHealth({env = process.env, getStore = () => getVercelStore(env), clock = Date.now} = {}) {
  return async request => {
    const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('GET required', {status: 405, headers});
    if (env.VERCEL_ENV !== 'production') return Response.json({ok: false, storage: 'disabled'}, {status: 503, headers});
    try {
      const store = getStore();
      if (!await checkRateLimit(request, env, store, 'health')) return Response.json({ok: false}, {status: 429, headers: {...headers, 'Retry-After': '60'}});
      const control = await store.get('control/retention');
      const destinations = await store.get('control/destinations');
      const age = clock() - Date.parse(control?.checked_at);
      const retentionHealthy = control?.ok === true && Number.isFinite(age) && age >= 0 && age < 90 * 60000;
      const destinationAge = clock() - Date.parse(destinations?.checked_at);
      const destinationHealthy = destinations?.ok === true && Number.isFinite(destinationAge) && destinationAge >= 0 && destinationAge < 90 * 60000;
      const ok = retentionHealthy && destinationHealthy;
      return Response.json({ok, storage: 'neon-postgres', retention_healthy: retentionHealthy, last_cleanup: control?.checked_at ?? null, destination_check: {ok: destinationHealthy, checked_at: destinations?.checked_at ?? null}}, {status: ok ? 200 : 503, headers});
    } catch {
      return Response.json({ok: false, storage: 'unavailable'}, {status: 503, headers});
    }
  };
}

function authorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function makeRetention({env = process.env, getStore = () => getVercelStore(env), routeRows = [], fetchImpl = fetch, clock = Date.now} = {}) {
  return async request => {
    const headers = {'Cache-Control': 'no-store'};
    if (request.method !== 'GET') return new Response('GET required', {status: 405, headers});
    if (env.VERCEL_ENV !== 'production' || !authorized(request, env.CRON_SECRET)) return new Response('Unauthorized', {status: 401, headers});
    let store, lock;
    try {
      store = getStore();
      lock = await store.acquireCleanupLock();
      if (!lock) return Response.json({ok: false}, {status: 409, headers});
      await store.setJSON('control/retention', {ok: false, checked_at: new Date(clock()).toISOString()});
      await store.deleteExpired();
      const result = await cleanupOutbound(store, clock());
      const checks = [];
      for (const url of new Set(routeRows.map(row => row.health_probe_url).filter(Boolean))) {
        const parsed = new URL(url);
        if (parsed.search) continue;
        try {
          const response = await fetchImpl(url, {method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(4000)});
          checks.push({url, status: response.status, ok: response.status === 200});
        } catch {
          checks.push({url, status: null, ok: false});
        }
      }
      const destinations = {checked_at: new Date(clock()).toISOString(), ok: checks.every(row => row.ok), checks};
      await store.setJSON('control/destinations', destinations);
      // Verify durable controls before reporting successful scheduled execution.
      const saved = await store.get('control/retention');
      const savedDestinations = await store.get('control/destinations');
      if (!isDeepStrictEqual(saved, result) || !isDeepStrictEqual(savedDestinations, destinations)) throw new Error('CONTROL_WRITE_UNCONFIRMED');
      return Response.json({...result, destinations_healthy: destinations.ok}, {status: destinations.ok ? 200 : 503, headers});
    } catch {
      return Response.json({ok: false}, {status: 503, headers});
    } finally {
      if (lock) await store.releaseCleanupLock(lock).catch(() => {});
    }
  };
}
