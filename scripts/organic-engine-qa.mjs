#!/usr/bin/env node
// Post-build QA for the organic content-link engine. Read-only: it never
// touches the site, the network, analytics or partner routes.
//
//   node scripts/organic-engine-qa.mjs snapshot <distDir> <out.json>
//   node scripts/organic-engine-qa.mjs compare  <base.json> <head.json> [--registry data/content-links/registry.json]
//
// `snapshot` records per-page SEO and link facts from a built dist/.
// `compare` diffs a baseline build against the candidate build and fails
// unless every difference is an expected, bounded, additive internal link on
// a page the registry rolls out. Canonicals, robots, titles, JSON-LD,
// sitemap membership and partner/outbound links must be byte-identical.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}

function attr(tag, name) {
	const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
	return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Pure: extract the facts QA cares about from one page's HTML.
export function extractPageFacts(html) {
	const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
	const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
	const robots = metaTags.filter((t) => (attr(t, "name") ?? "").toLowerCase() === "robots").map((t) => attr(t, "content"));
	const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
	const canonical = linkTags.filter((t) => (attr(t, "rel") ?? "").toLowerCase() === "canonical").map((t) => attr(t, "href"));
	const jsonld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
		.map((m) => {
			try {
				return JSON.stringify(JSON.parse(m[1]));
			} catch {
				return m[1].trim();
			}
		})
		.sort();
	const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map((m) => m[0]);
	const hrefs = anchors.map((t) => decode(attr(t, "href") ?? "")).filter(Boolean);
	const internal = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//")).map((h) => h.split("#")[0]).filter(Boolean);
	const external = hrefs.filter((h) => /^https?:\/\//.test(h));
	const tracks = {};
	for (const t of anchors) {
		const n = attr(t, "data-track-click");
		if (n) tracks[n] = (tracks[n] ?? 0) + 1;
	}
	const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
	const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
	const h1 = (html.match(/<h1\b/gi) ?? []).length;
	const imgNoAlt = [...html.matchAll(/<img\b[^>]*>/gi)].filter((m) => attr(m[0], "alt") === null).length;
	return {
		title,
		canonical,
		robots,
		h1,
		jsonld_hash: sha(jsonld.join("\n")),
		jsonld_blocks: jsonld.length,
		internal_links: [...new Set(internal)].sort(),
		external_links_hash: sha([...new Set(external)].sort().join("\n")),
		external_link_count: new Set(external).size,
		track_click: tracks,
		duplicate_ids: [...new Set(dupIds)].sort(),
		img_without_alt: imgNoAlt,
		bytes: Buffer.byteLength(html),
	};
}

export function snapshotDist(distDir) {
	const pages = {};
	for (const file of walk(distDir)) {
		if (!file.endsWith(".html")) continue;
		const rel = relative(distDir, file).split(sep).join("/");
		const path = "/" + rel.replace(/index\.html$/, "").replace(/\.html$/, "");
		pages[path] = extractPageFacts(readFileSync(file, "utf8"));
	}
	const sitemapUrls = [];
	for (const file of walk(distDir)) {
		if (!/sitemap-\d+\.xml$/.test(file)) continue;
		for (const m of readFileSync(file, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
			sitemapUrls.push(m[1].replace(/^https?:\/\/[^/]+/, ""));
		}
	}
	const robotsTxt = existsSync(join(distDir, "robots.txt")) ? sha(readFileSync(join(distDir, "robots.txt"), "utf8")) : null;
	return { pages, sitemap: [...new Set(sitemapUrls)].sort(), robots_txt_hash: robotsTxt };
}

const arrEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Pure comparison. Returns { failures: string[], changed: [...], summary }.
export function compareSnapshots(base, head, registry, opts = {}) {
	const maxAddedBytes = opts.maxAddedBytes ?? 3500;
	const failures = [];
	const changed = [];
	const rollout = new Set([
		...registry.rollout.locality_pages,
		...registry.rollout.utility_hubs,
		...registry.rollout.articles,
	]);
	const allowedTargets = new Set([
		...registry.resources.map((r) => r.url),
		...registry.rollout.locality_pages,
		...registry.rollout.utility_hubs,
	]);

	const basePaths = Object.keys(base.pages);
	const headPaths = Object.keys(head.pages);
	if (!arrEq(basePaths.slice().sort(), headPaths.slice().sort())) {
		const added = headPaths.filter((p) => !(p in base.pages));
		const removed = basePaths.filter((p) => !(p in head.pages));
		failures.push(`page set changed (added ${added.length}: ${added.slice(0, 5)}; removed ${removed.length}: ${removed.slice(0, 5)})`);
	}
	if (!arrEq(base.sitemap, head.sitemap)) failures.push("sitemap URL set changed");
	if (base.robots_txt_hash !== head.robots_txt_hash) failures.push("robots.txt changed");

	for (const path of basePaths) {
		const b = base.pages[path];
		const h = head.pages[path];
		if (!h) continue;
		for (const k of ["title", "canonical", "robots", "h1", "jsonld_hash", "external_links_hash"]) {
			if (!arrEq(b[k], h[k])) failures.push(`${path}: ${k} changed`);
		}
		const trackBase = { ...b.track_click };
		const trackHead = { ...h.track_click };
		const addedInternalClicks = trackHead.internal_resource_clicked ?? 0;
		delete trackHead.internal_resource_clicked;
		if (!arrEq(trackBase, trackHead)) failures.push(`${path}: existing data-track-click counts changed`);

		const added = h.internal_links.filter((l) => !b.internal_links.includes(l));
		const removed = b.internal_links.filter((l) => !h.internal_links.includes(l));
		const differs = added.length || removed.length || addedInternalClicks || b.bytes !== h.bytes;
		if (!differs) continue;

		changed.push({ path, added, removed, added_internal_resource_clicks: addedInternalClicks, bytes_delta: h.bytes - b.bytes });
		if (!rollout.has(path)) {
			if (added.length || removed.length || addedInternalClicks) failures.push(`${path}: links changed but page is not in the rollout`);
			continue;
		}
		if (removed.length) failures.push(`${path}: removed links ${removed.join(", ")}`);
		for (const l of added) if (!allowedTargets.has(l)) failures.push(`${path}: unexpected new link target ${l}`);
		if (h.bytes - b.bytes > maxAddedBytes) failures.push(`${path}: HTML grew ${h.bytes - b.bytes} bytes (> ${maxAddedBytes})`);
		if (h.duplicate_ids.length) failures.push(`${path}: duplicate ids ${h.duplicate_ids.join(", ")}`);
		if (h.img_without_alt > b.img_without_alt) failures.push(`${path}: new img without alt`);
		if (registry.rollout.locality_pages.includes(path) && added.length > 3) failures.push(`${path}: added ${added.length} links (> 3)`);
		const cap = registry.rollout.articles.includes(path) ? 1 + 4 + registry.rollout.utility_hubs.length : 4;
		if (addedInternalClicks > cap) failures.push(`${path}: ${addedInternalClicks} tracked resource links (> ${cap})`);
	}

	// Every rolled-out page must actually have changed (otherwise the rollout is dead config).
	for (const p of rollout) {
		if (!(p in head.pages)) failures.push(`rollout page not built: ${p}`);
		else if (!changed.some((c) => c.path === p)) failures.push(`rollout page unchanged by engine: ${p}`);
	}

	// Link targets must exist, be indexable and be in the sitemap.
	const sitemap = new Set(head.sitemap);
	for (const c of changed) {
		for (const target of c.added) {
			const t = head.pages[target];
			if (!t) {
				failures.push(`${c.path}: new link target is not a built page: ${target}`);
				continue;
			}
			if ((t.robots ?? []).some((r) => /noindex/i.test(r ?? ""))) failures.push(`${c.path}: new link target is noindex: ${target}`);
			if (!sitemap.has(target)) failures.push(`${c.path}: new link target missing from sitemap: ${target}`);
		}
	}

	const pagesUnchanged = headPaths.length - changed.length;
	return {
		failures,
		changed,
		summary: { pages: headPaths.length, pages_changed: changed.length, pages_unchanged: pagesUnchanged, failures: failures.length },
	};
}

// Policy check for the balanced related-cities change. Against a baseline build
// of the commit it branches from, only pages listed in registry.balanced_related
// may differ; on those pages the only allowed changes are swaps between listed
// guides; locked pages must be byte-identical; and everything SEO-relevant
// (title, canonical, robots, JSON-LD, partner links, sitemap) is unchanged on
// every page.
export function compareBalancedRelated(base, head, registry, opts = {}) {
	const br = registry.balanced_related;
	const failures = [];
	const changed = [];
	if (!br) return { failures: ["registry has no balanced_related block"], changed, summary: { failures: 1 } };
	const scope = new Set(br.pages);
	const locked = new Set(opts.lockedPaths ?? []);
	const maxBytes = opts.maxByteDelta ?? 1500;
	const bp = Object.keys(base.pages).sort();
	const hp = Object.keys(head.pages).sort();
	if (!arrEq(bp, hp)) failures.push("page set changed");
	if (!arrEq(base.sitemap, head.sitemap)) failures.push("sitemap URL set changed");
	if (base.robots_txt_hash !== head.robots_txt_hash) failures.push("robots.txt changed");
	const sitemap = new Set(head.sitemap);
	for (const path of bp) {
		const b = base.pages[path];
		const h = head.pages[path];
		if (!h) continue;
		for (const k of ["title", "canonical", "robots", "h1", "jsonld_hash", "external_links_hash", "track_click"]) {
			if (!arrEq(b[k], h[k])) failures.push(`${path}: ${k} changed`);
		}
		const added = h.internal_links.filter((l) => !b.internal_links.includes(l));
		const removed = b.internal_links.filter((l) => !h.internal_links.includes(l));
		if (!added.length && !removed.length && b.bytes === h.bytes) continue;
		changed.push({ path, added, removed, bytes_delta: h.bytes - b.bytes });
		if (!scope.has(path)) {
			failures.push(`${path}: changed but is not in balanced_related.pages`);
			continue;
		}
		if (locked.has(path)) failures.push(`${path}: is locked (experiment or observation window) but changed`);
		for (const l of [...added, ...removed]) if (!scope.has(l)) failures.push(`${path}: link ${l} is outside the listed counties' guides`);
		if (Math.abs(h.bytes - b.bytes) > maxBytes) failures.push(`${path}: HTML changed by ${h.bytes - b.bytes} bytes (> ${maxBytes})`);
		if (h.duplicate_ids.length) failures.push(`${path}: duplicate ids ${h.duplicate_ids.join(", ")}`);
		for (const t of added) {
			const tp = head.pages[t];
			if (!tp) failures.push(`${path}: new link target is not a built page: ${t}`);
			else if ((tp.robots ?? []).some((r) => /noindex/i.test(r ?? ""))) failures.push(`${path}: new link target is noindex: ${t}`);
			else if (!sitemap.has(t)) failures.push(`${path}: new link target missing from sitemap: ${t}`);
		}
	}
	// Pages under measurement (locked pages and the control group) must keep exactly
	// the same set of pages linking to them, not only the same outbound links.
	const inboundSet = (snap, target) => Object.keys(snap.pages).filter((p) => p !== target && snap.pages[p].internal_links.includes(target)).sort();
	for (const target of new Set([...locked, ...(br.control_pages ?? [])])) {
		if (!(target in base.pages) || !(target in head.pages)) continue;
		if (!arrEq(inboundSet(base, target), inboundSet(head, target))) failures.push(`${target}: pages linking to it changed, but it is locked or a measurement control`);
	}
	// A listed page's related list stays within the configured limit.
	for (const path of scope) {
		const h = head.pages[path];
		if (!h || locked.has(path)) continue;
		const toScope = h.internal_links.filter((l) => scope.has(l) && l !== path).length;
		if (toScope > (br.limit ?? 6)) failures.push(`${path}: links to ${toScope} listed guides (> limit ${br.limit ?? 6})`);
	}
	if (!changed.length) failures.push("no listed page changed: the balanced_related rollout is dead config");
	return { failures, changed, summary: { pages: hp.length, pages_changed: changed.length, pages_unchanged: hp.length - changed.length, failures: failures.length } };
}

// The same lock set the layout uses (pilots, commercial profiles, reviewed pathways
// and the PTO link pilot), resolved to guide URLs, so QA and the page can never disagree.
async function lockedGuidePaths(registry) {
	const { buildLocalityIndexEntries } = await import("../src/lib/locality-guide.ts");
	const { observationLockedRecordIds } = await import("../src/lib/related-balance.ts");
	const recordsById = new Map(readdirSync("data/localities").filter((f) => f.endsWith(".json")).map((f) => {
		const r = JSON.parse(readFileSync(join("data/localities", f), "utf8"));
		return [r.record_id, r];
	}));
	const evaluation = [];
	for (const f of readdirSync("output").filter((f) => f.endsWith("-evaluation.json"))) evaluation.push(...(JSON.parse(readFileSync(join("output", f), "utf8")).records ?? []));
	const entries = buildLocalityIndexEntries(evaluation, recordsById);
	const locked = observationLockedRecordIds(entries, registry.rollout.locality_pages);
	return entries.filter((e) => locked.has(e.recordId)).map((e) => e.guideUrl);
}

async function main(argv) {
	const [cmd, ...rest] = argv;
	if (cmd === "snapshot") {
		const [dist, out] = rest;
		if (!dist || !out) throw new Error("usage: snapshot <distDir> <out.json>");
		const snap = snapshotDist(dist);
		writeFileSync(out, JSON.stringify(snap));
		console.log(JSON.stringify({ pages: Object.keys(snap.pages).length, sitemap_urls: snap.sitemap.length }));
		return 0;
	}
	if (cmd === "compare") {
		const [basePath, headPath] = rest;
		const regIdx = rest.indexOf("--registry");
		const registry = JSON.parse(readFileSync(regIdx >= 0 ? rest[regIdx + 1] : "data/content-links/registry.json", "utf8"));
		const res = compareSnapshots(JSON.parse(readFileSync(basePath, "utf8")), JSON.parse(readFileSync(headPath, "utf8")), registry);
		console.log(JSON.stringify({ summary: res.summary, changed: res.changed }, null, 2));
		if (res.failures.length) {
			console.error("FAILURES:\n" + res.failures.map((f) => " - " + f).join("\n"));
			return 1;
		}
		console.log("organic-engine-qa: PASS");
		return 0;
	}
	if (cmd === "compare-balanced") {
		const [basePath, headPath] = rest;
		const regIdx = rest.indexOf("--registry");
		const registry = JSON.parse(readFileSync(regIdx >= 0 ? rest[regIdx + 1] : "data/content-links/registry.json", "utf8"));
		const res = compareBalancedRelated(JSON.parse(readFileSync(basePath, "utf8")), JSON.parse(readFileSync(headPath, "utf8")), registry, { lockedPaths: await lockedGuidePaths(registry) });
		console.log(JSON.stringify({ summary: res.summary, changed: res.changed }, null, 2));
		if (res.failures.length) {
			console.error("FAILURES:\n" + res.failures.map((f) => " - " + f).join("\n"));
			return 1;
		}
		console.log("organic-engine-qa compare-balanced: PASS");
		return 0;
	}
	console.error("usage: organic-engine-qa.mjs snapshot|compare|compare-balanced ...");
	return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).then((code) => process.exit(code));
