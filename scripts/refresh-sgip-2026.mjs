import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const CHECK_ONLY = process.argv.includes("--check");

const HANDBOOK_SOURCE = {
  id: "SGIP_HANDBOOK_2026",
  title: "2026 Self-Generation Incentive Program Handbook",
  url: "https://www.selfgenca.com/documents/handbook/2026",
  publisher: "Self-Generation Incentive Program Program Administrators",
  type: "program_administrator",
  accessed_date: "2026-08-26",
};

const METRICS_SOURCE = {
  id: "SGIP_METRICS_2026",
  title: "SGIP Program Metrics and Incentive Step Tracker",
  url: "https://www.selfgenca.com/home/program_metrics/",
  publisher: "Self-Generation Incentive Program Program Administrators",
  type: "program_administrator",
  accessed_date: "2026-08-26",
};

const CURRENT_SGIP_PROGRAM = {
  name: "California SGIP - current category and budget check required",
  administrator: "Applicable SGIP Program Administrator",
  description:
    "New applications and waitlist applications for ratepayer-funded SGIP budgets closed on December 30, 2025. New AB 209 applications have a June 30, 2028 deadline. The 2026 SGIP rate table publishes $3.10/W for solar and $1.10/Wh for storage in applicable Residential Solar and Storage Equity categories. Household eligibility and live budget availability vary by category and program administrator; check the official Program Metrics tracker before relying on an incentive.",
  value_usd_per_kwh: 1100,
  value_usd_flat: null,
  value_usd_per_watt: 3.1,
  eligibility:
    "Eligibility varies by 2026 SGIP budget category, program administrator, property, income/pathway, project rules, and live funding availability.",
  url: METRICS_SOURCE.url,
  effective_from: null,
  expires_on: null,
  status: "unknown",
};

const STALE_PATTERNS = [
  /\$1,100\/kWh/i,
  /\$3,100\/kW/i,
  /opened for reservations June 2, 2025/i,
  /available through 2025/i,
  /\$280 million CPUC-authorized budget/i,
];

function isSgip(program) {
  return typeof program?.name === "string" && /\bSGIP\b/i.test(program.name);
}

function upsertSource(sources, source) {
  const index = sources.findIndex((candidate) => candidate.id === source.id);
  if (index >= 0) sources[index] = source;
  else sources.push(source);
}

function normalizeRecord(record) {
  const programs = record?.battery_programs?.value;
  if (record?.state !== "CA" || !Array.isArray(programs) || !programs.some(isSgip)) return false;

  const nonSgipPrograms = programs.filter((program) => !isSgip(program));
  record.battery_programs.value = [...nonSgipPrograms, CURRENT_SGIP_PROGRAM];
  record.battery_programs.confidence = Math.max(record.battery_programs.confidence ?? 0, 0.9);
  record.battery_programs.source_ids = [
    ...new Set([
      ...(record.battery_programs.source_ids ?? []),
      HANDBOOK_SOURCE.id,
      METRICS_SOURCE.id,
    ]),
  ];
  record.battery_programs.notes =
    "SGIP program data refreshed on 2026-08-26 from the official 2026 Handbook and live Program Metrics. Earlier locality records contained 2025 opening/availability language. This record does not assert household eligibility, reservation availability, or a guaranteed incentive; current category and program-administrator status must be checked before reliance.";

  if (!Array.isArray(record.sources)) record.sources = [];
  upsertSource(record.sources, HANDBOOK_SOURCE);
  upsertSource(record.sources, METRICS_SOURCE);
  return true;
}

function assertCurrent(record, filename, errors) {
  const programs = record?.battery_programs?.value;
  if (record?.state !== "CA" || !Array.isArray(programs) || !programs.some(isSgip)) return;

  const sgipPrograms = programs.filter(isSgip);
  if (sgipPrograms.length !== 1) {
    errors.push(`${filename}: expected exactly one normalized SGIP item, found ${sgipPrograms.length}`);
  }

  const searchable = JSON.stringify({ programs: sgipPrograms, notes: record.battery_programs.notes ?? "" });
  for (const pattern of STALE_PATTERNS) {
    if (pattern.test(searchable)) errors.push(`${filename}: stale SGIP wording matched ${pattern}`);
  }

  const normalized = sgipPrograms[0];
  if (normalized?.name !== CURRENT_SGIP_PROGRAM.name) {
    errors.push(`${filename}: SGIP item is not the current normalized 2026 summary`);
  }
  if (normalized?.status !== "unknown") {
    errors.push(`${filename}: SGIP status must remain unknown because live availability is dynamic`);
  }
  if (normalized?.url !== METRICS_SOURCE.url) {
    errors.push(`${filename}: SGIP item must link to the official live Program Metrics tracker`);
  }

  const sourceIds = new Set(record.battery_programs.source_ids ?? []);
  for (const requiredId of [HANDBOOK_SOURCE.id, METRICS_SOURCE.id]) {
    if (!sourceIds.has(requiredId)) errors.push(`${filename}: battery_programs.source_ids missing ${requiredId}`);
    if (!record.sources?.some((source) => source.id === requiredId)) {
      errors.push(`${filename}: sources registry missing ${requiredId}`);
    }
  }
}

const files = readdirSync(LOCALITIES_DIR).filter((filename) => filename.endsWith(".json")).sort();
const errors = [];
let affected = 0;
let changed = 0;

for (const filename of files) {
  const filePath = path.join(LOCALITIES_DIR, filename);
  const original = readFileSync(filePath, "utf8");
  const record = JSON.parse(original);

  if (CHECK_ONLY) {
    if (record?.state === "CA" && Array.isArray(record?.battery_programs?.value) && record.battery_programs.value.some(isSgip)) {
      affected += 1;
    }
    assertCurrent(record, filename, errors);
    continue;
  }

  if (!normalizeRecord(record)) continue;
  affected += 1;
  const next = `${JSON.stringify(record, null, 2)}\n`;
  if (next !== original) {
    writeFileSync(filePath, next);
    changed += 1;
  }
}

if (CHECK_ONLY) {
  if (errors.length > 0) {
    console.error(`SGIP freshness check failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`SGIP freshness check passed for ${affected} California locality record(s).`);
} else {
  console.log(`Normalized SGIP data in ${changed} of ${affected} affected California locality record(s).`);
}
