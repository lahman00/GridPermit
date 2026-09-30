import {normalizeCompareSolarCitySlug} from '../compare-solar-prices.ts';
import type { CommercialCatalog, CommercialContext, ExperimentConfig } from './types.ts';
import { COMMERCIAL_INTENTS } from './types.ts';
import { safePagePath, selectCommercialRoute } from './routing.ts';

export function experimentErrors(e: ExperimentConfig): string[] {
  const issues: string[] = [];
  if (!e || !/^[a-z][a-z0-9-]{1,79}$/.test(e.id ?? '')) return ['INVALID_EXPERIMENT'];
  if (!['DRAFT','SHADOW','ACTIVE','PAUSED'].includes(e.status) || typeof e.enabled !== 'boolean') issues.push('INVALID_STATUS');
  if (!COMMERCIAL_INTENTS.includes(e.intent)) issues.push('INVALID_INTENT');
  if (!Array.isArray(e.eligiblePages) || !e.eligiblePages.length || e.eligiblePages.some(p=>!safePagePath(p)) || new Set(e.eligiblePages).size!==e.eligiblePages.length) issues.push('INVALID_PAGES');
  if (!Array.isArray(e.variantPages) || e.variantPages.some(p=>!Array.isArray(e.eligiblePages)||!e.eligiblePages.includes(p))) issues.push('INVALID_COHORT');
  if (![e.controlRouteId,e.variantRouteId].every(r=>r===null||typeof r==='string'&&/^[a-z][a-z0-9-]{1,79}$/.test(r))) issues.push('INVALID_ROUTE_REFERENCE');
  if (!['page_cohort','city_cohort','intent_cohort','anonymous_session'].includes(e.assignment)) issues.push('INVALID_ASSIGNMENT');
  if(e.assignment==='city_cohort'&&(!Array.isArray(e.eligibleCities)||!Array.isArray(e.variantCities)||e.variantCities.some(c=>!e.eligibleCities!.includes(c))))issues.push('INVALID_CITY_COHORT');
  if(e.assignment==='intent_cohort'&&(!Array.isArray(e.eligibleIntents)||!Array.isArray(e.variantIntents)||e.variantIntents.some(i=>!e.eligibleIntents!.includes(i)||!COMMERCIAL_INTENTS.includes(i))))issues.push('INVALID_INTENT_COHORT');
  if (!Number.isInteger(e.variantBasisPoints) || e.variantBasisPoints<0 || e.variantBasisPoints>10000) issues.push('INVALID_SPLIT');
  if (!Number.isFinite(Date.parse(e.startAt)) || !(Date.parse(e.endAt)>Date.parse(e.startAt))) issues.push('INVALID_WINDOW');
  if (!Number.isInteger(e.minimumDays) || e.minimumDays<14 || !Number.isInteger(e.minimumExposures) || e.minimumExposures<100) issues.push('UNSAFE_SAMPLE_GUARD');
  return issues;
}
function bucket(value: string) {
  let h = 2166136261;
  for (let i=0;i<value.length;i++) h = Math.imul(h ^ value.charCodeAt(i),16777619) >>> 0;
  return h % 10000;
}
export function assignExperiment(e: ExperimentConfig, context: CommercialContext, now: string, anonymousSession?: string) {
  if (experimentErrors(e).length || !e.enabled || e.status!=='ACTIVE' || !e.eligiblePages.includes(context.pagePath)
    || !(e.eligibleIntents??[e.intent]).includes(context.intent) || (e.eligibleCities&&!e.eligibleCities.includes(normalizeCompareSolarCitySlug(context.city))) || !Number.isFinite(Date.parse(now)) || Date.parse(now)<Date.parse(e.startAt) || Date.parse(now)>=Date.parse(e.endAt)) return null;
  if (e.assignment==='anonymous_session' && !/^[a-f0-9]{24}$/.test(anonymousSession ?? '')) return null;
  const variant = e.assignment==='page_cohort' ? e.variantPages.includes(context.pagePath)
    : e.assignment==='city_cohort'?e.variantCities!.includes(normalizeCompareSolarCitySlug(context.city)):e.assignment==='intent_cohort'?e.variantIntents!.includes(context.intent):bucket(`${e.id}:${anonymousSession}`)<e.variantBasisPoints;
  return { experimentId:e.id, variant:variant?'variant':'control', routeId:variant?e.variantRouteId:e.controlRouteId };
}
export function selectExperimentRoute(experiments: ExperimentConfig[], context: CommercialContext, catalog: CommercialCatalog, now: string, anonymousSession?: string) {
  if (!Array.isArray(experiments)||experiments.some(e=>!e)) return {assignment:null,selected:null,reason:'INVALID_EXPERIMENT_CONFIG'};
  if (new Set(experiments.map(e=>e.id)).size!==experiments.length || experiments.some(e=>experimentErrors(e).length)) return {assignment:null,selected:null,reason:'INVALID_EXPERIMENT_CONFIG'};
  const assignments=experiments.map(e=>assignExperiment(e,context,now,anonymousSession)).filter(x=>x!==null);
  if (assignments.length!==1) return {assignment:null,selected:null,reason:assignments.length?'OVERLAPPING_EXPERIMENTS':'NO_EXPERIMENT'};
  const assignment=assignments[0];
  const selected=assignment.routeId ? selectCommercialRoute(context,catalog,{now,routeId:assignment.routeId}) : null;
  const experiment=experiments.find(e=>e.id===assignment.experimentId)!;
  if(selected)selected.validUntil=new Date(Math.min(Date.parse(selected.validUntil),Date.parse(experiment.endAt))).toISOString();
  return {assignment,selected,reason:assignment.routeId?'ROUTE_GATES_APPLIED':'CONTROL_NO_CTA'};
}
export function observationStatus(e: ExperimentConfig, data: {days:number; controlExposures:number; variantExposures:number; reportComplete:boolean}) {
  if (experimentErrors(e).length || ![data.days,data.controlExposures,data.variantExposures].every(n=>Number.isFinite(n)&&n>=0)) return 'INSUFFICIENT_DATA';
  if (data.days<e.minimumDays || Math.min(data.controlExposures,data.variantExposures)<e.minimumExposures) return 'INSUFFICIENT_DATA';
  return data.reportComplete ? 'OBSERVATION_COMPLETE' : 'EARLY_SIGNAL';
}
