// Permit Path loads each locality's record on demand instead of embedding every
// record in the page, validates the locality next to its field, and reports a
// completed check through the closed analytics list without location data.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import { permitPathRecords, permitPathRecordPath, toPermitPathRecord } from "../src/lib/permit-path-records.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(path.join(root, "src/pages/permit-path.astro"), "utf8");
const analytics = readFileSync(path.join(root, "src/components/Analytics.astro"), "utf8");
const inlineScript = template.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];

const RECORD = {
  id: "ca-test-torrance-sce", state: "CA", city: "Torrance", county: "Los Angeles", utility: "SCE",
  permitAuthority: "City of Torrance", permitUrl: "https://www.torranceca.gov/", interconnectionUrl: "https://www.sce.com/",
  requiredDocuments: null, timeline: null, eligibility: { program_or_pathway: "SolarAPP+", other_conditions: [] },
  permitFees: null, lastVerified: "2026-10-01", sources: [],
};

function harness({ fetchImpl, withEvents = true } = {}) {
  const elements = new Map();
  const dispatched = [];
  const fetched = [];
  const el = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id, value: "", checked: false, innerHTML: "", textContent: "", attributes: {}, handlers: {},
        addEventListener(type, fn) { this.handlers[type] = fn; },
        setAttribute(name, value) { this.attributes[name] = String(value); },
        removeAttribute(name) { delete this.attributes[name]; },
        focus() { dispatched.push(["focus", id]); },
      });
    }
    return elements.get(id);
  };
  el("project-type").value = "pv-storage";
  el("stage").value = "inspection";
  for (const id of ["battery", "mpu", "ground", "existing", "owner", "equipment", "unpermitted", "result", "check-path", "locality", "locality-error"]) el(id);
  const fetchMock = (url, init) => {
    fetched.push(url);
    return (fetchImpl ?? (() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(RECORD) })))(url, init);
  };
  class CustomEventMock { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  const context = {
    document: { getElementById: el, dispatchEvent: (event) => { dispatched.push(["event", event.type, event.detail]); return true; } },
    encodeURIComponent, fetch: fetchMock, Promise,
    ...(withEvents ? { CustomEvent: CustomEventMock } : {}),
  };
  vm.runInNewContext(inlineScript, context, { timeout: 2000 });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  return { el, dispatched, fetched, flush };
}

test("the page no longer embeds every record; the record list feeds only the select options", () => {
  assert.doesNotMatch(template, /<script id="permit-path-data"/);
  assert.doesNotMatch(template, /set:html=\{JSON\.stringify\(records\)\}/);
  assert.match(template, /permitPathRecords\(Object\.values\(localityModules\)/);
  assert.ok(existsSync(path.join(root, "src/pages/permit-path/records/[id].json.ts")), "per-record endpoint exists");
});

test("record shaping keeps only checkable localities, sorted by state and city, with the same fields as before", () => {
  const published = [
    { record_id: "ca-b", state: "CA", city: { value: "Bakersfield" }, permit_authority: { value: "City" }, county: { value: "Kern" }, utility: { value: "PG&E" }, sources: [{ title: "t", url: "https://x.gov/", publisher: "p", type: "official", accessed_date: "2026-10-01" }], last_verified: "2026-10-01" },
    { record_id: "az-a", state: "AZ", city: { value: "Tempe" }, permit_authority: { value: "City" }, sources: [] },
    { record_id: "ca-no-authority", state: "CA", city: { value: "Nowhere" }, permit_authority: { value: null }, sources: [] },
  ];
  const records = permitPathRecords(published);
  assert.deepEqual(records.map((r) => r.id), ["az-a", "ca-b"]);
  assert.deepEqual(Object.keys(toPermitPathRecord(published[0])), ["id", "state", "city", "county", "utility", "permitAuthority", "permitUrl", "interconnectionUrl", "requiredDocuments", "timeline", "eligibility", "permitFees", "lastVerified", "sources"]);
  assert.deepEqual(records[1].sources[0], { title: "t", url: "https://x.gov/", publisher: "p", type: "official", accessedDate: "2026-10-01" });
  assert.equal(permitPathRecordPath("ca-los-angeles-norwalk-sce"), "/permit-path/records/ca-los-angeles-norwalk-sce.json");
});

test("choosing a locality prefetches its record once and clears an earlier field error", async () => {
  const h = harness();
  h.el("locality-error").textContent = "old message";
  h.el("locality").value = RECORD.id;
  h.el("locality").handlers.change();
  h.el("locality").handlers.change();
  await h.flush();
  assert.deepEqual(h.fetched, [`/permit-path/records/${RECORD.id}.json`]);
  assert.equal(h.el("locality-error").textContent, "");
  assert.equal(h.el("locality").attributes["aria-invalid"], "false");
});

test("a check shows a loading state, then the verified result, then reports one privacy-minimal event", async () => {
  const h = harness();
  h.el("locality").value = RECORD.id;
  h.el("check-path").handlers.click();
  assert.match(h.el("result").innerHTML, /Loading the verified record/);
  assert.equal(h.el("result").attributes["aria-busy"], "true");
  await h.flush(); await h.flush();
  assert.equal(h.el("result").attributes["aria-busy"], undefined);
  assert.match(h.el("result").innerHTML, /City of Torrance/);
  const events = h.dispatched.filter((d) => d[0] === "event");
  assert.equal(events.length, 1);
  const [, type, detail] = events[0];
  assert.equal(type, "gridpermit:track");
  assert.equal(detail.name, "permit_path_checked");
  assert.deepEqual(Object.keys(detail.params).sort(), ["open_items", "pathway", "project_type", "stage"]);
  assert.equal(detail.params.stage, "inspection");
  assert.equal(detail.params.project_type, "pv-storage");
  assert.equal(detail.params.pathway, "automated");
  assert.equal(typeof detail.params.open_items, "number");
  const serialized = JSON.stringify(detail.params);
  for (const value of [RECORD.id, RECORD.city, RECORD.utility, RECORD.state, RECORD.county]) assert.ok(!serialized.includes(value), `no location data: ${value}`);
});

test("a failed record request explains the problem and allows a retry", async () => {
  let calls = 0;
  const h = harness({ fetchImpl: () => (++calls === 1 ? Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }) : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(RECORD) })) });
  h.el("locality").value = RECORD.id;
  h.el("check-path").handlers.click();
  await h.flush(); await h.flush();
  assert.match(h.el("result").innerHTML, /role="alert">This locality record could not be loaded\. Check your connection/);
  assert.equal(h.dispatched.filter((d) => d[0] === "event").length, 0, "no measurement for a failed check");
  h.el("check-path").handlers.click();
  await h.flush(); await h.flush();
  assert.match(h.el("result").innerHTML, /City of Torrance/);
  assert.equal(calls, 2);
});

test("changing the locality while a record loads does not leave a stale result or loading message", async () => {
  const h = harness();
  h.el("result").innerHTML = "EMPTY STATE";
  h.el("locality").value = RECORD.id;
  h.el("check-path").handlers.click();
  assert.match(h.el("result").innerHTML, /Loading the verified record/);
  h.el("locality").value = "ca-some-other-city";
  await h.flush(); await h.flush();
  assert.doesNotMatch(h.el("result").innerHTML, /Loading|City of Torrance/);
  assert.equal(h.dispatched.filter((d) => d[0] === "event").length, 0);
});

test("a record whose id does not match the request is rejected", async () => {
  const h = harness({ fetchImpl: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ...RECORD, id: "someone-else" }) }) });
  h.el("locality").value = RECORD.id;
  h.el("check-path").handlers.click();
  await h.flush(); await h.flush();
  assert.match(h.el("result").innerHTML, /could not be loaded/);
});

test("an empty locality marks the field invalid with a message beside it and does not fetch or measure", () => {
  const h = harness();
  h.el("check-path").handlers.click();
  assert.match(h.el("locality-error").textContent, /^Choose a researched locality first\./);
  assert.equal(h.el("locality").attributes["aria-invalid"], "true");
  assert.deepEqual(h.fetched, []);
  assert.deepEqual(h.dispatched, [["focus", "locality"]]);
});

test("without CustomEvent support a check still renders and simply skips measurement", async () => {
  const h = harness({ withEvents: false });
  h.el("locality").value = RECORD.id;
  h.el("check-path").handlers.click();
  await h.flush(); await h.flush();
  assert.match(h.el("result").innerHTML, /City of Torrance/);
});

test("the analytics bridge accepts only allowlisted names and primitive parameters", () => {
  assert.match(analytics, /document\.addEventListener\("gridpermit:track"/);
  const bridge = analytics.slice(analytics.indexOf('document.addEventListener("gridpermit:track"'));
  assert.match(bridge, /if \(!isKnownAnalyticsEvent\(name\)\) return;/);
  assert.match(bridge, /typeof value === "string" \|\| typeof value === "number" \|\| typeof value === "boolean"/);
  assert.match(bridge, /trackEvent\(name, params\)/);
});
