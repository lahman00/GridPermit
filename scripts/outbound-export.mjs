// Operator-only export. No public event reader or browser credential exists.
import {getStore} from '@netlify/blobs';
import {writeFile} from 'node:fs/promises';
const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--out')throw new Error('--out PATH required');
const store=getStore({name:'gridpermit-outbound-v1',siteID:'d49c19aa-f997-43f3-9b11-fabff36c4c83',token:process.env.NETLIFY_AUTH_TOKEN,consistency:'strong'});
const rows=[],seen=new Set();let duplicates=0,expired=0;
for await(const page of store.list({prefix:'events/',paginate:true}))for(const item of page.blobs){
 const row=await store.get(item.key,{type:'json',consistency:'strong'});if(!row)continue;
 if(Date.now()-Date.parse(row.timestamp)>7*86400000){expired++;continue;}
 const id=row.partner_id+'|'+row.cid;if(seen.has(id)){duplicates++;continue;}seen.add(id);rows.push(row);
}
await writeFile(args[1],JSON.stringify({stage:'OUTBOUND_RECORDED',generated_at:new Date().toISOString(),retention_days:7,unique_recorded_outbounds:rows.length,duplicates_suppressed:duplicates,expired_suppressed:expired,human_clicks_proven:false,partner_referrals:null,qualified_leads:null,funded_installs:null,commission:null,rows},null,2)+'\n',{flag:'wx'});
