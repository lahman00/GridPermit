import {createHash} from 'node:crypto';

const STATUS=new Set(['VERIFIED','NEEDS ATTENTION','BLOCKED','UNKNOWN','NOT APPLICABLE']);
const CRITICAL=new Set(['PRODUCTION_OUTAGE','RELEASE_DRIFT','ACTIVE_ROUTE_BROKEN','DESTINATION_BROKEN','TELEMETRY_CRITICAL','WORKFLOW_FAILURE']);
const CONVERSION_STAGES=['PARTNER_REPORTED_REFERRAL','QUALIFIED_LEAD','FUNDED_INSTALL','COMMISSION_APPROVED','COMMISSION_PAYABLE','COMMISSION_PAID'];
const FORBIDDEN_KEY=/(^|_)(cid|email|phone|address|name|ip|token|secret|authorization|cookie)(_|$)/i;
const SECRET_PATTERN=/(github_pat_|ghp_|gho_|ghu_|ghs_|ghr_|xox[baprs]-|sk_live_|netlify[_-]?auth[_-]?token)/i;
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const n=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const sha=value=>createHash('sha256').update(value).digest('hex');

export function assertPublicSafe(value,label='output'){
  if(typeof value==='string'&&SECRET_PATTERN.test(value))throw new Error(`${label}: secret-like value rejected`);
  if(Array.isArray(value))return value.forEach((item,index)=>assertPublicSafe(item,`${label}[${index}]`));
  if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
    if(FORBIDDEN_KEY.test(key)&&item!==null&&item!==undefined&&item!=='')throw new Error(`${label}: private field rejected: ${key}`);
    assertPublicSafe(item,`${label}.${key}`);
  }
}

export function emptyAutopilotState(now){
  if(!iso(now))throw new Error('Invalid state clock');
  return {schema_version:1,updated_at:now,run_count:0,last_mode:null,last_summary_fingerprint:null,counters:Object.fromEntries(CONVERSION_STAGES.map(stage=>[stage,null])),alerts:{}};
}

function normalizeState(state,now){
  if(!state)return emptyAutopilotState(now);
  if(state.schema_version!==1||!state.alerts||!state.counters||!Number.isSafeInteger(state.run_count))throw new Error('Invalid autopilot state');
  assertPublicSafe(state,'state');
  return structuredClone(state);
}

function event(code,subject='global',detail=null){
  return {id:sha(`${code}|${subject}`).slice(0,24),code,subject,severity:CRITICAL.has(code)?'CRITICAL':'IMPORTANT',detail};
}

function stageCounts(operations){
  const counts=operations?.revenue?.stage_counts??{};
  return Object.fromEntries(CONVERSION_STAGES.map(stage=>[stage,n(counts[stage])]));
}

export function collectAutopilotFindings({operations=null,partnerHealth=null,probe=null,sources={},expectedCommit=null}={}){
  const productionAvailable=probe?.production?.available===true;
  const productionOk=productionAvailable&&probe.production.ok===true;
  const releaseCommit=probe?.production?.release_commit??null;
  const releaseMatches=Boolean(expectedCommit&&releaseCommit===expectedCommit);
  const routeFailures=n(partnerHealth?.failures?.length)??null;
  const destinationFailures=n(partnerHealth?.destination_failures?.length)??null;
  const telemetryAvailable=probe?.telemetry?.available===true;
  const telemetryOk=telemetryAvailable&&probe.telemetry.ok===true;
  const counts=stageCounts(operations);
  const paid=Number.isSafeInteger(operations?.revenue?.paid_revenue_cents)?operations.revenue.paid_revenue_cents:null;
  const statuses={
    production:productionOk?'VERIFIED':productionAvailable?'NEEDS ATTENTION':'UNKNOWN',
    release_identity:releaseMatches?'VERIFIED':releaseCommit&&expectedCommit?'NEEDS ATTENTION':'UNKNOWN',
    commercial_routes:routeFailures===0?'VERIFIED':routeFailures===null?'UNKNOWN':'NEEDS ATTENTION',
    destination:destinationFailures===0?'VERIFIED':destinationFailures===null?'UNKNOWN':'NEEDS ATTENTION',
    telemetry:telemetryOk?'VERIFIED':telemetryAvailable?'NEEDS ATTENTION':sources.outbound==='BLOCKED'?'BLOCKED':'UNKNOWN',
    outbound_export:STATUS.has(sources.outbound)?sources.outbound:'UNKNOWN',
    partner_report:STATUS.has(sources.partner_report)?sources.partner_report:'UNKNOWN',
    gsc:STATUS.has(sources.gsc)?sources.gsc:'UNKNOWN',
    ga4:STATUS.has(sources.ga4)?sources.ga4:'UNKNOWN',
    notifications:STATUS.has(sources.notifications)?sources.notifications:'UNKNOWN'
  };
  const events=[];
  if(productionAvailable&&!productionOk)events.push(event('PRODUCTION_OUTAGE'));
  if(expectedCommit&&releaseCommit&&releaseCommit!==expectedCommit)events.push(event('RELEASE_DRIFT',releaseCommit.slice(0,12)));
  if(routeFailures>0)events.push(event('ACTIVE_ROUTE_BROKEN','active-routes',routeFailures));
  if(destinationFailures>0)events.push(event('DESTINATION_BROKEN','active-destinations',destinationFailures));
  if(telemetryAvailable&&!telemetryOk)events.push(event('TELEMETRY_CRITICAL'));
  for(const [source,status] of Object.entries(sources))if(status==='NEEDS ATTENTION')events.push(event('DATA_SOURCE_FAILURE',source));
  for(const partner of partnerHealth?.stale_programs??[])events.push(event('EVIDENCE_EXPIRED',String(partner)));
  return {statuses,counts,paid_revenue_cents:paid,route_failures:routeFailures,destination_failures:destinationFailures,paid_pages:n(partnerHealth?.paid_pages),pages_checked:n(partnerHealth?.pages),release_commit:releaseCommit,expected_commit:expectedCommit,events};
}

export function reconcileAutopilotState({priorState=null,findings,mode,now,cooldownHours=72}={}){
  if(!['daily','weekly'].includes(mode)||!iso(now)||!Number.isFinite(cooldownHours)||cooldownHours<1)throw new Error('Invalid autopilot run controls');
  const prior=normalizeState(priorState,now),alerts={...prior.alerts},events=[...findings.events];
  for(const stage of CONVERSION_STAGES){
    const current=findings.counts[stage],previous=prior.counters[stage];
    if(current!==null&&previous!==null&&current>previous){
      const code=stage==='COMMISSION_PAID'?'NEW_VERIFIED_PAID_COMMISSION':stage==='COMMISSION_PAYABLE'?'NEW_VERIFIED_PAYABLE_COMMISSION':'NEW_VERIFIED_CONVERSION';
      events.push(event(code,stage,current-previous));
    }
  }
  const activeIds=new Set(events.map(item=>item.id)),notifications=[];
  for(const item of events){
    const previous=alerts[item.id],elapsed=previous?.last_emitted_at?Date.parse(now)-Date.parse(previous.last_emitted_at):Infinity;
    const shouldEmit=!previous||previous.resolved_at||elapsed>=cooldownHours*3600000;
    alerts[item.id]={...item,first_seen_at:previous?.first_seen_at??now,last_seen_at:now,last_emitted_at:shouldEmit?now:previous?.last_emitted_at??null,resolved_at:null,occurrences:(previous?.occurrences??0)+1};
    if(shouldEmit)notifications.push(item);
  }
  for(const [id,item] of Object.entries(alerts))if(!activeIds.has(id)&&!item.resolved_at)alerts[id]={...item,resolved_at:now};
  const summary={mode,statuses:findings.statuses,counts:findings.counts,route_failures:findings.route_failures,destination_failures:findings.destination_failures,paid_pages:findings.paid_pages,pages_checked:findings.pages_checked};
  assertPublicSafe(summary,'summary');
  const operationalSummary={...summary};
  delete operationalSummary.mode;
  const next={schema_version:1,updated_at:now,run_count:prior.run_count+1,last_mode:mode,last_summary_fingerprint:sha(JSON.stringify(operationalSummary)),counters:findings.counts,alerts};
  assertPublicSafe(next,'state');
  const changed=prior.last_summary_fingerprint!==next.last_summary_fingerprint;
  return {state:next,notifications,changed,summary};
}

const show=value=>value===null?'UNKNOWN':String(value);
const shekelsNever=amount=>amount===null?'UNKNOWN':`$${(amount/100).toFixed(2)}`;
const statusLine=(label,status)=>`- ${label}: **${status}**`;

export function buildHebrewAutopilotReport({mode,now,findings,transition}={}){
  const daily=`# דוח תפעול יומי GridPermit

**זמן בדיקה:** ${now}

## בריאות המערכת
${statusLine('פרודקשן',findings.statuses.production)}
${statusLine('זהות גרסה',findings.statuses.release_identity)}
${statusLine('מסלולים מסחריים',findings.statuses.commercial_routes)}
${statusLine('יעד השותף',findings.statuses.destination)}
${statusLine('טלמטריית יציאה',findings.statuses.telemetry)}

## מקורות וחסימות
${statusLine('export פרטי של יציאות',findings.statuses.outbound_export)}
${statusLine('דוח שותף',findings.statuses.partner_report)}
${statusLine('Search Console',findings.statuses.gsc)}
${statusLine('GA4',findings.statuses.ga4)}
${statusLine('ערוץ התראות פרטי',findings.statuses.notifications)}

## אמת מסחרית
- יציאות מתועדות: ${show(findings.operations_outbounds??null)}
- הפניות מאומתות מהשותף: ${show(findings.counts.PARTNER_REPORTED_REFERRAL)}
- לידים מוסמכים: ${show(findings.counts.QUALIFIED_LEAD)}
- התקנות ממומנות: ${show(findings.counts.FUNDED_INSTALL)}
- עמלה ששולמה: ${shekelsNever(findings.paid_revenue_cents)}

UNKNOWN אינו אפס. לא נוצרו clicks, referrals או test leads במהלך הבדיקה.

## פעולה
${transition.notifications.length?`נמצאו ${transition.notifications.length} התראות חדשות שדורשות טיפול.`:'אין התראה חדשה המחייבת פעולה.'}
`;
  if(mode==='daily')return daily;
  return `# דוח בעלים שבועי GridPermit

**זמן בדיקה:** ${now}

## פעילות מסחרית מאומתת
- הפניות שדווחו ואומתו: ${show(findings.counts.PARTNER_REPORTED_REFERRAL)}
- לידים מוסמכים: ${show(findings.counts.QUALIFIED_LEAD)}
- התקנות ממומנות: ${show(findings.counts.FUNDED_INSTALL)}
- הכנסה ששולמה עם ראיית תשלום: ${shekelsNever(findings.paid_revenue_cents)}

## SEO
${statusLine('Search Console',findings.statuses.gsc)}
${statusLine('GA4',findings.statuses.ga4)}

## שותפים ותפעול
${statusLine('דוח שותף',findings.statuses.partner_report)}
${statusLine('מסלולים מסחריים',findings.statuses.commercial_routes)}
- עמודים שנבדקו: ${show(findings.pages_checked)}
- עמודים עם מסלול בתשלום: ${show(findings.paid_pages)}

## שינוי מאז הדוח הקודם
${transition.changed?'נמצא שינוי במצב המאומת.':'לא נמצא שינוי מהותי במצב המאומת.'}

## הפעולה החשובה הבאה
${findings.statuses.telemetry!=='VERIFIED'?'להחזיר גישת export פרטית לטלמטריית היציאה ולשמור UNKNOWN עד שהגישה קיימת.':findings.statuses.partner_report!=='VERIFIED'?'לקבל דוח CID אנונימי ומאומת מהשותף ולבצע reconciliation.':'לטפל בהתראה המסחרית החדשה בעלת החומרה הגבוהה ביותר.'}

לא בוצעו deploy, מיזוג, הודעה לשותף, spend או יצירת תנועה מסחרית.
`;
}

export function publicAutopilotStatus({mode,now,findings,transition}={}){
  const value={schema_version:1,generated_at:now,mode,statuses:findings.statuses,checks:{pages_checked:findings.pages_checked,paid_pages:findings.paid_pages,route_failures:findings.route_failures,destination_failures:findings.destination_failures},alerts:transition.notifications.map(({code,severity})=>({code,severity})),changed:transition.changed,contains_private_evidence:false};
  assertPublicSafe(value,'public_status');
  return value;
}
