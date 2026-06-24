/**
 * Unit tests for the P0-3 image-pipeline helpers in
 * `scripts/populate-product-images.cjs`.
 *
 * The script is .cjs (CommonJS) but exports pure helper functions
 * which we re-import here through a require() call. The actual DB-
 * touching `main()` is NOT exercised — the unit tests target only
 * the deterministic, side-effect-free helpers.
 */
import { describe, expect, it } from 'vitest';
import {
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
} from '../../scripts/populate-product-images.cjs';

describe('slugify()', () => {
	it('lowercases and hyphenates', () => {
		expect(slugify('Premium Wireless Headphones')).toBe('premium-wireless-headphones');
	});

	it('strips non-alphanumeric characters', () => {
		expect(slugify('Yemeni Mokha Coffee — 250g!')).toBe('yemeni-mokha-coffee-250g');
	});

	it('handles Arabic-only names (no ASCII output)', () => {
		// Arabic letters are stripped → empty after collapse.
		// The caller falls back to `product-${id}` so this is safe.
		expect(slugify('عسل يمني')).toBe('');
	});

	it('caps at 80 characters', () => {
		const long = 'a'.repeat(200);
		expect(slugify(long).length).toBe(80);
	});

	it('returns empty string for nullish input', () => {
		expect(slugify(null)).toBe('');
		expect(slugify(undefined)).toBe('');
	});

	it('passes truthy non-string input through as its string form', () => {
		// Digits are valid in a filename slug, so a numeric input
		// coerces to its string representation. (Falsy values like 0,
		// null, undefined, '' are all treated as "no name" — they
		// return '' so the caller falls back to a stable id.)
		expect(slugify(42)).toBe('42');
		expect(slugify(2025)).toBe('2025');
	});

	it('trims leading/trailing hyphens', () => {
		expect(slugify('  --hello--  ')).toBe('hello');
	});
});

describe('firstChar()', () => {
	it('returns uppercase first letter', () => {
		expect(firstChar('hello')).toBe('H');
	});
	it('returns "?" for empty input', () => {
		expect(firstChar('')).toBe('?');
		expect(firstChar(null)).toBe('?');
	});
	it('trims whitespace', () => {
		expect(firstChar('  bonjour')).toBe('B');
	});
});

describe('safeText()', () => {
	it('returns the string as-is when short', () => {
		expect(safeText('hello')).toBe('hello');
	});
	it('truncates with ellipsis when too long', () => {
		const out = safeText('a'.repeat(40), 10);
		expect(out.length).toBe(10);
		expect(out.endsWith('…')).toBe(true);
	});
	it('strips combining marks', () => {
		// "café" with combining acute → "cafe"
		expect(safeText('cafe\u0301')).toBe('cafe');
	});
	it('handles nullish gracefully', () => {
		expect(safeText(null)).toBe('');
		expect(safeText(undefined)).toBe('');
	});
});

describe('escapeXml()', () => {
	it('escapes the five XML metacharacters', () => {
		expect(escapeXml(`<a href="b&c">'d'</a>`)).toBe(
			'&lt;a href=&quot;b&amp;c&quot;&gt;&apos;d&apos;&lt;/a&gt;',
		);
	});
	it('handles empty input', () => {
		expect(escapeXml('')).toBe('');
	});
});

describe('color helpers (adjustHue / lighten / darken)', () => {
	it('lighten moves toward white', () => {
		const out = lighten('#808080', 50);
		// midpoint gray + 50% → lighter gray (closer to white)
		expect(out).toMatch(/^#[0-9a-f]{6}$/);
		// RGB midpoint should have all channels equal
		const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(out);
		expect(m).not.toBeNull();
		if (m) {
			const r = parseInt(m[1], 16);
			const g = parseInt(m[2], 16);
			const b = parseInt(m[3], 16);
			expect(r).toBeGreaterThan(0x80);
			expect(g).toBeGreaterThan(0x80);
			expect(b).toBeGreaterThan(0x80);
		}
	});
	it('darken moves toward black', () => {
		const out = darken('#808080', 50);
		const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(out);
		expect(m).not.toBeNull();
		if (m) {
			const r = parseInt(m[1], 16);
			expect(r).toBeLessThan(0x80);
		}
	});
	it('adjustHue returns a 6-hex-digit string', () => {
		expect(adjustHue('#ff0000', 30)).toMatch(/^#[0-9a-f]{6}$/);
	});
	it('adjustHue falls back to input when malformed', () => {
		expect(adjustHue('not-a-color', 30)).toBe('not-a-color');
	});
});

describe('placeholderFor()', () => {
	it('maps known category slugs', () => {
		expect(placeholderFor('honey')).toBe('category-food.jpg');
		expect(placeholderFor('phones')).toBe('category-electronics.jpg');
		expect(placeholderFor('baskets')).toBe('category-handicrafts.jpg');
		expect(placeholderFor('perfumes')).toBe('category-beauty.jpg');
	});
	it('falls back to category-food.jpg for unknown slugs', () => {
		expect(placeholderFor('unknown-cat')).toBe('category-food.jpg');
		expect(placeholderFor('')).toBe('category-food.jpg');
	});
});

describe('CATEGORY_PLACEHOLDER / CATEGORY_THEME coverage', () => {
	it('every placeholder entry maps to a real category-{x}.jpg', () => {
		for (const file of new Set(Object.values(CATEGORY_PLACEHOLDER))) {
			expect(file).toMatch(/^category-[a-z]+\.jpg$/);
		}
	});
	it('every theme has bg + fg + accent hex codes', () => {
		for (const [slug, t] of Object.entries(CATEGORY_THEME)) {
			expect(t.bg, `${slug} bg`).toMatch(/^#[0-9a-f]{6}$/i);
			expect(t.fg, `${slug} fg`).toMatch(/^#[0-9a-f]{6}$/i);
			expect(t.accent, `${slug} accent`).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});
});

describe('renderProductSvg()', () => {
	const sampleProduct = {
		id: 7,
		name_en: 'Yemeni Silver Set',
		name_ar: 'طقم فضي يمني',
		category_slug: 'silverware',
	};

	it('returns a complete SVG document', () => {
		const svg = renderProductSvg(sampleProduct);
		expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(svg).toContain('<svg');
		expect(svg).toContain('</svg>');
		expect(svg).toContain('viewBox="0 0 800 800"');
	});

	it('embeds the product id in the gradient + brand mark', () => {
		const svg = renderProductSvg(sampleProduct);
		expect(svg).toContain('id="bg-7"');
		expect(svg).toContain('PRODUCT #7');
	});

	it('embeds the monogram (first letter of name_en, uppercased)', () => {
		const svg = renderProductSvg(sampleProduct);
		expect(svg).toMatch(/>Y<\/text>/);
	});

	it('embeds the product name (safeText-truncated)', () => {
		const svg = renderProductSvg({ ...sampleProduct, name_en: 'Yemeni Silver Set' });
		expect(svg).toContain('Yemeni Silver Set');
	});

	it('XML-escapes metacharacters in the name', () => {
		const svg = renderProductSvg({
			...sampleProduct,
			name_en: `A & B <c> "d" 'e'`,
		});
		expect(svg).toContain('A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;');
	});

	it('produces DIFFERENT output for different product ids (visual variety)', () => {
		const a = renderProductSvg({ ...sampleProduct, id: 1 });
		const b = renderProductSvg({ ...sampleProduct, id: 2 });
		// At least the gradient id must differ — the hue rotation is
		// id-dependent, so even with the same name the background
		// is visually distinct.
		expect(a).not.toBe(b);
		expect(a).toContain('id="bg-1"');
		expect(b).toContain('id="bg-2"');
	});

	it('uses the category theme palette', () => {
		const svg = renderProductSvg(sampleProduct);
		const theme = CATEGORY_THEME.silverware;
		// The SVG applies a deterministic hue rotation around the theme
		// base colour, so we can't assert verbatim equality. We DO
		// assert that:
		//  - the gradient definition (bg-X) is referenced (proves the
		//    id is interpolated)
		//  - theme.fg is used verbatim in the text fills (no rotation)
		//  - the gradient stops contain SOME hex colour (proves the
		//    hue-rotation path ran)
		expect(svg).toMatch(/id="bg-7"/);
		expect(svg).toContain(theme.fg);
		expect(svg).toMatch(/<stop offset="0%" stop-color="#[0-9a-f]{6}"/);
	});

	it('falls back to the default theme for unknown categories', () => {
		const svg = renderProductSvg({ ...sampleProduct, category_slug: 'unknown' });
		// Should still produce a valid SVG without throwing.
		expect(svg).toContain('<svg');
		expect(svg).toContain('PRODUCT #7');
	});
});
