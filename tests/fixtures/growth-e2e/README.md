# SYNTHETIC fixtures for tests/growth-pipeline-e2e.test.mjs

Every number, page, CID and partner row in this directory is invented for tests.
None of it is real GridPermit traffic, revenue, search or partner data, and the
CIDs are made-up hex strings that never existed in the outbound store. The header
names in the CSV files are an assumption about what a GA4 UI export looks like
(see docs/MEASUREMENT_EXPORT_GUIDE.md); the mapping file is what binds them.
Do not paste real exports into this directory.
