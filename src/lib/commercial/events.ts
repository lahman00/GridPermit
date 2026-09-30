import type { SelectedCommercialRoute } from './types.ts';
import { normalizeCompareSolarCitySlug } from '../compare-solar-prices.ts';
import { safePagePath } from './routing.ts';

export const COMMERCIAL_EVENT_NAMES=['commercial_cta_rendered','commercial_cta_exposed','commercial_cta_clicked'] as const;
// Legacy CSP keeps its exact events. Generic channels use these names only
// when the new component is explicitly integrated. Never emit both families.
export function commercialEvent(stage:'rendered'|'exposed'|'clicked', selected:SelectedCommercialRoute, experimentId='none',variant='none',cid?:string) {
  if (!safePagePath(selected.context.pagePath)||!/^(none|[a-z][a-z0-9-]{1,79})$/.test(experimentId)||!['none','control','variant'].includes(variant)) throw new Error('Unsafe event context');
  const name=selected.route.tracking.mode==='legacy_csp'
    ? ({rendered:'cpl_cta_viewed',exposed:'cpl_cta_exposed',clicked:'cpl_cta_clicked'} as const)[stage]
    : ({rendered:'commercial_cta_rendered',exposed:'commercial_cta_exposed',clicked:'commercial_cta_clicked'} as const)[stage];
  // Explicit fields only; never spread caller-provided analytics data.
  if(stage==='clicked'&&!/^[a-f0-9]{24}$/.test(cid??''))throw new Error('Click event requires anonymous CID');
  return {name,params:{cta_type:selected.route.channel,partner:selected.partner.id,intent:selected.context.intent,
    page_path:selected.context.pagePath,city_slug:normalizeCompareSolarCitySlug(selected.context.city),experiment_id:experimentId,variant,
    ...(stage==='clicked'?{referral_cid:cid!}:{})}};
}
export function trackCommercialEvent(stage:'rendered'|'exposed'|'clicked', selected:SelectedCommercialRoute, cid?:string,experimentId='none',variant='none'){
  const event=commercialEvent(stage,selected,experimentId,variant,cid);
  if(typeof window!=='undefined')window.gtag?.('event',event.name,event.params);
}
