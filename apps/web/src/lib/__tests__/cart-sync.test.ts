/**
 * Tests for cart-sync.ts — the local↔server cart bridge.
 *
 * Two layers of mocking:
 *   1. localStorage is provided by happy-dom (the test environment).
 *   2. fetch is intercepted by the shared `installFetchSpy` so the
 *      tests can simulate specific responses (success, 401, 5xx).
 *
 * What we cover:
 *   - readLocalCart: empty / missing / corrupt / mixed-shape rows
 *   - clearLocalCart: removes the key, idempotent
 *   - syncLocalCartToServer: pushes each item, fetches server cart,
 *     reports pushed/failed counts, aborts on 401
 *   - syncOnLogin: short-circuits when local is empty, clears local
 *     only when every item pushed, preserves local on degradation
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readLocalCart, clearLocalCart, syncLocalCartToServer, syncOnLogin } from '../cart-sync';
import { installFetchSpy, uninstallFetchSpy } from '../../../mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

// Helper: seed localStorage with a known local cart shape.
function setLocalCart(items: unknown) {
	try {
		localStorage.setItem('noufex_cart', JSON.stringify(items));
	} catch {
		/* happy-dom always provides localStorage but be defensive */
	}
}

beforeEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════
// readLocalCart
// ═══════════════════════════════════════════════════════════════════
describe('readLocalCart', () => {
	it('returns [] when localStorage is empty', () => {
		expect(readLocalCart()).toEqual([]);
	});

	it('returns [] when the stored value is not JSON', () => {
		localStorage.setItem('noufex_cart', 'not json');
		expect(readLocalCart()).toEqual([]);
	});

	it('returns [] when the stored value is not an array', () => {
		localStorage.setItem('noufex_cart', JSON.stringify({ a: 1 }));
		expect(readLocalCart()).toEqual([]);
	});

	it('extracts productId + quantity from a valid array', () => {
		setLocalCart([
			{ productId: '1', quantity: 2, name: 'x', price: 10 },
			{ productId: '5', quantity: 1, name: 'y', price: 20 },
		]);
		expect(readLocalCart()).toEqual([
			{ productId: '1', quantity: 2 },
			{ productId: '5', quantity: 1 },
		]);
	});

	it('skips malformed rows (missing productId or quantity)', () => {
		setLocalCart([
			{ productId: '1', quantity: 1 },
			{ productId: '2' }, // no quantity
			{ quantity: 1 }, // no productId
			null,
			42,
			{ productId: '3', quantity: 0 }, // qty 0 skipped
		]);
		expect(readLocalCart()).toEqual([{ productId: '1', quantity: 1 }]);
	});
});

// ═══════════════════════════════════════════════════════════════════
// clearLocalCart
// ═══════════════════════════════════════════════════════════════════
describe('clearLocalCart', () => {
	it('removes the cart key', () => {
		setLocalCart([{ productId: '1', quantity: 1 }]);
		clearLocalCart();
		expect(localStorage.getItem('noufex_cart')).toBeNull();
	});

	it('is idempotent (no error when key already absent)', () => {
		expect(() => clearLocalCart()).not.toThrow();
		expect(() => clearLocalCart()).not.toThrow();
	});
});

// ═══════════════════════════════════════════════════════════════════
// syncLocalCartToServer
// ═══════════════════════════════════════════════════════════════════
describe('syncLocalCartToServer', () => {
	it('pushes each item, reports counts, returns the server cart', async () => {
		// Mock the spy: count POST /api/cart calls, return ok, then
		// return an empty server cart for the final GET.
		let postCount = 0;
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input);
			// POST /api/cart   (addToCart) — no trailing slash
			// GET  /api/cart/7 (getCart)   — has a user id
			if (url.endsWith('/api/cart')) {
				postCount++;
				return new Response(JSON.stringify({ success: true, data: { id: postCount } }), {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			}
			return new Response(JSON.stringify({ success: true, data: [] }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		});

		const result = await syncLocalCartToServer(7, [
			{ productId: '1', quantity: 2 },
			{ productId: '2', quantity: 1 },
		]);

		expect(postCount).toBe(2);
		expect(result.pushed).toBe(2);
		expect(result.failed).toBe(0);
		expect(result.degraded).toBe(false);
		expect(result.serverCart).toEqual([]);
		fetchSpy.mockRestore();
	});

	it('continues on a per-item 4xx error, increments `failed`', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input);
			if (url.endsWith('/api/cart')) {
				return new Response(JSON.stringify({ success: false, error: 'Out of stock' }), {
					status: 400,
					headers: { 'content-type': 'application/json' },
				});
			}
			return new Response(JSON.stringify({ success: true, data: [] }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		});

		const result = await syncLocalCartToServer(1, [
			{ productId: '1', quantity: 1 },
			{ productId: '2', quantity: 1 },
		]);

		expect(result.pushed).toBe(0);
		expect(result.failed).toBe(2);
		expect(result.degraded).toBe(true);
		fetchSpy.mockRestore();
	});

	it('aborts immediately on a 401 (auth failure)', async () => {
		let callCount = 0;
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			callCount++;
			const url = String(input);
			if (url.endsWith('/api/cart')) {
				return new Response(JSON.stringify({ success: false, error: 'Auth required' }), {
					status: 401,
					headers: { 'content-type': 'application/json' },
				});
			}
			return new Response('{}', { status: 200 });
		});

		await expect(
			syncLocalCartToServer(1, [
				{ productId: '1', quantity: 1 },
				{ productId: '2', quantity: 1 },
			]),
		).rejects.toBeDefined();

		// The first item throws, the second is never attempted.
		expect(callCount).toBe(1);
		fetchSpy.mockRestore();
	});

	it('honors an AbortSignal between items', async () => {
		const controller = new AbortController();
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
			return new Response(JSON.stringify({ success: true, data: { id: 1 } }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		});

		// Schedule an abort right after the first item resolves.
		const promise = syncLocalCartToServer(
			1,
			[
				{ productId: '1', quantity: 1 },
				{ productId: '2', quantity: 1 },
				{ productId: '3', quantity: 1 },
			],
			controller.signal,
		);
		controller.abort();
		const result = await promise;

		// The abort happens "between items" — implementation may push
		// at least 1 before checking. The point is it does NOT push
		// all 3.
		expect(result.pushed).toBeLessThan(3);
		fetchSpy.mockRestore();
	});

	it('returns [] serverCart when the final GET /api/cart fails', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input);
			if (url.endsWith('/api/cart')) {
				return new Response(JSON.stringify({ success: true, data: { id: 1 } }), {
					status: 200,
				});
			}
			return new Response('{}', { status: 500 });
		});

		const result = await syncLocalCartToServer(1, [{ productId: '1', quantity: 1 }]);
		expect(result.pushed).toBe(1);
		expect(result.serverCart).toEqual([]);
		fetchSpy.mockRestore();
	});
});

// ═══════════════════════════════════════════════════════════════════
// syncOnLogin
// ═══════════════════════════════════════════════════════════════════
describe('syncOnLogin', () => {
	it('clears the local cart when the sync fully succeeds', async () => {
		setLocalCart([{ productId: '1', quantity: 2 }]);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input);
			if (url.endsWith('/api/cart')) {
				return new Response(JSON.stringify({ success: true, data: { id: 1 } }), {
					status: 200,
				});
			}
			return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
		});

		const result = await syncOnLogin(1);
		expect(result.pushed).toBe(1);
		expect(localStorage.getItem('noufex_cart')).toBeNull();
		fetchSpy.mockRestore();
	});

	it('preserves the local cart when at least one item fails (degraded sync)', async () => {
		setLocalCart([
			{ productId: '1', quantity: 1 },
			{ productId: '2', quantity: 1 },
		]);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input);
			if (url.endsWith('/api/cart')) {
				return new Response(JSON.stringify({ success: false, error: 'stock' }), {
					status: 400,
				});
			}
			return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
		});

		const result = await syncOnLogin(1);
		expect(result.degraded).toBe(true);
		// Local cart must still be there for the user to resolve.
		expect(localStorage.getItem('noufex_cart')).not.toBeNull();
		fetchSpy.mockRestore();
	});

	it('short-circuits when the local cart is empty (just fetches server cart)', async () => {
		let postCount = 0;
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input);
			if (url.endsWith('/api/cart') && !url.includes('/clear/')) {
				postCount++;
				return new Response('{}', { status: 200 });
			}
			return new Response(
				JSON.stringify({
					success: true,
					data: [{ id: 99, user_id: 1, product_id: 5, quantity: 3 }],
				}),
				{ status: 200 },
			);
		});

		const result = await syncOnLogin(1);
		expect(postCount).toBe(0); // no POST /api/cart needed
		expect(result.pushed).toBe(0);
		expect(result.serverCart).toHaveLength(1);
		fetchSpy.mockRestore();
	});
});
