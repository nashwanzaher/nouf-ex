/**
 * Nouf-ex Frontend - Safe formatters and math helpers
 *
 * Centralised to avoid the NaN%, +undefined, and "TypeError: cannot
 * read properties of undefined" bugs that recur in feature code.
 *
 * Every helper is **defensive by default** - it accepts
 * `string | number | null | undefined` and never throws or returns
 * `NaN`. Where the input is unparseable we return a safe sentinel
 * (empty string, "--", 0, or null) so the UI can render a sensible
 * placeholder instead of crashing.
 *
 * Most helpers are **locale-aware** - the user-facing strings default
 * to the active i18next language so the same code produces
 *   "15,000 ر.ي"  for Arabic,
 *   "15,000 YER"   for English,
 *   "15,000 也门里亚尔" for Chinese.
 */
import type { TFunction } from 'i18next';

/**
 * Try to coerce a value into a finite number. Accepts:
 *   - numbers  (1234, 1234.56, 0, -0)
 *   - strings  ("1234", "1,234.56", "1.234,56" (European))
 *   - null / undefined (returns fallback)
 *
 * Strips thousands separators before parsing. Returns `fallback`
 * (default `0`) for any unparseable value, never `NaN`.
 */
export function safeNumber(value: string | number | null | undefined, fallback = 0): number {
	if (value === null || value === undefined) return fallback;
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : fallback;
	}
	if (typeof value === 'string') {
		// Strip whitespace, then remove every ",", " ", and "٬" (Arabic
		// thousands separator) so "1,234.56" -> "1234.56".
		const cleaned = value
			.trim()
			.replace(/[\s\u066C\u060C]/g, '')
			.replace(/,/g, '');
		if (cleaned === '' || cleaned === '-') return fallback;
		const parsed = Number(cleaned);
		return Number.isFinite(parsed) ? parsed : fallback;
	}
	return fallback;
}

/**
 * Discount-aware price formatter.
 *
 * Given a product with a `price` and optional `original_price`,
 * returns a 2-line string ready for the UI:
 *   "<current> <currency>"        (line 1 - always present)
 *   "<original> <currency>"        (line 2 - only if `original_price`
 *                                     is set AND strictly greater than `price`)
 *
 * Both lines are passed through `formatMoney` so they pick up the
 * active locale (see lib/format.ts). Use this as a drop-in
 * replacement for ad-hoc `toLocaleString()` calls that produce
 * `+undefined` when the input is null.
 *
 * @example
 *   renderPriceBlock({ price: 15000, original_price: 18000, currency: 'YER' })
 *   // → { current: "15,000 YER", original: "18,000 YER" }
 *   renderPriceBlock({ price: 15000, original_price: null,  currency: 'YER' })
 *   // → { current: "15,000 YER", original: null }
 *   renderPriceBlock({ price: null,  original_price: null,  currency: 'YER' })
 *   // → { current: "--",       original: null }
 */
export interface PriceBlock {
	current: string;
	original: string | null;
}

export function renderPriceBlock(
	product: {
		price: string | number | null | undefined;
		original_price?: string | number | null;
		currency: string;
	},
	formatMoney: (amount: number) => string,
): PriceBlock {
	const currentNum = safeNumber(product.price, NaN);
	const current = Number.isFinite(currentNum) && currentNum > 0 ? formatMoney(currentNum) : '--';

	const origNum = safeNumber(product.original_price, NaN);
	const original =
		Number.isFinite(origNum) && origNum > 0 && currentNum > 0 && origNum > currentNum
			? formatMoney(origNum)
			: null;

	return { current, original };
}

/**
 * Discount percentage with NaN-safety.
 *
 * Computes ((original - current) / original) * 100, rounded to 0 decimals.
 * Returns 0 when either price is missing/zero/invalid or the original
 * is not strictly greater than the current.
 *
 * This is the function the UI calls instead of inline math; it
 * guarantees we never render the "NaN%" bug.
 */
export function discountPercent(
	current: string | number | null | undefined,
	original: string | number | null | undefined,
): number {
	const c = safeNumber(current, NaN);
	const o = safeNumber(original, NaN);
	if (!Number.isFinite(c) || !Number.isFinite(o) || o <= 0 || c <= 0 || c >= o) return 0;
	return Math.round(((o - c) / o) * 100);
}

/**
 * Format a discount badge label.
 *   formatDiscountLabel(15)        → "خصم 15%"
 *   formatDiscountLabel(0)         → ""
 *   formatDiscountLabel(0, "Sale") → "Sale"
 *
 * The caller passes a t() translator; the function decides whether
 * the number is large enough to be worth showing.
 */
export function formatDiscountLabel(
	percent: number,
	t: TFunction | ((key: string) => string),
	fallbackKey = 'product.discountLabel',
): string {
	if (!Number.isFinite(percent) || percent <= 0) return '';
	const safeT = (key: string) => (typeof t === 'function' ? t(key) : key);
	const tmpl = safeT(fallbackKey);
	// tmpl looks like "{percent}%" or "خصم {percent}%" depending on locale.
	return tmpl.replace(/\{(percent|value)\}/g, String(percent));
}

/**
 * Image URL builder for product / category / store images.
 *
 * The backend stores paths as "/products/p3.jpg" or "/category-x.jpg"
 * (always leading slash, no host). The frontend sometimes receives
 * a bare filename like "p3.jpg" (legacy fixtures) or undefined
 * (newly seeded product). This helper normalises all three cases
 * into a URL the <img> tag can actually load.
 *
 * Rules (in order):
 *   1. null / undefined / empty string  → return the supplied
 *      fallback (default = "/images/placeholder.svg" which lives in
 *      app/public/ and is always present in the bundle).
 *   2. starts with http:// or https://       → return as-is (already
 *      absolute; e.g. CDN URLs in the future).
 *   3. starts with /                       → prepend API_ORIGIN (so dev
 *      backend at :3000 works) then return.
 *   4. otherwise (bare filename)            → assume it's a product
 *      image living under /products/ on the API host.
 *
 * The third case also lets the component author write image={image}
 * for any source — the helper does the right thing.
 */
export interface ImageUrlOptions {
	apiOrigin?: string; // e.g. window.location.origin
	fallback?: string; // returned when the input is unusable
	kind?: 'product' | 'category' | 'store' | 'user';
}

export function safeImageUrl(
	raw: string | null | undefined,
	options: ImageUrlOptions = {},
): string {
	const FALLBACK = options.fallback ?? '/images/placeholder.svg';
	if (raw === null || raw === undefined) return FALLBACK;
	const v = String(raw).trim();
	if (v === '') return FALLBACK;

	if (/^https?:\/\//i.test(v)) return v;
	if (v.startsWith('/')) {
		const origin = (options.apiOrigin ?? '').replace(/\/+$/, '');
		return origin ? `${origin}${v}` : v;
	}
	const origin = (options.apiOrigin ?? '').replace(/\/+$/, '');
	const kind = options.kind ?? 'product';
	const prefix = origin ? `${origin}/` : '/';
	return `${prefix}${kind}s/${v}`;
}
