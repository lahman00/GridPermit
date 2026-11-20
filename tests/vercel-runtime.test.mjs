import test from 'node:test';
import assert from 'node:assert/strict';
import {createNeonStore} from '../src/lib/commercial/vercel-store.mjs';
import {recordOutbound, RETENTION_MS} from '../src/lib/commercial/outbound-service.mjs';
import {makeOutbound} from '../api/outbound.mjs';
import {makeHealth} from '../api/outbound-health.mjs';
import {makeRetention} from '../api/outbound-retention.mjs';

const now = Date.parse('2026-11-20T12:00:00Z');
const event = {stage:'OUTBOUND_RECORDED',cid:'123456789012345678901234',partner_id:'compare-solar-prices',page_path:'/fixture/',city:'Fixture',intent:'SOLAR_NEW',cta_id:'fixture',timestamp:new Date(now).toISOString()};
function neon() {
  const rows = new Map(); const commands = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url,'https://api.neon.tech/sql');
    const payload = JSON.parse(options.body); const args = payload.params; commands.push(payload);
    const sql = payload.query;
    let result = [];
    if (sql.startsWith('SELECT value')) result = rows.has(args[0]) ? [[JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(rows.get(args[0]))).reverse()))]] : [];
    if (sql.startsWith('INSERT INTO gridpermit_outbound_v1')) {
      if (!sql.includes('DO NOTHING') || !rows.has(args[0])) {rows.set(args[0], args[1]);result=[[args[0]]];}
    }
    if (sql.startsWith('INSERT INTO gridpermit_outbound_rate_limits')) result=[['t']];
    if (sql.startsWith('INSERT INTO gridpermit_outbound_locks')) result=[[args[0]]];
    if (sql.startsWith('DELETE') && sql.includes('RETURNING')) {
      for (const [key,value] of rows) if (key.startsWith('events/') && Date.parse(JSON.parse(value).timestamp)+RETENTION_MS <= now) rows.delete(key);
    } else if (sql.startsWith('DELETE')) rows.delete(args[0]);
    if (sql.startsWith('SELECT key')) result = [...rows.keys()].filter(key => key.startsWith('events/') && key > args[0]).sort().slice(0,200).map(key=>[key]);
    return Response.json({rows: result});
  };
  return {rows, commands, fetchImpl, store:createNeonStore({connectionString:'postgresql://fixture:secret@ep-fixture.neon.tech/db',fetchImpl,clock:()=>now})};
}
test('Vercel Neon adapter preserves durable cold-instance read-back, NX and absolute 37-day expiry', async () => {
  const r = neon();
  await r.store.setJSON('control/retention',{ok:true,checked_at:new Date(now).toISOString()});
  assert.equal(await recordOutbound(r.store,event,now),'RECORDED');
  const cold = createNeonStore({connectionString:'postgresql://fixture:secret@ep-fixture.neon.tech/db',fetchImpl:r.fetchImpl,clock:()=>now});
  assert.equal(await recordOutbound(cold,event,now),'DUPLICATE');
  const write = r.commands.find(cmd=>cmd.query.startsWith('INSERT') && cmd.params[0].startsWith('events/'));
  assert.match(write.query,/DO NOTHING/);
  assert.equal(write.params[2],new Date(now+RETENTION_MS).toISOString());
  assert.ok(r.commands.every(cmd=>cmd.query.includes('gridpermit_outbound_v1')));
  await assert.rejects(r.store.get('unrelated/key'),/KEY_INVALID/);
});
test('Neon failures and unconfirmed writes cannot report recorded events', async () => {
  const r=neon(); await r.store.setJSON('control/retention',{ok:true,checked_at:new Date(now).toISOString()});
  const bad=createNeonStore({connectionString:'postgresql://fixture:secret@ep-fixture.neon.tech/db',fetchImpl:async (url,options)=>JSON.parse(options.body).query.startsWith('INSERT')?Response.json({rows:[['pretend-write']]}):r.fetchImpl(url,options),clock:()=>now});
  await assert.rejects(recordOutbound(bad,event,now),/WRITE_NOT_CONFIRMED/);
  const failed=createNeonStore({connectionString:'postgresql://fixture:secret@ep-fixture.neon.tech/db',fetchImpl:async()=>new Response('error',{status:503})});
  await assert.rejects(failed.get('control/retention'),/STORAGE_REQUEST_FAILED/);
});
test('Preview and noncanonical hosts cannot create commercial referrals', async () => {
  let reads=0; const getStore=()=>{reads++;throw Error('unexpected');};
  const request=()=>new Request('https://mygridpermit.com/go/compare-solar-prices',{method:'POST'});
  assert.equal((await makeOutbound({env:{VERCEL_ENV:'preview'},getStore})(request())).status,403);
  assert.equal((await makeOutbound({env:{VERCEL_ENV:'production'},getStore})(new Request('https://preview.vercel.app/go/compare-solar-prices',{method:'POST'}))).status,403);
  assert.equal(reads,0);
});
test('Cleanup is authenticated, preview disabled, and verifies durable control read-back', async () => {
  const r=neon(), secret='x'.repeat(32);let probes=0;
  const handler=makeRetention({env:{VERCEL_ENV:'production',CRON_SECRET:secret},getStore:()=>r.store,routeRows:[{health_probe_url:'https://partner.example/'}],fetchImpl:async()=>{probes++;return new Response(null,{status:200});},clock:()=>now});
  assert.equal((await handler(new Request('https://mygridpermit.com/api/outbound-retention'))).status,401);
  assert.equal(probes,0);
  const request=()=>new Request('https://mygridpermit.com/api/outbound-retention',{headers:{authorization:'Bearer '+secret}});
  assert.equal((await handler(request())).status,200);assert.equal(probes,1);
  assert.equal((await makeHealth({env:{VERCEL_ENV:'production',CRON_SECRET:secret},getStore:()=>r.store,clock:()=>now})(new Request('https://mygridpermit.com/telemetry/health',{headers:{'x-forwarded-for':'192.0.2.1'}}))).status,200);
  assert.equal((await makeHealth({env:{VERCEL_ENV:'production',CRON_SECRET:secret},getStore:()=>r.store,clock:()=>now+91*60000})(new Request('https://mygridpermit.com/telemetry/health',{headers:{'x-forwarded-for':'192.0.2.1'}}))).status,503);
  assert.equal((await makeRetention({env:{VERCEL_ENV:'preview',CRON_SECRET:secret},getStore:()=>r.store})(request())).status,401);
});
test('Cleanup pagination removes expired events and keeps recent events', async () => {
  const r=neon(); const old={...event,timestamp:new Date(now-RETENTION_MS-1).toISOString()};
  r.rows.set('events/2026-10-01/aaaa',JSON.stringify(old));
  r.rows.set('events/2026-11-20/bbbb',JSON.stringify(event));
  const handler=makeRetention({env:{VERCEL_ENV:'production',CRON_SECRET:'x'.repeat(32)},getStore:()=>r.store,routeRows:[],clock:()=>now});
  assert.equal((await handler(new Request('https://mygridpermit.com/api/outbound-retention',{headers:{authorization:'Bearer '+'x'.repeat(32)}}))).status,200);
  assert.equal(r.rows.has('events/2026-10-01/aaaa'),false);
  assert.equal(r.rows.has('events/2026-11-20/bbbb'),true);
});
test('Production wrapper preserves qualification, CID destination and privacy opt-out with fixtures', async () => {
  let stores=0;
  const routeRows=[{page_path:'/fixture/',partner_id:'compare-solar-prices',valid_until:'2099-01-01T00:00:00Z',qualification_required:true,url_template:'https://partner.example/?cid=000000000000000000000000',city:'Fixture',intent:'SOLAR_NEW',cta_id:'fixture'}];
  const handler=makeOutbound({env:{VERCEL_ENV:'production',CRON_SECRET:'x'.repeat(32)},routeRows,getStore:()=>({consumeRateLimit:async()=>true,get:async()=>{stores++;throw Error('unexpected');}})});
  const request=(qualified)=>new Request('https://mygridpermit.com/go/compare-solar-prices',{method:'POST',headers:{origin:'https://mygridpermit.com','sec-fetch-site':'same-origin','content-type':'application/x-www-form-urlencoded','sec-gpc':'1','x-forwarded-for':'192.0.2.1'},body:new URLSearchParams({cid:event.cid,page_path:'/fixture/',qualified})});
  assert.equal((await handler(request('0'))).status,403);
  const response=await handler(request('1'));
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'https://partner.example/?cid='+event.cid);
  assert.equal(response.headers.get('X-GridPermit-Recording'),'PRIVACY_OPT_OUT');
  assert.equal(stores,0);
});
test('Neon keyset pagination visits more than one page without exposing unrelated keys', async () => {
  const r=neon();
  for(let i=0;i<205;i++)r.rows.set('events/2026-11-20/'+i.toString(16).padStart(4,'0'),JSON.stringify(event));
  r.rows.set('control/retention','{}');
  const pages=[];
  for await(const page of r.store.list({prefix:'events/',paginate:true}))pages.push(page.blobs);
  assert.deepEqual(pages.map(page=>page.length),[200,5]);
  assert.equal(new Set(pages.flat().map(row=>row.key)).size,205);
});
test('Concurrent same-millisecond duplicates receive one recorded acknowledgement', async () => {
  const r=neon();
  await r.store.setJSON('control/retention',{ok:true,checked_at:new Date(now).toISOString()});
  const results=await Promise.all([recordOutbound(r.store,event,now),recordOutbound(r.store,event,now)]);
  assert.deepEqual(results.sort(),['DUPLICATE','RECORDED']);
});
test('Production limiter rejects overflow and fails closed on unavailable durable storage', async () => {
  const request=()=>new Request('https://mygridpermit.com/go/compare-solar-prices',{method:'POST',headers:{origin:'https://mygridpermit.com','sec-fetch-site':'same-origin','x-forwarded-for':'192.0.2.1'}});
  const env={VERCEL_ENV:'production',CRON_SECRET:'x'.repeat(32)};
  assert.equal((await makeOutbound({env,getStore:()=>({consumeRateLimit:async()=>false})})(request())).status,429);
  assert.equal((await makeOutbound({env,getStore:()=>({consumeRateLimit:async()=>{throw Error('offline');}})})(request())).status,503);
});
test('Concurrent cleanup lease denial performs no cleanup and returns conflict', async () => {
  let writes=0;
  const handler=makeRetention({env:{VERCEL_ENV:'production',CRON_SECRET:'x'.repeat(32)},getStore:()=>({acquireCleanupLock:async()=>null,setJSON:async()=>{writes++;}})});
  assert.equal((await handler(new Request('https://mygridpermit.com/api/outbound-retention',{headers:{authorization:'Bearer '+'x'.repeat(32)}}))).status,409);
  assert.equal(writes,0);
});
