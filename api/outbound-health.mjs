import {getVercelStore, checkRateLimit} from '../src/lib/commercial/vercel-store.mjs';

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
export default {fetch: makeHealth()};
