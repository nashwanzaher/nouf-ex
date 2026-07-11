/**
 * Nouf-ex — Seller (merchant self-service) API.
 *
 * Mounted by server/index.ts at `/api/seller`. Every route below
 * requires a `merchant` (or admin) role — the middleware chain is
 * `[requireAuth, requireRole('merchant', 'admin')]`.
 *
 * C.3 in MASTER_PLAN.md — closes the 12 missing seller endpoints
 * documented in phase10_merchant_flow.ps1 §3.
 *
 * Security model:
 *   - A merchant can only see/edit their OWN store's products, orders,
 *     analytics, inventory, payouts, and images.
 *   - The store id is ALWAYS derived server-side from `req.user.id`
 *     (the merchant's `stores.owner_id`). The client never supplies it.
 *   - Cross-store reads/writes return 404 (not 403) to avoid leaking
 *     store existence.
 */
import { Router, type Request, type Response } from 'express';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	requireRole,
	buildUpdateSet,
	writeAuditLog,
	getProductWithParsedFields,
	sellerProductCreateSchema,
	sellerProductUpdateSchema,
	sellerProductIdParamSchema,
	sellerStoreCreateSchema,
	sellerStoreUpdateSchema,
	sellerOrderStatusUpdateSchema,
	sellerProductImageAddSchema,
	paginationSchema,
	HttpError,
	ErrorCodes,
} from '../lib/shared.ts';

export const sellerRouter = Router();

// Every seller route requires a logged-in merchant (admin is also
// allowed, as a power-user / support escape hatch). The store is
// looked up server-side via stores.owner_id = req.user.id.
const sellerAuth = [requireAuth, requireRole('merchant', 'admin')];

/**
 * Look up the merchant's store. Returns the store id, or null if the
 * user has no store yet. The first call is cached per request via the
 * res.locals slot so subsequent handlers don't re-query.
 */
async function getMerchantStoreId(req: Request, res: Response): Promise<number | null> {
	if (res.locals.merchantStoreId != null) return res.locals.merchantStoreId;
	const row = (await db
		.prepare('SELECT id FROM stores WHERE owner_id = $1 LIMIT 1')
		.get(req.user!.id)) as { id: number } | undefined;
	const id = row?.id ?? null;
	res.locals.merchantStoreId = id;
	return id;
}

// ═══════════════════════════════════════════════════════════
//  STORE — merchant edits their own store
// ═══════════════════════════════════════════════════════════

/** GET /api/seller/stores/me — return my store. 404 if none. */
sellerRouter.get('/stores/me', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const storeId = await getMerchantStoreId(req, res);
		if (storeId == null) return sendError(res, 'You do not have a store yet', 404);
		const row = (await db.prepare('SELECT * FROM stores WHERE id = $1').get(storeId)) as
			Record<string, unknown> | undefined;
		if (!row) return sendError(res, 'Store not found', 404);
		return sendSuccess(res, row);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * POST /api/seller/stores — G2 fix 2026-07-11.
 *
 * Creates the caller's first store. The endpoint is the missing
 * piece in the seller onboarding chain:
 *   - A user with `role='merchant'` (created at registration, see
 *     /api/auth/register G1 fix) hits this once to spin up their
 *     store row.
 *   - All other seller endpoints look up the store via
 *     `stores.owner_id = req.user.id`, so the row MUST exist before
 *     any other call returns 200.
 *
 * Ownership is the entire security model: this route is open to any
 * authenticated user with role 'merchant' (or 'admin'). The merchant
 * is always the owner — `owner_id` is taken from `req.user.id`, never
 * from the request body.
 *
 * Idempotency: a second call by the same user returns 409 with code
 * ALREADY_EXISTS so the client can detect the existing store.
 */
sellerRouter.post('/stores', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(sellerStoreCreateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, ErrorCodes.VALIDATION_ERROR);
		const data = v.data;

		const userId = req.user!.id;
		const existing = (await db
			.prepare('SELECT id FROM stores WHERE owner_id = $1 LIMIT 1')
			.get(userId)) as { id: number } | undefined;
		if (existing) {
			return sendError(
				res,
				'You already have a store. Use PATCH /api/seller/stores/:id to update it.',
				409,
				ErrorCodes.CONFLICT,
			);
		}

		// Slug: lowercase, ASCII-only, unique. We append the user id so
		// two merchants with the same store_name never collide.
		const baseSlug = (data.store_name ?? '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'store';
		const slug = `${baseSlug}-${userId}`;

		// The `stores` table has `location` (free text) and `governorate`
		// (VARCHAR(60)) but no dedicated `city` column. We fold the city
		// into `location` (e.g. "Sana'a, Yemen") so the data is not lost.
		const location = data.city
			? `${data.city}${data.governorate ? `, ${data.governorate}` : ''}`
			: data.governorate ?? null;

		const inserted = (await db
			.prepare(
				`INSERT INTO stores (
					owner_id, store_name, slug, description, location, governorate,
					trust_level, is_active, is_verified, since_year, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, 'verified', TRUE, FALSE, EXTRACT(YEAR FROM NOW())::int, NOW(), NOW())
				RETURNING id, owner_id, store_name, slug, description, location, governorate,
					trust_level, is_active, is_verified, since_year, created_at, updated_at`,
			)
			.get(
				userId,
				data.store_name,
				slug,
				data.description ?? null,
				location,
				data.governorate ?? null,
			)) as Record<string, unknown> | undefined;
		if (!inserted) {
			throw new HttpError(500, 'Failed to create store', { code: ErrorCodes.INSERT_FAILED });
		}

		// Update the user's role to 'merchant' if they were still a
		// 'customer' who upgraded via this endpoint. This lets a
		// customer who already has an account become a merchant
		// without admin intervention. We do NOT downgrade admins.
		if (req.user!.role === 'customer') {
			await db
				.prepare("UPDATE users SET role = 'merchant', updated_at = NOW() WHERE id = $1")
				.run(userId)
				.catch(() => undefined);
		}

		await writeAuditLog(req, 'store.create', 'stores', Number(inserted.id), null, {
			store_name: data.store_name,
		});
		return sendSuccess(res, inserted, 201, 'Store created');
	} catch (err) {
		const pg = err as { code?: string };
		if (pg?.code === '23505') {
			return sendError(
				res,
				'A store with this name already exists for your account.',
				409,
				ErrorCodes.DUPLICATE,
			);
		}
		return sendError(res, err);
	}
});

/** PATCH /api/seller/stores/:id — update my store. */
sellerRouter.patch('/stores/:id', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		// Ownership check: this id must be MY store.
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null || myStoreId !== id) {
			return sendError(res, 'Store not found', 404);
		}
		const v = validate(sellerStoreUpdateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const updates = v.data;
		const { sql, params } = buildUpdateSet(updates);
		if (!sql) return sendError(res, 'No updatable fields supplied', 400);
		params.push(id);
		const updated = (await db
			.prepare(
				`UPDATE stores SET ${sql}, updated_at = NOW()
           WHERE id = $${params.length} RETURNING *`,
			)
			.get(...params)) as Record<string, unknown> | undefined;
		if (!updated) return sendError(res, 'Store not found', 404);
		await writeAuditLog(req, 'store.update', 'stores', id, null, updates);
		return sendSuccess(res, updated, 'Store updated');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
//  PRODUCTS — merchant creates/edits/deletes their own products
// ═══════════════════════════════════════════════════════════

/** POST /api/seller/products — create a new product under my store. */
sellerRouter.post('/products', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const storeId = await getMerchantStoreId(req, res);
		if (storeId == null) return sendError(res, 'You do not have a store yet', 404);
		const v = validate(sellerProductCreateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const data = v.data;

		if (data.category_id != null) {
			const category = (await db
				.prepare('SELECT id FROM categories WHERE id = ? AND is_active = TRUE')
				.get(data.category_id)) as { id: number } | undefined;
			if (!category) {
				return sendError(res, 'Category not found or inactive', 400, 'CATEGORY_NOT_FOUND');
			}
		}

		const result = (await db
			.prepare(
				`INSERT INTO products
             (store_id, category_id, name_ar, name_en, name_zh, slug, sku,
              price, original_price, stock, description, main_image,
              images, features, badges, metadata, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, TRUE, NOW(), NOW())
           RETURNING id`,
			)
			.get(
				storeId,
				data.category_id,
				data.name_ar,
				data.name_en ?? null,
				data.name_zh ?? null,
				data.slug,
				data.sku ?? null,
				data.price,
				data.original_price ?? null,
				data.stock,
				data.description ?? null,
				data.main_image ?? null,
				JSON.stringify(data.images ?? []),
				JSON.stringify(data.features ?? []),
				JSON.stringify(data.badges ?? []),
				JSON.stringify(data.metadata ?? {}),
			)) as { id: number };
		await writeAuditLog(req, 'product.create', 'products', result.id, null, data);
		return sendSuccess(res, { id: result.id }, 'Product created');
	} catch (err) {
		const pg = err as { code?: string };
		if (pg?.code === '23505') return sendError(res, 'Product slug already in use', 409);
		return sendError(res, err);
	}
});

/** GET /api/seller/products — list MY store's products (paginated). */
sellerRouter.get('/products', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const storeId = await getMerchantStoreId(req, res);
		if (storeId == null) return sendError(res, 'You do not have a store yet', 404);
		const v = validate(paginationSchema, req.query);
		if (!v.ok) return sendError(res, 'Invalid pagination: ' + v.error, 400);
		const { limit, offset } = v.data;
		const rows = (await db
			.prepare(
				`SELECT * FROM products
           WHERE store_id = $1 AND deleted_at IS NULL
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
			)
			.all(storeId, limit, offset)) as Record<string, unknown>[];
		const products = rows.map((r) => getProductWithParsedFields(r));
		return sendSuccess(res, { items: products, limit, offset });
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/seller/products/:id — get one of my products. */
sellerRouter.get('/products/:id', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(sellerProductIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid id', 400);
		const id = v.data.id;
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		const row = (await db
			.prepare(
				'SELECT * FROM products WHERE id = $1 AND store_id = $2 AND deleted_at IS NULL',
			)
			.get(id, myStoreId)) as Record<string, unknown> | undefined;
		if (!row) return sendError(res, 'Product not found', 404);
		return sendSuccess(res, getProductWithParsedFields(row));
	} catch (err) {
		return sendError(res, err);
	}
});

/** PATCH /api/seller/products/:id — partial update. */
sellerRouter.patch('/products/:id', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(sellerProductIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid id', 400);
		const id = v.data.id;
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		const v2 = validate(sellerProductUpdateSchema, req.body);
		if (!v2.ok) return sendError(res, 'Invalid input: ' + v2.error, 400);
		const updates = v2.data;
		const { sql, params } = buildUpdateSet(updates);
		if (!sql) return sendError(res, 'No updatable fields supplied', 400);
		params.push(id, myStoreId);
		const updated = (await db
			.prepare(
				`UPDATE products SET ${sql}, updated_at = NOW()
           WHERE id = $${params.length - 1} AND store_id = $${params.length} AND deleted_at IS NULL
           RETURNING *`,
			)
			.get(...params)) as Record<string, unknown> | undefined;
		if (!updated) return sendError(res, 'Product not found', 404);
		await writeAuditLog(req, 'product.update', 'products', id, null, updates);
		return sendSuccess(res, getProductWithParsedFields(updated), 'Product updated');
	} catch (err) {
		return sendError(res, err);
	}
});

/** DELETE /api/seller/products/:id — soft-delete (sets deleted_at). */
sellerRouter.delete('/products/:id', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(sellerProductIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid id', 400);
		const id = v.data.id;
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		const result = (await db
			.prepare(
				`UPDATE products
           SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
         WHERE id = $1 AND store_id = $2 AND deleted_at IS NULL
         RETURNING id`,
			)
			.get(id, myStoreId)) as { id: number } | undefined;
		if (!result) return sendError(res, 'Product not found', 404);
		await writeAuditLog(req, 'product.delete', 'products', id, null, { soft: true });
		return sendSuccess(res, { id: result.id }, 'Product deleted');
	} catch (err) {
		return sendError(res, err);
	}
});

/** POST /api/seller/products/:id/images — add an image to one of my products. */
sellerRouter.post('/products/:id/images', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(sellerProductIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid product id', 400);
		const productId = v.data.id;
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		// Ownership check
		const product = (await db
			.prepare(
				'SELECT id FROM products WHERE id = $1 AND store_id = $2 AND deleted_at IS NULL',
			)
			.get(productId, myStoreId)) as { id: number } | undefined;
		if (!product) return sendError(res, 'Product not found', 404);
		const v2 = validate(sellerProductImageAddSchema, req.body);
		if (!v2.ok) return sendError(res, 'Invalid input: ' + v2.error, 400);
		const data = v2.data;
		const result = (await db
			.prepare(
				`INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary, created_at)
           VALUES (?, ?, ?, ?, ?, NOW()) RETURNING id`,
			)
			.get(productId, data.url, data.alt_text ?? null, data.sort_order, data.is_primary)) as {
			id: number;
		};
		await writeAuditLog(req, 'product.image.add', 'products', productId, null, {
			imageId: result.id,
		});
		return sendSuccess(res, { id: result.id }, 'Image added');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
//  ORDERS — merchant sees and updates orders for their store
// ═══════════════════════════════════════════════════════════

/** GET /api/seller/orders — list orders for my store. */
sellerRouter.get('/orders', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const storeId = await getMerchantStoreId(req, res);
		if (storeId == null) return sendError(res, 'You do not have a store yet', 404);
		const v = validate(paginationSchema, req.query);
		if (!v.ok) return sendError(res, 'Invalid pagination: ' + v.error, 400);
		const { limit, offset } = v.data;
		const status = (req.query.status as string | undefined) ?? null;
		const validStatuses = [
			'pending',
			'confirmed',
			'processing',
			'shipped',
			'delivered',
			'cancelled',
			'refunded',
		];
		if (status && !validStatuses.includes(status)) {
			return sendError(
				res,
				`Invalid status. Must be one of: ${validStatuses.join(', ')}`,
				400,
			);
		}
		let sql = `SELECT o.*, u.email AS customer_email
             FROM orders o
             JOIN users u ON o.customer_id = u.id
            WHERE o.store_id = $1`;
		const params: unknown[] = [storeId];
		if (status) {
			sql += ` AND o.status = $${params.length + 1}`;
			params.push(status);
		}
		sql += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
		params.push(limit, offset);
		const rows = (await db.prepare(sql).all(...params)) as Record<string, unknown>[];
		return sendSuccess(res, { items: rows, limit, offset });
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/seller/orders/:id — get one of my orders. */
sellerRouter.get('/orders/:id', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		const row = (await db
			.prepare('SELECT * FROM orders WHERE id = $1 AND store_id = $2')
			.get(id, myStoreId)) as Record<string, unknown> | undefined;
		if (!row) return sendError(res, 'Order not found', 404);
		const items = (await db
			.prepare('SELECT * FROM order_items WHERE order_id = $1')
			.all(id)) as Record<string, unknown>[];
		return sendSuccess(res, { ...row, items });
	} catch (err) {
		return sendError(res, err);
	}
});

/** POST /api/seller/orders/:id/status — update order status. */
sellerRouter.post('/orders/:id/status', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		// Ownership: must be my order.
		const order = (await db
			.prepare('SELECT id, status FROM orders WHERE id = $1 AND store_id = $2')
			.get(id, myStoreId)) as { id: number; status: string } | undefined;
		if (!order) return sendError(res, 'Order not found', 404);
		const v = validate(sellerOrderStatusUpdateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const data = v.data;
		// Forward-only state machine: confirmed → processing → shipped → delivered
		// (cancelled is allowed from any pre-shipped state). Reject any backward
		// transition so the merchant can't accidentally un-cancel.
		const allowed: Record<string, string[]> = {
			pending: ['confirmed', 'cancelled'],
			confirmed: ['processing', 'cancelled'],
			processing: ['shipped', 'cancelled'],
			shipped: ['delivered'],
			delivered: [],
			cancelled: [],
		};
		if (!allowed[order.status]?.includes(data.status)) {
			return sendError(
				res,
				`Cannot transition order from '${order.status}' to '${data.status}'`,
				400,
				'INVALID_STATE_TRANSITION',
			);
		}
	const updated = (await db
			.prepare(
				`UPDATE orders
				 SET status = $1, updated_at = NOW(),
					 tracking_number = COALESCE($2, tracking_number),
					 timeline = COALESCE(timeline, '[]'::jsonb) || jsonb_build_array(
						 jsonb_build_object('status', $1, 'note', $3, 'at', NOW()::text, 'by', $4)
					 )
			   WHERE id = $5
			   RETURNING id, status, timeline, updated_at`,
			)
			.get(data.status, data.tracking_number ?? null, data.note ?? null, req.user!.id, id)) as
			Record<string, unknown> | undefined;
		if (!updated) return sendError(res, 'Order not found', 404);
		await writeAuditLog(
			req,
			'order.status.update',
			'orders',
			id,
			{ from: order.status },
			{
				to: data.status,
				tracking_number: data.tracking_number,
			},
		);
		return sendSuccess(res, updated, 'Order status updated');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
//  ANALYTICS + INVENTORY + PAYOUTS — read-only seller dashboards
// ═══════════════════════════════════════════════════════════

/** GET /api/seller/analytics — sales KPIs for my store. */
sellerRouter.get('/analytics', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		const totals = (await db
			.prepare(
				`SELECT
             COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'refunded'))::int AS total_orders,
             COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
             COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
			COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0)::numeric AS gross_revenue,
             COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled', 'refunded')), 0)::numeric AS total_revenue,
             COUNT(DISTINCT customer_id)::int AS unique_customers
         FROM orders
        WHERE store_id = $1`,
			)
			.get(myStoreId)) as Record<string, unknown> | undefined;
		const today = (await db
			.prepare(
				`SELECT COUNT(*)::int AS n
             FROM orders
            WHERE store_id = $1
              AND created_at >= CURRENT_DATE`,
			)
			.get(myStoreId)) as { n: number } | undefined;
		return sendSuccess(res, {
			store_id: myStoreId,
			total_orders: totals?.total_orders ?? 0,
			delivered_orders: totals?.delivered_orders ?? 0,
			cancelled_orders: totals?.cancelled_orders ?? 0,
			unique_customers: totals?.unique_customers ?? 0,
			today_orders: today?.n ?? 0,
			gross_revenue: Number(totals?.gross_revenue ?? 0),
			total_revenue: Number(totals?.total_revenue ?? 0),
		});
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/seller/inventory — stock levels for my products. */
sellerRouter.get('/inventory', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		const rows = (await db
			.prepare(
				`SELECT id, name_ar, name_en, sku, stock, sold_count, is_active,
                CASE
                  WHEN stock = 0 THEN 'out_of_stock'
                  WHEN stock < 10 THEN 'low_stock'
                  ELSE 'in_stock'
                END AS stock_status
           FROM products
          WHERE store_id = $1 AND deleted_at IS NULL
          ORDER BY stock ASC, name_en ASC NULLS LAST`,
			)
			.all(myStoreId)) as unknown as Record<string, unknown>[];
		return sendSuccess(res, { items: rows });
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/seller/payouts — recent store_balance transactions. */
sellerRouter.get('/payouts', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		const v = validate(paginationSchema, req.query);
		if (!v.ok) return sendError(res, 'Invalid pagination: ' + v.error, 400);
		const { limit, offset } = v.data;
		const rows = (await db
			.prepare(
				`SELECT id, type, amount, balance_after, reference_type, reference_id,
                description, created_at
           FROM transactions
          WHERE store_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`,
			)
			.all(myStoreId, limit, offset)) as Record<string, unknown>[];
		// Include the current balance separately for convenience.
		const balance = (await db
			.prepare('SELECT available, pending FROM store_balance WHERE store_id = $1')
			.get(myStoreId)) as { available: number; pending: number } | undefined;
		return sendSuccess(res, {
			balance: balance ?? { available: 0, pending: 0 },
			items: rows,
			limit,
			offset,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/seller/dashboard — KPIs rollup (alias for /analytics). */
sellerRouter.get('/dashboard', ...sellerAuth, async (req: Request, res: Response) => {
	try {
		// Forward to /analytics internally
		req.url = '/analytics';
		const myStoreId = await getMerchantStoreId(req, res);
		if (myStoreId == null) return sendError(res, 'You do not have a store yet', 404);
		const totals = (await db
			.prepare(
				`SELECT
             COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'refunded'))::int AS active_orders,
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
             COALESCE(SUM(total) FILTER (WHERE status = 'delivered'), 0)::numeric AS revenue
         FROM orders WHERE store_id = $1`,
			)
			.get(myStoreId)) as Record<string, unknown> | undefined;
		const lowStock = (await db
			.prepare(
				`SELECT COUNT(*)::int AS n FROM products
          WHERE store_id = $1 AND deleted_at IS NULL AND stock < 10`,
			)
			.get(myStoreId)) as { n: number } | undefined;
		return sendSuccess(res, {
			store_id: myStoreId,
			active_orders: totals?.active_orders ?? 0,
			pending_orders: totals?.pending_orders ?? 0,
			revenue: Number(totals?.revenue ?? 0),
			low_stock_products: lowStock?.n ?? 0,
		});
	} catch (err) {
		return sendError(res, err);
	}
});
