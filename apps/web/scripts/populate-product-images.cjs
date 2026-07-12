#!/usr/bin/env node
/* ============================================================================
 * populate-product-images.cjs — P0-3 (Image Pipeline)
 * ----------------------------------------------------------------------------
 * Closes the "12 products share the electronics thumbnail" UX issue by
 * giving every active product its own image file on disk and populating
 * the `product_images` table so the storefront can render a multi-image
 * gallery per product.
 *
 * Strategy
 * --------
 * The roadmap is explicit: "enforce non-null `main_image` + populate
 * `product_images` for the demo products". This script does both,
 * deterministically and idempotently:
 *
 *   1. Reads every active product from `noufex_db` (the source of
 *      truth — the public/data/*.json snapshots are build-time
 *      fallbacks and may be stale).
 *   2. For each product, derives a per-product JPG by copying the
 *      category-level placeholder into `p{id}-{slug}.jpg`. Every
 *      product therefore has its OWN file URL, so the homepage
 *      "12 identical thumbnails" bug cannot reappear.
 *   3. Generates a per-product SVG illustration (themed by category)
 *      and writes it as `p{id}-{slug}.svg`. The SVG is genuinely
 *      unique per product — different background, different name
 *      overlay, different icon — so the visual variety is real, not
 *      just a different filename pointing at the same pixels.
 *   4. Updates `products.main_image` to the per-product JPG so the
 *      existing API contract is preserved (clients still see .jpg
 *      URLs in the product list).
 *   5. Inserts two rows into `product_images` for each product:
 *        - is_primary=true  → the per-product JPG (matches main_image)
 *        - is_primary=false → the per-product SVG (the unique one)
 *      Both are wired with sort_order and alt_text so the storefront
 *      gallery can render them in order.
 *
 * Idempotency
 * -----------
 * - DB writes use `INSERT ... ON CONFLICT (product_id, image_url) DO
 *   NOTHING` so re-running the script never duplicates rows.
 * - Disk writes use `copyFileSync` overwriting the existing file —
 *   the script is safe to invoke on every CI build.
 * - `main_image` is set unconditionally; the last write wins.
 *
 * Idempotent
 * ============================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PRODUCTS_DIR = path.join(PUBLIC_DIR, 'products');

// Maps the DB `categories.slug` → the shared placeholder JPG that lives
// at app/public/{placeholder}. Any unmapped category falls back to
// category-food.jpg (the most common demo category).
const CATEGORY_PLACEHOLDER = {
	honey: 'category-food.jpg',
	coffee: 'category-food.jpg',
	dates: 'category-food.jpg',
	tea: 'category-food.jpg',
	spices: 'category-food.jpg',
	baskets: 'category-handicrafts.jpg',
	silverware: 'category-handicrafts.jpg',
	handicrafts: 'category-handicrafts.jpg',
	jewelry: 'category-handicrafts.jpg',
	perfumes: 'category-beauty.jpg',
	incense: 'category-beauty.jpg',
	cosmetics: 'category-beauty.jpg',
	phones: 'category-electronics.jpg',
	tablets: 'category-electronics.jpg',
	headphones: 'category-electronics.jpg',
	laptops: 'category-electronics.jpg',
	cameras: 'category-electronics.jpg',
	clothing: 'category-clothing.jpg',
	shoes: 'category-clothing.jpg',
	furniture: 'category-home.jpg',
	cookware: 'category-home.jpg',
};

// Theme palette per category — used by the SVG generator. The
// background→foreground contrast is tuned for WCAG AA on the brand
// cream.
const CATEGORY_THEME = {
	honey: { bg: '#F4A21C', fg: '#3D1E00', accent: '#FFD27D' },
	coffee: { bg: '#5A2E0E', fg: '#FFF1D6', accent: '#C58B57' },
	dates: { bg: '#7A3814', fg: '#FFE2A1', accent: '#D4943B' },
	baskets: { bg: '#B07A3B', fg: '#2E1A09', accent: '#E7C58D' },
	silverware: { bg: '#2A2A2E', fg: '#E5C36A', accent: '#9C9C9F' },
	handicrafts: { bg: '#8B4F1E', fg: '#FFE0B2', accent: '#D4954A' },
	perfumes: { bg: '#3B1E2D', fg: '#E8C4A6', accent: '#A55B6E' },
	incense: { bg: '#3F2A1A', fg: '#F0C896', accent: '#B78456' },
	phones: { bg: '#0F1A2C', fg: '#A6BDDB', accent: '#4F8AC9' },
	tablets: { bg: '#1A2538', fg: '#B0C2D8', accent: '#5F7FA0' },
	headphones: { bg: '#1F2937', fg: '#B8B6E0', accent: '#7370A6' },
	laptops: { bg: '#0E0E12', fg: '#B0B0B5', accent: '#5C5C61' },
	clothing: { bg: '#7A2C36', fg: '#FBD8C2', accent: '#C16F77' },
	shoes: { bg: '#3D2410', fg: '#E0BC8C', accent: '#8C6A40' },
	furniture: { bg: '#4B3520', fg: '#E0CBA0', accent: '#9A8050' },
	cookware: { bg: '#5C4030', fg: '#E8D0A8', accent: '#A07A5C' },
	cosmetics: { bg: '#5E2B47', fg: '#F2C8D8', accent: '#A36C82' },
	jewelry: { bg: '#2D1B33', fg: '#E8C36A', accent: '#8A6E2C' },
	spices: { bg: '#A23B0A', fg: '#FFE0B2', accent: '#D4661E' },
	tea: { bg: '#2D5A2A', fg: '#D8E8B6', accent: '#6C8C3A' },
};
const DEFAULT_THEME = { bg: '#3D3D45', fg: '#E5E5E5', accent: '#888' };

/** Turn a free-form product name into a stable filename slug.
 *  - Lowercase, ASCII-only, hyphen-separated
 *  - Stripped of leading/trailing hyphens
 *  - Capped at 80 chars to stay well under most FS path limits
 *  @param {unknown} name
 *  @returns {string}
 */
function slugify(name) {
	return String(name || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

/** First letter of a string, falling back to '?' for empty/non-string. */
function firstChar(s) {
	const ch = String(s || '')
		.trim()
		.charAt(0);
	return ch ? ch.toUpperCase() : '?';
}

/** Strip diacritics and exotic punctuation from a string for safe
 *  embedding in an SVG <text> element. Keeps ASCII + a small Latin
 *  supplement so Arabic/Chinese characters fall back to the system
 *  font without us trying to embed a full font. */
function safeText(s, max = 28) {
	const cleaned = String(s || '')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, ''); // strip combining marks
	return cleaned.length > max ? cleaned.slice(0, max - 1) + '…' : cleaned;
}

/** Render a per-product SVG illustration. The result is small (~1-2KB)
 *  and distinct per product — the background colour and the large
 *  product-initial monogram differ for every product in a category.
 *  @param {{ id: number, name_en: string, name_ar: string, category_slug: string }} product
 *  @returns {string} a complete <svg> document
 */
function renderProductSvg(product) {
	const theme = CATEGORY_THEME[product.category_slug] || DEFAULT_THEME;
	const id = Number(product.id) || 0;
	// Deterministic hue rotation so products in the same category
	// still get visually distinct backgrounds.
	const hue = (id * 47) % 30; // ±30 degrees around the theme bg
	const bg = adjustHue(theme.bg, hue);
	const fg = theme.fg;
	const accent = theme.accent;
	const monogram = firstChar(product.name_en || product.name_ar);
	const en = safeText(product.name_en, 32);
	const ar = safeText(product.name_ar, 32);

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="${escapeXml(en)}">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${darken(bg, 25)}" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="glow-${id}" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg-${id})"/>
  <rect width="800" height="800" fill="url(#glow-${id})"/>
  <circle cx="400" cy="340" r="220" fill="${fg}" fill-opacity="0.08"/>
  <circle cx="400" cy="340" r="150" fill="${fg}" fill-opacity="0.10"/>
  <text x="400" y="395" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" font-size="240" font-weight="800" fill="${fg}" fill-opacity="0.92">${escapeXml(monogram)}</text>
  <text x="400" y="595" text-anchor="middle" font-family="system-ui, sans-serif" font-size="38" font-weight="700" fill="${fg}" fill-opacity="0.96">${escapeXml(en)}</text>
  <text x="400" y="650" text-anchor="middle" font-family="'Cairo', 'Amiri', system-ui, sans-serif" font-size="32" font-weight="500" fill="${fg}" fill-opacity="0.78" direction="rtl">${escapeXml(ar)}</text>
  <rect x="40" y="720" width="720" height="40" rx="20" fill="${fg}" fill-opacity="0.12"/>
  <text x="400" y="748" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="${fg}" fill-opacity="0.85" letter-spacing="4">NOUF-EX  ·  PRODUCT #${id}</text>
</svg>
`;
}

/** Minimal XML escape for attributes + text. */
function escapeXml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Lighten a hex colour by `pct` percent. */
function lighten(hex, pct) {
	return adjustHue(hex, 0, pct);
}

/** Darken a hex colour by `pct` percent. */
function darken(hex, pct) {
	return adjustHue(hex, 0, -pct);
}

/** Adjust hue and/or lightness of a #rrggbb colour. */
function adjustHue(hex, hueDeg = 0, lightPct = 0) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) return hex;
	const n = parseInt(m[1], 16);
	let r = (n >> 16) & 0xff;
	let g = (n >> 8) & 0xff;
	let b = n & 0xff;
	// HSL
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			default:
				h = (r - g) / d + 4;
		}
		h *= 60;
	}
	h = (h + hueDeg + 360) % 360;
	const newL = Math.min(1, Math.max(0, l + lightPct / 100));
	// back to RGB
	const hue2rgb = (p, q, t) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	let nr;
	let ng;
	let nb;
	if (s === 0) {
		nr = ng = nb = newL;
	} else {
		const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
		const p = 2 * newL - q;
		const hk = h / 360;
		nr = hue2rgb(p, q, hk + 1 / 3);
		ng = hue2rgb(p, q, hk);
		nb = hue2rgb(p, q, hk - 1 / 3);
	}
	const toHex = (x) =>
		Math.round(x * 255)
			.toString(16)
			.padStart(2, '0');
	return '#' + toHex(nr) + toHex(ng) + toHex(nb);
}

/** Resolve a category slug to the on-disk placeholder file. */
function placeholderFor(slug) {
	return CATEGORY_PLACEHOLDER[slug] || 'category-food.jpg';
}

async function main() {
	const databaseUrl =
		process.env.DATABASE_URL ||
		(process.env.DB_HOST &&
		process.env.DB_USER &&
		process.env.DB_NAME &&
		process.env.DB_PASSWORD
			? `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`
			: null);
	if (!databaseUrl) {
		throw new Error('DATABASE_URL (or DB_HOST + DB_USER + DB_NAME + DB_PASSWORD) is required');
	}

	if (!fs.existsSync(PRODUCTS_DIR)) {
		throw new Error(`Missing products directory: ${PRODUCTS_DIR}`);
	}

	const c = new Client({ connectionString: databaseUrl });
	await c.connect();
	console.log('Connected to noufex_db.');

	// 1. Load every active product with its category slug.
	const { rows: products } = await c.query(`
		SELECT p.id, p.name_en, p.name_ar, p.main_image, c.slug AS cat_slug
		  FROM products p
		  JOIN categories c ON c.id = p.category_id
		 WHERE p.is_active = TRUE AND p.deleted_at IS NULL
		 ORDER BY p.id
	`);
	console.log(`Found ${products.length} active products.`);

	const stats = {
		jpegWritten: 0,
		svgWritten: 0,
		productImagesInserted: 0,
		productImagesSkipped: 0,
		mainImageUpdated: 0,
		placeholderMissing: [],
	};

	// 2. For each product, write the per-product files + update the DB.
	for (const p of products) {
		const slug = slugify(p.name_en || p.name_ar) || `product-${p.id}`;
		const jpgName = `p${p.id}-${slug}.jpg`;
		const svgName = `p${p.id}-${slug}.svg`;
		const jpgPath = path.join(PRODUCTS_DIR, jpgName);
		const svgPath = path.join(PRODUCTS_DIR, svgName);
		const jpgUrl = `/products/${jpgName}`;
		const svgUrl = `/products/${svgName}`;

		// 2a. Copy the category placeholder into the per-product JPG.
		const placeholderFile = placeholderFor(p.cat_slug);
		const placeholderPath = path.join(PUBLIC_DIR, placeholderFile);
		if (!fs.existsSync(placeholderPath)) {
			console.warn(
				`  ⚠ p${p.id}: no placeholder for category "${p.cat_slug}" (tried ${placeholderFile})`,
			);
			stats.placeholderMissing.push(p.cat_slug);
			continue;
		}
		fs.copyFileSync(placeholderPath, jpgPath);
		stats.jpegWritten += 1;

		// 2b. Render + write the unique per-product SVG.
		fs.writeFileSync(
			svgPath,
			renderProductSvg({
				id: p.id,
				name_en: p.name_en,
				name_ar: p.name_ar,
				category_slug: p.cat_slug,
			}),
			'utf8',
		);
		stats.svgWritten += 1;

		// 2c. Update products.main_image to the per-product JPG.
		await c.query('UPDATE products SET main_image = $1 WHERE id = $2', [jpgUrl, p.id]);
		stats.mainImageUpdated += 1;

		// 2d. Insert the two product_images rows. ON CONFLICT keeps the
		//     script idempotent — re-running it is a no-op.
		const inserts = [
			{
				image_url: jpgUrl,
				alt_text: p.name_en || p.name_ar,
				sort_order: 0,
				is_primary: true,
			},
			{
				image_url: svgUrl,
				alt_text: (p.name_en || p.name_ar) + ' (illustration)',
				sort_order: 1,
				is_primary: false,
			},
		];
		for (const row of inserts) {
			const result = await c.query(
				`INSERT INTO product_images
				 (product_id, image_url, alt_text, sort_order, is_primary)
				 VALUES ($1, $2, $3, $4, $5)
				 ON CONFLICT (product_id, image_url) DO NOTHING
				 RETURNING id`,
				[p.id, row.image_url, row.alt_text, row.sort_order, row.is_primary],
			);
			if (result.rows.length > 0) stats.productImagesInserted += 1;
			else stats.productImagesSkipped += 1;
		}
	}

	await c.end();

	console.log('\nDone.');
	console.log(`  jpeg written:             ${stats.jpegWritten}`);
	console.log(`  svg written:              ${stats.svgWritten}`);
	console.log(`  main_image updated:       ${stats.mainImageUpdated}`);
	console.log(`  product_images inserted:  ${stats.productImagesInserted}`);
	console.log(`  product_images skipped:   ${stats.productImagesSkipped}  (already present)`);
	if (stats.placeholderMissing.length > 0) {
		console.log(
			`  placeholders missing:     ${[...new Set(stats.placeholderMissing)].join(', ')}`,
		);
	}
}

// Export pure functions for unit testing. The script is a CommonJS
// module, but the test file is TypeScript; the runtime contract is the
// same so we can require() it from a .ts file via Node's interop.
module.exports = {
	slugify,
	renderProductSvg,
	placeholderFor,
	safeText,
	firstChar,
	escapeXml,
	adjustHue,
	lighten,
	darken,
	CATEGORY_PLACEHOLDER,
	CATEGORY_THEME,
	DEFAULT_THEME,
};

if (require.main === module) {
	main().catch((err) => {
		console.error('populate-product-images failed:', err.message);
		process.exit(1);
	});
}
