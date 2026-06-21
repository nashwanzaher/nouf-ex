/**
 * Nouf-ex React Data Hooks
 * Uses JSON data files exported from the database at build time
 * This ensures the static deployment has real data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from '../lib/jsonData';
import type {
	Product,
	ProductWithDetails,
	Store,
	StoreWithProducts,
	Category,
	CategoryWithProducts,
	Review,
	Order,
	OrderWithItems,
	CartItem,
	WishlistItem,
	Notification,
	User,
	HomeStats,
	ProductFilters,
	ReviewFilters,
} from '../lib/api';

export type {
	Product,
	ProductWithDetails,
	Store,
	StoreWithProducts,
	Category,
	CategoryWithProducts,
	Review,
	Order,
	OrderWithItems,
	CartItem,
	WishlistItem,
	Notification,
	User,
	HomeStats,
	ProductFilters,
	ReviewFilters,
};

// ─── Generic Hook Result Type ───────────────────────────────

export interface HookResult<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
	refetch: () => void;
}

// ─── Helper to create a hook ────────────────────────────────
// Subscribe to the latest fetcher via useEffect — every setState lives inside a
// Promise callback so we don't trip `react-hooks/set-state-in-effect`.
function useDataHook<T>(fetcher: () => Promise<T>): HookResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetcherRef = useRef(fetcher);
	useEffect(() => {
		fetcherRef.current = fetcher;
	}, [fetcher]);

	const triggerFetch = useCallback(() => {
		fetcherRef
			.current()
			.then((result) => {
				setData(result);
				setLoading(false);
			})
			.catch((err) => {
				const message = err instanceof Error ? err.message : 'Failed to load data';
				setError(message);
				setLoading(false);
			});
	}, []);

	useEffect(() => {
		triggerFetch();
	}, [triggerFetch]);

	return { data, loading, error, refetch: triggerFetch };
}

// ─── Products ───────────────────────────────────────────────

export interface ProductsResponse {
	products: Product[];
	total: number;
}

export function useProducts(filters?: {
	category?: string;
	search?: string;
	store?: number;
	minPrice?: number;
	maxPrice?: number;
	sort?: string;
	limit?: number;
	offset?: number;
}): HookResult<ProductsResponse> {
	return useDataHook(() => getProductsJson(filters));
}

export function useProduct(id: number | null): HookResult<Product | null> {
	return useDataHook(() => (id ? getProductJson(id) : Promise.resolve(null)));
}

export function useFeaturedProducts(): HookResult<Product[]> {
	return useDataHook(() => getFeaturedProductsJson());
}

export function useDeals(): HookResult<Product[]> {
	return useDataHook(() => getDealsJson());
}

// ─── Stores ─────────────────────────────────────────────────

export function useStores(): HookResult<Store[]> {
	return useDataHook(() => getStoresJson());
}

export function useStore(id: number | null): HookResult<StoreWithProducts | null> {
	return useDataHook(() =>
		id ? (getStoreJson(id) as Promise<StoreWithProducts | null>) : Promise.resolve(null)
	);
}

export function useStoreReviews(storeId: number | null): HookResult<Review[]> {
	return useDataHook(() => (storeId ? getReviewsJson(undefined, storeId) : Promise.resolve([])));
}

// ─── Categories ─────────────────────────────────────────────

export function useCategories(): HookResult<Category[]> {
	return useDataHook(() => getCategoriesJson());
}

// ─── Reviews ────────────────────────────────────────────────

export function useReviews(productId?: number, storeId?: number): HookResult<Review[]> {
	return useDataHook(() => getReviewsJson(productId, storeId));
}

// ─── Home Stats ─────────────────────────────────────────────

export function useHomeStats(): HookResult<HomeStats> {
	return useDataHook(() => getHomeStatsJson());
}

// ─── Orders ─────────────────────────────────────────────────

export function useOrders(customerId?: number): HookResult<Order[]> {
	return useDataHook(() => getOrdersJson(customerId));
}

export function useOrder(id: number | null): HookResult<Order | null> {
	return useDataHook(() => (id ? getOrderJson(id) : Promise.resolve(null)));
}

// ─── Cart (localStorage) ────────────────────────────────────
// Initialize directly from localStorage via lazy initializer — no effect needed, no setState.

function readLocalStorage<T>(key: string): T {
	if (typeof window === 'undefined') return [] as unknown as T;
	try {
		const raw = window.localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : ([] as unknown as T);
	} catch {
		return [] as unknown as T;
	}
}

export function useCartItems(): HookResult<CartItem[]> {
	const [data, setData] = useState<CartItem[]>(() => readLocalStorage<CartItem[]>('noufex_cart'));
	const loading = false;
	const error: string | null = null;

	const load = useCallback(() => {
		setData(readLocalStorage<CartItem[]>('noufex_cart'));
	}, []);

	return { data, loading, error, refetch: load };
}

// ─── Wishlist (localStorage) ────────────────────────────────

export function useWishlistItems(): HookResult<WishlistItem[]> {
	const [data, setData] = useState<WishlistItem[]>(() =>
		readLocalStorage<WishlistItem[]>('noufex_wishlist')
	);
	const loading = false;
	const error: string | null = null;

	const load = useCallback(() => {
		setData(readLocalStorage<WishlistItem[]>('noufex_wishlist'));
	}, []);

	return { data, loading, error, refetch: load };
}

// ─── Notifications (localStorage) ───────────────────────────

export function useNotifications(): HookResult<Notification[]> {
	const [data, setData] = useState<Notification[]>(() =>
		readLocalStorage<Notification[]>('noufex_notifications')
	);
	const loading = false;

	const load = useCallback(() => {
		setData(readLocalStorage<Notification[]>('noufex_notifications'));
	}, []);

	return { data, loading, error: null, refetch: load };
}

// ─── Users ──────────────────────────────────────────────────

export function useUsers(): HookResult<User[]> {
	return useDataHook(async () => {
		const res = await fetch('/data/users.json');
		return res.json();
	});
}
