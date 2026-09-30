// Configuration vocabulary only. A network name never implies approval.
export const AFFILIATE_NETWORKS = ['CJ','IMPACT','AWIN','SHAREASALE','FLEXOFFERS','DIRECT'] as const;
export const NETWORK_QUERY_KEYS: Record<string, readonly string[]> = {
  CJ:['sid','url','pid','aid','PID','AID','cjevent'],
  IMPACT:['subId1','subId2','subId3','sharedid','u','irgwc'],
  AWIN:['awinaffid','awinmid','ued','clickref','clickref2'],
  SHAREASALE:['b','u','m','urllink','afftrack','merchantID'],
  FLEXOFFERS:['fobs','foc','fom','fos','subid','url'],
  DIRECT:['subid','sub_id','sid','cid'],
};
export const COMMON_QUERY_KEYS=['ref','campaign','source','utm_source','utm_medium','utm_campaign'];
export const ALL_APPROVABLE_QUERY_KEYS=[...new Set([...COMMON_QUERY_KEYS,...Object.values(NETWORK_QUERY_KEYS).flat()])];
export function networkQueryKeys(network:string|null|undefined):string[]{return [...COMMON_QUERY_KEYS,...(NETWORK_QUERY_KEYS[network??'DIRECT']??[])];}
export const DIRECT_MODE_ALIASES={TRACKED_URL:'CID_QUERY',SUBID:'CID_QUERY',UTM:'UTM',PHONE:'PHONE_TRACKING',FORM:'FORM_LEAD',MANUAL_REFERRAL:'MANUAL'} as const;
