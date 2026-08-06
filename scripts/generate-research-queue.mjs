#!/usr/bin/env node
// Deterministic statewide research queue for the California
// locality-expansion campaign. Encodes the mission's regional waves
// (Wave A: LA County ... Wave K: Northern California) as a fixed list of
// candidate cities, cross-references each against the actual
// data/localities/*.json inventory (matched by city name; a city can be
// legitimately represented under more than one utility/record if it's
// split territory, so "already researched" means at least one record
// exists for that city name), and reports queue status per wave and
// overall. This is a read-only reporting tool: it never fabricates city
// facts and never decides readiness — it only tracks what has and hasn't
// been attempted yet, so research effort isn't duplicated or lost across
// long-running or multi-session work.
//
// Usage: node scripts/generate-research-queue.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LOCALITIES_DIR = path.join(REPO_ROOT, "data", "localities");
const OUT_PATH = path.join(REPO_ROOT, "output", "statewide-research-queue.json");

// Cities investigated but blocked on every official source attempted, so no
// data/localities/ record exists for them. Kept here since there is no
// record file to derive this list from (mirrors the list already
// maintained in scripts/generate-research-progress-report.mjs).
const INVESTIGATED_BUT_BLOCKED = ["South Pasadena", "Claremont"];

// The mission's regional waves, as specified. Some cities in these waves
// were already researched in earlier campaign sessions under a different
// wave grouping (e.g. Irvine, Fullerton, Santa Ana were done before this
// wave lettering existed) — that's fine; the cross-reference below is by
// city name, not by wave membership.
const WAVES = {
	"Wave A — Los Angeles County": [
		"Pasadena", "South Pasadena", "Alhambra", "Monterey Park", "Temple City", "Rosemead", "El Monte",
		"South El Monte", "Baldwin Park", "West Covina", "Covina", "Glendora", "Azusa", "Duarte", "Monrovia",
		"Arcadia", "Sierra Madre", "San Dimas", "La Verne", "Claremont", "Pomona", "Diamond Bar", "Walnut",
		"Industry", "Whittier", "Pico Rivera", "Downey", "Norwalk", "Cerritos", "Lakewood", "Torrance",
		"Redondo Beach", "Manhattan Beach", "Hermosa Beach", "Hawthorne", "Gardena", "Carson", "Compton",
		"Inglewood", "Culver City", "Burbank", "Glendale", "Santa Monica", "Beverly Hills", "West Hollywood",
		"Malibu",
	],
	"Wave B — Orange County": [
		"Anaheim", "Orange", "Santa Ana", "Irvine", "Fullerton", "Garden Grove", "Westminster", "Costa Mesa",
		"Huntington Beach", "Newport Beach", "Tustin", "Yorba Linda", "Brea", "Placentia", "Buena Park",
		"La Habra", "Cypress", "Stanton", "Seal Beach", "Fountain Valley", "Laguna Beach", "Laguna Niguel",
		"Laguna Hills", "Mission Viejo", "Lake Forest", "Rancho Santa Margarita", "San Clemente", "Dana Point",
		"San Juan Capistrano", "Aliso Viejo",
	],
	"Wave C — Inland Empire": [
		"Riverside", "Corona", "Moreno Valley", "Jurupa Valley", "Eastvale", "Norco", "Perris", "Menifee",
		"Temecula", "Murrieta", "Lake Elsinore", "Hemet", "San Jacinto", "Beaumont", "Banning", "Ontario",
		"Rancho Cucamonga", "Upland", "Chino", "Chino Hills", "Fontana", "Rialto", "Redlands", "San Bernardino",
		"Colton", "Highland", "Loma Linda", "Yucaipa", "Victorville", "Hesperia", "Apple Valley", "Barstow",
	],
	"Wave D — San Diego County": [
		"San Diego", "Chula Vista", "Coronado", "National City", "Imperial Beach", "La Mesa", "Lemon Grove",
		"El Cajon", "Santee", "Poway", "Escondido", "San Marcos", "Vista", "Oceanside", "Carlsbad", "Encinitas",
		"Solana Beach", "Del Mar",
	],
	"Wave E — Bay Area": [
		"San Francisco", "Oakland", "Berkeley", "Alameda", "Emeryville", "Albany", "El Cerrito", "Richmond",
		"San Pablo", "Pinole", "Hercules", "Martinez", "Concord", "Pleasant Hill", "Walnut Creek", "Lafayette",
		"Orinda", "Moraga", "Danville", "San Ramon", "Dublin", "Pleasanton", "Livermore", "Hayward",
		"San Leandro", "Union City", "Newark", "Fremont", "Antioch", "Pittsburg", "Brentwood", "Oakley",
	],
	"Wave F — Peninsula and South Bay": [
		"Daly City", "South San Francisco", "San Bruno", "Millbrae", "Burlingame", "San Mateo", "Foster City",
		"Belmont", "San Carlos", "Redwood City", "Menlo Park", "East Palo Alto", "Atherton", "Woodside",
		"Portola Valley", "Palo Alto", "Mountain View", "Sunnyvale", "Santa Clara", "San José", "Milpitas",
		"Cupertino", "Campbell", "Los Gatos", "Monte Sereno", "Saratoga", "Morgan Hill", "Gilroy",
	],
	"Wave G — North Bay": [
		"Santa Rosa", "Petaluma", "Rohnert Park", "Cotati", "Sebastopol", "Healdsburg", "Windsor", "Sonoma",
		"Napa", "American Canyon", "Calistoga", "St. Helena", "Yountville", "Vallejo", "Benicia", "Fairfield",
		"Suisun City", "Vacaville", "Dixon", "San Rafael", "Novato", "Mill Valley", "Sausalito", "Larkspur",
		"Corte Madera", "Tiburon", "Fairfax", "San Anselmo", "Ross",
	],
	"Wave H — Sacramento region": [
		"Sacramento", "West Sacramento", "Elk Grove", "Galt", "Rancho Cordova", "Folsom", "Citrus Heights",
		"Roseville", "Rocklin", "Lincoln", "Auburn", "Davis", "Woodland", "Winters",
	],
	"Wave I — Central Valley": [
		"Stockton", "Lodi", "Manteca", "Tracy", "Ripon", "Escalon", "Modesto", "Turlock", "Ceres", "Riverbank",
		"Oakdale", "Patterson", "Newman", "Merced", "Atwater", "Los Banos", "Madera", "Chowchilla", "Fresno",
		"Clovis", "Sanger", "Selma", "Reedley", "Kingsburg", "Visalia", "Tulare", "Porterville", "Dinuba",
		"Hanford", "Lemoore", "Corcoran", "Bakersfield", "Delano", "Shafter", "Wasco", "McFarland", "Arvin",
		"Tehachapi", "Ridgecrest",
	],
	"Wave J — Central Coast": [
		"Santa Cruz", "Capitola", "Scotts Valley", "Watsonville", "Monterey", "Pacific Grove",
		"Carmel-by-the-Sea", "Seaside", "Marina", "Salinas", "Gonzales", "Soledad", "Greenfield", "King City",
		"San Luis Obispo", "Paso Robles", "Atascadero", "Morro Bay", "Pismo Beach", "Arroyo Grande",
		"Grover Beach", "Santa Maria", "Lompoc", "Santa Barbara", "Goleta", "Carpinteria", "Ventura", "Oxnard",
		"Camarillo", "Thousand Oaks", "Moorpark", "Simi Valley", "Ojai", "Fillmore", "Santa Paula",
	],
	"Wave K — Northern California": [
		"Redding", "Anderson", "Shasta Lake", "Red Bluff", "Chico", "Oroville", "Paradise", "Gridley",
		"Yuba City", "Marysville", "Grass Valley", "Nevada City", "Truckee", "Eureka", "Arcata", "Fortuna",
		"Crescent City", "Ukiah", "Willits", "Lakeport", "Clearlake",
	],
};

async function loadExistingCities() {
	const files = (await readdir(LOCALITIES_DIR)).filter((f) => f.endsWith(".json"));
	const byCity = new Map(); // normalized city name -> [{record_id, county}]
	for (const f of files) {
		const record = JSON.parse(await readFile(path.join(LOCALITIES_DIR, f), "utf8"));
		const city = record.city?.value;
		if (!city) continue;
		const key = city.toLowerCase();
		if (!byCity.has(key)) byCity.set(key, []);
		byCity.get(key).push({ record_id: record.record_id, county: record.county?.value ?? null });
	}
	return byCity;
}

async function main() {
	const byCity = await loadExistingCities();
	const blockedSet = new Set(INVESTIGATED_BUT_BLOCKED.map((c) => c.toLowerCase()));
	const waveReports = {};
	let totalCities = 0, totalDone = 0, totalBlocked = 0, totalRemaining = 0;

	for (const [wave, cities] of Object.entries(WAVES)) {
		const done = [];
		const blocked = [];
		const remaining = [];
		for (const city of cities) {
			const key = city.toLowerCase();
			if (byCity.has(key)) {
				done.push({ city, records: byCity.get(key) });
			} else if (blockedSet.has(key)) {
				blocked.push({ city });
			} else {
				remaining.push({ city });
			}
		}
		waveReports[wave] = {
			total: cities.length,
			done_count: done.length,
			blocked_count: blocked.length,
			remaining_count: remaining.length,
			done,
			blocked,
			remaining,
		};
		totalCities += cities.length;
		totalDone += done.length;
		totalBlocked += blocked.length;
		totalRemaining += remaining.length;
	}

	const queue = {
		generated_at: new Date().toISOString(),
		summary: {
			total_cities_in_queue: totalCities,
			already_researched: totalDone,
			investigated_but_blocked: totalBlocked,
			remaining: totalRemaining,
		},
		waves: waveReports,
	};

	await writeFile(OUT_PATH, JSON.stringify(queue, null, 2) + "\n", "utf8");
	console.log(JSON.stringify(queue.summary, null, 2));
	console.error(`\nQueue written to ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
	main().catch((err) => {
		console.error("error:", err.stack ?? String(err));
		process.exit(1);
	});
}
