/**
 * Catalog routes ï؟½?ï؟½ Products, Stores, Categories.
 *
 * The three groups are the public read-mostly surface of the storefront:
 *   - Products (list, featured, deals, single with store+reviews+images)
 *   - Stores (list, single with its products, reviews)
 *   - Categories (tree with counts, single with products)
 *
 * All endpoints are public (no auth) and read-only (no writes). They
 * live together because the SQL joins them tightly ï؟½?ï؟½ every product
 * pulls in its store + reviews + images, and every category pulls
 * in its products. Splitting them would force the consumer to issue
 * one extra round-trip per page.
 *
 * The router is mounted by `server/index.ts` at `/api/`, so the
 * paths below are suffixes (e.g. `router.get('/products', ...)` maps
 * to `GET /api/products`).
 */
import { Router, type Request, type Response } from 'express';
import { cacheWrapCluster } from '../lib/cache.ts';
import { logSearch, normalizeQuery, runSearch } from '../lib/search.ts';
import { db, getProductWithParsedFields, log, sendError, sendSuccess } from '../lib/shared.ts';
import * as middleware from '../middleware.ts';

const CACHE_TTL_PRODUCT = 300;
const CACHE_TTL_STORE = 300;
const CACHE_TTL_CATEGORY = 3_600;
const CACHE_TTL_FEATURED = 300;
const CACHE_TTL_DEALS = 60;

export const catalogRouter = Router();

// ظ¤?ظ¤?ظ¤? Product helpers ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?ظ¤?
/** Get all product images sorted by `sort_order`. */
const getProductImages = async (productId: number) => {
	return db
		.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order')
		.all(productId);
};

/** Count the same WHERE clause with no LIMIT/OFFSET. Only used as a
 *  fallback when the page came back empty (so the window function
 *  has no row to attach `total_count` to) ï؟½?ï؟½ in that case the
 *  unfiltered total must be queried separately. */
async function countProducts(where: string[], params: (string | number)[]): Promise<number> {
	const row = (await db
		.prepare(`SELECT COUNT(*) AS c FROM products WHERE ${where.join(' AND ')}`)
		.get(...params)) as { c: number | string } | undefined;
	return row ? Number(row.c) : 0;
}

// ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?
// PRODUCTS
// ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?

/**
 * GET /api/products
 * Query params: category, search, store, minPrice, maxPrice, sort, limit, offset
 *
 * P1-7 fix: use a single SQL with the `COUNT(*) OVER ()` window
 * function so the total count comes back in the same round-trip
 * (and shares the same WHERE / ORDER BY / LIMIT). The previous
 * implementation ran two separate queries with hand-copied
 * filter clauses -- one missed filter would silently desync the
 * totals from the page.
 */
catalogRouter.get('/products', async (req: Request, res: Response) => {
	try {
		const {
			category,
			search,
			store,
			minPrice,
			maxPrice,
			sort,
			limit = '20',
			offset = '0',
		} = req.query;

		const where: string[] = ['is_active = 1'];
		const params: (string | number)[] = [];

		if (category) {
			where.push('category_id = (SELECT id FROM categories WHERE slug = ?)');
			params.push(category as string);
		}
		if (store) {
			where.push('store_id = ?');
			params.push(Number(store));
		}
		if (minPrice) {
			where.push('price >= ?');
			params.push(Number(minPrice));
		}
		if (maxPrice) {
			where.push('price <= ?');
			params.push(Number(maxPrice));
		}
		if (search && typeof search === 'string') {
			const escaped = search.replace(/[%_]/g, '\\$&');
			const term = `%${escaped}%`;
			where.push(
				'(name_en LIKE ? ESCAPE \'\\\' OR name_ar LIKE ? ESCAPE \'\\\' OR name_zh LIKE ? ESCAPE \'\\\' OR description_en LIKE ? ESCAPE \'\\\')',
			);
			params.push(term, term, term, term);
		}

		// Sorting
		let orderBy = ' ORDER BY created_at DESC';
		switch (sort) {
			case 'price_asc':
				orderBy = ' ORDER BY price ASC';
				break;
			case 'price_desc':
				orderBy = ' ORDER BY price DESC';
				break;
			case 'popular':
				orderBy = ' ORDER BY sold_count DESC';
				break;
			case 'newest':
			default:
				orderBy = ' ORDER BY created_at DESC';
				break;
		}

		// R4 fix: `Number(limit) || 20` swallowed `0` (the falsy fallback
		// fired for `limit=0` and the route returned 20 instead of the
		// clamped 1). Use an explicit isFinite check so `0` and NaN are
		// treated as "no limit provided" while every other number is
		// preserved verbatim and only then clamped into [1, 100].
		const parsedLimit = Number(limit);
		const numLimit = Math.max(
			1,
			Math.min(100, Number.isFinite(parsedLimit) ? parsedLimit : 20),
		);
		const numOffset = Math.max(0, Number(offset) || 0);
		// The window function returns the unfiltered count of the
		// query (before LIMIT/OFFSET) on every row, so we can read
		// the total from `rows[0].total_count` after one round-trip.
		const sql = `SELECT *, COUNT(*) OVER () AS total_count
		             FROM products
		            WHERE ${where.join(' AND ')}
		            ${orderBy}
		            LIMIT ? OFFSET ?`;
		const rows = (await db.prepare(sql).all(...params, numLimit, numOffset)) as Array<
			Record<string, unknown> & { total_count: number | string }
		>;
		const total =
			rows.length > 0 ? Number(rows[0].total_count ?? 0) : await countProducts(where, params);
		const products = rows.map((r) => {
			const { total_count: _omit, ...rest } = r;
			void _omit;
			return getProductWithParsedFields(rest);
		});

		return sendSuccess(res, {
			products,
			total,
			limit: numLimit,
			offset: numOffset,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * GET /api/products/featured
 * Curated featured products (used by the homepage hero).
 *
 * Phase 1: cached for 5 min. Invalidated on product PATCH in the seller
 * route via `cacheBust('catalog:featured:')`.
 */
catalogRouter.get('/products/featured', async (_req: Request, res: Response) => {
	try {
		const products = await cacheWrapCluster('catalog:featured:v1', CACHE_TTL_FEATURED, async () => {
			const rows = (await db
				.prepare(
					'SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 10',
				)
				.all()) as Record<string, unknown>[];
			return rows.map(getProductWithParsedFields);
		});
		return sendSuccess(res, products);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * GET /api/products/deals
 * Products with an active deal (non-zero `deal_discount`).
 */
catalogRouter.get('/products/deals', async (_req: Request, res: Response) => {
	try {
		const products = await cacheWrapCluster('catalog:deals:v1', CACHE_TTL_DEALS, async () => {
			const rows = (await db
				.prepare(
					'SELECT * FROM products WHERE is_active = 1 AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 10',
				)
				.all()) as Record<string, unknown>[];
			return rows.map(getProductWithParsedFields);
		});
		return sendSuccess(res, products);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * GET /api/products/:id
 * Single product + its store + reviews + images.
 */
catalogRouter.get('/products/:id', async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) {
			return sendError(res, 'Invalid product ID', 400, 'VALIDATION_ERROR');
		}

		const cached = await cacheWrapCluster(
			`catalog:product:${id}:v1`,
			CACHE_TTL_PRODUCT,
			async () => {
				const product = (await db
					.prepare('SELECT * FROM products WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL')
					.get(id)) as Record<string, unknown> | undefined;
				if (!product) return null;
				const store = (await db
					.prepare('SELECT * FROM stores WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL')
					.get(product.store_id as number)) as Record<string, unknown> | undefined;
				return { product, store };
			},
		);
		if (!cached) {
			return sendError(res, 'Product not found', 404);
		}

		// Reviews are deliberately NOT cached â€” they update frequently.
		const reviewLimit = Math.max(1, Math.min(50, Number(req.query.reviewLimit) || 20));
		const reviewOffset = Math.max(0, Number(req.query.reviewOffset) || 0);
		const [reviews, images] = await Promise.all([
			db
				.prepare(
					`SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar
         FROM reviews r
         LEFT JOIN users u ON r.customer_id = u.id
         WHERE r.product_id = ? AND r.is_visible = TRUE
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
				)
				.all(id, reviewLimit, reviewOffset) as Promise<Record<string, unknown>[]>,
			cacheWrapCluster(
				`catalog:product:${id}:images:v1`,
				CACHE_TTL_PRODUCT,
				async () => await getProductImages(id),
			),
		]);

		const productParsed = getProductWithParsedFields(cached.product);

return sendSuccess(res, {
			...productParsed,
			store: cached.store,
			reviews,
			images,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

// ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?
// STORES
// ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?

/**
 * GET /api/stores
 * All stores, highest-rated first. A cap of 100 rows protects the
 * endpoint from unbounded result sets while keeping the existing
 * array response shape for backwards compatibility.
 */
catalogRouter.get('/stores', async (req: Request, res: Response) => {
	try {
		const rawLimit = Number(req.query.limit);
		const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 100));
		const offset = Math.max(0, Number(req.query.offset) || 0);

		const stores = (await db
			.prepare(
				`SELECT id, store_name, store_name_en, store_name_zh, slug, logo, banner,
				        trust_level, rating, review_count, products_count, is_active, is_verified
				   FROM stores
				 ORDER BY rating DESC
				 LIMIT $1 OFFSET $2`,
			)
			.all(limit, offset)) as Record<string, unknown>[];

		return sendSuccess(res, stores);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * GET /api/stores/:id
 * Store detail with its active products. Product list is capped at 100
 * rows to avoid unbounded responses; the shape remains unchanged for
 * backwards compatibility.
 */
catalogRouter.get('/stores/:id', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const storeId = Number(id);
		if (!Number.isInteger(storeId) || storeId <= 0) {
			return sendError(res, 'Invalid store id', 400);
		}

		const cached = await cacheWrapCluster(
			`catalog:store:${storeId}:v1`,
			CACHE_TTL_STORE,
			async () => {
				const store = (await db
					.prepare(
						`SELECT id, owner_id, store_name, store_name_en, store_name_zh, slug,
						        description, description_en, description_zh, logo, banner,
						        location, governorate, trust_level, response_rate, on_time_delivery,
						        commission_rate, rating, review_count, products_count, sales_count,
						        followers_count, since_year, is_active, is_verified, created_at, updated_at
						   FROM stores
						  WHERE id = $1`,
					)
					.get(storeId)) as Record<string, unknown> | undefined;
				if (!store) return null;
				const products = (await db
					.prepare(
						`SELECT id, store_id, category_id, name_ar, name_en, name_zh, description,
						        description_en, description_zh, price, original_price, currency,
						        stock, moq, weight, tax_rate, is_digital, main_image, features,
						        specifications, badges, rating, review_count, sold_count, view_count,
						        is_active, is_featured, deal_discount, deal_ends_at, deleted_at,
						        created_at, updated_at
						   FROM products
						  WHERE store_id = $1 AND is_active = 1
						 ORDER BY created_at DESC
						 LIMIT 100`,
					)
					.all(storeId)) as Record<string, unknown>[];
				return { store, products };
			},
		);
		if (!cached) {
			return sendError(res, 'Store not found', 404);
		}

		return sendSuccess(res, {
			...cached.store,
			products: cached.products.map(getProductWithParsedFields),
		});
	} catch (err) {
		log.error({ msg: 'stores/:id', request_id: req.id, error: (err as Error).message });
		return sendError(res, err);
	}
});

/**
 * GET /api/stores/:id/reviews
 * Visible reviews for a store (filter excludes hidden/spam/moderation-pending).
 *
 * P0-3 fix: only return *visible* reviews. The DB trigger that maintains
 * the average product rating already filters by `is_visible = TRUE`, so
 * without this filter the API would expose hidden/spam/moderation-pending
 * reviews that no longer count toward the rating.
 */
catalogRouter.get('/stores/:id/reviews', async (req: Request, res: Response) => {
	try {
		const storeId = Number(req.params.id);
		if (!Number.isInteger(storeId) || storeId <= 0) {
			return sendError(res, 'Invalid store ID', 400, 'VALIDATION_ERROR');
		}
		// R4 fix: `await` was missing ï؟½?ï؟½ `.all()` returns a Promise, so
		// `sendSuccess` was wrapping a Promise in the success envelope
		// and the client received `{ data: <Promise> }`. Same shape of
		// bug as the original `wishlist` Promise-leak flagged in
		// docs/audit/code-review-fixes-2026-06-23.md ?ï؟½1.
		const reviews = (await db
			.prepare(
				`SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar, p.name_en as product_name
         FROM reviews r
         LEFT JOIN users u ON r.customer_id = u.id
         LEFT JOIN products p ON r.product_id = p.id
         WHERE r.store_id = ? AND r.is_visible = TRUE
         ORDER BY r.created_at DESC`,
			)
			.all(storeId)) as Record<string, unknown>[];
		return sendSuccess(res, reviews);
	} catch (err) {
		return sendError(res, err);
	}
});

// ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?
// CATEGORIES
// ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?

/**
 * GET /api/categories
 * Full category tree with per-category product counts (active products only).
 *
 * Phase 1: cached for 1 h. Categories are admin-managed and change
 * rarely; bust via `cacheDel('catalog:categories:tree:v1')` from
 * admin routes.
 */
catalogRouter.get('/categories', async (_req: Request, res: Response) => {
	try {
		const categories = await cacheWrapCluster(
			'catalog:categories:tree:v1',
			CACHE_TTL_CATEGORY,
			async () =>
				db
					.prepare(
						`SELECT c.*, COUNT(p.id) as product_count
         FROM categories c
         LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
         GROUP BY c.id
         ORDER BY c.sort_order ASC`,
					)
					.all(),
		);
		return sendSuccess(res, categories);
	} catch (err) {
		return sendError(res, err);
	}
});

// ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?
// SEARCH ï؟½?ï؟½ P1-1: full-text search backend
// ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?ï؟½ï؟½?

/**
 * GET /api/search
 * Bilingual (AR/EN/ZH) full-text search over products. Built on
 * the GIN index `idx_products_search_tsv` (see migration 0009).
 *
 * Query params
 *   q         (required)  the user's search string, e.g. "honey"
 *                          or "??????". Pass via `websearch_to_tsquery`,
 *                          which supports AND/OR/quoted phrases.
 *   category   (optional)  filter by category slug
 *   store     (optional)  filter by store id
 *   minPrice  (optional)  numeric, inclusive
 *   maxPrice  (optional)  numeric, inclusive
 *   sort      (optional)  'relevance' (default) | 'price_asc' |
 *                          'price_desc' | 'newest'
 *   limit     (optional)  1..100, default 20
 *   offset    (optional)  >= 0, default 0
 *
 * Response shape
 *   { query, total, limit, offset, duration_ms, products: [...] }
 *
 * Side effects
 *   Writes a row to `search_logs` with the query, result count, and
 *   the duration. The log is best-effort ï؟½?ï؟½ a failure to insert must
 *   never break the user-facing search.
 *
 * Implementation notes
 *   - Weights: A=name_ar, B=name_en, C=name_zh, D=description*
 *     so a hit on the Arabic name outranks a hit on the description.
 *     The `ts_rank_cd` (cover density) variant is used instead of
 *     plain `ts_rank` because it gives a better relevance spread on
 *     short queries like "honey" vs long queries like "spice".
 *   - The full-text match is the hard gate. A result MUST hit the
 *     FTS ï؟½?ï؟½ category/price filters narrow the set further, but
 *     they don't broaden it. This is the right behaviour for a
 *     search engine: returning "everything in this category" when
 *     the user typed a query is the classic relevance bug.
 */
catalogRouter.get('/search', async (req: Request, res: Response) => {
	try {
		const q = String(req.query.q ?? '').trim();
		if (!q) {
			return sendError(
				res,
				'Missing required query parameter: q',
				400,
				middleware.ErrorCodes.VALIDATION_ERROR,
			);
		}
		const limit = Number.isFinite(Number(req.query.limit))
			? Math.max(1, Math.min(100, Number(req.query.limit)))
			: 20;
		const offset = Math.max(0, Number(req.query.offset) || 0);
		const userId = (req as { user?: { id: number } }).user?.id ?? null;
		const requestId = (req as { id?: string }).id ?? null;

		// Phase 3: Elasticsearch-first when configured. Falls back to
		// PostgreSQL FTS (lib/search.ts) on ES outage. Same response
		// shape so the frontend never sees a difference.
		const { searchProducts } = await import('../lib/search-index.ts');
		const esResult = await searchProducts(q, {
			category: req.query.category ? String(req.query.category) : undefined,
			storeId: req.query.store ? Number(req.query.store) : undefined,
			minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
			maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
			sort:
				(req.query.sort as
					| 'relevance'
					| 'price_asc'
					| 'price_desc'
					| 'newest'
					| 'best_selling'
					| undefined) ?? 'relevance',
			limit,
			offset,
		});

		if (esResult.source === 'unavailable') {
			const result = await runSearch(q, {
				category: req.query.category ? String(req.query.category) : undefined,
				storeId: req.query.store ? Number(req.query.store) : undefined,
				minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
				maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
				sort:
					(req.query.sort as
						| 'relevance'
						| 'price_asc'
						| 'price_desc'
						| 'newest'
						| undefined) ?? 'relevance',
				limit,
				offset,
			});
			await logSearch(q, normalizeQuery(q), result.total, result.took_ms, userId, requestId);
			const products = result.hits.map((r) => {
				const { rank: _r, ...rest } = r;
				void _r;
				return getProductWithParsedFields(rest as unknown as Record<string, unknown>);
			});
			return sendSuccess(res, {
				query: q,
				total: result.total,
				limit,
				offset,
				duration_ms: result.took_ms,
				source: 'postgresql',
				products,
			});
		}

		const { publish } = await import('../lib/queue.ts');
		void publish('noufex.analytics', 'analytics.events', {
			kind: 'search',
			payload: {
				query: q,
				normalized: normalizeQuery(q),
				resultCount: esResult.total,
				durationMs: esResult.took_ms,
				userId,
				requestId,
			},
			ts: new Date().toISOString(),
		}).catch(() => void 0);

		return sendSuccess(res, {
			query: q,
			total: esResult.total,
			limit,
			offset,
			duration_ms: esResult.took_ms,
			source: 'elasticsearch',
facets: esResult.facets,
			products: esResult.hits,
		});
	} catch (err) {
		sendError(res, err);
	}
});

/**
 * GET /api/search/suggest?q=...
 * Autocomplete for the search box. Returns up to 10 product names.
 * Backed by the ES `completion` suggester when available.
 */
catalogRouter.get('/search/suggest', async (req: Request, res: Response) => {
	try {
		const q = String(req.query.q ?? '').trim();
		const { suggestProducts } = await import('../lib/search-index.ts');
		const suggestions = await suggestProducts(q);
		return sendSuccess(res, { suggestions });
	} catch (err) {
		sendError(res, err);
	}
});

/**
 * GET /api/search/stores?...
 * Store search with optional geo filter. Backed by ES geo_point +
 * multi-language text matching.
 */
catalogRouter.get('/search/stores', async (req: Request, res: Response) => {
	try {
		const { searchStores } = await import('../lib/search-index.ts');
		const lat = Number(req.query.lat);
		const lon = Number(req.query.lon);
		const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);
		const results = await searchStores({
			q: req.query.q ? String(req.query.q) : undefined,
			governorate: req.query.governorate ? String(req.query.governorate) : undefined,
			near: hasGeo ? { lat, lon, distanceKm: Number(req.query.distanceKm ?? 50) } : undefined,
			limit: req.query.limit !== undefined ? Number(req.query.limit) : 20,
		});
		return sendSuccess(res, { stores: results });
	} catch (err) {
		sendError(res, err);
	}
});

/**
 * GET /api/categories/:slug
 * One category + its active products.
 */
catalogRouter.get('/categories/:slug', async (req: Request, res: Response) => {
	try {
		const { slug } = req.params;
		const category = (await db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug)) as
			Record<string, unknown> | undefined;

		if (!category) {
			return sendError(res, 'Category not found', 404);
		}

		const products = (await db
			.prepare('SELECT * FROM products WHERE category_id = ? AND is_active = 1')
			.all(category.id as number)) as Record<string, unknown>[];

		return sendSuccess(res, {
			...category,
			products: products.map(getProductWithParsedFields),
		});
	} catch (err) {
		return sendError(res, err);
	}
});
