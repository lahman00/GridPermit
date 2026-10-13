import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { assessReadyCoreQuality } from "../src/lib/ready-quality.ts";

const record = JSON.parse(readFileSync(new URL("../data/localities/ca-san-diego-san-diego-sdge.json", import.meta.url), "utf8"));
const doc = (name) => record.required_documents.value.find((item) => item.name.includes(name));

test("San Diego scoped evidence satisfies the schema and resolves every added citation", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(new URL("../data/schema.json", import.meta.url), "utf8")));
  assert.ok(validate(record), JSON.stringify(validate.errors));
  const ids = new Set(record.sources.map((source) => source.id));
  assert.equal(ids.size, record.sources.length);
  for (const field of [record.required_documents, record.inspection_steps, record.eligibility_constraints, record.permit_fees, ...record.required_documents.value]) {
    for (const id of field.source_ids) assert.ok(ids.has(id), id);
  }
});

test("San Diego does not require building-permit forms or an extra circuit card for every rooftop project", () => {
  for (const name of ["HM-9171", "DS-560"]) assert.match(doc(name).required_when, /when a Building Permit is required/);
  assert.match(doc("DS-165").required_when, /single-family.*duplex.*townhouse/);
  assert.match(doc("DS-1779").required_when, /unless.*approved plans/);
  assert.match(doc("SDG&E approval letter").required_when, /when a separate utility disconnect is required/);
  assert.match(doc("Roof plan").required_when, /non-template.*as applicable/);
});

test("San Diego keeps rooftop, ground and utility approval stages distinct", () => {
  const steps = record.inspection_steps.value;
  assert.ok(steps.some((step) => /Ground-mounted.*underground.*where that work is included/.test(step)));
  assert.ok(steps.some((step) => /Roof-mounted.*concealed wiring/.test(step)));
  assert.ok(steps.some((step) => /City approval alone does not authorize energization; separate SDG&E approval is required/.test(step)));
  assert.doesNotMatch(record.inspection_steps.notes, /single-authority|PG&E|PWP/);
});

test("San Diego preserves scoped fee components without filling the unknown total approval time", () => {
  assert.deepEqual(record.permit_fees.value.map((fee) => fee.amount_usd), [275.8, 154.2, 275.8, 758, 264, 290, 145, 12.16]);
  assert.match(record.permit_fees.value.at(-1).notes, /not an unconditional charge/);
  assert.match(record.permit_fees.notes, /not.*complete project quote/);
  assert.match(record.permit_fees.notes, /SDG&E fees remain Not yet verified/);
  assert.equal(record.timeline_days.value, null);
  assert.equal(record.timeline_days.confidence, 0);
  assert.deepEqual(record.timeline_days.source_ids, []);
  const quality = assessReadyCoreQuality(record);
  assert.equal(quality.verifiedCoreCount, 5);
  assert.ok(quality.missingCoreFields.includes("timeline_days"));
});

test("San Diego self-issued limits do not imply a universal city cap or Express eligibility", () => {
  const eligibility = record.eligibility_constraints.value;
  assert.equal(eligibility.system_size_kw_ac_max, 38.4);
  assert.deepEqual(eligibility.property_types, ["single-family", "duplex", "townhouse"]);
  const conditions = eligibility.other_conditions.join(" ");
  assert.match(conditions, /not universal citywide limits/);
  assert.match(conditions, /Neither fire plan review nor structural review may be required/);
  assert.match(conditions, /excludes single-family, duplex and ADU projects from Express/);
});
