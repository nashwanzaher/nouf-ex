/**
 * JSON-typed DB column helpers, extracted from `shared.ts` as
 * part of the P0-1 god object refactor (Phase 6, 2026-07-04).
 *
 * Postgres `JSONB` and `TEXT[]` columns are returned to JS as
 * strings (the pg driver does not parse them by default). Every
 * route file that surfaces a row with such columns needs to
 * unwrap them to native JS arrays/objects before sending the
 * response — `parseJson` does the heavy lifting, and
 * `getProductWithParsedFields` is the canned product-row
 * shortcut.
 *
 * Self-contained: no DB, middleware, or other shared-library
 * dependencies. Just pure functions operating on `unknown`.
 */

/** P1-1 fix: parseJson accepts `unknown` so the driver can hand us
 *  either a JSON string OR a pre-parsed JS value. Note the function
 *  declaration (not arrow with `<T,>`) — `<T>(...)` in an arrow form
 *  is reserved syntax inside .cts files. */
export function parseJson<T>(value: unknown, fallback: T): T {
	if (value == null) return fallback;
	if (typeof value !== 'string') {
		if (Array.isArray(value) || typeof value === 'object') {
			return value as T;
		}
		return fallback;
	}
	const trimmed = value.trim();
	if (trimmed === '') return fallback;
	try {
		return JSON.parse(trimmed) as T;
	} catch {
		return fallback;
	}
}

/** Get the parsed product row with the JSON-typed columns (features,
 *  badges, colors, sizes) unwrapped from JSONB / TEXT[] into JS arrays.
 *  Used by every product endpoint that returns products. */
export const getProductWithParsedFields = (product: Record<string, unknown> | undefined) => {
	if (!product) return null;
	return {
		...product,
		features: parseJson<string[]>(product.features, []),
		badges: parseJson<string[]>(product.badges, []),
		specifications: parseJson<Record<string, string>>(product.specifications, {}),
		colors: parseJson<string[]>(product.colors, []),
		sizes: parseJson<string[]>(product.sizes, []),
	};
};
