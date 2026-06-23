/**
 * Catalog routes — Products, Stores, Categories.
 *
 * The three groups are the public read-mostly surface of the storefront:
 *   - Products (list, featured, deals, single with store+reviews+images)
 *   - Stores (list, single with its products, reviews)
 *   - Categories (tree with counts, single with products)
 *
 * All endpoints are public (no auth) and read-only (no writes). They
 * live together because the SQL joins them tightly — every product
 * pulls in its store + reviews + images, and every category pulls
 * in its products. Splitting them would force the consumer to issue
 * one extra round-trip per page.
 *
 * The router is mounted by `server/index.ts` at `/api/`, so the
 * paths below are suffixes (e.g. `router.get('/products', ...)` maps
 * to `GET /api/products`).
 */
import { Router, type Request, type Response } from 'express';
import { db, sendSuccess, sendError, log, getProductWithParsedFields } from '../lib/shared.cts';

export const catalogRouter = Router();

// ─── Product helpers ──────────────────────────────────────────────────────
/** Get all product images sorted by `sort_order`. */
const getProductImages = (productId: number) => {
	return db
		.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order')
		.all(productId);
};

/** Count the same WHERE clause with no LIMIT/OFFSET. Only used as a
 *  fallback when the page came back empty (so the window function
 *  has no row to attach `total_count` to) — in that case the
 *  unfiltered total must be queried separately. */
async function countProducts(where: string[], params: (string | number)[]): Promise<number> {
	const row = (await db
		.prepare(`SELECT COUNT(*) AS c FROM products WHERE ${where.join(' AND ')}`)
		.get(...params)) as { c: number | string } | undefined;
	return row ? Number(row.c) : 0;
}

// ═══════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════

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
		if (search) {
			const term = `%${search}%`;
			where.push('(name_en LIKE ? OR name_ar LIKE ? OR name_zh LIKE ? OR description_en LIKE ?)');
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
		const numLimit = Math.max(1, Math.min(100, Number.isFinite(parsedLimit) ? parsedLimit : 20));
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
 */
catalogRouter.get('/products/featured', async (_req: Request, res: Response) => {
	try {
		const rows = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 10'
			)
			.all()) as Record<string, unknown>[];
		const products = rows.map(getProductWithParsedFields);
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
		const rows = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 10'
			)
			.all()) as Record<string, unknown>[];
		const products = rows.map(getProductWithParsedFields);
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
		const { id } = req.params;

		const product = (await db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id))) as
			| Record<string, unknown>
			| undefined;

		if (!product) {
			return sendError(res, 'Product not found', 404);
		}

		// Get store info
		const store = (await db
			.prepare('SELECT * FROM stores WHERE id = ?')
			.get(product.store_id as number)) as Record<string, unknown> | undefined;

		// Get reviews
		const reviews = (await db
			.prepare(
				`SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar
         FROM reviews r
         LEFT JOIN users u ON r.customer_id = u.id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC`
			)
			.all(Number(id))) as Record<string, unknown>[];

		// Get images
		const images = getProductImages(Number(id));

		const productParsed = getProductWithParsedFields(product);

		return sendSuccess(res, {
			...productParsed,
			store,
			reviews,
			images,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// STORES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/stores
 * All stores, highest-rated first.
 */
catalogRouter.get('/stores', async (_req: Request, res: Response) => {
	try {
		const stores = await db.prepare('SELECT * FROM stores ORDER BY rating DESC').all();
		return sendSuccess(res, stores);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * GET /api/stores/:id
 * Store detail with its active products.
 */
catalogRouter.get('/stores/:id', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const store = (await db.prepare('SELECT * FROM stores WHERE id = ?').get(Number(id))) as
			| Record<string, unknown>
			| undefined;

		if (!store) {
			return sendError(res, 'Store not found', 404);
		}

		const products = (await db
			.prepare('SELECT * FROM products WHERE store_id = ? AND is_active = 1')
			.all(Number(id))) as Record<string, unknown>[];

		return sendSuccess(res, {
			...store,
			products: products.map(getProductWithParsedFields),
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
		const { id } = req.params;
		// R4 fix: `await` was missing — `.all()` returns a Promise, so
		// `sendSuccess` was wrapping a Promise in the success envelope
		// and the client received `{ data: <Promise> }`. Same shape of
		// bug as the original `wishlist` Promise-leak flagged in
		// docs/audit/code-review-fixes-2026-06-23.md §1.
		const reviews = (await db
			.prepare(
				`SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar, p.name_en as product_name
         FROM reviews r
         LEFT JOIN users u ON r.customer_id = u.id
         LEFT JOIN products p ON r.product_id = p.id
         WHERE r.store_id = ? AND r.is_visible = TRUE
         ORDER BY r.created_at DESC`
			)
			.all(Number(id))) as Record<string, unknown>[];
		return sendSuccess(res, reviews);
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/categories
 * Full category tree with per-category product counts (active products only).
 */
catalogRouter.get('/categories', async (_req: Request, res: Response) => {
	try {
		const categories = await db
			.prepare(
				`SELECT c.*, COUNT(p.id) as product_count
         FROM categories c
         LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
         GROUP BY c.id
         ORDER BY c.sort_order ASC`
			)
			.all();
		return sendSuccess(res, categories);
	} catch (err) {
		return sendError(res, err);
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
			| Record<string, unknown>
			| undefined;

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
