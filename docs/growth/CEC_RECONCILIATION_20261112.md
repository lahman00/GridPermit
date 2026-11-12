# CEC reconciliation, 2026-11-12

Generated from `data/cec/residential-solar-permitting-status-2026-11-02.json` (CEC data last updated 2026-11-02, self-reported by each jurisdiction, not certified by the CEC) and the 298 published California guide records, with `recordVsCec` in `src/lib/permit-data-study.ts`: the same comparison the data page counts and the CSV's `record_vs_cec` column shows. Nothing in a guide or record was changed.

- Matched by exact name: 298 of 298.
- CEC lists a platform: 266 (SolarAPP+ 198, Symbium 42, custom 26); without a platform 25; exempt 7.
- Our record states an automated path: 201; an express or over-the-counter path: 13.
- `consistent`: 188. Both name the same platform (an automated path whose platform the record does not name counts as consistent with a CEC custom platform).
- `cec_platform_not_in_record`: 72. The CEC lists a platform that our record does not name: record does not state a path 58, record states only an express or over-the-counter path 10, record states an automated path without naming SolarAPP+ or Symbium 4.
- `conflict`: 10. The automated path in our record does not match the CEC report.
- `no_platform_in_either`: 28. Our record names no automated path and the CEC lists none (an express path and "without platform" are compatible).

## Conflicts (re-read these first)

| City | Our record | CEC |
|---|---|---|
| Camarillo | SolarAPP+ (pathway field) | No platform reported |
| Campbell | SolarAPP+ (pathway field) | Custom platform |
| Chino Hills | SolarAPP+ (pathway field) | Custom platform |
| Chowchilla | SolarAPP+ (pathway field) | No platform reported |
| Citrus Heights | SolarAPP+ (pathway field) | Custom platform |
| Diamond Bar | SolarAPP+ (pathway field) | Custom platform |
| Indio | SolarAPP+ (pathway field) | Custom platform |
| Palmdale | SolarAPP+ (pathway field) | Custom platform |
| Seaside | SolarAPP+ (pathway field) | No platform reported |
| Selma | SolarAPP+ (pathway field) | No platform reported |

## CEC lists a platform that our record does not name

Record states only an express or over-the-counter path (10; includes several of the largest cities):
- CEC SolarAPP+ (3): Fountain Valley, Hayward, Pleasanton
- CEC Custom platform (7): Anaheim, Cerritos, Long Beach, Los Angeles, Redlands, San Diego, San José

Record states an automated path without naming the platform (4):
- CEC SolarAPP+ (2): Menlo Park, Santee
- CEC Symbium (2): Burbank, Folsom

Record does not state a path (58):
- CEC SolarAPP+ (41): Alameda, Alhambra, Apple Valley, Arroyo Grande, Atherton, Chino, Corcoran, Costa Mesa, Danville, East Palo Alto, Fairfax, Glendora, Gonzales, Hawthorne, Healdsburg, Hemet, La Habra, Laguna Beach, Lake Forest, Lemoore, Manhattan Beach, Marina, Mission Viejo, Modesto, Monterey, Norwalk, Pacific Grove, Rancho Santa Margarita, Redondo Beach, San Leandro, San Marcos, San Pablo, Santa Maria, Seal Beach, Sierra Madre, Victorville, Walnut, Walnut Creek, Willits, Woodside, Yucaipa
- CEC Symbium (5): Bakersfield, Irvine, Larkspur, Lincoln, Los Banos
- CEC Custom platform (12): Colton, Glendale, Lake Elsinore, Loma Linda, Palm Springs, Pasadena, Paso Robles, San Rafael, Santa Barbara, Sebastopol, Shafter, Tracy

## No platform in either (28)

- Express or over-the-counter path, CEC without a platform or exempt (3): Atascadero, Napa, St. Helena
- Record does not state a path, CEC without a platform (18): American Canyon, Azusa, Baldwin Park, Ceres, Fillmore, Garden Grove, Gridley, Imperial Beach, Millbrae, Ojai, Orange, Placentia, Porterville, Poway, Shasta Lake, South El Monte, Suisun City, West Hollywood
- Record does not state a path, CEC exempt (7): Carmel-by-the-Sea, City of Industry, Del Mar, Monte Sereno, Nevada City, Portola Valley, Ross

## Order of work

Change a record only after re-reading the city's own permit page (not a vendor list or this file): first the conflicts, then the express-path cities, then the rest, largest cities first. Guides inside a measurement window wait until it closes (guide descriptions: after 2026-12-16) unless the owner decides otherwise. The CEC status is self-reported and can lag or lead a city's page; a difference is a prompt to check, not proof that either source is wrong.
