/**
 * Error helper tests — R-15 follow-up §50.
 *
 * Verifies that the type guards (`isApiError`, `isErrorCode`) correctly
 * narrow `unknown` to `ApiError` / `ErrorCode`. Together with
 * `client-error.test.ts`, this completes the test coverage for the
 * error-propagation layer (server catalog → `ApiError.code` →
 * frontend branching).
 *
 * Runs under the `vitest.dom` project (`include:
 * ['src/**/__tests__/**/*.test.{ts,tsx}']`).
 */

import { describe, expect, it } from 'vitest';
import { ApiError, ErrorCodes, isApiError, isErrorCode } from '../index';

describe('isApiError', () => {
	it('returns true for an ApiError instance', () => {
		const err = new ApiError('Not found', 404, ErrorCodes.NOT_FOUND, 'req-1');
		expect(isApiError(err)).toBe(true);
	});

	it('returns false for a plain Error', () => {
		expect(isApiError(new Error('boom'))).toBe(false);
	});

	it('returns false for a string', () => {
		expect(isApiError('Not found')).toBe(false);
	});

	it('returns false for null and undefined', () => {
		expect(isApiError(null)).toBe(false);
		expect(isApiError(undefined)).toBe(false);
	});

	it('returns false for an arbitrary object', () => {
		expect(isApiError({ status: 404, message: 'fake' })).toBe(false);
	});
});

describe('isErrorCode', () => {
	it('returns true when the value matches the single expected code', () => {
		expect(isErrorCode(ErrorCodes.NOT_FOUND, ErrorCodes.NOT_FOUND)).toBe(true);
		expect(isErrorCode('NOT_FOUND', 'NOT_FOUND')).toBe(true);
	});

	it('returns false when the value differs from the single expected code', () => {
		expect(isErrorCode(ErrorCodes.NOT_FOUND, ErrorCodes.FORBIDDEN)).toBe(false);
		expect(isErrorCode('NOT_FOUND', 'VALIDATION_ERROR')).toBe(false);
	});

	it('returns true when the value is in the expected array', () => {
		const codes = [ErrorCodes.UNAUTHORIZED, ErrorCodes.FORBIDDEN];
		expect(isErrorCode(ErrorCodes.UNAUTHORIZED, codes)).toBe(true);
		expect(isErrorCode('FORBIDDEN', codes)).toBe(true);
	});

	it('returns false when the value is not in the expected array', () => {
		const codes = [ErrorCodes.UNAUTHORIZED, ErrorCodes.FORBIDDEN];
		expect(isErrorCode(ErrorCodes.NOT_FOUND, codes)).toBe(false);
	});

	it('returns false for non-string values (including unknown codes)', () => {
		expect(isErrorCode(404, ErrorCodes.NOT_FOUND)).toBe(false);
		expect(isErrorCode(null, ErrorCodes.NOT_FOUND)).toBe(false);
		expect(isErrorCode(undefined, ErrorCodes.NOT_FOUND)).toBe(false);
		expect(isErrorCode({}, ErrorCodes.NOT_FOUND)).toBe(false);
		// Forward-compat: if the server ships a new code the frontend
		// hasn't seen yet, isErrorCode returns false (caller falls back
		// to the generic-message path).
		expect(isErrorCode('NEW_FUTURE_CODE', ErrorCodes.NOT_FOUND)).toBe(false);
	});

	it('accepts readonly arrays', () => {
		const codes: readonly string[] = [ErrorCodes.UNAUTHORIZED];
		expect(isErrorCode(ErrorCodes.UNAUTHORIZED, codes)).toBe(true);
	});
});

describe('end-to-end: catch + branch pattern', () => {
	it('the recommended usage shape narrows correctly', () => {
		const err: unknown = new ApiError('User not found', 404, ErrorCodes.NOT_FOUND, 'req-abc');

		// The recommended pattern from the client.ts JSDoc.
		if (isApiError(err) && isErrorCode(err.code, ErrorCodes.NOT_FOUND)) {
			// Inside this branch, `err` is typed as `ApiError` and
			// `err.code` is typed as `ErrorCode`.
			expect(err.status).toBe(404);
			expect(err.request_id).toBe('req-abc');
			// The TS compiler narrows `err.code` to `'NOT_FOUND'` here.
			const _exhaustive: 'NOT_FOUND' = err.code;
			expect(_exhaustive).toBe(ErrorCodes.NOT_FOUND);
		} else {
			expect.fail('expected the NOT_FOUND branch to match');
		}
	});

	it('does not match unrelated error codes', () => {
		const err: unknown = new ApiError('Forbidden', 403, ErrorCodes.FORBIDDEN);

		const matched = isApiError(err) && isErrorCode(err.code, [
			ErrorCodes.NOT_FOUND,
			ErrorCodes.UNAUTHORIZED,
		]);

		expect(matched).toBe(false);
	});
});
