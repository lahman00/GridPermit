import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';

export const REVENUE_STAGES = Object.freeze([
  'CTA_RENDERED','CTA_EXPOSED','CTA_CLICKED','OUTBOUND_RECORDED',
  'PARTNER_REPORTED_REFERRAL','QUALIFIED_LEAD','FUNDED_INSTALL',
  'COMMISSION_APPROVED','COMMISSION_PAYABLE','COMMISSION_PAID'
]);
const POST_CLICK = new Set(REVENUE_STAGES.slice(4));
const MONEY = new Set(['COMMISSION_APPROVED','COMMISSION_PAYABLE','COMMISSION_PAID']);
const CID = /^[a-f0-9]{24}$/i;
const PII = /(^|_)(name|email|phone|address|street|zip|postal|ip|account|ssn|tin)(_|$)/i;
const STATUS = new Set(['VERIFIED','NEEDS ATTENTION','BLOCKED','UNKNOWN','NOT APPLICABLE']);
const EXPECTED_AGENTS = new Set(['revenue_hunter','seo_growth_analyst','permit_truth_guardian','partner_manager','release_guardian']);

export function evidenceStatus(value){
  if(!STATUS.has(value)) throw new Error(`Invalid evidence status: ${value}`);
  return value;
}
export function assertNoPii(value, label='input'){
  if(Array.isArray(value)) return value.forEach((v,i)=>assertNoPii(v,`${label}[${i}]`));
  if(value && typeof value==='object') for(const [key,item] of Object.entries(value)){
    if(PII.test(key)&&item!==null&&item!==undefined&&item!=='') throw new Error(`${label}: forbidden PII-like field '${key}'`);
    assertNoPii(item,`${label}.${key}`);
  }
}
function iso(value){return typeof value==='string' && Number.isFinite(Date.parse(value));}
async function readJson(file){return JSON.parse(await readFile(file,'utf8'));}
async function exists(file){try{await readFile(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
function uniq(rows,key){const seen=new Set();return rows.filter(row=>{const k=key(row);if(seen.has(k))return false;seen.add(k);return true;});}

export function buildRevenueLedger({outbound=null, partner=null, now=new Date().toISOString()}={}){
  const ledger=[], rejected=[];
  const synthetic=outbound?.synthetic===true||partner?.synthetic===true;
  if(synthetic&&!(outbound?.synthetic===true&&partner?.synthetic===true)) throw new Error('Synthetic evidence must be isolated on both sides');
  if(outbound){
    assertNoPii(outbound,'outbound');
    if(outbound.stage!=='OUTBOUND_RECORDED'||!Array.isArray(outbound.rows)) throw new Error('Invalid outbound export envelope');
    for(const row of outbound.rows){
      if(row.stage!=='OUTBOUND_RECORDED'||!CID.test(row.cid)||!iso(row.timestamp)){rejected.push({source:'outbound',reason:'MALFORMED_ROW'});continue;}
      ledger.push({stage:'OUTBOUND_RECORDED',cid:row.cid.toLowerCase(),partner_id:row.partner_id,page_path:row.page_path??null,city:row.city??null,intent:row.intent??null,cta_id:row.cta_id??null,timestamp:row.timestamp,evidence_ref:'first-party:netlify-blobs'});
    }
  }
  const retained=uniq(ledger,row=>`${row.partner_id}|${row.cid}`);
  const clickKeys=new Set(retained.map(row=>`${row.partner_id}|${row.cid}`));
  if(partner){
    assertNoPii(partner,'partner_report');
    if(partner.authenticity!=='OPERATOR_VERIFIED'||!iso(partner.verified_at)||!Array.isArray(partner.events)) throw new Error('Partner report authenticity or verification timestamp missing');
    if(Date.parse(now)-Date.parse(partner.verified_at)>45*86400000) throw new Error('Partner report is stale; refresh operator verification');
    for(const event of partner.events){
      if(!POST_CLICK.has(event.stage)||!CID.test(event.cid)||!event.partner_id||!iso(event.timestamp)||!event.evidence_ref){rejected.push({source:'partner',stage:event.stage??null,reason:'MALFORMED_OR_UNSUPPORTED_EVENT'});continue;}
      if(synthetic&&!event.evidence_ref.startsWith('fixture:')) throw new Error('Synthetic partner evidence must use fixture references');
      const key=`${event.partner_id}|${event.cid.toLowerCase()}`;
      if(!clickKeys.has(key)){rejected.push({source:'partner',stage:event.stage,reason:'CID_NOT_IN_RETAINED_OUTBOUND'});continue;}
      if(MONEY.has(event.stage)&&(!Number.isInteger(event.amount_cents)||event.amount_cents<0||event.currency!=='USD')){rejected.push({source:'partner',stage:event.stage,reason:'INVALID_MONEY_EVIDENCE'});continue;}
      if(event.stage==='COMMISSION_PAID'&&!event.payment_evidence_ref){rejected.push({source:'partner',stage:event.stage,reason:'PAYMENT_EVIDENCE_REQUIRED'});continue;}
      retained.push({...event,cid:event.cid.toLowerCase(),source_verified_at:partner.verified_at});
    }
  }
  const rows=uniq(retained,row=>`${row.stage}|${row.partner_id}|${row.cid}|${row.evidence_ref}`);
  const counts=Object.fromEntries(REVENUE_STAGES.map(stage=>[
    stage,
    stage==='OUTBOUND_RECORDED'
      ? (outbound ? rows.filter(r=>r.stage===stage).length : null)
      : (partner ? rows.filter(r=>r.stage===stage).length : null)
  ]));
  for(const stage of ['CTA_RENDERED','CTA_EXPOSED','CTA_CLICKED']) counts[stage]=null;
  const paid=rows.filter(r=>r.stage==='COMMISSION_PAID').reduce((n,r)=>n+r.amount_cents,0);
  return {generated_at:now,rows,rejected,stage_counts:counts,paid_revenue_cents:partner?paid:null,truth:synthetic?'SYNTHETIC_TEST_ONLY':partner?'PARTNER_REPORT_INCLUDED':'LATER_STAGES_UNKNOWN_NO_AUTHENTIC_PARTNER_REPORT'};
}

export function partnerStatus(partners, now){
  return partners.map(p=>{
    const active=['ACTIVE','APPROVED'].includes(p.status)&&p.commercial_status==='VERIFIED'&&p.tracking?.active===true&&Boolean(p.approval_reference)&&Boolean(p.destination);
    const blockers=[];
    if(!p.approval_reference) blockers.push('APPROVAL_EVIDENCE');
    if(!p.destination) blockers.push('DESTINATION');
    if(!p.tracking?.active) blockers.push('TRACKING');
    if(!p.territories) blockers.push('TERRITORY');
    return {partner_id:p.partner_id,status:p.status,commercial_status:p.commercial_status,activation_ready:active,blockers,last_verified:p.last_verified??null,checked_at:now};
  });
}

export function analyzeSeo(gsc=null, ga4=null){
  if(!gsc) return {status:'BLOCKED',reason:'GSC_INPUT_UNAVAILABLE',rows:[],backlog:[{rank:1,status:'BLOCKED',action:'Restore authorized Search Console access and export page/query data; do not infer traffic.'}]};
  if(gsc.authenticity!=='OPERATOR_VERIFIED'||!iso(gsc.verified_at)||!Array.isArray(gsc.rows)) throw new Error('GSC evidence must be operator verified and timestamped');
  const rows=gsc.rows.filter(r=>r.page&&Number.isFinite(r.impressions)&&Number.isFinite(r.clicks)).map(r=>({...r,ctr:r.impressions?r.clicks/r.impressions:0}));
  const backlog=rows.filter(r=>r.impressions>=20).sort((a,b)=>(b.impressions*(1-b.ctr))-(a.impressions*(1-a.ctr))).slice(0,10).map((r,i)=>({rank:i+1,status:'VERIFIED',page:r.page,evidence:{clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position??null},action:'Review query-to-page match, title and snippet; validate with a later GSC comparison.'}));
  return {status:'VERIFIED',verified_at:gsc.verified_at,ga4_status:ga4?'AVAILABLE_NOT_REQUIRED_FOR_RANKING':'UNKNOWN',rows,backlog};
}

export async function sourceTruth(root){
  const dir=path.join(root,'data/localities');
  const files=(await readdir(dir)).filter(f=>f.endsWith('.json'));
  const risks=[];let california=0,stale=0;
  const now=Date.now();
  for(const file of files){
    const record=await readJson(path.join(dir,file));
    if(record.state!=='CA') continue; california++;
    const age=record.last_verified?Math.floor((now-Date.parse(`${record.last_verified}T00:00:00Z`))/86400000):null;
    if(age===null||age>180){stale++;risks.push({record_id:record.record_id,file:`data/localities/${file}`,severity:age===null?'HIGH':'MEDIUM',reason:age===null?'MISSING_VERIFICATION_DATE':'SOURCE_EVIDENCE_OLDER_THAN_180_DAYS',last_verified:record.last_verified??null});}
  }
  return {status:'VERIFIED',scope:'CALIFORNIA_ONLY',records_checked:california,stale_or_undated:stale,findings:risks.slice(0,100)};
}

export function releaseStatus(evidence=null){
  if(!evidence) return {status:'UNKNOWN',reason:'RELEASE_CHECKS_NOT_RUN_IN_THIS_OPERATIONS_INVOCATION',deployment_allowed:false};
  assertNoPii(evidence,'release_evidence');
  const required=['tests','typecheck','build','seo','partner_health','release_preservation'];
  const missing=required.filter(k=>evidence[k]!=='PASS');
  return {status:missing.length?'NEEDS ATTENTION':'VERIFIED',deployment_allowed:missing.length===0&&evidence.production_approval===true,missing_or_failed:missing,rollback_target:evidence.rollback_target??null};
}

export async function validateOperationsRegistry(root, registryFile){
  const registry=await readJson(registryFile);
  if(registry.schema_version!==1||!registry.coordinator||!Array.isArray(registry.agents)) throw new Error('Invalid operations registry');
  const ids=registry.agents.map(agent=>agent.id);
  if(ids.length!==EXPECTED_AGENTS.size||new Set(ids).size!==ids.length||ids.some(id=>!EXPECTED_AGENTS.has(id))) throw new Error('Operations registry must define each expected agent exactly once');
  const referenced=[registry.coordinator.definition,registry.coordinator.entrypoint,registry.coordinator.state,...registry.agents.flatMap(agent=>[agent.definition,agent.skill])];
  const missing=[];
  for(const relative of referenced) if(typeof relative!=='string'||relative.includes('..')||!await exists(path.join(root,relative))) missing.push(relative);
  if(missing.length) throw new Error(`Operations registry references missing files: ${missing.join(', ')}`);
  return {schema_version:registry.schema_version,coordinator:registry.coordinator.id,agents:ids,validated_files:referenced.length};
}

export async function runOperations({root,state,registry=path.join(root,'data/operations/registry.json'),outbound,partner,gsc,ga4,releaseEvidence,now=new Date().toISOString()}={}){
  const started=Date.now(), config=await readJson(state), tasks=[];
  if(config.limits.max_external_requests!==0||config.limits.allow_production_changes) throw new Error('Unsafe operations state');
  const registryStatus=await validateOperationsRegistry(root,registry);
  if(config.agent_registry!=='data/operations/registry.json'||config.agents.some(id=>!registryStatus.agents.includes(id))) throw new Error('Operations state and registry are not aligned');
  const load=async(file)=>file?readJson(file):null;
  const [outboundDoc,partnerDoc,gscDoc,ga4Doc,releaseDoc]=await Promise.all([load(outbound),load(partner),load(gsc),load(ga4),load(releaseEvidence)]);
  const revenue=buildRevenueLedger({outbound:outboundDoc,partner:partnerDoc,now});tasks.push({agent:'revenue_hunter',status:'done',evidence_rows:revenue.rows.length});
  const partnerFiles=(await readdir(path.join(root,'data/commercial/partners'))).filter(f=>f.endsWith('.json'));
  const partners=partnerStatus(await Promise.all(partnerFiles.map(f=>readJson(path.join(root,'data/commercial/partners',f)))),now);tasks.push({agent:'partner_manager',status:'done',partners:partners.length});
  const seo=analyzeSeo(gscDoc,ga4Doc);tasks.push({agent:'seo_growth_analyst',status:'done',result:seo.status});
  const truth=await sourceTruth(root);tasks.push({agent:'permit_truth_guardian',status:'done',findings:truth.stale_or_undated});
  const release=releaseStatus(releaseDoc);tasks.push({agent:'release_guardian',status:'done',result:release.status});
  if(tasks.length>config.limits.max_tasks_per_run) throw new Error('Task limit exceeded');
  if(new Set(tasks.map(t=>t.agent)).size!==tasks.length) throw new Error('Duplicate task execution detected');
  return {schema_version:1,generated_at:now,duration_ms:Date.now()-started,objective:config.objective,registry:registryStatus,safety:{production_changed:false,external_messages_sent:0,paid_services_used:0},tasks,revenue,partners,seo,truth,release};
}

export function hebrewReport(run){
  const c=run.revenue.stage_counts, paid=run.revenue.paid_revenue_cents;
  const activated=run.partners.filter(p=>p.activation_ready).map(p=>p.partner_id);
  const blocked=run.partners.filter(p=>!p.activation_ready).length;
  const syntheticWarning=run.revenue.truth==='SYNTHETIC_TEST_ONLY'?'\n> **בדיקת מערכת בלבד:** כל אירועי ההכנסה בדוח הזה סינתטיים ואינם לקוחות או הכנסה אמיתית.\n':'';
  return `# דוח תפעול GridPermit\n\n**זמן אימות:** ${run.generated_at}\n${syntheticWarning}\n## מה נבדק\nנבדקו משפך ההכנסה, מצב השותפים, זמינות נתוני SEO, רעננות מקורות קליפורניה ושער השחרור.\n\n## אמת הכנסות\n- יציאות מתועדות במקור ראשון: ${c.OUTBOUND_RECORDED ?? 'UNKNOWN'}\n- הפניות שדווחו בידי שותף: ${c.PARTNER_REPORTED_REFERRAL ?? 'UNKNOWN'}\n- לידים מוסמכים: ${c.QUALIFIED_LEAD ?? 'UNKNOWN'}\n- התקנות ממומנות: ${c.FUNDED_INSTALL ?? 'UNKNOWN'}\n- הכנסה ששולמה: ${paid===null?'UNKNOWN':`$${(paid/100).toFixed(2)}`}\n\nאין להסיק אפס משלב שמסומן UNKNOWN.\n\n## שותפים\nשותפים מוכנים להפעלה לפי כל שערי הראיות: ${activated.length?activated.join(', '):'אין'}. ${blocked} רשומות חסומות עד לקבלת אישור, יעד ומעקב תקפים.\n\n## SEO ומקורות\nמצב נתוני SEO: **${run.seo.status}**. נבדקו ${run.truth.records_checked} רשומות קליפורניה; ${run.truth.stale_or_undated} דורשות בדיקת רעננות ממוקדת.\n\n## שחרור\nמצב שער השחרור: **${run.release.status}**. לא בוצע deploy ולא נשלחה הודעה חיצונית.\n\n## הפעולה החשובה הבאה\nלהפיק export פרטי ועדכני של outbound telemetry ולקבל דוח CID אנונימי ומאומת מ-CompareSolarPrices, ואז להריץ reconciliation.\n`;
}
