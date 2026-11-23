import geography from '../../data/maps/state-geography.json' with {type:'json'};
import type { LocalityIndexEntry } from './locality-guide';
export type MappedCity = {name:string; url:string; x:number; y:number; county:string|null};
const key=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
// READY entries alone are insufficient: intersect with real page source routes.
export function publishedMapCities(entries: LocalityIndexEntry[], state:'CA'|'CO', publishedRoutes:Set<string>):MappedCity[]{
 const geo=geography[state].cities as Record<string,{point:number[]}>;
 const seen=new Set<string>();
 return entries.filter(e=>e.state===state&&publishedRoutes.has(e.guideUrl)&&!seen.has(e.guideUrl)&&(seen.add(e.guideUrl),true)).map(e=>{
  const point=geo[key(e.city)]?.point;
  if(!point)throw new Error(`Published map city missing Census coordinates: ${state}/${e.city}`);
  return {name:e.city,url:e.guideUrl,x:point[0]!,y:point[1]!,county:e.county};
 });
}
