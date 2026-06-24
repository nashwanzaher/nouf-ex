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
			req.query
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
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
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
			req.query
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
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
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
			req.query
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
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
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
			req.query
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
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
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
			req.query
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
					 LIMIT $${params.length - 1} OFFSET $${params.length}`
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
			req.query
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
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
			)
			.all(...params)) as Record<string, unknown>[];

		return sendSuccess(res, { log, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

adminReadRouter.get('/stats', ...adminAuth, async (_req: Request, res: Response) => {
	try {
		// `get()` returns undefined when no row matches. Guard every
		// count so a fresh / empty database (or the test mock) does
		// not throw a TypeError.
		const count = (row: unknown): number => (row as { c?: number } | undefined)?.c ?? 0;
		const users = count(await db.prepare('SELECT COUNT(*)::int AS c FROM users').get());
		const stores = count(await db.prepare('SELECT COUNT(*)::int AS c FROM stores').get());
		const products = count(await db.prepare('SELECT COUNT(*)::int AS c FROM products').get());
		const orders = count(await db.prepare('SELECT COUNT(*)::int AS c FROM orders').get());
		const reviews = count(await db.prepare('SELECT COUNT(*)::int AS c FROM reviews').get());
		const disputes = count(await db.prepare('SELECT COUNT(*)::int AS c FROM disputes').get());
		const openDisputes = count(
			await db.prepare(`SELECT COUNT(*)::int AS c FROM disputes WHERE status = 'open'`).get()
		);
		const pendingOrders = count(
			await db.prepare(`SELECT COUNT(*)::int AS c FROM orders WHERE status = 'pending'`).get()
		);
		const paidOrders = count(
			await db.prepare(`SELECT COUNT(*)::int AS c FROM orders WHERE payment_status = 'paid'`).get()
		);
		const suspendedUsers = count(
			await db.prepare(`SELECT COUNT(*)::int AS c FROM users WHERE status <> 'active'`).get()
		);
		const inactiveStores = count(
			await db.prepare(`SELECT COUNT(*)::int AS c FROM stores WHERE is_active = FALSE`).get()
		);
		const recentOrders = count(
			await db
				.prepare(
					`SELECT COUNT(*)::int AS c FROM orders
					 WHERE created_at > NOW() - INTERVAL '7 days'`
				)
				.get()
		);
		const recentUsers = count(
			await db
				.prepare(
					`SELECT COUNT(*)::int AS c FROM users
					 WHERE created_at > NOW() - INTERVAL '7 days'`
				)
				.get()
		);
		const revenueRow = (await db
			.prepare(
				`SELECT COALESCE(SUM(total), 0)::numeric AS s
					 FROM orders WHERE payment_status = 'paid'`
			)
			.get()) as { s: string } | undefined;
		const revenueYer = revenueRow ? Number(revenueRow.s) : 0;

		return sendSuccess(res, {
			counts: {
				users,
				stores,
				products,
				orders,
				reviews,
				disputes,
			},
			flags: {
				openDisputes,
				pendingOrders,
				paidOrders,
				suspendedUsers,
				inactiveStores,
			},
			recent7d: {
				orders: recentOrders,
				users: recentUsers,
			},
			revenueYer,
		});
	} catch (err) {
		return sendError(res, err);
	}
});
