/**
 * Nouf-ex React Data Hooks
 * Talks to the live Express API via `lib/api.ts` (which itself reads the
 * Bearer token from localStorage when present). When the user is signed in,
 * `apiRequest` automatically attaches `Authorization: Bearer <token>` so the
 * server's `optionalAuth` can populate `req.user`.
 *
 * For an authenticated endpoint (e.g. `/api/orders`), the hook surfaces
 * the server's 401 as a normal error — pages decide how to handle it
 * (redirect to /auth/login, show a login prompt, etc.).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
	getProducts,
	getProduct,
	getFeaturedProducts,
	getDeals,
	getStores,
	getStore,
	getCategories,
	getReviews,
	getHomeStats,
	getOrders,
	getOrder,
	createOrder,
	getCart,
	getWishlist,
	getAddresses,
	getShippingMethods,
	validateCoupon,
	ApiError,
} from '../lib/api';
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
	Address,
	ShippingMethod,
	CouponValidation,
	CreateOrderBody,
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
	Address,
	ShippingMethod,
	CouponValidation,
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
//
// P2-1 fix: every fetch is wrapped in an AbortController. When the
// component unmounts (or the hook's deps change and triggerFetch
// runs again), the in-flight request is aborted. We pass the
// signal to the fetcher so it can call `fetch(url, { signal })`.
// `AbortError` results are silently swallowed — they are an
// expected part of the cleanup lifecycle, not a real failure.
function useDataHook<T>(fetcher: (signal: AbortSignal | undefined) => Promise<T>): HookResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetcherRef = useRef(fetcher);
	useEffect(() => {
		fetcherRef.current = fetcher;
	}, [fetcher]);

	// One controller per fetch cycle. Replaced on every refetch and
	// aborted on unmount.
	const controllerRef = useRef<AbortController | null>(null);

	const triggerFetch = useCallback(() => {
		// Cancel the previous request before starting a new one.
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;
		const { signal } = controller;

		fetcherRef
			.current(signal)
			.then((result) => {
				if (signal.aborted) return;
				setData(result);
				setLoading(false);
			})
			.catch((err: unknown) => {
				if (signal.aborted) return;
				if (err instanceof Error && err.name === 'AbortError') return;
				const message = err instanceof Error ? err.message : 'Failed to load data';
				setError(message);
				setLoading(false);
			});
	}, []);

	useEffect(() => {
		triggerFetch();
		return () => {
			controllerRef.current?.abort();
		};
	}, [triggerFetch]);

	return { data, loading, error, refetch: triggerFetch };
}

// ─── Authenticated server-backed hooks ────────────────────────────────
// These read from the Express API. The `apiRequest` helper inside
// `lib/api.ts` reads the Bearer token from localStorage automatically,
// so the server's `optionalAuth` populates `req.user` and the
// endpoints behave correctly when the user is signed in.
//
// When the user is NOT signed in, the protected endpoints respond with
// 401. The hooks surface that as `error`. Pages can decide how to
// handle it (redirect to /auth/login, show a guest prompt, etc.).

export function useOrders(): HookResult<Order[]> {
	return useDataHook((signal) => getOrders(undefined, { signal }));
}

export function useOrder(id: number | null): HookResult<OrderWithItems | null> {
	return useDataHook(
		async (signal) => (id ? ((await getOrder(id, { signal })) as OrderWithItems) : null)
	);
}

export function useUserAddresses(userId: number | null): HookResult<Address[]> {
	return useDataHook(
		async (signal) => (userId ? getAddresses(userId, { signal }) : Promise.resolve([] as Address[]))
	);
}

export function useShippingMethods(weightKg = 1): HookResult<ShippingMethod[]> {
	return useDataHook((signal) => getShippingMethods(weightKg, { signal }));
}

// ─── Cart / Wishlist (server-backed) ────────────────────────────────
// These only make sense for authenticated users; they map the local
// CartContext state to the server. Anonymous users fall back to
// the local CartContext state in CartContext.tsx.

export function useServerCart(userId: number | null): HookResult<CartItem[]> {
	return useDataHook(
		async (signal) => (userId ? getCart(userId, { signal }) : Promise.resolve([] as CartItem[]))
	);
}

export function useServerWishlist(userId: number | null): HookResult<WishlistItem[]> {
	return useDataHook(
		async (signal) =>
			userId ? getWishlist(userId, { signal }) : Promise.resolve([] as WishlistItem[])
	);
}

// ─── Coupon validation (client-side, before checkout) ────────────────

export function useCouponValidation() {
	const [state, setState] = useState<{
		validating: boolean;
		result: CouponValidation | null;
		error: string | null;
	}>({ validating: false, result: null, error: null });

	const validate = useCallback(
		async (code: string, order_subtotal: number, user_id: number) => {
			setState({ validating: true, result: null, error: null });
			try {
				const result = await validateCoupon({ code, order_subtotal, user_id });
				setState({ validating: false, result, error: null });
				return result;
			} catch (err) {
				const message =
					err instanceof ApiError
						? err.message
						: 'Could not validate coupon. Please try again.';
				setState({ validating: false, result: null, error: message });
				return null;
			}
		},
		[]
	);

	const reset = useCallback(() => {
		setState({ validating: false, result: null, error: null });
	}, []);

	return { ...state, validate, reset };
}

// ─── Order creation (mutation hook) ────────────────────────────────

export interface PlaceOrderResult {
	id: number;
	orderNumber: string;
	discount: number;
	total: number;
}

export function usePlaceOrder() {
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const placeOrder = useCallback(
		async (body: CreateOrderBody): Promise<PlaceOrderResult | null> => {
			setSubmitting(true);
			setError(null);
			try {
				const result = await createOrder(body);
				setSubmitting(false);
				return result;
			} catch (err) {
				const message =
					err instanceof ApiError
						? err.message
						: 'Could not place your order. Please try again.';
				setError(message);
				setSubmitting(false);
				return null;
			}
		},
		[]
	);

	return { submitting, error, placeOrder };
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
	sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
	limit?: number;
	offset?: number;
}): HookResult<ProductsResponse> {
	return useDataHook(async (signal) => {
		const result = await getProducts(filters, { signal });
		// Narrow to the legacy ProductsResponse shape (used by every consumer).
		return { products: result.products, total: result.total };
	});
}

export function useProduct(id: number | null): HookResult<Product | null> {
	return useDataHook(async (signal) => {
		if (!id) return null;
		// The API returns the product with embedded store + reviews + images.
		const result = (await getProduct(id, { signal })) as unknown as Product | null;
		// If a mis-configured route returned a list payload, surface a
		// clear error so the caller sees it instead of silently getting
		// the wrong shape.
		if (result && Array.isArray((result as { products?: unknown[] }).products)) {
			throw new Error('useProduct received a list payload (route mis-match)');
		}
		return result ?? null;
	});
}

export function useFeaturedProducts(): HookResult<Product[]> {
	return useDataHook((signal) => getFeaturedProducts({ signal }));
}

export function useDeals(): HookResult<Product[]> {
	return useDataHook((signal) => getDeals({ signal }));
}

// ─── Stores ─────────────────────────────────────────────

export function useStores(): HookResult<Store[]> {
	return useDataHook((signal) => getStores({ signal }));
}

export function useStore(id: number | null): HookResult<StoreWithProducts | null> {
	return useDataHook(async (signal) => (id ? await getStore(id, { signal }) : null));
}

export function useStoreReviews(storeId: number | null): HookResult<Review[]> {
	return useDataHook((signal) =>
		storeId ? getReviews({ storeId }, { signal }) : Promise.resolve([] as Review[])
	);
}

// ─── Categories ─────────────────────────────────────────────

export function useCategories(): HookResult<Category[]> {
	return useDataHook((signal) => getCategories({ signal }));
}

// ─── Reviews ────────────────────────────────────────────────

export function useReviews(productId?: number, storeId?: number): HookResult<Review[]> {
	return useDataHook((signal) => getReviews({ productId, storeId }, { signal }));
}

// ─── Home Stats ─────────────────────────────────────────────

export function useHomeStats(): HookResult<HomeStats> {
	return useDataHook((signal) => getHomeStats({ signal }));
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
