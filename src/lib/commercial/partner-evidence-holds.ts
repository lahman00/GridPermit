// Forensic corrections are activation holds, not deletion of historical receipts.
// Releasing a hold requires a reviewed source change with new evidence.
export function partnerEvidenceHold(p:{partner_id?:string;name?:string;destination?:string|null;tracking?:{network?:string|null;network_tracking_url?:string|null;cj_tracking_url?:string|null}}):string|null {
 const id=(p.partner_id??'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const name=(p.name??'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const urls=[p.destination,p.tracking?.network_tracking_url,p.tracking?.cj_tracking_url].filter(Boolean).join(' ').toLowerCase();
 if(id.includes('stampedpv')||name.includes('stampedpv')||urls.includes('stampedpv.com'))return 'DISPROVEN_STAMPEDPV';
 if(id.includes('servicedirect')||name.includes('servicedirect')||urls.includes('servicedirect.com'))return 'SERVICE_DIRECT_COMMERCIAL_HOLD';
 if((id.includes('solarcom')||name.includes('solarcom')||urls.includes('solar.com'))&&(p.tracking?.network==='PARTNERIZE'||urls.includes('partnerize')))return 'DISPROVEN_SOLAR_COM_PARTNERIZE';
 if((id.includes('palmetto')||name.includes('palmetto')||urls.includes('palmetto.com'))&&p.tracking?.network==='IMPACT')return 'DISPROVEN_PALMETTO_IMPACT';
 if((id.includes('gogreensolar')||name.includes('gogreensolar'))&&p.tracking?.network==='SHAREASALE')return 'STALE_GOGREENSOLAR_SHAREASALE';
 return null;
}
