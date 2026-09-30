// Generic partner-selection engine.
//
// Chooses at most one partner for a given commercial channel + page context,
// so components never need one-off partner-selection logic and competing CTAs
// of the same channel cannot render on one page by accident.
//
// Fails closed by construction: selectPartner() only returns a partner that
// is fully launch-ready and passes page-type plus geography eligibility.

import { PARTNERS, isLaunchReady, type Partner, type PartnerChannel, type EligiblePageType } from "./partners.ts";

export interface RoutingContext {
	channel: PartnerChannel;
	pageType: EligiblePageType;
	/** Two-letter US state code, e.g. "CA". */
	state: string;
	city: string;
}

export type GeoEligibilityCheck = (state: string, city: string) => boolean;

const geoEligibilityChecks = new Map<string, GeoEligibilityCheck>();

/** Register a partner-specific geography check for a route narrower than nationwide US. */
export function registerGeoEligibilityCheck(partnerId: string, check: GeoEligibilityCheck): void {
	geoEligibilityChecks.set(partnerId, check);
}

/** Test-only reset. */
export function _resetGeoEligibilityChecksForTests(): void {
	geoEligibilityChecks.clear();
}

function isGeoEligible(partner: Partner, state: string, city: string): boolean {
	const check = geoEligibilityChecks.get(partner.id);
	if (check) return check(state, city);

	// Fail closed. Only a partner explicitly marked nationwide US may use the
	// generic fallback. Any narrower geo string such as Southern California
	// requires an explicit partner-specific eligibility check.
	return partner.geo === "US";
}

export function getEligiblePartners(ctx: RoutingContext, partners: Partner[] = PARTNERS): Partner[] {
	return partners.filter(
		(p) =>
			p.channel === ctx.channel &&
			p.eligiblePageTypes.includes(ctx.pageType) &&
			isGeoEligible(p, ctx.state, ctx.city) &&
			isLaunchReady(p),
	);
}

/**
 * Deterministic quality/placement preference only. This is not a payout-
 * maximizing ranking and must be updated deliberately when partner priority
 * changes.
 */
export const CHANNEL_PRIORITY: Record<PartnerChannel, string[]> = {
	cpl: ["compare-solar-prices", "energysage"],
	pay_per_call: ["digital-master-media", "lead-smart"],
	hardware_affiliate: ["renogy", "bougerv", "allpowers"],
	general_referral: [],
};

export function selectPartner(ctx: RoutingContext, partners: Partner[] = PARTNERS): Partner | null {
	const eligible = getEligiblePartners(ctx, partners);
	if (eligible.length === 0) return null;

	for (const id of CHANNEL_PRIORITY[ctx.channel] ?? []) {
		const match = eligible.find((p) => p.id === id);
		if (match) return match;
	}

	return eligible[0] ?? null;
}
