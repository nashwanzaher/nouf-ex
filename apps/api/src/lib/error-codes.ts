/**
 * Nouf-ex — standardized error codes & canonical messages
 *
 * Centralised catalog of every error code the API can return, plus the
 * user-facing message associated with each one. Used by:
 *
 *   - Route handlers in `server/routes/*.cts` when throwing
 *     `new HttpError(status, msg, { code: ErrorCodes.X })`.
 *   - The global error handler in `server/middleware.ts` to translate
 *     PG / Zod failures into a consistent shape.
 *   - Frontend `ApiError` in `apps/web/src/lib/api/client.ts` (which now
 *     carries `code` so callers can branch on it without parsing strings).
 *
 * Closes P3 backlog item R-15 (Standardize error messages, 3h, 🟢 Medium).
 * See MIGRATION_EXECUTION_PLAN.md §46.
 *
 * Conventions:
 *   - Codes are SCREAMING_SNAKE_CASE strings, ≤ 32 chars.
 *   - Messages are short, lowercase-leading, no trailing punctuation.
 *   - HTTP status is a hint, not the source of truth — the table below
 *     maps code → (status, message) so adding a new error in the future
 *     only requires one edit, not a hunt across 19 route files.
 *
 * Backward compatibility:
 *   - Existing call sites pass `'VALIDATION_ERROR'`, `'NOT_FOUND'`,
 *     `'INSERT_FAILED'`, etc. as string literals — those literals remain
 *     valid keys in this constant, so no route file has to change for
 *     R-15 to ship.
 *   - Tests that do `expect(res.body.code).toBe('FORBIDDEN')` continue
 *     to pass because the constant value IS the string `'FORBIDDEN'`.
 */

export const ErrorCodes = {
	// ─── 4xx Client errors ─────────────────────────────────────
	VALIDATION_ERROR: 'VALIDATION_ERROR', // 400 — Zod failure / bad input
	UNAUTHORIZED: 'UNAUTHORIZED', // 401 — missing or invalid auth token
	FORBIDDEN: 'FORBIDDEN', // 403 — auth ok but role/permission insufficient
	NOT_FOUND: 'NOT_FOUND', // 404 — resource doesn't exist (or not owned by user)
	CONFLICT: 'CONFLICT', // 409 — unique constraint / state machine violation
	DUPLICATE: 'DUPLICATE', // 409 — alias for CONFLICT, kept for semantic clarity
	PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE', // 413 — express.json() limit exceeded
	UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY', // 422 — semantic validation (e.g. stock < qty)
	RATE_LIMITED: 'RATE_LIMITED', // 429 — bucket exceeded

	// ─── 5xx Server errors ─────────────────────────────────────
	INTERNAL_ERROR: 'INTERNAL_ERROR', // 500 — generic catch-all
	DATABASE_ERROR: 'DATABASE_ERROR', // 500 — unrecognised PG error code
	SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE', // 503 — DB unreachable (40P01)

	// ─── Mutation failures (DB-level) ─────────────────────────
	INSERT_FAILED: 'INSERT_FAILED', // 500 — INSERT didn't return a row
	UPDATE_FAILED: 'UPDATE_FAILED', // 500 — UPDATE matched 0 rows
	DELETE_FAILED: 'DELETE_FAILED', // 500 — DELETE matched 0 rows

	// ─── Feature-specific state-machine codes ──────────────────
	// These are still universal in the sense that the frontend can
	// branch on them, but they encode business state rather than
	// generic HTTP semantics. The corresponding status is 409
	// (Conflict) for "already in the target state" patterns.
	ALREADY_ENABLED: 'ALREADY_ENABLED', // 409 — feature flag already on (e.g. 2FA)
	NOT_ENABLED: 'NOT_ENABLED', // 400/409 — prerequisite feature flag is off
	PARTIAL_INVALID: 'PARTIAL_INVALID', // 401 — 2FA partial_token expired/tampered
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Canonical message catalog — keep in sync with `ErrorCodes`. Adding a
 * new code requires also adding its message here (type-checked by the
 * `Record<ErrorCode, string>` type below).
 *
 * Messages are designed to be:
 *   - User-safe (no internal schema details, no SQL fragments)
 *   - Localizable at the frontend via the existing i18n keys
 *     (`errors.*` in `src/i18n/locales/*.json`)
 *   - Stable enough for clients to display verbatim or replace with a
 *     translated version
 */
export const ErrorMessages: Record<ErrorCode, string> = {
	// 4xx
	[ErrorCodes.VALIDATION_ERROR]: 'Invalid input.',
	[ErrorCodes.UNAUTHORIZED]: 'Authentication required.',
	[ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action.',
	[ErrorCodes.NOT_FOUND]: 'Resource not found.',
	[ErrorCodes.CONFLICT]: 'Conflict with the current state.',
	[ErrorCodes.DUPLICATE]: 'This resource already exists.',
	[ErrorCodes.PAYLOAD_TOO_LARGE]: 'Request body too large.',
	[ErrorCodes.UNPROCESSABLE_ENTITY]: 'The request was well-formed but semantically invalid.',
	[ErrorCodes.RATE_LIMITED]: 'Too many requests. Please slow down.',
	// 5xx
	[ErrorCodes.INTERNAL_ERROR]: 'An unexpected error occurred.',
	[ErrorCodes.DATABASE_ERROR]: 'A database error occurred.',
	[ErrorCodes.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable.',
	// Mutations
	[ErrorCodes.INSERT_FAILED]: 'Failed to create the resource.',
	[ErrorCodes.UPDATE_FAILED]: 'Failed to update the resource.',
	[ErrorCodes.DELETE_FAILED]: 'Failed to delete the resource.',
	// Feature-specific state-machine
	[ErrorCodes.ALREADY_ENABLED]: 'This feature is already enabled.',
	[ErrorCodes.NOT_ENABLED]: 'This feature is not enabled.',
	[ErrorCodes.PARTIAL_INVALID]: 'The 2FA partial token is invalid or expired.',
};

/**
 * Suggested HTTP status for each code. The runtime may override (e.g.
 * NOT_FOUND for a soft-delete row → 410 Gone). Use as the default; pass
 * an explicit status to `HttpError` when context requires it.
 */
export const ErrorStatuses: Record<ErrorCode, number> = {
	[ErrorCodes.VALIDATION_ERROR]: 400,
	[ErrorCodes.UNAUTHORIZED]: 401,
	[ErrorCodes.FORBIDDEN]: 403,
	[ErrorCodes.NOT_FOUND]: 404,
	[ErrorCodes.CONFLICT]: 409,
	[ErrorCodes.DUPLICATE]: 409,
	[ErrorCodes.PAYLOAD_TOO_LARGE]: 413,
	[ErrorCodes.UNPROCESSABLE_ENTITY]: 422,
	[ErrorCodes.RATE_LIMITED]: 429,
	[ErrorCodes.INTERNAL_ERROR]: 500,
	[ErrorCodes.DATABASE_ERROR]: 500,
	[ErrorCodes.SERVICE_UNAVAILABLE]: 503,
	[ErrorCodes.INSERT_FAILED]: 500,
	[ErrorCodes.UPDATE_FAILED]: 500,
	[ErrorCodes.DELETE_FAILED]: 500,
	[ErrorCodes.ALREADY_ENABLED]: 409,
	[ErrorCodes.NOT_ENABLED]: 409,
	[ErrorCodes.PARTIAL_INVALID]: 401,
};

/**
 * Type guard for runtime strings. Use when the input source is
 * untrusted (e.g. parsing a code from a request body for a retry):
 *
 *   if (isErrorCode(input.code)) { ... }
 */
export function isErrorCode(value: unknown): value is ErrorCode {
	return typeof value === 'string' && value in ErrorCodes;
}
