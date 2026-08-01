#!/usr/bin/env node
// First Data Consumer: renders one data/localities/*.json record into a
// clean, human-readable Markdown summary — nothing more. Every word in the
// output traces to a value actually present in the record. See
// docs/DATA_ARCHITECTURE.md Section 4 ("the rule every consumer must
// follow") — this renderer is the reference implementation of that rule:
// null stays null, confidence is always shown, and low-confidence /
// unverified data is never dressed up to look more certain than it is.
//
// Usage: node scripts/render-locality-summary.mjs data/localities/<record>.json
// Output: output/rendered/<record>.md

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const OUT_DIR = path.join(REPO_ROOT, "output", "rendered");

const NOT_VERIFIED = "Not yet verified.";
const NONE_CONFIRMED = "Confirmed: none found.";

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function confidenceLabel(confidence) {
  if (typeof confidence !== "number") return "Unknown";
  if (confidence >= 0.8) return `High (${confidence})`;
  if (confidence >= 0.5) return `Medium (${confidence})`;
  if (confidence > 0) return `Low (${confidence})`;
  return `None (${confidence})`;
}

function sourceRefLine(sourceIds, sourcesById) {
  if (!sourceIds || sourceIds.length === 0) return "";
  const parts = sourceIds.map((id) => {
    const s = sourcesById.get(id);
    if (!s) return `${id} (unresolved reference)`;
    return `[${id}](${s.url}) — ${s.title ?? "untitled"} (${s.publisher ?? "unknown publisher"})`;
  });
  return `*Source(s):* ${parts.join("; ")}\n`;
}

function fieldMeta(field, sourcesById) {
  let out = `*Confidence:* ${confidenceLabel(field.confidence)}\n`;
  if (field.notes) out += `*Notes:* ${field.notes}\n`;
  out += sourceRefLine(field.source_ids, sourcesById);
  return out;
}

function renderScalar(label, field, sourcesById) {
  let out = `**${label}:** `;
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  out += `${field.value}\n\n`;
  out += fieldMeta(field, sourcesById);
  return out;
}

function renderGenerationSupplier(field, sourcesById) {
  let out = "";
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  const { name, type, notes } = field.value;
  out += `**Name:** ${name ?? NOT_VERIFIED}\n`;
  out += `**Type:** ${type}\n\n`;
  if (notes) out += `*Value notes:* ${notes}\n`;
  out += fieldMeta(field, sourcesById);
  return out;
}

function renderEligibilityConstraints(field, sourcesById) {
  let out = "";
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  const v = field.value;
  out += `**Property types:** ${v.property_types.length ? v.property_types.join(", ") : NONE_CONFIRMED}\n`;
  out += `**Max system size (AC):** ${v.system_size_kw_ac_max != null ? `${v.system_size_kw_ac_max} kW` : NOT_VERIFIED}\n`;
  out += `**Max system size (DC):** ${v.system_size_kw_dc_max != null ? `${v.system_size_kw_dc_max} kW` : NOT_VERIFIED}\n`;
  out += `**Max thermal capacity:** ${v.thermal_capacity_kw_max != null ? `${v.thermal_capacity_kw_max} kW` : NOT_VERIFIED}\n`;
  out += `**Program/pathway:** ${v.program_or_pathway ?? NOT_VERIFIED}\n`;
  out += `**Other conditions:** ${v.other_conditions.length ? v.other_conditions.join("; ") : NONE_CONFIRMED}\n\n`;
  out += fieldMeta(field, sourcesById);
  return out;
}

function renderRequiredDocuments(field, sourcesById) {
  let out = "";
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  if (field.value.length === 0) {
    out += `${NONE_CONFIRMED}\n\n${fieldMeta(field, sourcesById)}`;
    return out;
  }
  for (const doc of field.value) {
    out += `- **${doc.name}**${doc.required_when ? ` — required when: ${doc.required_when}` : ""}\n`;
    const refs = sourceRefLine(doc.source_ids, sourcesById);
    if (refs) out += `  ${refs}`;
  }
  out += `\n${fieldMeta(field, sourcesById)}`;
  return out;
}

function renderStringArray(label, field, sourcesById) {
  let out = `**${label}:**\n`;
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  if (field.value.length === 0) {
    out += `${NONE_CONFIRMED}\n`;
  } else {
    for (const item of field.value) out += `- ${item}\n`;
  }
  out += `\n${fieldMeta(field, sourcesById)}`;
  return out;
}

function renderTimeline(field, sourcesById) {
  let out = "";
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  const { min_days, max_days, notes } = field.value;
  let range;
  if (min_days != null && max_days != null) range = `${min_days}–${max_days} days`;
  else if (min_days != null) range = `At least ${min_days} days`;
  else if (max_days != null) range = `Up to ${max_days} days`;
  else range = "Range not specified in the record";
  out += `**Range:** ${range}\n\n`;
  if (notes) out += `*Field notes:* ${notes}\n`;
  out += fieldMeta(field, sourcesById);
  return out;
}

function renderPermitFees(field, sourcesById) {
  let out = "";
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  if (field.value.length === 0) {
    out += `${NONE_CONFIRMED}\n\n${fieldMeta(field, sourcesById)}`;
    return out;
  }
  for (const fee of field.value) {
    const amount = fee.amount_usd != null ? `$${fee.amount_usd}${fee.unit ? ` (${fee.unit})` : ""}` : NOT_VERIFIED;
    out += `- **${fee.name}:** ${amount}${fee.notes ? ` — ${fee.notes}` : ""}\n`;
  }
  out += `\n${fieldMeta(field, sourcesById)}`;
  return out;
}

function renderPrograms(field, sourcesById) {
  let out = "";
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  if (field.value.length === 0) {
    out += `${NONE_CONFIRMED}\n\n${fieldMeta(field, sourcesById)}`;
    return out;
  }
  for (const p of field.value) {
    out += `- **${p.name}**`;
    if (p.administrator) out += ` — administered by ${p.administrator}`;
    out += "\n";
    if (p.description) out += `  ${p.description}\n`;
    const values = [];
    if (p.value_usd_per_kwh != null) values.push(`$${p.value_usd_per_kwh}/kWh`);
    if (p.value_usd_flat != null) values.push(`$${p.value_usd_flat} flat`);
    if (p.value_usd_per_watt != null) values.push(`$${p.value_usd_per_watt}/W`);
    if (values.length) out += `  Value: ${values.join(", ")}\n`;
    if (p.eligibility) out += `  Eligibility: ${p.eligibility}\n`;
    if (p.url) out += `  Link: ${p.url}\n`;
    const window = [];
    if (p.effective_from) window.push(`from ${p.effective_from}`);
    if (p.expires_on) window.push(`until ${p.expires_on}`);
    out += `  Status: ${p.status}${window.length ? ` (${window.join(", ")})` : ""}\n`;
  }
  out += `\n${fieldMeta(field, sourcesById)}`;
  return out;
}

function renderContacts(field, sourcesById) {
  let out = "";
  if (!field || field.value === null) {
    out += `${NOT_VERIFIED}\n`;
    return out;
  }
  if (field.value.length === 0) {
    out += `${NONE_CONFIRMED}\n\n${fieldMeta(field, sourcesById)}`;
    return out;
  }
  for (const c of field.value) {
    const label = c.role ?? c.name ?? "Contact";
    const parts = [];
    if (c.name && c.role) parts.push(c.name);
    if (c.phone) parts.push(`phone: ${c.phone}`);
    if (c.email) parts.push(`email: ${c.email}`);
    if (c.url) parts.push(`link: ${c.url}`);
    out += `- **${label}**${parts.length ? ` — ${parts.join(", ")}` : ""}\n`;
  }
  out += `\n${fieldMeta(field, sourcesById)}`;
  return out;
}

function renderSourcesSection(sources) {
  if (!sources || sources.length === 0) {
    return `${NONE_CONFIRMED}\n`;
  }
  let out = "";
  for (const s of sources) {
    out += `- **[${s.id}]** ${s.title ?? "untitled"} — ${s.publisher ?? "unknown publisher"} (${s.type}). ${s.url} — accessed ${s.accessed_date}\n`;
  }
  return out;
}

// Fields eligible for the coverage/completeness count — every researched
// field in the schema, i.e. everything except record-level metadata
// (record_id, schema_version, last_verified, sources).
const COVERAGE_FIELDS = [
  "utility", "generation_supplier", "city", "county", "permit_authority", "permit_url",
  "interconnection_url", "battery_programs", "required_documents",
  "inspection_steps", "timeline_days", "eligibility_constraints", "permit_fees", "rebates",
  "official_contacts",
];

function renderCoverage(record) {
  const populated = [];
  const missing = [];
  for (const fn of COVERAGE_FIELDS) {
    const f = record[fn];
    if (f && f.value !== null) populated.push(fn);
    else missing.push(fn);
  }
  const pct = Math.round((populated.length / COVERAGE_FIELDS.length) * 1000) / 10;

  let out = "";
  out += `- **Populated fields (${populated.length}/${COVERAGE_FIELDS.length}):** ${populated.length ? populated.join(", ") : "none"}\n`;
  out += `- **Missing fields (${missing.length}/${COVERAGE_FIELDS.length}):** ${missing.length ? missing.join(", ") : "none"}\n`;
  out += `- **Overall completeness:** ${pct}%\n`;
  return out;
}

function render(record) {
  const sourcesById = new Map((record.sources ?? []).map((s) => [s.id, s]));

  let md = "";
  md += `**Locality:** ${record.city?.value ?? NOT_VERIFIED}, ${record.county?.value ?? NOT_VERIFIED}\n`;
  md += `**Utility (record):** ${record.utility?.value ?? NOT_VERIFIED}\n`;
  md += `**Record ID:** ${record.record_id}\n`;
  md += `**Schema version:** ${record.schema_version}\n`;
  md += `**Last verified:** ${record.last_verified ?? NOT_VERIFIED}\n\n`;
  md += "---\n\n";

  md += "# Utility\n\n";
  md += renderScalar("Utility", record.utility, sourcesById) + "\n";
  md += renderScalar("Interconnection", record.interconnection_url, sourcesById) + "\n";
  md += "## Generation Supplier\n\n";
  md += renderGenerationSupplier(record.generation_supplier, sourcesById) + "\n";

  md += "# Permit Authority\n\n";
  md += renderScalar("Permit Authority", record.permit_authority, sourcesById) + "\n";
  md += renderScalar("Permit URL", record.permit_url, sourcesById) + "\n";
  md += "## Required Documents\n\n";
  md += renderRequiredDocuments(record.required_documents, sourcesById) + "\n";
  md += "## Permit Fees\n\n";
  md += renderPermitFees(record.permit_fees, sourcesById) + "\n";

  md += "# Timeline\n\n";
  md += renderTimeline(record.timeline_days, sourcesById) + "\n";
  md += "## Eligibility Constraints\n\n";
  md += renderEligibilityConstraints(record.eligibility_constraints, sourcesById) + "\n";

  md += "# Inspection\n\n";
  md += renderStringArray("Inspection Steps", record.inspection_steps, sourcesById) + "\n";

  md += "# Battery Programs\n\n";
  md += renderPrograms(record.battery_programs, sourcesById) + "\n";
  md += "## Other Rebates\n\n";
  md += renderPrograms(record.rebates, sourcesById) + "\n";

  md += "# Official Contacts\n\n";
  md += renderContacts(record.official_contacts, sourcesById) + "\n";

  md += "# Sources\n\n";
  md += renderSourcesSection(record.sources) + "\n";

  md += "# Coverage\n\n";
  md += renderCoverage(record);

  return md;
}

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) fail("usage: node scripts/render-locality-summary.mjs <path-to-record.json>");
  const filePath = path.resolve(inputArg);
  if (!existsSync(filePath)) fail(`file not found: ${filePath}`);

  const record = JSON.parse(await readFile(filePath, "utf8"));
  const markdown = render(record);

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${path.basename(filePath, ".json")}.md`);
  await writeFile(outPath, markdown, "utf8");

  console.error(`Rendered ${path.relative(REPO_ROOT, filePath)} -> ${path.relative(REPO_ROOT, outPath)}`);
}

main().catch((err) => fail(err.stack ?? String(err)));
