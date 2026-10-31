import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(path.join(root, "src/pages/permit-path.astro"), "utf8");
const inlineScript = template.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];

function run({ reduceMotion }) {
  const calls = [];
  const elements = new Map();
  const heading = { focus: (opts) => calls.push(["focus", opts]) };
  const card = { querySelector: (sel) => (sel === "h2" ? heading : null), scrollIntoView: (opts) => calls.push(["scroll", opts]) };
  const el = (id) => {
    if (id === "result-card") return card;
    if (!elements.has(id)) elements.set(id, { value: "", checked: false, innerHTML: "", textContent: "", handlers: {}, addEventListener(t, f) { this.handlers[t] = f; } });
    return elements.get(id);
  };
  const record = { id: "r1", city: "Torrance", state: "CA", utility: "SCE", permitAuthority: "City of Torrance", permitUrl: "https://www.torranceca.gov/", interconnectionUrl: "https://www.sce.com/", eligibility: { program_or_pathway: "x", other_conditions: [] }, sources: [] };
  el("permit-path-data").textContent = JSON.stringify([record]);
  el("locality").value = "r1"; el("project-type").value = "new-pv"; el("stage").value = "planning";
  for (const id of ["battery", "mpu", "ground", "existing", "owner", "equipment", "unpermitted", "result", "check-path"]) el(id);
  vm.runInNewContext(inlineScript, { document: { getElementById: el }, encodeURIComponent, matchMedia: () => ({ matches: reduceMotion }) }, { timeout: 2000 });
  return { calls, click: () => el("check-path").handlers.click(), clickEmpty() { el("locality").value = ""; el("check-path").handlers.click(); return el("result").innerHTML; } };
}

test("a completed check scrolls to the result and moves focus to its heading without a second scroll", () => {
  const r = run({ reduceMotion: false });
  r.click();
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls)), [["scroll", { behavior: "smooth", block: "start" }], ["focus", { preventScroll: true }]]);
});

test("reduced-motion users get an instant jump", () => {
  const r = run({ reduceMotion: true });
  r.click();
  assert.equal(r.calls[0][1].behavior, "auto");
});

test("choosing no locality announces the problem as an alert and still reveals the result area", () => {
  const r = run({ reduceMotion: false });
  const html = r.clickEmpty();
  assert.match(html, /role="alert"/);
  assert.equal(r.calls.length, 2);
});

test("the result card no longer re-reads the whole result as a live region", () => {
  assert.doesNotMatch(template, /id="result-card"[^>]*aria-live/);
  assert.match(template, /<h2 id="result-heading" tabindex="-1">Verified path<\/h2>/);
});

test("project modifiers are a labelled group, not an orphan label", () => {
  assert.match(template, /<fieldset class="mods">\s*<legend>Project modifiers<\/legend>/);
  assert.doesNotMatch(template, /<label>Project modifiers<\/label>/);
});

test("scripted result markup is styled through global selectors, not scoped ones that never match", () => {
  for (const selector of ["#result .status", "#result .status.good", "#result .status.caution", "#result .section", "#result .official", "#result .cta a"]) {
    assert.ok(template.includes(`:global(${selector})`), selector);
  }
  assert.doesNotMatch(template, /(^|[}\s])\.status \{/m);
  assert.doesNotMatch(template, /var\(--(green|amber|blue-dark)(-bg)?\)/, "undefined design tokens");
});

test("localities are grouped by state with optgroups", () => {
  assert.match(template, /<optgroup label=\{group\.name\}>/);
  assert.match(template, /stateMeta\(record\.state\)\.name/);
});
