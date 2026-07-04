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
import { NextFunction, Request, Response } from 'express';
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
// Rate limiter (DB-backed, used by auth + payment routes)

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

/** Persist a single admin action into the audit log. Failures are
 *  logged but never block the actual mutation.
 *
 * Implementation note: the actual INSERT goes through a
 * SECURITY DEFINER PL/pgSQL function (write_audit_log) that is owned
 * by noufex_owner. The application role (noufex_app) only has
 * EXECUTE on the function — never INSERT on the table — so it can
 * log legitimate admin actions but cannot forge entries directly.
 *
 * SECURITY (M-9, audit 2026-06-30): the previous implementation
 * swallowed audit failures with a single log.warn(). In production
 * that means a transient DB hiccup during a sensitive admin
 * mutation would leave NO trace — exactly the scenario forensics
 * needs the audit log for. We now retry up to 3 times with
 * exponential backoff, and if every attempt fails we persist the
 * entry into an in-process dead-letter file at
 * `logs/audit-dlq-YYYY-MM-DD.jsonl` so an operator can replay it.
 * The mutation still proceeds — we never block the user-facing
 * action on audit — but the loss is now visible and recoverable
 * instead of silent.
 */
const AUDIT_DLQ_MAX_ATTEMPTS = 3;
const AUDIT_RETRY_BASE_MS = 100; // 100ms, 200ms, 400ms
function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
function todayIsoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * SECURITY (M-7, 2026-07-02): redact sensitive fields from any
 * object before it is persisted. Used by the audit log on both
 * the DB INSERT and the DLQ file. Keys are matched case-insensitive
 * and the redaction is recursive (nested objects are walked).
 * Arrays of objects are also walked. The redactor is deliberately
 * a no-op for `null` / `undefined` / primitives so it can be
 * composed inside any JSON-serialisation pipeline without
 * breaking the shape of the surrounding object.
 */
const REDACT_KEYS = new Set([
	'password',
	'password_hash',
	'passwd',
	'pwd',
	'token',
	'auth_token',
	'access_token',
	'refresh_token',
	'api_key',
	'apikey',
	'secret',
	'client_secret',
	'private_key',
	'cvv',
	'cvc',
	'ssn',
	'authorization',
]);
const REDACT_PLACEHOLDER = '[REDACTED]';
function redactSensitive<T>(input: T): T {
	if (input === null || input === undefined) return input;
	if (Array.isArray(input)) {
		// Recurse into array elements. We must cast here because TS
		// cannot prove the result of a generic map is still T.
		return input.map((item) => redactSensitive(item)) as unknown as T;
	}
	if (typeof input !== 'object') return input;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
		if (REDACT_KEYS.has(k.toLowerCase())) {
			out[k] = REDACT_PLACEHOLDER;
		} else {
			out[k] = redactSensitive(v);
		}
	}
	return out as unknown as T;
}

async function appendAuditDlq(entry: Record<string, unknown>): Promise<void> {
	try {
		const fs = await import('fs');
		const path = await import('path');
		const logsDir = path.resolve(process.cwd(), 'logs');
		if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
		const file = path.join(logsDir, `audit-dlq-${todayIsoDate()}.jsonl`);
		fs.appendFileSync(file, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
		log.error({ msg: 'audit_log_dead_lettered', file });
	} catch (err) {
		log.error({
			msg: 'audit_log_dlq_write_failed',
			error: (err as Error).message,
		});
	}
}

export async function writeAuditLog(
	req: Request,
	action: string,
	entityType: string,
	entityId: number | string,
	oldValues: Record<string, unknown> | null,
	newValues: Record<string, unknown> | null,
): Promise<void> {
	// SECURITY (M-7, 2026-07-02): redact sensitive keys BEFORE the
	// DB INSERT and BEFORE the DLQ file write. Callers that pass a
	// user-update object with password_hash, token, etc. would
	// otherwise leak those values to either the audit log table
	// (readable by the `noufex_app` role) or the DLQ file on disk.
	const safeOld = oldValues ? redactSensitive(oldValues) : null;
	const safeNew = newValues ? redactSensitive(newValues) : null;
	const params = [
		req.user!.id,
		action,
		entityType,
		String(entityId),
		safeOld ? JSON.stringify(safeOld) : null,
		safeNew ? JSON.stringify(safeNew) : null,
		req.ip,
		req.header('user-agent') ?? null,
	];
	let lastError: unknown = null;
	for (let attempt = 1; attempt <= AUDIT_DLQ_MAX_ATTEMPTS; attempt++) {
		try {
			await db
				.prepare(`SELECT write_audit_log($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`)
				.run(...params);
			if (attempt > 1) {
				log.info({
					msg: 'audit_log_recovered',
					attempt,
					entity: entityType,
				});
			}
			return;
		} catch (err) {
			lastError = err;
			log.warn({
				msg: 'audit_log_failed',
				attempt,
				entity: entityType,
				error: (err as Error).message,
			});
			if (attempt < AUDIT_DLQ_MAX_ATTEMPTS) {
				await sleep(AUDIT_RETRY_BASE_MS * 2 ** (attempt - 1));
			}
		}
	}
	// All retries exhausted — dead-letter the entry. The redacted
	// `old_values` / `new_values` go into the file so we still
	// preserve the shape of the audit trail (minus secrets).
	await appendAuditDlq({
		ts: new Date().toISOString(),
		user_id: params[0],
		action: params[1],
		entity_type: params[2],
		entity_id: params[3],
		old_values: params[4],
		new_values: params[5],
		ip: params[6],
		user_agent: params[7],
		error: lastError instanceof Error ? lastError.message : String(lastError),
	});
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
// Shared Zod schemas + helpers (used by 2+ routes)
// ═══════════════════════════════════════════════════════════
// P0-1 phase 3 (2026-07-03): all schemas, password strength
// helpers, the OrderProductRow + resolveOrderStoreId pair, and the
// coupon COLUMN meta have been moved to ./validation.ts.
// `computeCouponDiscount` intentionally stays here because it needs
// the `db` connection, which would otherwise create a circular
// import (validation.ts → shared.cts → validation.ts).
export {
	emailSchema,
	passwordSchema,
	registerSchema,
	loginSchema,
	evaluatePasswordStrength,
	orderItemSchema,
	orderSchema,
	OrderProductRow,
	ResolveStoreIdResult,
	resolveOrderStoreId,
	reviewSchema,
	addressSchema,
	profileUpdateSchema,
	passwordChangeSchema,
	paymentCreateSchema,
	refundCreateSchema,
	couponRedeemSchema,
	COUPON_COLUMNS,
	CouponRow,
	paginationSchema,
	adminUserUpdateSchema,
	adminStoreUpdateSchema,
	adminOrderStatusSchema,
	adminProductUpdateSchema,
	adminDisputeUpdateSchema,
	cartAddSchema,
	cartItemIdParamSchema,
	cartItemUpdateSchema,
	wishlistAddSchema,
	wishlistItemIdParamSchema,
	notificationIdParamSchema,
	sellerProductCreateSchema,
	sellerProductUpdateSchema,
	sellerProductIdParamSchema,
	sellerStoreUpdateSchema,
	sellerOrderStatusUpdateSchema,
	sellerProductImageAddSchema,
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
