// Tests for the organic distribution PREPARATION pipeline. These assert the
// safety contract (draft-only, never publishable) as much as the checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	buildQueue,
	lintDraft,
	renderQueueMarkdown,
	similarity,
	utmUrl,
	weightedLength,
} from "../scripts/lib/distribution-queue.mjs";
import { contextFromSnapshot } from "../scripts/build-distribution-queue.mjs";

const allCandidates = JSON.parse(readFileSync("data/distribution/candidates.json", "utf8")).candidates;
// The behaviour tests below are written against one known candidate; the file may hold more.
const candidates = allCandidates.filter((c) => c.id === "california_solarapp_fees_202610");
const ledger = JSON.parse(readFileSync("data/distribution/posted-topics.json", "utf8")).entries;
const snapshot = {
	pages: { "/california/": { robots: [] }, "/noindex/": { robots: ["noindex, follow"] } },
	sitemap: ["/california/"],
};
const ctx = (over = {}) => ({ ...contextFromSnapshot(snapshot, ledger, "2026-10-19"), ...over });
const clone = (o) => JSON.parse(JSON.stringify(o));

test("the checked-in candidate produces two review-ready, draft-only items", () => {
	const q = buildQueue(candidates, ctx());
	assert.equal(q.counts.ready_for_human_review, 2);
	assert.deepEqual(q.safety, { auto_post: false, auto_engage: false, partner_contact: false, account_access: false });
	for (const item of q.items) {
		assert.equal(item.draft_only, true);
		assert.equal(item.owner_approval_required, true);
		assert.equal(item.publish_allowed, false);
		assert.equal(item.posted, false);
	}
	assert.equal(q.utm_ledger.length, 2);
	assert.match(renderQueueMarkdown(q), /NOT PUBLISHED/);
});

test("output is deterministic", () => {
	assert.deepEqual(buildQueue(candidates, ctx()), buildQueue(clone(candidates), ctx()));
});

test("UTM URLs are exact, site-only and reject odd input", () => {
	assert.equal(
		utmUrl("/california/", "x", "california_solarapp_fees_202610"),
		"https://mygridpermit.com/california/?utm_source=x&utm_medium=organic_social&utm_campaign=california_solarapp_fees_202610",
	);
	assert.throws(() => utmUrl("/a?b=1", "x", "c"));
	assert.throws(() => utmUrl("/a/", "x", "bad campaign"));
	assert.throws(() => utmUrl("/a/", "facebook", "c"));
});

test("X length counts every URL as 23 characters", () => {
	assert.equal(weightedLength("hi https://mygridpermit.com/a/?utm_source=x&utm_medium=organic_social&utm_campaign=c"), 3 + 23);
	const long = "a".repeat(260) + " https://mygridpermit.com/x/";
	assert.ok(lintDraft(long, "x").some((i) => i.code === "too_long"));
});

test("stale live check, old source, missing page and noindex page block", () => {
	const stale = buildQueue(candidates, ctx({ today: "2026-10-30" }));
	assert.ok(stale.items.every((i) => i.status === "BLOCKED" && i.issues.some((x) => x.code === "claim_source_check_stale")));
	const old = clone(candidates);
	old[0].claims[1].source.evidence_date = "2026-01-01";
	assert.ok(buildQueue(old, ctx()).items.every((i) => i.issues.some((x) => x.code === "claim_source_too_old")));
	const missing = clone(candidates);
	missing[0].page_path = "/nope/";
	assert.ok(buildQueue(missing, ctx()).items[0].issues.some((x) => x.code === "page_not_built"));
	const noindex = clone(candidates);
	noindex[0].page_path = "/noindex/";
	assert.ok(buildQueue(noindex, ctx()).items[0].issues.some((x) => x.code === "page_noindex"));
});

test("every claim must appear in the draft and carry a source", () => {
	const c = clone(candidates);
	c[0].drafts.x = c[0].drafts.x.replace("local permit fees may also apply", "other fees apply");
	const x = buildQueue(c, ctx()).items.find((i) => i.channel === "x");
	assert.equal(x.status, "BLOCKED");
	assert.ok(x.issues.some((i) => i.code === "claim_not_in_draft"));
	const nosrc = clone(candidates);
	delete nosrc[0].claims[0].source.url;
	assert.ok(buildQueue(nosrc, ctx()).items.every((i) => i.issues.some((x) => x.code === "claim_source_missing_url")));
});

test("wrong or extra URLs in a draft block", () => {
	const c = clone(candidates);
	c[0].drafts.x += "\nhttps://example.com/";
	assert.ok(buildQueue(c, ctx()).items.find((i) => i.channel === "x").issues.some((i) => i.code === "draft_has_other_urls"));
	const d = clone(candidates);
	d[0].drafts.linkedin = d[0].drafts.linkedin.replace("utm_source=linkedin", "utm_source=x");
	assert.ok(buildQueue(d, ctx()).items.find((i) => i.channel === "linkedin").issues.some((i) => i.code === "draft_missing_exact_utm_url"));
});

test("a topic already published or saved as an unpublished draft on that channel is blocked", () => {
	const c = clone(candidates);
	c[0].topic_key = "permit-path";
	const q = buildQueue(c, ctx());
	for (const item of q.items) assert.ok(item.issues.some((i) => i.code === "duplicate_topic_in_ledger"), item.id);
});

test("near-identical text in the ledger or within the queue is flagged", () => {
	const c = clone(candidates);
	const l = [{ topic_key: "other", channel: "x", status: "published", date: "2026-10-12", text: c[0].drafts.x }];
	assert.ok(buildQueue(c, ctx({ ledger: l })).items.find((i) => i.channel === "x").issues.some((i) => i.code === "duplicate_text_in_ledger"));
	const twin = clone(candidates[0]);
	twin.id = "twin";
	twin.topic_key = "twin-topic";
	const q = buildQueue([candidates[0], twin], ctx());
	assert.ok(q.items.some((i) => i.issues.some((x) => x.code === "duplicate_within_queue")));
	assert.ok(similarity("a b c d", "a b c d") === 1 && similarity("a b", "c d") === 0);
});

test("lint blocks hype, commercial language, unsupported claims, long dashes and hashtag stuffing", () => {
	const codes = (t, ch = "linkedin") => lintDraft(t, ch).map((i) => i.code);
	assert.ok(codes("We are excited to unlock savings").includes("hype_phrase"));
	assert.ok(codes("Get a free quote from CompareSolarPrices").includes("commercial_language"));
	assert.ok(codes("We guarantee approval").includes("prohibited_claim"));
	assert.ok(codes("A — B").includes("long_dash"));
	assert.ok(codes("x #a #b #c").includes("too_many_hashtags"));
	assert.ok(codes("x #a #b", "x").includes("too_many_hashtags"));
	assert.deepEqual(codes("Plain factual sentence about permits."), []);
});

test("every checked-in candidate is well formed: unique ids and topics, drafts only for declared channels, claims mapped to the draft", () => {
	assert.equal(candidates.length, 1, "the pinned candidate exists");
	assert.equal(new Set(allCandidates.map((c) => c.id)).size, allCandidates.length);
	assert.equal(new Set(allCandidates.map((c) => c.topic_key + "|" + (c.channels ?? []).join(","))).size, allCandidates.length);
	for (const c of allCandidates) {
		assert.deepEqual(Object.keys(c.drafts).sort(), [...c.channels].sort(), c.id);
		for (const ch of c.channels) {
			for (const claim of c.claims.filter((x) => !x.channels || x.channels.includes(ch))) {
				assert.ok(c.drafts[ch].toLowerCase().includes(claim.draft_phrase.toLowerCase()), `${c.id}/${ch}: claim phrase not in draft`);
				assert.match(claim.source.url, /^https:\/\//);
			}
		}
	}
});
