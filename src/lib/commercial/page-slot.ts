import {PARTNER_REGISTRY,PARTNER_EXPERIMENTS,REVIEWED_PAGE_CONTEXTS} from './runtime-registry';
import {routePartnerSlot} from './partner-platform';
export function resolvePagePartner(pagePath:string){
 const placement=REVIEWED_PAGE_CONTEXTS.get(pagePath);if(!placement)return null;
 const record=PARTNER_REGISTRY.records.find(r=>r.record_id===placement.record_id);if(!record)return null;
 const context={state:record.state,city:record.city.value,recordId:record.record_id,utility:record.utility,pagePath,pageType:'blog_general',intent:placement.intent,pageIntent:placement.intent,...(placement.intent==='BATTERY_RETROFIT'?{existingSolar:true,batteryIntent:'RETROFIT' as const}:{})};
 const routing=routePartnerSlot(context,PARTNER_REGISTRY,PARTNER_EXPERIMENTS);
 const partner=PARTNER_REGISTRY.partners.find(p=>p.partner_id===routing.selected?.partner_id);
 return routing.selected&&partner?{selection:routing.selected,partner}:null;
}
