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
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsEventParams = Record<string, string | number | boolean>;

// Defense in depth: even if a caller passes params, anything that looks like
// a personally-identifying or input-sensitive field (ZIP code, bill amount,
// contact details) is stripped before it ever reaches gtag.
const FORBIDDEN_PARAM_KEYS = new Set([
	"zip",
	"zip_code",
	"zipcode",
	"bill",
	"bill_amount",
	"monthly_bill",
	"email",
	"phone",
	"name",
	"address",
]);

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
		if (FORBIDDEN_PARAM_KEYS.has(key.toLowerCase())) continue;
		safe[key] = value;
	}
	return safe;
}

export function trackEvent(name: AnalyticsEventName, params: AnalyticsEventParams = {}): void {
	if (!isKnownAnalyticsEvent(name)) return;
	if (typeof window === "undefined" || typeof window.gtag !== "function") return;

	window.gtag("event", name, sanitizeAnalyticsParams(params));
}
