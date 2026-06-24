/**
 * Tests for the typed fetch wrappers in src/lib/api.ts.
 *
 * Each test installs the same fetch-spy used by the rest of the DOM
 * suite (handlers.ts is the single source of truth for fixture data)
 * and exercises a wrapper around a happy-path call to make sure:
 *   - The correct URL is hit (path + query string)
 *   - The Authorization header is attached when a Bearer token exists
 *   - Non-2xx responses surface as `ApiError` with the right status
 *   - The returned data matches the response envelope
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getProducts,
	getProduct,
	getStores,
	getStore,
	getCategories,
	getReviews,
	getOrders,
	getOrder,
	createOrder,
	getCart,
	addToCart,
	removeFromCart,
	clearCart,
	getWishlist,
	addToWishlist,
	removeFromWishlist,
	getNotifications,
	markNotificationAsRead,
	login,
	register,
	getCurrentUser,
	getHomeStats,
	createPayment,
	getOrderPayments,
	confirmPayment,
	getAddresses,
	createAddress,
	deleteAddress,
	getShippingMethods,
	validateCoupon,
	redeemCoupon,
	createRefund,
	resolveRefund,
	ApiError,
} from '../api';
import { installFetchSpy, uninstallFetchSpy } from '../../../tests/mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

beforeEach(() => {
	localStorage.clear();
	localStorage.setItem('noufex_token', 'test-jwt-token-1234');
});

describe('Products API', () => {
	it('getProducts calls /api/products and unwraps the envelope', async () => {
		const res = await getProducts({ limit: 50 });
		expect(res.products.length).toBeGreaterThan(0);
		expect(typeof res.total).toBe('number');
	});

	it('getProducts serializes filter params into the query string', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getProducts({
			category: 'electronics',
			search: 'phones',
			minPrice: 100,
			maxPrice: 9000,
			sort: 'price_asc',
			limit: 10,
			offset: 20,
		});
		const url = (fetchSpy.mock.calls[0]?.[0] as string) ?? '';
		expect(url).toContain('/api/products');
		expect(url).toContain('category=electronics');
		expect(url).toContain('search=phones');
		expect(url).toContain('minPrice=100');
		expect(url).toContain('maxPrice=9000');
		expect(url).toContain('sort=price_asc');
		expect(url).toContain('limit=10');
		expect(url).toContain('offset=20');
		fetchSpy.mockRestore();
	});

	it('getProducts accepts an AbortSignal in the options', async () => {
		// We don't assert on abort behavior here — the fetch-spy mocks
		// `fetch` directly without honoring the signal. We just confirm
		// that the wrapper passes the call through without throwing.
		const controller = new AbortController();
		const res = await getProducts({}, { signal: controller.signal });
		expect(res).toHaveProperty('products');
	});

	it('getProduct fetches /api/products/:id', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getProduct(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/products/1');
		fetchSpy.mockRestore();
	});
});

describe('Stores API', () => {
	it('getStores returns the store list', async () => {
		const stores = await getStores();
		expect(stores.length).toBeGreaterThan(0);
	});

	it('getStore fetches /api/stores/:id', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getStore(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/stores/1');
		fetchSpy.mockRestore();
	});
});

describe('Categories API', () => {
	it('getCategories returns the category list', async () => {
		const cats = await getCategories();
		expect(cats.length).toBeGreaterThan(0);
	});
});

describe('Reviews API', () => {
	it('getReviews accepts productId/storeId filters', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getReviews({ productId: 1, storeId: 1 });
		const url = String(fetchSpy.mock.calls[0]?.[0]);
		expect(url).toContain('productId=1');
		expect(url).toContain('storeId=1');
		fetchSpy.mockRestore();
	});
});

describe('Orders API', () => {
	it('getOrders forwards customerId as a query param', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getOrders(5);
		const url = String(fetchSpy.mock.calls[0]?.[0]);
		expect(url).toContain('/api/orders');
		expect(url).toContain('customerId=5');
		fetchSpy.mockRestore();
	});

	it('getOrder fetches /api/orders/:id', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getOrder(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/orders/1');
		fetchSpy.mockRestore();
	});

	it('createOrder POSTs to /api/orders and returns the orderNumber', async () => {
		const result = await createOrder({
			items: [{ productId: 1, quantity: 1, unitPrice: 100 }],
			total: 100,
		});
		expect(result.orderNumber).toMatch(/^ORD-[0-9A-F]{8}$/);
		expect(typeof result.id).toBe('number');
		expect(typeof result.discount).toBe('number');
	});
});

describe('Cart API', () => {
	it('getCart fetches /api/cart/:userId', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getCart(5);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/cart/5');
		fetchSpy.mockRestore();
	});

	it('addToCart POSTs to /api/cart with the body', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await addToCart({ userId: 5, productId: 1, quantity: 1 });
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('POST');
		expect(String(call?.[0])).toContain('/api/cart');
		fetchSpy.mockRestore();
	});

	it('removeFromCart issues DELETE /api/cart/:id', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await removeFromCart(99);
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('DELETE');
		expect(String(call?.[0])).toContain('/api/cart/99');
		fetchSpy.mockRestore();
	});

	it('clearCart issues DELETE /api/cart/clear/:userId', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await clearCart(5);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/cart/clear/5');
		fetchSpy.mockRestore();
	});
});

describe('Wishlist API', () => {
	it('getWishlist fetches /api/wishlist/:userId', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getWishlist(5);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/wishlist/5');
		fetchSpy.mockRestore();
	});

	it('addToWishlist POSTs to /api/wishlist', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await addToWishlist({ userId: 5, productId: 1 });
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('POST');
		expect(String(call?.[0])).toContain('/api/wishlist');
		fetchSpy.mockRestore();
	});

	it('removeFromWishlist issues DELETE /api/wishlist/:id', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await removeFromWishlist(7);
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('DELETE');
		expect(String(call?.[0])).toContain('/api/wishlist/7');
		fetchSpy.mockRestore();
	});
});

describe('Notifications API', () => {
	it('getNotifications fetches /api/notifications/:userId', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getNotifications(5);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/notifications/5');
		fetchSpy.mockRestore();
	});

	it('markNotificationAsRead issues PUT /api/notifications/:id/read', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await markNotificationAsRead(12);
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('PUT');
		expect(String(call?.[0])).toContain('/api/notifications/12/read');
		fetchSpy.mockRestore();
	});
});

describe('Auth API', () => {
	it('login POSTs credentials and returns { user, token }', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const res = await login({ email: 'ahmed@gmail.com', password: 'customer123' });
		expect(res.user.email).toBe('ahmed@gmail.com');
		expect(res.token).toBe('test-jwt-token-1234');
		expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe('POST');
		fetchSpy.mockRestore();
	});

	it('login throws ApiError on bad credentials', async () => {
		await expect(login({ email: 'x@y.com', password: 'wrong' })).rejects.toBeInstanceOf(
			ApiError,
		);
	});

	it('register POSTs the registration body', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await expect(
			register({ email: 'taken@x.com', password: 'secret', name: 'Taken' }),
		).rejects.toBeInstanceOf(ApiError);
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('POST');
		expect(String(call?.[0])).toContain('/api/auth/register');
		fetchSpy.mockRestore();
	});

	it('getCurrentUser fetches /api/auth/me', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getCurrentUser();
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/auth/me');
		fetchSpy.mockRestore();
	});
});

describe('Stats API', () => {
	it('getHomeStats fetches /api/stats/home', async () => {
		const stats = await getHomeStats();
		expect(stats).toBeDefined();
	});
});

describe('Payments API', () => {
	it('createPayment POSTs to /api/payments', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const res = await createPayment({ order_id: 1, amount: 100, method: 'cod' });
		expect(res.status).toBe('pending');
		expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe('POST');
		fetchSpy.mockRestore();
	});

	it('getOrderPayments fetches /api/payments/order/:orderId', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getOrderPayments(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/payments/order/1');
		fetchSpy.mockRestore();
	});

	it('confirmPayment POSTs to /api/payments/:id/confirm', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await confirmPayment(5);
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('POST');
		expect(String(call?.[0])).toContain('/api/payments/5/confirm');
		fetchSpy.mockRestore();
	});
});

describe('Addresses API', () => {
	it('getAddresses forwards user_id as a query param', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getAddresses(5);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('user_id=5');
		fetchSpy.mockRestore();
	});

	it('createAddress POSTs the address body', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await createAddress({
			user_id: 5,
			label: 'Home',
			full_name: 'Ahmed',
			phone: '+967711111111',
			governorate: 'Sanaa',
			city: 'Sanaa',
			street: 'Hadda',
		});
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('POST');
		fetchSpy.mockRestore();
	});

	it('deleteAddress issues DELETE /api/addresses/:id', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await deleteAddress(3);
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('DELETE');
		expect(String(call?.[0])).toContain('/api/addresses/3');
		fetchSpy.mockRestore();
	});
});

describe('Shipping API', () => {
	it('getShippingMethods uses a default weight of 1', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getShippingMethods();
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('weight_kg=1');
		fetchSpy.mockRestore();
	});

	it('getShippingMethods honours an explicit weight', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getShippingMethods(5);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('weight_kg=5');
		fetchSpy.mockRestore();
	});
});

describe('Coupons API', () => {
	it('validateCoupon returns a discount envelope', async () => {
		const res = await validateCoupon({ code: 'SAVE10', order_subtotal: 1000, user_id: 5 });
		expect(res.code).toBe('SAVE10');
		expect(res.discount).toBe(100); // 10% of 1000
	});

	it('validateCoupon throws ApiError on an unknown code', async () => {
		await expect(
			validateCoupon({ code: 'INVALID', order_subtotal: 100, user_id: 5 }),
		).rejects.toBeInstanceOf(ApiError);
	});

	it('redeemCoupon POSTs to /api/coupons/redeem', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await redeemCoupon({ code: 'SAVE10', order_subtotal: 100, user_id: 5, order_id: 1 });
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('POST');
		expect(String(call?.[0])).toContain('/api/coupons/redeem');
		fetchSpy.mockRestore();
	});
});

describe('Refunds API', () => {
	it('createRefund POSTs to /api/refunds', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await createRefund({ order_id: 1, user_id: 5, amount: 100, reason: 'Damaged' });
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('POST');
		expect(String(call?.[0])).toContain('/api/refunds');
		fetchSpy.mockRestore();
	});

	it('resolveRefund POSTs to /api/refunds/:id/resolve', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await resolveRefund(7, { status: 'approved' });
		const call = fetchSpy.mock.calls[0];
		expect(call?.[1]?.method).toBe('POST');
		expect(String(call?.[0])).toContain('/api/refunds/7/resolve');
		fetchSpy.mockRestore();
	});
});

describe('Authorization header', () => {
	it('attaches Bearer <token> when a token is in localStorage', async () => {
		localStorage.setItem('noufex_token', 'unit-test-token');
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getProducts();
		const headers = (fetchSpy.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
		expect(headers['Authorization']).toBe('Bearer unit-test-token');
		fetchSpy.mockRestore();
	});

	it('omits the Authorization header when no token is present', async () => {
		localStorage.removeItem('noufex_token');
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getProducts();
		const headers = (fetchSpy.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
		expect(headers['Authorization']).toBeUndefined();
		fetchSpy.mockRestore();
	});
});
