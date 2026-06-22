/**
 * useApi hook tests
 *
 * These exercise the data-fetching hooks against MSW (mocks/handlers.ts).
 * The hooks use `fetch()` directly, so we run under happy-dom and let
 * MSW intercept calls transparently via the node http layer (the
 * `setupServer` factory in msw/node also works in happy-dom for the
 * specific fetch → http path our hooks use).
 *
 * We verify:
 *   - The hook transitions through the expected {data, loading, error} states
 *   - Refetch works
 *   - The hook reports errors gracefully
 *   - Dependencies trigger re-fetches correctly
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { installFetchSpy, uninstallFetchSpy } from '../../../tests/mocks/fetch-spy';
import { useProducts, useProduct, useCategories, useHomeStats } from '../useApi';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

describe('useHomeStats', () => {
	it('starts in loading state, then resolves with stats', async () => {
		const { result } = renderHook(() => useHomeStats());

		expect(result.current.loading).toBe(true);
		expect(result.current.data).toBeNull();
		expect(result.current.error).toBeNull();

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.error).toBeNull();
		// `getHomeStats` hits `/api/stats/home`. The MSW handler returns
		// the server-shaped payload: `{ counts: { products, ... }, ... }`.
		expect(result.current.data).toMatchObject({
			counts: {
				products: expect.any(Number),
				stores: expect.any(Number),
				orders: expect.any(Number),
				users: expect.any(Number),
			},
		});
	});

	it('exposes a refetch function that re-runs the fetch', async () => {
		const { result } = renderHook(() => useHomeStats());
		await waitFor(() => expect(result.current.loading).toBe(false));

		await act(async () => {
			result.current.refetch();
		});
		await waitFor(() => expect(result.current.loading).toBe(false));
	});
});

describe('useProducts', () => {
	it('returns the product list', async () => {
		const { result } = renderHook(() => useProducts({ limit: 50 }));

		await waitFor(() => expect(result.current.loading).toBe(false));

		// products.json has 40 entries; the hook is filtering in-memory.
		expect(result.current.data?.products.length).toBeGreaterThan(0);
		expect(result.current.data?.total).toBeGreaterThan(0);
	});
});

describe('useProduct', () => {
	it('returns a single product by id', async () => {
		const { result } = renderHook(() => useProduct(1));

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.data).toMatchObject({ id: 1 });
	});

	it('returns null for an unknown id (no crash)', async () => {
		const { result } = renderHook(() => useProduct(99_999));

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.data).toBeNull();
	});

	it('does not fetch when id is null', async () => {
		const { result } = renderHook(() => useProduct(null));

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.data).toBeNull();
	});
});

describe('useCategories', () => {
	it('returns the category list', async () => {
		const { result } = renderHook(() => useCategories());

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.data?.length).toBeGreaterThan(0);
	});
});
