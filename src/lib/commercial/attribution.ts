import {ALL_APPROVABLE_QUERY_KEYS} from './affiliate-adapters.ts';
import { buildCompareSolarReferralUrl } from '../compare-solar-prices.ts';
import type { SelectedCommercialRoute } from './types.ts';
import { safePagePath, safePublicUrl } from './routing.ts';
export function newCommercialCid(): string {
  const bytes=new Uint8Array(12);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness required');
  // Avoid legacy route/source prefixes so a generic CID cannot masquerade as
  // an existing cohort CID in the legacy decoder.
  for(let attempt=0;attempt<100;attempt++){
    globalThis.crypto.getRandomValues(bytes);
    const cid=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
    if(!/^(?:e10[1-3]|f10[1-6])/.test(cid))return cid;
  }
  throw new Error('Unable to create an unambiguous CID');
}
export function buildCommercialOutbound(selected: SelectedCommercialRoute, cid: string): string {
  if (!/^[a-f0-9]{24}$/.test(cid)) throw new Error('Invalid anonymous CID');
  const {route,context,destination}=selected;
  if (!safePublicUrl(destination,route.destination.expectedHosts,route.destination.allowedQueryParams)) throw new Error('Unsafe destination');
  if (route.tracking.mode==='legacy_csp') {
    const url=buildCompareSolarReferralUrl(context.state,context.city,cid);
    if (!url || new URL(url).origin+new URL(url).pathname+new URL(url).hash!==destination) throw new Error('Legacy destination contract mismatch');
    return url;
  }
  const url=new URL(destination);
  const params=Object.entries(route.tracking.fixedParams);
  if (params.some(([k,v])=>!ALL_APPROVABLE_QUERY_KEYS.includes(k)||!/^[A-Za-z0-9_-]{1,60}$/.test(v))) throw new Error('Unsafe tracking parameters');
  for (const [k,v] of params) url.searchParams.set(k,v);
  url.searchParams.set(route.tracking.cidParam,cid);
  return url.toString();
}
export function attributionEnvelope(selected: SelectedCommercialRoute, cid: string, sourceSlot: string, experimentId='none', variant='none') {
  if (!/^[a-f0-9]{24}$/.test(cid)||!/^organic$|^fl_src_0[1-6]$/.test(sourceSlot)||!safePagePath(selected.context.pagePath)
    ||!/^(none|[a-z][a-z0-9-]{1,79})$/.test(experimentId)||!['none','control','variant'].includes(variant)) throw new Error('Invalid attribution context');
  return {cid,partner:selected.partner.id,route:selected.route.id,channel:selected.route.channel,city:selected.context.city,
    page_path:selected.context.pagePath,source_slot:sourceSlot,experiment_id:experimentId,variant};
}

export function commercialRouteCurrent(selected: SelectedCommercialRoute, now=Date.now()): boolean {
  const until=Date.parse(selected.validUntil);return Number.isFinite(until)&&Number.isFinite(now)&&now<until;
}
