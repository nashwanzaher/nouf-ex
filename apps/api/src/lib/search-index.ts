/**
 * Search index read/write helpers (Phase 3).
 *
 * These functions are called by the RabbitMQ `search-indexer` worker
 * (writes) and the catalog routes (reads). They wrap the raw ES
 * client with a domain-shaped API:
 *
 *   - `indexProduct(id)`     upsert one product from PG into ES
 *   - `deindexProduct(id)`   delete one product from ES
 *   - `reindexAll()`         bulk backfill from PG (operator CLI)
 *   - `searchProducts(...)`  multi-language query + faceted aggregations
 *   - `suggestProducts(...)` autocomplete for the search box
 *   - `searchStores(...)`    geo + text search
 *
 * Every function returns `null` / empty when ES is unavailable. The
 * caller (route) falls back to PostgreSQL FTS.
 */
import { getEs, productIndex, storeIndex, categoryIndex } from './elasticsearch.ts';
import { db, log } from './shared.ts';
import { parseJson } from './json.ts';

export interface SearchFilters {
	category?: string;
	storeId?: number;
	minPrice?: number;
	maxPrice?: number;
	rating?: number;
	hasDeal?: boolean;
	sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'best_selling';
	limit?: number;
	offset?: number;
}

export interface ProductHit {
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
	score: number;
}

export interface SearchResponse {
	hits: ProductHit[];
	total: number;
	facets?: {
		categories: Array<{ key: string; count: number }>;
		priceRanges: Array<{ key: string; count: number }>;
	};
	took_ms: number;
	source: 'elasticsearch' | 'unavailable';
}

export async function indexProduct(id: number): Promise<boolean> {
	const c = getEs();
	if (!c) return false;
	const row = (await db
		.prepare(
			`SELECT p.*, s.store_name FROM products p
			 JOIN stores s ON s.id = p.store_id
			 WHERE p.id = ? AND p.deleted_at IS NULL`,
		)
		.get(id)) as Record<string, unknown> | undefined;
	if (!row) return false;
	const features = parseJson<string[]>(row.features, []);
	const badges = parseJson<string[]>(row.badges, []);
	const doc = {
		id: row.id,
		store_id: row.store_id,
		store_name: row.store_name,
		category_id: row.category_id,
		name_ar: row.name_ar,
		name_en: row.name_en,
		name_zh: row.name_zh,
		description_ar: row.description,
		description_en: row.description_en,
		description_zh: row.description_zh,
		price: Number(row.price),
		original_price: row.original_price != null ? Number(row.original_price) : null,
		currency: row.currency,
		stock: row.stock,
		rating: Number(row.rating ?? 0),
		review_count: row.review_count,
		sold_count: row.sold_count,
		is_active: row.is_active === true || row.is_active === 1,
		is_featured: row.is_featured === true || row.is_featured === 1,
		has_deal: Number(row.deal_discount ?? 0) > 0,
		deal_discount: Number(row.deal_discount ?? 0),
		main_image: row.main_image,
		features,
		badges,
		created_at: row.created_at,
		updated_at: row.updated_at,
		suggest: {
			input: [row.name_ar, row.name_en, row.name_zh].filter(Boolean) as string[],
		},
	};
	await c.index({
		index: productIndex(),
		id: String(id),
		document: doc,
		refresh: 'wait_for',
	});
	return true;
}

export async function deindexProduct(id: number): Promise<boolean> {
	const c = getEs();
	if (!c) return false;
	try {
		await c.delete({ index: productIndex(), id: String(id), refresh: 'wait_for' });
	} catch (err) {
		// 404 is fine — already gone
		const e = err as { meta?: { statusCode?: number } };
		if (e.meta?.statusCode !== 404) throw err;
	}
	return true;
}

export async function indexStore(id: number): Promise<boolean> {
	const c = getEs();
	if (!c) return false;
	const row = (await db.prepare('SELECT * FROM stores WHERE id = ?').get(id)) as
		| Record<string, unknown>
		| undefined;
	if (!row) return false;
	const doc = {
		id: row.id,
		owner_id: row.owner_id,
		store_name_ar: row.store_name,
		store_name_en: row.store_name_en,
		store_name_zh: row.store_name_zh,
		slug: row.slug,
		logo: row.logo,
		banner: row.banner,
		description: row.description,
		location: row.location,
		governorate: row.governorate,
		geo:
			row.latitude != null && row.longitude != null
				? { lat: Number(row.latitude), lon: Number(row.longitude) }
				: undefined,
		trust_level: row.trust_level,
		rating: Number(row.rating ?? 0),
		review_count: row.review_count,
		is_active: row.is_active === true || row.is_active === 1,
		is_verified: row.is_verified === true || row.is_verified === 1,
		suggest: {
			input: [row.store_name, row.store_name_en, row.store_name_zh].filter(Boolean) as string[],
		},
	};
	await c.index({
		index: storeIndex(),
		id: String(id),
		document: doc,
		refresh: 'wait_for',
	});
	return true;
}

export async function deindexStore(id: number): Promise<boolean> {
	const c = getEs();
	if (!c) return false;
	try {
		await c.delete({ index: storeIndex(), id: String(id), refresh: 'wait_for' });
	} catch (err) {
		const e = err as { meta?: { statusCode?: number } };
		if (e.meta?.statusCode !== 404) throw err;
	}
	return true;
}

export async function indexCategory(id: number): Promise<boolean> {
	const c = getEs();
	if (!c) return false;
	const row = (await db.prepare('SELECT * FROM categories WHERE id = ?').get(id)) as
		| Record<string, unknown>
		| undefined;
	if (!row) return false;
	const productCount = (await db
		.prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ? AND is_active = 1')
		.get(id)) as { c: number | string };
	await c.index({
		index: categoryIndex(),
		id: String(id),
		document: {
			id: row.id,
			parent_id: row.parent_id,
			slug: row.slug,
			name_ar: row.name_ar,
			name_en: row.name_en,
			name_zh: row.name_zh,
			sort_order: row.sort_order,
			is_active: row.is_active === true || row.is_active === 1,
			product_count: Number(productCount.c),
		},
		refresh: 'wait_for',
	});
	return true;
}

/** Bulk backfill. Operator CLI:
 *    node --experimental-strip-types scripts/search/reindex.ts */
export async function reindexAll(): Promise<{ products: number; stores: number; categories: number; took_ms: number }> {
	const c = getEs();
	if (!c) return { products: 0, stores: 0, categories: 0, took_ms: 0 };
	const start = Date.now();
	const products = (await db
		.prepare(
			`SELECT p.id, p.store_id, s.store_name, p.category_id, p.name_ar, p.name_en, p.name_zh,
			        p.description, p.description_en, p.description_zh, p.price, p.original_price,
			        p.currency, p.stock, p.rating, p.review_count, p.sold_count, p.is_active,
			        p.is_featured, p.deal_discount, p.main_image, p.features, p.badges,
			        p.created_at, p.updated_at
			   FROM products p JOIN stores s ON s.id = p.store_id
			  WHERE p.deleted_at IS NULL`,
		)
		.all()) as Array<Record<string, unknown>>;
	if (products.length > 0) {
		await c.bulk({
			refresh: true,
			operations: products.flatMap((row) => [
				{ index: { _index: productIndex(), _id: String(row.id) } },
				{
					id: row.id,
					store_id: row.store_id,
					store_name: row.store_name,
					category_id: row.category_id,
					name_ar: row.name_ar,
					name_en: row.name_en,
					name_zh: row.name_zh,
					description_ar: row.description,
					description_en: row.description_en,
					description_zh: row.description_zh,
					price: Number(row.price),
					original_price: row.original_price != null ? Number(row.original_price) : null,
					currency: row.currency,
					stock: row.stock,
					rating: Number(row.rating ?? 0),
					review_count: row.review_count,
					sold_count: row.sold_count,
					is_active: row.is_active === true || row.is_active === 1,
					is_featured: row.is_featured === true || row.is_featured === 1,
					has_deal: Number(row.deal_discount ?? 0) > 0,
					deal_discount: Number(row.deal_discount ?? 0),
					main_image: row.main_image,
					features: parseJson<string[]>(row.features, []),
					badges: parseJson<string[]>(row.badges, []),
					created_at: row.created_at,
					updated_at: row.updated_at,
				},
			]),
		});
	}
	const stores = (await db.prepare('SELECT * FROM stores WHERE deleted_at IS NULL').all()) as Array<
		Record<string, unknown>
	>;
	if (stores.length > 0) {
		await c.bulk({
			refresh: true,
			operations: stores.flatMap((row) => [
				{ index: { _index: storeIndex(), _id: String(row.id) } },
				{
					id: row.id,
					owner_id: row.owner_id,
					store_name_ar: row.store_name,
					store_name_en: row.store_name_en,
					store_name_zh: row.store_name_zh,
					slug: row.slug,
					logo: row.logo,
					banner: row.banner,
					description: row.description,
					location: row.location,
					governorate: row.governorate,
					trust_level: row.trust_level,
					rating: Number(row.rating ?? 0),
					review_count: row.review_count,
					is_active: row.is_active === true || row.is_active === 1,
					is_verified: row.is_verified === true || row.is_verified === 1,
				},
			]),
		});
	}
	const categories = (await db.prepare('SELECT * FROM categories WHERE is_active = 1').all()) as Array<
		Record<string, unknown>
	>;
	if (categories.length > 0) {
		await c.bulk({
			refresh: true,
			operations: categories.flatMap((row) => [
				{ index: { _index: categoryIndex(), _id: String(row.id) } },
				{
					id: row.id,
					parent_id: row.parent_id,
					slug: row.slug,
					name_ar: row.name_ar,
					name_en: row.name_en,
					name_zh: row.name_zh,
					sort_order: row.sort_order,
					is_active: true,
				},
			]),
		});
	}
	const took = Date.now() - start;
	log.info({
		msg: 'search_reindex_complete',
		products: products.length,
		stores: stores.length,
		categories: categories.length,
		took_ms: took,
	});
	return {
		products: products.length,
		stores: stores.length,
		categories: categories.length,
		took_ms: took,
	};
}

export async function searchProducts(
	query: string,
	filters: SearchFilters = {},
): Promise<SearchResponse> {
	const c = getEs();
	const start = Date.now();
	if (!c) {
		return { hits: [], total: 0, took_ms: 0, source: 'unavailable' };
	}
	const must: Record<string, unknown>[] = [];
	if (query.trim().length > 0) {
		must.push({
			multi_match: {
				query,
				fields: [
					'name_ar^3',
					'name_en^3',
					'name_zh^3',
					'description_ar',
					'description_en',
					'description_zh',
				],
				fuzziness: 'AUTO',
				prefix_length: 1,
			},
		});
	} else {
		must.push({ match_all: {} });
	}
	const filter: Record<string, unknown>[] = [{ term: { is_active: true } }];
	if (filters.category) filter.push({ term: { category_id: Number(filters.category) } });
	if (filters.storeId) filter.push({ term: { store_id: filters.storeId } });
	if (filters.hasDeal) filter.push({ term: { has_deal: true } });
	if (filters.rating) filter.push({ range: { rating: { gte: filters.rating } } });
	if (filters.minPrice != null || filters.maxPrice != null) {
		const range: Record<string, number> = {};
		if (filters.minPrice != null) range.gte = filters.minPrice;
		if (filters.maxPrice != null) range.lte = filters.maxPrice;
		filter.push({ range: { price: range } });
	}
	const limit = Math.max(1, Math.min(100, filters.limit ?? 20));
	const offset = Math.max(0, filters.offset ?? 0);
	const sort = sortClause(filters.sort);
	const result = await c.search<ProductHit>({
		index: productIndex(),
		from: offset,
		size: limit,
		query: { bool: { must, filter } },
		sort,
		aggs: {
			categories: { terms: { field: 'category_id', size: 20 } },
			priceRanges: {
				range: {
					field: 'price',
					ranges: [
						{ key: '0-1000', from: 0, to: 1000 },
						{ key: '1000-5000', from: 1000, to: 5000 },
						{ key: '5000-20000', from: 5000, to: 20000 },
						{ key: '20000+', from: 20000 },
					],
				},
			},
		},
	});
	const totalRaw = result.hits.total;
	const total = typeof totalRaw === 'number' ? totalRaw : (totalRaw?.value ?? 0);
	const aggs = result.aggregations as Record<string, unknown> | undefined;
	return {
		hits: result.hits.hits.map((h) => ({ ...(h._source as ProductHit), score: h._score ?? 0 })),
		total,
		facets: {
			categories:
				(aggs?.categories as { buckets?: Array<{ key: string; doc_count: number }> })?.buckets?.map(
					(b) => ({ key: String(b.key), count: b.doc_count }),
				) ?? [],
			priceRanges:
				(aggs?.priceRanges as { buckets?: Array<{ key: string; doc_count: number }> })?.buckets?.map(
					(b) => ({ key: b.key, count: b.doc_count }),
				) ?? [],
		},
		took_ms: Date.now() - start,
		source: 'elasticsearch',
	};
}

function sortClause(sort: SearchFilters['sort']) {
	switch (sort) {
		case 'price_asc':
			return [{ price: 'asc' }];
		case 'price_desc':
			return [{ price: 'desc' }];
		case 'newest':
			return [{ created_at: 'desc' }];
		case 'best_selling':
			return [{ sold_count: 'desc' }];
		case 'relevance':
		default:
			return ['_score', { rating: 'desc' }];
	}
}

/** Autocomplete suggestions for the search box. Returns up to 10
 *  product names matching the prefix. */
export async function suggestProducts(
	prefix: string,
): Promise<Array<{ text: string; score: number }>> {
	const c = getEs();
	if (!c || !prefix.trim()) return [];
	const res = await c.search({
		index: productIndex(),
		size: 10,
		_source: false,
		suggest: {
			suggestions: {
				prefix,
				completion: { field: 'suggest', size: 10, skip_duplicates: true },
			},
		},
	});
	const suggestions = (res.suggest as Record<
		string,
		Array<{ options: Array<{ text: string; _score: number }> }>
	>)?.suggestions;
	if (!suggestions) return [];
	return suggestions[0]?.options.map((o) => ({ text: o.text, score: o._score })) ?? [];
}

/** Geo + text search for stores. */
export async function searchStores(opts: {
	q?: string;
	governorate?: string;
	near?: { lat: number; lon: number; distanceKm?: number };
	limit?: number;
}): Promise<Array<{ id: number; store_name: string; slug: string; rating: number; distance_km?: number }>> {
	const c = getEs();
	if (!c) return [];
	const filter: Record<string, unknown>[] = [{ term: { is_active: true } }];
	if (opts.governorate) filter.push({ term: { governorate: opts.governorate } });
	if (opts.near) {
		filter.push({
			geo_distance: {
				distance: `${opts.near.distanceKm ?? 50}km`,
				geo: { lat: opts.near.lat, lon: opts.near.lon },
			},
		});
	}
	const must: Record<string, unknown>[] = opts.q
		? [
				{
					multi_match: {
						query: opts.q,
						fields: ['store_name_ar^3', 'store_name_en^3', 'store_name_zh^3', 'description'],
						fuzziness: 'AUTO',
					},
				},
			]
		: [{ match_all: {} }];
	const res = await c.search({
		index: storeIndex(),
		size: Math.max(1, Math.min(100, opts.limit ?? 20)),
		query: { bool: { must, filter } },
		sort: opts.near
			? [
					{
						_geo_distance: {
							geo: { lat: opts.near.lat, lon: opts.near.lon },
							order: 'asc',
							unit: 'km',
						},
					},
				]
			: [{ rating: 'desc' }],
	});
	return res.hits.hits.map((h) => {
		const src = h._source as {
			id: number;
			store_name_ar: string;
			slug: string;
			rating: number;
		};
		const sort = h.sort as number[] | undefined;
		return {
			id: src.id,
			store_name: src.store_name_ar,
			slug: src.slug,
			rating: src.rating,
			distance_km: sort?.[0],
		};
	});
}