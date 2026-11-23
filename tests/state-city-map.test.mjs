import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishedMapCities} from '../src/lib/state-city-map.ts';
const entry=(city,state,url)=>({city,state,guideUrl:url,county:'Test'});
test('map only exposes entries in both the state index and actual published city routes',()=>{
 const entries=[entry('Aurora','CO','/colorado/aurora/solar-permit-guide/'),entry('Thornton','CO','/research-only/'),entry('Bakersfield','CA','/california/bakersfield/solar-permit-guide/')];
 const routes=new Set(entries.map(e=>e.guideUrl).filter(x=>x!='/research-only/'));
 assert.deepEqual(publishedMapCities(entries,'CO',routes).map(c=>c.name),['Aurora']);
 assert.equal(publishedMapCities([], 'CO',routes).length,0);
 assert.equal(publishedMapCities([entries[0],entries[0]],'CO',routes).length,1);
});
test('accented and alternative published names have real coordinates; missing geography fails closed',()=>{
 const entries=['San José','Ventura','Paso Robles','City of Industry'].map((name,i)=>entry(name,'CA','/test/'+i+'/'));
 for(const c of publishedMapCities(entries,'CA',new Set(entries.map(e=>e.guideUrl))))assert(c.x>0&&c.x<600&&c.y>0&&c.y<600);
 assert.throws(()=>publishedMapCities([entry('Imaginary','CO','/fake/')],'CO',new Set(['/fake/'])),/missing Census/);
});
