// Revenue SCENARIO model — not a forecast. Every input below is a labeled
// assumption or a verified fact (marked inline); change any INPUT constant
// and re-run to see how the output moves. This does not predict GridPermit's
// actual revenue — it exists so a real traffic number (once GA4 access
// exists) can be dropped in and immediately produce a range, instead of
// starting the math from scratch. See docs/MONETIZATION_STRATEGY.md and
// docs/PAY_PER_CALL_FEASIBILITY.md for where these figures come from.
//
// Run: node scripts/revenue-scenarios.mjs

const MONTHLY_VISIT_SCENARIOS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];

// ---- Model A: EnergySage-style referral link (click -> lead) ----
// FACT: EnergySage's published CJ program rate, captured 2026-08-14 (see
// docs/MONETIZATION_STRATEGY.md Section 5). Real per-lead payout figure.
const MODEL_A = {
	name: "Referral link (EnergySage-style, CPL via marketplace)",
	payoutPerLead: 9.6, // FACT — EnergySage's published CJ rate
	ctaClickRateAssumption: 0.03, // ASSUMPTION — 2-5% range from MONETIZATION_STRATEGY.md, midpoint-low used here
	clickToLeadRateAssumption: 0.15, // ASSUMPTION — typical marketplace on-site completion rate, not GridPermit-specific
};

// ---- Model B: pay-per-call (BuyTheCalls / Digital Master Media style) ----
// FACT: real published payout ranges, see docs/PAY_PER_CALL_FEASIBILITY.md
const MODEL_B = {
	name: "Pay-per-call (solar vertical, BuyTheCalls/DMM range)",
	payoutPerCallLow: 40, // FACT — BuyTheCalls solar range low end
	payoutPerCallHigh: 53, // FACT — DMM solar "up to" figure, used as the high end of a conservative range
	pageViewToCallRateAssumption: 0.002, // ASSUMPTION — placing a call is higher-friction than a link click; industry-typical web-to-call rates run well under 1%, no GridPermit-specific data exists
	callQualificationRateAssumption: 0.6, // ASSUMPTION — share of placed calls that meet minimum-duration/real-intent qualification bars
};

// ---- Model C: battery product affiliate (BigBattery/PowerQueen-style CPS) ----
// FACT: real published commission rates, see docs/AFFILIATE_PARTNER_PIPELINE.md
const MODEL_C = {
	name: "Battery product affiliate (BigBattery/Power Queen-style, CPS)",
	averageOrderValueAssumption: 800, // ASSUMPTION — typical residential LiFePO4/power-station order size; not GridPermit-specific, no purchase-intent data exists yet
	commissionRate: 0.05, // FACT — BigBattery's published flat 5%; Power Queen's 5.5% base is close enough to use this as a conservative shared figure
	ctaClickRateAssumption: 0.02, // ASSUMPTION — battery-purchase intent is a narrower audience slice of locality-guide readers than "find an installer"
	clickToSaleRateAssumption: 0.02, // ASSUMPTION — e-commerce-typical click-to-purchase rate for a considered, high-ticket item; not GridPermit-specific
};

function formatCurrency(n) {
	return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function modelA(monthlyVisits) {
	const clicks = monthlyVisits * MODEL_A.ctaClickRateAssumption;
	const leads = clicks * MODEL_A.clickToLeadRateAssumption;
	return { leads, revenue: leads * MODEL_A.payoutPerLead };
}

function modelB(monthlyVisits) {
	const calls = monthlyVisits * MODEL_B.pageViewToCallRateAssumption;
	const qualifiedCalls = calls * MODEL_B.callQualificationRateAssumption;
	const revenueLow = qualifiedCalls * MODEL_B.payoutPerCallLow;
	const revenueHigh = qualifiedCalls * MODEL_B.payoutPerCallHigh;
	return { qualifiedCalls, revenueLow, revenueHigh };
}

function modelC(monthlyVisits) {
	const clicks = monthlyVisits * MODEL_C.ctaClickRateAssumption;
	const sales = clicks * MODEL_C.clickToSaleRateAssumption;
	const revenue = sales * MODEL_C.averageOrderValueAssumption * MODEL_C.commissionRate;
	return { sales, revenue };
}

console.log("GridPermit revenue SCENARIOS — not a forecast. Every rate above is labeled FACT or ASSUMPTION.");
console.log("No real GridPermit traffic number exists yet (no GA4 API access) — these scenarios are illustrative inputs only.\n");

for (const visits of MONTHLY_VISIT_SCENARIOS) {
	console.log(`=== ${visits.toLocaleString("en-US")} monthly locality-guide page views ===`);

	const a = modelA(visits);
	console.log(`  Model A (referral link):      ~${a.leads.toFixed(1)} leads/mo  ->  ~${formatCurrency(a.revenue)}/mo`);

	const b = modelB(visits);
	console.log(`  Model B (pay-per-call):        ~${b.qualifiedCalls.toFixed(1)} qualified calls/mo  ->  ~${formatCurrency(b.revenueLow)}–${formatCurrency(b.revenueHigh)}/mo`);

	const c = modelC(visits);
	console.log(`  Model C (battery affiliate):   ~${c.sales.toFixed(2)} sales/mo  ->  ~${formatCurrency(c.revenue)}/mo`);

	console.log("");
}

console.log("To use a real traffic number: replace MONTHLY_VISIT_SCENARIOS with actual GA4 data once GA4 API access exists.");
console.log("To sanity-check an assumption: every *Assumption field above is a single named constant — change it and re-run.");
