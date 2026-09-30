import type {PartnerV2} from './partner-platform';
export function campaignOpen(phone: PartnerV2['phone'], now: string): boolean {
  if(!phone||phone.campaign_active===false) return false;
  try {
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:phone.time_zone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
    const get=(type:string)=>parts.find(p=>p.type===type)?.value??'';
    const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday')), time=get('hour')+':'+get('minute');
    return phone.weekdays.includes(day)&&time>=phone.start&&time<phone.end;
  } catch { return false; }
}
