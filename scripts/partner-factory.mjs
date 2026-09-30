#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {importActivationBundle,importActivationCsv} from './partner-import.mjs';
import {prepareFactory,applyFactory,mergeApprovedBundle} from './lib/factory-release.mjs';
import {loadPlatformRegistry} from './lib/partner-config-io.mjs';
export async function main(args=process.argv.slice(2)){
 const opts={},bools=new Set(['--check','--dry-run','--apply','--deploy','--infrastructure']),values=new Set(['--root','--package','--out','--plan','--expected-plan','--expected-deploy','--pause']);
 for(let i=0;i<args.length;i++){const key=args[i];if(opts[key]!==undefined)throw new Error('Duplicate option');if(bools.has(key))opts[key]=true;else if(values.has(key)&&args[i+1]&&!args[i+1].startsWith('--'))opts[key]=args[++i];else throw new Error('Invalid option');}
 if(['--check','--dry-run','--apply'].filter(k=>opts[k]).length!==1)throw new Error('Choose --check, --dry-run or --apply');
 const root=opts['--root']??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 if(opts['--apply']&&opts['--plan'])return applyFactory({root,planFile:opts['--plan'],expectedPlan:opts['--expected-plan'],expectedDeploy:opts['--expected-deploy'],deploy:opts['--deploy']});
 if(opts['--deploy']&&!opts['--apply'])throw new Error('--deploy requires reviewed --apply');
 let bundle;if(opts['--package']){const text=await readFile(opts['--package'],'utf8');bundle=opts['--package'].endsWith('.csv')?importActivationCsv(text):importActivationBundle(text);}
 if(!bundle&&!opts['--infrastructure']&&!opts['--pause'])throw new Error('--package or --infrastructure required');
 if(opts['--check']){if(opts['--pause']&&!(await loadPlatformRegistry(root)).partners.some(p=>p.partner_id===opts['--pause']))throw new Error('Unknown partner');mergeApprovedBundle(await loadPlatformRegistry(root),bundle??{partners:[]});return {ok:true,mode:'CHECK_ONLY',activated:0};}
 if(!opts['--out']||!path.resolve(opts['--out']).split(path.sep).includes('output'))throw new Error('Fresh output directory required');
 const result=await prepareFactory({root,out:path.resolve(opts['--out']),bundle,infrastructure:opts['--infrastructure'],pause:opts['--pause']});if(opts['--apply'])return applyFactory({root,planFile:path.join(path.resolve(opts['--out']),'PLAN.json'),expectedPlan:result.plan_sha256,expectedDeploy:opts['--expected-deploy'],deploy:opts['--deploy']});return {plan:path.join(opts['--out'],'PLAN.json'),plan_sha256:result.plan_sha256,coverage:result.plan.delta,phases:result.plan.phases};
}
const isDirectRun=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(isDirectRun)main().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
