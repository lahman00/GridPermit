import routes from '../netlify/generated/outbound-routes.json' with {type: 'json'};
import {createOutboundHandler} from '../src/lib/commercial/outbound-service.mjs';
import {getVercelStore, checkRateLimit} from '../src/lib/commercial/vercel-store.mjs';

export function makeOutbound({env = process.env, getStore = () => getVercelStore(env), routeRows = routes} = {}) {
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
export default {fetch: makeOutbound()};
