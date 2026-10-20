// Controls around organic distribution PREPARATION: the publishing gate, the
// publication ledger and reply suggestions for real public discussions.
//
// Nothing here posts, likes, replies, follows or contacts anyone. The gate only
// describes whether a human would be allowed to publish; the tooling stays
// preparation-only either way. A reply is only ever suggested for a discussion
// that was actually read (URL, fetch date, excerpt), never invented.

import { CHANNELS, daysBetween, lintDraft, similarity, sha256, utmUrl, DUPLICATE_SIMILARITY, MAX_CHECK_AGE_DAYS } from "./distribution-queue.mjs";

export const MAX_REPLY_SUGGESTIONS_PER_CHANNEL_PER_7_DAYS = 3;
export const MAX_REPLY_CHARS = { x: 280, linkedin: 1250 };
// A company account must not claim experiences it cannot evidence. Flags a
// first-person pronoun followed within a few words by an experience verb, in simple
// and perfect forms ("I recently installed", "we have gone through", "I've filed",
// "our team has submitted"). Deliberately over-inclusive: a human reviews every draft.
const FIRST_PERSON_EXPERIENCE = /\b(?:i|i've|i'd|we|we've|we'd|my|our)\b(?:\s+[\w'-]+){0,4}?\s+(?:installed|had|got|gotten|gone|went|used|tried|filed|submitted|experienced|waited|paid|received|dealt|worked|signed|applied|approved|passed|failed)\b/i;
const PERMALINK_HOSTS = { linkedin: ["www.linkedin.com", "linkedin.com"], x: ["x.com", "twitter.com", "www.x.com"] };

// gate = data/distribution/publishing-gate.json
export function evaluateGate(gate, channel, approvalRef) {
	const reasons = [];
	const g = gate?.channels?.[channel];
	if (!CHANNELS[channel]) reasons.push("unknown channel");
	if (!gate || gate.publishing_enabled !== true) reasons.push("publishing_enabled is not true");
	if (!g) reasons.push("channel not configured in the gate");
	else {
		if (g.identity_verified !== true) reasons.push("account identity not verified");
		if (g.access_verified !== true) reasons.push("account access not verified");
		if (!g.owner_permission_ref) reasons.push("no owner permission reference for this channel");
		if (g.personal_profile === true) reasons.push("a personal profile is not an allowed publishing surface");
	}
	if (!approvalRef) reasons.push("no owner approval reference for this exact text");
	return {
		status: reasons.length ? "DISABLED" : "OWNER_MAY_PUBLISH_MANUALLY",
		reasons,
		// Even when every check passes, this tooling never publishes.
		tool_will_publish: false,
	};
}

export function engagementGate(gate) {
	return gate?.engagement_enabled === true
		? { status: "OWNER_MAY_ENGAGE_MANUALLY", reasons: [], tool_will_engage: false }
		: { status: "DISABLED", reasons: ["engagement_enabled is not true: no likes, comments, follows or replies"], tool_will_engage: false };
}

export function applyGate(queue, gate) {
	const items = queue.items.map((it) => ({ ...it, gate: evaluateGate(gate, it.channel, null), publish_allowed: false }));
	return { ...queue, items, engagement_gate: engagementGate(gate) };
}

// Validates and appends one publication record. Pure: returns a new entries array.
export function recordPublication(entries, item, evidence) {
	const problems = [];
	const host = (() => {
		try {
			return new URL(evidence.permalink).hostname;
		} catch {
			return null;
		}
	})();
	if (!item || item.status === "BLOCKED") problems.push("queue item is missing or blocked");
	if (!PERMALINK_HOSTS[item?.channel]?.includes(host)) problems.push("permalink is not on the item's channel host");
	if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.date ?? "")) problems.push("date must be YYYY-MM-DD");
	if (!evidence.approval_ref) problems.push("owner approval reference required");
	if (evidence.identity_verified !== true) problems.push("account identity must be verified at publication time");
	if (evidence.posted_text_sha256 !== item?.text_sha256) problems.push("posted text does not match the approved text (sha256 differs)");
	if (entries.some((e) => e.topic_key === item?.topic_key && e.channel === item?.channel && e.status === "published")) problems.push("topic already published on this channel");
	if (problems.length) throw new Error(`Publication record refused: ${problems.join("; ")}`);
	return [...entries, { kind: "post", topic_key: item.topic_key, channel: item.channel, status: "published", date: evidence.date, text_sha256: item.text_sha256, permalink: evidence.permalink, approval_ref: evidence.approval_ref }];
}

// Records a published reply so the duplicate and rate guards can see it later.
export function recordReplyPublication(entries, item, evidence) {
	const problems = [];
	const host = (() => {
		try {
			return new URL(evidence.permalink).hostname;
		} catch {
			return null;
		}
	})();
	if (!item || item.status !== "READY_FOR_HUMAN_REVIEW") problems.push("reply item is missing or not ready");
	if (!PERMALINK_HOSTS[item?.channel]?.includes(host)) problems.push("permalink is not on the reply's channel host");
	if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.date ?? "")) problems.push("date must be YYYY-MM-DD");
	if (!evidence.approval_ref) problems.push("owner approval reference required");
	if (evidence.identity_verified !== true) problems.push("account identity must be verified at publication time");
	if (evidence.posted_text_sha256 !== item?.text_sha256) problems.push("posted text does not match the approved text (sha256 differs)");
	if (entries.some((e) => e.kind === "reply" && e.discussion_id === item?.discussion_id)) problems.push("this discussion already has a recorded reply");
	if (problems.length) throw new Error(`Reply record refused: ${problems.join("; ")}`);
	return [...entries, { kind: "reply", discussion_id: item.discussion_id, channel: item.channel, status: "published", date: evidence.date, text: item.text, text_sha256: item.text_sha256, permalink: evidence.permalink, approval_ref: evidence.approval_ref }];
}

// discussion = { id, channel, url, fetched_at, fetch_method, excerpt, topic_key }
// reply = { discussion_id, draft, claims:[{draft_phrase, source:{url, publisher, date_checked, evidence_date}}], include_link:boolean, page_path?, utm_campaign? }
export function evaluateReply(reply, discussions, ctx) {
	const issues = [];
	const d = discussions.find((x) => x.id === reply.discussion_id);
	if (!d) return { discussion_id: reply.discussion_id, status: "BLOCKED", issues: [{ level: "block", code: "discussion_not_found" }] };
	const block = (code, detail) => issues.push({ level: "block", code, ...(detail ? { detail } : {}) });
	if (!CHANNELS[d.channel]) block("unknown_channel");
	if (!/^https:\/\//.test(d.url ?? "")) block("discussion_url_missing");
	if (d.fetch_method !== "public_page_read") block("discussion_not_read_from_a_public_page", d.fetch_method);
	if (!d.excerpt || d.excerpt.length < 20) block("discussion_excerpt_missing");
	const age = daysBetween(d.fetched_at, ctx.today);
	if (age === null) block("discussion_fetch_date_invalid");
	else if (age > MAX_CHECK_AGE_DAYS) block("discussion_snapshot_stale", `${age} days old; re-read the live thread`);
	const priorReplies = ctx.ledger.filter((e) => e.kind === "reply" || e.discussion_id);
	if (priorReplies.some((e) => e.discussion_id === d.id)) block("already_replied_to_this_discussion");
	const text = reply.draft ?? "";
	if (!text.trim()) block("empty_draft");
	for (const i of lintDraft(text, d.channel).filter((i) => !["too_long", "too_many_hashtags"].includes(i.code))) issues.push(i);
	if (text.length > (MAX_REPLY_CHARS[d.channel] ?? 0)) block("reply_too_long", `${text.length}/${MAX_REPLY_CHARS[d.channel]}`);
	if (/#\w/.test(text)) block("hashtag_in_reply");
	if (FIRST_PERSON_EXPERIENCE.test(text)) block("invented_first_person_experience");
	const urls = text.match(/https?:\/\/\S+/g) ?? [];
	if (reply.include_link) {
		const expected = reply.page_path && reply.utm_campaign ? utmUrl(reply.page_path, d.channel, reply.utm_campaign) : null;
		if (!expected || urls.length !== 1 || urls[0] !== expected) block("link_not_the_exact_utm_url");
		if (!ctx.builtPages.has(reply.page_path)) block("link_page_not_built", reply.page_path);
	} else if (urls.length) block("link_present_but_include_link_false");
	if (!(reply.claims ?? []).length) block("no_claims_recorded");
	for (const [i, c] of (reply.claims ?? []).entries()) {
		if (!text.toLowerCase().includes(String(c.draft_phrase ?? "\u0000").toLowerCase())) block("claim_not_in_draft", `claim ${i + 1}`);
		if (!/^https:\/\//.test(c.source?.url ?? "") || !c.source?.publisher) block("claim_source_incomplete", `claim ${i + 1}`);
		const checked = daysBetween(c.source?.date_checked, ctx.today);
		if (checked === null || checked > MAX_CHECK_AGE_DAYS) block("claim_source_check_stale", `claim ${i + 1}`);
	}
	for (const e of priorReplies) if (e.text && similarity(e.text, text) >= DUPLICATE_SIMILARITY) block("near_duplicate_of_prior_reply");
	return {
		id: `reply:${d.id}`,
		discussion_id: d.id,
		channel: d.channel,
		discussion_url: d.url,
		discussion_excerpt: d.excerpt,
		status: issues.some((i) => i.level === "block") ? "BLOCKED" : "READY_FOR_HUMAN_REVIEW",
		draft_only: true,
		owner_approval_required: true,
		posted: false,
		// A reply is engagement: it needs the engagement gate, which is disabled unless the owner opens it.
		engagement_gate: engagementGate(ctx.gate),
		text,
		text_sha256: sha256(text),
		claims: reply.claims ?? [],
		issues,
	};
}

export function buildReplyQueue(replies, discussions, ctx) {
	const items = replies.map((r) => evaluateReply(r, discussions, ctx));
	// Spam guard: at most MAX_REPLY_SUGGESTIONS_PER_CHANNEL_PER_7_DAYS replies per channel
	// per rolling 7 days, counting replies already recorded in the ledger and the
	// suggestions in this queue. The rest wait.
	const recentReplies = (channel) => ctx.ledger.filter((e) => (e.kind === "reply" || e.discussion_id) && e.channel === channel && (daysBetween(e.date, ctx.today) ?? 99) < 7).length;
	const perChannel = new Map();
	for (const it of items.filter((i) => i.status === "READY_FOR_HUMAN_REVIEW").sort((a, b) => a.id.localeCompare(b.id))) {
		const n = (perChannel.get(it.channel) ?? recentReplies(it.channel)) + 1;
		perChannel.set(it.channel, n);
		if (n > MAX_REPLY_SUGGESTIONS_PER_CHANNEL_PER_7_DAYS) {
			it.status = "DEFERRED_RATE_CAP";
			it.issues.push({ level: "block", code: "reply_rate_cap", detail: `max ${MAX_REPLY_SUGGESTIONS_PER_CHANNEL_PER_7_DAYS} replies per channel per rolling 7 days, including recorded replies` });
		}
	}
	return {
		generated_for: ctx.today,
		safety: { auto_reply: false, auto_engage: false, account_access: false },
		counts: { total: items.length, ready_for_human_review: items.filter((i) => i.status === "READY_FOR_HUMAN_REVIEW").length, blocked_or_deferred: items.filter((i) => i.status !== "READY_FOR_HUMAN_REVIEW").length },
		items,
	};
}
