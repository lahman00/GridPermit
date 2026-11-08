// Shapes a published locality record into the compact record the Permit Path
// checker reads. The page lists every researched locality in its <select>, and
// each record's details are served as a separate static JSON file
// (src/pages/permit-path/records/[id].json.ts), loaded only when a visitor
// picks that locality. This keeps roughly 1.3 MB of record data out of the
// page's HTML without changing any fact the checker shows.

import type { LocalityRecord } from "./locality-guide.ts";

export type PublishedLocality = LocalityRecord & { record_id: string; last_verified?: string };

export interface PermitPathRecord {
	id: string;
	state: string;
	city: string | null;
	county: string | null;
	utility: string | null;
	permitAuthority: string | null;
	permitUrl: string | null;
	interconnectionUrl: string | null;
	requiredDocuments: unknown;
	timeline: unknown;
	eligibility: unknown;
	permitFees: unknown;
	lastVerified: string | null;
	sources: { title: string; url: string; publisher?: string; type?: string; accessedDate?: string }[];
}

/** Only records with a verified city and permit authority can be checked. */
export function isCheckableLocality(record: PublishedLocality): boolean {
	return Boolean(record.city?.value && record.permit_authority?.value);
}

export function toPermitPathRecord(record: PublishedLocality): PermitPathRecord {
	return {
		id: record.record_id,
		state: record.state,
		city: record.city?.value ?? null,
		county: record.county?.value ?? null,
		utility: record.utility?.value ?? null,
		permitAuthority: record.permit_authority?.value ?? null,
		permitUrl: record.permit_url?.value ?? null,
		interconnectionUrl: record.interconnection_url?.value ?? null,
		requiredDocuments: record.required_documents?.value ?? null,
		timeline: record.timeline_days?.value ?? null,
		eligibility: record.eligibility_constraints?.value ?? null,
		permitFees: record.permit_fees?.value ?? null,
		lastVerified: record.last_verified ?? null,
		sources: (record.sources ?? []).map((source) => ({
			title: source.title,
			url: source.url,
			publisher: source.publisher,
			type: source.type,
			accessedDate: source.accessed_date,
		})),
	};
}

export function permitPathRecords(published: PublishedLocality[]): PermitPathRecord[] {
	return published
		.filter(isCheckableLocality)
		.map(toPermitPathRecord)
		.sort((a, b) => `${a.state}-${a.city}`.localeCompare(`${b.state}-${b.city}`));
}

/** Same-origin path of one record's detail file. Record ids are kebab-case by schema. */
export function permitPathRecordPath(id: string): string {
	return `/permit-path/records/${encodeURIComponent(id)}.json`;
}
