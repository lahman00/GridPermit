// Central on/off switch for monetization surfaces that don't exist yet.
// Per docs/MONETIZATION_READINESS.md, GridPermit stays at a plain,
// non-affiliate outbound referral until a real partner agreement exists —
// these flags are infrastructure for *when* that happens, not a signal that
// any of it is live today. Every flag here must default to false; a page
// only renders one of these surfaces if it explicitly checks the flag AND
// the flag is true, so this file alone can never cause anything to appear.
export interface FeatureFlags {
	/** Paid placement for a partner installer/marketplace on a locality guide. */
	sponsorshipSlots: boolean;
	/** A "featured partner" callout distinct from the plain EnergySage referral link. */
	featuredPartners: boolean;
	/** Side-by-side installer/marketplace comparison tables. */
	comparisonModules: boolean;
	/** A browsable directory of installers/contractors. */
	installerDirectory: boolean;
	/** Tracked/affiliate outbound links (vs. today's plain, non-affiliate links). */
	affiliateFramework: boolean;
	/** Email newsletter signup capture. */
	newsletterSignup: boolean;
}

export const FEATURE_FLAGS: FeatureFlags = {
	sponsorshipSlots: false,
	featuredPartners: false,
	comparisonModules: false,
	installerDirectory: false,
	affiliateFramework: false,
	newsletterSignup: false,
};

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
	return FEATURE_FLAGS[flag] === true;
}
