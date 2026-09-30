import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeCid, reconcile } from "../scripts/cid-reconcile.mjs";

test("decodes a real organic first-lead CID (Escondido)", () => {
	const r = decodeCid("e101dc5b95a19b46544930e5");
	assert.equal(r.classification, "MATCHED");
	assert.equal(r.city, "Escondido");
	assert.equal(r.kind, "organic");
});

test("decodes a real owned-source first-lead CID (Hemet, fl_src_02)", () => {
	const r = decodeCid("f102aaaaaaaaaaaaaaaaaaaa");
	assert.equal(r.classification, "MATCHED");
	assert.equal(r.city, "Hemet");
	assert.equal(r.kind, "owned_source");
	assert.equal(r.source_tag, "fl_src_02");
});

test("decodes a well-formed CID with no cohort prefix as organic non-cohort, not an error", () => {
	const r = decodeCid("0123456789abcdef01234567");
	assert.equal(r.classification, "MATCHED_ORGANIC_NON_COHORT");
});

test("flags a reserved-but-unassigned prefix as an anomaly", () => {
	const r = decodeCid("f104aaaaaaaaaaaaaaaaaaaa");
	assert.equal(r.classification, "RESERVED_PREFIX_ANOMALY");
});

test("rejects charset-invalid input as malformed", () => {
	const r = decodeCid("not-a-real-cid!!!");
	assert.equal(r.classification, "MALFORMED");
});

test("flags a charset-valid but wrong-length value as unknown, not malformed or matched", () => {
	const r = decodeCid("e101short");
	assert.equal(r.classification, "UNKNOWN_CID");
});

test("rejects empty/non-string input", () => {
	assert.equal(decodeCid("").classification, "MALFORMED");
	assert.equal(decodeCid(undefined).classification, "MALFORMED");
});

test("reconcile() flags a repeated CID as a duplicate of the first occurrence, not a second match", () => {
	const { results, summary } = reconcile(["e101dc5b95a19b46544930e5", "e101dc5b95a19b46544930e5"]);
	assert.equal(results[0].classification, "MATCHED");
	assert.equal(results[1].classification, "DUPLICATE");
	assert.equal(summary.MATCHED, 1);
	assert.equal(summary.DUPLICATE, 1);
});

test("reconcile() never collapses distinct classifications into one count", () => {
	const { summary, count } = reconcile([
		"e101dc5b95a19b46544930e5",
		"f104aaaaaaaaaaaaaaaaaaaa",
		"not-valid!!!",
	]);
	assert.equal(count, 3);
	assert.equal(summary.MATCHED, 1);
	assert.equal(summary.RESERVED_PREFIX_ANOMALY, 1);
	assert.equal(summary.MALFORMED, 1);
});
