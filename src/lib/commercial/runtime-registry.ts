// Build/server only. Never imported by a browser script.
import {approvalPayload} from './approval-payload';
import {createHash} from 'node:crypto';
import type {PartnerV2,PartnerVerification,PlatformRegistry} from './partner-platform';
import health from '../../../data/commercial/destination-health.json';
import experiments from '../../../data/commercial/partner-experiments.json';
export const PARTNER_EXPERIMENTS=experiments;
import intentMap from '../../../data/commercial/page-intents.json';
const partnerFiles=import.meta.glob('../../../data/commercial/partners/*.json',{eager:true,import:'default'});
const verificationFiles=import.meta.glob('../../../data/commercial/verifications/*.json',{eager:true,import:'default'});
const partners=Object.values(partnerFiles) as PartnerV2[];
const verifications=(Object.values(verificationFiles) as PartnerVerification[]).map(v=>{
 const partner=partners.find(p=>p.partner_id===v.partner_id);
 const matched=partner&&createHash('sha256').update(approvalPayload(partner)).digest('hex')===v.config_sha256;
 return {...v,reviewed:v.reviewed&&Boolean(matched)};
});
export const PARTNER_REGISTRY:PlatformRegistry={partners,verifications,health,records:Object.values(import.meta.glob('../../../data/localities/*.json',{eager:true,import:'default'})) as PlatformRegistry['records']};
export const REVIEWED_PAGE_INTENTS=new Map((intentMap.pages as Array<{page_path:string;intent:string}>).map(p=>[p.page_path,p.intent]));

const placementRows=partners.filter(p=>verifications.some(v=>v.partner_id===p.partner_id&&v.reviewed)&&p.status==='ACTIVE'&&['PRIMARY','BACKUP'].includes(p.placement)).flatMap(p=>p.placements??[]);
export const REVIEWED_PAGE_CONTEXTS=new Map<string,(typeof placementRows)[number]|null>();
for(const row of placementRows){const prior=REVIEWED_PAGE_CONTEXTS.get(row.page_path);if(REVIEWED_PAGE_CONTEXTS.has(row.page_path)&&(prior?.record_id!==row.record_id||prior?.intent!==row.intent))REVIEWED_PAGE_CONTEXTS.set(row.page_path,null);else REVIEWED_PAGE_CONTEXTS.set(row.page_path,row);}
for(const [page,row] of REVIEWED_PAGE_CONTEXTS)REVIEWED_PAGE_INTENTS.set(page,row?.intent??'NONE');
