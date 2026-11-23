# Lightweight state explorer geography

Representative city points: U.S. Census Bureau 2026 National Places Gazetteer, retrieved 2026-11-23:
https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip

State outlines: Census Generalized_ACS2025 State_County, polygon layer7, retrieved 2026-11-23; state06/08, outSR4326, maxAllowableOffset0.015 degrees:
https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2025/State_County/MapServer/7

Coordinates use a shared equirectangular projection per state (longitude scaled by cosine of mid-latitude) into a600x600 viewport. Outline simplification is for visual orientation only. Points are representative places, not permit/utility territories or precise addresses. Gazetteer aliases: Ventura = San Buenaventura (Ventura), Paso Robles = El Paso de Robles (Paso Robles), City of Industry = Industry. Accents are normalized for matching.

This file is geography only, NOT the publication allowlist. StateCityMap intersects READY locality index entries with actual city guide page sources, deduplicates URLs and fails build if an eligible published city lacks coordinates. Unpublished/research-only cities do not render. No remote requests, SDKs, packages or paid services at runtime. No geolocation.
