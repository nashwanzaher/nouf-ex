'use strict';

const fs = require('node:fs');
const path = require('node:path');

const dist = path.resolve(__dirname, '..', '..', 'apps', 'web', 'dist');
const forbidden = [
	'SAMPLE_COUPONS',
	'live-commerce-teaser.mp4',
	'/category-electronics.jpg',
	'/category-clothing.jpg',
	'/category-food.jpg',
	'/category-handicrafts.jpg',
	'/category-beauty.jpg',
	'/category-home.jpg',
	'www.nouf-ex.com/',
	'١,٢٤٥ مشاهد',
];

function filesIn(directory) {
	if (!fs.existsSync(directory)) return [];
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const target = path.join(directory, entry.name);
		return entry.isDirectory() ? filesIn(target) : [target];
	});
}

if (!fs.existsSync(dist)) {
	throw new Error(`web build directory is missing: ${dist}`);
}

const violations = [];
for (const file of filesIn(dist)) {
	const content = fs.readFileSync(file, 'utf8');
	for (const marker of forbidden) {
		if (content.includes(marker)) violations.push({ file, marker });
	}
}

if (violations.length > 0) {
	console.error(JSON.stringify({ violations }, null, 2));
	process.exitCode = 1;
} else {
	console.log('[production-data] no demo commerce markers found in web build');
}
