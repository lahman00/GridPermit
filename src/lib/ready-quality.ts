export const READY_CORE_FIELDS = [
	"permit_authority",
	"utility",
	"timeline_days",
	"permit_fees",
	"inspection_steps",
	"required_documents",
] as const;

export const READY_QUALITY_POLICY = Object.freeze({
	maxMissingCoreFields: 1,
	minPopulatedCoreConfidence: 0.5,
	noindexReviewMissingCoreFields: 3,
	noindexReviewConfidenceBelow: 0.3,
});

interface ReadyCoreField {
	value: unknown;
	confidence?: number | null;
	source_ids?: string[] | null;
}

type ReadyQualityRecord = Partial<Record<(typeof READY_CORE_FIELDS)[number], ReadyCoreField>>;

function populated(field: ReadyCoreField | undefined) {
	return field?.value !== null && field?.value !== undefined;
}

export function assessReadyCoreQuality(record: ReadyQualityRecord) {
	const missingCoreFields = READY_CORE_FIELDS.filter((name) => !populated(record[name]));
	const populatedCoreFields = READY_CORE_FIELDS.filter((name) => populated(record[name]));
	const lowConfidenceCoreFields = populatedCoreFields.filter((name) => {
		const confidence = record[name]?.confidence;
		return !Number.isFinite(confidence) || Number(confidence) < READY_QUALITY_POLICY.minPopulatedCoreConfidence;
	});
	const missingSourceCoreFields = populatedCoreFields.filter(
		(name) => !Array.isArray(record[name]?.source_ids) || record[name].source_ids.length === 0,
	);
	const verifiedCoreFields = populatedCoreFields.filter(
		(name) => !lowConfidenceCoreFields.includes(name) && !missingSourceCoreFields.includes(name),
	);
	const populatedConfidences = populatedCoreFields
		.map((name) => record[name]?.confidence)
		.filter((confidence): confidence is number => Number.isFinite(confidence));
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
		verifiedCoreFields,
		verifiedCoreCount: verifiedCoreFields.length,
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
