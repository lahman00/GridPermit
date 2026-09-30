import type { Relationship } from './types.ts';
export function commercialDisclosure(relationship: Relationship, partnerName: string): string {
  switch (relationship) {
    case 'paid_referral': return `Paid referral: GridPermit may receive compensation from ${partnerName} after a qualifying action. You will continue on the provider's website.`;
    case 'sponsored_local': return `Sponsored local partner: ${partnerName} pays for this placement. GridPermit is not the installer.`;
    case 'affiliate': return `Affiliate disclosure: GridPermit may earn a commission from ${partnerName} if you complete a qualifying purchase through this link.`;
    case 'uncompensated_resource': return `External resource: this link to ${partnerName} is not tracked for compensation.`;
    case 'internal_product': return 'This is a GridPermit product. Availability and any price will be stated before a purchase.';
    default: return '';
  }
}
