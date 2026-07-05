/**
 * error-messages.ts catalog tests (R-15 §52).
 *
 * Verifies that:
 *   - Every `ErrorCode` has a non-empty translation in all 3
 *     supported languages (no missing rows in the catalog).
 *   - `formatApiError` correctly maps a known `err.code` to the
 *     localized message.
 *   - `formatApiError` falls back gracefully when `err.code` is
 *     missing (the server-side §50 invariant requires this).
 *   - `formatApiError` falls back to `DEFAULT_FALLBACK` when neither
 *     `err.code` nor `err.message` is usable.
 *   - `detectLang()` reads from localStorage and falls back to 'ar'.
 *
 * These tests run under the `vitest.dom` project
 * (`include: ['src/**/__tests__/**/*.test.{ts,tsx}']`) and require no
 * network or DB — they're pure unit tests of the catalog + helpers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorCodes } from '../index';
import {
	detectLang,
	formatApiError,
	getErrorMessage,
} from '../error-messages';

describe('error-messages catalog completeness', () => {
	it('has a non-empty translation for every ErrorCode in every language', () => {
		const langs: Array<'ar' | 'en' | 'zh'> = ['ar', 'en', 'zh'];
		const missing: string[] = [];
		for (const code of Object.values(ErrorCodes)) {
			for (const lang of langs) {
				const msg = getErrorMessage(code, lang);
				if (!msg || !msg.trim()) {
					missing.push(`${code}/${lang}`);
				}
			}
		}
		expect(missing, `Missing translations for: ${missing.join(', ')}`).toEqual([]);
	});

	it('all 3 default fallbacks are non-empty', () => {
		const langs: Array<'ar' | 'en' | 'zh'> = ['ar', 'en', 'zh'];
		expect(langs.every((lang) => !!getErrorMessage(undefined, lang).trim())).toBe(true);
	});
});

describe('getErrorMessage', () => {
	it('returns the localized message for known codes', () => {
		expect(getErrorMessage(ErrorCodes.NOT_FOUND, 'ar')).toMatch(/غير موجود/);
		expect(getErrorMessage(ErrorCodes.NOT_FOUND, 'en')).toMatch(/not found/i);
		expect(getErrorMessage(ErrorCodes.NOT_FOUND, 'zh')).toMatch(/未找到/);
	});

	it('returns the default fallback for unknown codes', () => {
		expect(getErrorMessage('NEW_FUTURE_CODE', 'ar')).toMatch(/حدث خطأ/);
		expect(getErrorMessage('NEW_FUTURE_CODE', 'en')).toMatch(/something went wrong/i);
		expect(getErrorMessage('NEW_FUTURE_CODE', 'zh')).toMatch(/出错了/);
	});

	it('returns the default fallback for null/undefined codes', () => {
		expect(getErrorMessage(undefined, 'en')).toMatch(/something went wrong/i);
		expect(getErrorMessage(null, 'en')).toMatch(/something went wrong/i);
	});
});

describe('detectLang', () => {
	beforeEach(() => {
		// Ensure no localStorage bleed between tests
		vi.spyOn(Storage.prototype, 'getItem');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 'ar' when localStorage is unavailable (SSR / private mode)", () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('localStorage blocked');
		});
		expect(detectLang()).toBe('ar');
	});

	it("returns the stored language when it's one of the 3 supported", () => {
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('zh');
		expect(detectLang()).toBe('zh');
	});

	it("returns 'ar' when the stored language is unsupported (e.g. 'fr')", () => {
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('fr');
		expect(detectLang()).toBe('ar');
	});
});

describe('formatApiError', () => {
	it('maps a known ApiError code to the localized message', () => {
		const err = new ApiError('Server message (ignored)', 404, ErrorCodes.NOT_FOUND, 'req-abc');
		expect(formatApiError(err, 'en')).toMatch(/not found/i);
		expect(formatApiError(err, 'ar')).toMatch(/غير موجود/);
	});

	it('falls back to err.message when err.code is missing', () => {
		const err = new Error('Network failed');
		expect(formatApiError(err, 'en')).toBe('Network failed');
	});

	it('falls back to err.message when err.code is unknown (forward-compat per §50)', () => {
		const err = new ApiError('Server says hi', 500, 'NEW_FUTURE_CODE', 'req-1');
		expect(formatApiError(err, 'en')).toBe('Server says hi');
	});

	it('falls back to the default fallback when err is not an Error', () => {
		expect(formatApiError('a string', 'en')).toBe('a string');
		expect(formatApiError(null, 'en')).toMatch(/something went wrong/i);
		expect(formatApiError(undefined, 'en')).toMatch(/something went wrong/i);
		expect(formatApiError({}, 'en')).toMatch(/something went wrong/i);
	});

	it('uses detectLang() when no lang is provided', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('zh');
		const err = new ApiError('Server says hi', 404, ErrorCodes.NOT_FOUND);
		expect(formatApiError(err)).toMatch(/未找到/);
	});

	it('explicit lang override wins over detectLang()', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('zh');
		const err = new ApiError('Server says hi', 404, ErrorCodes.NOT_FOUND);
		expect(formatApiError(err, 'en')).toMatch(/not found/i);
	});

	it('handles array of codes via isErrorCode (the caller pattern)', () => {
		const err = new ApiError('Auth required', 401, ErrorCodes.UNAUTHORIZED);
		// The recommended pattern uses isErrorCode + formatApiError together.
		const { isErrorCode } = await import('../index');
		if (isErrorCode(err.code, [ErrorCodes.UNAUTHORIZED, ErrorCodes.FORBIDDEN])) {
			expect(formatApiError(err, 'en')).toMatch(/sign in/i);
		} else {
			expect.fail('expected auth-related branch');
		}
	});
});
