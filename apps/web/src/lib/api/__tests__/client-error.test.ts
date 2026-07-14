/**
 * ApiError code propagation — invariant tests.
 *
 * Verifies that the frontend's `ApiError` correctly carries the
 * machine-readable error `code` (and `request_id`, `details`) from the
 * server's response body, so callers can branch on stable codes
 * (e.g. `if (err.code === 'NOT_FOUND')`) instead of parsing
 * human-readable message strings.
 *
 * Closes the "code propagation" half of P3 backlog item R-15
 * (Standardize error messages). The server-side half lives in
 * `app/server/tests/error-codes.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../client';

// Minimal fetch stub — ApiError construction is what we're testing;
// we exercise apiRequest's error path by mocking `fetch` per test.
const originalFetch = globalThis.fetch;

describe('ApiError carries server-supplied fields', () => {
	beforeEach(() => {
		// localStorage isn't needed for these tests because the
		// failing requests never carry a token (we mock fetch
		// directly). But apiRequest() reads `window.localStorage`
		// synchronously; provide a no-op shim so happy-dom doesn't
		// complain in jsdom-less mode.
		if (typeof window !== 'undefined' && !window.localStorage) {
			Object.defineProperty(window, 'localStorage', {
				value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
				configurable: true,
			});
		}
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function mockFetchResponse(body: unknown, status = 500, headers: Record<string, string> = {}) {
		globalThis.fetch = vi.fn(async () => {
			return new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json', ...headers },
			});
		}) as unknown as typeof fetch;
	}

	it('captures `code` from the server response', async () => {
		mockFetchResponse(
			{
				success: false,
				error: 'User not found',
				code: 'NOT_FOUND',
				request_id: 'req-abc-123',
			},
			404,
		);

		// Lazy import so the module-level fetch wrapper is exercised.
		const { apiRequest } = await import('../client');
		try {
			await apiRequest('/users/999');
			expect.fail('apiRequest should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(ApiError);
			const e = err as ApiError;
			expect(e.status).toBe(404);
			expect(e.code).toBe('NOT_FOUND');
			expect(e.message).toBe('User not found');
			expect(e.request_id).toBe('req-abc-123');
		}
	});

	it('captures `details` for Zod-style failures', async () => {
		mockFetchResponse(
			{
				success: false,
				error: 'Invalid input.',
				code: 'VALIDATION_ERROR',
				details: [
					{ path: 'email', message: 'Invalid email' },
					{ path: 'password', message: 'Too short' },
				],
				request_id: 'req-xyz-789',
			},
			400,
		);

		const { apiRequest } = await import('../client');
		try {
			await apiRequest('/auth/register', { method: 'POST', body: '{}' });
			expect.fail('apiRequest should have thrown');
		} catch (err) {
			const e = err as ApiError;
			expect(e.code).toBe('VALIDATION_ERROR');
			expect(e.details).toEqual([
				{ path: 'email', message: 'Invalid email' },
				{ path: 'password', message: 'Too short' },
			]);
		}
	});

	it('falls back to a generic message + status when the server omits `code`', async () => {
		mockFetchResponse(
			{ success: false, error: 'something went wrong' },
			500,
		);

		const { apiRequest } = await import('../client');
		try {
			await apiRequest('/anything');
			expect.fail('apiRequest should have thrown');
		} catch (err) {
			const e = err as ApiError;
			expect(e.status).toBe(500);
			expect(e.message).toBe('something went wrong');
			expect(e.code).toBeUndefined();
			expect(e.request_id).toBeUndefined();
		}
	});

	it('uses the default message when the server sends no `error` field', async () => {
		mockFetchResponse({ success: false }, 500);

		const { apiRequest } = await import('../client');
		try {
			await apiRequest('/anything');
			expect.fail('apiRequest should have thrown');
		} catch (err) {
			const e = err as ApiError;
			expect(e.message).toBe('Request failed');
			expect(e.status).toBe(500);
		}
	});
});
