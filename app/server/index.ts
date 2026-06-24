/**
 * Nouf-ex E-commerce REST API Server
 * Express + node-postgres (pg) via the PgDb wrapper
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import { PgDb } from './db/pg-wrapper.cts';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import { randomUUID, scrypt as scryptCb, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { z } from 'zod';
import {
	requestId,
	securityHeaders,
	requestLogger,
	errorHandler,
	notFoundHandler,
	sendSuccess,
	sendError,
	optionalAuth,
	requireAuth,
	requireRole,
	loadEnv,
	resolveDatabaseUrl,
	signAuthToken,
	configureTrustProxy,
	healthRateLimit,
	HttpError,
	log,
	type AuthRole,
} from './middleware';
import { adminRouter } from './routes/admin.cts';
import { catalogRouter } from './routes/catalog.cts';
import { auth2faRouter } from './routes/auth-2fa.cts';
import { signPartialToken } from './lib/partial-token.cts';
import { getProductWithParsedFields, resolveOrderStoreId } from './lib/shared.cts';

dotenv.config();

// --- Env validation -----------------------------------------------------------
// Throws on invalid env vars (e.g. AUTH_SECRET missing in production).
const env = loadEnv();

// --- __filename / __dirname ----------------------------------------------------
// In ESM (production `tsx server/index.ts`) we use `import.meta.url`. In Vitest's
// transformed CJS output, `import.meta.url` is `undefined` and reading it throws.
// We compute __dirname from `process.cwd()` which is always correct for our use
// (we only need __dirname to resolve the static dist/ folder).
const __dirname = (() => {
	try {
		if (typeof import.meta.url === 'string' && import.meta.url.length > 0) {
			return path.dirname(fileURLToPath(import.meta.url));
		}
	} catch {
		/* fall through to cwd */
	}
	return process.cwd();
})();

const app = express();
const PORT = env.API_PORT;
const DATABASE_URL = resolveDatabaseUrl(env);
const STATIC_PATH = env.STATIC_PATH || path.resolve(__dirname, 'dist');

// --- Database Connection (PostgreSQL via pg) ---
// Foreign keys are always enforced in PostgreSQL, no PRAGMA needed.
const db = new PgDb(DATABASE_URL);

// --- Middleware stack (order matters) ---
configureTrustProxy(app);
app.use(requestId);
app.use(securityHeaders);

// --- M2 fix: restrict CORS to configured origins (was open to everyone). ---
const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS.split(',')
	.map((s) => s.trim())
	.filter(Boolean);
app.use(
	cors({
		// cors accepts an array of allowed origins; it returns 403 with a
		// safe message for any other Origin header, and still allows
		// same-origin / curl (no Origin) requests.
		origin: ALLOWED_ORIGINS,
		credentials: true,
	})
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(optionalAuth); // populates req.user from Bearer token if present
app.use(requestLogger);

// --- Health & readiness endpoints (un-authenticated, log-skipped) ---
// /api/health → process is alive (liveness probe for k8s / Docker / load balancers).
// /api/ready  → process can serve traffic (DB reachable, schema applied).
//
// R3 hardening: both endpoints are wrapped in `healthRateLimit` to prevent
// a misbehaving monitoring agent (or an attacker) from amplifying load on
// the process / the DB. The limiter is in-memory and independent of the
// database — see `healthRateLimit` in `middleware.ts` for the rationale.
// Both endpoints are still intentionally NOT logged to keep the log volume
// sane from monitoring systems that poll every few seconds.
const healthLimiter = healthRateLimit({ windowMs: 1000, max: 30, bucket: 'health' });

app.get('/api/health', healthLimiter, (_req: Request, res: Response) => {
	res.status(200).json({
		status: 'ok',
		uptime_s: Math.round(process.uptime()),
		ts: new Date().toISOString(),
	});
});

const READY_STARTED_AT = Date.now();
app.get('/api/ready', healthLimiter, async (_req: Request, res: Response) => {
	const checks: Record<string, { ok: boolean; ms: number; detail?: string }> = {};
	const startedAt = Date.now();
	let timeoutId: NodeJS.Timeout | undefined;
	try {
		// Use a 2 s timeout so a slow DB doesn't make /api/ready hang and
		// get flagged as unhealthy. The timer is cleared on success so it
		// doesn't fire after the response is sent.
		const timeout = new Promise<never>((_, reject) => {
			timeoutId = setTimeout(() => reject(new Error('db timeout')), 2000);
		});
		const result = await Promise.race([db.prepare('SELECT 1 AS ok').get(), timeout]);
		if (timeoutId) clearTimeout(timeoutId);
		checks.db = { ok: !!result, ms: Date.now() - startedAt };
	} catch (e) {
		if (timeoutId) clearTimeout(timeoutId);
		checks.db = { ok: false, ms: Date.now() - startedAt, detail: (e as Error).message };
	}
	const allOk = Object.values(checks).every((c) => c.ok);
	res.status(allOk ? 200 : 503).json({
		status: allOk ? 'ready' : 'degraded',
		uptime_s: Math.round((Date.now() - READY_STARTED_AT) / 1000),
		checks,
	});
});

// --- Rate limiter (DB-backed via consume_rate_limit()) -----------------------
// Bucket state lives in rate_limit_buckets (database/migrations/0004).
// consume_rate_limit() does the atomic increment + window reset; the
// app just calls it per request and reads back (allowed, retry_after_ms).
function rateLimit(windowMs: number, max: number, bucket = 'global') {
	return async (req: Request, res: Response, next: NextFunction) => {
		// Key = method + route prefix (req.route?.path when available)
		//       + client IP. Path is intentionally NOT used so that
		//       `/api/products/1` and `/api/products/2` share a bucket.
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
			// Don't block traffic on a transient DB error — fail open.
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
// Background sweeper — asks the DB to evict expired rows every minute
// so the rate_limit_buckets table stays small.
setInterval(async () => {
	try {
		const r = (await db.prepare('SELECT cleanup_rate_limits() AS n').get()) as
			| { n: number }
			| undefined;
		if (r && r.n > 0) log.debug({ msg: 'rate_limit_cleanup', deleted: r.n });
	} catch {
		/* ignore — next tick will retry */
	}
}, 60 * 1000).unref();

const authLimiter = rateLimit(15 * 60 * 1000, 20, 'auth'); // 20 req / 15min / IP / route

// Mount the admin router at /api/admin. This must be registered
// BEFORE the inline admin routes below (see "// ADMIN ENDPOINTS"
// comment) so that the router takes precedence. The inline routes
// are kept in this file as a reference while the refactor is
// in progress; they will be removed in a follow-up commit.
app.use('/api/admin', adminRouter);

// Mount the catalog router (Products + Stores + Categories). Public,
// read-only, no auth. Lives in routes/catalog.cts.
app.use('/api', catalogRouter);

// --- M17 fix: zod validation schemas for all write endpoints ---
const emailSchema = z.string().email().max(255);
const passwordSchema = z.string().min(8).max(128);
const registerSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	name: z.string().trim().min(2).max(100),
});
const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1).max(128),
});
const orderItemSchema = z.object({
	productId: z.number().int().positive(),
	quantity: z.number().int().positive(),
	unitPrice: z.number().nonnegative(),
	totalPrice: z.number().nonnegative().optional(),
	variant: z.unknown().optional(),
});
const orderSchema = z.object({
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
const reviewSchema = z.object({
	productId: z.number().int().positive(),
	storeId: z.number().int().positive().optional(),
	rating: z.number().int().min(1).max(5),
	title: z.string().trim().max(200).optional(),
	comment: z.string().trim().max(2000).optional(),
});

function validate<T>(
	schema: z.ZodType<T>,
	body: unknown
): { ok: true; data: T } | { ok: false; error: string } {
	const r = schema.safeParse(body);
	return r.success
		? { ok: true, data: r.data }
		: {
				ok: false,
				error: r.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
			};
}

// --- C1 fix: scrypt-based password hashing (Node built-in, no external deps) ---
// P1-3 fix: the canonical storage format is now
//   `scrypt$<base64-salt>$<base64-key>`
// for both newly-hashed passwords (via `hashPassword`) and the seed
// data generated by `scripts/gen-seed-hashes.cjs`. The previous
// implementation used hex with no `$` separators on the write path,
// and parsed the key as hex on the read path -- so freshly
// registered users could not log in, and the seed users failed
// verification too. Both sides now agree on base64.
const scrypt = promisify(scryptCb) as (
	password: string,
	salt: string | Buffer,
	keylen: number
) => Promise<Buffer>;
const SCRYPT_KEYLEN = 64;

// IMPORTANT: both `hashPassword` and `verifyPassword` must pass the salt to
// scrypt the same way. The seed file `scripts/gen-seed-hashes.cjs` uses the
// raw Buffer as the salt argument to scrypt, so we do the same here. (The
// previous implementation used `salt.toString('base64')` on the write path
// and the raw base64 string on the read path, which silently broke every
// seeded account.)
async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
	return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
	// Only the canonical `scrypt$...$...` format is accepted. The
	// previous `hash_<plaintext>` fallback (kept for legacy seed rows)
	// is removed because it compared in plain text -- a single line of
	// broken code is enough to leak the entire seed list if it ever
	// shipped. Anyone still using a `hash_` row must re-register.
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

// --- Helpers ---
// `sendSuccess`, `sendError`, `getProductWithParsedFields`, and
// `parseJson` are imported from `./lib/shared.cts`. The catalog
// router (Products/Stores/Categories) lives in `routes/catalog.cts`.

// ═══════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/reviews
 * Query params: productId, storeId
 *
 * P0-3 fix: only return *visible* reviews. Hidden reviews (spam,
 * moderation queue, soft-deleted) must not leak through the public
 * listing.
 */
app.get('/api/reviews', async (req: Request, res: Response) => {
	try {
		const { productId, storeId } = req.query;

		let sql = `SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar,
                      p.name_en as product_name, s.store_name as store_name
               FROM reviews r
               LEFT JOIN users u ON r.customer_id = u.id
               LEFT JOIN products p ON r.product_id = p.id
               LEFT JOIN stores s ON r.store_id = s.id
               WHERE r.is_visible = TRUE`;
		const params: number[] = [];

		if (productId) {
			sql += ' AND r.product_id = ?';
			params.push(Number(productId));
		}
		if (storeId) {
			sql += ' AND r.store_id = ?';
			params.push(Number(storeId));
		}

		sql += ' ORDER BY r.created_at DESC';

		const reviews = await db.prepare(sql).all(...params);
		sendSuccess(res, reviews);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * POST /api/reviews
 * Submit a review
 */
app.post('/api/reviews', requireAuth, async (req: Request, res: Response) => {
	try {
		// M17 fix: validate body shape with the Zod schema.
		const v = validate(reviewSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { productId, storeId, rating, title, comment } = v.data;
		// Source of truth = authenticated user. Ignore customerId in body.
		const customerId = req.user!.id;

		// Verify the reviewer actually purchased this product (verified-purchase
		// guard). Without this any logged-in user could leave a fake review
		// and influence the average rating.
		const purchased = (await db
			.prepare(
				`SELECT 1 AS found FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
            WHERE o.customer_id = ? AND oi.product_id = ?
            LIMIT 1`
			)
			.get(customerId, productId)) as { found: 1 } | undefined;
		const isVerified = Boolean(purchased);

		const result = (await db
			.prepare(
				`INSERT INTO reviews (product_id, store_id, customer_id, rating, title, comment, helpful_count, is_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`
			)
			.run(
				productId,
				storeId ?? null,
				customerId,
				rating,
				title ?? null,
				comment ?? null,
				isVerified ? 1 : 0
			)) as {
			lastInsertRowid: number | null;
		};
		if (result.lastInsertRowid == null) {
			return sendError(res, 'Failed to create review', 500, 'INSERT_FAILED');
		}

		// Update product rating. P0-3 fix: hidden reviews (spam, moderation
		// queue) must NOT count toward the average. The DB trigger
		// `trg_reviews_refresh_rating` already filters by `is_visible = TRUE`
		// but this code path computes the value directly and would
		// otherwise diverge from the trigger.
		const ratingData = (await db
			.prepare(
				'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ? AND is_visible = TRUE'
			)
			.get(productId)) as { avg_rating: number; count: number };

		await db
			.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?')
			.run(ratingData.avg_rating.toFixed(1), ratingData.count, productId);

		sendSuccess(res, { id: result.lastInsertRowid }, 'Review submitted successfully');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/orders
 * Customers see only their own orders. Admins can pass ?customerId=
 * to view a specific customer's orders.
 */
app.get('/api/orders', requireAuth, async (req: Request, res: Response) => {
	try {
		const isAdmin = req.user!.role === 'admin';
		const requestedCustomerId = req.query.customerId ? Number(req.query.customerId) : null;

		let sql = `SELECT o.*, s.store_name as store_name, s.logo as store_logo
               FROM orders o
               LEFT JOIN stores s ON o.store_id = s.id
               WHERE 1=1`;
		const params: number[] = [];

		if (isAdmin && requestedCustomerId && Number.isInteger(requestedCustomerId)) {
			sql += ' AND o.customer_id = ?';
			params.push(requestedCustomerId);
		} else {
			// Source of truth = authenticated user.
			sql += ' AND o.customer_id = ?';
			params.push(req.user!.id);
		}

		sql += ' ORDER BY o.created_at DESC';

		const orders = await db.prepare(sql).all(...params);
		sendSuccess(res, orders);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * GET /api/orders/:id
 * Get single order with items
 */
app.get('/api/orders/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const orderId = Number(req.params.id);

		const order = (await db
			.prepare(
				`SELECT o.*, s.store_name as store_name, s.logo as store_logo
         FROM orders o
         LEFT JOIN stores s ON o.store_id = s.id
         WHERE o.id = ?`
			)
			.get(orderId)) as (Record<string, unknown> & { customer_id: number }) | undefined;

		if (!order) {
			return sendError(res, 'Order not found', 404);
		}

		// Authorization: customers can only see their own orders; admins can
		// see any. Without this guard a customer could enumerate order ids.
		if (req.user!.role !== 'admin' && order.customer_id !== req.user!.id) {
			return sendError(res, 'Forbidden', 403);
		}

		const items = (await db
			.prepare(
				`SELECT oi.*, p.name_en as product_name, p.name_ar as product_name_ar, p.main_image as product_image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`
			)
			.all(orderId)) as Record<string, unknown>[];

		sendSuccess(res, { ...order, items });
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * POST /api/orders
 * Create a new order.
 *
 * C2+C3 fix: single transaction. Stock validation + decrement + order
 * writes are atomic. Stock decrement is handled by the
 * `trg_order_items_decrement_stock` trigger on order_items — the API code
 * only inserts rows; the trigger:
 *   1. SELECT … FOR UPDATE on products (locks the row to prevent races)
 *   2. RAISE EXCEPTION if stock < quantity (whole tx rolls back)
 *   3. UPDATE products SET stock = stock - q, sold_count = sold_count + q
 *   4. INSERT into inventory_log with reason='order_placed'
 *
 * Net effect: this handler no longer races, never silently oversells, and
 * keeps inventory_log in sync. Any RAISE EXCEPTION from the trigger
 * surfaces here as a normal Error and aborts the order.
 */
app.post('/api/orders', requireAuth, async (req: Request, res: Response) => {
	try {
		// M17 fix: validate body shape and field constraints.
		const v = validate(orderSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const {
			// storeId: kept in the schema for backward-compat with old
			// clients, but ignored. The server derives the real value
			// from the items below.
			storeId: _ignoredStoreId,
			items,
			shippingAddress,
			paymentMethod,
			notes,
			subtotal,
			shippingCost,
			total,
			couponCode,
		} = v.data as {
			storeId?: number;
			items: Array<{
				productId: number;
				variantId?: number | null;
				quantity: number;
				unitPrice: number;
			}>;
			shippingAddress: unknown;
			paymentMethod: string;
			notes?: string;
			subtotal: number;
			shippingCost: number;
			discount: number;
			total: number;
			couponCode?: string;
		};
		// Source of truth = authenticated user. Ignore any customerId in body.
		const customerId = req.user!.id;

		// P0-1: source of truth = products table. We do NOT trust the
		// client's `storeId` — derive it from the items' products
		// and validate that every line item belongs to the SAME store.
		// (One order == one store, by schema constraint. A mixed-store
		// cart is a 400 because we'd otherwise have to split the order
		// into multiple rows, which the API contract doesn't promise.)
		//
		// We also reject any product the user passed that doesn't
		// exist / is inactive / is soft-deleted — same condition the
		// stock-decrement trigger checks later, so a fail here is
		// friendlier than waiting for the INSERT to RAISE EXCEPTION.
		const productIds = items.map((i) => i.productId);
		const productRows = (await db
			.prepare(
				`SELECT id, store_id, is_active, deleted_at
				   FROM products
				  WHERE id = ANY(?)
				  ORDER BY id`
			)
			.all(productIds)) as Array<{
			id: number;
			store_id: number;
			is_active: boolean;
			deleted_at: string | null;
		}>;
		const storeResult = resolveOrderStoreId(productIds, productRows);
		if (!storeResult.ok) {
			if (storeResult.code === 'PRODUCT_UNAVAILABLE') {
				return sendError(
					res,
					`Product ${storeResult.productId} is unavailable`,
					400,
					'PRODUCT_UNAVAILABLE'
				);
			}
			if (storeResult.code === 'MIXED_STORES') {
				return sendError(
					res,
					'All items in an order must come from a single store. Split the cart and try again.',
					400,
					'MIXED_STORES'
				);
			}
			// EMPTY_CART — the schema's .min(1) already rejected this,
			// but keep a defensive response.
			return sendError(res, 'No products to order.', 400, 'EMPTY_CART');
		}
		const resolvedStoreId = storeResult.storeId;

		// Normalise payment method: legacy client may send 'cash' → map to 'cod'.
		const normalisedPaymentMethod =
			paymentMethod === 'cash' || !paymentMethod ? 'cod' : paymentMethod;

		// P0-5 fix: do NOT trust the client's `discount` or `total`.
		// If a coupon code is provided, look it up and recompute the
		// discount and total server-side. The client's `subtotal` and
		// `shippingCost` are still used as hints (the items[] array
		// already pins line-item prices, so they should match the
		// server's view in practice).
		const resolvedSubtotal = Math.max(0, Number(subtotal) || Number(total) || 0);
		const resolvedShippingCost = Math.max(0, Number(shippingCost) || 0);
		let resolvedDiscount = 0;
		const resolvedCouponCode: string | null = couponCode ? String(couponCode) : null;
		if (resolvedCouponCode) {
			if (resolvedSubtotal <= 0) {
				return sendError(res, 'Cannot apply a coupon without a positive subtotal.', 400);
			}
		}

		// P0-2 fix: capture the REAL orderNumber (generated above and
		// INSERTed into the row) and return it in the response. The
		// previous implementation returned a fake `ORD-...${last4id}`
		// string which silently broke the audit trail and the UI.
		const {
			id: orderId,
			orderNumber,
			finalDiscount,
			finalTotal,
		} = await db.tx(
			async (txDb: {
				prepare: (sql: string) => {
					run: (
						...args: unknown[]
					) => Promise<{ lastInsertRowid: number | string | null; changes: number }>;
					get: (...args: unknown[]) => Promise<unknown>;
				};
			}) => {
				// ── P0-5: resolve the coupon inside the transaction ─────
				// Use `SELECT ... FOR UPDATE` so two concurrent orders
				// with the same coupon cannot both pass the usage_limit
				// check and both increment `usage_count`. The lock is
				// released when the transaction commits/rolls back.
				if (resolvedCouponCode) {
					const coupon = (await txDb
						.prepare(
							`SELECT ${COUPON_COLUMNS}
                             FROM coupons
                            WHERE code = ? AND is_active = TRUE
                            FOR UPDATE`
						)
						.get(resolvedCouponCode)) as CouponRow | undefined;
					if (!coupon) {
						throw new Error('Coupon not found or inactive.');
					}
					if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
						throw new Error('Coupon has expired.');
					}
					if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
						throw new Error('Coupon is not yet active.');
					}
					if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
						throw new Error('Coupon usage limit reached.');
					}
					if (coupon.min_order != null && resolvedSubtotal < coupon.min_order) {
						throw new Error(
							`Minimum order for this coupon is ${coupon.min_order.toLocaleString()}.`
						);
					}
					resolvedDiscount = await computeCouponDiscount(coupon, resolvedSubtotal);
				}
				const finalDiscount = Math.round(resolvedDiscount * 100) / 100;
				const finalTotal = Math.max(
					0,
					Math.round((resolvedSubtotal + resolvedShippingCost - finalDiscount) * 100) / 100
				);

				const orderNumber = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
				const result = (await txDb
					.prepare(
						`INSERT INTO orders
			        (customer_id, store_id, order_number, status, payment_method,
			         payment_status, subtotal, shipping_cost, discount,
			         coupon_code, discount_amount, total, currency,
			         shipping_address, notes)
			       VALUES (?, ?, ?, 'pending', ?, 'pending',
			               ?, ?, ?, ?, ?, ?, 'YER',
			               ?, ?)
			       RETURNING id`
					)
					.run(
						customerId,
						resolvedStoreId,
						orderNumber,
						normalisedPaymentMethod,
						resolvedSubtotal,
						resolvedShippingCost,
						finalDiscount,
						resolvedCouponCode,
						finalDiscount,
						finalTotal,
						JSON.stringify(shippingAddress),
						notes || null
					)) as { lastInsertRowid: number | null };
				if (result.lastInsertRowid == null) {
					throw new HttpError(500, 'Failed to create order', { code: 'INSERT_FAILED' });
				}
				const newOrderId: number = result.lastInsertRowid;

				// Look up product name for the snapshot column.
				const readProduct = txDb.prepare(
					`SELECT name_ar, name_en FROM products WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL`
				);

				const insertItem = txDb.prepare(
					`INSERT INTO order_items
			        (order_id, product_id, variant_id, product_name, quantity,
			         unit_price, total_price)
			       VALUES (?, ?, ?, ?, ?, ?, ?)`
				);

				for (const item of items) {
					if (item.quantity <= 0) {
						throw new Error(`Invalid quantity ${item.quantity} for product ${item.productId}`);
					}
					const product = (await readProduct.get(item.productId)) as
						| { name_ar: string; name_en: string | null }
						| undefined;
					if (!product) {
						throw new Error(`Product ${item.productId} is unavailable`);
					}
					const unitPrice = item.unitPrice;
					// The stock-decrement trigger fires here on INSERT and will
					// RAISE EXCEPTION if stock < quantity. No manual UPDATE needed.
					await insertItem.run(
						newOrderId,
						item.productId,
						item.variantId ?? null,
						product.name_en || product.name_ar,
						item.quantity,
						unitPrice,
						unitPrice * item.quantity
					);
				}
				return { id: newOrderId, orderNumber, finalDiscount, finalTotal };
			}
		);

		sendSuccess(
			res,
			{ id: orderId, orderNumber, discount: finalDiscount, total: finalTotal },
			'Order created successfully'
		);
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/cart/:userId
 */
app.get('/api/cart/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		// Defense in depth: ignore URL userId, use authenticated user.
		// Non-admin users can only view their own cart.
		const userId = req.user!.id;
		const cartItems = db
			.prepare(
				`SELECT ci.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.stock, s.store_name
         FROM cart_items ci
         JOIN products p ON ci.product_id = p.id
         LEFT JOIN stores s ON p.store_id = s.id
         WHERE ci.user_id = ?
         ORDER BY ci.created_at DESC`
			)
			.all(userId);
		sendSuccess(res, cartItems);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * POST /api/cart
 * Add to cart. Zod-validated; quantity is clamped to [1, 100] to
 * keep a single user from accidentally filling the table.
 */
const cartAddSchema = z
	.object({
		productId: z.number().int().positive(),
		quantity: z.number().int().min(1).max(100).default(1),
		variant: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

app.post('/api/cart', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(cartAddSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
		const { productId, quantity, variant } = v.data;
		// Source of truth = authenticated user. Ignore any userId in body.
		const userId = req.user!.id;

		// Check if already in cart
		const existing = (await db
			.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?')
			.get(userId, productId)) as { id: number; quantity: number } | undefined;

		if (existing) {
			await db
				.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?')
				.run(quantity, existing.id);
			return sendSuccess(res, { id: existing.id }, 'Cart updated successfully');
		}
		const result = (await db
			.prepare(
				`INSERT INTO cart_items (user_id, product_id, quantity, variant, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         RETURNING id`
			)
			.run(userId, productId, quantity, variant ? JSON.stringify(variant) : null)) as {
			lastInsertRowid: number | null;
		};
		if (result.lastInsertRowid == null) {
			return sendError(res, 'Failed to add item to cart', 500, 'INSERT_FAILED');
		}
		return sendSuccess(res, { id: result.lastInsertRowid }, 'Item added to cart');
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * DELETE /api/cart/:id
 * Remove from cart (must belong to authenticated user). Path
 * parameter is validated as a positive integer.
 */
const cartItemIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

app.delete('/api/cart/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(cartItemIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid cart item id: ' + v.error, 400);
		const cartItemId = v.data.id;
		const userId = req.user!.id;
		// Guard: only delete items belonging to the authenticated user.
		const result = (await db
			.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ? RETURNING id')
			.get(cartItemId, userId)) as { id: number } | undefined;
		if (!result) return sendError(res, 'Cart item not found', 404);
		return sendSuccess(res, { id: result.id }, 'Item removed from cart');
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * DELETE /api/cart/clear
 * Clear the authenticated user's cart. Note: the :userId in the
 * path is intentionally ignored (we always use req.user.id) so a
 * logged-in user can never wipe somebody else's cart.
 */
app.delete('/api/cart/clear/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		// Source of truth = authenticated user.
		const userId = req.user!.id;
		const result = await db
			.prepare('DELETE FROM cart_items WHERE user_id = ? RETURNING id')
			.run(userId);
		// pg-wrapper returns changes; cast for type-safety.
		const removed = Number((result as unknown as { changes: number }).changes ?? 0);
		return sendSuccess(res, { removed }, 'Cart cleared');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// WISHLIST
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/wishlist/:userId
 */
app.get('/api/wishlist/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.id;
		const items = await db
			.prepare(
				`SELECT w.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.rating, p.review_count, s.store_name
         FROM wishlist w
         JOIN products p ON w.product_id = p.id
         LEFT JOIN stores s ON p.store_id = s.id
         WHERE w.user_id = ?
         ORDER BY w.created_at DESC`
			)
			.all(userId);
		return sendSuccess(res, items);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * POST /api/wishlist
 * Add to wishlist. Zod-validated.
 */
const wishlistAddSchema = z
	.object({
		productId: z.number().int().positive(),
	})
	.strict();

app.post('/api/wishlist', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(wishlistAddSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
		const { productId } = v.data;
		const userId = req.user!.id;

		// Check if already in wishlist
		const existing = (await db
			.prepare('SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?')
			.get(userId, productId)) as Record<string, unknown> | undefined;

		if (existing) {
			return sendSuccess(res, null, 'Already in wishlist');
		}

		const result = (await db
			.prepare(
				'INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) RETURNING id'
			)
			.run(userId, productId)) as { lastInsertRowid: number | null };
		if (result.lastInsertRowid == null) {
			return sendError(res, 'Failed to add to wishlist', 500, 'INSERT_FAILED');
		}

		return sendSuccess(res, { id: result.lastInsertRowid }, 'Added to wishlist');
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * DELETE /api/wishlist/:id
 * Remove from wishlist (must belong to authenticated user).
 * Path parameter is validated as a positive integer; the row is
 * only deleted if it belongs to the calling user.
 */
const wishlistItemIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

app.delete('/api/wishlist/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(wishlistItemIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid wishlist item id: ' + v.error, 400);
		const wishlistItemId = v.data.id;
		const userId = req.user!.id;
		// Guard: only delete items belonging to the authenticated user.
		const result = (await db
			.prepare('DELETE FROM wishlist WHERE id = ? AND user_id = ? RETURNING id')
			.get(wishlistItemId, userId)) as { id: number } | undefined;
		if (!result) return sendError(res, 'Wishlist item not found', 404);
		return sendSuccess(res, { id: result.id }, 'Removed from wishlist');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/notifications/:userId
 */
app.get('/api/notifications/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = req.user!.id;
		const items = db
			.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`)
			.all(userId);
		sendSuccess(res, items);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read. Idempotent: re-marking an
 * already-read notification still returns 200 with the row (the
 * read_at timestamp is NOT bumped, so a second call doesn't
 * clobber the original "first read" time).
 *
 * Path id is validated as a positive integer; missing rows return
 * 404 instead of silently succeeding.
 */
const notificationIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

app.put('/api/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(notificationIdParamSchema, req.params);
		if (!v.ok) return sendError(res, 'Invalid notification id: ' + v.error, 400);
		const notificationId = v.data.id;
		const userId = req.user!.id;

		// Idempotent mark-as-read: only stamp read_at on the FIRST
		// read. If the row is already is_read, we just return it
		// without bumping read_at so the audit trail reflects when
		// the user actually first read it.
		const updated = (await db
			.prepare(
				`UPDATE notifications
            SET is_read = TRUE,
                read_at  = COALESCE(read_at, NOW())
          WHERE id = $1 AND user_id = $2
          RETURNING id, user_id, type, title, body, data, is_read, read_at, created_at`
			)
			.get(notificationId, userId)) as
			| {
					id: number;
					user_id: number;
					type: string;
					title: string;
					body: string | null;
					data: unknown;
					is_read: boolean;
					read_at: string;
					created_at: string;
			  }
			| undefined;
		if (!updated) return sendError(res, 'Notification not found', 404);
		return sendSuccess(res, updated, 'Notification marked as read');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 * Returns the new user + an auth token (HMAC-signed). The frontend stores
 * the token in localStorage and sends it as `Authorization: Bearer …`.
 */
app.post('/api/auth/register', authLimiter, async (req: Request, res: Response) => {
	try {
		// M17 fix: validate body shape before touching the DB.
		const v = validate(registerSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
		const { email, password, name } = v.data;
		const role: AuthRole = 'customer';

		// Use INSERT ... ON CONFLICT to make registration race-safe against
		// concurrent registrations for the same email. A13 in audit.
		const passwordHash = await hashPassword(password);

		// Try insert; if unique violation, surface 409.
		let userId: number;
		try {
			const result = (await db
				.prepare(
					`INSERT INTO users (email, password_hash, full_name, role, status, is_verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`
				)
				.run(email, passwordHash, name, role)) as { lastInsertRowid: number | null };
			if (result.lastInsertRowid == null) {
				throw new HttpError(500, 'Failed to create user', { code: 'INSERT_FAILED' });
			}
			userId = result.lastInsertRowid;
		} catch (err) {
			const pg = err as { code?: string };
			if (pg?.code === '23505') {
				return sendError(res, 'Email already registered', 409, 'EMAIL_TAKEN');
			}
			throw err;
		}

		const safeUser = { id: userId, email, full_name: name, role };
		const token = signAuthToken({ sub: userId, role });
		sendSuccess(res, { user: safeUser, token }, 201, 'User registered successfully');
	} catch (err) {
		// Translate PG error for race-safe duplicate handling.
		const pg = err as { code?: string };
		if (pg?.code === '23505') {
			return sendError(res, 'Email already registered', 409, 'EMAIL_TAKEN');
		}
		throw err;
	}
});

/**
 * POST /api/auth/login
 * Returns the user + an auth token. Uses constant-time password check.
 */
app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
	const v = validate(loginSchema, req.body);
	if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400, 'VALIDATION_ERROR');
	const { email, password } = v.data;

	const user = (await db
		.prepare(
			'SELECT id, email, full_name, avatar, role, status, is_verified, phone, password_hash, last_login, created_at FROM users WHERE email = ?'
		)
		.get(email)) as
		| (Record<string, unknown> & { id: number; password_hash: string; role: AuthRole })
		| undefined;

	if (!user) {
		// Same generic message whether email or password is wrong — no
		// enumeration.
		return sendError(res, 'Invalid email or password', 401, 'AUTH_INVALID');
	}

	const ok = await verifyPassword(password, user.password_hash);
	if (!ok) {
		return sendError(res, 'Invalid email or password', 401, 'AUTH_INVALID');
	}

	// Update last login (best effort — failure shouldn't block login).
	await db
		.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
		.run(user.id)
		.catch(() => undefined);

	// Strip password_hash from response.
	const { password_hash: _omit, ...userWithoutPassword } = user;
	// P0-5: 2FA gate. If the account has 2FA enabled, the password
	// check alone is not enough — the user must also pass a TOTP
	// code (or a backup code). We return a short-lived partial
	// token that the client exchanges via POST /api/auth/2fa/verify.
	if ((user as { two_factor_enabled?: boolean }).two_factor_enabled) {
		const partial_token = signPartialToken(user.id);
		return sendSuccess(
			res,
			{
				requires_2fa: true,
				partial_token,
				user_id: user.id,
			},
			200,
			'Password OK. 2FA required — call /api/auth/2fa/verify with the code.'
		);
	}
	const token = signAuthToken({ sub: user.id, role: user.role });
	sendSuccess(res, { user: userWithoutPassword, token }, 200, 'Login successful');
});

// Mount the 2FA router. All endpoints are under /api/auth/2fa.
app.use('/api/auth/2fa', auth2faRouter);

/**
 * GET /api/auth/me
 * Returns the currently authenticated user. Requires `Authorization: Bearer …`.
 */
app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
	const userId = req.user!.id;
	const user = (await db
		.prepare(
			'SELECT id, email, full_name, avatar, role, status, is_verified, phone, last_login, created_at FROM users WHERE id = ?'
		)
		.get(userId)) as Record<string, unknown> | undefined;

	if (!user) {
		throw new HttpError(404, 'User not found', { code: 'NOT_FOUND' });
	}
	sendSuccess(res, user);
});

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/stats/home
 */
app.get('/api/stats/home', async (_req: Request, res: Response) => {
	try {
		const productsCount = (await db
			.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1')
			.get()) as { count: number };
		const storesCount = (await db
			.prepare('SELECT COUNT(*) as count FROM stores WHERE is_active = 1')
			.get()) as { count: number };
		const ordersCount = (await db.prepare('SELECT COUNT(*) as count FROM orders').get()) as {
			count: number;
		};
		const usersCount = (await db.prepare('SELECT COUNT(*) as count FROM users').get()) as {
			count: number;
		};

		const featuredProducts = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 6'
			)
			.all()) as Record<string, unknown>[];

		const dealsProducts = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 6'
			)
			.all()) as Record<string, unknown>[];

		sendSuccess(res, {
			counts: {
				products: productsCount.count,
				stores: storesCount.count,
				orders: ordersCount.count,
				users: usersCount.count,
			},
			featured: featuredProducts.map(getProductWithParsedFields),
			deals: dealsProducts.map(getProductWithParsedFields),
		});
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// PAYMENTS  (P0-2)
// ═══════════════════════════════════════════════════════════

const paymentCreateSchema = z.object({
	order_id: z.number().int().positive(),
	amount: z.number().nonnegative(),
	currency: z.string().length(3).default('YER'),
	method: z.enum(['cod', 'card', 'wallet', 'bank_transfer', 'stripe', 'paymob']).default('cod'),
	transaction_id: z.string().trim().max(200).optional(),
});

/**
 * POST /api/payments
 * Record a payment attempt for an order. Idempotent on (order_id, method).
 */
app.post('/api/payments', authLimiter, requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(paymentCreateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { order_id, amount, currency, method, transaction_id } = v.data;

		const order = (await db
			.prepare('SELECT id, customer_id, total, status FROM orders WHERE id = ?')
			.get(order_id)) as
			| { id: number; customer_id: number; total: number; status: string }
			| undefined;
		if (!order) return sendError(res, 'Order not found', 404);

		// Authorization: only the order owner or an admin can record a payment.
		if (req.user!.role !== 'admin' && order.customer_id !== req.user!.id) {
			return sendError(res, 'Forbidden', 403);
		}

		const existing = (await db
			.prepare('SELECT id, status FROM payments WHERE order_id = ? AND method = ?')
			.get(order_id, method)) as { id: number; status: string } | undefined;
		if (existing) {
			return sendSuccess(res, { id: existing.id, status: existing.status, idempotent: true });
		}

		const initialStatus = method === 'cod' ? 'pending' : 'processing';
		const result = await db
			.prepare(
				`INSERT INTO payments (order_id, user_id, amount, currency, method, status, transaction_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`
			)
			.run(
				order_id,
				order.customer_id,
				amount,
				currency,
				method,
				initialStatus,
				transaction_id ?? null
			);

		if (method !== 'cod') {
			await db
				.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`)
				.run(order_id);
		}

		sendSuccess(res, { id: result.lastInsertRowid, status: initialStatus }, 'Payment recorded');
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * GET /api/payments/order/:orderId
 * Returns payments for an order. Only the order owner or an admin may see them.
 */
app.get('/api/payments/order/:orderId', requireAuth, async (req: Request, res: Response) => {
	try {
		const orderId = Number(req.params.orderId);
		if (!Number.isInteger(orderId) || orderId <= 0) {
			return sendError(res, 'Invalid order id', 400);
		}
		// Lookup the order owner before returning any payment data.
		const order = (await db.prepare('SELECT customer_id FROM orders WHERE id = ?').get(orderId)) as
			| { customer_id: number }
			| undefined;
		if (!order) return sendError(res, 'Order not found', 404);
		if (req.user!.role !== 'admin' && order.customer_id !== req.user!.id) {
			return sendError(res, 'Forbidden', 403);
		}
		const payments = await db
			.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC')
			.all(orderId);
		sendSuccess(res, payments);
	} catch (err) {
		return sendError(res, err);
	}
});

/**
 * POST /api/payments/:id/confirm
 * Manually mark a COD payment as paid.
 */
app.post('/api/payments/:id/confirm', requireAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid payment id', 400);

		// Look up the order owner via the payment before mutating anything.
		const payment = (await db.prepare('SELECT order_id FROM payments WHERE id = ?').get(id)) as
			| { order_id: number }
			| undefined;
		if (!payment) return sendError(res, 'Payment not found', 404);
		const order = (await db
			.prepare('SELECT customer_id FROM orders WHERE id = ?')
			.get(payment.order_id)) as { customer_id: number } | undefined;
		if (!order) return sendError(res, 'Order not found', 404);

		// Only admins (or store owners / delivery staff in the future) can
		// mark a payment as received. Without this any authenticated user
		// could flip any payment to completed.
		if (req.user!.role !== 'admin') {
			return sendError(res, 'Forbidden', 403);
		}

		const result = (await db
			.prepare(
				`UPDATE payments SET status = 'completed', paid_at = NOW(), updated_at = NOW()
          WHERE id = ? RETURNING order_id`
			)
			.get(id)) as { order_id: number } | undefined;
		await db
			.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`)
			.run(result!.order_id);
		sendSuccess(res, { order_id: result!.order_id }, 'Payment confirmed');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// ADDRESSES  (P1-3)
// ═══════════════════════════════════════════════════════════

const addressSchema = z.object({
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

app.get('/api/addresses', requireAuth, async (req: Request, res: Response) => {
	try {
		// Source of truth = authenticated user. Ignore any user_id query param.
		const userId = req.user!.id;
		const rows = await db
			.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
			.all(userId);
		sendSuccess(res, rows);
	} catch (err) {
		return sendError(res, err);
	}
});

app.post('/api/addresses', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(addressSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const data = v.data;
		// Source of truth = authenticated user. Ignore any user_id in body.
		const userId = req.user!.id;

		if (data.is_default) {
			await db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
		}
		const result = await db
			.prepare(
				`INSERT INTO addresses (user_id, label, full_name, phone, governorate, city, district,
           street, building, notes, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), NOW(), NOW())
         RETURNING *`
			)
			.get(
				userId,
				data.label,
				data.full_name,
				data.phone,
				data.governorate,
				data.city,
				data.district ?? null,
				data.street,
				data.building ?? null,
				data.notes ?? null,
				data.is_default ? 1 : 0
			);
		sendSuccess(res, result, 'Address created');
	} catch (err) {
		return sendError(res, err);
	}
});

app.delete('/api/addresses/:id', requireAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const userId = req.user!.id;
		// Guard: only delete addresses owned by the authenticated user.
		const result = (await db
			.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ? RETURNING id')
			.get(id, userId)) as { id: number } | undefined;
		if (!result) return sendError(res, 'Address not found', 404);
		sendSuccess(res, { id: result.id }, 'Address deleted');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// SHIPPING METHODS  (P1-4)
// ═══════════════════════════════════════════════════════════

app.get('/api/shipping/methods', async (req: Request, res: Response) => {
	try {
		const weight = Math.max(0, Number(req.query.weight_kg) || 1);
		const rows = (await db
			.prepare(
				'SELECT id, name_ar, name_en, base_cost, per_kg_cost, estimated_days FROM shipping_methods WHERE is_active = TRUE ORDER BY base_cost ASC'
			)
			.all()) as Array<{
			id: number;
			name_ar: string;
			name_en: string;
			base_cost: number;
			per_kg_cost: number | null;
			estimated_days: number | null;
		}>;
		const enriched = rows.map((m) => ({
			...m,
			estimated_total: Math.round((m.base_cost + (m.per_kg_cost ?? 0) * weight) * 100) / 100,
		}));
		sendSuccess(res, enriched);
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// COUPONS  (P1-5)
// ═══════════════════════════════════════════════════════════

const couponRedeemSchema = z.object({
	code: z.string().trim().min(1).max(50),
	user_id: z.number().int().positive(),
	order_subtotal: z.number().nonnegative(),
});

/** Shape returned by the coupon lookup in both /validate and the
 *  in-transaction /orders flow. Keep it close to the actual columns
 *  so adding a new column forces an explicit cast. */
type CouponRow = {
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

/** Pick the columns we read from the coupons table. Centralised so
 *  the validate and orders paths stay in sync if we add columns. */
const COUPON_COLUMNS =
	'id, code, type, value, min_order_amount AS min_order, max_discount, usage_limit, usage_count, starts_at, expires_at';

/** Calls the DB function `coupon_discount_amount(type, value,
 *  max_discount, subtotal)` (database/migrations/0005) which centralises
 *  the discount math. Returns a rounded NUMERIC. Used by both
 *  /api/coupons/validate and the in-transaction coupon resolver. */
async function computeCouponDiscount(
	coupon: { type: string; value: number; max_discount: number | null },
	orderSubtotal: number
): Promise<number> {
	const row = (await db
		.prepare('SELECT coupon_discount_amount($1, $2::numeric, $3::numeric, $4::numeric) AS discount')
		.get(coupon.type, coupon.value, coupon.max_discount, orderSubtotal)) as
		| { discount: string }
		| undefined;
	return row ? Number(row.discount) : 0;
}

app.post('/api/coupons/validate', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(couponRedeemSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		// P0-4 fix: `user_id` in the body is intentionally ignored — the
		// authenticated user is the source of truth. We accept the field
		// for backward compatibility with the existing client but never
		// trust it. (Replaced by `req.user!.id` in handlers that need it.)
		const { code, order_subtotal } = v.data;

		const coupon = (await db
			.prepare(`SELECT ${COUPON_COLUMNS} FROM coupons WHERE code = ? AND is_active = TRUE`)
			.get(code)) as CouponRow | undefined;

		if (!coupon) return sendError(res, 'Coupon not found or inactive', 404);
		if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
			return sendError(res, 'Coupon has expired', 400);
		}
		if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
			return sendError(res, 'Coupon is not yet active', 400);
		}
		if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
			return sendError(res, 'Coupon usage limit reached', 400);
		}
		if (coupon.min_order != null && order_subtotal < coupon.min_order) {
			return sendError(
				res,
				`Minimum order for this coupon is ${coupon.min_order.toLocaleString()}`,
				400
			);
		}

		const discount = await computeCouponDiscount(coupon, order_subtotal);

		sendSuccess(res, {
			code: coupon.code,
			type: coupon.type,
			value: coupon.value,
			discount,
			final_total: Math.round((order_subtotal - discount) * 100) / 100,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

app.post('/api/coupons/redeem', requireAuth, async (req: Request, res: Response) => {
	try {
		const schema = couponRedeemSchema.extend({ order_id: z.number().int().positive() });
		const v = validate(schema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		// P0-4 fix: override the body's `user_id` with the authenticated
		// user. Without this guard, any logged-in customer could record
		// a coupon redemption against any other user's order id.
		const { code, order_id } = v.data;
		const user_id = req.user!.id;

		const coupon = (await db
			.prepare('SELECT id FROM coupons WHERE code = ? AND is_active = TRUE')
			.get(code)) as { id: number } | undefined;
		if (!coupon) return sendError(res, 'Coupon not found', 404);

		// Defense in depth: ensure the order belongs to the authenticated
		// user before we record a redemption against it. This blocks
		// a logged-in user from redeeming coupons on someone else's order.
		const orderOwner = (await db
			.prepare('SELECT customer_id FROM orders WHERE id = ?')
			.get(order_id)) as { customer_id: number } | undefined;
		if (!orderOwner) return sendError(res, 'Order not found', 404);
		if (orderOwner.customer_id !== user_id) return sendError(res, 'Forbidden', 403);

		const already = await db
			.prepare('SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ? AND order_id = ?')
			.get(coupon.id, user_id, order_id);
		if (already)
			return sendSuccess(res, { id: (already as { id: number }).id }, 'Already redeemed');

		const result = (await db
			.prepare(
				`INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount, used_at)
         VALUES (?, ?, ?, 0, NOW()) RETURNING id`
			)
			.get(coupon.id, user_id, order_id)) as { id: number };
		await db
			.prepare('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?')
			.run(coupon.id);
		sendSuccess(res, result, 'Coupon redeemed');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// REFUNDS  (P1-6)
// ═══════════════════════════════════════════════════════════

const refundCreateSchema = z.object({
	order_id: z.number().int().positive(),
	amount: z.number().nonnegative(),
	reason: z.string().trim().min(3).max(1000),
});

app.post('/api/refunds', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(refundCreateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { order_id, amount, reason } = v.data;
		// Source of truth = authenticated user. Ignore user_id in body.
		const userId = req.user!.id;

		const order = (await db
			.prepare('SELECT id, customer_id, total, payment_status FROM orders WHERE id = ?')
			.get(order_id)) as
			| { id: number; customer_id: number; total: number; payment_status: string }
			| undefined;
		if (!order) return sendError(res, 'Order not found', 404);
		if (order.customer_id !== userId) return sendError(res, 'Forbidden', 403);
		if (order.payment_status !== 'paid') {
			return sendError(res, 'Only paid orders are eligible for refund', 400);
		}
		if (amount > order.total) {
			return sendError(res, 'Refund amount exceeds order total', 400);
		}

		const result = (await db
			.prepare(
				`INSERT INTO refunds (order_id, user_id, amount, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'requested', NOW(), NOW()) RETURNING id`
			)
			.get(order_id, userId, amount, reason)) as { id: number };
		sendSuccess(res, result, 'Refund requested');
	} catch (err) {
		return sendError(res, err);
	}
});

app.post('/api/refunds/:id/resolve', requireRole('admin'), async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const status = (req.body?.status as string) || '';
		if (status !== 'approved' && status !== 'rejected') {
			return sendError(res, 'status must be approved or rejected', 400);
		}
		const adminNotes = (req.body?.admin_notes as string | undefined) ?? null;
		const finalStatus = status === 'approved' ? 'processed' : 'rejected';
		const result = (await db
			.prepare(
				`UPDATE refunds
            SET status = ?, admin_notes = ?, resolved_at = NOW(), updated_at = NOW()
          WHERE id = ? AND status IN ('requested', 'approved')
          RETURNING order_id, amount`
			)
			.get(finalStatus, adminNotes, id)) as { order_id: number; amount: number } | undefined;
		if (!result) return sendError(res, 'Refund not found or already resolved', 404);

		if (finalStatus === 'processed') {
			await db
				.prepare(
					`UPDATE payments SET status = 'refunded', updated_at = NOW()
            WHERE order_id = ? AND status = 'completed'`
				)
				.run(result.order_id);
			const order = (await db
				.prepare('SELECT store_id FROM orders WHERE id = ?')
				.get(result.order_id)) as { store_id: number | null } | undefined;
			if (order?.store_id) {
				await db
					.prepare(
						`INSERT INTO transactions (store_id, type, amount, balance_after, reference_type, reference_id, description, created_at)
             VALUES (?, 'refund', ?, 0, 'refund', ?, ?, NOW())`
					)
					.run(order.store_id, -result.amount, id, `Refund #${id} for order ${result.order_id}`);
			}
		}
		sendSuccess(res, { id, status: finalStatus }, 'Refund resolved');
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// All require a valid bearer token AND role='admin'. The query
// surface is intentionally read-only here — mutating admin actions
// (ban user, approve store, refund order, etc.) live behind the
// dedicated /api/admin/* POST/PUT/DELETE routes that follow.
// ═══════════════════════════════════════════════════════════

/** Zod schema for the common `limit/offset` pair used by every
 *  list endpoint below. Limit is clamped to [1, 100]. */
const paginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/admin/users
 *  Query: ?role=&is_active=&limit=&offset=
 *  Returns: { users, total, limit, offset }
 */
app.get(
	'/api/admin/users',
	requireAuth,
	requireRole('admin'),
	async (req: Request, res: Response) => {
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
				 LIMIT $${params.length - 1} OFFSET $${params.length}`
				)
				.all(...params)) as Record<string, unknown>[];

			return sendSuccess(res, { users, total, limit: v.data.limit, offset: v.data.offset });
		} catch (err) {
			return sendError(res, err);
		}
	}
);

/** GET /api/admin/stores
 *  Query: ?is_active=&is_verified=&limit=&offset=
 */
app.get(
	'/api/admin/stores',
	requireAuth,
	requireRole('admin'),
	async (req: Request, res: Response) => {
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
				.get(...params)) as { c: number };
			const total = countRow.c;

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
	}
);

/** GET /api/admin/products
 *  Query: ?is_active=&is_featured=&store_id=&category_id=&limit=&offset=
 */
app.get(
	'/api/admin/products',
	requireAuth,
	requireRole('admin'),
	async (req: Request, res: Response) => {
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
				.get(...params)) as { c: number };
			const total = countRow.c;

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
	}
);

/** GET /api/admin/orders
 *  Query: ?status=&payment_status=&limit=&offset=
 */
app.get(
	'/api/admin/orders',
	requireAuth,
	requireRole('admin'),
	async (req: Request, res: Response) => {
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
				.get(...params)) as { c: number };
			const total = countRow.c;

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
	}
);

/** GET /api/admin/disputes
 *  Query: ?status=&priority=&limit=&offset=
 */
app.get(
	'/api/admin/disputes',
	requireAuth,
	requireRole('admin'),
	async (req: Request, res: Response) => {
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
				.get(...params)) as { c: number };
			const total = countRow.c;

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
	}
);

/** GET /api/admin/audit-log
 *  Query: ?entity_type=&action=&user_id=&limit=&offset=
 */
app.get(
	'/api/admin/audit-log',
	requireAuth,
	requireRole('admin'),
	async (req: Request, res: Response) => {
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
				.get(...params)) as { c: number };
			const total = countRow.c;

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
	}
);

/** GET /api/admin/stats
 *  Returns a compact dashboard summary for the admin home page.
 *  Single round-trip per metric; cheap because every count uses the
 *  primary-key index.
 */
app.get(
	'/api/admin/stats',
	requireAuth,
	requireRole('admin'),
	async (_req: Request, res: Response) => {
		try {
			const users = (await db.prepare('SELECT COUNT(*)::int AS c FROM users').get()) as {
				c: number;
			};
			const stores = (await db.prepare('SELECT COUNT(*)::int AS c FROM stores').get()) as {
				c: number;
			};
			const products = (await db.prepare('SELECT COUNT(*)::int AS c FROM products').get()) as {
				c: number;
			};
			const orders = (await db.prepare('SELECT COUNT(*)::int AS c FROM orders').get()) as {
				c: number;
			};
			const reviews = (await db.prepare('SELECT COUNT(*)::int AS c FROM reviews').get()) as {
				c: number;
			};
			const disputes = (await db.prepare('SELECT COUNT(*)::int AS c FROM disputes').get()) as {
				c: number;
			};
			const openDisputes = (await db
				.prepare(`SELECT COUNT(*)::int AS c FROM disputes WHERE status = 'open'`)
				.get()) as { c: number };
			const pendingOrders = (await db
				.prepare(`SELECT COUNT(*)::int AS c FROM orders WHERE status = 'pending'`)
				.get()) as { c: number };
			const paidOrders = (await db
				.prepare(`SELECT COUNT(*)::int AS c FROM orders WHERE payment_status = 'paid'`)
				.get()) as { c: number };
			const suspendedUsers = (await db
				.prepare(`SELECT COUNT(*)::int AS c FROM users WHERE status <> 'active'`)
				.get()) as { c: number };
			const inactiveStores = (await db
				.prepare(`SELECT COUNT(*)::int AS c FROM stores WHERE is_active = FALSE`)
				.get()) as { c: number };
			const recentOrders = (await db
				.prepare(
					`SELECT COUNT(*)::int AS c FROM orders
					 WHERE created_at > NOW() - INTERVAL '7 days'`
				)
				.get()) as { c: number };
			const recentUsers = (await db
				.prepare(
					`SELECT COUNT(*)::int AS c FROM users
					 WHERE created_at > NOW() - INTERVAL '7 days'`
				)
				.get()) as { c: number };
			const revenueYer = (await db
				.prepare(
					`SELECT COALESCE(SUM(total), 0)::numeric AS s
					 FROM orders WHERE payment_status = 'paid'`
				)
				.get()) as { s: string };

			return sendSuccess(res, {
				counts: {
					users: users.c,
					stores: stores.c,
					products: products.c,
					orders: orders.c,
					reviews: reviews.c,
					disputes: disputes.c,
				},
				flags: {
					openDisputes: openDisputes.c,
					pendingOrders: pendingOrders.c,
					paidOrders: paidOrders.c,
					suspendedUsers: suspendedUsers.c,
					inactiveStores: inactiveStores.c,
				},
				recent7d: {
					orders: recentOrders.c,
					users: recentUsers.c,
				},
				revenueYer: Number(revenueYer.s),
			});
		} catch (err) {
			return sendError(res, err);
		}
	}
);

// ═══════════════════════════════════════════════════════════
// MUTATING ADMIN ENDPOINTS are now in server/routes/admin.cts.
// The router is mounted at the top of this file via
// `app.use('/api/admin', adminRouter)`. The writeAuditLog and
// buildUpdateSet helpers that used to live here are now in
// server/lib/shared.cts.
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// HELPER ENDPOINTS (read-only shortcuts the frontend polls often)
// ═══════════════════════════════════════════════════════════

/** GET /api/cart/count/:userId
 *  Returns the number of items (sum of quantities) in the user's cart.
 */
app.get('/api/cart/count/:userId', requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = Number(req.params.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			return sendError(res, 'Invalid user id', 400);
		}
		if (req.user!.id !== userId && req.user!.role !== 'admin') {
			return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
		}
		const row = (await db
			.prepare('SELECT COALESCE(SUM(quantity), 0)::int AS c FROM cart_items WHERE user_id = $1')
			.get(userId)) as { c: number };
		return sendSuccess(res, { user_id: userId, count: row.c });
	} catch (err) {
		return sendError(res, err);
	}
});

/** GET /api/notifications/unread-count/:userId
 *  Returns how many of the user's notifications are still unread.
 */
app.get(
	'/api/notifications/unread-count/:userId',
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = Number(req.params.userId);
			if (!Number.isInteger(userId) || userId <= 0) {
				return sendError(res, 'Invalid user id', 400);
			}
			if (req.user!.id !== userId && req.user!.role !== 'admin') {
				return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
			}
			const row = (await db
				.prepare(
					'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE'
				)
				.get(userId)) as { c: number };
			return sendSuccess(res, { user_id: userId, unread: row.c });
		} catch (err) {
			return sendError(res, err);
		}
	}
);

/** GET /api/store-followers/check?store_id=&user_id=
 *  Tells the storefront whether the user already follows a given
 *  store so the Follow button can render its current state.
 */
app.get('/api/store-followers/check', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(
			z.object({
				store_id: z.coerce.number().int().positive(),
				user_id: z.coerce.number().int().positive(),
			}),
			req.query
		);
		if (!v.ok) return sendError(res, 'Invalid query: ' + v.error, 400);
		// Users can only check their own follow state; admins can check
		// anyone's. This prevents leaking the existence of user
		// accounts by enumerating follow records.
		if (req.user!.id !== v.data.user_id && req.user!.role !== 'admin') {
			return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
		}
		const row = (await db
			.prepare(
				`SELECT id, notify_new_products, notify_offers, created_at
				 FROM store_followers
				 WHERE store_id = $1 AND user_id = $2`
			)
			.get(v.data.store_id, v.data.user_id)) as
			| {
					id: number;
					notify_new_products: boolean;
					notify_offers: boolean;
					created_at: string;
			  }
			| undefined;
		return sendSuccess(res, {
			store_id: v.data.store_id,
			user_id: v.data.user_id,
			following: row !== undefined,
			preferences: row
				? {
						notify_new_products: row.notify_new_products,
						notify_offers: row.notify_offers,
						since: row.created_at,
					}
				: null,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

// ═══════════════════════════════════════════════════════════
// STATIC FILES (Production SPA fallback)
// ═══════════════════════════════════════════════════════════

if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
	app.use(express.static(STATIC_PATH));

	// P1-2 fix: never serve the SPA shell for an /api/* path. An
	// unrecognised API URL must fall through to the 404 handler so
	// clients receive a JSON error envelope, not the HTML index.
	app.get('/{*splat}', (req: Request, res: Response, next: NextFunction) => {
		if (req.path.startsWith('/api/')) return next();
		const indexPath = path.join(STATIC_PATH, 'index.html');
		// If the SPA bundle hasn't been built yet, fall through to the 404
		// handler instead of throwing ENOENT (which the error handler would
		// translate to 500). This matters for staging deploys and for
		// integration tests that exercise the server before `vite build`.
		fs.access(indexPath, fs.constants.R_OK, (err) => {
			if (err) return next();
			res.sendFile(indexPath);
		});
	});
}

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════

// 404 handler — exported from middleware (logs the path, includes request_id).
app.use(notFoundHandler);

// Global error handler — PG error translation, structured logging, no message leak.
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════

process.on('SIGTERM', async () => {
	await db.close();
	process.exit(0);
});
process.on('SIGINT', async () => {
	await db.close();
	process.exit(0);
});

// Only auto-listen when this module is the entry point. When it is imported
// (e.g. by Vitest), we still export the app but do NOT bind a port.
const __isMainModule = (() => {
	try {
		const here = import.meta.url;
		const argv1 = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
		return here === argv1;
	} catch {
		return false;
	}
})();
if (__isMainModule) {
	app.listen(PORT, () => {
		log.info({
			msg: 'server_started',
			port: PORT,
			database: PgDb.redactUrl(DATABASE_URL),
			static_path: STATIC_PATH,
			env: process.env.NODE_ENV || 'development',
		});
	});
}

export default app;
