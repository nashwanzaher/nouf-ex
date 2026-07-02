/**
 * Temporary diagnostic script for the K.8 governorate integration.
 * This script reads sections of api.ts and useApi.ts so we can
 * confirm the exact insertion anchors for the new symbols.
 *
 * No files outside of `scripts/_temp-extract/` are created.
 */
const fs = require('node:fs');
const path = require('node:path');

function readPortion(filePath, startLine, endLine, label) {
	const text = fs.readFileSync(filePath, 'utf8');
	const lines = text.split(/\n/);
	const slice = lines.slice(startLine, endLine).join('\n');
	const out = path.join(__dirname, `_temp-extract-${label}.txt`);
	fs.writeFileSync(out, slice, 'utf8');
	console.log(`Wrote lines ${startLine}-${endLine} of ${path.basename(filePath)} -> ${path.basename(out)} (${slice.length} chars)`);
}

const API = path.join(__dirname, '..', 'app', 'src', 'lib', 'api.ts');
const USE_API = path.join(__dirname, '..', 'app', 'src', 'hooks', 'useApi.ts');
const REPORTS = path.join(__dirname, '..', 'app', 'src', 'pages', 'admin', 'ReportsAnalytics.tsx');

// Lines 250-450 of api.ts (likely admin section)
readPortion(API, 250, 450, 'api-250-450');
readPortion(API, 450, 700, 'api-450-700');
readPortion(API, 700, 900, 'api-700-900');
readPortion(API, 900, 1200, 'api-900-1200');

// Lines 250-450 of useApi.ts (admin hooks)
readPortion(USE_API, 250, 450, 'useApi-250-450');

// ReportsAnalytics component body (around 250-450)
readPortion(REPORTS, 250, 450, 'reports-250-450');
readPortion(REPORTS, 450, 600, 'reports-450-600');

console.log('Done.');
