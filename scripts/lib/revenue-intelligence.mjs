export const SCORE_WEIGHTS = Object.freeze({
	live_revenue_route: 30,
	data_completeness: 20,
	commercial_field_depth: 20,
	validation_quality: 15,
	source_strength: 10,
	freshness: 5,
});

export const COVERAGE_FIELDS = Object.freeze([
	"utility",
	"generation_supplier",
	"city",
	"county",
	"permit_authority",
	"permit_url",
	"interconnection_url",
	"battery_programs",
	"required_documents",
	"inspection_steps",
	"timeline_days",
	"eligibility_constraints",
	"permit_fees",
	"rebates",
	"official_contacts",
]);

export const COMMERCIAL_FIELDS = Object.freeze([
	"interconnection_url",
	"battery_programs",
	"timeline_days",
	"permit_fees",
	"rebates",
]);

export const UNAVAILABLE_SIGNALS = Object.freeze([
	"gsc_queries",
	"gsc_clicks",
	"gsc_impressions",
	"search_volume",
	"page_sessions",
	"conversion_rate",
	"revenue_actuals",
]);

const DAY_MS = 86_400_000;

export function normalizeCitySlug(value) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function isPopulated(field) {
	return field?.value !== null && field?.value !== undefined;
}

export function hasCommercialSubstance(field) {
	if (!isPopulated(field)) return false;
	if (Array.isArray(field.value)) return field.value.length > 0;
	if (typeof field.value === "string") return field.value.trim().length > 0;
	if (typeof field.value === "object" && ("min_days" in field.value || "max_days" in field.value)) {
		return field.value.min_days !== null || field.value.max_days !== null;
	}
	return true;
}

export function calculateCompleteness(record) {
	const populated = COVERAGE_FIELDS.filter((field) => isPopulated(record[field]));
	const missing = COVERAGE_FIELDS.filter((field) => !isPopulated(record[field]));
	return {
		populated_fields: populated,
		missing_fields: missing,
		completeness_pct: round1((populated.length / COVERAGE_FIELDS.length) * 100),
	};
}

export function classifyReadiness({ completenessPct, validationScore, errorCount }) {
	if (errorCount > 0) return "NOT_READY";
	if (completenessPct >= 80 && validationScore >= 85) return "READY";
	if (completenessPct >= 50 && validationScore >= 75) return "LIMITED";
	return "NOT_READY";
}

export function passesLocalCompareSolarGates({ state, city, pageExists, allowlist, partnerStatus }) {
	return (
		String(state ?? "").trim().toUpperCase() === "CA" &&
		allowlist.has(normalizeCitySlug(city)) &&
		pageExists === true &&
		partnerStatus === "production_active"
	);
}

export function isCompareSolarRouteEligible({ state, city, pageExists, allowlist, productionVerified, partnerStatus }) {
	return (
		passesLocalCompareSolarGates({ state, city, pageExists, allowlist, partnerStatus }) &&
		productionVerified instanceof Set &&
		productionVerified.has(normalizeCitySlug(city))
	);
}

function parseIsoDate(value, label) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
		throw new Error(`${label} must be an ISO date (YYYY-MM-DD); received ${JSON.stringify(value)}`);
	}
	const timestamp = Date.parse(`${value}T00:00:00Z`);
	if (!Number.isFinite(timestamp)) throw new Error(`${label} is not a valid date: ${value}`);
	return timestamp;
}

export function ageInDays(lastVerified, asOf) {
	return Math.max(0, Math.floor((parseIsoDate(asOf, "asOf") - parseIsoDate(lastVerified, "lastVerified")) / DAY_MS));
}

function freshnessFraction(ageDays) {
	if (ageDays <= 30) return 1;
	if (ageDays <= 90) return 0.8;
	if (ageDays <= 180) return 0.5;
	return 0;
}

function sourceStrength(record, populatedFields) {
	const sourceCount = new Set((record.sources ?? []).map((source) => source.id).filter(Boolean)).size;
	const fieldsWithSources = populatedFields.filter((field) => (record[field]?.source_ids ?? []).length > 0).length;
	const breadth = Math.min(sourceCount / 5, 1);
	const traceability = populatedFields.length === 0 ? 0 : fieldsWithSources / populatedFields.length;
	return { source_count: sourceCount, fraction: (breadth + traceability) / 2 };
}

export function scoreLocality({ record, validation, pageExists, pagePath }, { allowlist, productionVerified, partnerStatus, asOf }) {
	const city = record.city?.value ?? null;
	const completeness = calculateCompleteness(record);
	const commercialCount = COMMERCIAL_FIELDS.filter((field) => hasCommercialSubstance(record[field])).length;
	const validationScore = Number(validation?.score ?? 0);
	const errorCount = Array.isArray(validation?.errors) ? validation.errors.length : 0;
	const warningCount = Array.isArray(validation?.warnings) ? validation.warnings.length : 0;
	const routeEligible = isCompareSolarRouteEligible({
		state: record.state,
		city,
		pageExists,
		allowlist,
		productionVerified,
		partnerStatus,
	});
	const source = sourceStrength(record, completeness.populated_fields);
	const ageDays = ageInDays(record.last_verified, asOf);
	const components = {
		live_revenue_route: routeEligible ? SCORE_WEIGHTS.live_revenue_route : 0,
		data_completeness: round2((completeness.completeness_pct / 100) * SCORE_WEIGHTS.data_completeness),
		commercial_field_depth: round2((commercialCount / COMMERCIAL_FIELDS.length) * SCORE_WEIGHTS.commercial_field_depth),
		validation_quality: round2((Math.max(0, Math.min(validationScore, 100)) / 100) * SCORE_WEIGHTS.validation_quality),
		source_strength: round2(source.fraction * SCORE_WEIGHTS.source_strength),
		freshness: round2(freshnessFraction(ageDays) * SCORE_WEIGHTS.freshness),
	};
	const monetizationScore = round2(Object.values(components).reduce((sum, value) => sum + value, 0));

	return {
		record_id: record.record_id,
		city,
		state: record.state,
		page_path: pagePath,
		monetization_score: monetizationScore,
		live_revenue_route: routeEligible,
		compare_solar_allowlisted: record.state === "CA" && allowlist.has(normalizeCitySlug(city)),
		compare_solar_production_verified: productionVerified.has(normalizeCitySlug(city)),
		completeness_pct: completeness.completeness_pct,
		commercial_fields_with_substance: commercialCount,
		commercial_fields_total: COMMERCIAL_FIELDS.length,
		validation_score: validationScore,
		validation_error_count: errorCount,
		validation_warning_count: warningCount,
		source_count: source.source_count,
		last_verified: record.last_verified,
		freshness_age_days: ageDays,
		readiness: classifyReadiness({ completenessPct: completeness.completeness_pct, validationScore, errorCount }),
		score_components: components,
	};
}

export function rankMoneyPages(localities, options) {
	const rows = localities
		.filter((item) => item.pageExists)
		.map((item) => scoreLocality(item, options))
		.sort(
			(a, b) =>
				b.monetization_score - a.monetization_score ||
				Number(b.live_revenue_route) - Number(a.live_revenue_route) ||
				b.completeness_pct - a.completeness_pct ||
				b.validation_score - a.validation_score ||
				a.record_id.localeCompare(b.record_id),
		);
	return rows.map((row, index) => ({ rank: index + 1, ...row }));
}

function validatedSlugList(document, field, label) {
	const values = document?.[field];
	if (!Array.isArray(values)) throw new Error(`${label}.${field} must be an array`);
	const seen = new Set();
	for (const value of values) {
		if (typeof value !== "string" || value.length === 0 || normalizeCitySlug(value) !== value) {
			throw new Error(`${label}.${field} contains a non-canonical city slug: ${JSON.stringify(value)}`);
		}
		if (seen.has(value)) throw new Error(`${label}.${field} contains duplicate city slug: ${value}`);
		seen.add(value);
	}
	return seen;
}

export function validateCompareSolarDocuments(allowlistDocument, productionDocument) {
	for (const [document, label] of [
		[allowlistDocument, "allowlist"],
		[productionDocument, "production"],
	]) {
		if (document?.partner_id !== "compare-solar-prices") {
			throw new Error(`${label}.partner_id must be compare-solar-prices`);
		}
		if (document?.state !== "CA") throw new Error(`${label}.state must be CA`);
	}

	const allowlist = validatedSlugList(allowlistDocument, "city_slugs", "allowlist");
	const productionVerified = validatedSlugList(productionDocument, "verified_city_slugs", "production");
	const declaredNotDeployed = validatedSlugList(productionDocument, "allowlisted_but_not_deployed", "production");
	for (const slug of productionVerified) {
		if (!allowlist.has(slug)) throw new Error(`production verified city is absent from allowlist: ${slug}`);
	}
	const actualNotDeployed = [...allowlist].filter((slug) => !productionVerified.has(slug)).sort();
	const declared = [...declaredNotDeployed].sort();
	if (JSON.stringify(actualNotDeployed) !== JSON.stringify(declared)) {
		throw new Error("production.allowlisted_but_not_deployed must exactly equal allowlist minus verified cities");
	}
	return { allowlist, productionVerified };
}

export function buildCompareSolarCoverage(localities, allowlistDocument, productionDocument, partnerStatus) {
	const caBySlug = new Map();
	for (const item of localities) {
		if (item.record.state !== "CA") continue;
		const slug = normalizeCitySlug(item.record.city?.value);
		if (!caBySlug.has(slug)) caBySlug.set(slug, []);
		caBySlug.get(slug).push(item);
	}

	const { allowlist, productionVerified } = validateCompareSolarDocuments(allowlistDocument, productionDocument);
	return [...allowlistDocument.city_slugs].sort().map((citySlug) => {
		const matches = (caBySlug.get(citySlug) ?? []).sort((a, b) => a.record.record_id.localeCompare(b.record.record_id));
		const withPage = matches.find((item) => item.pageExists) ?? null;
		const selected = withPage ?? matches[0] ?? null;
		const eligible = isCompareSolarRouteEligible({
			state: selected?.record.state,
			city: selected?.record.city?.value,
			pageExists: selected?.pageExists ?? false,
			allowlist,
			productionVerified,
			partnerStatus,
		});
		let classification = "eligible";
		let exclusionReason = null;
		if (matches.length === 0) {
			classification = "dead_allowlist_entry";
			exclusionReason = "No verified California locality record exists.";
		} else if (!withPage) {
			classification = "record_no_page";
			exclusionReason = "A verified California record exists, but no local solar-permit-guide page exists.";
		} else if (!productionVerified.has(citySlug)) {
			classification = "not_production_verified";
			exclusionReason = "The city is allowlisted locally but absent from the audited production-positive route set.";
		} else if (!eligible) {
			classification = "fail_closed";
			exclusionReason = "One or more route gates failed.";
		}
		const completeness = selected ? calculateCompleteness(selected.record) : null;
		return {
			city_slug: citySlug,
			state: "CA",
			classification,
			live_route_eligible: eligible,
			production_verified: productionVerified.has(citySlug),
			local_record_exists: matches.length > 0,
			local_page_exists: Boolean(withPage),
			record_ids: matches.map((item) => item.record.record_id),
			page_path: withPage?.pagePath ?? null,
			completeness_pct: completeness?.completeness_pct ?? null,
			validation_score: selected?.validation?.score ?? null,
			validation_error_count: selected?.validation?.errors?.length ?? null,
			missing_fields: completeness?.missing_fields ?? [],
			exclusion_reason: exclusionReason,
		};
	});
}

function routingState(status) {
	if (status === "production_active") return "production_live";
	if (status === "owner_action_required") return "owner_action_required";
	if (["pending_approval", "application_started", "awaiting_response", "contacted"].includes(status)) return "pending_partner";
	if (["rejected", "blocked"].includes(status)) return "not_routable";
	return "research_only";
}

function defaultTerms(partner) {
	const payoutValue = partner.payoutValue ?? null;
	const cookieDays = partner.cookieDays ?? null;
	return {
		payout: {
			type: partner.payoutType,
			value: payoutValue,
			upper_value: null,
			confidence: payoutValue === null ? "unknown" : "published",
		},
		cookie: {
			days: cookieDays,
			confidence: cookieDays === null ? (partner.channel === "pay_per_call" ? "not_applicable" : "unknown") : "published",
		},
	};
}

function matrixRow(route, registrySource) {
	if (route.payout?.confidence === "unknown") {
		for (const field of ["value", "upper_value", "secondary_value"]) {
			if (route.payout[field] !== null && route.payout[field] !== undefined) {
				throw new Error(`${route.route_id ?? route.id} has unknown payout terms but a populated ${field}`);
			}
		}
	}
	if (route.cookie?.confidence === "unknown" && route.cookie.days !== null && route.cookie.days !== undefined) {
		throw new Error(`${route.route_id ?? route.id} has unknown cookie terms but a populated duration`);
	}
	return {
		route_id: route.route_id ?? route.id,
		partner_id: route.partner_id ?? route.id,
		partner_name: route.name,
		channel: route.channel,
		status: route.status,
		routing_state: routingState(route.status),
		routable_now: route.status === "production_active",
		payout_type: route.payout.type,
		payout_value: route.payout.value,
		payout_upper_value: route.payout.upper_value,
		secondary_payout_type: route.payout.secondary_type ?? null,
		secondary_payout_value: route.payout.secondary_value ?? null,
		payout_terms_confidence: route.payout.confidence,
		cookie_days: route.cookie.days,
		cookie_terms_confidence: route.cookie.confidence,
		geo: route.geo,
		eligible_page_types: route.eligible_page_types ?? route.eligiblePageTypes ?? [],
		registry_tracking_enabled: registrySource?.trackingEnabled ?? null,
		registry_placement_eligible: registrySource?.placementEligible ?? null,
		registry_launch_enabled: registrySource?.launchEnabled ?? null,
		next_action: route.next_action ?? null,
		evidence: route.evidence ?? route.notes ?? null,
		source: registrySource ? "src/lib/partners.ts" : "data/revenue/partner-analysis-overlay.json",
	};
}

export function buildPartnerRoutingMatrix(partners, overlay) {
	const partnerIds = partners.map((partner) => partner.id);
	if (new Set(partnerIds).size !== partnerIds.length) throw new Error("canonical partner ids must be unique");
	const unknownUpdateIds = Object.keys(overlay.route_updates ?? {}).filter((id) => !partnerIds.includes(id));
	if (unknownUpdateIds.length > 0) {
		throw new Error(`partner overlay contains unknown route_updates: ${unknownUpdateIds.sort().join(", ")}`);
	}
	const baseRows = partners.map((partner) => {
		const update = overlay.route_updates?.[partner.id] ?? {};
		const terms = defaultTerms(partner);
		const route = {
			...partner,
			status: update.status ?? partner.status,
			payout: update.payout ?? terms.payout,
			cookie: update.cookie ?? terms.cookie,
			next_action: update.next_action,
			evidence: update.evidence ?? partner.notes,
		};
		return matrixRow(route, partner);
	});
	const supplemental = (overlay.supplemental_routes ?? []).map((route) => matrixRow(route, null));
	const rows = [...baseRows, ...supplemental];
	const routeIds = rows.map((row) => row.route_id);
	if (new Set(routeIds).size !== routeIds.length) throw new Error("partner routing matrix route ids must be unique");
	return rows.sort((a, b) => a.route_id.localeCompare(b.route_id));
}

export function buildOwnerActionQueue(coverageRows) {
	const recordNoPage = coverageRows.filter((row) => row.classification === "record_no_page");
	const deadEntries = coverageRows.filter((row) => row.classification === "dead_allowlist_entry");
	const rows = [
		{
			id: "send-comparesolar-w8ben",
			action: "Owner sends the prepared W-8BEN to the CompareSolarPrices contact.",
			owner_required: true,
			commercial_upside_points: 5,
			owner_effort_points: 1,
			execution_status: "owner_action_available",
			safe_during_stale_clone_freeze: true,
			basis: "The only production-live paying route already accrues toward a payout threshold; the tax form enables payout processing but does not change routing.",
		},
		{
			id: "complete-comparesolar-gap-records",
			action: `Defer page generation for the ${recordNoPage.length} allowlisted records until production eligibility is freshly verified and deployment is separately authorized.`,
			owner_required: false,
			commercial_upside_points: 0,
			owner_effort_points: 1,
			execution_status: "deferred_requires_fresh_production_verification",
			safe_during_stale_clone_freeze: false,
			basis: `${recordNoPage.map((row) => row.city_slug).join(", ")} have local records but are absent from the audited production-positive route set; local page creation would not prove a live revenue route.`,
		},
		...[
			["apply-renogy", "Owner applies to Renogy through the received Impact invitation.", "Direct fit, 6% rate, and 27-day attribution are confirmed; approval and tracking are still absent.", 3],
			["apply-bougerv", "Owner applies to BougeRV through the received Impact link.", "Direct fit and 7% standard rate are confirmed; cookie, approval, and tracking remain absent.", 3],
			["apply-litime", "Owner applies to LiTime U.S. through the received Impact link.", "Direct fit, 5% base/volume tiers, and 30-day attribution are confirmed; approval and tracking remain absent.", 3],
			["apply-allpowers", "Owner applies to ALLPOWERS in CJ using advertiser ID 7797916.", "The CJ publisher account and advertiser ID are verified; public terms exist, but approval and tracking remain absent.", 3],
			["apply-energysage", "Owner reviews current EnergySage terms in CJ and submits Apply/Join if acceptable.", "CJ publisher activation is complete and existing solar-CPL placement architecture is already present locally; advertiser approval and tracking are still absent.", 4],
		].map(([id, action, basis, commercialUpsidePoints]) => ({
			id,
			action,
			owner_required: true,
			commercial_upside_points: commercialUpsidePoints,
			owner_effort_points: 1,
			execution_status: "owner_action_available",
			safe_during_stale_clone_freeze: true,
			basis,
		})),
		{
			id: "review-dmm-agreement",
			action: "Owner reviews the DMM publisher agreement and signs only if binding terms are acceptable.",
			owner_required: true,
			commercial_upside_points: 4,
			owner_effort_points: 3,
			execution_status: "owner_action_available",
			safe_during_stale_clone_freeze: true,
			basis: "Fit is confirmed, but GridPermit-specific payout and tracking are unknown and the agreement is binding.",
		},
		{
			id: "research-dead-comparesolar-cities",
			action: `Defer expansion research for the ${deadEntries.length} allowlisted California cities with no local record until production state is reconciled.`,
			owner_required: false,
			commercial_upside_points: 0,
			owner_effort_points: 5,
			execution_status: "deferred_requires_fresh_production_verification",
			safe_during_stale_clone_freeze: false,
			basis: `${deadEntries.map((row) => row.city_slug).join(", ")} are locally allowlisted but have neither verified local data nor a production-positive route.`,
		},
	];
	return rows
		.map((row) => ({ ...row, upside_effort_ratio: round2(row.commercial_upside_points / row.owner_effort_points) }))
		.sort(
			(a, b) =>
				b.upside_effort_ratio - a.upside_effort_ratio ||
				b.commercial_upside_points - a.commercial_upside_points ||
				a.id.localeCompare(b.id),
		)
		.map((row, index) => ({ rank: index + 1, ...row }));
}

export function summarizeCoverage(rows) {
	return {
		allowlisted_city_count: rows.length,
		eligible_count: rows.filter((row) => row.classification === "eligible").length,
		record_no_page_count: rows.filter((row) => row.classification === "record_no_page").length,
		dead_allowlist_entry_count: rows.filter((row) => row.classification === "dead_allowlist_entry").length,
		not_production_verified_count: rows.filter((row) => row.classification === "not_production_verified").length,
		fail_closed_count: rows.filter((row) => !row.live_route_eligible).length,
	};
}

function round1(value) {
	return Math.round(value * 10) / 10;
}

function round2(value) {
	return Math.round(value * 100) / 100;
}
