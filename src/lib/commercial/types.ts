export const COMMERCIAL_INTENTS = ['NEW_SOLAR', 'BATTERY_RETROFIT', 'PERMIT_SERVICE', 'PTO_RESCUE', 'INSTALLER_B2B', 'INFORMATIONAL', 'UNKNOWN', 'BATTERY_NEW_INSTALL', 'PERMIT_ENGINEERING', 'LOCAL_INSTALLER', 'PAY_PER_CALL', 'NONE'] as const;
export type CommercialIntent = typeof COMMERCIAL_INTENTS[number];
export const CTA_CHANNELS = ['SOLAR_QUOTE', 'BATTERY_SERVICE', 'PERMIT_ENGINEERING', 'PTO_HELP', 'B2B', 'NONE', 'LOCAL_INSTALLER', 'PAY_PER_CALL'] as const;
export type CtaChannel = typeof CTA_CHANNELS[number];
export const ROUTE_STATUSES = ['RESEARCH', 'READY', 'SHADOW', 'ACTIVE'] as const;
export type Relationship = 'paid_referral' | 'affiliate' | 'uncompensated_resource' | 'internal_product' | 'sponsored_local';
export interface CommercialContext {
  state: string;
  city: string;
  recordId?: string;
  utility?: { value?: string | null; notes?: string | null } | null;
  pageType: string;
  pagePath: string;
  intent: CommercialIntent;
}
export interface RouteEvidence {
  approvalRef: string;
  territoryRef: string;
  trackingRef: string;
  verifiedAt: string;
  expiresAt: string;
}
export interface CommercialPartner {
  id: string;
  name: string;
  active: boolean;
  trackingActive: boolean;
  testOnly: boolean;
}
export interface CommercialRoute {
  id: string;
  partnerId: string;
  channel: CtaChannel;
  status: typeof ROUTE_STATUSES[number];
  enabled: boolean;
  testOnly: boolean;
  allowedIntents: CommercialIntent[];
  states: string[];
  citySlugs: string[];
  pageTypes: string[];
  pagePaths: string[];
  utilityRequired: boolean;
  relationship: Relationship;
  eligibility: string[];
  evidence: RouteEvidence;
  destination: {
    landingUrl: string;
    preferredFormUrl?: string;
    fallbackUrl?: string;
    usePreferredForm: boolean;
    approvedFallback: boolean;
    expectedHosts: string[];
    expectedFinalUrls?: string[];
    allowedQueryParams?: string[];
  };
  tracking: { mode: 'legacy_csp' | 'cid_query' | 'internal' | 'utm' | 'phone'; cidParam: string; fixedParams: Record<string, string> };
}
export interface DestinationHealth {
  url: string;
  ok: boolean;
  checkedAt: string;
  status: number | null;
  finalUrl: string | null;
  queryPreserved: boolean | null;
}
export interface CommercialCatalog {
  pages: CommercialContext[];
  partners: CommercialPartner[];
  routes: CommercialRoute[];
  destinationHealth: DestinationHealth[];
}
export interface SelectedCommercialRoute {
  validUntil: string;
  route: CommercialRoute;
  partner: CommercialPartner;
  destination: string;
  disclosure: string;
  context: CommercialContext;
}
export interface ExperimentConfig {
  id: string;
  status: 'DRAFT' | 'SHADOW' | 'ACTIVE' | 'PAUSED';
  enabled: boolean;
  eligiblePages: string[];
  intent: CommercialIntent;
  controlRouteId: string | null;
  variantRouteId: string | null;
  startAt: string;
  endAt: string;
  assignment: 'page_cohort' | 'city_cohort' | 'intent_cohort' | 'anonymous_session';
  eligibleCities?: string[];
  eligibleIntents?: CommercialIntent[];
  variantCities?: string[];
  variantIntents?: CommercialIntent[];
  variantPages: string[];
  variantBasisPoints: number;
  minimumDays: number;
  minimumExposures: number;
}
