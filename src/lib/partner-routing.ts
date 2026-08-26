// Generic partner-selection engine.
//
// Chooses at most one partner for a given commercial channel + page context,
// so components never need their own one-off "which partner do I show"
// logic, and two competing CTAs of the same channel can never render on the
// same page by accident (see docs/MONETIZATION_PLACEMENT_MAP.md's one-CTA-
// per-page density rule).
//
// Fails closed by construction: selectPartner() only ever returns a partner
// that is isLaunchReady() (approved, tracked, placement-eligible, and
// deliberately launched) AND passes this page's geo/page-type eligibility.
// Every partner in src/lib/partners.ts is launchEnabled: false today, so this
// always returns null right now — that emptiness is the correct, tested
// state until a real partner is approved, tracked, and deliberately
// launched. This module is not wired into any production page yet.

import { PARTNERS, isLaunchReady, type Partner, type PartnerChannel, type EligiblePageType } from "./partners.ts";

export interface RoutingContext {
	channel: PartnerChannel;
	pageType: EligiblePageType;
	/** Two-letter US state code, e.g. "CA". */
	state: string;
	city: string;
}

/**
 * Fine-grained geo-eligibility check for one specific partner, for partners
 * whose real service area is narrower than a plain "US" geo string can
 * express (e.g. a Southern-California-only city allowlist). Register a
 * partner's checker from the module that owns that partner's specific logic
 * (e.g. a future compare-solar-prices.ts), rather than hardcoding partner
 * names here, so this engine stays generic and partner-agnostic.
 */
export type GeoEligibilityCheck = (state: string, city: string) => boolean;

const geoEligibilityChecks = new Map<string, GeoEligibilityCheck>();

/** Call once, at module-load time, from a partner-specific module that needs finer geo eligibility than the generic nationwide-US fallback below. */
export function registerGeoEligibilityCheck(partnerId: string, check: GeoEligibilityCheck): void {
	geoEligibilityChecks.set(partnerId, check);
}

/** Test-only: clears every registered check. Production code should never call this. */
export function _resetGeoEligibilityChecksForTests(): void {
	geoEligibilityChecks.clear();
}

function isGeoEligible(partner: Partner, state: string, city: string): boolean {
	const check = geoEligibilityChecks.get(partner.id);
	if (check) return check(state, city);
	// No fine-grained check registered: fall back to a loose nationwide-US
	// match. A partner genuinely scoped narrower than nationwide MUST
	// register a real check above; relying on this fallback for a
	// narrow-geo partner risks offering it outside its real service area.
	return partner.geo === "US" || partner.geo.startsWith("US-") || partner.geo.startsWith("US_");
}

/**
 * Every partner currently eligible for this exact context: right channel,
 * right page type, right geo, and fully launch-ready. Ordering is not
 * meaningful for callers that only need one partner; use selectPartner().
 */
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
 * Per-channel tie-break order, used ONLY when more than one partner is
 * simultaneously launch-ready and eligible for the exact same context. This
 * is a placement/quality preference, not a payout-maximizing ranking, and it
 * exists purely to guarantee a deterministic single winner. Update it when a
 * new partner's priority is a deliberate decision, never automatically from
 * payout figures.
 */
export const CHANNEL_PRIORITY: Record<PartnerChannel, string[]> = {
	cpl: ["compare-solar-prices", "energysage"],
	pay_per_call: ["digital-master-media"],
	hardware_affiliate: ["renogy", "bougerv", "allpowers"],
	general_referral: [],
};

/**
 * Chooses at most one partner for this context, or null when nothing is
 * eligible. Callers must treat null as "render nothing" — never fall back to
 * an untracked/unapproved partner implicitly. A page that intentionally
 * shows an existing untracked relationship (e.g. today's plain EnergySage
 * link) does so through its own explicit code path, not through this
 * function, so that truthful-but-unmonetized surface can never be confused
 * with a real routing decision.
 */
export function selectPartner(ctx: RoutingContext, partners: Partner[] = PARTNERS): Partner | null {
	const eligible = getEligiblePartners(ctx, partners);
	if (eligible.length === 0) return null;

	for (const id of CHANNEL_PRIORITY[ctx.channel] ?? []) {
		const match = eligible.find((p) => p.id === id);
		if (match) return match;
	}
	// No priority-list partner matched (e.g. a newly launched partner not yet
	// added to CHANNEL_PRIORITY): fall back to the first eligible partner
	// rather than returning nothing, so a real launch is never silently
	// dropped by a stale priority list.
	return eligible[0];
}
