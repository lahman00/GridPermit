import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const REQUIRED_CITY_SLUGS=['escondido','hemet','pomona','irvine','norwalk','orange','victorville'];
export function checkReleaseContract({routes,release,cityHtml,batteryHtml,functionNames}) {
 const errors=[];
 if(release?.schema_version!==2||!release?.base_commit||!/^[a-f0-9]{64}$/.test(release?.source_sha256??''))errors.push('RELEASE_IDENTITY_MISSING');
 for(const name of ['outbound','outbound-health','outbound-retention'])if(!functionNames.includes(name))errors.push('FUNCTION_MISSING:'+name);
 for(const city of REQUIRED_CITY_SLUGS){
  const page=`/california/${city}/solar-permit-guide/`,r=routes.find(r=>r.page_path===page&&r.partner_id==='compare-solar-prices');
  if(!r)errors.push('RECOVERED_ROUTE_MISSING:'+city);
  const html=cityHtml[city]??'';
  if((html.match(/data-compare-solar-cta-root/g)??[]).length!==1||!html.includes('Paid referral disclosure:'))errors.push('CTA_CONTRACT:'+city);
 }
 for(const city of ['mission-viejo','corona'])if(routes.some(r=>r.page_path===`/california/${city}/solar-permit-guide/`)||(cityHtml[city]??'').includes('data-compare-solar-cta-root'))errors.push('UNSAFE_UTILITY_ROUTE:'+city);
 const battery=routes.find(r=>r.page_path==='/blog/sdge-battery-roi-guide/'&&r.partner_id==='compare-solar-prices');
 if(!battery||battery.intent!=='BATTERY_RETROFIT'||!battery.qualification_required||!batteryHtml.includes('data-qualification'))errors.push('BATTERY_QUALIFICATION_MISSING');
 for(const r of routes.filter(r=>r.partner_id==='compare-solar-prices')){
  try{const u=new URL(r.url_template);if(u.origin!=='https://www.comparesolarprices.net'||u.pathname!=='/'||u.hash!=='#quote'||u.searchParams.get('ref')!=='GridPermit'||!/^[a-f0-9]{24}$/.test(u.searchParams.get('cid')??''))errors.push('CSP_TRACKING_CONTRACT:'+r.page_path);}catch{errors.push('INVALID_DESTINATION:'+r.page_path);}
 }
 return errors;
}
export async function verifyRelease(root=process.cwd()) {
 const readJson=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
 const routes=await readJson('netlify/generated/outbound-routes.json'),release=await readJson('dist/gridpermit-release.json'),cityHtml={},functionNames=[];
 for(const city of [...REQUIRED_CITY_SLUGS,'mission-viejo','corona']){try{cityHtml[city]=await readFile(path.join(root,'dist','california',city,'solar-permit-guide','index.html'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;cityHtml[city]='';}}
 for(const name of ['outbound','outbound-health','outbound-retention']){try{await readFile(path.join(root,'netlify','functions',name+'.mjs'));functionNames.push(name);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const batteryHtml=await readFile(path.join(root,'dist/blog/sdge-battery-roi-guide/index.html'),'utf8');
 const errors=checkReleaseContract({routes,release,cityHtml,batteryHtml,functionNames});if(errors.length)throw new Error(errors.join('\n'));
 return {ok:true,routes:routes.length,required_cities:REQUIRED_CITY_SLUGS.length,functions:functionNames.length,unsafe_utility_routes_blocked:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))verifyRelease().then(r=>console.log('Release preservation:',JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
