/**
 * Nouf-ex Frontend — ErrorCodes catalog (mirrors `apps/api/src/lib/error-codes.ts`)
 *
 * **MIRROR FILE.** The frontend cannot import server-side TypeScript
 * directly (different tsconfig roots, different bundler targets), so
 * the canonical catalog lives on the server and we mirror the
 * constant set here. The two MUST stay in sync — the R-15
 * follow-up invariant test in `apps/api/src/tests/error-codes.test.ts`
 * asserts the server catalog stays frozen; this file is the
 * equivalent for the frontend.
 *
 * **Sync rule:** if you add a code to `apps/api/src/lib/error-codes.ts`,
 * add the same key here + the same status in `ErrorStatuses`. Both
 * files share the same SCREAMING_SNAKE_CASE vocabulary by design —
 * the strings are the wire format.
 *
 * Why duplicated instead of shared:
 *   - The server uses CommonJS (.cts) + Node modules; the frontend
 *     uses ESM (.ts) + browser globals. Sharing one source would
 *     require either a build-time codegen step (overkill for a
 *     15-string constant) or a runtime import (impossible across the
 *     network boundary in development).
 *   - The wire format IS the strings, so divergence here would be
 *     caught immediately by the consistency check.
 *
 * For type-safe branching on errors, see `client.ts`:
 *   import { ApiError, isErrorCode, ErrorCodes } from '@/lib/api';
 *   catch (err) {
 *     if (isErrorCode(err, ErrorCodes.NOT_FOUND)) { ... }
 *   }
 */

export const ErrorCodes = {
	// ─── 4xx Client errors ─────────────────────────────────────
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	NOT_FOUND: 'NOT_FOUND',
	CONFLICT: 'CONFLICT',
	DUPLICATE: 'DUPLICATE',
	PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
	UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
	RATE_LIMITED: 'RATE_LIMITED',

	// ─── 5xx Server errors ─────────────────────────────────────
	INTERNAL_ERROR: 'INTERNAL_ERROR',
	DATABASE_ERROR: 'DATABASE_ERROR',
	SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

	// ─── Mutation failures (DB-level) ─────────────────────────
	INSERT_FAILED: 'INSERT_FAILED',
	UPDATE_FAILED: 'UPDATE_FAILED',
	DELETE_FAILED: 'DELETE_FAILED',

	// ─── Feature-specific state-machine codes (added §49) ─────
	ALREADY_ENABLED: 'ALREADY_ENABLED',
	NOT_ENABLED: 'NOT_ENABLED',
	PARTIAL_INVALID: 'PARTIAL_INVALID',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Runtime type guard for `unknown` → `ErrorCode`. Two-argument overload
 * accepts a single expected code OR an array of codes:
 *
 *   if (isErrorCode(err.code)) { ... }                       // narrows to ErrorCode
 *   if (isErrorCode(err.code, ErrorCodes.NOT_FOUND)) { ... }  // exact match
 *   if (isErrorCode(err.code, [ErrorCodes.UNAUTHORIZED,
 *                              ErrorCodes.FORBIDDEN])) { ... } // any-of match
 *
 * This is the SOLE source of truth for both shapes — `client.ts`
 * re-exports it without redefinition so callers can `import { isErrorCode }
 * from '@/lib/api'` regardless of which submodule they intend to use.
 */
export function isErrorCode(value: unknown): value is ErrorCode;
export function isErrorCode(value: unknown, expected: ErrorCode | ErrorCode[]): boolean;
export function isErrorCode(
	value: unknown,
	expected?: ErrorCode | ErrorCode[],
): value is ErrorCode {
	if (typeof value !== 'string') return false as never;
	if (!(value in ErrorCodes)) return false as never;
	if (expected === undefined) return true as never;
	if (Array.isArray(expected)) {
		return (expected as ErrorCode[]).includes(value as ErrorCode);
	}
	return value === expected;
}

/**
 * Default HTTP status for each code (mirrors the server's
 * `ErrorStatuses` table). Used by `ApiError` as the implicit status
 * when the server omits it; also useful for unit tests that
 * construct fake responses.
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
