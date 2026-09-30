import { getLaunchReadyPartner, getPartner } from '../partners.ts';
import { COMPARE_SOLAR_SERVED_CITY_SLUGS, getCompareSolarDestination } from '../compare-solar-prices.ts';
import type { CommercialCatalog, CommercialContext, CommercialRoute, DestinationHealth, ExperimentConfig } from './types.ts';

// Adapter over the existing authoritative partner registry and territory list.
// No copy of the city list, no new production approval, and no page intent inference.
export function buildCommercialCatalog(destinationHealth: DestinationHealth[] = [], pages: CommercialContext[] = []): CommercialCatalog {
  const legacy=getPartner('compare-solar-prices')!;
  const active=Boolean(getLaunchReadyPartner(legacy.id,'cpl'));
  const routes: CommercialRoute[]=[...COMPARE_SOLAR_SERVED_CITY_SLUGS].sort().map(slug=>({
    id:`csp-${slug}`,partnerId:legacy.id,channel:'SOLAR_QUOTE',status:'ACTIVE',enabled:true,testOnly:false,
    allowedIntents:['NEW_SOLAR'],states:['CA'],citySlugs:[slug],pageTypes:['locality_guide'],
    pagePaths:[`/california/${slug}/solar-permit-guide/`],utilityRequired:true,relationship:'paid_referral',
    eligibility:['Homeowner','New solar quote; existing-system eligibility requires a separately verified route'],
    evidence:{approvalRef:'docs/MONETIZATION_CANONICAL_STATE.md',territoryRef:'src/lib/compare-solar-prices.ts',trackingRef:'src/lib/compare-solar-prices.ts#buildCompareSolarReferralUrl',verifiedAt:legacy.lastVerified,expiresAt:new Date(Date.parse(legacy.lastVerified)+45*86400000).toISOString()},
    destination:{landingUrl:getCompareSolarDestination('CA',slug)!,usePreferredForm:false,approvedFallback:false,expectedHosts:['www.comparesolarprices.net']},
    tracking:{mode:'legacy_csp',cidParam:'cid',fixedParams:{ref:'GridPermit'}},
  }));
  for (const [id,intent,channel] of [
    ['permit','PERMIT_SERVICE','PERMIT_ENGINEERING'],['battery','BATTERY_RETROFIT','BATTERY_SERVICE'],['pto','PTO_RESCUE','PTO_HELP'],['b2b','INSTALLER_B2B','B2B'],
  ] as const) routes.push({
    id:`shadow-${id}`,partnerId:`test-only-${id}`,channel,status:'SHADOW',enabled:false,testOnly:true,
    allowedIntents:[intent],states:['CA'],citySlugs:['escondido'],pageTypes:['locality_guide'],pagePaths:['/california/escondido/solar-permit-guide/'],
    utilityRequired:true,relationship:id==='b2b'?'internal_product':'paid_referral',eligibility:['Research example only; no verified provider'],
    evidence:{approvalRef:'',territoryRef:'',trackingRef:'',verifiedAt:'',expiresAt:''},
    destination:{landingUrl:`https://example.invalid/${id}/`,preferredFormUrl:`https://example.invalid/${id}/#request`,fallbackUrl:'https://example.invalid/',usePreferredForm:false,approvedFallback:false,expectedHosts:['example.invalid']},
    tracking:{mode:'cid_query',cidParam:'cid',fixedParams:{}},
  });
  return {pages,routes,destinationHealth,partners:[{id:legacy.id,name:legacy.name,active,trackingActive:legacy.trackingEnabled,testOnly:false},
    ...routes.filter(r=>r.testOnly).map(r=>({id:r.partnerId,name:`Test-only ${r.channel} provider`,active:false,trackingActive:false,testOnly:true}))]};
}
export const COMMERCIAL_EXPERIMENTS: ExperimentConfig[] = [{
  id:'permit-channel-shadow',status:'SHADOW',enabled:false,eligiblePages:['/california/escondido/solar-permit-guide/'],intent:'PERMIT_SERVICE',
  controlRouteId:null,variantRouteId:'shadow-permit',startAt:'2026-09-26T00:00:00Z',endAt:'2026-10-26T00:00:00Z',
  assignment:'page_cohort',variantPages:['/california/escondido/solar-permit-guide/'],variantBasisPoints:5000,minimumDays:28,minimumExposures:100,
}];
