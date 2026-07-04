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
import { z } from 'zod';
import { PgDb } from '../db/pg-wrapper.cts';
import {
    HttpError,
    log,
    requireAuth,
    requireRole,
    sendError,
    sendSuccess,
} from '../middleware.js';
// `TokenPayload` and `AuthRole` are re-exported from `./types.ts`
// (extracted on 2026-07-03 to break the circular import between this
// file and `middleware.ts`). The re-export preserves the public API
// of this barrel — route files that imported `AuthRole` from here
// continue to work.
export type { AuthRole, TokenPayload } from './types.js';
// Password helpers (`hashPassword`, `verifyPassword`) re-exported
// from `./auth.ts` (extracted 2026-07-03 to break the god object).
export { hashPassword, verifyPassword } from './auth.js';
export { HttpError, log, requireAuth, requireRole, sendError, sendSuccess };

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
// ═══════════════════════════════════════════════════════════
// Password hashing (scrypt, Node built-in) — moved to ./auth.ts
// (god object refactor, 2026-07-03). hashPassword and verifyPassword
// are re-exported at the top of this file (see "./auth.js" import).
// ═══════════════════════════════════════════════════════════
// Rate limiter (DB-backed) — moved to ./ratelimit.ts
// (god object refactor, P0-1 phase 4 on 2026-07-04). The
// `rateLimit` factory and the pre-configured `authLimiter` live
// in ./ratelimit.ts. They are re-exported here so route files
// continue to import everything from one barrel.
//
// Why the lazy import inside `rateLimit(...)`: the limiter body
// references `sendError` and `log`, both of which live in
// middleware.ts (re-exported through shared.cts). Importing them
// at module top-level would re-introduce the same circular
// dependency the type extraction closed. The dynamic `await
// import('./shared.cts')` defers resolution until the limiter
// is actually invoked on a request — past module-load time —
// so the cycle never becomes a real problem.
// ═══════════════════════════════════════════════════════════
export { rateLimit, authLimiter } from './ratelimit.js';

// ═══════════════════════════════════════════════════════════
// Generic helpers
// ═══════════════════════════════════════════════════════════

/** Zod validator that returns a tagged union instead of throwing.
 *
 * Uses `z.ZodSchema` and infers the output type via `z.infer`. The
 * original signature (`z.ZodType<T>`) was too narrow — schemas with
 * `.default(...)` fields have different Output vs Input types, and
 * the constraint would force Output = Input. With `z.ZodSchema`,
 * inference flows through the schema's own `_output` type even when
 * the schema is re-exported across a `.cts` / `.ts` module
 * boundary (which is now the case for every schema: they live in
 * `./validation.ts` and are re-exported from here).
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

// ═══════════════════════════════════════════════════════════
// Audit log (SECURITY DEFINER writer + secret redactor) —
// moved to ./audit.ts (god object refactor, P0-1 phase 5
// on 2026-07-04). `writeAuditLog` and the now-public
// `redactSensitive` helper live there.
//
// The audit module itself uses lazy `await import('./shared.cts')`
// for the structured `log()` so it doesn't reintroduce the
// middleware cycle that the type extraction closed.
// ═══════════════════════════════════════════════════════════
export { writeAuditLog, redactSensitive } from './audit.js';

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
// Shared Zod schemas + helpers (used by 2+ routes)
// ═══════════════════════════════════════════════════════════
// P0-1 phase 3 (2026-07-03): all schemas, password strength
// helpers, the OrderProductRow + resolveOrderStoreId pair, and the
// coupon COLUMN meta have been moved to ./validation.ts.
// `computeCouponDiscount` intentionally stays here because it needs
// the `db` connection, which would otherwise create a circular
// import (validation.ts → shared.cts → validation.ts).
export {
    addressSchema, adminDisputeUpdateSchema, adminOrderStatusSchema,
    adminProductUpdateSchema, adminStoreUpdateSchema, adminUserUpdateSchema, cartAddSchema,
    cartItemIdParamSchema,
    cartItemUpdateSchema, COUPON_COLUMNS, couponRedeemSchema, CouponRow, emailSchema, evaluatePasswordStrength, loginSchema, notificationIdParamSchema, orderItemSchema, OrderProductRow, orderSchema, paginationSchema, passwordChangeSchema, passwordSchema, paymentCreateSchema, profileUpdateSchema, refundCreateSchema, registerSchema, resolveOrderStoreId, ResolveStoreIdResult, reviewSchema, sellerOrderStatusUpdateSchema, sellerProductCreateSchema, sellerProductIdParamSchema, sellerProductImageAddSchema, sellerProductUpdateSchema, sellerStoreUpdateSchema, wishlistAddSchema,
    wishlistItemIdParamSchema
} from './validation.js';

// `computeCouponDiscount` lives here (not in validation.ts) because
// it calls `db` — keeping it out of validation.ts avoids a circular
// import: validation.ts → shared.cts → validation.ts.
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
