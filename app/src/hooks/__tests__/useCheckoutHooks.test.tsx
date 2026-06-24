/**
 * Unit tests for the checkout-related hooks in useApi.ts.
 *
 *   - usePlaceOrder  : mutation that POSTs /api/orders, tracks
 *                       loading / error / result state.
 *   - useCouponValidation : wraps POST /api/coupons/validate behind a
 *                       `validate(code, subtotal, userId)` function.
 *   - useUserAddresses : fetches /api/addresses?user_id=N and
 *                       tolerates a null userId (anonymous).
 *   - useShippingMethods : fetches /api/shipping/methods?weight_kg=N
 *                       with a default weight.
 *
 * Tests use the same MSW-driven fetch-spy that the existing
 * useApi.test.tsx uses, so they run in the DOM project (happy-dom)
 * without a real network.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { installFetchSpy, uninstallFetchSpy } from '../../../tests/mocks/fetch-spy';
import {
	usePlaceOrder,
	useCouponValidation,
	useUserAddresses,
	useShippingMethods,
} from '../useApi';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

// Some of the hooks use the persisted Bearer token from localStorage.
// The Checkout tests don't actually need authentication, but we
// make sure the token is set so the API envelope is satisfied.
beforeEach(() => {
	try {
		localStorage.setItem('noufex_token', 'test-jwt-token-1234');
	} catch {
		/* SSR / non-browser env */
	}
});

describe('usePlaceOrder', () => {
	it('starts in idle state (submitting=false, error=null)', () => {
		const { result } = renderHook(() => usePlaceOrder());
		expect(result.current.submitting).toBe(false);
		expect(result.current.error).toBeNull();
		expect(typeof result.current.placeOrder).toBe('function');
	});

	it('returns the server order object on success', async () => {
		const { result } = renderHook(() => usePlaceOrder());
		let placed: { id: number; orderNumber: string; discount: number; total: number } | null =
			null;
		await act(async () => {
			placed = await result.current.placeOrder({
				items: [{ productId: 1, quantity: 1, unitPrice: 25000 }],
				subtotal: 25000,
				shippingCost: 700,
				discount: 2500,
				total: 23200,
			} as Parameters<typeof result.current.placeOrder>[0]);
		});
		await waitFor(() => expect(result.current.submitting).toBe(false));
		expect(placed).not.toBeNull();
		expect(placed!.id).toBe(3); // 1 (initial) + 1 (existing) + 1 (new) = 3
		expect(placed!.orderNumber).toMatch(/^ORD-[0-9A-F]{8}$/);
		expect(placed!.total).toBe(23200);
		expect(placed!.discount).toBe(2500);
		expect(result.current.error).toBeNull();
	});

	it('captures server errors and exposes them via `error`', async () => {
		const { result } = renderHook(() => usePlaceOrder());
		// Force the handler to fail by passing an invalid payload
		// (the test mock accepts anything; we monkey-patch fetch to
		// simulate a 500).
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ success: false, error: 'Mocked server failure' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			})) as typeof fetch;
		let placed: unknown = 'sentinel';
		await act(async () => {
			placed = await result.current.placeOrder({
				items: [{ productId: 1, quantity: 1, unitPrice: 1 }],
				total: 1,
			} as Parameters<typeof result.current.placeOrder>[0]);
		});
		globalThis.fetch = originalFetch;
		expect(placed).toBeNull();
		await waitFor(() => expect(result.current.error).not.toBeNull());
		expect(result.current.submitting).toBe(false);
	});
});

describe('useCouponValidation', () => {
	it('starts idle (validating=false, result=null, error=null)', () => {
		const { result } = renderHook(() => useCouponValidation());
		expect(result.current.validating).toBe(false);
		expect(result.current.result).toBeNull();
		expect(result.current.error).toBeNull();
	});

	it('returns the discount envelope on success', async () => {
		const { result } = renderHook(() => useCouponValidation());
		let returned: { code: string; discount: number } | null = null;
		await act(async () => {
			returned = await result.current.validate('SAVE10', 50000, 5);
		});
		expect(returned).not.toBeNull();
		expect(returned!.code).toBe('SAVE10');
		expect(returned!.discount).toBe(5000); // 10% of 50000
		await waitFor(() => expect(result.current.result?.code).toBe('SAVE10'));
		expect(result.current.error).toBeNull();
	});

	it('captures the 404 "Coupon not found" error', async () => {
		const { result } = renderHook(() => useCouponValidation());
		let returned: unknown = 'sentinel';
		await act(async () => {
			returned = await result.current.validate('INVALID', 5000, 5);
		});
		expect(returned).toBeNull();
		await waitFor(() => expect(result.current.error).not.toBeNull());
		expect(result.current.result).toBeNull();
		expect(result.current.error).toMatch(/not found/i);
	});

	it('reset() clears all state', async () => {
		const { result } = renderHook(() => useCouponValidation());
		await act(async () => {
			await result.current.validate('SAVE10', 10000, 5);
		});
		expect(result.current.result).not.toBeNull();
		act(() => result.current.reset());
		expect(result.current.result).toBeNull();
		expect(result.current.error).toBeNull();
		expect(result.current.validating).toBe(false);
	});
});

describe('useUserAddresses', () => {
	it('returns [] for anonymous users (userId=null)', async () => {
		const { result } = renderHook(() => useUserAddresses(null));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data).toEqual([]);
		expect(result.current.error).toBeNull();
	});

	it('loads saved addresses for a signed-in user', async () => {
		const { result } = renderHook(() => useUserAddresses(5));
		await waitFor(() => expect(result.current.loading).toBe(false));
		const addrs = result.current.data ?? [];
		expect(addrs.length).toBe(2);
		expect(addrs[0].label).toBe('Home');
		expect(addrs[0].is_default).toBe(1);
		expect(addrs[0].governorate).toBe('Sanaa');
	});
});

describe('useShippingMethods', () => {
	it('uses a default weight when none is provided', async () => {
		const { result } = renderHook(() => useShippingMethods());
		await waitFor(() => expect(result.current.loading).toBe(false));
		const methods = result.current.data ?? [];
		expect(methods.length).toBe(2);
		expect(methods[0].name_en).toBe('Standard');
		expect(methods[0].estimated_total).toBe(700);
	});

	it('accepts an explicit weight and updates the request', async () => {
		const { result } = renderHook(() => useShippingMethods(2.5));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data?.[0].estimated_total).toBe(700);
	});
});
