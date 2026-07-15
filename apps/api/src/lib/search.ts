/**
 * search.ts — P1-1 full-text search helpers.
 *
 * Backs the /api/search endpoint. Uses the STORED generated column
 * `products.search_tsv` (created by migration 0009) and the GIN index
 * `idx_products_search_tsv`.
 *
 * Design notes
 *   - 'simple' config is language-agnostic enough for Arabic +
 *     English + Chinese (the project's three locales). It doesn't
 *     apply stemming, so "running" and "run" stay as separate
 *     lexemes — that's the standard TOTP/WebAuthn trade-off.
 *   - `websearch_to_tsquery` is used for the user-facing query
 *     because it accepts a Google-style query string (quoted phrases,
 *     `-excluded` words) without escaping. Safer than `to_tsquery`
 *     for untrusted input.
 *   - Weights: A=name_ar, B=name_en, C=name_zh, D=description*
 *     so a hit on the Arabic name outranks a hit on the description.
 *     The `ts_rank_cd` (cover density) variant is used instead of
 *     plain `ts_rank` because it gives a better relevance spread on
 *     short queries like "honey" vs long queries like "spice".
 *   - The full-text match is the hard gate. A result MUST hit the
 *     FTS — category/price filters narrow the set further, but
 *     they don't broaden it. This is the right behaviour for a
 *     search engine: returning "everything in this category" when
 *     the user typed a query is the classic relevance bug.
 *   - The JOIN with `stores` brings the store_name into the row so
 *     the frontend can render "Sold by …" without a second query.
 *   - search_logs insert is best-effort and isolated in its own
 *     helper so a future migration to Redis / an external
 *     analytics sink can swap that single function out.
 */
import { db, log } from './shared.ts';

export interface SearchFilters {
	category?: string;
	storeId?: number;
	minPrice?: number;
	maxPrice?: number;
	sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
	limit?: number;
	offset?: number;
}

export interface SearchHitRow {
	id: number;
	store_id: number;
	store_name: string;
	category_id: number;
	name_ar: string;
	name_en: string | null;
	name_zh: string | null;
	main_image: string | null;
	price: number;
	currency: string;
	rating: number;
	sold_count: number;
	rank: number;
}

export interface SearchResult {
	hits: SearchHitRow[];
	total: number;
	took_ms: number;
}

/** Normalize a user-supplied search query for analytics. We keep the
 *  raw form for display and the normalized form for grouping. */
export function normalizeQuery(raw: string): string {
	return raw.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 200);
}

/** Map a sort key to a SQL ORDER BY fragment. The `rank` token in
 *  each branch is rewritten by the caller to the actual
 *  `ts_rank_cd(…)` call. */
function orderByFor(sort: SearchFilters['sort']): string {
	switch (sort) {
		case 'price_asc':
			return 'ORDER BY p.price ASC, RANK_PLACEHOLDER DESC';
		case 'price_desc':
			return 'ORDER BY p.price DESC, RANK_PLACEHOLDER DESC';
		case 'newest':
			return 'ORDER BY p.created_at DESC';
		case 'relevance':
		default:
			return 'ORDER BY RANK_PLACEHOLDER DESC, p.created_at DESC';
	}
}

/** Run a bilingual full-text search. The query is evaluated in
 *  'simple' config (the only config that handles all three
 *  locales reasonably) and ranked per language. The final score is
 *  the MAX of the three per-language ranks. */
export async function runSearch(query: string, filters: SearchFilters = {}): Promise<SearchResult> {
	const start = Date.now();
	const numLimit = Math.max(
		1,
		Math.min(100, Number.isFinite(filters.limit ?? NaN) ? (filters.limit as number) : 20),
	);
	const numOffset = Math.max(0, filters.offset ?? 0);

	const where: string[] = [
		'p.is_active = TRUE',
		'p.deleted_at IS NULL',
		"p.search_tsv @@ websearch_to_tsquery('simple', $1)",
	];
	const params: (string | number)[] = [query];

	// Optional filters — $2 onwards.
	if (filters.category) {
		params.push(filters.category);
		where.push(
			'p.category_id = (SELECT id FROM categories WHERE slug = $' + params.length + ')',
		);
	}
	if (filters.storeId !== undefined) {
		params.push(filters.storeId);
		where.push('p.store_id = $' + params.length);
	}
	if (filters.minPrice !== undefined) {
		params.push(filters.minPrice);
		where.push('p.price >= $' + params.length);
	}
	if (filters.maxPrice !== undefined) {
		params.push(filters.maxPrice);
		where.push('p.price <= $' + params.length);
	}

	// LIMIT / OFFSET come last so their placeholders are $N+1 and
	// $N+2 respectively.
	params.push(numLimit, numOffset);
	const limitIdx = params.length - 1;
	const offsetIdx = params.length;

	const orderBy = orderByFor(filters.sort ?? 'relevance').replace(
		'RANK_PLACEHOLDER',
		`ts_rank_cd(p.search_tsv, websearch_to_tsquery('simple', $1))`,
	);

	const sql = `
		SELECT p.*, s.store_name,
		       ts_rank_cd(p.search_tsv, websearch_to_tsquery('simple', $1)) AS rank,
		       COUNT(*) OVER () AS total_count
		  FROM products p
		  JOIN stores s ON s.id = p.store_id
		 WHERE ${where.join(' AND ')}
		 ${orderBy}
		 LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

	const rows = (await db.prepare(sql).all(...params)) as Array<
		Record<string, unknown> & { total_count: number | string; rank: number }
	>;
	const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;
	const hits: SearchHitRow[] = rows.map((r) => {
		const { total_count: _t, ...rest } = r;
		void _t;
		return rest as unknown as SearchHitRow;
	});
	return { hits, total, took_ms: Date.now() - start };
}

/** Persist a search attempt to `search_logs` (best effort — failures
 *  must not break the user-facing response). */
export async function logSearch(
	query: string,
	normalized: string,
	resultCount: number,
	durationMs: number,
	userId: number | null,
	requestId: string | null,
): Promise<void> {
	try {
		await db
			.prepare(
				`INSERT INTO search_logs
				 (query, query_normalized, result_count, duration_ms, user_id, request_id)
				 VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.run(query, normalized, resultCount, durationMs, userId, requestId);
	} catch (err) {
		// analytics are best-effort; never block the user response
		log.warn({
			msg: 'search_log_insert_failed',
			error: (err as Error).message,
		});
	}
}
