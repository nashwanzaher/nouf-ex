/**
 * Shared code used by every route file under `server/routes/`.
 *
 * Centralises:
 *   - The `db` connection (pg-wrapper) so each route file can call
 *     `db.prepare(...).all/get/run` without re-importing it.
 *   - The middleware helpers (`requireAuth`, `requireRole`, `sendSuccess`,
 *     `sendError`, `validate`, `HttpError`, `log`, `AuthRole`).
 *   - Shared Zod schemas used by more than one route (auth, orders,
 *     payments, etc.).
 *   - Helpers that were previously inlined in `server/index.ts`
 *     (`buildUpdateSet`, `writeAuditLog`, `getProductWithParsedFields`).
 *
 * The reason this is a `.cts` file (not `.ts`) is that the rest of the
 * server runtime is loaded as CJS by esbuild. Keeping the extension
 * consistent with `db/pg-wrapper.cts` means the tsx runtime treats
 * this file as CommonJS-by-default and skips the .ts→.cts extension
 * map that bit us earlier with `pg-wrapper.cts`.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PgDb } from '../db/pg-wrapper.cts';
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import {
	requireAuth,
	requireRole,
	sendSuccess,
	sendError,
	HttpError,
	log,
	type AuthRole,
} from '../middleware.js';

// Re-export the pg-wrapper connection so route files have a single
// import surface for "everything I need to talk to the DB".
//
// SECURITY: Never hardcode credentials here. DATABASE_URL must be supplied
// via .env (host) or docker-compose env_file (container). Fail fast at
// module-load time if it is missing — better than silently using a fallback
// that could leak secrets into git history.
const _databaseUrl = process.env.DATABASE_URL;
if (!_databaseUrl) {
    throw new Error(
        'DATABASE_URL is not set. Configure it in .env (local) or via docker-compose env_file (container).',
    );
}
export const db = new PgDb(_databaseUrl);
// `import { requireAuth, sendError, ... } from '../lib/shared.js'`
// so a future refactor of the middleware module doesn't break them.
export { requireAuth, requireRole, sendSuccess, sendError, HttpError, log };
export type { AuthRole };

// ═══════════════════════════════════════════════════════════
// Password hashing (scrypt, Node built-in)
// ═══════════════════════════════════════════════════════════
const scrypt = promisify(scryptCb) as (
	password: string,
	salt: string | Buffer,
	keylen: number,
) => Promise<Buffer>;
const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
	return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	if (!stored.startsWith('scrypt$')) return false;
	const parts = stored.split('$');
	if (parts.length !== 3) return false;
	const [, saltB64, keyB64] = parts;
	const salt = Buffer.from(saltB64, 'base64');
	const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
	const storedKey = Buffer.from(keyB64, 'base64');
	if (derivedKey.length !== storedKey.length) return false;
	return timingSafeEqual(derivedKey, storedKey);
}

// ═══════════════════════════════════════════════════════════
// Rate limiter (DB-backed, used by auth + payment routes)
// ═══════════════════════════════════════════════════════════
export function rateLimit(windowMs: number, max: number, bucket = 'global') {
	return async (req: Request, res: Response, next: NextFunction) => {
		const route = (req.route?.path as string | undefined) || req.path.split('?')[0];
		const ip = req.ip || req.socket.remoteAddress || 'anon';
		const key = `${bucket}:${req.method}:${route}:${ip}`;
		try {
			const row = (await db
				.prepare('SELECT allowed, retry_after_ms FROM consume_rate_limit($1, $2, $3, $4)')
				.get(bucket, key, windowMs, max)) as
				| { allowed: boolean; retry_after_ms: number }
				| undefined;
			if (!row) return next();
			if (!row.allowed) {
				res.setHeader('Retry-After', Math.ceil(row.retry_after_ms / 1000));
				return sendError(res, 'Too many requests. Try again later.', 429, 'RATE_LIMITED');
			}
		} catch (err) {
			log.warn({
				msg: 'rate_limit_db_error',
				bucket,
				route,
				error: (err as Error).message,
			});
		}
		next();
	};
}

export const authLimiter = rateLimit(15 * 60 * 1000, 20, 'auth');

// ═══════════════════════════════════════════════════════════
// Generic helpers
// ═══════════════════════════════════════════════════════════

/** Zod validator that returns a tagged union instead of throwing. */
export function validate<T>(
	schema: z.ZodType<T>,
	body: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
	const r = schema.safeParse(body);
	return r.success
		? { ok: true, data: r.data }
		: {
				ok: false,
				error: r.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
			};
}

/** Builds a dynamic `SET col = $N` list from a partial object. Throws
 *  HttpError(400) when no updateable fields are present. */
export function buildUpdateSet(fields: Record<string, unknown>): {
	sql: string;
	params: unknown[];
} {
	const sets: string[] = [];
	const params: unknown[] = [];
	for (const [k, v] of Object.entries(fields)) {
		params.push(v);
		sets.push(`${k} = $${params.length}`);
	}
	if (sets.length === 0) {
		throw new HttpError(400, 'At least one updateable field must be provided.', {
			code: 'EMPTY_UPDATE',
		});
	}
	return { sql: sets.join(', '), params };
}

/** Persist a single admin action into the audit log. Failures are
 *  logged but never block the actual mutation. */
export async function writeAuditLog(
	req: Request,
	action: string,
	entityType: string,
	entityId: number | string,
	oldValues: Record<string, unknown> | null,
	newValues: Record<string, unknown> | null,
): Promise<void> {
	try {
		await db
			.prepare(
				`INSERT INTO admin_audit_log
				 (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
				 VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
			)
			.run(
				req.user!.id,
				action,
				entityType,
				String(entityId),
				oldValues ? JSON.stringify(oldValues) : null,
				newValues ? JSON.stringify(newValues) : null,
				req.ip,
				req.header('user-agent') ?? null,
			);
	} catch (err) {
		log.warn({ msg: 'audit_log_failed', entity: entityType, error: (err as Error).message });
	}
}

// ═══════════════════════════════════════════════════════════
// JSON helpers (used by product/category/etc. endpoints)
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// Shared Zod schemas (used by 2+ routes)
// ═══════════════════════════════════════════════════════════

// ── Auth ───────────────────────────────────────────────────
export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(128);
export const registerSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	name: z.string().trim().min(2).max(100),
});
export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1).max(128),
});

// ── Orders / order items ───────────────────────────────────
export const orderItemSchema = z.object({
	productId: z.number().int().positive(),
	quantity: z.number().int().positive(),
	unitPrice: z.number().nonnegative(),
	totalPrice: z.number().nonnegative().optional(),
	variant: z.unknown().optional(),
});
export const orderSchema = z.object({
	storeId: z.number().int().positive().optional(),
	items: z.array(orderItemSchema).min(1).max(100),
	shippingAddress: z.record(z.string(), z.unknown()).optional(),
	paymentMethod: z.string().max(50).optional(),
	notes: z.string().max(1000).optional(),
	subtotal: z.number().nonnegative().optional(),
	shippingCost: z.number().nonnegative().optional(),
	discount: z.number().nonnegative().optional(),
	total: z.number().nonnegative(),
});

/** Lightweight product row shape used by resolveOrderStoreId. The
 *  caller passes whatever columns the `SELECT ... FROM products`
 *  query returned — we only read `id`, `store_id`, `is_active`,
 *  and `deleted_at`. Keeping the shape minimal lets the same helper
 *  work in tests (where we construct the rows by hand) and at
 *  runtime (where PgDb returns generic Record<string, unknown>). */
export interface OrderProductRow {
	id: number;
	store_id: number;
	is_active: boolean;
	deleted_at: string | null;
}

/** Resolve the store_id for a new order, server-side, from the
 *  items' products. P0-1: the API no longer trusts the client's
 *  `storeId` field — the server derives it from the products table
 *  and rejects mixed-store carts.
 *
 *  Returns:
 *    { ok: true, storeId }            — every item is from one store
 *    { ok: false, code: 'EMPTY_CART' }          — no products requested
 *    { ok: false, code: 'PRODUCT_UNAVAILABLE', productId } — product
 *            missing, inactive, or soft-deleted
 *    { ok: false, code: 'MIXED_STORES' }        — items span >1 store
 */
export type ResolveStoreIdResult =
	| { ok: true; storeId: number }
	| { ok: false; code: 'EMPTY_CART' }
	| { ok: false; code: 'PRODUCT_UNAVAILABLE'; productId: number }
	| { ok: false; code: 'MIXED_STORES' };

export function resolveOrderStoreId(
	requestedProductIds: number[],
	productRows: OrderProductRow[],
): ResolveStoreIdResult {
	if (requestedProductIds.length === 0) {
		return { ok: false, code: 'EMPTY_CART' };
	}
	const byId = new Map<number, OrderProductRow>();
	for (const p of productRows) byId.set(p.id, p);
	for (const pid of requestedProductIds) {
		const row = byId.get(pid);
		if (!row || !row.is_active || row.deleted_at) {
			return { ok: false, code: 'PRODUCT_UNAVAILABLE', productId: pid };
		}
	}
	const storeIds = new Set(productRows.map((p) => p.store_id));
	if (storeIds.size > 1) {
		return { ok: false, code: 'MIXED_STORES' };
	}
	const first = productRows[0];
	if (!first) {
		// Defensive: requestedProductIds was non-empty but no rows
		// were provided. Treat as empty (shouldn't happen because the
		// caller would have returned PRODUCT_UNAVAILABLE above).
		return { ok: false, code: 'EMPTY_CART' };
	}
	return { ok: true, storeId: first.store_id };
}

// ── Reviews ──────────────────────────────────────────────
export const reviewSchema = z.object({
	productId: z.number().int().positive(),
	storeId: z.number().int().positive().optional(),
	rating: z.number().int().min(1).max(5),
	title: z.string().trim().max(200).optional(),
	comment: z.string().trim().max(2000).optional(),
});

// ── Addresses ────────────────────────────────────────────
export const addressSchema = z.object({
	label: z.string().trim().min(1).max(50),
	full_name: z.string().trim().min(2).max(100),
	phone: z.string().trim().min(5).max(20),
	governorate: z.string().trim().min(2).max(50),
	city: z.string().trim().min(1).max(50),
	district: z.string().trim().max(80).optional(),
	street: z.string().trim().min(2).max(200),
	building: z.string().trim().max(50).optional(),
	notes: z.string().trim().max(500).optional(),
	is_default: z.boolean().optional(),
});

// ── Payments ─────────────────────────────────────────────
export const paymentCreateSchema = z.object({
	order_id: z.number().int().positive(),
	amount: z.number().nonnegative(),
	currency: z.string().length(3).default('YER'),
	method: z.enum(['cod', 'card', 'wallet', 'bank_transfer', 'stripe', 'paymob']).default('cod'),
	transaction_id: z.string().trim().max(200).optional(),
});

// ── Refunds ──────────────────────────────────────────────
export const refundCreateSchema = z.object({
	order_id: z.number().int().positive(),
	amount: z.number().nonnegative(),
	reason: z.string().trim().min(3).max(1000),
});

// ── Coupons ──────────────────────────────────────────────
export const couponRedeemSchema = z.object({
	code: z.string().trim().min(1).max(50),
	user_id: z.number().int().positive(),
	order_subtotal: z.number().nonnegative(),
});

/** Pick the columns we read from the coupons table. Centralised so
 *  the validate and orders paths stay in sync if we add columns. */
export const COUPON_COLUMNS =
	'id, code, type, value, min_order_amount AS min_order, max_discount, usage_limit, usage_count, starts_at, expires_at';

/** Shape returned by the coupon lookup in both /validate and the
 *  in-transaction /orders flow. */
export type CouponRow = {
	id: number;
	code: string;
	type: 'percentage' | 'fixed';
	value: number;
	min_order: number | null;
	max_discount: number | null;
	usage_limit: number | null;
	usage_count: number;
	starts_at: string | null;
	expires_at: string | null;
};

/** Calls the DB function `coupon_discount_amount(type, value,
 *  max_discount, subtotal)` (database/migrations/0005) which centralises
 *  the discount math. */
export async function computeCouponDiscount(
	coupon: { type: string; value: number; max_discount: number | null },
	orderSubtotal: number,
): Promise<number> {
	const row = (await db
		.prepare(
			'SELECT coupon_discount_amount($1, $2::numeric, $3::numeric, $4::numeric) AS discount',
		)
		.get(coupon.type, coupon.value, coupon.max_discount, orderSubtotal)) as
		| { discount: string }
		| undefined;
	return row ? Number(row.discount) : 0;
}

// ── Admin (list / pagination) ───────────────────────────
/** Zod schema for the common `limit/offset` pair used by every
 *  list endpoint. Limit is clamped to [1, 100]. */
export const paginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

// ── Admin (mutations) ───────────────────────────────────
export const adminUserUpdateSchema = z
	.object({
		status: z.enum(['active', 'suspended', 'banned']).optional(),
		role: z.enum(['customer', 'merchant', 'admin']).optional(),
		is_verified: z.boolean().optional(),
		email_verified: z.boolean().optional(),
		phone_verified: z.boolean().optional(),
	})
	.strict();

export const adminStoreUpdateSchema = z
	.object({
		is_active: z.boolean().optional(),
		is_verified: z.boolean().optional(),
		trust_level: z.enum(['verified', 'gold', 'premium']).optional(),
	})
	.strict();

export const adminOrderStatusSchema = z
	.object({
		status: z.enum([
			'pending',
			'confirmed',
			'processing',
			'shipped',
			'delivered',
			'cancelled',
			'refunded',
		]),
		note: z.string().trim().max(500).optional(),
	})
	.strict();

export const adminProductUpdateSchema = z
	.object({
		is_active: z.boolean().optional(),
		is_featured: z.boolean().optional(),
	})
	.strict();

export const adminDisputeUpdateSchema = z
	.object({
		// Matches the disputes_status_check constraint in schema-extra.sql:
		// 'open' → 'investigating' → {resolved_buyer, resolved_seller, closed, rejected}
		status: z.enum([
			'open',
			'investigating',
			'resolved_buyer',
			'resolved_seller',
			'closed',
			'rejected',
		]),
		resolution: z.string().trim().min(3).max(2000).optional(),
		refund_amount: z.number().nonnegative().optional(),
	})
	.strict();

// ── Storefront (cart / wishlist / notifications) ─────────
export const cartAddSchema = z
	.object({
		productId: z.number().int().positive(),
		quantity: z.number().int().min(1).max(100).default(1),
		variant: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

export const cartItemIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const wishlistAddSchema = z
	.object({
		productId: z.number().int().positive(),
	})
	.strict();

export const wishlistItemIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export const notificationIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});
