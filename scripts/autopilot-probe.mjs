#!/usr/bin/env node
import {mkdir,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';

const args=process.argv.slice(2),options={base:'https://mygridpermit.com'};
for(let i=0;i<args.length;i++){if(!['--out','--expected-commit','--base'].includes(args[i])||!args[i+1])throw new Error('Invalid option');options[args[i].slice(2).replace('-','_')]=args[++i];}
if(!options.out||!/^[a-f0-9]{40}$/.test(options.expected_commit??''))throw new Error('--out and a 40-character --expected-commit are required');
const base=new URL(options.base);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new Error('Unsafe production base');
const fetchJson=async url=>{try{const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'GridPermit-Autopilot-ReadOnly/1.0'}});let body=null;try{body=await response.json();}catch{}return {available:true,ok:response.ok,status:response.status,body};}catch(error){return {available:false,ok:false,status:null,error:error.name};}};
const [home,release,telemetry]=await Promise.all([fetchJson(new URL('/',base)),fetchJson(new URL('/gridpermit-release.json',base)),fetchJson(new URL('/telemetry/health',base))]);
const output={schema_version:1,checked_at:new Date().toISOString(),production:{available:home.available&&release.available,ok:home.ok&&release.ok,homepage_status:home.status,release_status:release.status,release_commit:release.body?.base_commit??null,expected_commit:options.expected_commit,release_matches:release.body?.base_commit===options.expected_commit},telemetry:{available:telemetry.available,ok:telemetry.ok&&telemetry.body?.ok===true,retention_healthy:telemetry.body?.retention_healthy===true,last_cleanup:telemetry.body?.last_cleanup??null,destination_ok:telemetry.body?.destination_check?.ok??null}};
const target=path.resolve(options.out),partial=`${target}.partial-${process.pid}`;await mkdir(path.dirname(target),{recursive:true});await writeFile(partial,JSON.stringify(output,null,2)+'\n',{flag:'wx'});await rename(partial,target);console.log(JSON.stringify({production:output.production.ok,telemetry:output.telemetry.ok,release_matches:output.production.release_matches}));
