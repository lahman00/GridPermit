// Permit Path loads each locality's record on demand instead of embedding every
// record in the page, validates the locality next to its field, guards against
// stale or slow responses, and reports a completed check through the analytics
// bridge without location data.
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

const record = (id, city, extra = {}) => ({
  id, state: "CA", city, county: "Los Angeles", utility: "SCE",
  permitAuthority: `City of ${city}`, permitUrl: "https://www.example.gov/", interconnectionUrl: "https://www.sce.com/",
  requiredDocuments: null, timeline: null, eligibility: { program_or_pathway: "SolarAPP+", other_conditions: [] },
  permitFees: null, lastVerified: "2026-10-01", sources: [], ...extra,
});
const A = record("ca-a-sce", "Alpha");
const B = record("ca-b-sce", "Bravo");

// A deferred fetch the test resolves or rejects by hand, in any order.
function deferredFetch() {
  const calls = [];
  const fetchImpl = (url, init) => new Promise((resolve, reject) => calls.push({ url, init, resolve, reject }));
  const respond = (i, body, ok = true) => calls[i].resolve({ ok, status: ok ? 200 : 503, json: () => Promise.resolve(body) });
  return { calls, fetchImpl, respond };
}

function harness({ fetchImpl, withEvents = true, embedded = null, initialResult = "<div class=\"result-empty\">EMPTY STATE</div>" } = {}) {
  const elements = new Map();
  const log = [];
  const timers = [];
  const el = (id) => {
    if (!elements.has(id)) {
      const node = {
        id, value: "", checked: false, innerHTML: "", textContent: "", attributes: {}, handlers: {},
        dataset: {}, style: {}, offsetWidth: 0,
        classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } },
        addEventListener(type, fn) { this.handlers[type] = fn; },
        setAttribute(name, value) { this.attributes[name] = String(value); },
        getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; },
        removeAttribute(name) { delete this.attributes[name]; },
        focus(opts) { log.push(["focus", id, opts ?? null]); },
        querySelector(sel) { return sel === "h2" ? el("result-heading") : null; },
        scrollIntoView() { log.push(["scroll", id]); },
      };
      elements.set(id, node);
    }
    return elements.get(id);
  };
  el("project-type").value = "pv-storage";
  el("stage").value = "inspection";
  el("result").innerHTML = initialResult;
  if (embedded !== null) el("permit-path-data").textContent = embedded;
  for (const id of ["battery", "mpu", "ground", "existing", "owner", "equipment", "unpermitted", "check-path", "locality", "locality-error", "result-card", "result-announce", "result-heading"]) el(id);
  class CustomEventMock { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  class AbortControllerMock { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; log.push(["abort"]); } }
  const context = {
    document: { getElementById: el, dispatchEvent: (event) => { log.push(["event", event.type, event.detail]); return true; } },
    encodeURIComponent, Promise,
    fetch: fetchImpl ?? (() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(A) })),
    setTimeout: (fn, ms) => { timers.push({ fn, ms, done: false }); return timers.length - 1; },
    clearTimeout: (id) => { if (timers[id]) timers[id].done = true; },
    AbortController: AbortControllerMock,
    matchMedia: () => ({ matches: false }),
    ...(withEvents ? { CustomEvent: CustomEventMock } : {}),
  };
  vm.runInNewContext(inlineScript, context, { timeout: 2000 });
  const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve)); };
  const runTimers = (ms) => { for (const t of timers) if (!t.done && (ms === undefined || t.ms === ms)) { t.done = true; t.fn(); } };
  const events = () => log.filter((entry) => entry[0] === "event");
  const choose = (id) => { el("locality").value = id; el("locality").handlers.change?.(); };
  const click = () => el("check-path").handlers.click();
  return { el, log, timers, flush, runTimers, events, choose, click };
}

test("the page no longer embeds every record; the record list feeds only the select options", () => {
  assert.doesNotMatch(template, /<script id="permit-path-data"/);
  assert.doesNotMatch(template, /set:html=\{JSON\.stringify\(records\)\}/);
  assert.match(template, /permitPathRecords\(Object\.values\(localityModules\)/);
  assert.ok(existsSync(path.join(root, "src/pages/permit-path/records/[id].json.ts")), "per-record endpoint exists");
});

test("the checker requests the same per-record path the endpoint publishes", () => {
  const id = "ca-los-angeles-norwalk-sce";
  assert.equal(permitPathRecordPath(id), `/permit-path/records/${id}.json`);
  assert.ok(inlineScript.includes("`/permit-path/records/${encodeURIComponent(id)}.json`"));
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
});

test("a malformed embedded data element cannot disable the checker", async () => {
  const h = harness({ embedded: "not json" });
  h.choose(A.id);
  h.click();
  await h.flush();
  assert.match(h.el("result").innerHTML, /City of Alpha/);
});

test("choosing a locality waits for the choice to settle, then prefetches once", async () => {
  const f = deferredFetch();
  const h = harness({ fetchImpl: f.fetchImpl });
  h.el("locality-error").textContent = "old message";
  h.choose("ca-x-sce");
  h.choose("ca-y-sce");
  h.choose(A.id);
  assert.equal(f.calls.length, 0, "no request while the selection is still moving");
  h.runTimers(250);
  assert.deepEqual(f.calls.map((c) => c.url), [`/permit-path/records/${A.id}.json`]);
  assert.equal(h.el("locality-error").textContent, "");
  assert.equal(h.el("locality").attributes["aria-invalid"], "false");
});

test("a check shows a spoken loading state, then the result with reveal, focus and one privacy-minimal event", async () => {
  const f = deferredFetch();
  const h = harness({ fetchImpl: f.fetchImpl });
  h.el("locality").value = A.id;
  h.click();
  assert.match(h.el("result").innerHTML, /Loading the verified record/);
  assert.equal(h.el("result").attributes["aria-busy"], "true");
  assert.equal(h.el("result-announce").textContent, "Loading the verified record.");
  f.respond(0, A);
  await h.flush();
  assert.equal(h.el("result").attributes["aria-busy"], undefined);
  assert.match(h.el("result").innerHTML, /City of Alpha/);
  assert.equal(h.el("result").dataset.open, "true");
  assert.ok(h.el("result").classList.contains("is-revealing"), "reveal runs");
  assert.match(h.el("result-announce").textContent, /^Alpha, CA: /);
  assert.ok(h.log.some((e) => e[0] === "focus" && e[1] === "result-heading"), "focus moves to the result heading");
  const events = h.events();
  assert.equal(events.length, 1);
  const [, type, detail] = events[0];
  assert.equal(type, "gridpermit:track");
  assert.equal(detail.name, "permit_path_checked");
  assert.deepEqual(Object.keys(detail.params).sort(), ["open_items", "pathway", "project_type", "stage"]);
  assert.deepEqual({ ...detail.params, open_items: 0 }, { stage: "inspection", project_type: "pv-storage", pathway: "automated", open_items: 0 });
  const serialized = JSON.stringify(detail.params);
  for (const value of [A.id, A.city, A.utility, A.county, "CA"]) assert.ok(!serialized.includes(value), `no location data: ${value}`);
});

test("a late response for an earlier locality cannot replace the newer result", async () => {
  const f = deferredFetch();
  const h = harness({ fetchImpl: f.fetchImpl });
  h.el("locality").value = A.id;
  h.click();                       // A starts loading (call 0)
  h.choose(B.id);                  // switch while A loads
  assert.match(h.el("result").innerHTML, /EMPTY STATE/, "the stale loading message is replaced by the empty state");
  h.click();                       // B starts loading (call 1)
  f.respond(1, B);
  await h.flush();
  assert.match(h.el("result").innerHTML, /City of Bravo/);
  f.respond(0, A);                 // A finally arrives
  await h.flush();
  assert.match(h.el("result").innerHTML, /City of Bravo/);
  assert.doesNotMatch(h.el("result").innerHTML, /City of Alpha/);
  assert.equal(h.events().length, 1);
});

test("a late failure for an earlier locality does not show an error over the newer result", async () => {
  const f = deferredFetch();
  const h = harness({ fetchImpl: f.fetchImpl });
  h.el("locality").value = A.id;
  h.click();
  h.choose(B.id);
  h.click();
  f.respond(1, B);
  await h.flush();
  f.calls[0].reject(new Error("network"));
  await h.flush();
  assert.match(h.el("result").innerHTML, /City of Bravo/);
  assert.doesNotMatch(h.el("result").innerHTML, /could not be loaded/);
});

test("clicking twice while a record loads renders once and measures once", async () => {
  const f = deferredFetch();
  const h = harness({ fetchImpl: f.fetchImpl });
  h.el("locality").value = A.id;
  h.click();
  h.click();
  assert.equal(f.calls.length, 1, "the in-flight request is reused");
  f.respond(0, A);
  await h.flush();
  assert.match(h.el("result").innerHTML, /City of Alpha/);
  assert.equal(h.events().length, 1);
});

test("a stalled request times out into a retryable error", async () => {
  const f = deferredFetch();
  const h = harness({ fetchImpl: f.fetchImpl });
  h.el("locality").value = A.id;
  h.click();
  const timeout = h.timers.find((t) => t.ms === 10000);
  assert.ok(timeout, "a 10 second timeout is armed");
  // Simulate the browser rejecting the aborted fetch.
  timeout.fn();
  assert.ok(h.log.some((e) => e[0] === "abort"));
  f.calls[0].reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
  await h.flush();
  assert.match(h.el("result").innerHTML, /role="alert">This locality record could not be loaded\. Check your connection/);
  assert.equal(h.events().length, 0, "no measurement for a failed check");
  h.click();
  f.respond(1, A);
  await h.flush();
  assert.match(h.el("result").innerHTML, /City of Alpha/);
});

test("a record whose id does not match the request is rejected", async () => {
  const h = harness({ fetchImpl: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ...A, id: "someone-else" }) }) });
  h.el("locality").value = A.id;
  h.click();
  await h.flush();
  assert.match(h.el("result").innerHTML, /could not be loaded/);
});

test("non-http(s) URLs in a record are never rendered as links", async () => {
  const unsafe = record("ca-c-sce", "Charlie", { permitUrl: "javascript:alert(1)", sources: [{ title: "Bad source", url: "javascript:alert(2)", publisher: "x" }] });
  const h = harness({ fetchImpl: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(unsafe) }) });
  h.el("locality").value = unsafe.id;
  h.click();
  await h.flush();
  const html = h.el("result").innerHTML;
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /Official link not verified in this record\./);
  assert.match(html, /Bad source/);
});

test("an empty locality marks the field invalid with a message beside it and does not fetch or measure", () => {
  const f = deferredFetch();
  const h = harness({ fetchImpl: f.fetchImpl });
  h.click();
  assert.match(h.el("locality-error").textContent, /^Choose a researched locality first\./);
  assert.equal(h.el("locality").attributes["aria-invalid"], "true");
  assert.ok(h.el("locality").classList.contains("is-shaking"));
  assert.equal(f.calls.length, 0);
  assert.deepEqual(h.events(), []);
});

test("without CustomEvent support a check still renders and simply skips measurement", async () => {
  const h = harness({ withEvents: false });
  h.el("locality").value = A.id;
  h.click();
  await h.flush();
  assert.match(h.el("result").innerHTML, /City of Alpha/);
  assert.deepEqual(h.events(), []);
});

test("Analytics.astro routes the bridge through the narrow bridgeAnalyticsEvent schema", () => {
  assert.match(analytics, /document\.addEventListener\("gridpermit:track"/);
  const bridge = analytics.slice(analytics.indexOf('document.addEventListener("gridpermit:track"'));
  assert.match(bridge, /const request = bridgeAnalyticsEvent\(\(event as CustomEvent\)\.detail\);/);
  assert.match(bridge, /if \(request\) trackEvent\(request\.name, request\.params\);/);
});
