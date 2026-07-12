/**
 * Phase-2 admin endpoints (added 2026-07-12).
 *
 * Categories CRUD, Coupons CRUD, Reviews moderation, Notifications
 * broadcast, Settings writer, Orders with customer/store join.
 *
 * Each PATCH / POST that mutates writes to `admin_audit_log` via
 * `writeAuditLog()` with the same `entity_type / entity_id / old / new`
 * shape as the rest of the admin router.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
	broadcastLimiter,
	db,
	sendError,
	sendSuccess,
	requireAuth,
	requireRole,
	validate,
	writeAuditLog,
	readSettingDirect,
	redactSettingValue,
	diffSettingValue,
	paginationSchema,
	adminCategoryCreateSchema,
	adminCategoryUpdateSchema,
	adminCouponCreateSchema,
	adminCouponUpdateSchema,
	adminBroadcastSchema,
	adminSettingUpdateSchema,
} from '../lib/shared.ts';
import { validateSettingValue } from '../lib/settings-validation.ts';

export const adminExtrasRouter = Router();

const adminAuth = [requireAuth, requireRole('admin')];

// ─── Categories ────────────────────────────────────────────────────────

/** GET /api/admin/categories
 *  Query: ?limit=&offset=&q=
 */
adminExtrasRouter.get('/categories', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({ q: z.string().trim().max(80).optional() }),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);

		const params: unknown[] = [];
		const where: string[] = [];
		if (v.data.q) {
			params.push(`%${v.data.q}%`);
			where.push(
				`(name_ar ILIKE $${params.length} OR name_en ILIKE $${params.length} OR slug ILIKE $${params.length})`,
			);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
		const total = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM categories ${whereSql}`)
			.get(...params)) as { c: number };
		params.push(v.data.limit, v.data.offset);
		const items = (await db
			.prepare(
				`SELECT id, parent_id, name_ar, name_en, name_zh, slug, icon, image,
				        sort_order, is_active, created_at, updated_at
				   FROM categories ${whereSql}
				  ORDER BY sort_order, name_ar
				  LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];
		return sendSuccess(res, { items, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

/** POST /api/admin/categories — create */
adminExtrasRouter.post('/categories', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(adminCategoryCreateSchema, req.body);
		if (!v.ok) return sendError(res, v.error, 400);
		const row = (await db
			.prepare(
				`INSERT INTO categories (parent_id, name_ar, name_en, name_zh, slug, icon, image, sort_order, is_active)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
				 RETURNING id`,
			)
			.get(
				v.data.parent_id ?? null,
				v.data.name_ar,
				v.data.name_en ?? null,
				v.data.name_zh ?? null,
				v.data.slug,
				v.data.icon ?? null,
				v.data.image ?? null,
				v.data.sort_order,
				v.data.is_active,
			)) as { id: number };
		await writeAuditLog(
			req,
			'create_category',
			'category',
			String(row.id),
			null,
			v.data,
		);
		return sendSuccess(res, { id: row.id }, 201);
	} catch (err) {
		return sendError(res, err);
	}
});

/** PATCH /api/admin/categories/:id */
adminExtrasRouter.patch('/categories/:id', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const v = validate(adminCategoryUpdateSchema, req.body);
		if (!v.ok) return sendError(res, v.error, 400);
		if (Object.keys(v.data).length === 0) return sendError(res, 'No fields to update', 400);
		const oldRow = (await db
			.prepare('SELECT * FROM categories WHERE id = $1')
			.get(id)) as Record<string, unknown> | undefined;
		if (!oldRow) return sendError(res, 'Not found', 404);
		const updates = Object.entries(v.data).filter(([, val]) => val !== undefined);
		const sets: string[] = [];
		const params: unknown[] = [];
		for (const [key, val] of updates) {
			params.push(val);
			sets.push(`${key} = $${params.length}`);
		}
		params.push(id);
		await db
			.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = $${params.length}`)
			.run(...params);
		await writeAuditLog(req, 'update_category', 'category', String(id), oldRow, v.data);
		return sendSuccess(res, { id });
	} catch (err) {
		return sendError(res, err);
	}
});

/** DELETE /api/admin/categories/:id — soft-delete (mark inactive) to
 *  avoid orphaning products. */
adminExtrasRouter.delete('/categories/:id', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const oldRow = (await db
			.prepare('SELECT id, is_active FROM categories WHERE id = $1')
			.get(id)) as Record<string, unknown> | undefined;
		if (!oldRow) return sendError(res, 'Not found', 404);
		await db.prepare('UPDATE categories SET is_active = false WHERE id = $1').run(id);
		await writeAuditLog(req, 'deactivate_category', 'category', String(id), oldRow, { is_active: false });
		return sendSuccess(res, { id, deactivated: true });
	} catch (err) {
		return sendError(res, err);
	}
});

// ─── Coupons ───────────────────────────────────────────────────────────

adminExtrasRouter.get('/coupons', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				is_active: z
					.union([z.literal('true'), z.literal('false')])
					.optional()
					.transform((s) => (s === 'true' ? true : s === 'false' ? false : undefined)),
				store_id: z.coerce.number().int().positive().optional(),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);
		const params: unknown[] = [];
		const where: string[] = [];
		if (v.data.is_active !== undefined) {
			params.push(v.data.is_active);
			where.push(`is_active = $${params.length}`);
		}
		if (v.data.store_id !== undefined) {
			params.push(v.data.store_id);
			where.push(`store_id = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
		const total = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM coupons ${whereSql}`)
			.get(...params)) as { c: number };
		params.push(v.data.limit, v.data.offset);
		const items = (await db
			.prepare(
				`SELECT id, code, type, value, min_order_amount, max_discount, usage_limit,
				        usage_count, per_user_limit, store_id, starts_at, expires_at,
				        is_active, description, created_at, updated_at
				   FROM coupons ${whereSql}
				  ORDER BY created_at DESC
				  LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];
		return sendSuccess(res, { items, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

adminExtrasRouter.post('/coupons', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(adminCouponCreateSchema, req.body);
		if (!v.ok) return sendError(res, v.error, 400);
		const row = (await db
			.prepare(
				`INSERT INTO coupons (code, type, value, min_order_amount, max_discount,
				                      usage_limit, per_user_limit, store_id,
				                      starts_at, expires_at, is_active, description)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
				 RETURNING id`,
			)
			.get(
				v.data.code.toUpperCase(),
				v.data.type,
				v.data.value,
				v.data.min_order_amount,
				v.data.max_discount ?? null,
				v.data.usage_limit ?? null,
				v.data.per_user_limit,
				v.data.store_id ?? null,
				v.data.starts_at ? new Date(v.data.starts_at).toISOString() : null,
				v.data.expires_at ? new Date(v.data.expires_at).toISOString() : null,
				v.data.is_active,
				v.data.description ?? null,
			)) as { id: number };
		await writeAuditLog(req, 'create_coupon', 'coupon', String(row.id), null, v.data);
		return sendSuccess(res, { id: row.id }, 201);
	} catch (err) {
		return sendError(res, err);
	}
});

adminExtrasRouter.patch('/coupons/:id', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const v = validate(adminCouponUpdateSchema, req.body);
		if (!v.ok) return sendError(res, v.error, 400);
		if (Object.keys(v.data).length === 0) return sendError(res, 'No fields to update', 400);
		const oldRow = (await db
			.prepare('SELECT * FROM coupons WHERE id = $1')
			.get(id)) as Record<string, unknown> | undefined;
		if (!oldRow) return sendError(res, 'Not found', 404);
		const updates = Object.entries(v.data).filter(([, val]) => val !== undefined);
		const sets: string[] = [];
		const params: unknown[] = [];
		for (const [key, val] of updates) {
			if (key === 'code') {
				params.push(String(val).toUpperCase());
			} else if (key === 'starts_at' || key === 'expires_at') {
				params.push(val ? new Date(String(val)).toISOString() : null);
			} else {
				params.push(val);
			}
			sets.push(`${key} = $${params.length}`);
		}
		params.push(id);
		await db
			.prepare(`UPDATE coupons SET ${sets.join(', ')} WHERE id = $${params.length}`)
			.run(...params);
		await writeAuditLog(req, 'update_coupon', 'coupon', String(id), oldRow, v.data);
		return sendSuccess(res, { id });
	} catch (err) {
		return sendError(res, err);
	}
});

adminExtrasRouter.delete('/coupons/:id', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const oldRow = (await db
			.prepare('SELECT id FROM coupons WHERE id = $1')
			.get(id)) as Record<string, unknown> | undefined;
		if (!oldRow) return sendError(res, 'Not found', 404);
		// P0 fix 2026-07-12: clean up orphaned coupon_usage rows BEFORE
		// deleting the coupon. Without this, foreign-key cascade leaves
		// dangling coupon_usage rows pointing at a non-existent coupon
		// (coupon_usage has no FK constraint, only an index on coupon_id).
		// Wrapped in a transaction so a failure in either delete aborts
		// both — we never end up with an orphaned record OR a coupon
		// deleted without its usage history being cleaned up.
		await db.tx(async (txDb) => {
			const usageResult = (await txDb
				.prepare('DELETE FROM coupon_usage WHERE coupon_id = $1')
				.run(id)) as unknown as { changes?: number };
			const usageDeleted = usageResult?.changes ?? 0;
			await txDb.prepare('DELETE FROM coupons WHERE id = $1').run(id);
			// Surface the count in the audit log so admins can see how
			// many redemption records were purged.
			await writeAuditLog(
				req,
				'delete_coupon',
				'coupon',
				String(id),
				oldRow,
				{ usage_rows_deleted: usageDeleted },
			);
		});
		return sendSuccess(res, { id, deleted: true });
	} catch (err) {
		return sendError(res, err);
	}
});

// ─── Reviews moderation ────────────────────────────────────────────────

adminExtrasRouter.get('/reviews', ...adminAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			paginationSchema.extend({
				product_id: z.coerce.number().int().positive().optional(),
				store_id: z.coerce.number().int().positive().optional(),
				rating: z.coerce.number().int().min(1).max(5).optional(),
				is_visible: z
					.union([z.literal('true'), z.literal('false')])
					.optional()
					.transform((s) => (s === 'true' ? true : s === 'false' ? false : undefined)),
			}),
			req.query,
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);
		const params: unknown[] = [];
		const where: string[] = [];
		if (v.data.product_id) {
			params.push(v.data.product_id);
			where.push(`r.product_id = $${params.length}`);
		}
		if (v.data.store_id) {
			params.push(v.data.store_id);
			where.push(`r.store_id = $${params.length}`);
		}
		if (v.data.rating) {
			params.push(v.data.rating);
			where.push(`r.rating = $${params.length}`);
		}
		if (v.data.is_visible !== undefined) {
			params.push(v.data.is_visible);
			where.push(`r.is_visible = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
		const total = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM reviews r ${whereSql}`)
			.get(...params)) as { c: number };
		params.push(v.data.limit, v.data.offset);
		const items = (await db
			.prepare(
				`SELECT r.id, r.product_id, r.store_id, r.customer_id, r.order_id,
				        r.rating, r.title, r.comment, r.is_verified, r.is_visible,
				        r.helpful_count, r.merchant_reply, r.merchant_replied_at,
				        r.created_at, r.updated_at,
				        p.name_ar AS product_name, p.name_en AS product_name_en,
				        u.full_name AS customer_name, u.email AS customer_email
				   FROM reviews r
				   LEFT JOIN products p ON p.id = r.product_id
				   LEFT JOIN users u ON u.id = r.customer_id
				   ${whereSql}
				  ORDER BY r.created_at DESC
				  LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];
		return sendSuccess(res, { items, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});

adminExtrasRouter.patch(
	'/reviews/:id',
	...adminAuth,
	async (req: Request, res: Response) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isFinite(id) || id <= 0) return sendError(res, 'Invalid id', 400);
			const v = validate(
				z.object({ is_visible: z.boolean().optional() }).strict(),
				req.body,
			);
			if (!v.ok) return sendError(res, v.error, 400);
			if (Object.keys(v.data).length === 0) return sendError(res, 'No fields', 400);
			const oldRow = (await db
				.prepare('SELECT id, is_visible FROM reviews WHERE id = $1')
				.get(id)) as Record<string, unknown> | undefined;
			if (!oldRow) return sendError(res, 'Not found', 404);
			const updates = Object.entries(v.data);
			const sets: string[] = [];
			const params: unknown[] = [];
			for (const [key, val] of updates) {
				params.push(val);
				sets.push(`${key} = $${params.length}`);
			}
			params.push(id);
			await db
				.prepare(`UPDATE reviews SET ${sets.join(', ')} WHERE id = $${params.length}`)
				.run(...params);
			await writeAuditLog(req, 'moderate_review', 'review', String(id), oldRow, v.data);
			return sendSuccess(res, { id });
		} catch (err) {
			return sendError(res, err);
		}
	},
);

adminExtrasRouter.delete(
	'/reviews/:id',
	...adminAuth,
	async (req: Request, res: Response) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isFinite(id) || id <= 0) return sendError(res, 'Invalid id', 400);
			const oldRow = (await db
				.prepare('SELECT id FROM reviews WHERE id = $1')
				.get(id)) as Record<string, unknown> | undefined;
			if (!oldRow) return sendError(res, 'Not found', 404);
			await db.prepare('DELETE FROM reviews WHERE id = $1').run(id);
			await writeAuditLog(req, 'delete_review', 'review', String(id), oldRow, null);
			return sendSuccess(res, { id, deleted: true });
		} catch (err) {
			return sendError(res, err);
		}
	},
);

// ─── Notifications broadcast ───────────────────────────────────────────

/** POST /api/admin/notifications/broadcast
 *  Inserts one `notifications` row per user matching the segment.
 *  P0 (2026-07-12): rate-limited to 10 broadcasts / hour / admin to
 *  prevent abuse via a compromised admin session.
 */
adminExtrasRouter.post(
	'/notifications/broadcast',
	broadcastLimiter,
	...adminAuth,
	async (req: Request, res: Response) => {
		try {
			const v = validate(adminBroadcastSchema, req.body);
			if (!v.ok) return sendError(res, v.error, 400);
			const roleFilter = ((): string | null => {
				switch (v.data.segment) {
					case 'customers':
						return 'customer';
					case 'merchants':
						return 'merchant';
					case 'admins':
						return 'admin';
					default:
						return null;
				}
			})();
			const users = (await db
				.prepare(
					roleFilter
						? 'SELECT id FROM users WHERE role = $1 AND status = $2'
						: "SELECT id FROM users WHERE status = 'active'",
				)
				.all(...(roleFilter ? [roleFilter, 'active'] : []))) as { id: number }[];
			if (users.length === 0)
				return sendSuccess(res, { created: 0, segment: v.data.segment });
			// Batch insert in a single transaction. The notifications table
			// grants INSERT to noufex_app so we don't need the SECURITY
			// DEFINER function here.
			await db.prepare('BEGIN').run();
			try {
				const stmt = db.prepare(
					`INSERT INTO notifications (user_id, type, title, body, data, is_read)
					 VALUES ($1, $2, $3, $4, '{}'::jsonb, false)`,
				);
				let inserted = 0;
				for (const u of users) {
					await stmt.run(u.id, v.data.type, v.data.title, v.data.body);
					inserted++;
				}
				await db.prepare('COMMIT').run();
				await writeAuditLog(
					req,
					'broadcast_notification',
					'notification',
					String(inserted),
					null,
					{ segment: v.data.segment, type: v.data.type, title: v.data.title },
				);
				return sendSuccess(res, { created: inserted, segment: v.data.segment });
			} catch (e) {
				await db.prepare('ROLLBACK').run();
				throw e;
			}
		} catch (err) {
			return sendError(res, err);
		}
	},
);

// ─── Settings (read + write) ──────────────────────────────────────────

adminExtrasRouter.get('/settings', ...adminAuth, async (_req: Request, res: Response) => {
	try {
		const rows = (await db
			.prepare('SELECT key, value, updated_at FROM app_settings ORDER BY key')
			.all()) as Record<string, unknown>[];
		return sendSuccess(res, { settings: rows });
	} catch (err) {
		return sendError(res, err);
	}
});

adminExtrasRouter.patch(
	'/settings/:key',
	...adminAuth,
	async (req: Request, res: Response) => {
		try {
			const v = validate(adminSettingUpdateSchema, req.body);
			if (!v.ok) return sendError(res, v.error, 400);
			const key = String(req.params.key ?? '');
			if (!key || key.length > 64) {
				return sendError(res, 'Invalid setting key', 400, 'SETTING_KEY_INVALID');
			}
			// P0 fix 2026-07-12: per-key validation. Previously the body
			// accepted any non-empty string, so an admin could save
			// "FOO_BAR" as DEFAULT_CURRENCY and break checkout. Now each
			// known key has a typed validator in
			// apps/api/src/lib/settings-validation.ts.
			const canonicalValue = validateSettingValue(key, v.data.value);
			// SECURITY (P0, 2026-07-12): audit-log redaction for
			// sensitive setting values. The literal `value` is NEVER
			// persisted to `admin_audit_log.old_values` /
			// `.new_values` when the setting key matches the
			// sensitive-key patterns in `lib/settings-redact.ts`
			// (e.g. STRIPE_SECRET_KEY, SMTP_PASSWORD, *_API_KEY).
			// The audit row is reduced to `{ value: '[REDACTED]' }` or
			// `{ value: '[unchanged]' }` if the value didn't change.
			const oldValue = await readSettingDirect(key);
			const { old_values, new_values } = diffSettingValue(key, oldValue, canonicalValue);
			await db
				.prepare(
					`INSERT INTO app_settings (key, value, updated_at)
					 VALUES ($1, $2, CURRENT_TIMESTAMP)
					 ON CONFLICT (key) DO UPDATE
					   SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
				)
				.run(key, canonicalValue);
			await writeAuditLog(req, 'set_setting', 'setting', key, old_values, new_values);
			// The HTTP response intentionally echoes back the redacted
			// representation, not the plaintext, so a GET /settings
			// audit log does NOT roundtrip the secret back to the
			// browser cache.
			return sendSuccess(res, {
				key,
				value: redactSettingValue(key, canonicalValue),
			});
		} catch (err) {
			return sendError(res, err);
		}
	},
);

// ─── Orders (with customer/store join) ─────────────────────────────────
//
// The legacy /orders endpoint projects `orders.*` only. The new
// /orders-with-people variant LEFT JOINs `users` + `stores` so the
// admin table can render merchant and customer names without an
// additional API round-trip.

adminExtrasRouter.get('/orders-with-people', ...adminAuth, async (req: Request, res: Response) => {
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
			where.push(`o.status = $${params.length}`);
		}
		if (v.data.payment_status) {
			params.push(v.data.payment_status);
			where.push(`o.payment_status = $${params.length}`);
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const total = (await db
			.prepare(`SELECT COUNT(*)::int AS c FROM orders o ${whereSql}`)
			.get(...params)) as { c: number };
		params.push(v.data.limit, v.data.offset);
		const items = (await db
			.prepare(
				`SELECT o.id, o.order_number, o.customer_id, o.store_id, o.status,
				        o.payment_method, o.payment_status, o.subtotal, o.shipping_cost,
				        o.discount, o.coupon_code, o.discount_amount, o.total, o.currency,
				        o.shipping_address, o.notes, o.tracking_number, o.shipping_company,
				        o.estimated_delivery, o.delivered_at, o.cancelled_at, o.timeline,
				        o.created_at, o.updated_at,
				        cu.full_name AS customer_name, cu.email AS customer_email,
				        cu.phone AS customer_phone,
				        s.store_name
				   FROM orders o
				   LEFT JOIN users cu ON cu.id = o.customer_id
				   LEFT JOIN stores s  ON s.id  = o.store_id
				   ${whereSql}
				  ORDER BY o.created_at DESC
				  LIMIT $${params.length - 1} OFFSET $${params.length}`,
			)
			.all(...params)) as Record<string, unknown>[];
		return sendSuccess(res, { items, total, limit: v.data.limit, offset: v.data.offset });
	} catch (err) {
		return sendError(res, err);
	}
});
