import { assertNoProhibitedClaims } from "./acquisition-pack.mjs";
import {
	COVERAGE_FIELDS,
	ageInDays,
	calculateCompleteness,
	classifyReadiness,
	normalizeCitySlug,
} from "./revenue-intelligence.mjs";

export const READY_COMPLETENESS_PCT = 80;
export const READY_VALIDATION_SCORE = 85;
export const READY_POPULATED_FIELD_COUNT = 12;

export const SUPPRESSION_KIND_PRECEDENCE = Object.freeze([
	"validation_error_gate",
	"data_completeness_gate",
	"validation_score_gate",
	"stale_evaluation",
	"unpublished_ready_record",
]);

function unlockClass(fieldsNeeded) {
	if (fieldsNeeded === 1) return "single_field";
	if (fieldsNeeded >= 2 && fieldsNeeded <= 3) return "small_gap";
	if (fieldsNeeded >= 4) return "large_gap";
	return "non_field_gate";
}

function suppressionCauses({ recordedReadiness, recomputedReadiness, completenessPct, validationScore, errorCount, evaluationStale, pageExists }) {
	if (pageExists) return [];
	const causes = [];
	if (errorCount > 0) causes.push("validation_error_gate");
	if (completenessPct < READY_COMPLETENESS_PCT) causes.push("data_completeness_gate");
	if (validationScore < READY_VALIDATION_SCORE) causes.push("validation_score_gate");
	if (evaluationStale) causes.push("stale_evaluation");
	if (recordedReadiness === "READY" && recomputedReadiness === "READY") causes.push("unpublished_ready_record");
	return SUPPRESSION_KIND_PRECEDENCE.filter((kind) => causes.includes(kind));
}

function unlockAction(row) {
	switch (row.primary_suppression_kind) {
		case "validation_error_gate":
			return `Resolve ${row.recomputed_readiness.validation_error_count} validation error(s), then re-run validation and the owning batch evaluation before generating the guide page.`;
		case "data_completeness_gate":
			return `Research and source at least ${row.fields_needed_to_publish} of these missing fields: ${row.missing_fields.join(", ")}; then re-run validation and the owning batch evaluation.`;
		case "validation_score_gate":
			return `Raise the validation score from ${row.recomputed_readiness.validation_score} to at least ${READY_VALIDATION_SCORE}, then re-run the owning batch evaluation before generating the guide page.`;
		case "stale_evaluation":
			return "Re-run the owning batch evaluation to record the current READY result, then generate and verify the guide page.";
		case "unpublished_ready_record":
			return "Generate the READY locality guide page and verify that its expected route exists locally.";
		default:
			throw new Error(`No unlock action for suppression kind ${JSON.stringify(row.primary_suppression_kind)}`);
	}
}

export function buildDistributionRecord(item, { allowlist, productionVerified, asOf }) {
	const { record, validation, recordedEvaluation, pageExists, pagePath, pageFile } = item;
	const completeness = calculateCompleteness(record);
	const validationScore = Number(validation?.score ?? 0);
	const errorCount = Array.isArray(validation?.errors) ? validation.errors.length : 0;
	const warningCount = Array.isArray(validation?.warnings) ? validation.warnings.length : 0;
	const recomputedReadiness = classifyReadiness({
		completenessPct: completeness.completeness_pct,
		validationScore,
		errorCount,
	});
	const recordedReadiness = recordedEvaluation?.readiness ?? null;
	const recordedCompletenessPct = recordedEvaluation?.completeness_pct ?? null;
	const recordedValidationScore = recordedEvaluation?.validation_score ?? null;
	const statusChanged = recordedReadiness !== recomputedReadiness;
	const completenessChanged = recordedCompletenessPct !== completeness.completeness_pct;
	const scoreChanged = recordedValidationScore !== validationScore;
	const evaluationStale = statusChanged || completenessChanged || scoreChanged;
	const fieldsNeeded = Math.max(0, READY_POPULATED_FIELD_COUNT - completeness.populated_fields.length);
	const causes = suppressionCauses({
		recordedReadiness,
		recomputedReadiness,
		completenessPct: completeness.completeness_pct,
		validationScore,
		errorCount,
		evaluationStale,
		pageExists,
	});
	const citySlug = normalizeCitySlug(record.city?.value);
	const row = {
		record_id: record.record_id,
		city: record.city?.value ?? null,
		city_slug: citySlug,
		state: record.state,
		published: pageExists,
		suppressed: !pageExists,
		page_exists: pageExists,
		recorded_readiness: {
			status: recordedReadiness,
			evaluation_file: recordedEvaluation?.evaluation_file ?? null,
			completeness_pct: recordedCompletenessPct,
			validation_score: recordedValidationScore,
			error_count: recordedEvaluation?.error_count ?? null,
		},
		recomputed_readiness: {
			status: recomputedReadiness,
			completeness_pct: completeness.completeness_pct,
			populated_field_count: completeness.populated_fields.length,
			validation_score: validationScore,
			validation_status: validation?.status ?? "MISSING",
			validation_error_count: errorCount,
			validation_warning_count: warningCount,
			validation_report_exists: item.validationReportExists === true,
		},
		page_signal: {
			exists: pageExists,
			path: pagePath,
			file: pageFile,
		},
		readiness_disagreement: statusChanged,
		evaluation_drift: {
			stale: evaluationStale,
			status_changed: statusChanged,
			completeness_changed: completenessChanged,
			score_changed: scoreChanged,
			recorded_completeness_pct: recordedCompletenessPct,
			recorded_validation_score: recordedValidationScore,
		},
		populated_fields: completeness.populated_fields,
		missing_fields: completeness.missing_fields,
		fields_needed_to_publish: fieldsNeeded,
		unlock_class: unlockClass(fieldsNeeded),
		primary_suppression_kind: causes[0] ?? null,
		suppression_causes: causes,
		unlock_action: null,
		compare_solar_allowlisted: record.state === "CA" && allowlist.has(citySlug),
		compare_solar_production_verified: record.state === "CA" && productionVerified.has(citySlug),
		last_verified: record.last_verified,
		freshness_age_days: ageInDays(record.last_verified, asOf),
	};

	if (row.suppressed) {
		if (row.suppression_causes.length === 0) {
			throw new Error(`${row.record_id}: unpublished record has no suppression cause`);
		}
		row.unlock_action = unlockAction(row);
		assertNoProhibitedClaims([row.unlock_action]);
	}
	return row;
}

export function rankSuppressedRows(rows) {
	return rows
		.filter((row) => row.suppressed)
		.sort(
			(a, b) =>
				a.fields_needed_to_publish - b.fields_needed_to_publish ||
				Number(b.compare_solar_allowlisted) - Number(a.compare_solar_allowlisted) ||
				b.recomputed_readiness.completeness_pct - a.recomputed_readiness.completeness_pct ||
				b.recomputed_readiness.validation_score - a.recomputed_readiness.validation_score ||
				a.record_id.localeCompare(b.record_id),
		)
		.map((row, index) => ({ suppression_rank: index + 1, ...row }));
}

function stateRollup(rows) {
	const byState = new Map();
	for (const row of rows) {
		const current = byState.get(row.state) ?? {
			state: row.state,
			record_count: 0,
			published_route_count: 0,
			suppressed_record_count: 0,
			zero_published_routes: false,
		};
		current.record_count += 1;
		current.published_route_count += Number(row.published);
		current.suppressed_record_count += Number(row.suppressed);
		byState.set(row.state, current);
	}
	return [...byState.values()]
		.map((row) => ({ ...row, zero_published_routes: row.published_route_count === 0 }))
		.sort((a, b) => a.state.localeCompare(b.state));
}

function blockingFieldRollup(suppressedRows) {
	const counts = new Map(COVERAGE_FIELDS.map((field) => [field, 0]));
	for (const row of suppressedRows) {
		if (!row.suppression_causes.includes("data_completeness_gate")) continue;
		for (const field of row.missing_fields) counts.set(field, counts.get(field) + 1);
	}
	return [...counts]
		.filter(([, count]) => count > 0)
		.map(([field, suppressed_record_count]) => ({ field, suppressed_record_count }))
		.sort((a, b) => b.suppressed_record_count - a.suppressed_record_count || a.field.localeCompare(b.field));
}

export function buildDistributionSuppressionReport(items, options) {
	const records = items
		.map((item) => buildDistributionRecord(item, options))
		.sort((a, b) => a.record_id.localeCompare(b.record_id));
	const suppressedRows = rankSuppressedRows(records);
	const publishedCount = records.filter((row) => row.published).length;
	if (publishedCount + suppressedRows.length !== records.length) {
		throw new Error("distribution invariant failed: published + suppressed must equal record count");
	}
	for (const row of suppressedRows) {
		if (row.page_signal.exists || !row.unlock_action) {
			throw new Error(`${row.record_id}: suppressed rows require page_exists=false and a non-empty unlock action`);
		}
	}

	const states = stateRollup(records);
	return {
		summary: {
			record_count: records.length,
			published_route_count: publishedCount,
			suppressed_record_count: suppressedRows.length,
			recorded_ready_count: records.filter((row) => row.recorded_readiness.status === "READY").length,
			recorded_limited_count: records.filter((row) => row.recorded_readiness.status === "LIMITED").length,
			recorded_not_ready_count: records.filter((row) => row.recorded_readiness.status === "NOT_READY").length,
			recomputed_ready_count: records.filter((row) => row.recomputed_readiness.status === "READY").length,
			recomputed_limited_count: records.filter((row) => row.recomputed_readiness.status === "LIMITED").length,
			recomputed_not_ready_count: records.filter((row) => row.recomputed_readiness.status === "NOT_READY").length,
			readiness_disagreement_count: records.filter((row) => row.readiness_disagreement).length,
			published_readiness_disagreement_count: records.filter((row) => row.published && row.readiness_disagreement).length,
			evaluation_stale_count: records.filter((row) => row.evaluation_drift.stale).length,
			published_evaluation_stale_count: records.filter((row) => row.published && row.evaluation_drift.stale).length,
			suppressed_evaluation_stale_count: records.filter((row) => row.suppressed && row.evaluation_drift.stale).length,
			zero_published_route_state_count: states.filter((row) => row.zero_published_routes).length,
			states,
			blocking_fields: blockingFieldRollup(suppressedRows),
		},
		records,
		suppressed_rows: suppressedRows,
	};
}
