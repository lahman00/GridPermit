import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(path.join(root, "src/pages/permit-path.astro"), "utf8");
const inlineScript = template.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inlineScript, "Permit Path inline checker script must exist");

function checker(conditions, program = "Automated Solar Permitting (Citizen Access Portal)") {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: "", checked: false, innerHTML: "", textContent: "",
        handlers: {},
        addEventListener(type, fn) { this.handlers[type] = fn; },
      });
    }
    return elements.get(id);
  }
  const record = {
    id: "test-torrance", city: "Torrance", state: "CA", utility: "SCE",
    permitAuthority: "City of Torrance Building & Safety",
    permitUrl: "https://www.torranceca.gov/",
    interconnectionUrl: "https://www.sce.com/",
    eligibility: { program_or_pathway: program, other_conditions: conditions },
    sources: [{ title: "City source", url: "https://www.torranceca.gov/", publisher: "Torrance", accessedDate: "2026-10-17" }],
  };
  element("permit-path-data").textContent = JSON.stringify([record]);
  element("locality").value = "test-torrance";
  element("project-type").value = "new-pv";
  element("stage").value = "planning";
  for (const id of ["battery", "mpu", "ground", "existing", "owner", "equipment", "unpermitted", "result", "check-path"]) element(id);
  vm.runInNewContext(inlineScript, { document: { getElementById: element }, encodeURIComponent }, { timeout: 2000 });
  return {
    elements,
    type(value) {
      element("project-type").value = value;
      element("project-type").handlers.change({ target: element("project-type") });
    },
    check(id, value) {
      element(id).checked = value;
      element(id).handlers.change?.({});
    },
    isChecked(id) { return element(id).checked; },
    render() {
      element("check-path").handlers.click();
      return element("result").innerHTML;
    },
  };
}

const torrance = [
  "New PV system on an existing permitted R-3 occupancy only; no existing PV or ESS already on the property",
  "Ground-mounted systems, carports and non-permanent structures are not allowed; flush-mount or tilt-mount only",
  "Projects not meeting automated permitting criteria may still submit for standard plan review",
];

test("explicit Torrance ground-mount exclusion creates a visible warning", () => {
  const c = checker(torrance);
  c.check("ground", true);
  const result = c.render();
  assert.match(result, /status caution/);
  assert.match(result, /excludes the selected ground-mount/);
  assert.match(result, /Ask the AHJ about standard review/);
});

test("existing PV is a disqualifier when a cited source explicitly excludes it", () => {
  const c = checker(torrance);
  c.type("pv-expansion");
  const result = c.render();
  assert.match(result, /excludes a property with existing PV or ESS/);
  assert.match(result, /status caution/);
});

test("merely mentioning an existing home does not establish PV expansion eligibility", () => {
  const c = checker(["Solar panels may be placed on existing permitted homes."]);
  c.type("pv-expansion");
  const result = c.render();
  assert.match(result, /Project-specific treatment of existing PV or system expansion is not established/);
  assert.match(result, /status caution/);
});

test("changing project type clears only automatically selected checkboxes", () => {
  const c = checker([]);
  c.type("battery-only");
  assert.equal(c.isChecked("battery"), true);
  assert.equal(c.isChecked("existing"), true);
  c.type("new-pv");
  assert.equal(c.isChecked("battery"), false);
  assert.equal(c.isChecked("existing"), false);
  c.check("battery", true);
  c.type("pv-expansion");
  assert.equal(c.isChecked("battery"), true, "Preserve explicit user choice");
  assert.equal(c.isChecked("existing"), true);
  c.type("new-pv");
  assert.equal(c.isChecked("battery"), true, "Still preserve explicit user choice");
  assert.equal(c.isChecked("existing"), false);
});

test("a cited Symbium pathway is not misreported as no automated pathway", () => {
  const c = checker(["PV path under SB 379."], "SB 379 streamlined permitting (Symbium)");
  const result = c.render();
  assert.match(result, /recorded automated or expedited path for some projects/);
  assert.doesNotMatch(result, /no SolarAPP\+ pathway/);
});

test("script keeps municipality and utility destinations source-linked, not commercial", () => {
  const c = checker([]);
  const html = c.render();
  assert.match(html, /Open official permit instructions/);
  assert.match(html, /Open official utility path/);
  assert.match(html, /Record last verified|Sources used by this locality record/);
  assert.doesNotMatch(html, /CompareSolarPrices/);
});

test("result links to the Pro proposal as interest only, without counting interest", () => {
  const html = checker([]).render();
  const pro = html.match(/<p class="pro-note">[\s\S]*?<\/p>/)?.[0];
  assert.ok(pro, "Pro proposal note must render with the result");
  assert.match(pro, /<a href="\/pro\/">/, "Plain internal link to the canonical /pro/ URL");
  assert.match(pro, /does not exist yet/i, "Must say the product is not available");
  // pro_interest_clicked stays reserved for the mailto on /pro/; a navigation click is not interest.
  assert.doesNotMatch(pro, /data-track-click|utm_|href="[^"]*\?/);
  assert.doesNotMatch(pro, /\$|price|trial|subscri|refund|sign up|buy/i);
  assert.ok(html.indexOf("Send project facts") < html.indexOf('class="pro-note"'), "Help link stays the primary next step");
});

test("missing locality shows no Pro proposal", () => {
  const c = checker([]);
  c.elements.get("locality").value = "";
  assert.doesNotMatch(c.render(), /pro-note|\/pro\//);
});
