/**
 * Error codes catalog — invariant tests.
 *
 * Ensures the standardized error code catalog (added in R-15) stays
 * self-consistent:
 *   - Every code maps to exactly one canonical message.
 *   - Every code maps to exactly one HTTP status.
 *   - No duplicate codes.
 *   - No empty messages.
 *
 * If a future PR adds a code without a message (or vice versa), this
 * test fails at CI — before the runtime can serve an undefined error
 * to a real user.
 *
 * Runs under the `server` Vitest project (node env). No DB needed.
 */

import { describe, expect, it } from 'vitest';
import {
    ErrorCodes,
    ErrorMessages,
    ErrorStatuses,
    isErrorCode,
    type ErrorCode,
} from '../lib/error-codes';

describe('ErrorCodes catalog', () => {
	it('has no duplicate values', () => {
		const values = Object.values(ErrorCodes);
		const unique = new Set(values);
		expect(unique.size, `duplicate codes found: ${values.join(', ')}`).toBe(values.length);
	});

	it('every code has a non-empty message', () => {
		for (const code of Object.values(ErrorCodes)) {
			const msg = ErrorMessages[code];
			expect(msg, `missing message for code '${code}'`).toBeTruthy();
			expect(msg.length, `empty message for code '${code}'`).toBeGreaterThan(0);
		}
	});

	it('every code has a valid HTTP status (4xx or 5xx)', () => {
		for (const code of Object.values(ErrorCodes)) {
			const status = ErrorStatuses[code];
			expect(status, `missing status for code '${code}'`).toBeDefined();
			expect(status, `status for '${code}' must be >= 400`).toBeGreaterThanOrEqual(400);
			expect(status, `status for '${code}' must be < 600`).toBeLessThan(600);
		}
	});

	it('exposes exactly the codes the frontend ApiError branches on', () => {
		// Lock-in: if a future PR drops a code, the frontend's switch
		// statement in client.ts (if added) would silently fall back.
		// Force the catalog to stay aligned with the canonical set.
		const expected: ErrorCode[] = [
			ErrorCodes.VALIDATION_ERROR,
			ErrorCodes.UNAUTHORIZED,
			ErrorCodes.FORBIDDEN,
			ErrorCodes.NOT_FOUND,
			ErrorCodes.CONFLICT,
			ErrorCodes.DUPLICATE,
			ErrorCodes.PAYLOAD_TOO_LARGE,
			ErrorCodes.UNPROCESSABLE_ENTITY,
			ErrorCodes.RATE_LIMITED,
			ErrorCodes.INTERNAL_ERROR,
			ErrorCodes.DATABASE_ERROR,
			ErrorCodes.SERVICE_UNAVAILABLE,
			ErrorCodes.INSERT_FAILED,
			ErrorCodes.UPDATE_FAILED,
			ErrorCodes.DELETE_FAILED,
		];
		expect(Object.keys(ErrorCodes).sort()).toEqual(expected.sort());
	});

	describe('isErrorCode type guard', () => {
		it('accepts known codes', () => {
			expect(isErrorCode('NOT_FOUND')).toBe(true);
			expect(isErrorCode('VALIDATION_ERROR')).toBe(true);
		});

		it('rejects unknown strings', () => {
			expect(isErrorCode('UNKNOWN_CODE')).toBe(false);
			expect(isErrorCode('')).toBe(false);
		});

		it('rejects non-strings', () => {
			expect(isErrorCode(404)).toBe(false);
			expect(isErrorCode(null)).toBe(false);
			expect(isErrorCode(undefined)).toBe(false);
			expect(isErrorCode({ code: 'NOT_FOUND' })).toBe(false);
		});
	});
});
