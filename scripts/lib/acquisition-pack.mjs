import {
	COVERAGE_FIELDS,
	ageInDays,
	calculateCompleteness,
	isCompareSolarRouteEligible,
	normalizeCitySlug,
	passesLocalCompareSolarGates,
} from "./revenue-intelligence.mjs";

export const ACQUISITION_PRIORITY_WEIGHTS = Object.freeze({
	supported_local_evidence: 35,
	data_completeness: 25,
	validation_quality: 20,
	selected_angle_confidence: 10,
	freshness: 10,
});

export const OUTREACH_FACT_FIELDS = Object.freeze([
	"eligibility_constraints",
	"timeline_days",
	"battery_programs",
	"inspection_steps",
	"required_documents",
	"permit_fees",
	"interconnection_url",
]);

export const DATA_QUALITY_FIELDS = Object.freeze([
	"rebates",
	"permit_fees",
	"timeline_days",
	"generation_supplier",
	"required_documents",
	"inspection_steps",
	"battery_programs",
	"interconnection_url",
	"eligibility_constraints",
]);

export const PROHIBITED_CLAIM_PATTERNS = Object.freeze([
	{ id: "traffic_or_audience_count", pattern: /\b\d[\d,.]*\s+(?:(?:daily|weekly|monthly|annual)\s+)?(?:visitors?|users?|sessions?|clicks?|impressions?|readers?|audience members?)\b/i },
	{ id: "ranking_claim", pattern: /\b(?:top|best|highest|number[- ]?one|#1)\s+(?:ranked|ranking|result|page|guide)\b/i },
	{ id: "guarantee", pattern: /\bguarantee(?:d|s|ing)?\b/i },
	{ id: "promised_outcome", pattern: /\bwill\s+(?:drive|generate|deliver)\b/i },
	{ id: "lead_rate", pattern: /\bleads?\s+per\s+(?:day|week|month)\b/i },
	{ id: "conversion_rate", pattern: /\bconversion[ _-]?rate\b/i },
	{ id: "roi", pattern: /\bROI\s+of\b/i },
	{ id: "partner_endorsement", pattern: /\b(?:official partner|endorsed by|certified by)\b/i },
	{ id: "gsc_queries", pattern: /\bgsc[ _-]?queries\b/i },
	{ id: "gsc_clicks", pattern: /\bgsc[ _-]?clicks\b/i },
	{ id: "gsc_impressions", pattern: /\bgsc[ _-]?impressions\b/i },
	{ id: "search_volume", pattern: /\bsearch[ _-]?volume\b/i },
	{ id: "page_sessions", pattern: /\bpage[ _-]?sessions\b/i },
	{ id: "revenue_actuals", pattern: /\brevenue[ _-]?actuals\b/i },
]);

const PROGRAM_SIGNAL_PATTERN = /\b(?:solarapp\+?|symbium|permitsdirect!?|auto[- ]?issued|automated review|real[- ]?time issuance|same[- ]?day|self[- ]?issued|no plan review|express permit)\b/i;
const NEGATION_PATTERN = /\b(?:not confirmed|not located|not found|not available|not adopted|does not|did not|was not|is not|unable to)\b/i;

export function findProhibitedClaims(text) {
	return PROHIBITED_CLAIM_PATTERNS
		.filter(({ pattern }) => pattern.test(String(text ?? "")))
		.map(({ id }) => id);
}

export function assertNoProhibitedClaims(texts) {
	for (const text of texts) {
		const matches = findProhibitedClaims(text);
		if (matches.length > 0) {
			throw new Error(`Unsupported commercial claim pattern(s) ${matches.join(", ")} in: ${JSON.stringify(text)}`);
		}
	}
}

function walkStrings(value, path = [], rows = []) {
	if (typeof value === "string") {
		rows.push({ path, text: value });
		return rows;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => walkStrings(item, [...path, index], rows));
		return rows;
	}
	if (value && typeof value === "object") {
		for (const [key, item] of Object.entries(value)) walkStrings(item, [...path, key], rows);
	}
	return rows;
}

export function extractProgramSignals(record) {
	return walkStrings(record)
		.filter(({ text }) => PROGRAM_SIGNAL_PATTERN.test(text))
		.map(({ path, text }) => {
			const evidenceClass = path[0] === "sources"
				? "source_reference"
				: path.includes("value")
					? "structured_value"
					: "research_note";
			return {
				path: path.map(String).join("."),
				text,
				evidence_class: evidenceClass,
				negated: NEGATION_PATTERN.test(text),
			};
		});
}

function hasSourcedValue(record, field) {
	const envelope = record[field];
	return envelope?.value !== null && envelope?.value !== undefined && (envelope.source_ids ?? []).length > 0;
}

function stableExcerpt(value) {
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

function grounding(record, field, excerpt = record[field]?.value) {
	return {
		field,
		source_ids: [...(record[field]?.source_ids ?? [])],
		excerpt: stableExcerpt(excerpt),
		confidence: Number(record[field]?.confidence ?? 0),
	};
}

function fact(record, field, value = record[field]?.value) {
	return {
		available: hasSourcedValue(record, field),
		value: hasSourcedValue(record, field) ? value : null,
		confidence: hasSourcedValue(record, field) ? Number(record[field].confidence) : null,
		source_ids: hasSourcedValue(record, field) ? [...record[field].source_ids] : [],
	};
}

function numericTimeline(value) {
	if (!value || typeof value !== "object") return null;
	const min = Number.isFinite(value.min_days) ? value.min_days : null;
	const max = Number.isFinite(value.max_days) ? value.max_days : null;
	if (min === null && max === null) return null;
	if (min !== null && max !== null) return min === max ? `${min}` : `${min}–${max}`;
	return min !== null ? `at least ${min}` : `up to ${max}`;
}

function sizeCap(constraints) {
	if (!constraints || typeof constraints !== "object") return null;
	for (const [key, unit] of [
		["system_size_kw_ac_max", "kW AC"],
		["system_size_kw_dc_max", "kW DC"],
		["thermal_capacity_kw_max", "kW thermal"],
	]) {
		if (Number.isFinite(constraints[key])) return { value: constraints[key], unit, field: key };
	}
	return null;
}

function isMultiAuthorityInspection(steps) {
	if (!Array.isArray(steps)) return false;
	const text = steps.join(" ");
	return /\b(?:utility|SCE|SDG&E|LADWP|PG&E|interconnection|energize)\b/i.test(text) &&
		/\b(?:city|permit|inspection|final approval|notified)\b/i.test(text);
}

function usableProgramSignals(record) {
	return extractProgramSignals(record).filter(
		(signal) => signal.evidence_class === "structured_value" && !signal.negated,
	);
}

function outreachSafeConstraints(record) {
	if (!hasSourcedValue(record, "eligibility_constraints")) return null;
	const value = record.eligibility_constraints.value;
	if (!value || typeof value !== "object") return value;
	return {
		...value,
		other_conditions: Array.isArray(value.other_conditions)
			? value.other_conditions.filter((condition) => !NEGATION_PATTERN.test(condition))
			: value.other_conditions,
	};
}

function priorityFreshnessFraction(ageDays) {
	if (ageDays <= 30) return 1;
	if (ageDays <= 90) return 0.8;
	if (ageDays <= 180) return 0.5;
	return 0;
}

function round2(value) {
	return Math.round(value * 100) / 100;
}

function buildPriorityRecommendation({ angleCandidates, completenessPct, validationScore, outreachAngles, lowConfidenceAngleCount, freshnessAgeDays }) {
	const components = {
		supported_local_evidence: round2(Math.min(angleCandidates.length / 8, 1) * ACQUISITION_PRIORITY_WEIGHTS.supported_local_evidence),
		data_completeness: round2((completenessPct / 100) * ACQUISITION_PRIORITY_WEIGHTS.data_completeness),
		validation_quality: round2((Math.max(0, Math.min(validationScore, 100)) / 100) * ACQUISITION_PRIORITY_WEIGHTS.validation_quality),
		selected_angle_confidence: outreachAngles.length < 2
			? 0
			: round2((1 - lowConfidenceAngleCount / outreachAngles.length) * ACQUISITION_PRIORITY_WEIGHTS.selected_angle_confidence),
		freshness: round2(priorityFreshnessFraction(freshnessAgeDays) * ACQUISITION_PRIORITY_WEIGHTS.freshness),
	};
	const score = round2(Object.values(components).reduce((sum, value) => sum + value, 0));
	return {
		score,
		band: score >= 80 ? "HIGH" : score >= 65 ? "MEDIUM" : "LOW",
		components,
		explanation: `Local evidence ${components.supported_local_evidence}/${ACQUISITION_PRIORITY_WEIGHTS.supported_local_evidence}; completeness ${components.data_completeness}/${ACQUISITION_PRIORITY_WEIGHTS.data_completeness}; validation ${components.validation_quality}/${ACQUISITION_PRIORITY_WEIGHTS.validation_quality}; selected-angle confidence ${components.selected_angle_confidence}/${ACQUISITION_PRIORITY_WEIGHTS.selected_angle_confidence}; freshness ${components.freshness}/${ACQUISITION_PRIORITY_WEIGHTS.freshness}. No traffic, search-volume, conversion, or revenue metric was used.`,
	};
}

function buildAngleCandidates(record) {
	const city = record.city.value;
	const constraints = hasSourcedValue(record, "eligibility_constraints") ? record.eligibility_constraints.value : null;
	const pathway = typeof constraints?.program_or_pathway === "string" ? constraints.program_or_pathway : null;
	const signals = usableProgramSignals(record);
	const pathwaySignal = pathway && (PROGRAM_SIGNAL_PATTERN.test(pathway) || signals.some((signal) => signal.path.startsWith("eligibility_constraints.value")));
	const cap = sizeCap(constraints);
	const timeline = hasSourcedValue(record, "timeline_days") ? numericTimeline(record.timeline_days.value) : null;
	const candidates = [];

	if (pathwaySignal) {
		const pathwayText = pathway.length <= 120
			? `${city}: lead with the locally documented permit pathway, “${pathway},” for residential project teams.`
			: `${city}: lead with the locally documented permit-pathway details for residential project teams; the exact sourced label is preserved in the grounding.`;
		candidates.push({
			angle_type: "documented_permit_pathway",
			text: pathwayText,
			grounded_in: [grounding(record, "eligibility_constraints", pathway)],
		});
	}
	if (cap) {
		candidates.push({
			angle_type: "documented_size_cap",
			text: `${city}: share the sourced ${cap.value} ${cap.unit} pathway limit so installers can quickly judge whether the guide fits a project.`,
			grounded_in: [grounding(record, "eligibility_constraints", { [cap.field]: cap.value })],
		});
	}
	if (timeline) {
		candidates.push({
			angle_type: "documented_timeline",
			text: `${city}: use the local record’s sourced ${timeline}-day review range as a practical planning reference.`,
			grounded_in: [grounding(record, "timeline_days")],
		});
	}
	if (hasSourcedValue(record, "battery_programs") && record.battery_programs.value.length > 0) {
		const names = record.battery_programs.value.map((program) => program.name);
		candidates.push({
			angle_type: "battery_program_reference",
			text: `${city}: offer the guide as a fact-checking reference for locally documented battery-program criteria alongside the permit workflow.`,
			grounded_in: [grounding(record, "battery_programs", names)],
		});
	}
	if (hasSourcedValue(record, "inspection_steps") && isMultiAuthorityInspection(record.inspection_steps.value)) {
		candidates.push({
			angle_type: "multi_authority_inspection",
			text: `${city}: highlight the sourced inspection-to-utility sequence for teams coordinating permit closeout and energization.`,
			grounded_in: [grounding(record, "inspection_steps")],
		});
	}
	if (hasSourcedValue(record, "required_documents") && record.required_documents.value.length > 0) {
		candidates.push({
			angle_type: "submittal_checklist",
			text: `${city}: share the guide’s sourced ${record.required_documents.value.length}-item submittal checklist with teams preparing residential solar packages.`,
			grounded_in: [grounding(record, "required_documents", record.required_documents.value.map((item) => item.name))],
		});
	}
	if (hasSourcedValue(record, "permit_fees") && record.permit_fees.value.length > 0) {
		candidates.push({
			angle_type: "fee_schedule",
			text: `${city}: point estimators to the locally sourced permit-fee entries before they finalize project assumptions.`,
			grounded_in: [grounding(record, "permit_fees")],
		});
	}
	if (hasSourcedValue(record, "interconnection_url")) {
		candidates.push({
			angle_type: "interconnection_route",
			text: `${city}: pair the permit guide with its sourced utility interconnection route for a more complete project handoff.`,
			grounded_in: [grounding(record, "interconnection_url")],
		});
	}

	for (const candidate of candidates) assertNoProhibitedClaims([candidate.text]);
	return candidates.map((candidate) => {
		const needsReview = candidate.grounded_in.some((item) => item.confidence < 0.7);
		return { ...candidate, low_confidence_review_required: needsReview };
	});
}

function targetType(record, angleCandidates) {
	if (angleCandidates.some((angle) => angle.angle_type === "documented_permit_pathway")) {
		return {
			type: "high_volume_residential_installer",
			basis: "A sourced streamlined or named residential permit pathway is available locally.",
		};
	}
	if (hasSourcedValue(record, "battery_programs") && record.battery_programs.value.length > 0) {
		return {
			type: "solar_plus_storage_installer",
			basis: "The local record contains a sourced battery-program entry.",
		};
	}
	if (hasSourcedValue(record, "inspection_steps") && isMultiAuthorityInspection(record.inspection_steps.value)) {
		return {
			type: "local_ahj_specialist_installer",
			basis: "The local record documents a multi-authority inspection or approval sequence.",
		};
	}
	if (hasSourcedValue(record, "timeline_days") && numericTimeline(record.timeline_days.value)) {
		return {
			type: "residential_rooftop_installer",
			basis: "The local record contains a sourced numeric review timeline.",
		};
	}
	return {
		type: "permit_expediter_or_local_resource",
		basis: "The available local evidence is better suited to permit-process reference outreach.",
	};
}

function eligibilityExclusionReason(partnerEligibility) {
	if (!partnerEligibility.local_gates_passed && !partnerEligibility.production_verified) {
		return "One or more local fail-closed gates did not pass, and the city is not in the production-verified positive route set.";
	}
	if (!partnerEligibility.local_gates_passed) {
		return "One or more local fail-closed gates did not pass.";
	}
	return "The city is not in the production-verified positive route set.";
}

export function buildLocalityCandidate(item, options) {
	const { record, validation, pageExists, pagePath } = item;
	const citySlug = normalizeCitySlug(record.city?.value);
	const localEligible = passesLocalCompareSolarGates({
		state: record.state,
		city: record.city?.value,
		pageExists,
		allowlist: options.allowlist,
		partnerStatus: options.partnerStatus,
	});
	const productionVerified = options.productionVerified.has(citySlug);
	const presentedEligible = isCompareSolarRouteEligible({
		state: record.state,
		city: record.city?.value,
		pageExists,
		allowlist: options.allowlist,
		productionVerified: options.productionVerified,
		partnerStatus: options.partnerStatus,
	});
	const completeness = calculateCompleteness(record);
	const angleCandidates = buildAngleCandidates(record);
	const outreachAngles = angleCandidates.slice(0, 2);
	const lowConfidenceAngleCount = outreachAngles.filter((angle) => angle.low_confidence_review_required).length;
	const idealTarget = targetType(record, angleCandidates);
	assertNoProhibitedClaims([idealTarget.basis]);
	const programSignals = extractProgramSignals(record);
	const usableSignals = programSignals.filter((signal) => signal.evidence_class === "structured_value" && !signal.negated);
	const freshnessAgeDays = ageInDays(record.last_verified, options.asOf);
	const validationScore = Number(validation?.score ?? 0);
	const priorityRecommendation = buildPriorityRecommendation({
		angleCandidates,
		completenessPct: completeness.completeness_pct,
		validationScore,
		outreachAngles,
		lowConfidenceAngleCount,
		freshnessAgeDays,
	});

	return {
		record_id: record.record_id,
		city: record.city?.value ?? null,
		state: record.state,
		city_slug: citySlug,
		guide_path: pagePath,
		local_page_exists: pageExists,
		last_verified: record.last_verified,
		freshness_age_days: freshnessAgeDays,
		validation_status: validation?.status ?? "MISSING",
		validation_score: validationScore,
		validation_error_count: Array.isArray(validation?.errors) ? validation.errors.length : 0,
		validation_warning_count: Array.isArray(validation?.warnings) ? validation.warnings.length : 0,
		completeness_pct: completeness.completeness_pct,
		populated_fields: completeness.populated_fields,
		partner_eligibility: {
			partner_id: "compare-solar-prices",
			presented_eligible: presentedEligible,
			local_gates_passed: localEligible,
			production_verified: productionVerified,
			verified_deploy_id: options.verifiedDeployId,
		},
		facts: {
			permit_pathway: fact(record, "eligibility_constraints", outreachSafeConstraints(record)),
			solarapp_plus: {
				available: usableSignals.some((signal) => /solarapp\+?/i.test(signal.text)),
				usable_signals: usableSignals.filter((signal) => /solarapp\+?/i.test(signal.text)),
				review_only_signals: programSignals.filter((signal) => /solarapp\+?/i.test(signal.text) && (signal.evidence_class !== "structured_value" || signal.negated)),
			},
			inspection: fact(record, "inspection_steps"),
			battery: fact(record, "battery_programs"),
		},
		ideal_target: idealTarget,
		outreach_angles: outreachAngles,
		outreach_confidence: outreachAngles.length < 2
			? "insufficient"
			: lowConfidenceAngleCount > 0
				? "human_review_required"
				: "source_grounded",
		priority_basis: {
			supported_angle_type_count: angleCandidates.length,
			source_grounded_selected_angle_count: outreachAngles.length,
			low_confidence_selected_angle_count: lowConfidenceAngleCount,
			completeness_pct: completeness.completeness_pct,
			validation_score: validationScore,
		},
		priority_recommendation: priorityRecommendation,
		search_metrics: {
			source_file: null,
			gsc_clicks: null,
			gsc_impressions: null,
			gsc_queries: null,
		},
		missing_fields: completeness.missing_fields,
		low_confidence_fields: COVERAGE_FIELDS.filter(
			(field) => hasSourcedValue(record, field) && Number(record[field].confidence) < 0.7,
		),
	};
}

export function rankEligibleLocalities(candidates) {
	const rows = candidates
		.filter((row) => row.partner_eligibility.presented_eligible && row.outreach_angles.length === 2)
		.sort((a, b) =>
			b.priority_recommendation.score - a.priority_recommendation.score ||
			b.priority_basis.supported_angle_type_count - a.priority_basis.supported_angle_type_count ||
			a.priority_basis.low_confidence_selected_angle_count - b.priority_basis.low_confidence_selected_angle_count ||
			b.completeness_pct - a.completeness_pct ||
			b.validation_score - a.validation_score ||
			a.record_id.localeCompare(b.record_id));
	return rows.map((row, index) => ({ outreach_priority_rank: index + 1, ...row }));
}

export function buildDataQualityGaps(candidates, productionDocument, asOf) {
	const eligible = candidates.filter((row) => row.partner_eligibility.presented_eligible);
	const fieldGaps = DATA_QUALITY_FIELDS.map((field) => ({
		field,
		missing_city_count: eligible.filter((row) => row.missing_fields.includes(field)).length,
		eligible_city_count: eligible.length,
	})).filter((row) => row.missing_city_count > 0)
		.sort((a, b) => b.missing_city_count - a.missing_city_count || a.field.localeCompare(b.field));
	const localityGaps = eligible
		.filter((row) => row.missing_fields.some((field) => DATA_QUALITY_FIELDS.includes(field)) || row.low_confidence_fields.length > 0 || row.outreach_confidence !== "source_grounded")
		.map((row) => ({
			record_id: row.record_id,
			city_slug: row.city_slug,
			guide_path: row.guide_path,
			missing_confidence_fields: row.missing_fields.filter((field) => DATA_QUALITY_FIELDS.includes(field)),
			low_confidence_fields: row.low_confidence_fields,
			outreach_confidence: row.outreach_confidence,
			last_verified: row.last_verified,
			freshness_age_days: row.freshness_age_days,
		}));
	const excluded = candidates
		.filter((row) => !row.partner_eligibility.presented_eligible)
		.map((row) => ({
			city_slug: row.city_slug,
			record_id: row.record_id,
			local_gates_passed: row.partner_eligibility.local_gates_passed,
			production_verified: row.partner_eligibility.production_verified,
			reason: eligibilityExclusionReason(row.partner_eligibility),
		}));

	return {
		as_of: asOf,
		field_gaps: fieldGaps,
		locality_gaps: localityGaps,
		allowlisted_but_not_deployed: productionDocument.allowlisted_but_not_deployed.map((citySlug) => ({
			city_slug: citySlug,
			compare_solar_prices_eligible: false,
			reason: "Allowlisted locally but absent from the production-verified deployed-guide set.",
		})),
		global_gaps: [
			{
				id: "production_source_unreconciled",
				detail: "The production commit is absent locally, so local source cannot reproduce the verified production deployment.",
				impact: "Eligibility must remain pinned to the audited deploy set rather than inferred from local page existence.",
			},
			{
				id: "production_content_divergence",
				detail: "The local recovery manifest records 351 production HTML files differing from the synthetic local activation build.",
				impact: "Local facts can ground outreach, but claims about the exact live-page copy require post-reconciliation verification.",
			},
		],
		excluded_local_candidate_count: excluded.length,
		excluded_local_candidates: excluded,
	};
}

export function buildDeferredSeoOpportunities(eligibleRows) {
	const blocker = "Deferred until GitHub reconciliation because local source cannot reproduce the verified production deployment and production HTML materially differs.";
	const definitions = [
		{
			id: "permit_pathway_title_specificity",
			artifact: "title",
			grounded_field: "eligibility_constraints.value.program_or_pathway",
			predicate: (row) => row.facts.permit_pathway.available,
			direction: "Evaluate whether a verified named permit pathway belongs in the locality title without implying speed beyond the source.",
		},
		{
			id: "numeric_timeline_meta_specificity",
			artifact: "meta_description",
			grounded_field: "timeline_days.value",
			predicate: (row) => row.outreach_angles.some((angle) => angle.angle_type === "documented_timeline"),
			direction: "Evaluate a sourced numeric review-range mention with the correct scope and units.",
		},
		{
			id: "inspection_sequence_meta_specificity",
			artifact: "meta_description",
			grounded_field: "inspection_steps.value",
			predicate: (row) => row.facts.inspection.available,
			direction: "Evaluate whether distinctive inspection or utility handoff steps improve locality-specific description copy.",
		},
		{
			id: "battery_context_meta_specificity",
			artifact: "meta_description",
			grounded_field: "battery_programs.value",
			predicate: (row) => row.facts.battery.available,
			direction: "Evaluate battery-program context only after current status and production copy are reverified.",
		},
	];
	return definitions.map(({ predicate, ...definition }) => {
		const rows = eligibleRows.filter(predicate);
		return {
			...definition,
			executable_now: false,
			blocking_reason: blocker,
			candidate_count: rows.length,
			candidate_guide_paths: rows.map((row) => row.guide_path),
		};
	});
}
