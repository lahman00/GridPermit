export const READY_CORE_FIELDS = Object.freeze([
	"permit_authority",
	"utility",
	"timeline_days",
	"permit_fees",
	"inspection_steps",
	"required_documents",
]);

export const READY_QUALITY_POLICY = Object.freeze({
	maxMissingCoreFields: 1,
	minPopulatedCoreConfidence: 0.5,
	noindexReviewMissingCoreFields: 3,
	noindexReviewConfidenceBelow: 0.3,
});

function populated(field) {
	return field?.value !== null && field?.value !== undefined;
}
export function assessReadyCoreQuality(record) {
	const missingCoreFields = READY_CORE_FIELDS.filter((name) => !populated(record[name]));
	const populatedCoreFields = READY_CORE_FIELDS.filter((name) => populated(record[name]));
	const lowConfidenceCoreFields = populatedCoreFields.filter(
		(name) => !Number.isFinite(record[name]?.confidence) || record[name].confidence < READY_QUALITY_POLICY.minPopulatedCoreConfidence,
	);
	const missingSourceCoreFields = populatedCoreFields.filter(
		(name) => !Array.isArray(record[name]?.source_ids) || record[name].source_ids.length === 0,
	);
	const populatedConfidences = populatedCoreFields
		.map((name) => record[name]?.confidence)
		.filter(Number.isFinite);
	const minimumPopulatedCoreConfidence = populatedConfidences.length
		? Math.min(...populatedConfidences)
		: null;
	const passesReadyQualityGate =
		missingCoreFields.length <= READY_QUALITY_POLICY.maxMissingCoreFields &&
		lowConfidenceCoreFields.length === 0 &&
		missingSourceCoreFields.length === 0;
	const reviewForNoindex =
		missingCoreFields.length >= READY_QUALITY_POLICY.noindexReviewMissingCoreFields ||
		(minimumPopulatedCoreConfidence !== null &&
			minimumPopulatedCoreConfidence < READY_QUALITY_POLICY.noindexReviewConfidenceBelow);

	return {
		missingCoreFields,
		missingCoreCount: missingCoreFields.length,
		populatedCoreCount: populatedCoreFields.length,
		minimumPopulatedCoreConfidence,
		lowConfidenceCoreFields,
		missingSourceCoreFields,
		passesReadyQualityGate,
		reviewForNoindex,
		recommendedAction: reviewForNoindex
			? "REVIEW_FOR_NOINDEX"
			: passesReadyQualityGate
				? "KEEP_INDEXED_MONITOR"
				: "COMPLETE_CORE_FACTS_PRIORITY",
	};
}
