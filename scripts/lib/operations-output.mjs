import {access,mkdir,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {hebrewReport} from './operations-system.mjs';

export async function writeOperationsRun(out,run,{failAfter=null}={}){
  try{await access(out);throw new Error(`Output already exists: ${out}`);}catch(error){if(error.code!=='ENOENT')throw error;}
  const partial=`${out}.partial-${process.pid}`;
  try{
    await mkdir(partial,{recursive:false});
    const files=[
      ['OPERATING_STATE.json',JSON.stringify(run,null,2)+'\n'],
      ['TASK_EVIDENCE_LEDGER.json',JSON.stringify({generated_at:run.generated_at,tasks:run.tasks,revenue_rows:run.revenue.rows,rejected_evidence:run.revenue.rejected},null,2)+'\n'],
      ['REVENUE_LEDGER.json',JSON.stringify(run.revenue,null,2)+'\n'],
      ['PARTNER_STATUS.json',JSON.stringify(run.partners,null,2)+'\n'],
      ['SEO_BACKLOG.json',JSON.stringify(run.seo,null,2)+'\n'],
      ['SOURCE_AUDIT.json',JSON.stringify(run.truth,null,2)+'\n'],
      ['RELEASE_GATE.json',JSON.stringify(run.release,null,2)+'\n'],
      ['OWNER_REPORT_HE.md',hebrewReport(run)]
    ];
    for(let i=0;i<files.length;i++){if(failAfter===i)throw new Error('SIMULATED_INTERRUPTION');await writeFile(path.join(partial,files[i][0]),files[i][1],{flag:'wx'});}
    await rename(partial,out);
  }catch(error){await rm(partial,{recursive:true,force:true});throw error;}
}
