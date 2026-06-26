import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	requireRole,
	getProductWithParsedFields,
	paginationSchema,
} from '../lib/shared.cts';

export const adminReadRouter = Router();

const adminAuth = [requireAuth, requireRole('admin')];

adminReadRouter.get('/users', ...adminAuth, async (req: Request, res: Response) => {
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
			.get(...params)) as { c: number } | undefined;
		const total = countRow?.c ?? 0;

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

adminReadRouter.get('/stores', ...adminAuth, async (req: Request, res: Response) => {
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
			.get(...params)) as { c: number } | undefined;
		const total = countRow?.c ?? 0;

		params.push(v.data.limit, v.data.offset);
		const stores = (await db
			.prepare(
				`SELECT * FROM stores ${whereSql}
				 ORDER BY created_at DESC
				 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { stores, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

adminReadRouter.get('/products', ...adminAuth, async (req: Request, res: Response) => {
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
			.get(...params)) as { c: number } | undefined;
		const total = countRow?.c ?? 0;

		params.push(v.data.limit, v.data.offset);
		const products = (await db
			.prepare(
				`SELECT * FROM products ${whereSql}
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

adminReadRouter.get('/orders', ...adminAuth, async (req: Request, res: Response) => {
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
			.get(...params)) as { c: number } | undefined;
		const total = countRow?.c ?? 0;

		params.push(v.data.limit, v.data.offset);
		const orders = (await db
			.prepare(
				`SELECT * FROM orders ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { orders, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

adminReadRouter.get('/disputes', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				status: z.enum(['open', 'in_review', 'resolved', 'rejected']).optional(),
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
			.get(...params)) as { c: number } | undefined;
		const total = countRow?.c ?? 0;

		params.push(v.data.limit, v.data.offset);
		const disputes = (await db
			.prepare(
				`SELECT * FROM disputes ${whereSql}
					 ORDER BY created_at DESC
					 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { disputes, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

adminReadRouter.get('/audit-log', ...adminAuth, async (req: Request, res: Response) => {
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
			.get(...params)) as { c: number } | undefined;
		const total = countRow?.c ?? 0;

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

adminReadRouter.get('/stats', ...adminAuth, async (_req: Request, res: Response) => {
	try {
		// Single CTE-style SELECT: all 14 metrics are computed as scalar
		// subqueries inside one statement, so the route is one round-trip
		// to Postgres (was 14 round-trips before).
		//
		// The aliases use snake_case to mirror the column convention used
		// across the rest of the schema. The response keeps its existing
		// nested shape (counts/flags/recent7d/revenueYer) so the SPA's
		// AdminDashboard does not need to change.
		//
		// The SQL is held in a separate const so the call chain stays
		// short enough to keep the source readable (and so the
		// regression suite's regex can find the single call site).
		const statsSql = `SELECT
			(SELECT COUNT(*)::int FROM users)                                  AS users,
			(SELECT COUNT(*)::int FROM stores)                                 AS stores,
			(SELECT COUNT(*)::int FROM products)                               AS products,
			(SELECT COUNT(*)::int FROM orders)                                 AS orders,
			(SELECT COUNT(*)::int FROM reviews)                                AS reviews,
			(SELECT COUNT(*)::int FROM disputes)                               AS disputes,
			(SELECT COUNT(*)::int FROM disputes WHERE status = 'open')         AS open_disputes,
			(SELECT COUNT(*)::int FROM orders  WHERE status = 'pending')       AS pending_orders,
			(SELECT COUNT(*)::int FROM orders  WHERE payment_status = 'paid')  AS paid_orders,
			(SELECT COUNT(*)::int FROM users   WHERE status <> 'active')       AS suspended_users,
			(SELECT COUNT(*)::int FROM stores  WHERE is_active = FALSE)        AS inactive_stores,
			(SELECT COUNT(*)::int FROM orders  WHERE created_at > NOW() - INTERVAL '7 days') AS recent_orders,
			(SELECT COUNT(*)::int FROM users   WHERE created_at > NOW() - INTERVAL '7 days') AS recent_users,
			COALESCE(
				(SELECT SUM(total)::numeric FROM orders WHERE payment_status = 'paid'),
				0
			)                                                                 AS revenue_yer`;
		const row = (await db.prepare(statsSql).get()) as
			| {
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
					revenue_yer: string | number;
			  }
			| undefined;

		// Empty / fresh DB (or the global pg mock in tests) yields `undefined`.
		// Default every field to 0 so the SPA's dashboard never sees NaN.
		const r = row ?? {
			users: 0,
			stores: 0,
			products: 0,
			orders: 0,
			reviews: 0,
			disputes: 0,
			open_disputes: 0,
			pending_orders: 0,
			paid_orders: 0,
			suspended_users: 0,
			inactive_stores: 0,
			recent_orders: 0,
			recent_users: 0,
			revenue_yer: 0,
		};

		return sendSuccess(res, {
			counts: {
				users: r.users,
				stores: r.stores,
				products: r.products,
				orders: r.orders,
				reviews: r.reviews,
				disputes: r.disputes,
			},
			flags: {
				openDisputes: r.open_disputes,
				pendingOrders: r.pending_orders,
				paidOrders: r.paid_orders,
				suspendedUsers: r.suspended_users,
				inactiveStores: r.inactive_stores,
			},
			recent7d: {
				orders: r.recent_orders,
				users: r.recent_users,
			},
			revenueYer: Number(r.revenue_yer),
		});
	} catch (err) {
		return sendError(res, err);
	}
});
