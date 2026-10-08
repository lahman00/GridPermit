#!/usr/bin/env node
import {lstat, mkdir, readdir, readlink, symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceRoot=path.join(root,'skills');
const destinationRoot=process.env.GRIDPERMIT_SKILLS_HOME || path.join(os.homedir(),'.codex','skills');

await mkdir(destinationRoot,{recursive:true});
const names=(await readdir(sourceRoot,{withFileTypes:true}))
  .filter(entry=>entry.isDirectory()&&entry.name.startsWith('gridpermit-'))
  .map(entry=>entry.name)
  .sort();

const installed=[];
for(const name of names){
  const source=path.join(sourceRoot,name);
  const destination=path.join(destinationRoot,name);
  let existing=null;
  try{existing=await lstat(destination);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing){
    if(!existing.isSymbolicLink()) throw new Error(`Refusing to replace non-symlink skill: ${destination}`);
    const current=path.resolve(path.dirname(destination),await readlink(destination));
    if(current!==source) throw new Error(`Refusing to replace skill link with a different source: ${destination}`);
    installed.push({name,status:'already-linked',source,destination});
    continue;
  }
  await symlink(source,destination,'dir');
  installed.push({name,status:'linked',source,destination});
}

console.log(JSON.stringify({schema_version:1,source_root:sourceRoot,destination_root:destinationRoot,installed},null,2));
