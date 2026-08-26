import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(rel) {
	return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function write(rel, content) {
	fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
}

function replaceOnce(rel, input, pattern, replacement, label) {
	const matches = typeof pattern === "string"
		? input.split(pattern).length - 1
		: [...input.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))].length;
	if (matches !== 1) {
		throw new Error(`${rel}: expected exactly one match for ${label}, found ${matches}`);
	}
	return input.replace(pattern, replacement);
}

// 1. Partner registry: represent the real dynamic URL-builder tracking asset
// explicitly, rather than inventing a static tracking link just to satisfy the
// launch gate.
{
	const rel = "src/lib/partners.ts";
	let s = read(rel);

	if (!s.includes('trackingAssetKind?: "dynamic_url";')) {
		s = replaceOnce(
			rel,
			s,
			'\ttrackingPhone?: string;\n',
			'\ttrackingPhone?: string;\n\t/** Explicit verified dynamic URL-builder tracking asset. Static URLs remain represented by destination; phone assets by trackingPhone. */\n\ttrackingAssetKind?: "dynamic_url";\n',
			"trackingAssetKind interface field",
		);
	}

	const start = s.indexOf('\t{\n\t\tid: "compare-solar-prices",');
	const next = s.indexOf('\n\t{\n\t\tid: "energysage",', start);
	if (start < 0 || next < 0) throw new Error(`${rel}: unable to isolate CompareSolarPrices record`);

	const compareRecord = `\t{\n\t\tid: "compare-solar-prices",\n\t\tname: "CompareSolarPrices",\n\t\tstatus: "approved",\n\t\tvertical: "solar",\n\t\tchannel: "cpl",\n\t\tdestination: "",\n\t\ttrackingAssetKind: "dynamic_url",\n\t\ttrackingEnabled: true,\n\t\tcompensationVerified: true,\n\t\tplacementEligible: true,\n\t\tdisclosureType: "affiliate",\n\t\tlaunchEnabled: true,\n\t\tpayoutType: "per_lead",\n\t\tpayoutValue: 25,\n\t\tcurrency: "USD",\n\t\tcookieDays: 30,\n\t\tgeo: "US-CA-Southern-California",\n\t\ttrafficSources: ORGANIC_ONLY,\n\t\teligiblePageTypes: LOCALITY_ONLY,\n\t\tlastVerified: "2026-08-26",\n\t\tnotes: "Direct commercial relationship cleared for link launch by Aaron after the PayPal-account email handoff. Confirmed $25 per qualified quote request and $200 per funded installation conversion, Southern California, 30-day click-to-quote attribution and no stated time limit on the later funded-install conversion once the GridPermit referral is attached. Tracking is a verified dynamic URL-builder contract: ref=GridPermit plus a fresh non-PII cid on every click. The production component builds the city deep link at click time and records the same CID in GridPermit click telemetry. W-8BEN remains a separate owner tax-document follow-up for Aaron's file and is not the link-launch prerequisite.",\n\t},`;

	s = `${s.slice(0, start)}${compareRecord}${s.slice(next)}`;

	s = replaceOnce(
		rel,
		s,
		'\tconst hasRealTrackingAsset = partner.destination.length > 0 || Boolean(partner.trackingPhone);',
		'\tconst hasRealTrackingAsset = partner.destination.length > 0 || Boolean(partner.trackingPhone) || partner.trackingAssetKind === "dynamic_url";',
		"dynamic launch asset gate",
	);

	write(rel, s);
}

// 2. Registry tests: exactly one real active partner after launch, and dynamic
// tracking must be explicit rather than inferred from an empty destination.
{
	const rel = "tests/partner-registry.test.mjs";
	let s = read(rel);

	s = replaceOnce(
		rel,
		s,
		'test("no partner claims tracking is enabled without a real destination or tracking phone", () => {\n\tfor (const p of PARTNERS) {\n\t\tif (p.trackingEnabled) {\n\t\t\tassert.ok(\n\t\t\t\tp.destination.length > 0 || Boolean(p.trackingPhone),\n\t\t\t\t`${p.name} has trackingEnabled=true but no destination or trackingPhone — a missing tracking asset must never masquerade as tracked`,\n\t\t\t);\n\t\t}\n\t}\n});',
		'test("trackingEnabled always has an explicit real tracking asset", () => {\n\tfor (const p of PARTNERS) {\n\t\tif (p.trackingEnabled) {\n\t\t\tassert.ok(\n\t\t\t\tp.destination.length > 0 || Boolean(p.trackingPhone) || p.trackingAssetKind === "dynamic_url",\n\t\t\t\t`${p.name} has trackingEnabled=true but no static URL, phone, or explicit dynamic URL asset`,\n\t\t\t);\n\t\t}\n\t}\n});',
		"tracking asset invariant",
	);

	s = replaceOnce(
		rel,
		s,
		'test("every partner defaults launchEnabled to false", () => {\n\tfor (const p of PARTNERS) {\n\t\tassert.equal(p.launchEnabled, false, `${p.name} must default launchEnabled to false — no partner has been deliberately launched yet`);\n\t}\n});',
		'test("only CompareSolarPrices is deliberately launch-enabled", () => {\n\tconst enabled = PARTNERS.filter((p) => p.launchEnabled).map((p) => p.id);\n\tassert.deepEqual(enabled, ["compare-solar-prices"]);\n});',
		"single launch-enabled partner invariant",
	);

	s = replaceOnce(
		rel,
		s,
		/test\("getActivePartners\(\) is currently empty[\s\S]*?assert\.deepEqual\(getActivePartners\(\), \[\]\);\n\}\);/,
		'test("CompareSolarPrices is the only active monetized partner", () => {\n\tassert.deepEqual(getActivePartners().map((p) => p.id), ["compare-solar-prices"]);\n});',
		"active partner invariant",
	);

	const insertion = `\n\ntest("isLaunchReady accepts an explicitly verified dynamic URL asset without inventing a static destination", () => {\n\tconst hypothetical = {\n\t\tid: "dynamic", name: "Dynamic", status: "approved", vertical: "solar", channel: "cpl",\n\t\tdestination: "", trackingAssetKind: "dynamic_url", trackingEnabled: true, compensationVerified: true,\n\t\tplacementEligible: true, disclosureType: "affiliate", launchEnabled: true, payoutType: "per_lead",\n\t\tgeo: "US", trafficSources: ["organic_search"], eligiblePageTypes: ["locality_guide"], lastVerified: "2026-08-26",\n\t};\n\tassert.equal(isLaunchReady(hypothetical), true);\n\tassert.equal(isLaunchReady({ ...hypothetical, trackingEnabled: false }), false);\n});\n`;
	if (!s.includes("explicitly verified dynamic URL asset")) s += insertion;
	write(rel, s);
}

// 3. CompareSolarPrices tests: activation must be explicit and still retain
// all CID/geography/privacy invariants.
{
	const rel = "tests/compare-solar-prices.test.mjs";
	let s = read(rel);
	s = replaceOnce(
		rel,
		s,
		/test\("today, CompareSolarPrices is not launch-ready[\s\S]*?assert\.equal\(partner\.launchEnabled, false\);\n\}\);/,
		'test("CompareSolarPrices is deliberately launch-ready after the verified payment handoff", () => {\n\tconst active = getLaunchReadyPartner("compare-solar-prices", "cpl");\n\tassert.ok(active);\n\tassert.equal(active.id, "compare-solar-prices");\n\tassert.equal(active.trackingAssetKind, "dynamic_url");\n\tassert.equal(active.trackingEnabled, true);\n\tassert.equal(active.launchEnabled, true);\n\tassert.equal(isCompareSolarServedLocality("CA", "Irvine"), true);\n});',
		"CompareSolarPrices activation test",
	);
	write(rel, s);
}

// 4. Installer routing tests now assert that the paid route is launch-ready,
// while the source still contains the EnergySage fallback for non-eligible geo.
{
	const rel = "tests/installer-cta-revenue-routing.test.mjs";
	let s = read(rel);
	s = replaceOnce(
		rel,
		s,
		/test\("today the paid route remains off[\s\S]*?assert\.match\(source, \/href=\\\{energysage\\\.destination\\\}\//\);\n\}\);/,
		'test("the paid route is launch-ready while EnergySage remains the source fallback for non-eligible routes", () => {\n\tassert.ok(getLaunchReadyPartner("compare-solar-prices", "cpl"));\n\tassert.match(source, /useCompareSolar \\? \\(/);\n\tassert.match(source, /EnergySage is an independent solar marketplace/);\n\tassert.match(source, /href=\\{energysage\\.destination\\}/);\n});',
		"InstallerCTA activation expectation",
	);
	write(rel, s);
}

// 5. Component comments: remove stale pre-launch wording only. Runtime logic is
// already prewired and tested on main.
{
	const rel = "src/components/CompareSolarPricesCTA.astro";
	let s = read(rel);
	s = s.replace(
		'// Staged only. This component is deliberately not imported by any production\n// page yet. GitHub issue #5 is the activation gate: payment setup + W-8BEN\n// must be complete before this can be wired into LocalityGuideLayout.\n//\n',
		'// Production paid-referral CTA for eligible Southern California locality pages.\n// The parent InstallerCTA and this component both retain fail-closed partner\n// and geography gates so no other locality can expose the paid route.\n//\n',
	);
	write(rel, s);
}

// 6. Canonical commercial state.
{
	const rel = "docs/MONETIZATION_CANONICAL_STATE.md";
	let s = read(rel);
	s = s.replace(/^\| \*\*CompareSolarPrices\*\*.*$/m,
		'| **CompareSolarPrices** | CPL + installation conversion | `PRODUCTION_ACTIVE` | Directly confirmed: $25 qualified quote request, $200 funded installation conversion, Southern California, 30-day click-to-quote attribution; once attached, install conversion has no stated time limit. Dynamic tracking uses `ref=GridPermit` plus a fresh non-PII CID on every click. PayPal payment-contact handoff completed; W-8BEN may follow later for Aaron’s file. | Live only on verified Southern California locality pages through the fail-closed city allowlist. Monitor real CID-attributed referral reporting; do not create test leads. Issue #5. |');

	s = s.replace(/^\| \*\*Lead Smart\*\*.*$/m,
		'| **Lead Smart** | Solar pay-per-call | `AWAITING_CAMPAIGN_DETAILS` | Seth directly confirmed GridPermit fit, organic/SEO U.S. homeowner traffic, international-publisher eligibility, consumer-initiated inbound calls, low-PII tracking-number model, and W-8 path. Payout can be duration- or qualified-lead-based. | Await current Solar coverage/payout/qualification list, hours, duplicate/reversal rules and tracking-number provisioning. Issue #15. |');

	s = s.replace(/^\| \*\*ALLPOWERS\*\*.*$/m,
		'| **ALLPOWERS** | Hardware affiliate | `OWNER_ACTION_REQUIRED` | Direct-confirmed international publisher with primarily U.S. organic traffic eligible; current U.S. terms 5%, 30 days. ALLPOWERS supplied CJ advertiser ID 7797916. | Owner reviews live CJ advertiser terms and submits Join/Apply. After approval obtain a real CJ tracking/deep link. Issue #7. |');

	s = s.replace(/## Production-ready status: none[\s\S]*?## Status vocabulary/,
		'## Production-ready status\n\n**CompareSolarPrices is the first production-active monetization route.** It is limited to verified Southern California locality pages and uses a fresh non-PII CID per click. All other monetization partners remain inactive until their own approval/tracking/launch gates clear.\n\nThe existing EnergySage fallback remains a plain, untracked destination outside the active CompareSolarPrices geo and must not be described as an earning link.\n\n## Status vocabulary');

	s = s.replace(/^1\. \*\*CompareSolarPrices\*\*.*$/m,
		'1. **CompareSolarPrices** — first revenue route active; monitor genuine clicks/CID reporting and complete the W-8BEN owner follow-up without creating fake leads.');
	write(rel, s);
}

// 7. Runbook becomes post-launch operational documentation.
{
	const rel = "docs/COMPARE_SOLAR_PRICES_IMPLEMENTATION.md";
	let s = read(rel);
	s = s.replace('Status: **STAGED, TESTED, NOT LIVE**', 'Status: **PRODUCTION ACTIVE — SOUTHERN CALIFORNIA ALLOWLIST ONLY**');
	s = s.replace('- W-8BEN accepted by CompareSolarPrices for Eyal Haimovich as the non-U.S. individual payee.', '- W-8BEN accepted for the non-U.S. individual payee; Aaron explicitly allowed the form to follow after link launch for his file.');
	s = s.replace('The staged CTA generates exactly one fresh random non-PII CID per outbound click.', 'The production CTA generates exactly one fresh random non-PII CID per outbound click.');
	s = s.replace('The staged `CompareSolarPricesCTA.astro` follows those copy constraints', 'The production `CompareSolarPricesCTA.astro` follows those copy constraints');
	s = s.replace(/## Production activation gate[\s\S]*?## Current external blocker[\s\S]*?Do not send duplicate status-chasing emails while the existing thread is awaiting that reply\./,
		'## Production launch state\n\nThe pre-launch payment/CID handoff has cleared. Production activation is limited by code to verified Southern California locality routes, and every outbound click receives a fresh non-PII CID. Ongoing operating rules:\n\n1. Keep the city allowlist fail closed.\n2. Keep one monetized solar CTA per page.\n3. Never submit a fake quote request or fake homeowner lead to test attribution.\n4. Reconcile partner-reported paid lead/conversion CIDs only against GridPermit click telemetry.\n5. Treat W-8BEN as an owner tax-document follow-up for Aaron’s file, not a reason to disable the approved link.');
	s = s.replace('The production locality layout intentionally has no reference to the staged component. The regression test enforces that fail-closed state.', 'Production routing is prewired through `InstallerCTA.astro`: the paid CTA can appear only when the partner launch gate passes and the current California city is in the verified Southern California allowlist; all other localities retain the existing safe fallback.');
	write(rel, s);
}

// 8. Revenue map: mark the route active without inventing performance.
{
	const rel = "docs/REVENUE_OPPORTUNITY_MAP.md";
	let s = read(rel);
	s = s.replace(/^\| CompareSolarPrices \|.*$/m,
		'| CompareSolarPrices | Southern California locality guides | Direct relationship cleared for launch; $25 qualified request + $200 funded install confirmed | Production CTA + per-click CID tracking active behind SoCal allowlist | None for link launch; W-8BEN remains owner tax-file follow-up | **Active / very high** |');
	s = s.replace(/^1\. Finish CompareSolarPrices activation.*$/m,
		'1. Monitor the now-active CompareSolarPrices route for genuine CID-attributed clicks/leads while completing the separate W-8BEN owner follow-up.');
	write(rel, s);
}

// Remove the one-shot activation machinery from the generated branch so it
// can never reach main or retrigger later.
for (const rel of [
	"scripts/prepare-compare-solar-activation.mjs",
	".github/workflows/prepare-compare-solar-activation.yml",
	"docs/.compare-solar-activation-trigger",
]) {
	const abs = path.join(ROOT, rel);
	if (fs.existsSync(abs)) fs.rmSync(abs);
}

console.log("Prepared CompareSolarPrices activation state and removed one-shot activation machinery.");
