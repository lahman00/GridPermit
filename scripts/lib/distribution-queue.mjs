// Organic distribution PREPARATION. Pure functions that turn source-backed
// candidate insights into a human-review queue. Nothing here posts, likes,
// replies, contacts a partner or touches an account: every queue item is
// DRAFT_ONLY with owner_approval_required=true, and the CLI only writes local
// review files.

import { createHash } from "node:crypto";
import { findProhibitedClaims } from "./acquisition-pack.mjs";

export const SITE_HOST = "mygridpermit.com";
export const CHANNELS = Object.freeze({
	linkedin: { label: "LinkedIn (company page)", maxChars: 3000, maxHashtags: 2, utmSource: "linkedin" },
	x: { label: "X (@Grid_Permit)", maxChars: 280, maxHashtags: 1, utmSource: "x" },
});
export const X_URL_WEIGHT = 23;
export const MAX_SOURCE_AGE_DAYS = 180;
export const MAX_CHECK_AGE_DAYS = 7;
export const DUPLICATE_SIMILARITY = 0.55;

// Phrases that mark generic marketing/chatbot copy or promises GridPermit
// cannot support. Heuristic lint only: the ben-adam pass and the owner review
// remain the real editorial gates.
const HYPE = [
	/\bgame[- ]?chang/i, /\bunlock(?:s|ed|ing)?\b/i, /\brevolution/i, /\bseamless/i, /\bexcited to\b/i, /\bthrilled\b/i,
	/\bdelve\b/i, /\bdon'?t miss\b/i, /\blimited time\b/i, /\bsave (?:thousands|\$|money)\b/i, /\bfastest\b/i, /\binstant approval\b/i,
	/\bin today'?s (?:fast|ever)/i, /\bleverage\b/i, /\bstreamline your\b/i,
];
const COMMERCIAL = [/comparesolarprices/i, /\bget (?:a |your )?(?:free )?quotes?\b/i, /\bcommission\b/i, /\baffiliate\b/i];

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function daysBetween(fromIso, toIso) {
	const a = Date.parse(fromIso);
	const b = Date.parse(toIso);
	if (Number.isNaN(a) || Number.isNaN(b)) return null;
	return Math.floor((b - a) / 86400000);
}

const STOP = new Set("a an and are as at be by for from has have in is it its of on or that the this to with we our now also".split(" "));
export function tokens(text) {
	return String(text)
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/[^a-z0-9+&\s]/g, " ")
		.split(/\s+/)
		.filter((t) => t && !STOP.has(t));
}
export function similarity(a, b) {
	const A = new Set(tokens(a));
	const B = new Set(tokens(b));
	if (A.size === 0 || B.size === 0) return 0;
	let inter = 0;
	for (const t of A) if (B.has(t)) inter++;
	return inter / (A.size + B.size - inter);
}

export function weightedLength(text) {
	return String(text).replace(/https?:\/\/\S+/g, "x".repeat(X_URL_WEIGHT)).length;
}

export function utmUrl(pagePath, channel, campaign) {
	if (!CHANNELS[channel]) throw new Error(`unknown channel ${channel}`);
	if (!/^\/[a-z0-9\-/]*$/.test(pagePath)) throw new Error(`invalid page path ${pagePath}`);
	if (!/^[a-z0-9_]+$/.test(campaign)) throw new Error(`invalid campaign ${campaign}`);
	const q = new URLSearchParams({ utm_source: CHANNELS[channel].utmSource, utm_medium: "organic_social", utm_campaign: campaign });
	return `https://${SITE_HOST}${pagePath}?${q.toString()}`;
}

function hashtagCount(text) {
	return (String(text).match(/(^|\s)#\w+/g) ?? []).length;
}

export function lintDraft(text, channel) {
	const cfg = CHANNELS[channel];
	const issues = [];
	if (!cfg) return [{ level: "block", code: "unknown_channel" }];
	if (/—|--/.test(text)) issues.push({ level: "block", code: "long_dash" });
	const len = channel === "x" ? weightedLength(text) : text.length;
	if (len > cfg.maxChars) issues.push({ level: "block", code: "too_long", detail: `${len}/${cfg.maxChars}` });
	if (hashtagCount(text) > cfg.maxHashtags) issues.push({ level: "block", code: "too_many_hashtags" });
	if ((text.match(/!/g) ?? []).length > 0) issues.push({ level: "warn", code: "exclamation" });
	if ((text.match(/\p{Extended_Pictographic}/gu) ?? []).length > 1) issues.push({ level: "warn", code: "emoji" });
	for (const re of HYPE) if (re.test(text)) issues.push({ level: "block", code: "hype_phrase", detail: String(re) });
	for (const re of COMMERCIAL) if (re.test(text)) issues.push({ level: "block", code: "commercial_language", detail: String(re) });
	for (const id of findProhibitedClaims(text)) issues.push({ level: "block", code: "prohibited_claim", detail: id });
	return issues;
}

function check(cond, level, code, detail, out) {
	if (!cond) out.push({ level, code, ...(detail ? { detail } : {}) });
}

// Evaluates one candidate against run context. ctx = {
//   today, builtPages: Set<path>, sitemap: Set<path>, noindexPages: Set<path>,
//   ledger: [{topic_key, channel, status, date, text_sha256?, text?}] }
export function evaluateCandidate(c, ctx) {
	const issues = [];
	const pagePath = c.page_path;
	check(ctx.builtPages.has(pagePath), "block", "page_not_built", pagePath, issues);
	check(ctx.sitemap.has(pagePath), "block", "page_not_in_sitemap", pagePath, issues);
	check(!ctx.noindexPages.has(pagePath), "block", "page_noindex", pagePath, issues);
	check(Array.isArray(c.claims) && c.claims.length > 0, "block", "no_claims_recorded", null, issues);

	for (const [i, claim] of (c.claims ?? []).entries()) {
		const tag = `claim ${i + 1}`;
		const s = claim.source ?? {};
		check(/^https:\/\//.test(s.url ?? ""), "block", "claim_source_missing_url", tag, issues);
		check(Boolean(s.publisher), "block", "claim_source_missing_publisher", tag, issues);
		const checkedAge = daysBetween(s.date_checked, ctx.today);
		if (checkedAge === null) issues.push({ level: "block", code: "claim_source_missing_check_date", detail: tag });
		else if (checkedAge > MAX_CHECK_AGE_DAYS) issues.push({ level: "block", code: "claim_source_check_stale", detail: `${tag}: ${checkedAge}d old, live recheck required` });
		if (!s.evidence_date) issues.push({ level: "warn", code: "claim_source_undated", detail: tag });
		else {
			const age = daysBetween(s.evidence_date, ctx.today);
			if (age === null) issues.push({ level: "block", code: "claim_source_bad_date", detail: tag });
			else if (age > MAX_SOURCE_AGE_DAYS) issues.push({ level: "block", code: "claim_source_too_old", detail: `${tag}: ${age}d` });
		}
	}

	const items = [];
	for (const channel of c.channels ?? []) {
		const draft = c.drafts?.[channel];
		const chIssues = [];
		if (!CHANNELS[channel] || typeof draft !== "string" || !draft.trim()) {
			chIssues.push({ level: "block", code: "missing_draft", detail: channel });
		} else {
			chIssues.push(...lintDraft(draft, channel));
			const url = utmUrl(pagePath, channel, c.utm_campaign);
			check(draft.includes(url), "block", "draft_missing_exact_utm_url", url, chIssues);
			const allUrls = draft.match(/https?:\/\/\S+/g) ?? [];
			check(allUrls.every((u) => u === url), "block", "draft_has_other_urls", allUrls.filter((u) => u !== url).join(" "), chIssues);
			for (const [i, claim] of (c.claims ?? []).entries()) {
				if (claim.channels && !claim.channels.includes(channel)) continue;
				check(draft.toLowerCase().includes(String(claim.draft_phrase ?? "\u0000").toLowerCase()), "block", "claim_not_in_draft", `claim ${i + 1}`, chIssues);
			}
			for (const row of ctx.ledger) {
				if (row.topic_key === c.topic_key && row.channel === channel && ["published", "draft_not_published"].includes(row.status)) {
					chIssues.push({ level: "block", code: "duplicate_topic_in_ledger", detail: `${row.status} ${row.date}` });
				}
				if (row.text && row.channel === channel && similarity(row.text, draft) >= DUPLICATE_SIMILARITY) {
					chIssues.push({ level: "block", code: "duplicate_text_in_ledger", detail: row.date });
				}
			}
		}
		const all = [...issues, ...chIssues];
		const blocked = all.some((i) => i.level === "block");
		items.push({
			id: `${c.id}:${channel}`,
			candidate_id: c.id,
			channel,
			channel_label: CHANNELS[channel]?.label ?? channel,
			topic_key: c.topic_key,
			status: blocked ? "BLOCKED" : "READY_FOR_HUMAN_REVIEW",
			draft_only: true,
			owner_approval_required: true,
			publish_allowed: false,
			posted: false,
			destination: CHANNELS[channel] ? utmUrl(pagePath, channel, c.utm_campaign) : null,
			page_path: pagePath,
			text: draft ?? null,
			text_sha256: typeof draft === "string" ? sha256(draft) : null,
			claims: (c.claims ?? []).filter((claim) => !claim.channels || claim.channels.includes(channel)),
			issues: all,
			pre_publish_checks: [
				"Confirm the posting identity and that the feed/queue has no identical or scheduled post (live check).",
				"Re-open the destination URL and confirm HTTP 200 and the expected page.",
				"Re-check every cited source on the day of posting.",
				"Owner approval for this exact text is required before anything is published.",
			],
		});
	}
	return items;
}

// Flags near-duplicates inside the same run (same channel) and orders output
// deterministically: ready items first, then by candidate id and channel.
export function buildQueue(candidates, ctx) {
	let items = candidates.flatMap((c) => evaluateCandidate(c, ctx));
	for (const a of items) {
		for (const b of items) {
			if (a === b || a.channel !== b.channel || !a.text || !b.text || a.id >= b.id) continue;
			if (similarity(a.text, b.text) >= DUPLICATE_SIMILARITY) {
				for (const x of [a, b]) {
					x.issues.push({ level: "block", code: "duplicate_within_queue", detail: a.id === x.id ? b.id : a.id });
					x.status = "BLOCKED";
				}
			}
		}
	}
	items = items.sort((x, y) => (x.status === y.status ? x.id.localeCompare(y.id) : x.status === "READY_FOR_HUMAN_REVIEW" ? -1 : 1));
	return {
		generated_for: ctx.today,
		safety: { auto_post: false, auto_engage: false, partner_contact: false, account_access: false },
		counts: {
			total: items.length,
			ready_for_human_review: items.filter((i) => i.status === "READY_FOR_HUMAN_REVIEW").length,
			blocked: items.filter((i) => i.status === "BLOCKED").length,
		},
		items,
		utm_ledger: items.filter((i) => i.destination).map((i) => ({ id: i.id, channel: i.channel, destination: i.destination, page_path: i.page_path })),
	};
}

export function renderQueueMarkdown(queue) {
	const lines = [
		`# GridPermit organic distribution review queue (${queue.generated_for})`,
		"",
		"**DRAFT ONLY. NOT PUBLISHED.** Nothing in this file has been posted, liked, replied to or sent. Each item needs the owner's approval of its exact text, plus the live checks listed under it.",
		"",
		`Items: ${queue.counts.total}. Ready for human review: ${queue.counts.ready_for_human_review}. Blocked: ${queue.counts.blocked}.`,
		"",
	];
	for (const it of queue.items) {
		lines.push(`## ${it.id}: ${it.status}`, "", `Channel: ${it.channel_label}`, `Destination: ${it.destination ?? "n/a"}`, `Text SHA-256: ${it.text_sha256 ?? "n/a"}`, "");
		if (it.text) lines.push("```", it.text, "```", "");
		lines.push("Claims and sources:");
		for (const c of it.claims) lines.push(`- "${c.draft_phrase}" — ${c.source?.publisher} ${c.source?.url} (checked ${c.source?.date_checked}; evidence date ${c.source?.evidence_date ?? "UNKNOWN"})`);
		lines.push("");
		if (it.issues.length) {
			lines.push("Issues:");
			for (const i of it.issues) lines.push(`- [${i.level}] ${i.code}${i.detail ? `: ${i.detail}` : ""}`);
			lines.push("");
		}
		lines.push("Before publishing:", ...it.pre_publish_checks.map((c) => `- ${c}`), "");
	}
	return lines.join("\n");
}
