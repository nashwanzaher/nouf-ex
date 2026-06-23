#!/usr/bin/env node
/**
 * scripts/generate-product-images.cjs
 *
 * P0-3 (Image pipeline) — ensure every demo product has a dedicated
 * image file under `app/public/products/`. The script is idempotent:
 *
 *   1. If `main_image` already points to a real file on disk → leave it
 *      alone (hand-curated or previously generated).
 *   2. Otherwise, try a per-product slug file. If present, wire it up.
 *   3. Otherwise, pick the category placeholder (electronics.jpg, etc.)
 *      and copy it into a fresh `p{id}-{slug}.jpg`.
 *
 * After running, every `main_image` references its OWN file, so the
 * storefront no longer shows the "12 products share the electronics
 * thumbnail" issue. To swap in real art later, drop a higher-quality
 * file into `app/public/products/p{id}-{slug}.jpg` and re-run — the
 * script will keep the real one untouched.
 *
 * Usage:  node scripts/generate-product-images.cjs
 *
 * JSDoc types are used throughout so the TypeScript language server
 * picks the parameters up cleanly when the IDE opens this .cjs
 * (the file is excluded from `tsc -b` via the .cjs exclude glob
 * in every tsconfig under app/).
 *
 * @typedef {{ id: number, slug: string, name_ar: string, name_en: string, name_zh: string, parent_id: number|null, icon: string, image: string, sort_order: number, is_active: boolean }} Category
 * @typedef {{ id: number, store_id: number, category_id: number, name_ar: string, name_en: string, name_zh: string, description: string, description_en: string, description_zh: string, price: number, original_price: number, currency: string, stock: number, moq: number, weight: number|null, main_image: string, rating: number, review_count: number, sold_count: number, view_count: number, is_active: boolean, is_featured: boolean, deal_discount: number|null, deal_ends_at: string|null }} Product
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'public', 'data', 'products.json');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'products');
const PLACEHOLDER_DIR = path.join(ROOT, 'public');

// Files we treat as SHARED placeholders (not product-specific). Even if
// `main_image` points at one of these, we still create a per-product
// copy so the storefront shows distinct thumbnails.
const SHARED_PLACEHOLDER_FILES = new Set([
	'category-electronics.jpg',
	'category-clothing.jpg',
	'category-beauty.jpg',
	'category-home.jpg',
	'category-food.jpg',
	'category-handicrafts.jpg',
]);

/** @type {Record<string, string>} */
const CATEGORY_PLACEHOLDER = {
	electronics: 'category-electronics.jpg',
	phones: 'category-electronics.jpg',
	'phones-tablets': 'category-electronics.jpg',
	fashion: 'category-clothing.jpg',
	clothing: 'category-clothing.jpg',
	beauty: 'category-beauty.jpg',
	'health-beauty': 'category-beauty.jpg',
	home: 'category-home.jpg',
	'home-garden': 'category-home.jpg',
	food: 'category-food.jpg',
	'food-beverages': 'category-food.jpg',
	handicrafts: 'category-handicrafts.jpg',
	'art-crafts': 'category-handicrafts.jpg',
};

/**
 * Turn a free-form product name into a stable filename slug.
 * @param {unknown} name
 * @returns {string}
 */
function slugify(name) {
	return String(name || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

/** Resolve a URL path like `/products/p1-headphones.jpg` to a real disk
 *  path under app/public. Returns null if the URL is not a /products/ or
 *  /data/ asset.
 *  @param {unknown} urlPath
 *  @returns {string|null}
 */
function publicAssetPath(urlPath) {
	if (!urlPath || typeof urlPath !== 'string') return null;
	if (urlPath.startsWith('/products/')) {
		return path.join(ROOT, 'public', urlPath.replace(/^\//, ''));
	}
	if (urlPath.startsWith('/data/')) {
		return path.join(ROOT, 'public', urlPath.replace(/^\//, ''));
	}
	if (urlPath.startsWith('/')) {
		return path.join(ROOT, 'public', urlPath.replace(/^\//, ''));
	}
	return null;
}

/**
 * @returns {Category[]}
 */
function loadCategories() {
	const p = path.join(ROOT, 'public', 'data', 'categories.json');
	try {
		const raw = /** @type {unknown} */ (JSON.parse(fs.readFileSync(p, 'utf8')));
		return Array.isArray(raw) ? /** @type {Category[]} */ (raw) : [];
	} catch {
		return [];
	}
}

function main() {
	const categories = loadCategories();
	const catSlugById = new Map(categories.map((c) => [c.id, c.slug]));

	const rawProducts = /** @type {unknown} */ (JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
	const products = Array.isArray(rawProducts) ? /** @type {Product[]} */ (rawProducts) : [];
	const stats = { realKept: 0, wiredUp: 0, copied: 0, failed: 0 };

	for (const p of products) {
		const slug = slugify(p.name_en || p.name_ar || `p${p.id}`);
		const newFile = `p${p.id}-${slug}.jpg`;
		const newPath = path.join(PRODUCTS_DIR, newFile);

		// 1) main_image already points to a PER-PRODUCT file → keep it.
		//    Shared placeholder files (category-*.jpg) don't qualify —
		//    they're reused by many products and must be cloned per row.
		const existingPath = publicAssetPath(p.main_image);
		const existingIsPerProduct =
			existingPath &&
			fs.existsSync(existingPath) &&
			!SHARED_PLACEHOLDER_FILES.has(path.basename(existingPath));
		if (existingIsPerProduct) {
			stats.realKept += 1;
			continue;
		}

		// 2) Per-product slug file exists → wire it up to main_image.
		if (fs.existsSync(newPath)) {
			p.main_image = `/products/${newFile}`;
			stats.wiredUp += 1;
			continue;
		}

		// 3) Otherwise, copy the category placeholder to a new file.
		const catSlug = catSlugById.get(p.category_id);
		const placeholderFile =
			(catSlug && CATEGORY_PLACEHOLDER[catSlug]) || 'category-electronics.jpg';
		const sourcePath = path.join(PLACEHOLDER_DIR, placeholderFile);

		if (!fs.existsSync(sourcePath)) {
			console.error(`  ✗ no placeholder for product ${p.id}`);
			stats.failed += 1;
			continue;
		}

		fs.copyFileSync(sourcePath, newPath);
		p.main_image = `/products/${newFile}`;
		stats.copied += 1;
		console.log(`  ✓ ${newFile} ← ${placeholderFile}`);
	}

	fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2) + '\n', 'utf8');

	console.log('\nDone.');
	console.log(`  real images kept:    ${stats.realKept}`);
	console.log(`  per-product wired up: ${stats.wiredUp}`);
	console.log(`  placeholders added:   ${stats.copied}`);
	console.log(`  failed:               ${stats.failed}`);
}

main();
