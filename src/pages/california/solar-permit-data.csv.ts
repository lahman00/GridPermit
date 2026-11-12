// CSV download for /california/solar-permit-data/. Built from the same rows
// as the page (src/lib/permit-data-study.ts), so the two always agree.
import type { LocalityRecord } from "../../lib/locality-guide.ts";
import { buildPermitDataRows, permitDataCsv } from "../../lib/permit-data-study.ts";
import { buildCecCityIndex, type CecDataset } from "../../lib/cec-status.ts";
import cecData from "../../../data/cec/residential-solar-permitting-status-2026-11-02.json";

const localityModules = import.meta.glob("../../../data/localities/*.json", { eager: true }) as Record<
	string,
	{ default: LocalityRecord & { record_id: string } }
>;
const evaluationModules = import.meta.glob("../../../output/*-evaluation.json", { eager: true }) as Record<
	string,
	{ default: { records: Array<{ record_id: string; readiness: string; completeness_pct: number }> } }
>;

export function GET() {
	const recordsById = new Map(Object.values(localityModules).map((mod) => [mod.default.record_id, mod.default]));
	const evaluated = Object.values(evaluationModules).flatMap((mod) => mod.default.records);
	const csv = permitDataCsv(buildPermitDataRows(evaluated, recordsById, "CA", buildCecCityIndex(cecData as CecDataset)));
	return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
