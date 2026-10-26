// Tests for the distribution gate, publication ledger and reply suggestions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildQueue } from "../scripts/lib/distribution-queue.mjs";
import {
	applyGate,
	buildReplyQueue,
	engagementGate,
	evaluateGate,
	evaluateReply,
	recordPublication,
	recordReplyPublication,
} from "../scripts/lib/distribution-controls.mjs";
import { contextFromSnapshot } from "../scripts/build-distribution-queue.mjs";

const gateFile = JSON.parse(readFileSync("data/distribution/publishing-gate.json", "utf8"));
const candidates = JSON.parse(readFileSync("data/distribution/candidates.json", "utf8")).candidates.filter((c) => c.id === "california_solarapp_fees_202610");
const ledger = JSON.parse(readFileSync("data/distribution/posted-topics.json", "utf8")).entries;
const snapshot = { pages: { "/california/": { robots: [] }, "/california/x/solar-permit-guide/": { robots: [] } }, sitemap: ["/california/"] };
const ctx = () => contextFromSnapshot(snapshot, ledger, "2026-10-19");
const open = () => ({
	publishing_enabled: true,
	engagement_enabled: true,
	channels: {
		linkedin: { identity_verified: true, access_verified: true, owner_permission_ref: "owner-2026-10-21", personal_profile: false },
		x: { identity_verified: true, access_verified: true, owner_permission_ref: "owner-2026-10-21", personal_profile: false },
	},
});

test("the checked-in gate is fully disabled", () => {
	assert.equal(gateFile.publishing_enabled, false);
	assert.equal(gateFile.engagement_enabled, false);
	for (const g of Object.values(gateFile.channels)) {
		assert.equal(g.identity_verified, false);
		assert.equal(g.access_verified, false);
		assert.equal(g.owner_permission_ref, null);
		assert.equal(g.personal_profile, false);
	}
	assert.equal(evaluateGate(gateFile, "linkedin", "x").status, "DISABLED");
	assert.equal(engagementGate(gateFile).status, "DISABLED");
});

test("every precondition is required, and a personal profile is never allowed", () => {
	assert.equal(evaluateGate(open(), "linkedin", "approval-1").status, "OWNER_MAY_PUBLISH_MANUALLY");
	assert.equal(evaluateGate(open(), "linkedin", null).status, "DISABLED");
	for (const mutate of [
		(g) => (g.publishing_enabled = false),
		(g) => (g.channels.linkedin.identity_verified = false),
		(g) => (g.channels.linkedin.access_verified = false),
		(g) => (g.channels.linkedin.owner_permission_ref = null),
		(g) => (g.channels.linkedin.personal_profile = true),
	]) {
		const g = open();
		mutate(g);
		assert.equal(evaluateGate(g, "linkedin", "approval-1").status, "DISABLED");
	}
	assert.equal(evaluateGate(open(), "facebook", "a").status, "DISABLED");
});

test("even a fully open gate never lets the tool publish or engage", () => {
	assert.equal(evaluateGate(open(), "x", "a").tool_will_publish, false);
	assert.equal(engagementGate(open()).tool_will_engage, false);
	const q = applyGate(buildQueue(candidates, ctx()), open());
	for (const it of q.items) assert.equal(it.publish_allowed, false);
	assert.equal(q.engagement_gate.tool_will_engage, false);
	const closed = applyGate(buildQueue(candidates, ctx()), gateFile);
	assert.ok(closed.items.every((i) => i.gate.status === "DISABLED" && i.gate.reasons.length > 0));
});

test("a publication record needs the approved text hash, identity, approval and a channel permalink", () => {
	const item = buildQueue(candidates, ctx()).items.find((i) => i.channel === "x");
	const evidence = { date: "2026-10-22", permalink: "https://x.com/Grid_Permit/status/123", approval_ref: "owner-2026-10-22", identity_verified: true, posted_text_sha256: item.text_sha256 };
	const originalLength = ledger.length;
	const next = recordPublication(ledger, item, evidence);
	assert.equal(next.length, ledger.length + 1);
	assert.equal(next.at(-1).text_sha256, item.text_sha256);
	assert.equal(ledger.length, originalLength, "input ledger is not mutated");
	for (const bad of [{ posted_text_sha256: "0".repeat(64) }, { permalink: "https://example.com/p" }, { approval_ref: "" }, { identity_verified: false }, { date: "yesterday" }]) {
		assert.throws(() => recordPublication(ledger, item, { ...evidence, ...bad }), /refused/, JSON.stringify(bad));
	}
	assert.throws(() => recordPublication(next, item, evidence), /already published/);
	assert.throws(() => recordPublication(ledger, { ...item, status: "BLOCKED" }, evidence), /blocked/);
});

const discussion = (over = {}) => ({ id: "d1", channel: "linkedin", url: "https://www.linkedin.com/posts/x", fetched_at: "2026-10-20", fetch_method: "public_page_read", excerpt: "Does SolarAPP+ also handle the utility interconnection approval?", topic_key: "solarapp-vs-pto", ...over });
const reply = (over = {}) => ({
	discussion_id: "d1",
	draft: "SolarAPP+ covers the city building permit review. The utility's interconnection approval and Permission to Operate are separate steps.",
	claims: [{ draft_phrase: "separate steps", source: { url: "https://help.gosolarapp.org/article/161-how-is-solarapp-different-from-typical-permitting", publisher: "SolarAPP+ Help Center", date_checked: "2026-10-20" } }],
	include_link: false,
	...over,
});
const rctx = (over = {}) => ({ today: "2026-10-21", ledger: [], builtPages: new Set(["/california/"]), ...over });

test("a grounded reply to a freshly read discussion is READY_FOR_HUMAN_REVIEW and draft-only", () => {
	const r = evaluateReply(reply(), [discussion()], rctx());
	assert.equal(r.status, "READY_FOR_HUMAN_REVIEW");
	assert.equal(r.draft_only, true);
	assert.equal(r.posted, false);
	assert.equal(r.owner_approval_required, true);
});

test("replies are blocked without a real, fresh, publicly read discussion", () => {
	assert.equal(evaluateReply(reply({ discussion_id: "nope" }), [discussion()], rctx()).status, "BLOCKED");
	for (const over of [{ fetch_method: "invented" }, { excerpt: "" }, { fetched_at: "2026-10-01" }, { url: "http://x" }]) {
		assert.equal(evaluateReply(reply(), [discussion(over)], rctx()).status, "BLOCKED", JSON.stringify(over));
	}
});

test("replies never invent experience, stuff hashtags, add a stray link or repeat a discussion", () => {
	const codes = (over, d = discussion(), c = rctx()) => evaluateReply(reply(over), [d], c).issues.map((i) => i.code);
	assert.ok(codes({ draft: "We installed this last year and separate steps matter." }).includes("invented_first_person_experience"));
	assert.ok(codes({ draft: "These are separate steps #solar" }).includes("hashtag_in_reply"));
	assert.ok(codes({ draft: "These are separate steps https://mygridpermit.com/california/" }).includes("link_present_but_include_link_false"));
	assert.ok(codes({}, discussion(), rctx({ ledger: [{ discussion_id: "d1" }] })).includes("already_replied_to_this_discussion"));
	assert.ok(codes({ claims: [] }).includes("no_claims_recorded"));
	assert.ok(codes({ draft: "Nothing matches here." }).includes("claim_not_in_draft"));
	assert.ok(codes({ draft: "These are separate steps. Unlock savings today." }).includes("hype_phrase"));
	assert.ok(codes({ draft: "a".repeat(300) + " separate steps" }, discussion({ channel: "x" })).includes("reply_too_long"));
});

test("a reply link must be the exact UTM URL of a built page", () => {
	const url = "https://mygridpermit.com/california/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=reply_solarapp_pto";
	const ok = evaluateReply(reply({ include_link: true, page_path: "/california/", utm_campaign: "reply_solarapp_pto", draft: `Separate steps: ${url}` }), [discussion()], rctx());
	assert.equal(ok.status, "READY_FOR_HUMAN_REVIEW");
	const wrong = evaluateReply(reply({ include_link: true, page_path: "/california/", utm_campaign: "reply_solarapp_pto", draft: "Separate steps: https://mygridpermit.com/california/" }), [discussion()], rctx());
	assert.ok(wrong.issues.some((i) => i.code === "link_not_the_exact_utm_url"));
});

test("the review queue caps suggestions per channel so replies never become spam", () => {
	const ds = Array.from({ length: 5 }, (_, i) => discussion({ id: `d${i}`, url: `https://www.linkedin.com/posts/${i}` }));
	const words = ["alpha river stone", "maple orbit canyon", "violet harbor ember", "quartz meadow lantern", "willow summit prism"];
	const rs = ds.map((d, i) => reply({ discussion_id: d.id, draft: `${words[i]} notes: these are separate steps` }));
	const q = buildReplyQueue(rs, ds, rctx());
	assert.equal(q.counts.ready_for_human_review, 3);
	assert.equal(q.items.filter((i) => i.status === "DEFERRED_RATE_CAP").length, 2);
	assert.equal(q.safety.auto_reply, false);
});

test("the checked-in discussion file is empty: no discussion is ever fabricated", () => {
	const f = JSON.parse(readFileSync("data/distribution/discussions.json", "utf8"));
	assert.deepEqual(f.discussions, []);
	assert.deepEqual(f.replies, []);
});

test("replies already published are recorded, block a second reply and count toward the 7-day cap", () => {
	const d = discussion();
	const item = evaluateReply(reply(), [d], rctx());
	const evidence = { date: "2026-10-20", permalink: "https://www.linkedin.com/feed/update/urn:li:activity:1/", approval_ref: "owner-1", identity_verified: true, posted_text_sha256: item.text_sha256 };
	const next = recordReplyPublication([], item, evidence);
	assert.equal(next[0].kind, "reply");
	assert.equal(next[0].discussion_id, "d1");
	assert.throws(() => recordReplyPublication(next, item, evidence), /already has a recorded reply/);
	assert.throws(() => recordReplyPublication([], item, { ...evidence, posted_text_sha256: "0".repeat(64) }), /refused/);
	assert.throws(() => recordReplyPublication([], { ...item, status: "BLOCKED" }, evidence), /not ready/);
	// the recorded reply now blocks the same discussion and a near-duplicate text
	assert.ok(evaluateReply(reply(), [d], rctx({ ledger: next })).issues.some((i) => i.code === "already_replied_to_this_discussion"));
	const d2 = discussion({ id: "d2", url: "https://www.linkedin.com/posts/y" });
	assert.ok(evaluateReply(reply({ discussion_id: "d2" }), [d2], rctx({ ledger: next })).issues.some((i) => i.code === "near_duplicate_of_prior_reply"));
	// cap: two recent replies on the channel leave room for one more, older ones do not count
	const mk = (id, date) => ({ kind: "reply", discussion_id: id, channel: "linkedin", date, text: `unrelated words ${id}` });
	const ds = ["a", "b", "c"].map((id) => discussion({ id: `n${id}`, url: `https://www.linkedin.com/posts/${id}` }));
	const rs = ds.map((x, i) => reply({ discussion_id: x.id, draft: `${["alpha river", "maple orbit", "violet harbor"][i]} notes: these are separate steps` }));
	const q = buildReplyQueue(rs, ds, rctx({ ledger: [mk("x1", "2026-10-19"), mk("x2", "2026-10-18"), mk("old", "2026-09-01")] }));
	assert.equal(q.counts.ready_for_human_review, 1);
	assert.equal(q.items.filter((i) => i.status === "DEFERRED_RATE_CAP").length, 2);
});

test("experience claims in common forms are caught, plain company voice is not", () => {
	const flagged = ["I recently installed panels", "We have gone through this ourselves", "I've filed twice", "Our team has submitted 40 permits", "my family waited months", "We got approval in a week"];
	for (const f of flagged) {
		const r = evaluateReply(reply({ draft: `${f}. These are separate steps.` }), [discussion()], rctx());
		assert.ok(r.issues.some((i) => i.code === "invented_first_person_experience"), f);
	}
	for (const ok of ["SolarAPP+ covers the city building permit review.", "The utility's approval is a separate step.", "The guide explains which office handles which approval."]) {
		const r = evaluateReply(reply({ draft: `${ok} These are separate steps.` }), [discussion()], rctx());
		assert.ok(!r.issues.some((i) => i.code === "invented_first_person_experience"), ok);
	}
});

test("a reply carries the engagement gate: disabled unless the owner opened it, and never performed by the tool", () => {
	const closed = evaluateReply(reply(), [discussion()], rctx({ gate: gateFile }));
	assert.equal(closed.engagement_gate.status, "DISABLED");
	const opened = evaluateReply(reply(), [discussion()], rctx({ gate: open() }));
	assert.equal(opened.engagement_gate.status, "OWNER_MAY_ENGAGE_MANUALLY");
	assert.equal(opened.engagement_gate.tool_will_engage, false);
	assert.equal(opened.posted, false);
});
