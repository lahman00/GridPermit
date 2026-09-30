// Small, reusable GA4 event-tracking helper. Every conversion event on the
// site must be one of ANALYTICS_EVENTS below — no ad-hoc event names, no new
// analytics provider, no separate gtag snippet (the one script tag lives in
// src/components/Analytics.astro). trackEvent() is a no-op whenever gtag
// isn't available (e.g. blocked by an ad blocker, or during a unit test with
// no window), so callers never need to guard against that themselves.

export const ANALYTICS_EVENTS = [
	"calculator_started",
	"calculator_completed",
	"locality_guide_viewed",
	"official_source_clicked",
	"blog_article_viewed",
	"search_used",
	"permit_guide_clicked",
	"external_partner_clicked",
	"faq_expanded",
	"pro_interest_clicked",
	"page_not_found",
	"affiliate_cta_viewed",
	"affiliate_cta_clicked",
	"cpl_cta_viewed",
	"cpl_cta_exposed",
	"cpl_cta_clicked",
	"pay_per_call_cta_viewed",
	"pay_per_call_clicked",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsEventParams = Record<string, string | number | boolean>;

// Defense in depth: even if a caller passes params, anything that looks like
// a personally-identifying or input-sensitive field (ZIP code, bill amount,
// contact details) is stripped before it ever reaches gtag.
const FORBIDDEN_PARAM_TOKENS = new Set([
	"zip",
	"zipcode",
	"postal",
	"postalcode",
	"bill",
	"email",
	"phone",
	"name",
	"address",
	"credit",
]);

function normalizedParamTokens(key: string): string[] {
	return key
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.toLowerCase()
		.split("_")
		.filter(Boolean);
}

function isForbiddenAnalyticsParamKey(key: string): boolean {
	return normalizedParamTokens(key).some((token) => FORBIDDEN_PARAM_TOKENS.has(token));
}

const SAFE_FIRST_LEAD_PAGE_LOCATIONS = [
	/^https:\/\/mygridpermit\.com\/california\/escondido\/solar-permit-guide\/\?gp_cid=[A-Za-z0-9_-]{1,32}(?:&gp_src=fl_src_01)?$/,
	/^https:\/\/mygridpermit\.com\/california\/hemet\/solar-permit-guide\/\?gp_cid=[A-Za-z0-9_-]{1,32}(?:&gp_src=fl_src_02)?$/,
	/^https:\/\/mygridpermit\.com\/california\/pomona\/solar-permit-guide\/\?gp_cid=[A-Za-z0-9_-]{1,32}(?:&gp_src=fl_src_03)?$/,
];

function isSafeFirstLeadPageLocation(value: string): boolean {
	return SAFE_FIRST_LEAD_PAGE_LOCATIONS.some((pattern) => pattern.test(value));
}

declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
	}
}

export function isKnownAnalyticsEvent(name: string): name is AnalyticsEventName {
	return (ANALYTICS_EVENTS as readonly string[]).includes(name);
}

export function sanitizeAnalyticsParams(params: AnalyticsEventParams): AnalyticsEventParams {
	const safe: AnalyticsEventParams = {};
	for (const [key, value] of Object.entries(params)) {
		if (isForbiddenAnalyticsParamKey(key)) continue;
		if (key.toLowerCase() === "page_location") {
			if (typeof value !== "string" || !isSafeFirstLeadPageLocation(value)) continue;
		}
		safe[key] = value;
	}
	return safe;
}

export function trackEvent(name: AnalyticsEventName, params: AnalyticsEventParams = {}): void {
	if (!isKnownAnalyticsEvent(name)) return;
	if (typeof window === "undefined" || typeof window.gtag !== "function") return;

	window.gtag("event", name, sanitizeAnalyticsParams(params));
}
