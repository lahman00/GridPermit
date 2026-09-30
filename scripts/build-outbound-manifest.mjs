import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {loadPlatformRegistry} from './lib/partner-config-io.mjs';
import {factoryRoutes} from './lib/factory-context.mjs';
import {buildCommercialOutbound} from '../src/lib/commercial/attribution.ts';
import {sourceManifest} from './lib/factory-release.mjs';
const root=process.cwd(),registry=await loadPlatformRegistry(root),rows=await factoryRoutes(root,registry);
const routes=[];
for(const row of rows){
 if(!row.selected||!['CID_QUERY','UTM'].includes(registry.partners.find(p=>p.partner_id===row.selected.partner_id).tracking_type))continue;
 const html=await readFile(root+'/dist'+row.page_path+'index.html','utf8');
 const partner=registry.partners.find(p=>p.partner_id===row.selected.partner_id);
 const proof=registry.verifications.find(v=>v.partner_id===partner.partner_id&&v.reference===partner.approval_reference);
 const commercialDeadline=new Date(Math.min(Date.parse(proof.expires_at),Date.parse(partner.program.reverify_after))).toISOString();
 routes.push({partner_id:row.selected.partner_id,page_path:row.page_path,city:row.context.city,intent:row.context.intent,health_probe_url:partner.tracking.network_tracking_url||partner.tracking.cj_tracking_url?null:partner.destination,cta_id:row.selected.partner_id==='compare-solar-prices'?'compare_solar_prices_locality':row.selected.partner_id,qualification_required:html.includes('data-first-lead-qualification')||html.includes('data-qualification')||row.selected.partner_id!=='compare-solar-prices'&&row.selected.qualification.confirmation_required,valid_until:commercialDeadline,url_template:buildCommercialOutbound(row.selected.selected,'0'.repeat(24))});
}
await mkdir('netlify/generated',{recursive:true});
await writeFile('netlify/generated/outbound-routes.json',JSON.stringify(routes,null,2)+'\n');
let commit=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const manifest=await sourceManifest(root);
await writeFile('dist/gridpermit-release.json',JSON.stringify({schema_version:2,base_commit:commit,source_sha256:manifest.sha256,partners:registry.partners.filter(p=>p.status==='ACTIVE').map(p=>p.partner_id),outbound_telemetry:'netlify-blobs-v1'},null,2)+'\n');
console.log('Built outbound manifest:',routes.length,'approved page placements');
