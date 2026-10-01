import {createHash} from 'node:crypto';
export const ATTRIBUTION_DAYS=30;
export const REPORTING_BUFFER_DAYS=7;
export const RETENTION_DAYS=ATTRIBUTION_DAYS+REPORTING_BUFFER_DAYS;
export const RETENTION_MS=RETENTION_DAYS*86400000;
export const MAX_EVENT_BYTES=512;
export const STAGES=['CTA_RENDERED','CTA_EXPOSED','CTA_CLICKED','OUTBOUND_RECORDED','PARTNER_REPORTED_REFERRAL','QUALIFIED_LEAD','FUNDED_INSTALL','COMMISSION_APPROVED','COMMISSION_PAYABLE','COMMISSION_PAID'];
const ORIGIN='https://mygridpermit.com';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const response=(status,message)=>new Response(message,{status,headers});
const sameClick=(a,b)=>['cid','partner_id','page_path','city','intent','cta_id'].every(k=>a?.[k]===b[k]);
export function eventKey(event){
 // 65,536 immutable slots/day bounds new event data to 32 MiB/day.
 // Hash collisions are explicit recording failures, never overwrites or counts.
 const slot=createHash('sha256').update(event.partner_id+'|'+event.cid).digest('hex').slice(0,4);
 return 'events/'+event.timestamp.slice(0,10)+'/'+slot;
}
export async function recordOutbound(store,event,now=Date.now()){
 if(Buffer.byteLength(JSON.stringify(event))>MAX_EVENT_BYTES)throw new Error('EVENT_TOO_LARGE');
 const control=await store.get('control/retention',{type:'json',consistency:'strong'});
 if(!control?.ok||!Number.isFinite(Date.parse(control.checked_at))||now-Date.parse(control.checked_at)>90*60000||Date.parse(control.checked_at)>now)throw new Error('RETENTION_NOT_HEALTHY');
 const key=eventKey(event),prior=await store.get(key,{type:'json',consistency:'strong'});
 if(prior)return sameClick(prior,event)?'DUPLICATE':'CAPACITY_COLLISION';
 await store.setJSON(key,event,{onlyIfNew:true});
 // Do not trust conditional-write success flags alone. A fresh strong read
 // proves the exact event survived before acknowledging OUTBOUND_RECORDED.
 const saved=await store.get(key,{type:'json',consistency:'strong'});
 if(!sameClick(saved,event))throw new Error('WRITE_NOT_CONFIRMED');
 return saved.timestamp===event.timestamp?'RECORDED':'DUPLICATE';
}
async function boundedBody(request){
 if(Number(request.headers.get('content-length')??0)>512)throw new Error('BODY_LIMIT');
 const reader=request.body?.getReader();if(!reader)throw new Error('BODY_REQUIRED');let size=0,parts=[];
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512)throw new Error('BODY_LIMIT');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(parts).toString('utf8');
}
export function createOutboundHandler({routes,getStore,clock=()=>Date.now(),timeoutMs=1200}){
 return async function handle(request){
  const u=new URL(request.url);
  if(request.method!=='POST')return response(405,'POST required');
  if(u.origin!==ORIGIN||u.search||request.headers.get('origin')!==ORIGIN||request.headers.get('sec-fetch-site')!=='same-origin')return response(403,'Request not allowed');
  if(/bot|crawler|spider|headless|preview|facebookexternalhit|slackbot/i.test(request.headers.get('user-agent')??'')||request.headers.get('purpose')==='prefetch'||request.headers.get('sec-purpose')?.includes('prefetch'))return response(403,'Automated request not allowed');
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return response(415,'Unsupported content type');
  let body;try{body=new URLSearchParams(await boundedBody(request));}catch{return response(400,'Invalid request');}
  if([...body.keys()].some(k=>!['cid','page_path','qualified'].includes(k))||['cid','page_path','qualified'].some(k=>body.getAll(k).length!==1))return response(400,'Invalid fields');
  const cid=body.get('cid'),page=body.get('page_path'),partner=u.pathname.replace(/^\/go\//,'');
  if(!/^[a-f0-9]{24}$/.test(cid??''))return response(400,'Invalid CID');
  const route=routes.find(r=>r.page_path===page&&r.partner_id===partner);
  const now=clock();if(!route||Date.parse(route.valid_until)<=now)return response(410,'This referral is unavailable');
  if(route.qualification_required&&body.get('qualified')!=='1')return response(403,'Qualification required');
  const location=route.url_template.replace('000000000000000000000000',cid);
  let status='NOT_RECORDED';
  const event={stage:'OUTBOUND_RECORDED',cid,partner_id:partner,page_path:page,city:route.city,intent:route.intent,cta_id:route.cta_id,timestamp:new Date(now).toISOString()};
  if(request.headers.get('sec-gpc')==='1'||request.headers.get('dnt')==='1')status='PRIVACY_OPT_OUT';
  else {let timer;try{status=await Promise.race([recordOutbound(getStore(),event,now),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('STORE_TIMEOUT')),timeoutMs);})]);}catch{status='UNCONFIRMED';}finally{clearTimeout(timer);}}
  // Recording failure never becomes a lead or a false success. The approved
  // visitor journey still works, without a second automatic redirect/retry.
  return new Response(null,{status:303,headers:{...headers,Location:location,'X-GridPermit-Recording':status}});
 };
}
export async function cleanupOutbound(store,now=Date.now()){
 let deleted=0,scanned=0;
 // Mark unhealthy first: interrupted cleanup prevents further writes.
 await store.setJSON('control/retention',{ok:false,checked_at:new Date(now).toISOString()});
 for await(const page of store.list({prefix:'events/',paginate:true})){
  for(const item of page.blobs){scanned++;const day=item.key.split('/')[1];
   // Only potentially expired day partitions need object reads.
   if(Date.parse(day+'T00:00:00Z')<=now-RETENTION_MS){const event=await store.get(item.key,{type:'json',consistency:'strong'});if(event&&Date.parse(event.timestamp)<=now-RETENTION_MS){await store.delete(item.key);deleted++;}}
  }
 }
 const result={ok:true,checked_at:new Date(now).toISOString(),deleted,scanned};
 await store.setJSON('control/retention',result);return result;
}
