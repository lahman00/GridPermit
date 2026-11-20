import {timingSafeEqual} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import routes from '../netlify/generated/outbound-routes.json' with {type: 'json'};
import {cleanupOutbound} from '../src/lib/commercial/outbound-service.mjs';
import {getVercelStore} from '../src/lib/commercial/vercel-store.mjs';

function authorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function makeRetention({env = process.env, getStore = () => getVercelStore(env), routeRows = routes, fetchImpl = fetch, clock = Date.now} = {}) {
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
export default {fetch: makeRetention()};
