import {ALL_APPROVABLE_QUERY_KEYS} from './affiliate-adapters.ts';
import {stateSlug} from '../state-meta.ts';
import { hasVerifiedUnambiguousUtility } from '../utility-split-guard.ts';
import { normalizeCompareSolarCitySlug } from '../compare-solar-prices.ts';
import { COMMERCIAL_INTENTS, CTA_CHANNELS, ROUTE_STATUSES } from './types.ts';
import type { CommercialCatalog, CommercialContext, CommercialIntent, CtaChannel, SelectedCommercialRoute } from './types.ts';
import { commercialDisclosure } from './disclosures.ts';

export const INTENT_CHANNELS: Record<CommercialIntent, readonly CtaChannel[]> = {
  NEW_SOLAR: ['SOLAR_QUOTE'], BATTERY_RETROFIT: ['BATTERY_SERVICE'], PERMIT_SERVICE: ['PERMIT_ENGINEERING'],
  PTO_RESCUE: ['PTO_HELP'], INSTALLER_B2B: ['B2B'], INFORMATIONAL: [], UNKNOWN: [], NONE: [], BATTERY_NEW_INSTALL:['BATTERY_SERVICE'], PERMIT_ENGINEERING:['PERMIT_ENGINEERING'], LOCAL_INSTALLER:['LOCAL_INSTALLER'], PAY_PER_CALL:['PAY_PER_CALL'],
};
export function safePagePath(value: unknown): value is string {
  return typeof value === 'string' && /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(value) && value.length <= 240;
}
export function safePublicUrl(value: unknown, hosts: string[], allowedQueryParams: string[] = []): value is string {
  try {
    if (typeof value !== 'string') return false;
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts.includes(u.hostname)
      && /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(u.hostname) && !/(^|\.)(localhost|local|internal|invalid)$/.test(u.hostname)
      && [...u.searchParams].every(([k,v])=>allowedQueryParams.includes(k)&&ALL_APPROVABLE_QUERY_KEYS.includes(k)&&v.length<=500&&!/[@\s]/.test(v)) && !/%|\.\./.test(u.pathname);
  } catch { return false; }
}
function validDate(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value)) return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value.slice(0,10) ? time : NaN;
}
export function catalogErrors(catalog: CommercialCatalog): string[] {
  const errors: string[] = [];
  if (!catalog || !Array.isArray(catalog.routes) || !Array.isArray(catalog.partners) || !Array.isArray(catalog.destinationHealth) || !Array.isArray(catalog.pages)) return ['INVALID_CATALOG'];
  if (catalog.routes.some(r=>!r||typeof r!=='object')||catalog.partners.some(p=>!p||typeof p!=='object')) return ['INVALID_CATALOG_ENTRY'];
  if (catalog.destinationHealth.some(h=>!h||typeof h.url!=='string'||typeof h.checkedAt!=='string')) errors.push('INVALID_DESTINATION_HEALTH');
  if (catalog.pages.some(p=>!p||!safePagePath(p.pagePath))||new Set(catalog.pages.map(p=>p.pagePath)).size!==catalog.pages.length) errors.push('INVALID_PAGE_INVENTORY');
  for (const [kind, items] of [['ROUTE', catalog.routes], ['PARTNER', catalog.partners]] as const) {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item || !/^[a-z][a-z0-9-]{1,79}$/.test(item.id)) errors.push(`INVALID_${kind}_ID`);
      if (seen.has(item?.id)) errors.push(`DUPLICATE_${kind}_ID:${item.id}`);
      seen.add(item?.id);
    }
  }
  for (const r of catalog.routes) {
    if (!CTA_CHANNELS.includes(r.channel) || !ROUTE_STATUSES.includes(r.status) || typeof r.enabled !== 'boolean' || typeof r.testOnly !== 'boolean') errors.push(`INVALID_ROUTE:${r.id}`);
    if (typeof r.partnerId!=='string' || typeof r.utilityRequired!=='boolean') errors.push(`INVALID_ROUTE_FIELDS:${r.id}`);
    if (!Array.isArray(r.allowedIntents) || !r.allowedIntents.length || r.allowedIntents.some(i => !COMMERCIAL_INTENTS.includes(i))) errors.push(`INVALID_INTENTS:${r.id}`);
    if (![r.states,r.citySlugs,r.pageTypes,r.pagePaths,r.eligibility].every(Array.isArray) || !r.evidence || !r.destination || !r.tracking) errors.push(`INVALID_CONFIG:${r.id}`);
    if (r.destination && (!Array.isArray(r.destination.expectedHosts)||typeof r.destination.usePreferredForm!=='boolean'||typeof r.destination.approvedFallback!=='boolean')) errors.push(`INVALID_DESTINATION:${r.id}`);
    if (!commercialDisclosure(r.relationship, 'Provider')) errors.push(`MISSING_DISCLOSURE:${r.id}`);
  }
  return errors;
}
function contextErrors(c: CommercialContext): string[] {
  const reasons: string[] = [];
  if (!c || !COMMERCIAL_INTENTS.includes(c.intent)) return ['UNKNOWN_INTENT'];
  if (!safePagePath(c.pagePath)) return ['INVALID_PAGE_PATH'];
  if (!/^[A-Z]{2}$/.test(c.state ?? '')) reasons.push('MISSING_STATE');
  if (typeof c.city!=='string') return ['MISSING_CITY'];
  if (!c.city.trim()) reasons.push('MISSING_CITY');
  if (!c.pageType) reasons.push('MISSING_PAGE_TYPE');
  if (c.pageType === 'locality_guide') {
    const parts = c.pagePath.split('/').filter(Boolean);
    if (parts[1] !== normalizeCompareSolarCitySlug(c.city ?? '') || parts[2] !== 'solar-permit-guide' || parts.length !== 3) reasons.push('PAGE_CITY_MISMATCH');
    if (parts[0] !== stateSlug(c.state)) reasons.push('PAGE_STATE_MISMATCH');
    if (parts[0] === 'california' && c.state !== 'CA') reasons.push('PAGE_STATE_MISMATCH');
  }
  return reasons;
}
export function auditCommercialRoutes(context: CommercialContext, catalog: CommercialCatalog, options: { now?: string; mode?: 'production' | 'shadow'; routeId?: string } = {}) {
  const now = Date.parse(options.now ?? new Date().toISOString());
  const errors = catalogErrors(catalog);
  if (errors.length || !Number.isFinite(now)) return { selected: null, candidates: [], errors: [...errors, ...(!Number.isFinite(now) ? ['INVALID_CLOCK'] : [])] };
  const baseReasons = contextErrors(context);
  if (!context || typeof context.city!=='string' || !COMMERCIAL_INTENTS.includes(context.intent)) return {selected:null,candidates:[],errors:['INVALID_CONTEXT',...baseReasons]};
  const trustedPage = catalog.pages.find(p=>p.pagePath===context?.pagePath);
  if (!trustedPage) baseReasons.push('PAGE_CONTEXT_UNVERIFIED');
  else if (trustedPage.intent!==context.intent || trustedPage.state!==context.state || trustedPage.city!==context.city || trustedPage.recordId!==context.recordId
    || trustedPage.utility?.value!==context.utility?.value || trustedPage.utility?.notes!==context.utility?.notes || trustedPage.pageType!==context.pageType) baseReasons.push('PAGE_CONTEXT_MISMATCH');
  const candidates = catalog.routes.filter(r => !options.routeId || r.id === options.routeId).map(route => {
    const reasons = [...baseReasons];
    const partner = catalog.partners.find(p => p.id === route.partnerId);
    if (!route.enabled) reasons.push('ROUTE_DISABLED');
    if (route.status !== 'ACTIVE') reasons.push(`ROUTE_${route.status}`);
    if (route.testOnly || partner?.testOnly) reasons.push('TEST_ONLY');
    if (!partner) reasons.push('UNKNOWN_PARTNER');
    else {
      if (partner.active !== true) reasons.push('PARTNER_INACTIVE');
      if (partner.trackingActive !== true) reasons.push('TRACKING_INACTIVE');
    }
    if (!route.allowedIntents.includes(context.intent) || !INTENT_CHANNELS[context.intent]?.includes(route.channel)) reasons.push('INTENT_INCOMPATIBLE');
    if (!route.states.includes(context.state)) reasons.push('STATE_OUTSIDE_TERRITORY');
    if (!route.citySlugs.includes(normalizeCompareSolarCitySlug(context.city ?? ''))) reasons.push('CITY_OUTSIDE_TERRITORY');
    if (!route.pageTypes.includes(context.pageType)) reasons.push('PAGE_TYPE_INCOMPATIBLE');
    if (!route.pagePaths.includes(context.pagePath)) reasons.push('PAGE_NOT_APPROVED');
    if ((route.utilityRequired || context.pageType === 'locality_guide' || ['SOLAR_QUOTE','BATTERY_SERVICE','PTO_HELP'].includes(route.channel))
      && !hasVerifiedUnambiguousUtility({ record_id: context.recordId, utility: context.utility })) reasons.push('UTILITY_UNSAFE');
    const e = route.evidence;
    if (![e.approvalRef,e.territoryRef,e.trackingRef].every(x => typeof x === 'string' && x.trim().length > 0)) reasons.push('EVIDENCE_MISSING');
    const verified = validDate(e.verifiedAt), expiry = validDate(e.expiresAt);
    if (!Number.isFinite(verified) || !Number.isFinite(expiry) || verified > now || expiry <= now || expiry <= verified) reasons.push('EVIDENCE_STALE_OR_INVALID');
    if (!['legacy_csp','cid_query','internal','utm','phone'].includes(route.tracking.mode)) reasons.push('TRACKING_INVALID');
    if (route.tracking.mode === 'legacy_csp' && route.partnerId !== 'compare-solar-prices') reasons.push('TRACKING_PARTNER_MISMATCH');
    if (route.tracking.mode === 'internal' && route.relationship !== 'internal_product') reasons.push('TRACKING_RELATIONSHIP_MISMATCH');
    if (!route.tracking.fixedParams || typeof route.tracking.fixedParams!=='object' || Object.entries(route.tracking.fixedParams).some(([k,v])=>!ALL_APPROVABLE_QUERY_KEYS.includes(k)||typeof v!=='string'||!/^[A-Za-z0-9_-]{1,60}$/.test(v))) reasons.push('TRACKING_PARAMS_UNSAFE');
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,30}$/.test(route.tracking.cidParam)||['ref','campaign','source'].includes(route.tracking.cidParam)) reasons.push('TRACKING_PARAM_INVALID');
    const d = route.destination;
    const primary = d.usePreferredForm ? d.preferredFormUrl : d.landingUrl;
    const isHealthy = (url: string | undefined) => {
      if (!url || !safePublicUrl(url, d.expectedHosts, d.allowedQueryParams)) return false;
      const entries = catalog.destinationHealth.filter(h => h.url === url);
      if (entries.length !== 1) return false;
      const h = entries[0], checked = Date.parse(h.checkedAt);
      return h.ok === true && h.status === 200 && h.finalUrl != null && safePublicUrl(h.finalUrl, d.expectedHosts, d.allowedQueryParams)
        && (d.expectedFinalUrls?.length?d.expectedFinalUrls:[url]).some(approved=>h.finalUrl===approved||new URL(h.finalUrl!).origin+new URL(h.finalUrl!).pathname === new URL(approved).origin+new URL(approved).pathname)
        && Number.isFinite(checked) && checked <= now && now - checked < 48 * 3600000 && h.queryPreserved !== false;
    };
    let destination = isHealthy(primary) ? primary : undefined;
    if (!destination && d.approvedFallback && isHealthy(d.fallbackUrl)) destination = d.fallbackUrl;
    if (!destination) reasons.push('DESTINATION_UNVERIFIED_OR_BROKEN');
    return { routeId: route.id, channel: route.channel, partnerId: route.partnerId, reasons, destination: destination ?? null,
      shadowInspectable: options.mode === 'shadow' && route.status === 'SHADOW' };
  });
  const eligible = candidates.filter(x => x.reasons.length === 0);
  // Ambiguity fails closed. Array order never silently chooses a paid partner.
  if (eligible.length > 1) return { selected: null, candidates, errors: ['AMBIGUOUS_ROUTE'] };
  const match = eligible[0];
  const r = catalog.routes.find(x => x.id === match?.routeId);
  const p = catalog.partners.find(x => x.id === r?.partnerId);
  const selected: SelectedCommercialRoute | null = r && p && match?.destination ? {
    validUntil: new Date(Math.min(validDate(r.evidence.expiresAt),Date.parse(catalog.destinationHealth.find(h=>h.url===match.destination)!.checkedAt)+48*3600000)).toISOString(),
    route: r, partner: p, destination: match.destination, disclosure: commercialDisclosure(r.relationship, p.name), context,
  } : null;
  return { selected, candidates, errors: baseReasons };
}
export function selectCommercialRoute(context: CommercialContext, catalog: CommercialCatalog, options: { now?: string; routeId?: string } = {}): SelectedCommercialRoute | null {
  return auditCommercialRoutes(context, catalog, options).selected;
}
