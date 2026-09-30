import {partnerEvidenceHold} from './partner-evidence-holds.ts';
import {AFFILIATE_NETWORKS,networkQueryKeys} from './affiliate-adapters.ts';
import {assignExperiment,experimentErrors} from './experiments.ts';
import type {ExperimentConfig} from './types.ts';
// Server/build selection: cryptographic config binding never enters client bundles.
import {createHash} from 'node:crypto';
import {approvalPayload} from './approval-payload.ts';
import {campaignOpen} from './campaign-hours.ts';
export {campaignOpen} from './campaign-hours.ts';
import { auditCommercialRoutes, safePagePath } from './routing.ts';
import type { CommercialCatalog, CommercialContext, CommercialIntent, CommercialRoute, DestinationHealth, Relationship } from './types.ts';
import { hasVerifiedUnambiguousUtility } from '../utility-split-guard.ts';
import { normalizeCompareSolarCitySlug, COMPARE_SOLAR_SERVED_CITY_SLUGS } from '../compare-solar-prices.ts';
import { getLaunchReadyPartner } from '../partners.ts';

export const PARTNER_CATEGORIES = ['NEW_SOLAR','BATTERY_RETROFIT','BATTERY_NEW_INSTALL','PERMIT_ENGINEERING','PTO_RESCUE','LOCAL_INSTALLER','PAY_PER_CALL','INSTALLER_B2B','NONE'] as const;
export const PARTNER_STATUSES = ['RESEARCH','VERIFIED','APPLICATION_PENDING','APPROVED','SHADOW','ACTIVE','PAUSED','REJECTED'] as const;
export const PLACEMENT_ROLES = ['PRIMARY','BACKUP','SHADOW','DISABLED'] as const;
export const TRACKING_TYPES = ['CID_QUERY','UTM','FORM_LEAD','EMAIL_HANDOFF','PHONE_TRACKING','MANUAL'] as const;
export type PartnerCategory = typeof PARTNER_CATEGORIES[number];
export interface CountyScope {state:string;county:string}
export interface PartnerProgram {
  terms_reference:string; reverify_after:string; allowed_intents:PartnerCategory[];
  allowed_tracking_types:string[]; excluded_cities:string[]; excluded_utilities:string[];
  audience:'HOMEOWNER'|'BUSINESS'; allows_existing_solar:boolean;
}
export interface PartnerV2 {
  program?:PartnerProgram;

  placements?: Array<{page_path:string;record_id:string;intent:PartnerCategory;review_reference:string}>;
  partner_id: string; name: string; categories: PartnerCategory[];
  territories: { states: string[]; cities: string[]; counties?:CountyScope[]; statewide_verified?:boolean; source?: 'legacy_csp_allowlist' };
  utilities: string[]; status: typeof PARTNER_STATUSES[number]; placement: typeof PLACEMENT_ROLES[number]; priority: number;
  tracking_type: typeof TRACKING_TYPES[number]; tracking: { active: boolean; cid_param: string; fixed_params: Record<string,string>; network: string | null; network_tracking_url?:string|null; cj_tracking_url: string | null };
  destination: string | null; fallback_destination: string | null; expected_hosts: string[];
  paths: { solar: string | null; battery: string | null };
  approval_reference: string | null; commercial_status: 'UNVERIFIED' | 'VERIFIED'; last_verified: string | null;
  relationship: Relationship; qualification: { homeowner_required: boolean; existing_solar: 'ALLOW' | 'REJECT' | 'UNKNOWN'; confirmation_required: boolean };
  phone: { campaign_active?:boolean; minimum_call_seconds?:number; number: string; time_zone: string; weekdays: number[]; start: string; end: string; minimum_conditions: string[] } | null;
  logo: string | null; test_only: boolean;
}
export interface PartnerVerification {
  reference: string; partner_id: string; reviewed: boolean; evidence_reference: string;
  approved_categories: PartnerCategory[]; states: string[]; cities: string[]; counties?:CountyScope[]; statewide_verified?:boolean; territory_source?: 'legacy_csp_allowlist'; utilities: string[];
  destinations: string[]; tracking_verified: boolean; approved_fallback: boolean;
  verified_at: string; expires_at: string; config_sha256: string;
}
export interface PartnerContext extends CommercialContext {
  pageIntent: CommercialIntent; existingSolar?: boolean; batteryIntent?: 'RETROFIT'|'NEW_INSTALL'|null;
}
export interface PlatformRegistry { partners: PartnerV2[]; verifications: PartnerVerification[]; health: DestinationHealth[]; records: Array<{record_id:string;state:string;city:{value:string};county?:{value:string|null};utility:CommercialContext['utility']}>; }
const ID = /^[a-z][a-z0-9-]{1,79}$/;
const categoryChannel = {NEW_SOLAR:'SOLAR_QUOTE',BATTERY_RETROFIT:'BATTERY_SERVICE',BATTERY_NEW_INSTALL:'BATTERY_SERVICE',PERMIT_ENGINEERING:'PERMIT_ENGINEERING',PTO_RESCUE:'PTO_HELP',LOCAL_INSTALLER:'LOCAL_INSTALLER',PAY_PER_CALL:'PAY_PER_CALL',INSTALLER_B2B:'B2B',NONE:'NONE'} as const;
export function intentCategory(context: PartnerContext): PartnerCategory | null {
  if(context.batteryIntent==='RETROFIT') return 'BATTERY_RETROFIT';
  if(context.batteryIntent==='NEW_INSTALL') return 'BATTERY_NEW_INSTALL';
  if(context.pageIntent==='PERMIT_SERVICE') return 'PERMIT_ENGINEERING';
  return PARTNER_CATEGORIES.includes(context.pageIntent as PartnerCategory) ? context.pageIntent as PartnerCategory : null;
}
export function partnerConfigErrors(p: PartnerV2): string[] {
  if(!p || typeof p!=='object') return ['INVALID_PARTNER'];
  const required=['partner_id','name','categories','territories','utilities','status','placement','priority','tracking_type','tracking','destination','fallback_destination','expected_hosts','paths','approval_reference','commercial_status','last_verified','relationship','qualification','phone','logo','test_only'];
  const errors:string[]=[];
  if(p.placements&&(!Array.isArray(p.placements)||p.placements.some(x=>!x||!safePagePath(x.page_path)||typeof x.record_id!=='string'||!PARTNER_CATEGORIES.includes(x.intent)||!x.review_reference)))errors.push('INVALID_PLACEMENTS');
  if(Object.keys(p).some(k=>!required.includes(k)&&!['placements','program'].includes(k))||required.some(k=>!(k in p))) errors.push('PARTNER_SCHEMA_FIELDS');
  if(!ID.test(p.partner_id)||typeof p.name!=='string'||p.name.length>100) errors.push('PARTNER_ID_OR_NAME');
  if(!Array.isArray(p.categories)||!p.categories.length||p.categories.some(c=>!PARTNER_CATEGORIES.includes(c))||new Set(p.categories).size!==p.categories.length) errors.push('PARTNER_CATEGORIES');
  if(!PARTNER_STATUSES.includes(p.status)||!PLACEMENT_ROLES.includes(p.placement)||!TRACKING_TYPES.includes(p.tracking_type)||!['UNVERIFIED','VERIFIED'].includes(p.commercial_status)) errors.push('PARTNER_ENUM');
  if(!Number.isInteger(p.priority)||p.priority<0||p.priority>1000||typeof p.test_only!=='boolean') errors.push('PARTNER_PRIORITY');
  if(!p.territories||!Array.isArray(p.territories.states)||!Array.isArray(p.territories.cities)||p.territories.states.some(s=>!/^[A-Z]{2}$/.test(s))||p.territories.cities.some(c=>!ID.test(c))||p.territories.source&&p.territories.source!=='legacy_csp_allowlist') errors.push('PARTNER_TERRITORY');
  if(!Array.isArray(p.utilities)||p.utilities.some(u=>typeof u!=='string'||!u.length)||!Array.isArray(p.expected_hosts)||p.expected_hosts.some(h=>typeof h!=='string')) errors.push('PARTNER_UTILITY_OR_HOST');
  if(!p.tracking||typeof p.tracking.active!=='boolean'||typeof p.tracking.cid_param!=='string'||!p.tracking.fixed_params||typeof p.tracking.fixed_params!=='object') errors.push('PARTNER_TRACKING');
  if(!p.qualification||typeof p.qualification.homeowner_required!=='boolean'||typeof p.qualification.confirmation_required!=='boolean'||!['ALLOW','REJECT','UNKNOWN'].includes(p.qualification.existing_solar)) errors.push('PARTNER_QUALIFICATION');
  if(!p.paths||[p.destination,p.fallback_destination,p.paths?.solar,p.paths?.battery,p.tracking?.cj_tracking_url].some(u=>u!==null&&typeof u!=='string')) errors.push('PARTNER_DESTINATION');
  if(!['paid_referral','affiliate','sponsored_local','uncompensated_resource','internal_product'].includes(p.relationship)) errors.push('PARTNER_DISCLOSURE');
  if(p.logo!==null&&!(typeof p.logo==='string'&&/^\/partner-logos\/[a-z0-9-]+\.(?:svg|png|webp)$/.test(p.logo))) errors.push('PARTNER_LOGO');
  if(p.phone && (!/^\+[1-9]\d{7,14}$/.test(p.phone.number)||!Array.isArray(p.phone.weekdays)||p.phone.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.phone.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.phone.end)||p.phone.start>=p.phone.end||!Array.isArray(p.phone.minimum_conditions)||p.phone.minimum_conditions.some(c=>typeof c!=='string'||!c.trim())||!p.phone.weekdays.length)) errors.push('PHONE_CAMPAIGN');
  if(p.phone){try{new Intl.DateTimeFormat('en-US',{timeZone:p.phone.time_zone}).format();if(typeof p.phone.time_zone!=='string')errors.push('PHONE_TIME_ZONE');}catch{errors.push('PHONE_TIME_ZONE');}}
  if(p.territories?.counties&&(!Array.isArray(p.territories.counties)||p.territories.counties.some(c=>!c||!/^[A-Z]{2}$/.test(c.state)||typeof c.county!=='string'||!c.county.trim())))errors.push('INVALID_COUNTY_SCOPE');
  if(p.territories?.statewide_verified!==undefined&&typeof p.territories.statewide_verified!=='boolean')errors.push('INVALID_STATEWIDE_SCOPE');
  if(p.tracking?.network&&!AFFILIATE_NETWORKS.includes(p.tracking.network as typeof AFFILIATE_NETWORKS[number]))errors.push('UNKNOWN_NETWORK');
  if(p.tracking?.network_tracking_url!==undefined&&p.tracking.network_tracking_url!==null&&typeof p.tracking.network_tracking_url!=='string')errors.push('INVALID_NETWORK_URL');
  if(p.program){const g=p.program;
    if(!g.terms_reference||!Number.isFinite(Date.parse(g.reverify_after))||!Array.isArray(g.allowed_intents)||g.allowed_intents.some(i=>!PARTNER_CATEGORIES.includes(i))||!Array.isArray(g.allowed_tracking_types)||g.allowed_tracking_types.some(t=>!TRACKING_TYPES.includes(t as typeof TRACKING_TYPES[number]))||!Array.isArray(g.excluded_cities)||g.excluded_cities.some(c=>typeof c!=='string')||!Array.isArray(g.excluded_utilities)||g.excluded_utilities.some(u=>typeof u!=='string')||!['HOMEOWNER','BUSINESS'].includes(g.audience)||typeof g.allows_existing_solar!=='boolean')errors.push('INVALID_PROGRAM');
  }
  if(p.phone&&(p.phone.campaign_active!==undefined&&typeof p.phone.campaign_active!=='boolean'||p.phone.minimum_call_seconds!==undefined&&(!Number.isInteger(p.phone.minimum_call_seconds)||p.phone.minimum_call_seconds<0)))errors.push('INVALID_CALL_CAMPAIGN');
  return errors;
}
export function verificationErrors(v:PartnerVerification):string[] {
 if(!v||typeof v!=='object')return ['INVALID_VERIFICATION'];
 const fields=['reference','partner_id','reviewed','evidence_reference','approved_categories','states','cities','territory_source','counties','statewide_verified','utilities','destinations','tracking_verified','approved_fallback','verified_at','expires_at','config_sha256'];
 if(Object.keys(v).some(k=>!fields.includes(k))||!ID.test(v.reference)||!ID.test(v.partner_id)||typeof v.reviewed!=='boolean'||typeof v.evidence_reference!=='string'||!Array.isArray(v.approved_categories)||v.approved_categories.some(c=>!PARTNER_CATEGORIES.includes(c))||![v.states,v.cities,v.utilities,v.destinations].every(a=>Array.isArray(a)&&a.every(x=>typeof x==='string'))||typeof v.tracking_verified!=='boolean'||typeof v.approved_fallback!=='boolean'||!Number.isFinite(Date.parse(v.verified_at))||!(Date.parse(v.expires_at)>Date.parse(v.verified_at))||!/^[a-f0-9]{64}$/.test(v.config_sha256))return ['INVALID_VERIFICATION'];
 if(v.counties&&(!Array.isArray(v.counties)||v.counties.some(c=>!c||!/^[A-Z]{2}$/.test(c.state)||typeof c.county!=='string'||!c.county.trim())))return ['INVALID_COUNTY_SCOPE'];
 if(v.statewide_verified!==undefined&&typeof v.statewide_verified!=='boolean')return ['INVALID_STATEWIDE_SCOPE'];
 return [];
}
const countyKey=(name:string)=>name.toLowerCase().replace(/\s+county$/,'').trim();
function expandedCities(scope:{states:string[];cities:string[];counties?:CountyScope[];statewide_verified?:boolean},records:PlatformRegistry['records']):string[]{
 return [...new Set([...scope.cities,...records.filter(r=>scope.states.includes(r.state)&&(scope.statewide_verified===true||scope.counties?.some(c=>c.state===r.state&&countyKey(c.county)===countyKey(r.county?.value??'')))).map(r=>normalizeCompareSolarCitySlug(r.city.value))])];
}
export function partnerCities(p:PartnerV2,records:PlatformRegistry['records']=[]):string[]{return p.territories.source==='legacy_csp_allowlist'&&p.partner_id==='compare-solar-prices'?[...COMPARE_SOLAR_SERVED_CITY_SLUGS]:expandedCities(p.territories,records);}
function verificationCities(v:PartnerVerification,records:PlatformRegistry['records']):string[]{return v.territory_source==='legacy_csp_allowlist'&&v.partner_id==='compare-solar-prices'?[...COMPARE_SOLAR_SERVED_CITY_SLUGS]:expandedCities(v,records);}
export function debugPartnerRoutes(context:PartnerContext,registry:PlatformRegistry,now=new Date().toISOString()) {
  if(!registry||!Array.isArray(registry.partners)||!Array.isArray(registry.verifications)||!Array.isArray(registry.health)||!Array.isArray(registry.records)) return {selected:null,candidates:[],reason:'INVALID_REGISTRY'};
  if(registry.verifications.some(v=>verificationErrors(v).length)||registry.partners.some(p=>partnerConfigErrors(p).length)||new Set(registry.partners.map(p=>p.partner_id)).size!==registry.partners.length) return {selected:null,candidates:[],reason:'INVALID_REGISTRY'};
  if(!context||typeof context.city!=='string'||!safePagePath(context.pagePath)||context.intent!==context.pageIntent) return {selected:null,candidates:[],reason:'INVALID_CONTEXT'};
  const record=registry.records.find(r=>r.record_id===context.recordId);
  if(!record||record.state!==context.state||record.city.value!==context.city||record.utility?.value!==context.utility?.value||record.utility?.notes!==context.utility?.notes) return {selected:null,candidates:[],reason:'CANONICAL_CONTEXT_MISMATCH'};
  const category=intentCategory(context),city=normalizeCompareSolarCitySlug(context.city);
  const candidates=registry.partners.map(partner=>{
    const reasons:string[]=[];
    const evidenceHold=partnerEvidenceHold(partner);if(evidenceHold)reasons.push(evidenceHold);
    const matches=registry.verifications.filter(v=>v.partner_id===partner.partner_id&&v.reference===partner.approval_reference),v=matches.length===1?matches[0]:null;
    if(!category||category==='NONE'||!partner.categories.includes(category)) reasons.push('INTENT_INCOMPATIBLE');
    if(partner.status!=='ACTIVE') reasons.push('STATUS_'+partner.status);
    if(!['PRIMARY','BACKUP'].includes(partner.placement)) reasons.push('PLACEMENT_'+partner.placement);
    if(partner.test_only) reasons.push('TEST_ONLY');
    if(partner.commercial_status!=='VERIFIED'||!v?.reviewed||!v.evidence_reference||v.config_sha256!==createHash('sha256').update(approvalPayload(partner)).digest('hex')) reasons.push('APPROVAL_UNVERIFIED');
    if(!partner.tracking.active||!v?.tracking_verified) reasons.push('TRACKING_UNVERIFIED');
    if(!partner.territories.states.includes(context.state)||!partnerCities(partner,registry.records).includes(city)) reasons.push('TERRITORY_MISMATCH');
    if(!v?.states?.includes(context.state)||!verificationCities(v,registry.records).includes(city)||!category||!v.approved_categories.includes(category)) reasons.push('APPROVED_SCOPE_MISMATCH');
    const utility=context.utility?.value;
    if(!hasVerifiedUnambiguousUtility({record_id:context.recordId,utility:context.utility})) reasons.push('UTILITY_UNSAFE');
    if(!utility||!(partner.utilities.includes(utility)||partner.utilities.includes('VERIFIED_LOCAL_RECORD'))||!(v?.utilities.includes(utility)||v?.utilities.includes('VERIFIED_LOCAL_RECORD'))) reasons.push('UTILITY_OUTSIDE_SCOPE');
    const program=partner.program;
    if(program){
      if(Date.parse(program.reverify_after)<=Date.parse(now))reasons.push('PROGRAM_REVERIFY_DUE');
      if(!program.allowed_intents.includes(category!)||!program.allowed_tracking_types.includes(partner.tracking_type)||program.excluded_cities.includes(city)||program.excluded_utilities.includes(utility??''))reasons.push('PROGRAM_RESTRICTION_CONFLICT');
      if((category==='INSTALLER_B2B')!==(program.audience==='BUSINESS'))reasons.push('PROGRAM_AUDIENCE_CONFLICT');
      if((context.existingSolar===true||category==='BATTERY_RETROFIT')&&!program.allows_existing_solar)reasons.push('PROGRAM_EXISTING_SOLAR_CONFLICT');
    }else if(partner.partner_id!=='compare-solar-prices')reasons.push('PROGRAM_TERMS_MISSING');
    if(context.existingSolar===true&&partner.qualification.existing_solar!=='ALLOW') reasons.push('EXISTING_SOLAR_NOT_ALLOWED');
    if(category==='BATTERY_RETROFIT'&&partner.qualification.existing_solar!=='ALLOW') reasons.push('RETROFIT_QUALIFICATION_UNVERIFIED');
    if(['FORM_LEAD','EMAIL_HANDOFF','MANUAL'].includes(partner.tracking_type)) reasons.push('WORKFLOW_SHADOW_ONLY');
    if(partner.tracking_type==='PHONE_TRACKING'&&(partner.phone?.campaign_active!==true||!campaignOpen(partner.phone,now))) reasons.push('PHONE_CAMPAIGN_CLOSED_OR_INVALID');
    if(partner.partner_id==='compare-solar-prices'&&!getLaunchReadyPartner(partner.partner_id,'cpl')) reasons.push('LEGACY_LAUNCH_GATE_CLOSED');
    const finalPath=(category?.startsWith('BATTERY')?partner.paths.battery:category==='NEW_SOLAR'?partner.paths.solar:null);
    const destination=partner.tracking.network_tracking_url||partner.tracking.cj_tracking_url||finalPath||partner.destination;
    if(!destination||!v?.destinations.includes(destination)) reasons.push('DESTINATION_NOT_APPROVED');
    const route:CommercialRoute={id:partner.partner_id,partnerId:partner.partner_id,channel:category?categoryChannel[category]:'NONE',status:'ACTIVE',enabled:true,testOnly:partner.test_only,
      allowedIntents:[context.batteryIntent==='RETROFIT'?'BATTERY_RETROFIT':context.batteryIntent==='NEW_INSTALL'?'BATTERY_NEW_INSTALL':context.pageIntent],states:partner.territories.states,citySlugs:partnerCities(partner,registry.records),pageTypes:[context.pageType],pagePaths:[context.pagePath],utilityRequired:true,relationship:partner.relationship,
      eligibility:partner.phone?.minimum_conditions??[],evidence:{approvalRef:v?.reference??'',territoryRef:v?.evidence_reference??'',trackingRef:v?.evidence_reference??'',verifiedAt:v?.verified_at??'',expiresAt:v?.expires_at??''},
      destination:{landingUrl:destination??'',usePreferredForm:false,approvedFallback:Boolean(v?.approved_fallback&&partner.fallback_destination&&v.destinations.includes(partner.fallback_destination)),fallbackUrl:partner.fallback_destination??undefined,expectedHosts:partner.expected_hosts,allowedQueryParams:networkQueryKeys(partner.tracking.network),...((partner.tracking.network_tracking_url||partner.tracking.cj_tracking_url)&&finalPath&&v?.destinations.includes(finalPath)?{expectedFinalUrls:[finalPath]}:{})},
      tracking:{mode:partner.partner_id==='compare-solar-prices'?'legacy_csp':partner.tracking_type==='UTM'?'utm':partner.tracking_type==='PHONE_TRACKING'?'phone':'cid_query',cidParam:partner.tracking.cid_param,fixedParams:partner.tracking.fixed_params}};
    const adjusted={...context,intent:route.allowedIntents[0]};
    const catalog:CommercialCatalog={pages:[adjusted],partners:[{id:partner.partner_id,name:partner.name,active:reasons.length===0,trackingActive:partner.tracking.active,testOnly:partner.test_only}],routes:[route],destinationHealth:registry.health};
    const audit=auditCommercialRoutes(adjusted,catalog,{now});
    if(audit.selected&&program)audit.selected.validUntil=new Date(Math.min(Date.parse(audit.selected.validUntil),Date.parse(program.reverify_after))).toISOString();
    reasons.push(...audit.errors,...audit.candidates.flatMap(c=>c.reasons));
    return {partner_id:partner.partner_id,placement:partner.placement,priority:partner.priority,reasons:[...new Set(reasons)],selected:reasons.length===0?audit.selected:null,qualification:partner.qualification,phone:partner.phone,logo:partner.logo};
  });
  const valid=candidates.filter(c=>c.selected).sort((a,b)=>(a.placement==='PRIMARY'?0:1)-(b.placement==='PRIMARY'?0:1)||a.priority-b.priority);
  if(valid.length>1&&valid[0].placement===valid[1].placement&&valid[0].priority===valid[1].priority) return {selected:null,candidates,reason:'AMBIGUOUS_PRIORITY'};
  return {selected:valid[0]??null,candidates,reason:valid[0]?(valid[0].placement==='BACKUP'?'VERIFIED_BACKUP':'VERIFIED_PRIMARY'):'NO_VERIFIED_PARTNER'};
}
export function selectPartner(context:PartnerContext,registry:PlatformRegistry,now?:string) { return debugPartnerRoutes(context,registry,now).selected; }

export function routePartnerSlot(context:PartnerContext,registry:PlatformRegistry,experiments:ExperimentConfig[]=[],now=new Date().toISOString(),session?:string){
 const baseline=debugPartnerRoutes(context,registry,now);
 if(!Array.isArray(experiments)||new Set(experiments.map(e=>e?.id)).size!==experiments.length||experiments.some(e=>experimentErrors(e).length))return {...baseline,selected:null,assignment:null,reason:'INVALID_EXPERIMENT_CONFIG'};
 const assigned=experiments.map(e=>({config:e,assignment:assignExperiment(e,context,now,session)})).filter(e=>e.assignment);
 if(assigned.length>1)return {...baseline,selected:null,assignment:null,reason:'OVERLAPPING_EXPERIMENTS'};
 if(!assigned.length)return {...baseline,assignment:null};
 const {config,assignment}=assigned[0];
 if(!assignment!.routeId)return {...baseline,selected:null,assignment,reason:'EXPERIMENT_CONTROL_NONE'};
 const candidate=baseline.candidates.find(c=>c.partner_id===assignment!.routeId&&c.selected);
 if(candidate?.selected)candidate.selected.validUntil=new Date(Math.min(Date.parse(candidate.selected.validUntil),Date.parse(config.endAt))).toISOString();
 return {...baseline,selected:candidate?{...candidate,assignment}:null,assignment,reason:candidate?'VERIFIED_EXPERIMENT_PARTNER':'EXPERIMENT_PARTNER_BLOCKED'};
}
