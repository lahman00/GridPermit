import {test} from 'node:test';import assert from 'node:assert/strict';
import {checkReleaseContract,REQUIRED_CITY_SLUGS} from '../scripts/release-preservation-check.mjs';
function fixture(){const make=(page,intent='NEW_SOLAR')=>({page_path:page,partner_id:'compare-solar-prices',intent,qualification_required:true,url_template:'https://www.comparesolarprices.net/?ref=GridPermit&cid='+'0'.repeat(24)+'#quote'});return {release:{schema_version:2,base_commit:'verified-commit',source_sha256:'a'.repeat(64)},routes:[...REQUIRED_CITY_SLUGS.map(c=>make('/california/'+c+'/solar-permit-guide/')),make('/blog/sdge-battery-roi-guide/','BATTERY_RETROFIT')],cityHtml:Object.fromEntries(REQUIRED_CITY_SLUGS.map(c=>[c,'<section data-compare-solar-cta-root>Paid referral disclosure:<input data-first-lead-qualification></section>'])),batteryHtml:'<input data-qualification>',functionNames:['outbound','outbound-health','outbound-retention']};}
test('reconciled production contract retains recovered cities, backend and qualified battery route',()=>assert.deepEqual(checkReleaseContract(fixture()),[]));
for(const [name,change,code] of [
 ['missing backend',f=>f.functionNames=[],'FUNCTION_MISSING'],
 ['lost city route',f=>f.routes=f.routes.filter(r=>!r.page_path.includes('/norwalk/')),'RECOVERED_ROUTE_MISSING'],
 ['unsafe utility activation',f=>f.routes.push({...f.routes[0],page_path:'/california/mission-viejo/solar-permit-guide/'}),'UNSAFE_UTILITY_ROUTE'],
 ['lost tracking reference',f=>f.routes[0].url_template=f.routes[0].url_template.replace('GridPermit','wrong'),'CSP_TRACKING_CONTRACT'],
 ['homeowner qualification bypass',f=>f.routes[0].qualification_required=false,'HOMEOWNER_QUALIFICATION_MISSING'],
 ['battery qualification bypass',f=>f.routes.at(-1).qualification_required=false,'BATTERY_QUALIFICATION_MISSING'],
 ['missing release identity',f=>f.release={},'RELEASE_IDENTITY_MISSING'],
])test('production regression blocked: '+name,()=>{const f=fixture();change(f);assert.ok(checkReleaseContract(f).some(e=>e.startsWith(code)));});
