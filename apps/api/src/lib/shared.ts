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
 */
import { PgDb } from '../db/pg-wrapper.ts';
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
// Tier 7 R-SUPER-3: helper that returns true for any operator
// role (super_admin + the four functional admin roles). Drop-in
// replacement for `role === 'admin'` after the role-enum migration.
export { isAdminOperator, ADMIN_OPERATOR_ROLES, ADMIN_ROLES } from './types.js';
// Password helpers (`hashPassword`, `verifyPassword`) re-exported
// from `./auth.ts` (extracted 2026-07-03 to break the god object).
export { hashPassword, verifyPassword } from './auth.js';
export { HttpError, log, requireAuth, requireRole, sendError, sendSuccess };
export { ErrorCodes } from './error-codes.js';

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
// middleware.ts (re-exported through shared.ts). Importing them
// at module top-level would re-introduce the same circular
// dependency the type extraction closed. The dynamic `await
// import('./shared.ts')` defers resolution until the limiter
// is actually invoked on a request — past module-load time —
// so the cycle never becomes a real problem.
// ═══════════════════════════════════════════════════════════
export { authLimiter, passwordResetLimiter, rateLimit } from './ratelimit.js';

// ═══════════════════════════════════════════════════════════
// CSRF protection (P0, 2026-07-12) — exported so `index.ts` can
// apply `csrfProtection()` globally and expose
// `csrfTokenEndpoint` on `GET /api/auth/csrf`. The middleware
// itself uses the `x-csrf-token` header + the `noufex_csrf_h`
// HttpOnly cookie; the SPA reads the token from the non-HttpOnly
// `noufex_csrf` cookie that we set on every safe-method request.
// ═══════════════════════════════════════════════════════════
export {
	csrfProtection,
	csrfTokenEndpoint,
	ensureCsrfCookie,
} from './csrf.js';

// ═══════════════════════════════════════════════════════════
// Audit-cleanup scheduler (P0, 2026-07-12) — exported so
// `index.ts` can start it on boot. Configurable via env vars
// (AUDIT_CLEANUP_CRON, AUDIT_CLEANUP_ADMIN_DAYS, etc.). Disabled
// in dev/test by default so developers don't lose audit rows
// unexpectedly.
// ═══════════════════════════════════════════════════════════
export {
	auditCleanupStatus,
	runAuditCleanup,
	startAuditCleanupScheduler,
	stopAuditCleanupScheduler,
} from './audit-scheduler.js';

/** Dedicated limiter for `/api/admin/notifications/broadcast`.
 *
 *  Limit: 10 broadcasts per hour per admin (P0 abuse-prevention).
 *  Even though every broadcast costs 1 row per targeted user, an
 *  admin with a compromised session could otherwise spam thousands
 *  of notifications per minute. This is a per-admin cap (key includes
 *  `req.user.id`) so multiple admins don't share the quota. */
import { rateLimit as _rateLimitFactory } from './ratelimit.js';
export const broadcastLimiter = _rateLimitFactory(
	60 * 60 * 1000,
	10,
	'broadcast',
);

// ═══════════════════════════════════════════════════════════
// Generic helpers
// ═══════════════════════════════════════════════════════════
// P0-1 phase 7 (2026-07-04): the two remaining inline helpers
// in this barrel have been moved out.
//   - `validate<T>(schema, body)` → ./validation.ts (it lives
//     next to the Zod schemas it operates on)
//   - `buildUpdateSet(fields)`    → ./sql-helpers.ts (a thin
//     home for string-built SQL, easy to audit)
export { buildUpdateSet } from './sql-helpers.js';
export { validate } from './validation.js';

// ═══════════════════════════════════════════════════════════
// Audit log (SECURITY DEFINER writer + secret redactor) —
// moved to ./audit.ts (god object refactor, P0-1 phase 5
// on 2026-07-04). `writeAuditLog` and the now-public
// `redactSensitive` helper live there.
//
// The audit module itself uses lazy `await import('./shared.ts')`
// for the structured `log()` so it doesn't reintroduce the
// middleware cycle that the type extraction closed.
// ═══════════════════════════════════════════════════════════
export { redactSensitive, writeAuditLog } from './audit.js';

// ═══════════════════════════════════════════════════════════
// Settings redaction (P0 security, 2026-07-12) — the generic
// `redactSensitive()` walks JSON by KEY name and only masks a fixed
// allow-list of secrets. Settings have the OPPOSITE shape: the KEY is
// the setting name (e.g. `STRIPE_SECRET_KEY`) and the VALUE is what
// gets stored. The helpers in `settings-redact.ts` know which setting
// names are sensitive (by suffix pattern) and produce the audit-safe
// representation (the literal value, or `[REDACTED]`, or `[unchanged]`).
// ═══════════════════════════════════════════════════════════
export {
	SETTING_REDACTED,
	diffSettingValue,
	isSensitiveSettingKey,
	readSettingDirect,
	redactSettingValue,
	writeSettingAudit,
} from './settings-redact.js';

// ═══════════════════════════════════════════════════════════
// JSON helpers (used by product/category/etc. endpoints) —
// moved to ./json.ts (god object refactor, P0-1 phase 6
// on 2026-07-04). `parseJson` and `getProductWithParsedFields`
// live there. Self-contained — they need no DB, middleware,
// or shared-library dependencies; just pure functions on
// `unknown`.
// ═══════════════════════════════════════════════════════════
export { getProductWithParsedFields, parseJson } from './json.js';

// ═══════════════════════════════════════════════════════════
// Shared Zod schemas + helpers (used by 2+ routes)
// ═══════════════════════════════════════════════════════════
// P0-1 phase 3 (2026-07-03): all schemas, password strength
// helpers, the OrderProductRow + resolveOrderStoreId pair, and the
// coupon COLUMN meta have been moved to ./validation.ts.
// `computeCouponDiscount` intentionally stays here because it needs
// the `db` connection, which would otherwise create a circular
// import (validation.ts → shared.ts → validation.ts).
export {
    addressSchema, adminBroadcastSchema, adminCategoryCreateSchema, adminCategoryUpdateSchema,
    adminCouponCreateSchema, adminCouponUpdateSchema, adminDisputeUpdateSchema, adminOrderStatusSchema,
    adminProductUpdateSchema, adminSettingUpdateSchema, adminStoreUpdateSchema, adminUserUpdateSchema, cartAddSchema,
    cartItemIdParamSchema,
    cartItemUpdateSchema, COUPON_COLUMNS, couponRedeemSchema, emailSchema, evaluatePasswordStrength, loginSchema, notificationIdParamSchema, orderItemSchema, orderSchema, paginationSchema, passwordChangeSchema, passwordSchema, paymentCreateSchema, profileUpdateSchema, refundCreateSchema, registerSchema, resolveOrderStoreId, reviewSchema, sellerOrderStatusUpdateSchema, sellerProductCreateSchema, sellerProductIdParamSchema, sellerProductImageAddSchema, sellerProductUpdateSchema, sellerStoreCreateSchema, sellerStoreUpdateSchema, wishlistAddSchema,
    wishlistItemIdParamSchema, type CouponRow, type OrderProductRow, type ResolveStoreIdResult
} from './validation.js';

// `computeCouponDiscount` lives here (not in validation.ts) because
// it calls `db` — keeping it out of validation.ts avoids a circular
// import: validation.ts → shared.ts → validation.ts.
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
