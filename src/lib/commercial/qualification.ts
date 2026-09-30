import type {PartnerV2} from './partner-platform';
export function qualificationPolicy(partner:PartnerV2, legacyConfirmation=false){
 const q=partner.qualification;
 return {required:legacyConfirmation||q.confirmation_required,
   label:q.existing_solar==='REJECT'?'I own this home and this property does not already have solar.':q.homeowner_required?'I own this home.':'I confirm that my project meets the provider’s eligibility conditions.',
   existingSolarAllowed:q.existing_solar==='ALLOW'};
}
