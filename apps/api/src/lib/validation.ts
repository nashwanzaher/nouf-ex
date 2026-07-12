/**
 * Zod validation schemas, extracted from `shared.cts` as part of
 * the P0-1 god object refactor (2026-07-03).
 *
 * Contents:
 *   - Password strength helpers (evaluatePasswordStrength + the
 *     primitive detector functions it depends on).
 *   - All shared Zod schemas used by 2+ route files (auth, orders,
 *     reviews, addresses, payments, refunds, coupons, cart, wishlist,
 *     notifications, seller, admin).
 *   - `OrderProductRow` interface + `resolveOrderStoreId` helper
 *     used by the order creation path to derive the store_id from
 *     the items' products (P0-1: the API no longer trusts the
 *     client's `storeId`).
 *   - Coupon *static* helpers (`COUPON_COLUMNS`, `CouponRow` type).
 *     The DB-backed `computeCouponDiscount` helper intentionally
 *     stays in `shared.cts` because it needs the `db` connection,
 *     which would otherwise create a circular import (validation
 *     → shared → validation).
 *   - `validate<T>(schema, body)` — the standard route-level
 *     Zod-validator wrapper extracted from `shared.cts` in
 *     P0-1 phase 7 (2026-07-04). Returns a tagged union so
 *     the caller can branch on `ok` without a try/catch.
 */
import { z } from 'zod';

/**
 * Zod validator that returns a tagged union instead of throwing.
 *
 * Uses `z.ZodSchema` and infers the output type via `z.infer`. The
 * original signature (`z.ZodType<T>`) was too narrow — schemas with
 * `.default(...)` fields have different Output vs Input types, and
 * the constraint would force Output = Input. With `z.ZodSchema`,
 * inference flows through the schema's own `_output` type even when
 * the schema is re-exported across a `.cts` / `.ts` module
 * boundary (which is the case here: every schema is re-exported
 * from `./shared.cts`).
 */
export function validate<T extends z.ZodSchema>(
	schema: T,
	body: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
	const r = schema.safeParse(body);
	return r.success
		? { ok: true, data: r.data }
		: {
				ok: false,
				error: r.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
			};
}

// ── Password strength helpers ────────────────────────────────────────────
//
// SECURITY (C-4, audit 2026-06-30): the previous `passwordSchema`
// accepted any 8-character string including `aaaaaaaa` or `12345678`.
// We now enforce:
//   - length 10..128 (NIST 800-63B minimum)
//   - at least 3 of {lower, upper, digit, symbol}
//   - rejected common / breached passwords (Top-100 shortlist)
//   - rejected email-shaped passwords and exact-email matches
//
// The implementation deliberately avoids a heavy dependency
// (`@zxcvbn-ts/core` ~5 MB WASM) for a server-side hot path. The
// bundled heuristic below catches the bulk of weak passwords the
// previous schema missed. We can swap in zxcvbn-ts later if we
// decide the accuracy gain justifies the dependency.

const COMMON_PASSWORDS = new Set([
	'password',
	'password1',
	'password123',
	'password1234',
	'password!',
	'qwerty',
	'qwerty123',
	'qwertyuiop',
	'iloveyou',
	'admin',
	'admin123',
	'admin1234',
	'admin@123',
	'12345678',
	'123456789',
	'1234567890',
	'12345678910',
	'11111111',
	'00000000',
	'abc12345',
	'abc123456',
	'abcdefgh',
	'abcd1234',
	'welcome',
	'welcome1',
	'welcome123',
	'monkey123',
	'letmein',
	'sunshine',
	'princess',
	'football',
	'baseball',
	'dragon',
	'master',
	'michael',
	'jordan',
	'tigger',
	'shadow',
	'trustno1',
	'hunter2',
	'hunter123',
	'passw0rd',
	'p@ssword',
	'p@ssword1',
	'p@ssw0rd',
	'nopassword',
	'starwars',
	'login',
	'changeme',
	'secret',
	'secret123',
	'mypass',
	'mypassword',
	'mysecret',
]);

function hasLower(s: string): boolean {
	return /[a-z]/.test(s);
}
function hasUpper(s: string): boolean {
	return /[A-Z]/.test(s);
}
function hasDigit(s: string): boolean {
	return /\d/.test(s);
}
function hasSymbol(s: string): boolean {
	return /[^A-Za-z0-9]/.test(s);
}
function classCount(s: string): number {
	return (
		(hasLower(s) ? 1 : 0) +
		(hasUpper(s) ? 1 : 0) +
		(hasDigit(s) ? 1 : 0) +
		(hasSymbol(s) ? 1 : 0)
	);
}
function hasRepeatedRuns(s: string): boolean {
	// 4+ identical chars in a row, e.g. "aaaa", "1111".
	return /(.)\1{3,}/.test(s);
}
function hasSequentialRuns(s: string): boolean {
	// 4+ ascending or descending consecutive chars/digits.
	const lower = s.toLowerCase();
	for (let i = 0; i <= lower.length - 4; i++) {
		const a = lower.charCodeAt(i);
		const b = lower.charCodeAt(i + 1);
		const c = lower.charCodeAt(i + 2);
		const d = lower.charCodeAt(i + 3);
		if (b === a + 1 && c === b + 1 && d === c + 1) return true; // ascending
		if (b === a - 1 && c === b - 1 && d === c - 1) return true; // descending
	}
	return false;
}

/**
 * Returns null if `password` is acceptable, or a human-readable
 * reason string otherwise. Used by Zod's `.refine()` so the failure
 * message surfaces to the client through the standard 400 envelope.
 */
export function evaluatePasswordStrength(password: string, email?: string): string | null {
	if (password.length < 10) {
		return 'Password must be at least 10 characters long.';
	}
	if (password.length > 128) {
		return 'Password must be at most 128 characters long.';
	}
	if (classCount(password) < 3) {
		return 'Password must include at least 3 of: lowercase, uppercase, digit, symbol.';
	}
	if (hasRepeatedRuns(password)) {
		return 'Password contains a repeated character run (e.g. "aaaa").';
	}
	if (hasSequentialRuns(password)) {
		return 'Password contains a sequential run (e.g. "1234" or "abcd").';
	}
	const normalised = password.toLowerCase();
	if (COMMON_PASSWORDS.has(normalised)) {
		return 'Password is too common. Please choose a different one.';
	}
	// Reject if the password EQUALS the local-part of the email (case-
	// insensitive). We deliberately do NOT reject any substring
	// overlap — short local-parts like "strong" or "test" appear in
	// millions of legitimate passphrases, and a strict substring
	// check would produce too many false positives. Equality is
	// the right granularity: `email = a@b`, `password = a` is
	// universally a bad idea.
	if (email) {
		const at = email.indexOf('@');
		const localPart = at > 0 ? email.slice(0, at).toLowerCase() : '';
		if (localPart.length >= 4 && normalised === localPart) {
			return 'Password must not equal your email address.';
		}
	}
	return null;
}

// ── Auth schemas ─────────────────────────────────────────────────────────

export const emailSchema = z.string().email().max(255);

export const passwordSchema = z
	.string()
	.min(10, 'Password must be at least 10 characters long.')
	.max(128, 'Password must be at most 128 characters long.')
	.refine(
		(p) => classCount(p) >= 3,
		'Password must include at least 3 of: lowercase, uppercase, digit, symbol.',
	)
	.refine((p) => !hasRepeatedRuns(p), 'Password contains a repeated character run.')
	.refine(
		(p) => !hasSequentialRuns(p),
		'Password contains a sequential run (e.g. "1234" or "abcd").',
	)
	.refine(
		(p) => !COMMON_PASSWORDS.has(p.toLowerCase()),
		'Password is too common. Please choose a different one.',
	);

export const registerSchema = z
	.object({
		email: emailSchema,
		password: passwordSchema,
		name: z.string().trim().min(2).max(100),
		// G1 fix 2026-07-11: clients can request a 'merchant' role at
		// signup. We also accept 'admin' here as a string so the
		// coercion in auth.ts (line ~52) can silently downgrade it to
		// 'customer' — the API contract is "ask for any role, we keep
		// the safe one". Rejecting 'admin' at parse time would leak the
		// existence of admin-only fields to the client.
		role: z.enum(['customer', 'merchant', 'admin']).optional(),
	})
	.refine((data) => evaluatePasswordStrength(data.password, data.email) === null, {
		message: 'Password does not meet strength requirements.',
		path: ['password'],
	});
export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1).max(128),
});

// ── Orders / order items ─────────────────────────────────────────────────

/**
 * Order item payload from the client.
 *
 * SECURITY (C-1 / P0): pricing fields are intentionally absent. The
 * server resolves the authoritative `unit_price` for each line from
 * the `products` table inside the same transaction that writes the
 * order, so a tampered client body cannot inflate or deflate the
 * charged amount. The legacy `unitPrice` / `totalPrice` keys are
 * rejected explicitly via the strict schema below.
 */
export const orderItemSchema = z
	.object({
		productId: z.number().int().positive(),
		quantity: z.number().int().positive().max(1000),
		variant: z.unknown().optional(),
	})
	.strict();
/**
 * Order payload from the client.
 *
 * SECURITY (C-1): monetary totals (`subtotal`, `shippingCost`,
 * `discount`, `total`) are NEVER read from the request body — the
 * server recomputes them from the items' resolved prices plus the
 * active coupon. We keep `total` optional in the schema purely so
 * clients that still send it don't get a 400; the value is ignored.
 * `.strict()` rejects unknown keys at the top level so we can detect
 * clients that smuggle `subtotal`/`unitPrice` via aliases.
 */
export const orderSchema = z
	.object({
		storeId: z.number().int().positive().optional(),
		items: z.array(orderItemSchema).min(1).max(100),
		shippingAddress: z.record(z.string(), z.unknown()).optional(),
		paymentMethod: z.string().max(50).optional(),
		notes: z.string().max(1000).optional(),
		couponCode: z.string().max(50).optional(),
		// Accepted but ignored — kept for backwards compatibility.
		// Server recomputes these from products.price.
		subtotal: z.number().nonnegative().optional(),
		shippingCost: z.number().nonnegative().optional(),
		discount: z.number().nonnegative().optional(),
		total: z.number().nonnegative().optional(),
	})
	.strict();

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

// ── Reviews ──────────────────────────────────────────────────────────────

export const reviewSchema = z.object({
	productId: z.number().int().positive(),
	storeId: z.number().int().positive().optional(),
	rating: z.number().int().min(1).max(5),
	title: z.string().trim().max(200).optional(),
	comment: z.string().trim().max(2000).optional(),
});

// ── Addresses ────────────────────────────────────────────────────────────

export const addressSchema = z
	.object({
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
	})
	.strict();

/** Self-service profile update. Customers can change their own
 *  name, phone, language, gender, and avatar. Email and role
 *  intentionally NOT updatable here — email changes need a
 *  re-verification flow, and role changes are admin-only
 *  via /api/admin/users/:id. */
export const profileUpdateSchema = z
	.object({
		full_name: z.string().trim().min(2).max(100).optional(),
		phone: z.string().trim().min(5).max(20).optional(),
		avatar: z.string().trim().url().max(500).optional().nullable(),
		preferred_language: z.enum(['ar', 'en', 'zh']).optional(),
		gender: z.enum(['male', 'female', 'other']).nullable().optional(),
	})
	.strict();

/** Self-service password change. The user must send their current
 *  password for verification, and the new password must clear the
 *  standard password policy (8+ chars). Returns 200 on success;
 *  400 on validation failure; 401 on wrong current password. */
export const passwordChangeSchema = z
	.object({
		current_password: z.string().min(1).max(128),
		new_password: passwordSchema,
	})
	.strict();

// ── Payments ─────────────────────────────────────────────────────────────

export const paymentCreateSchema = z.object({
	order_id: z.number().int().positive(),
	amount: z.number().nonnegative(),
	currency: z.string().length(3).default('YER'),
	method: z.enum(['cod', 'card', 'wallet', 'bank_transfer', 'stripe', 'paymob']).default('cod'),
	transaction_id: z.string().trim().max(200).optional(),
});

// ── Refunds ──────────────────────────────────────────────────────────────

export const refundCreateSchema = z.object({
	order_id: z.number().int().positive(),
	amount: z.number().nonnegative(),
	reason: z.string().trim().min(3).max(1000),
});

// ── Coupons ──────────────────────────────────────────────────────────────

export const couponRedeemSchema = z.object({
	code: z.string().trim().min(1).max(50),
	order_subtotal: z.number().nonnegative(),
});

/** Pick the columns we read from the coupons table. Centralised so
 *  the validate and orders paths stay in sync if we add columns. */
export const COUPON_COLUMNS =
	'id, code, type, value, min_order_amount AS min_order, max_discount, usage_limit, usage_count, per_user_limit, starts_at, expires_at';

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
	per_user_limit: number;
	starts_at: string | null;
	expires_at: string | null;
};

// ── Admin (list / pagination) ───────────────────────────────────────────

/** Zod schema for the common `limit/offset` pair used by every
 *  list endpoint. Limit is clamped to [1, 100]. */
export const paginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

// ── Admin (mutations) ───────────────────────────────────────────────────

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
		trust_level: z.enum(['verified', 'golden', 'diamond']).optional(),
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

// ── Storefront (cart / wishlist / notifications) ─────────────────────────

export const cartAddSchema = z
	.object({
		productId: z.number().int().positive(),
		quantity: z.number().int().min(1).max(100),
		variant: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

export const cartItemIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** Body for PATCH /api/cart/:id — update the quantity of an existing
 *  cart line. Stock is checked before the write so the user gets a
 *  clear 400 instead of a trigger error if they overshoot. */
export const cartItemUpdateSchema = z
	.object({
		quantity: z.number().int().positive().max(100),
		variant: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

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

// ── Seller (merchant self-service) ──────────────────────────────────────
//
// C.3 in MASTER_PLAN.md — closes the 12 missing seller endpoints
// documented in phase10_merchant_flow.ps1 §3. The merchant can
// self-manage their store + products + orders + analytics without
// being promoted to admin.
//
// All schemas are `z.strict()` so unknown fields are rejected with
// 400 (consistent with the rest of the API).

/** Body for POST /api/seller/products — full product create.
 *  NOTE: the products table (database/schema.sql) does NOT have `slug`
 *  or `sku` columns — those live on the stores and product_variants
 *  tables respectively. The schema is kept schema-only for fields
 *  the table actually has. The client can still send `slug` (we
 *  ignore it) for forward-compat with future migrations. */
export const sellerProductCreateSchema = z
	.object({
		name_ar: z.string().trim().min(2).max(200),
		name_en: z.string().trim().min(2).max(200).optional(),
		name_zh: z.string().trim().min(2).max(200).optional(),
		category_id: z.number().int().positive(),
		price: z.number().positive(),
		original_price: z.number().positive().optional(),
		stock: z.number().int().nonnegative().default(0),
		description: z.string().trim().max(4000).optional(),
		main_image: z.string().trim().url().optional(),
		features: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
		badges: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
		// `specifications` is the real column in the products table (JSONB).
		specifications: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

/** Body for PATCH /api/seller/products/:id — partial update. */
export const sellerProductUpdateSchema = z
	.object({
		name_ar: z.string().trim().min(2).max(200).optional(),
		name_en: z.string().trim().min(2).max(200).optional(),
		name_zh: z.string().trim().min(2).max(200).optional(),
		sku: z.string().trim().min(1).max(50).optional(),
		price: z.number().nonnegative().optional(),
		original_price: z.number().nonnegative().optional(),
		stock: z.number().int().nonnegative().optional(),
		description: z.string().trim().max(4000).optional(),
		main_image: z.string().trim().url().optional(),
		images: z.array(z.string().trim().url()).max(20).optional(),
		features: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
		badges: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

/** Path params for /api/seller/products/:id */
export const sellerProductIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

/** Body for PATCH /api/seller/stores/:id — merchant edits their own store. */
export const sellerStoreUpdateSchema = z
	.object({
		store_name: z.string().trim().min(2).max(100).optional(),
		name_ar: z.string().trim().min(2).max(100).optional(),
		name_en: z.string().trim().min(2).max(100).optional(),
		description: z.string().trim().max(4000).optional(),
		logo_url: z.string().trim().url().optional(),
		banner_url: z.string().trim().url().optional(),
		phone: z.string().trim().min(5).max(20).optional(),
		city: z.string().trim().min(1).max(50).optional(),
		governorate: z.string().trim().min(2).max(50).optional(),
	})
	.strict();

/**
 * Body for POST /api/seller/stores — G2 fix 2026-07-11.
 * A freshly-registered merchant (or a customer who wants to upgrade)
 * creates their first store through this endpoint. The server stamps
 * `owner_id = req.user.id`; the slug is derived from the store name
 * so two stores with the same name never collide.
 */
export const sellerStoreCreateSchema = z
	.object({
		store_name: z.string().trim().min(2).max(100),
		description: z.string().trim().max(4000).optional(),
		governorate: z.string().trim().min(2).max(50).optional(),
		city: z.string().trim().min(1).max(50).optional(),
	})
	.strict();

/** Body for POST /api/seller/orders/:id/status — merchant updates order. */
export const sellerOrderStatusUpdateSchema = z
	.object({
		status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
		tracking_number: z.string().trim().min(3).max(100).optional(),
		note: z.string().trim().max(500).optional(),
	})
	.strict();

/** Body for POST /api/seller/products/:id/images — add image to product. */
export const sellerProductImageAddSchema = z
	.object({
		url: z.string().trim().url(),
		alt_text: z.string().trim().max(200).optional(),
		sort_order: z.number().int().nonnegative().default(0),
		is_primary: z.boolean().default(false),
	})
	.strict();

// ── Admin (Phase 2 — 2026-07-12) ─────────────────────────────────────

/** POST /api/admin/categories — create category. */
export const adminCategoryCreateSchema = z
	.object({
		name_ar: z.string().trim().min(1).max(120),
		name_en: z.string().trim().max(120).optional(),
		name_zh: z.string().trim().max(120).optional(),
		slug: z
			.string()
			.trim()
			.min(1)
			.max(80)
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
		parent_id: z.number().int().positive().optional(),
		icon: z.string().trim().max(120).optional(),
		image: z.string().trim().url().optional(),
		sort_order: z.number().int().nonnegative().default(0),
		is_active: z.boolean().default(true),
	})
	.strict();

/** PATCH /api/admin/categories/:id — partial update. */
export const adminCategoryUpdateSchema = adminCategoryCreateSchema.partial();

/** POST /api/admin/coupons — create coupon. */
export const adminCouponCreateSchema = z
	.object({
		code: z
			.string()
			.trim()
			.min(2)
			.max(40)
			.regex(/^[A-Z0-9_-]+$/i, 'code must be alphanumeric'),
		type: z.enum(['percentage', 'fixed']),
		value: z.number().positive(),
		min_order_amount: z.number().nonnegative().default(0),
		max_discount: z.number().nonnegative().optional(),
		usage_limit: z.number().int().positive().optional(),
		per_user_limit: z.number().int().positive().default(1),
		store_id: z.number().int().positive().optional(),
		starts_at: z.string().datetime().optional(),
		expires_at: z.string().datetime().optional(),
		is_active: z.boolean().default(true),
		description: z.string().trim().max(2000).optional(),
	})
	.strict()
	.refine(
		(v) => !(v.type === 'percentage' && v.value > 100),
		{ message: 'percentage coupon value must be ≤ 100', path: ['value'] },
	)
	.refine(
		(v) =>
			!v.starts_at || !v.expires_at || new Date(v.expires_at) > new Date(v.starts_at),
		{ message: 'expires_at must be after starts_at', path: ['expires_at'] },
	);

/** PATCH /api/admin/coupons/:id — partial update (re-declared manually
 *  because Zod v4 forbids `.partial()` on refined schemas). */
export const adminCouponUpdateSchema = z
	.object({
		code: z
			.string()
			.trim()
			.min(2)
			.max(40)
			.regex(/^[A-Z0-9_-]+$/i, 'code must be alphanumeric')
			.optional(),
		type: z.enum(['percentage', 'fixed']).optional(),
		value: z.number().positive().optional(),
		min_order_amount: z.number().nonnegative().optional(),
		max_discount: z.number().nonnegative().optional(),
		usage_limit: z.number().int().positive().optional(),
		per_user_limit: z.number().int().positive().optional(),
		store_id: z.number().int().positive().optional(),
		starts_at: z.string().datetime().optional(),
		expires_at: z.string().datetime().optional(),
		is_active: z.boolean().optional(),
		description: z.string().trim().max(2000).optional(),
	})
	.strict();

/** POST /api/admin/notifications/broadcast — broadcast to a segment. */
export const adminBroadcastSchema = z
	.object({
		segment: z.enum(['all', 'customers', 'merchants', 'admins']),
		title: z.string().trim().min(1).max(120),
		body: z.string().trim().min(1).max(1000),
		type: z
			.enum(['order', 'message', 'review', 'promo', 'system', 'dispute', 'refund'])
			.default('system'),
	})
	.strict();

/** PATCH /api/admin/settings/:key — set a single app setting. */
export const adminSettingUpdateSchema = z
	.object({ value: z.string().min(1).max(2000) })
	.strict();
