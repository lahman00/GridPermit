import type {PartnerV2} from './partner-platform.ts';
// Scope is independently checked against the verification record. These
// deployment controls may be narrowed/paused without manufacturing evidence.
export function approvalPayload(partner:PartnerV2):string {
 const {status,placement,priority,categories,territories,last_verified,...commercial}=partner;
 const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
 return JSON.stringify(stable(commercial));
}
