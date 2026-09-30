export const NOW='2026-09-26T18:00:00Z';
export const CID='abc123abc123abc123abc123';
export function commercialFixture(){
  const context={state:'CA',city:'Escondido',recordId:'ca-san-diego-escondido-sdge',utility:{value:'SDG&E',notes:'Verified'},pageType:'locality_guide',pagePath:'/california/escondido/solar-permit-guide/',intent:'PERMIT_SERVICE'};
  const route={id:'verified-permit',partnerId:'fixture-provider',channel:'PERMIT_ENGINEERING',status:'ACTIVE',enabled:true,testOnly:false,
    allowedIntents:['PERMIT_SERVICE'],states:['CA'],citySlugs:['escondido'],pageTypes:['locality_guide'],pagePaths:[context.pagePath],utilityRequired:true,
    relationship:'paid_referral',eligibility:['Confirm project scope with provider'],evidence:{approvalRef:'fixture:approval',territoryRef:'fixture:territory',trackingRef:'fixture:tracking',verifiedAt:'2026-09-20',expiresAt:'2026-10-20'},
    destination:{landingUrl:'https://provider.example.com/permit/',usePreferredForm:false,approvedFallback:false,expectedHosts:['provider.example.com']},tracking:{mode:'cid_query',cidParam:'cid',fixedParams:{ref:'GridPermit'}}};
  const catalog={pages:[structuredClone(context)],partners:[{id:'fixture-provider',name:'Fixture provider',active:true,trackingActive:true,testOnly:false}],routes:[route],
    destinationHealth:[{url:route.destination.landingUrl,ok:true,status:200,finalUrl:route.destination.landingUrl,checkedAt:NOW,queryPreserved:null}]};
  const experiment={id:'fixture-experiment',status:'ACTIVE',enabled:true,eligiblePages:[context.pagePath],intent:'PERMIT_SERVICE',controlRouteId:null,variantRouteId:route.id,
    startAt:'2026-09-20T00:00:00Z',endAt:'2026-10-20T00:00:00Z',assignment:'page_cohort',variantPages:[context.pagePath],variantBasisPoints:5000,minimumDays:28,minimumExposures:100};
  return {context,catalog,route,experiment};
}
