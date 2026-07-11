/**
 * Admin routes — every endpoint here requires role='admin'.
 *
 * The router is mounted by server/index.ts at `/api/admin`, so the
 * paths below are the suffix (e.g. `app.get('/users', ...)` maps to
 * `GET /api/admin/users`).
 *
 * Read-only (GET) endpoints are listed first; mutating (PATCH)
 * endpoints that write to admin_audit_log come after.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
	db,
	sendError,
	sendSuccess,
	requireAuth,
	requireRole,
	validate,
	buildUpdateSet,
	writeAuditLog,
	paginationSchema,
	adminUserUpdateSchema,
	adminStoreUpdateSchema,
	adminOrderStatusSchema,
	adminProductUpdateSchema,
	adminDisputeUpdateSchema,
	getProductWithParsedFields,
} from '../lib/shared.ts';

export const adminRouter = Router();

// All admin routes require an authenticated admin. The middleware
// chain below mirrors the role gate used in the original index.ts
// inline routes.
const adminAuth = [requireAuth, requireRole('admin')];

// ═══════════════════════════════════════════════════════════
// READ-ONLY (GET)
// ═══════════════════════════════════════════════════════════

/** GET /api/admin/users
 *  Query: ?role=&is_active=&limit=&offset=
 *  Returns: { users, total, limit, offset }
 */
adminRouter.get('/users', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				role: z.enum(['customer', 'merchant', 'admin']).optional(),
				is_active: z.enum(['active', 'suspended', 'banned']).optional(),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const where: string[] = [];
		const params: unknown[] = [];
		if (v.data.role) {
			params.push(v.data.role);
			where.push(`role = $${params.length}`);
		}
		if (v.data.is_active) {
			params.push(v.data.is_active);
			where.push(`status = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const countRow = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM users ${whereSql}`)
			.get(...params)) as { c: number };
		const total = countRow.c;

		params.push(v.data.limit, v.data.offset);
		const users = (await db
			.prepare(
				`SELECT id, email, full_name, phone, role, status, is_verified,
				        email_verified, phone_verified, two_factor_enabled,
				        preferred_language, gender, last_login, created_at, updated_at
				 FROM users ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { users, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/admin/stores
 *  Query: ?is_active=&is_verified=&limit=&offset=
 */
adminRouter.get('/stores', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				is_active: z
					.enum(['true', 'false'])
					.or(z.literal(''))
					.optional()
					.transform((s) => (s === 'true' ? true : s === 'false' ? false : undefined)),
				is_verified: z
					.enum(['true', 'false'])
					.or(z.literal(''))
					.optional()
					.transform((s) => (s === 'true' ? true : s === 'false' ? false : undefined)),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const where: string[] = [];
		const params: unknown[] = [];
		if (v.data.is_active !== undefined) {
			params.push(v.data.is_active);
			where.push(`is_active = $${params.length}`);
		}
		if (v.data.is_verified !== undefined) {
			params.push(v.data.is_verified);
			where.push(`is_verified = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const countRow = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM stores ${whereSql}`)
			.get(...params)) as { c: number };
		const total = countRow.c;

		params.push(v.data.limit, v.data.offset);
		const stores = (await db
			.prepare(
				`SELECT id, owner_id, store_name, store_name_en, store_name_zh, slug,
				        description, description_en, description_zh, logo, banner,
				        location, governorate, trust_level, response_rate, on_time_delivery,
				        commission_rate, rating, review_count, products_count, sales_count,
				        followers_count, since_year, is_active, is_verified, deleted_at,
				        created_at, updated_at
				   FROM stores ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { stores, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/admin/products
 *  Query: ?is_active=&is_featured=&store_id=&category_id=&limit=&offset=
 */
adminRouter.get('/products', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				is_active: z
					.enum(['true', 'false'])
					.or(z.literal(''))
					.optional()
					.transform((s) => (s === 'true' ? true : s === 'false' ? false : undefined)),
				is_featured: z
					.enum(['true', 'false'])
					.or(z.literal(''))
					.optional()
					.transform((s) => (s === 'true' ? true : s === 'false' ? false : undefined)),
				store_id: z.coerce.number().int().positive().optional(),
				category_id: z.coerce.number().int().positive().optional(),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const where: string[] = [];
		const params: unknown[] = [];
		if (v.data.is_active !== undefined) {
			params.push(v.data.is_active);
			where.push(`is_active = $${params.length}`);
		}
		if (v.data.is_featured !== undefined) {
			params.push(v.data.is_featured);
			where.push(`is_featured = $${params.length}`);
		}
		if (v.data.store_id !== undefined) {
			params.push(v.data.store_id);
			where.push(`store_id = $${params.length}`);
		}
		if (v.data.category_id !== undefined) {
			params.push(v.data.category_id);
			where.push(`category_id = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const countRow = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM products ${whereSql}`)
			.get(...params)) as { c: number };
		const total = countRow.c;

		params.push(v.data.limit, v.data.offset);
		const products = (await db
			.prepare(
				`SELECT id, store_id, category_id, name_ar, name_en, name_zh, description,
				        description_en, description_zh, price, original_price, currency,
				        stock, moq, weight, tax_rate, is_digital, main_image, features,
				        specifications, badges, rating, review_count, sold_count, view_count,
				        is_active, is_featured, deal_discount, deal_ends_at, deleted_at,
				        created_at, updated_at
				   FROM products ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, {
			products: products.map(getProductWithParsedFields),
			total,
			limit: v.data.limit,
			offset: v.data.offset,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/admin/orders
 *  Query: ?status=&payment_status=&limit=&offset=
 */
adminRouter.get('/orders', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				status: z
					.enum([
						'pending',
						'confirmed',
						'processing',
						'shipped',
						'delivered',
						'cancelled',
						'refunded',
					])
					.optional(),
				payment_status: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const where: string[] = [];
		const params: unknown[] = [];
		if (v.data.status) {
			params.push(v.data.status);
			where.push(`status = $${params.length}`);
		}
		if (v.data.payment_status) {
			params.push(v.data.payment_status);
			where.push(`payment_status = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const countRow = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM orders ${whereSql}`)
			.get(...params)) as { c: number };
		const total = countRow.c;

		params.push(v.data.limit, v.data.offset);
		const orders = (await db
			.prepare(
				`SELECT id, order_number, customer_id, store_id, status, payment_method,
				        payment_status, subtotal, shipping_cost, discount, coupon_code,
				        discount_amount, total, currency, shipping_address, billing_address,
				        notes, tracking_number, shipping_company, estimated_delivery,
				        delivered_at, cancelled_at, timeline, created_at, updated_at
				   FROM orders ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { orders, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/admin/disputes
 *  Query: ?status=&priority=&limit=&offset=
 */
adminRouter.get('/disputes', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				status: z
					.enum([
						'open',
						'investigating',
						'resolved_buyer',
						'resolved_seller',
						'closed',
						'rejected',
					])
					.optional(),
				priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const where: string[] = [];
		const params: unknown[] = [];
		if (v.data.status) {
			params.push(v.data.status);
			where.push(`status = $${params.length}`);
		}
		if (v.data.priority) {
			params.push(v.data.priority);
			where.push(`priority = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const countRow = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM disputes ${whereSql}`)
			.get(...params)) as { c: number };
		const total = countRow.c;

		params.push(v.data.limit, v.data.offset);
		const disputes = (await db
			.prepare(
				`SELECT id, order_id, customer_id, store_id, type, status, priority,
				        subject, description, evidence, refund_amount, resolved_by,
				        resolved_at, created_at, updated_at
				   FROM disputes ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { disputes, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/admin/audit-log
 *  Query: ?entity_type=&action=&user_id=&limit=&offset=
 */
adminRouter.get('/audit-log', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				entity_type: z.string().trim().min(1).max(50).optional(),
				action: z.string().trim().min(1).max(50).optional(),
				user_id: z.coerce.number().int().positive().optional(),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const where: string[] = [];
		const params: unknown[] = [];
		if (v.data.entity_type) {
			params.push(v.data.entity_type);
			where.push(`entity_type = $${params.length}`);
		}
		if (v.data.action) {
			params.push(v.data.action);
			where.push(`action = $${params.length}`);
		}
		if (v.data.user_id !== undefined) {
			params.push(v.data.user_id);
			where.push(`user_id = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const countRow = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM admin_audit_log ${whereSql}`)
			.get(...params)) as { c: number };
		const total = countRow.c;

		params.push(v.data.limit, v.data.offset);
		const log = (await db
			.prepare(
				`SELECT id, user_id, action, entity_type, entity_id, old_values,
					        new_values, ip_address, user_agent, created_at
					 FROM admin_audit_log ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { log, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

/** POST /api/admin/maintenance/cleanup-audit-logs
 *  Calls the `cleanup_audit_logs()` PL/pgSQL function to delete
 *  admin audit rows older than the configured retention window
 *  (default 2 years) and search log rows older than 90 days.
 *  Returns the number of rows deleted per table so an operator
 *  can spot unusually large purges.
 *
 *  SECURITY: this endpoint is admin-only. The retention function
 *  is `SECURITY DEFINER` and runs as `noufex_owner` so it can
 *  delete from `admin_audit_log` (which noufex_app cannot write
 *  to, but is allowed to DELETE via the function).
 */
adminRouter.post(
	'/maintenance/cleanup-audit-logs',
	...adminAuth,
	async (req: Request, res: Response) => {
		try {
			const v = validate(
				z
					.object({
						admin_retention_days: z.coerce.number().int().min(30).max(3650).optional(),
						search_retention_days: z.coerce.number().int().min(7).max(365).optional(),
					})
					.strict(),
				req.body,
			);
			if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
			const adminDays = v.data.admin_retention_days ?? 730; // 2y
			const searchDays = v.data.search_retention_days ?? 90;
			const row = (await db
				.prepare(`SELECT * FROM cleanup_audit_logs($1::interval, $2::interval)`)
				.get(`${adminDays} days`, `${searchDays} days`)) as
				{ deleted_admin: string | number; deleted_search: string | number } | undefined;
			await writeAuditLog(req, 'maintenance.audit_cleanup', 'system', 0, null, {
				admin_retention_days: adminDays,
				search_retention_days: searchDays,
				deleted_admin: row?.deleted_admin ?? 0,
				deleted_search: row?.deleted_search ?? 0,
			});
			return sendSuccess(res, {
				deleted_admin: Number(row?.deleted_admin ?? 0),
				deleted_search: Number(row?.deleted_search ?? 0),
				admin_retention_days: adminDays,
				search_retention_days: searchDays,
			});
		} catch (err) {
			return sendError(res, err);
		}
	},
);

/** GET /api/admin/stats
 *  Returns a compact dashboard summary for the admin home page.
 *  Single CTE-based round-trip: 1 query, 14 metrics. Was previously
 *  14 separate `SELECT COUNT(*)` calls (~14 round-trips). Each
 *  count uses the primary-key index so the cost is identical to
 *  the previous implementation; we just collapse the network
 *  overhead.
 */
adminRouter.get('/stats', ...adminAuth, async (_req: Request, res: Response) => {
	try {
		const row = (await db
			.prepare(
				`SELECT
					(SELECT COUNT(*)::int FROM users)                                        AS users,
					(SELECT COUNT(*)::int FROM stores)                                       AS stores,
					(SELECT COUNT(*)::int FROM products)                                     AS products,
					(SELECT COUNT(*)::int FROM orders)                                       AS orders,
					(SELECT COUNT(*)::int FROM reviews)                                      AS reviews,
					(SELECT COUNT(*)::int FROM disputes)                                     AS disputes,
					(SELECT COUNT(*)::int FROM disputes   WHERE status = 'open')            AS open_disputes,
					(SELECT COUNT(*)::int FROM orders     WHERE status = 'pending')         AS pending_orders,
					(SELECT COUNT(*)::int FROM orders     WHERE payment_status = 'paid')    AS paid_orders,
					(SELECT COUNT(*)::int FROM users      WHERE status <> 'active')         AS suspended_users,
					(SELECT COUNT(*)::int FROM stores     WHERE is_active = FALSE)          AS inactive_stores,
					(SELECT COUNT(*)::int FROM orders
						WHERE created_at > NOW() - INTERVAL '7 days')                      AS recent_orders,
					(SELECT COUNT(*)::int FROM users
						WHERE created_at > NOW() - INTERVAL '7 days')                      AS recent_users,
					(SELECT COALESCE(SUM(total), 0)::numeric
						FROM orders WHERE payment_status = 'paid')                        AS revenue_yer`,
			)
			.get()) as {
			users: number;
			stores: number;
			products: number;
			orders: number;
			reviews: number;
			disputes: number;
			open_disputes: number;
			pending_orders: number;
			paid_orders: number;
			suspended_users: number;
			inactive_stores: number;
			recent_orders: number;
			recent_users: number;
			revenue_yer: string;
		};

		return sendSuccess(res, {
			counts: {
				users: row.users,
				stores: row.stores,
				products: row.products,
				orders: row.orders,
				reviews: row.reviews,
				disputes: row.disputes,
			},
			flags: {
				openDisputes: row.open_disputes,
				pendingOrders: row.pending_orders,
				paidOrders: row.paid_orders,
				suspendedUsers: row.suspended_users,
				inactiveStores: row.inactive_stores,
			},
			recent7d: {
				orders: row.recent_orders,
				users: row.recent_users,
			},
			revenueYer: Number(row.revenue_yer),
		});
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// MUTATING (PATCH) — every successful mutation is recorded into
// admin_audit_log via writeAuditLog().
// ═══════════════════════════════════════════════════════════

/** PATCH /api/admin/users/:id
 *  Body: { status?, role?, is_verified?, email_verified?, phone_verified? }
 *  Suspend/ban/change role from the admin panel. The password_hash
 *  is never updated through this endpoint.
 */
adminRouter.patch('/users/:id', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(adminUserUpdateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);

		const userId = Number(req.params.id);
		if (!Number.isInteger(userId) || userId <= 0) {
			return sendError(res, 'Invalid user id', 400);
		}

		// Self-protection: an admin cannot ban or demote themselves.
		if (req.user!.id === userId) {
			if (v.data.status === 'banned') {
				return sendError(res, 'You cannot ban your own account.', 400, 'SELF_BAN');
			}
			if (v.data.role && v.data.role !== 'admin') {
				return sendError(res, 'You cannot remove your own admin role.', 400, 'SELF_DEMOTE');
			}
		}

		const current = (await db
			.prepare(
				'SELECT id, email, role, status, is_verified, email_verified, phone_verified FROM users WHERE id = $1',
			)
			.get(userId)) as Record<string, unknown> | undefined;
		if (!current) return sendError(res, 'User not found', 404);

		const { sql: setSql, params } = buildUpdateSet(v.data);
		params.push(userId);
		const updated = (await db
			.prepare(
				`UPDATE users SET ${setSql} WHERE id = $${params.length} RETURNING id, email, role, status, is_verified, email_verified, phone_verified`,
			)
			.get(...params)) as Record<string, unknown>;

		await writeAuditLog(req, 'update_user', 'user', userId, current, updated);
		return sendSuccess(res, updated, 'User updated');
	} catch (err) {
		return sendError(res, err);
	}
});

/** PATCH /api/admin/stores/:id
 *  Body: { is_active?, is_verified?, trust_level? }
 */
adminRouter.patch('/stores/:id', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(adminStoreUpdateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);

		const storeId = Number(req.params.id);
		if (!Number.isInteger(storeId) || storeId <= 0) {
			return sendError(res, 'Invalid store id', 400);
		}

		const current = (await db
			.prepare(
				'SELECT id, owner_id, store_name, is_active, is_verified, trust_level FROM stores WHERE id = $1',
			)
			.get(storeId)) as Record<string, unknown> | undefined;
		if (!current) return sendError(res, 'Store not found', 404);

		const { sql: setSql, params } = buildUpdateSet(v.data);
		params.push(storeId);
		const updated = (await db
			.prepare(
				`UPDATE stores SET ${setSql} WHERE id = $${params.length} RETURNING id, store_name, is_active, is_verified, trust_level`,
			)
			.get(...params)) as Record<string, unknown>;

		await writeAuditLog(req, 'update_store', 'store', storeId, current, updated);
		return sendSuccess(res, updated, 'Store updated');
	} catch (err) {
		return sendError(res, err);
	}
});

/** PATCH /api/admin/orders/:id/status
 *  Body: { status, note? }
 *  Force an order into a specific state. The trg_orders_state_machine
 *  trigger still enforces the legal state machine.
 */
adminRouter.patch('/orders/:id/status', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(adminOrderStatusSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);

		const orderId = Number(req.params.id);
		if (!Number.isInteger(orderId) || orderId <= 0) {
			return sendError(res, 'Invalid order id', 400);
		}

		const current = (await db
			.prepare('SELECT id, status, payment_status, total FROM orders WHERE id = $1')
			.get(orderId)) as Record<string, unknown> | undefined;
		if (!current) return sendError(res, 'Order not found', 404);

		const updated = (await db
			.prepare('UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status')
			.get(v.data.status, orderId)) as Record<string, unknown> | undefined;
		if (!updated) return sendError(res, 'Order update failed', 500);

		await writeAuditLog(req, 'force_status', 'order', orderId, current, {
			...updated,
			note: v.data.note ?? null,
		});
		return sendSuccess(res, updated, 'Order status updated');
	} catch (err) {
		return sendError(res, err);
	}
});

/** PATCH /api/admin/products/:id
 *  Body: { is_active?, is_featured? }
 *  Toggle product visibility / featured status from the admin panel.
 */
adminRouter.patch('/products/:id', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(adminProductUpdateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);

		const productId = Number(req.params.id);
		if (!Number.isInteger(productId) || productId <= 0) {
			return sendError(res, 'Invalid product id', 400);
		}

		const current = (await db
			.prepare(
				'SELECT id, name_en, name_ar, is_active, is_featured, deal_discount FROM products WHERE id = $1',
			)
			.get(productId)) as Record<string, unknown> | undefined;
		if (!current) return sendError(res, 'Product not found', 404);

		const { sql: setSql, params } = buildUpdateSet(v.data);
		params.push(productId);
		const updated = (await db
			.prepare(
				`UPDATE products SET ${setSql} WHERE id = $${params.length}
					 RETURNING id, name_en, name_ar, is_active, is_featured, deal_discount, updated_at`,
			)
			.get(...params)) as Record<string, unknown>;

		await writeAuditLog(req, 'update_product', 'product', productId, current, updated);
		return sendSuccess(res, updated, 'Product updated');
	} catch (err) {
		return sendError(res, err);
	}
});

/** PATCH /api/admin/disputes/:id
 *  Body: { status, resolution?, refund_amount? }
 */
adminRouter.patch('/disputes/:id', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(adminDisputeUpdateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);

		const disputeId = Number(req.params.id);
		if (!Number.isInteger(disputeId) || disputeId <= 0) {
			return sendError(res, 'Invalid dispute id', 400);
		}

		const current = (await db
			.prepare(
				'SELECT id, status, priority, resolution, refund_amount, resolved_by, resolved_at FROM disputes WHERE id = $1',
			)
			.get(disputeId)) as Record<string, unknown> | undefined;
		if (!current) return sendError(res, 'Dispute not found', 404);

		// Stamp resolved_by + resolved_at when moving into a terminal state.
		const TERMINAL_STATUSES = new Set([
			'resolved_buyer',
			'resolved_seller',
			'closed',
			'rejected',
		]);
		const patch: Record<string, unknown> = { status: v.data.status };
		if (v.data.resolution !== undefined) patch.resolution = v.data.resolution;
		if (v.data.refund_amount !== undefined) patch.refund_amount = v.data.refund_amount;
		if (TERMINAL_STATUSES.has(v.data.status)) {
			patch.resolved_by = req.user!.id;
			patch.resolved_at = new Date().toISOString();
		}
		const { sql: setSql, params } = buildUpdateSet(patch);
		params.push(disputeId);
		const updated = (await db
			.prepare(
				`UPDATE disputes SET ${setSql} WHERE id = $${params.length}
					 RETURNING id, status, priority, resolution, refund_amount, resolved_by, resolved_at`,
			)
			.get(...params)) as Record<string, unknown>;

		await writeAuditLog(req, 'update_dispute', 'dispute', disputeId, current, updated);
		return sendSuccess(res, updated, 'Dispute updated');
	} catch (err) {
		return sendError(res, err);
	}
});

/* ------------------------------------------------------------------ */
/*  K.7 Time-series endpoint (moved from admin-read.ts)               */
/* ------------------------------------------------------------------ */
adminRouter.get('/stats/timeseries', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			z.object({
				metric: z
					.enum(['revenue', 'orders', 'users', 'disputes', 'merchants'])
					.default('revenue'),
				bucket: z.enum(['day', 'week', 'month']).default('day'),
				days: z.coerce.number().int().min(1).max(365).optional(),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const { metric, bucket } = v.data;
		const horizonDays = v.data.days ?? (bucket === 'day' ? 30 : bucket === 'week' ? 84 : 365);
		const truncUnit = bucket === 'day' ? 'day' : bucket === 'week' ? 'week' : 'month';

		const metricConfig: Record<typeof metric, { table: string; where: string }> = {
			revenue: { table: 'orders', where: "payment_status = 'paid'" },
			orders: { table: 'orders', where: '1=1' },
			users: { table: 'users', where: '1=1' },
			disputes: { table: 'disputes', where: '1=1' },
			merchants: { table: 'users', where: "role = 'merchant'" },
		};
		const cfg = metricConfig[metric];
		const valueExpr =
			metric === 'revenue' ? 'COALESCE(SUM(total), 0)::numeric' : 'COUNT(*)::int';
		const labelFormat = bucket === 'day' ? 'MM-DD' : bucket === 'week' ? '"W"IW' : 'YYYY-MM';

		const sql = `
			WITH series AS (
				SELECT generate_series(
					date_trunc($1, NOW() - ($2 || ' days')::interval),
					date_trunc($1, NOW()),
					('1 ' || $1)::interval
				) AS bucket_ts
			),
			data AS (
				SELECT date_trunc($1, created_at) AS bucket_ts,
				       ${valueExpr} AS v
				FROM ${cfg.table}
				WHERE ${cfg.where}
				  AND created_at >= NOW() - ($2 || ' days')::interval
				GROUP BY date_trunc($1, created_at)
			)
			SELECT to_char(s.bucket_ts, 'YYYY-MM-DD') AS ts,
			       to_char(s.bucket_ts, $3)            AS label,
			       COALESCE(d.v, 0)                     AS value
			FROM series s
			LEFT JOIN data d USING (bucket_ts)
			ORDER BY s.bucket_ts ASC
		`;

		const rows = (await db
			.prepare(sql)
			.all(truncUnit, String(horizonDays), labelFormat)) as Array<{
			ts: string;
			label: string;
			value: string | number;
		}>;

		return sendSuccess(res, {
			metric,
			bucket,
			horizonDays,
			points: rows.map((r) => ({
				ts: r.ts,
				label: r.label,
				value: Number(r.value),
			})),
		});
	} catch (err) {
		return sendError(res, err);
	}
});

/* ------------------------------------------------------------------ */
/*  K.8 Per-governorate endpoint (moved from admin-read.ts)           */
/* ------------------------------------------------------------------ */
adminRouter.get('/stats/by-governorate', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			z.object({
				scope: z.enum(['stores', 'addresses', 'merchants']).default('stores'),
				top: z.coerce.number().int().min(1).max(20).default(5),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const { scope, top } = v.data;

		const sourceSql: Record<typeof scope, { sql: string; where: string }> = {
			stores: {
				sql: `SELECT COALESCE(NULLIF(governorate, ''), 'Unknown') AS name,
				             COUNT(*)::int AS count
			      FROM stores
			      WHERE is_active = TRUE
			      GROUP BY COALESCE(NULLIF(governorate, ''), 'Unknown')`,
				where: '',
			},
			addresses: {
				sql: `SELECT COALESCE(NULLIF(governorate, ''), 'Unknown') AS name,
				             COUNT(*)::int AS count
			      FROM addresses
			      GROUP BY COALESCE(NULLIF(governorate, ''), 'Unknown')`,
				where: '',
			},
			merchants: {
				sql: `SELECT COALESCE(s.governorate, 'Unknown') AS name,
				             COUNT(*)::int AS count
			      FROM users u
			      LEFT JOIN LATERAL (
			          SELECT governorate
			          FROM stores
			          WHERE owner_id = u.id
			          ORDER BY created_at ASC
			          LIMIT 1
			      ) s ON TRUE
			      WHERE u.role = 'merchant'
			      GROUP BY COALESCE(s.governorate, 'Unknown')`,
				where: '',
			},
		};
		const src = sourceSql[scope];

		const sql = `
			WITH counts AS (${src.sql}),
			ranked AS (
				SELECT name, count,
				       ROW_NUMBER() OVER (ORDER BY count DESC, name ASC) AS rn
				FROM counts
			),
			top_n AS (
				SELECT name, count FROM ranked WHERE rn <= $1
			),
			other AS (
				SELECT COALESCE(SUM(count), 0)::int AS count
				FROM ranked WHERE rn > $1
			)
			SELECT name, count, FALSE AS is_other FROM top_n
			UNION ALL
			SELECT 'Other', count, TRUE AS is_other FROM other
		`;

		const rows = (await db.prepare(sql).all(top)) as Array<{
			name: string;
			count: number;
			is_other: boolean;
		}>;

		const total = rows.reduce((sum, r) => sum + r.count, 0);
		const governorates = rows
			.filter((r) => r.count > 0)
			.map((r) => ({
				name: r.name,
				count: r.count,
				percent: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
			}));

		return sendSuccess(res, {
			scope,
			top,
			total,
			governorates,
		});
	} catch (err) {
		return sendError(res, err);
	}
});
