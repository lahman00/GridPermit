// One static JSON file per researched locality, read by the Permit Path checker
// only after a visitor picks that locality. Same data the page used to embed
// inline; see src/lib/permit-path-records.ts.
import type { APIRoute, GetStaticPaths } from "astro";
import { permitPathRecords, type PermitPathRecord, type PublishedLocality } from "../../../lib/permit-path-records";

export const getStaticPaths = (() => {
	const modules = import.meta.glob("../../../../data/localities/*.json", { eager: true }) as Record<string, { default: PublishedLocality }>;
	return permitPathRecords(Object.values(modules).map((mod) => mod.default)).map((record) => ({
		params: { id: record.id },
		props: { record },
	}));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
	new Response(JSON.stringify((props as { record: PermitPathRecord }).record), {
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
