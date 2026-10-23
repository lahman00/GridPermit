// Growth Command Center: one operational report that assembles the existing
// evidence (search, funnel, freshness, distribution, link graph) and ranks the
// next actions. It computes nothing new about the world and invents no number:
// every metric line carries its source, date range and limitation, and a stage
// with no supplied source stays UNKNOWN or NOT_MEASURED.

import { MIN_IMPRESSIONS } from "./search-opportunities.mjs";

const UNK = "UNKNOWN";

export function metric(label, value, source, range, limitation) {
	return { label, value, source, range, limitation };
}

function observationLocks(lockedPaths) {
	return [...lockedPaths.entries()].map(([path, reasons]) => ({ path, reasons }));
}

// Next actions are derived from the supplied evidence, ordered by the fixed
// precedence below, never by a numeric score:
//   1 evidence an agent or the owner can supply now (unblocks measurement)
//   2 review of regulatory content with real demand
//   3 improvements to unlocked pages with search evidence
//   4 distribution readiness
//   5 waiting (observation windows)
export function deriveNextActions({ funnel, search, freshness, queue, gate, observation, sibling }) {
	const actions = [];
	const missing = Object.entries(funnel.source_status).filter(([, v]) => v === "NOT_SUPPLIED").map(([k]) => k);
	if (missing.length) {
		actions.push({
			precedence: 1,
			owner: "OWNER",
			title: "לספק את ייצואי המדידה החסרים",
			detail: `לא סופקו: ${missing.join(", ")}. עד אז השלבים האלה נשארים UNKNOWN. GA4 צריך דוח landing page x source/medium עם האירועים שמפורטים ב-docs/GROWTH_COMMAND_CENTER.md. ייצוא ה-outbound דורש טוקן Netlify שכבר בשליטת הבעלים. דוח שותף דורש נרמול על ידי הבעלים באמצעות המתאם הרשום.`,
			needs_approval: false,
		});
	}
	const review = freshness.rows.filter((r) => ["REVIEW_NOW", "REVIEW_SOON"].includes(r.tier) && r.reasons.some((x) => x.severity !== "LOW"));
	const withDemand = review.filter((r) => typeof r.demand_impressions === "number");
	if (withDemand.length) {
		const top = withDemand.slice(0, 5);
		actions.push({
			precedence: 2,
			owner: "AGENT_WITH_OFFICIAL_SOURCES",
			title: "לבדוק מחדש מול מקורות רשמיים את הרשומות עם הביקוש הגבוה ביותר בתור הרעננות",
			detail: top.map((r) => `${r.path} (${r.demand_impressions} חשיפות, ${r.tier}: ${[...new Set(r.reasons.filter((x) => x.severity !== "LOW").map((x) => x.code))].join(", ")})`).join("; "),
			needs_approval: false,
		});
	}
	if (sibling && sibling.zero_sibling_links > 0) {
		actions.push({
			precedence: 3,
			owner: "AGENT_THEN_OWNER_APPROVAL",
			title: "להרחיב קישור פנימי מאוזן אחרי שחלון המדידה של הפיילוט הראשון מבשיל",
			detail: `${sibling.zero_sibling_links} מתוך ${sibling.locality_pages} מדריכי ערים לא מקבלים אף קישור ממדריך עיר אחר. הפיילוט הנוכחי מכסה ${sibling.in_scope_pages} עמודים. הרחבה לאזורים נוספים רק אחרי מדידה מול אזור ביקורת.`,
			needs_approval: true,
		});
	}
	for (const p of search.actionable.slice(0, 3)) {
		actions.push({
			precedence: 3,
			owner: "AGENT_THEN_OWNER_APPROVAL",
			title: `לשפר את העמוד הקיים ${p.path}`,
			detail: `${p.classification}: ${p.impressions} חשיפות, ${p.clicks} קליקים, מיקום ממוצע ${p.position} בטווח ${search.meta.window_start}..${search.meta.window_end}. לא נעול. כל שינוי נוסח דורש סקירת מקורות רשמיים לאותה עיר ו-PR.`,
			needs_approval: true,
		});
	}
	const mismatchPages = new Set(search.intent_mismatch_hypotheses.map((m) => m.path));
	if (mismatchPages.size >= 3) {
		const cluster = search.query_clusters.find((c) => /permit services/.test(c.template));
		actions.push({
			precedence: 3,
			owner: "AGENT_THEN_OWNER_APPROVAL",
			title: "לבדוק את השערת כוונת השירות",
			detail: `${mismatchPages.size} מדריכי ערים הוצגו לשאילתות של שירותי היתרים (${cluster ? `${cluster.impressions} חשיפות, 0 קליקים, מיקום משוקלל ${cluster.weighted_position}` : "ראו רשימת אשכולות"}). זו השערה: מדריך מידע אולי לא תואם שאילתה של שכירת שירות. התבנית היחידה שנסקרה היא בלוק "מי מגיש את ההיתר" לכל עיר, שדורש סקירת מקורות רשמיים עיר אחר עיר. אין להוסיף בלוק גנרי.`,
			needs_approval: true,
		});
	}
	if (queue.counts.ready_for_human_review > 0) {
		actions.push({
			precedence: 4,
			owner: "OWNER",
			title: "להחליט על טיוטות הפוסטים המוכנות",
			detail: `${queue.counts.ready_for_human_review} טיוטות מוכנות לסקירה. הפרסום נשאר כבוי: מצב השער ${gate.status}. הבעלים צריך לאמת את החשבון העסקי המדויק, הגישה וההרשאה, ואז לפרסם ידנית. הכלי לעולם לא מפרסם.`,
			needs_approval: true,
		});
	}
	if (observation.length) {
		actions.push({
			precedence: 5,
			owner: "WAIT",
			title: "לא לגעת בעמודים הנעולים",
			detail: `${observation.length} עמודים בתוך חלון מדידה או ניסוי (${[...new Set(observation.flatMap((o) => o.reasons))].join("; ")}). לא לערוך עד שהמדידה מבשילה.`,
			needs_approval: false,
		});
	}
	return actions.sort((a, b) => a.precedence - b.precedence);
}

// Locality-to-locality link health from a build snapshot. A guide counts as
// "starved" when no other locality guide links to it.
export function localitySiblingStats(snapshot, scopePages = []) {
	const localities = Object.keys(snapshot.pages).filter((p) => /\/solar-permit-guide\/$/.test(p));
	const inbound = new Map(localities.map((p) => [p, 0]));
	for (const p of localities) {
		for (const l of snapshot.pages[p].internal_links) if (l !== p && inbound.has(l)) inbound.set(l, inbound.get(l) + 1);
	}
	const vals = [...inbound.values()].sort((a, b) => a - b);
	return {
		locality_pages: localities.length,
		zero_sibling_links: vals.filter((v) => v === 0).length,
		median_sibling_links: vals[Math.floor(vals.length / 2)] ?? 0,
		max_sibling_links: vals.at(-1) ?? 0,
		in_scope_pages: scopePages.length,
		in_scope_inbound: Object.fromEntries(scopePages.filter((p) => inbound.has(p)).map((p) => [p, inbound.get(p)])),
	};
}

export function buildCommandCenter(inputs) {
	const { today, search, funnel, freshness, queue, replies, gate, ledgerEntries, lockedPaths, linkGraph, sibling } = inputs;
	const observation = observationLocks(lockedPaths);
	const pageSum = search.pages.reduce((s, p) => ({ clicks: s.clicks + p.clicks, impressions: s.impressions + p.impressions }), { clicks: 0, impressions: 0 });
	const w = `${search.meta.window_start}..${search.meta.window_end}`;
	const gscSrc = `GSC API export, queried ${search.meta.queried_at_utc}, sha256 ${search.meta.sha256.slice(0, 12)}`;
	const sec = {
		traffic: [
			metric("קליקים ב-GSC, סכום שורות עמוד", pageSum.clicks, gscSrc, w, "סכום ממד העמוד בייצוא הזה, לא סך הנכס; השורות אינן חיבוריות עם שורות שאילתה או מדינה."),
			metric("חשיפות ב-GSC, סכום שורות עמוד", pageSum.impressions, gscSrc, w, "כמו למעלה."),
			metric("סשנים וכניסות אורגניות ב-GA4", funnel.source_status.ga4 === "SUPPLIED" ? "SEE_FUNNEL" : UNK, funnel.source_status.ga4 === "SUPPLIED" ? "GA4 export" : "GA4 (no export supplied)", funnel.source_status.ga4 === "SUPPLIED" ? "per export" : null, "UNKNOWN אינו אפס."),
		],
		search: {
			position_buckets: search.position_buckets,
			classification_counts: search.classification_counts,
			actionable: search.actionable.slice(0, 8),
			locked_with_demand: search.pages.filter((p) => p.locked && p.impressions >= MIN_IMPRESSIONS).sort((a, b) => b.impressions - a.impressions).slice(0, 8),
			within_noise_zero_click_count: search.within_noise_zero_click.length,
			query_clusters: search.query_clusters.slice(0, 5),
			intent_mismatch_hypotheses: search.intent_mismatch_hypotheses.slice(0, 8),
			internal_link_opportunities: search.internal_link_opportunities.slice(0, 8),
			source: gscSrc,
			range: w,
			limitations: search.limitations,
		},
		engagement: {
			internal_navigation_total: funnel.by_channel.all ? UNK : "SEE_FUNNEL_BY_CHANNEL",
			note: "internal_resource_clicked has been instrumented since the Organic Growth Engine 2.0 release; its counts need a GA4 export that lists it in events_included.",
		},
		conversions: {
			stages_supplied: funnel.source_status,
			revenue_by_acquisition_channel: funnel.revenue_by_acquisition_channel,
			revenue_by_page: funnel.revenue_by_page,
			lead_states: funnel.lead_states,
			rules: funnel.rules,
		},
		freshness: { generated_for: freshness.generated_for, counts: freshness.counts, reason_counts: freshness.reason_counts, demand_source: freshness.demand_source, top: freshness.rows.filter((r) => r.tier !== "CURRENT").slice(0, 10), policy: freshness.policy },
		distribution: {
			queue_counts: queue.counts,
			gate: { publishing: gate.status, engagement: queue.engagement_gate?.status ?? "DISABLED" },
			ledger_entries: ledgerEntries.length,
			replies: replies.counts,
			blockers: [
				"פרסום ומעורבות נשארים כבויים עד שהבעלים מאמת בחשבון החי את זהות החשבון העסקי המדויק, הגישה וההרשאה (data/distribution/publishing-gate.json).",
				replies.counts.total === 0 ? "לא נאספה אף דיון ציבורי, ולכן לא מוצעת תגובה. שרשורי LinkedIn ו-X דורשים סשן דפדפן מחובר כדי לקרוא אותם באופן אמין." : null,
			].filter(Boolean),
		},
		link_graph: linkGraph,
		sibling_links: sibling ?? UNK,
	};
	return {
		generated_for: today,
		sections: sec,
		observation_locks: observation,
		next_actions: deriveNextActions({ funnel, search, freshness, queue, gate: { status: sec.distribution.gate.publishing }, observation, sibling }),
		funnel_summary: { source_status: funnel.source_status, by_topic: funnel.by_topic },
	};
}

const pct = (v) => (typeof v === "number" ? `${(v * 100).toFixed(2)}%` : String(v));
const val = (v) => (v && typeof v === "object" && "status" in v ? `${v.status}${v.reason ? ` (${v.reason})` : ""}` : typeof v === "object" ? JSON.stringify(v) : String(v));

export function renderHebrew(cc) {
	const s = cc.sections;
	const L = [];
	L.push(`# GridPermit: מרכז שליטה בצמיחה (${cc.generated_for})`, "");
	L.push("מסמך פנימי. כל מדד מציין מקור, טווח תאריכים ומגבלה. UNKNOWN פירושו שלא סופק מקור, NOT_MEASURED פירושו שאין מדידה שיכולה לשייך, ושניהם אינם אפס.", "");
	L.push("## 1. תנועה אורגנית בפועל", "");
	for (const m of s.traffic) L.push(`- ${m.label}: **${val(m.value)}** (מקור: ${m.source}${m.range ? `, טווח: ${m.range}` : ""}). מגבלה: ${m.limitation}`);
	L.push("");
	L.push("## 2. חשיפה בחיפוש והזדמנויות", "", `מקור: ${s.search.source}. טווח: ${s.search.range}.`, "", "**CTR של האתר עצמו לפי טווח מיקום** (בסיס ההשוואה; לא מדד חיצוני):", "", "| מיקום | קליקים | חשיפות | CTR |", "|---|---|---|---|");
	for (const [k, b] of Object.entries(s.search.position_buckets)) L.push(`| ${k} | ${b.clicks} | ${b.impressions} | ${pct(b.ctr)} |`);
	L.push("", `סיווג עמודים: ${Object.entries(s.search.classification_counts).map(([k, v]) => `${k}=${v}`).join(", ")}.`, "");
	L.push(s.search.actionable.length ? "**עמודים קיימים שניתן לשפר (לא נעולים):**" : "**אין כרגע עמוד לא נעול שעומד בקריטריון שיפור מבוסס ראיות.**", "");
	for (const p of s.search.actionable) L.push(`- ${p.path}: ${p.classification}, ${p.impressions} חשיפות, ${p.clicks} קליקים, מיקום ${p.position}`);
	if (s.search.locked_with_demand.length) {
		L.push("", "**עמודים נעולים (ניסוי או חלון מדידה) עם ביקוש. לא נוגעים:**", "");
		for (const p of s.search.locked_with_demand) L.push(`- ${p.path}: ${p.impressions} חשיפות, ${p.clicks} קליקים, מיקום ${p.position}`);
	}
	if (s.search.query_clusters.length) {
		L.push("", "**אשכולות שאילתות (טקסט שאילתה נחשף חלקית בלבד):**", "");
		for (const c of s.search.query_clusters) L.push(`- "${c.template}": ${c.impressions} חשיפות, ${c.clicks} קליקים, ${c.pages} עמודים, מיקום משוקלל ${c.weighted_position} (כוונה משוערת: ${c.intent})`);
	}
	if (s.search.intent_mismatch_hypotheses.length) L.push("", `**השערת אי-התאמת כוונה** (השערה, לא ממצא): ${s.search.intent_mismatch_hypotheses.length} שאילתות שירות הופיעו מול מדריכי מידע.`);
	if (s.search.internal_link_opportunities.length) L.push("", `**הזדמנויות קישור פנימי:** ${s.search.internal_link_opportunities.map((p) => p.path).join(", ")}`);
	L.push("", "**מגבלות:**", ...s.search.limitations.map((x) => `- ${x}`), "");
	L.push("## 3. מעורבות איכותית", "", `- ניווט פנימי (internal_resource_clicked, permit_guide_clicked): **${s.engagement.internal_navigation_total}**`, `- ${s.engagement.note}`, "");
	L.push("## 4. המרות מסחריות", "", `- מקורות שסופקו: ${Object.entries(s.conversions.stages_supplied).map(([k, v]) => `${k}=${v}`).join(", ")}`, `- הכנסה לפי ערוץ רכישה: **${val(s.conversions.revenue_by_acquisition_channel)}**. ${s.conversions.revenue_by_acquisition_channel.reason ?? ""}`, `- הכנסה לפי עמוד: **${val(s.conversions.revenue_by_page)}**`, `- מצבי ליד: **${val(s.conversions.lead_states)}**`, "", ...s.conversions.rules.map((r) => `- ${r}`), "");
	L.push("## 5. רעננות תוכן ובטחון מקורות", "", `- נוצר לתאריך ${s.freshness.generated_for}. ביקוש: ${s.freshness.demand_source}.`, `- מצב: ${Object.entries(s.freshness.counts).map(([k, v]) => `${k}=${v}`).join(", ")}`, `- סיבות: ${Object.entries(s.freshness.reason_counts).map(([k, v]) => `${k}=${v}`).join(", ")}`, "- התור הוא לבדיקה ידנית בלבד. שום רשומה לא נערכת אוטומטית.", "");
	L.push("| רשומה | דרגה | חשיפות | סיבות עיקריות |", "|---|---|---|---|");
	for (const r of s.freshness.top) L.push(`| ${r.path} | ${r.tier} | ${r.demand_impressions} | ${[...new Set(r.reasons.filter((x) => x.severity !== "LOW").map((x) => x.code))].join(", ") || "WATCH בלבד"} |`);
	L.push("");
	L.push("## 6. מצב הפצה אורגנית", "", `- תור סקירה: ${JSON.stringify(s.distribution.queue_counts)}`, `- שער פרסום: ${s.distribution.gate.publishing}. שער מעורבות: ${s.distribution.gate.engagement}`, `- רשומות ביומן הפרסום: ${s.distribution.ledger_entries}`, `- תגובות מוצעות: ${JSON.stringify(s.distribution.replies)}`, ...s.distribution.blockers.map((b) => `- חסם: ${b}`), "");
	L.push("## 7. פעולות הבאות לפי עדיפות", "");
	for (const [i, a] of cc.next_actions.entries()) L.push(`${i + 1}. **${a.title}** (אחראי: ${a.owner}${a.needs_approval ? ", דורש אישור בעלים" : ""}). ${a.detail}`);
	L.push("", "## גרף קישורים פנימיים", "");
	if (s.sibling_links && s.sibling_links !== UNK) {
		const k = s.sibling_links;
		L.push(`- מדריכי ערים: ${k.locality_pages}. ללא אף קישור ממדריך עיר אחר: **${k.zero_sibling_links}**. חציון קישורים נכנסים ממדריכי ערים אחרים: ${k.median_sibling_links}, מקסימום: ${k.max_sibling_links}. (מקור: build snapshot של האתר; לא כולל קישורי hub ורשימות.)`);
		L.push(`- עמודים בפיילוט קישור מאוזן: ${k.in_scope_pages}. קישורים נכנסים ממדריכי ערים אחרים: ${JSON.stringify(k.in_scope_inbound)}`);
	}
	L.push("", `- קישורים נכנסים למאמרי PTO ולמשאבים רשומים: ${JSON.stringify(s.link_graph ?? UNK)}`, "");
	return L.join("\n");
}
