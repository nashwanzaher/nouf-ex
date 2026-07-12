/**
 * Audit-log writer + secret redactor, extracted from `shared.cts`
 * as part of the P0-1 god object refactor (Phase 5, 2026-07-04).
 *
 * Two surfaces live here:
 *
 *   1. `writeAuditLog(...)` — persists an admin action via the
 *      SECURITY DEFINER `write_audit_log(...)` PL/pgSQL function.
 *      Failures NEVER block the user-facing mutation, but they
 *      are first retried 3x with exponential backoff, then
 *      dead-lettered to `logs/audit-dlq-YYYY-MM-DD.jsonl` so an
 *      operator can replay them.
 *
 *   2. `redactSensitive(...)` — recursively replaces values for
 *      a known set of secret keys (`password`, `token`, etc.)
 *      with the literal `[REDACTED]` placeholder. Used by the
 *      audit writer on both the DB INSERT and the DLQ file write.
 *
 * SECURITY (M-7, 2026-07-02): redactor runs BEFORE the SQL
 * parameter binding, so the redacted shape (not the raw secret) is
 * what lands in the audit table.
 *
 * NOTE on circular imports: this file imports `db` from
 * `./shared.cts` (top-level — fine because `db` is created
 * synchronously at module-load time and the audit writer only
 * references it inside the async function bodies). The
 * structured `log()` is imported lazily inside `writeAuditLog`
 * and `appendAuditDlq`, the same pattern `ratelimit.ts` uses, to
 * avoid re-introducing the middleware cycle.
 */
import type { Request } from 'express';
import { db } from './shared.ts';

/** Maximum total attempts (initial + retries) before dead-lettering. */
const AUDIT_DLQ_MAX_ATTEMPTS = 3;
/** Base delay; doubles each attempt (100ms, 200ms, 400ms). */
const AUDIT_RETRY_BASE_MS = 100;

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function todayIsoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * SECURITY (M-7, 2026-07-02): keys whose VALUES should never be
 * persisted to the audit log even when the surrounding context is
 * legitimate (e.g. an admin updating a user record includes the
 * password hash in `old_values`). Matched case-insensitive.
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

/**
 * Walk an arbitrary JSON-serialisable value and replace any value
 * whose KEY matches `REDACT_KEYS` with `[REDACTED]`. Recursive on
 * nested objects and arrays. No-op for primitives / `null` /
 * `undefined` so the function composes cleanly with other
 * serialisation pipelines without breaking the shape of the
 * surrounding object.
 *
 * Exported because callers building their own audit payloads (or
 * storing sanitised responses) want the same guarantee.
 */
export function redactSensitive<T>(input: T): T {
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

/**
 * Persist a dead-letter entry to `logs/audit-dlq-YYYY-MM-DD.jsonl`.
 * Failures here are logged but never bubble up — the in-memory
 * caller (writeAuditLog) has already done its best.
 */
async function appendAuditDlq(entry: Record<string, unknown>): Promise<void> {
	try {
		const fs = await import('node:fs');
		const path = await import('node:path');
		const logsDir = path.resolve(process.cwd(), 'logs');
		fs.mkdirSync(logsDir, { recursive: true });
		const file = path.join(logsDir, `audit-dlq-${todayIsoDate()}.jsonl`);
		fs.appendFileSync(file, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
		// Lazy import for `log` to keep the dependency surface
		// explicit (avoids the cycle).
		const { log } = await import('./shared.ts');
		log.error({ msg: 'audit_log_dead_lettered', file });
	} catch (err) {
		const { log } = await import('./shared.ts');
		log.error({
			msg: 'audit_log_dlq_write_failed',
			error: (err as Error).message,
		});
	}
}

/**
 * Persist a single admin action into the audit log. Failures are
 * retried with exponential backoff; on exhaustion the entry is
 * dead-lettered to a JSONL file. The mutation being audited
 * ALWAYS proceeds — audit is an observability concern, not a
 * gate.
 *
 * @param req        Express request (must be authenticated; we
 *                   read `req.user.id`, `req.ip`, and the
 *                   `user-agent` header from it).
 * @param action     Short verb-noun label, e.g. `'user.ban'`,
 *                   `'store.update'`, `'order.refund'`.
 * @param entityType The resource being modified, e.g. `'users'`.
 * @param entityId   The resource's primary key.
 * @param oldValues  Optional object snapshot before the change;
 *                   values for REDACT_KEYS are zeroed out.
 * @param newValues  Optional object snapshot after the change;
 *                   values for REDACT_KEYS are zeroed out.
 */
export async function writeAuditLog(
	req: Request,
	action: string,
	entityType: string,
	entityId: number | string,
	oldValues: Record<string, unknown> | null,
	newValues: Record<string, unknown> | null,
): Promise<void> {
	// SECURITY (M-7): redact sensitive keys BEFORE the DB INSERT
	// and BEFORE the DLQ file write. Callers that pass a user-
	// update object with password_hash, token, etc. would
	// otherwise leak those values to either the audit log table
	// or the DLQ file on disk.
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
				const { log } = await import('./shared.ts');
				log.info({
					msg: 'audit_log_recovered',
					attempt,
					entity: entityType,
				});
			}
			return;
		} catch (err) {
			lastError = err;
			const { log } = await import('./shared.ts');
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
