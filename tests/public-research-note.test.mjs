import test from "node:test";
import assert from "node:assert/strict";
import { publicResearchNote } from "../src/lib/locality-guide.ts";

test("publicResearchNote keeps ordinary factual notes unchanged", () => {
  const note = "The City requires one final inspection for eligible systems.";
  assert.equal(publicResearchNote(note), note);
});

test("publicResearchNote removes internal research diagnostics but keeps useful public context", () => {
  const note = "The City is the permitting authority. The official page returned HTTP 403 to automated fetch this session. A separate utility approval is required.";
  const rendered = publicResearchNote(note);
  assert.match(rendered, /City is the permitting authority/);
  assert.match(rendered, /separate utility approval/);
  assert.doesNotMatch(rendered, /HTTP|automated fetch|this session/i);
  assert.match(rendered, /Verify the current requirement/);
});

test("publicResearchNote replaces a fully operational note with a transparent user-facing caveat", () => {
  const rendered = publicResearchNote("Search-engine synthesis only; not independently confirmed via direct fetch this session.");
  assert.equal(rendered, "Some supporting official material could not be independently confirmed from the full source in GridPermit's latest review. Verify the current requirement with the authority before relying on it.");
});
