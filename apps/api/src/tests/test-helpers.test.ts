/**
 * Smoke test for the test-token helper.
 *
 * The helper is the foundation for every authenticated request in
 * the route test files; a regression here would silently break
 * ~20 tests across the suite. This file exists only to fail loudly
 * if the helper stops working (e.g. someone refactors the token
 * signing logic without realising the tests depend on it).
 */
import { describe, it, expect } from 'vitest';
import { signTestToken } from './test-token';
import { verifyAuthToken } from '../middleware.js';

describe('signTestToken helper', () => {
	it('produces a token that verifyAuthToken accepts', () => {
		const t = signTestToken({ sub: 42, role: 'customer' });
		expect(typeof t).toBe('string');
		expect(t.split('.').length).toBe(2);
		const payload = verifyAuthToken(t);
		expect(payload).not.toBeNull();
		expect(payload?.sub).toBe(42);
		expect(payload?.role).toBe('customer');
	});

	it('honours the role', () => {
		const t = signTestToken({ sub: 1, role: 'admin' });
		const payload = verifyAuthToken(t);
		expect(payload?.role).toBe('admin');
	});
});
