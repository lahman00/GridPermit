#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runOperations} from './lib/operations-system.mjs';
import {writeOperationsRun} from './lib/operations-output.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function args(argv){const out={root:ROOT,state:path.join(ROOT,'data/operations/state.json'),registry:path.join(ROOT,'data/operations/registry.json')};for(let i=0;i<argv.length;i++){const k=argv[i];if(!['--out','--outbound','--partner','--gsc','--ga4','--release-evidence','--now'].includes(k)||!argv[i+1])throw new Error(`Invalid option: ${k}`);out[k.slice(2).replaceAll('-','_')]=argv[++i];}if(!out.out)throw new Error('--out PATH is required');out.releaseEvidence=out.release_evidence;return out;}
const options=args(process.argv.slice(2));
const run=await runOperations(options);
await writeOperationsRun(options.out,run);
console.log(JSON.stringify({out:path.resolve(options.out),tasks:run.tasks,safety:run.safety},null,2));
