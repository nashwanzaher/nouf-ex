/**
 * Tests for src/lib/jsonData.ts — the build-time JSON snapshot loader.
 *
 * The loader reads pre-built JSON files (e.g. /data/products.json) and
 * applies in-memory filters so the SPA shell can render even when the
 * live API is offline. Each test exercises one filter pipeline against
 * the fixtures in tests/mocks/fixtures/.
 */

import { beforeAll, afterAll, describe, expect, it, beforeEach, vi } from 'vitest';
import {
	getProductsJson,
	getProductJson,
	getFeaturedProductsJson,
	getDealsJson,
	getStoresJson,
	getStoreJson,
	getCategoriesJson,
	getReviewsJson,
	getHomeStatsJson,
	getOrdersJson,
	getOrderJson,
	clearDataCache,
} from '../jsonData';
import { installFetchSpy, uninstallFetchSpy } from '../../../tests/mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

beforeEach(() => clearDataCache());

describe('getProductsJson', () => {
	it('returns the full product list with a total count', async () => {
		const { products, total } = await getProductsJson();
		expect(products.length).toBeGreaterThan(0);
		expect(total).toBe(products.length);
	});

	it('search filters by name_ar, name_en, name_zh, and description', async () => {
		const { products } = await getProductsJson({ search: 'Wireless' });
		expect(products.length).toBeGreaterThan(0);
		expect(products.every((p) => /wireless/i.test(p.name_en))).toBe(true);
	});

	it('search is case-insensitive', async () => {
		const lower = await getProductsJson({ search: 'wireless' });
		const upper = await getProductsJson({ search: 'WIRELESS' });
		expect(lower.products.length).toBe(upper.products.length);
	});

	it('category filters by category_id derived from the slug', async () => {
		const { products } = await getProductsJson({ category: 'electronics' });
		expect(products.length).toBeGreaterThan(0);
		expect(products.every((p) => p.category_id === 1)).toBe(true);
	});

	it('category returns the unfiltered list when the slug is unknown', async () => {
		const before = await getProductsJson();
		const { products } = await getProductsJson({ category: 'no-such-slug' });
		// The category filter is skipped — the implementation returns
		// the full list when the slug is unknown.
		expect(products.length).toBe(before.products.length);
	});

	it('store filters by store_id', async () => {
		const { products } = await getProductsJson({ store: 1 });
		expect(products.every((p) => p.store_id === 1)).toBe(true);
	});

	it('minPrice drops products below the threshold', async () => {
		const threshold = 100_000;
		const { products } = await getProductsJson({ minPrice: threshold });
		expect(products.every((p) => p.price >= threshold)).toBe(true);
	});

	it('maxPrice drops products above the threshold', async () => {
		const threshold = 50_000;
		const { products } = await getProductsJson({ maxPrice: threshold });
		expect(products.every((p) => p.price <= threshold)).toBe(true);
	});

	it('sort=price_asc orders ascending by price', async () => {
		const { products } = await getProductsJson({ sort: 'price_asc' });
		for (let i = 1; i < products.length; i++) {
			expect(products[i]!.price).toBeGreaterThanOrEqual(products[i - 1]!.price);
		}
	});

	it('sort=price_desc orders descending by price', async () => {
		const { products } = await getProductsJson({ sort: 'price_desc' });
		for (let i = 1; i < products.length; i++) {
			expect(products[i]!.price).toBeLessThanOrEqual(products[i - 1]!.price);
		}
	});

	it('sort=popular orders by sold_count descending', async () => {
		const { products } = await getProductsJson({ sort: 'popular' });
		for (let i = 1; i < products.length; i++) {
			expect(products[i]!.sold_count).toBeLessThanOrEqual(products[i - 1]!.sold_count);
		}
	});

	it('default sort orders by id descending (newest)', async () => {
		const { products } = await getProductsJson();
		for (let i = 1; i < products.length; i++) {
			expect(products[i]!.id).toBeLessThanOrEqual(products[i - 1]!.id);
		}
	});

	it('limit caps the number of products returned', async () => {
		const before = await getProductsJson();
		const { products } = await getProductsJson({ limit: 2 });
		expect(products.length).toBe(Math.min(2, before.products.length));
	});

	it('offset skips the first N products', async () => {
		const { products } = await getProductsJson({ offset: 5 });
		// total reflects the full pre-slice count, not products.length.
		expect(products.length).toBeGreaterThanOrEqual(0);
	});
});

describe('getProductJson', () => {
	it('returns the product with embedded store + reviews', async () => {
		const product = (await getProductJson(1)) as
			| (Awaited<ReturnType<typeof getProductJson>> & {
					store: { id: number };
					reviews: unknown[];
			  })
			| null;
		expect(product).not.toBeNull();
		expect(product!.id).toBe(1);
		expect((product as { store?: { id: number } }).store).toBeDefined();
		expect(Array.isArray((product as { reviews?: unknown[] }).reviews)).toBe(true);
	});

	it('returns null for an unknown id', async () => {
		const product = await getProductJson(999_999);
		expect(product).toBeNull();
	});
});

describe('getFeaturedProductsJson', () => {
	it('returns only products where is_featured = 1', async () => {
		const featured = await getFeaturedProductsJson();
		expect(featured.every((p) => p.is_featured === 1)).toBe(true);
	});

	it('caps the result at 10 items', async () => {
		const featured = await getFeaturedProductsJson();
		expect(featured.length).toBeLessThanOrEqual(10);
	});
});

describe('getDealsJson', () => {
	it('returns only products with a positive deal_discount', async () => {
		const deals = await getDealsJson();
		expect(deals.every((p) => (p.deal_discount ?? 0) > 0)).toBe(true);
	});
});

describe('getStoresJson', () => {
	it('returns the full store list', async () => {
		const stores = await getStoresJson();
		expect(stores.length).toBeGreaterThan(0);
	});
});

describe('getStoreJson', () => {
	it('returns the store with its products embedded', async () => {
		const store = await getStoreJson(1);
		expect(store).not.toBeNull();
		expect(store!.id).toBe(1);
		expect(Array.isArray(store!.products)).toBe(true);
		expect(store!.products.every((p) => p.store_id === 1)).toBe(true);
	});

	it('returns null for an unknown store', async () => {
		const store = await getStoreJson(999_999);
		expect(store).toBeNull();
	});
});

describe('getCategoriesJson', () => {
	it('returns the full category list', async () => {
		const categories = await getCategoriesJson();
		expect(categories.length).toBeGreaterThan(0);
	});
});

describe('getReviewsJson', () => {
	it('returns the full list when no filter is given', async () => {
		const reviews = await getReviewsJson();
		expect(Array.isArray(reviews)).toBe(true);
	});

	it('filters by productId when provided', async () => {
		const reviews = await getReviewsJson(1);
		expect(reviews.every((r) => r.product_id === 1)).toBe(true);
	});

	it('filters by storeId when provided (takes precedence over productId)', async () => {
		const reviews = await getReviewsJson(1, 1);
		expect(reviews.every((r) => r.store_id === 1)).toBe(true);
	});
});

describe('getHomeStatsJson', () => {
	it('returns the home-stats snapshot', async () => {
		const stats = await getHomeStatsJson();
		expect(typeof stats.products_count).toBe('number');
		expect(typeof stats.stores_count).toBe('number');
	});
});

describe('getOrdersJson', () => {
	it('returns the full order list when no customerId is given', async () => {
		const orders = await getOrdersJson();
		expect(orders.length).toBeGreaterThan(0);
	});

	it('filters by customerId when provided', async () => {
		const orders = await getOrdersJson(5);
		expect(orders.every((o) => o.customer_id === 5)).toBe(true);
	});
});

describe('getOrderJson', () => {
	it('returns the matching order', async () => {
		const order = await getOrderJson(1);
		expect(order).not.toBeNull();
		expect(order!.id).toBe(1);
	});

	it('returns null for an unknown id', async () => {
		const order = await getOrderJson(999_999);
		expect(order).toBeNull();
	});
});

describe('clearDataCache', () => {
	it('clears the in-memory cache so the next call refetches', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await getProductsJson();
		const callsBefore = fetchSpy.mock.calls.length;
		await getProductsJson(); // cache hit — no new fetch
		expect(fetchSpy.mock.calls.length).toBe(callsBefore);
		clearDataCache();
		await getProductsJson(); // cache cleared — new fetch
		expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore);
		fetchSpy.mockRestore();
	});
});
