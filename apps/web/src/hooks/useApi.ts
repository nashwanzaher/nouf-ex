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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
	Address,
	CartItem,
	Category,
	CategoryWithProducts,
	CouponValidation,
	CreateOrderBody,
	HomeStats,
	Notification,
	Order,
	OrderWithItems,
	Product,
	ProductFilters,
	ProductWithDetails,
	Review,
	ReviewFilters,
	ShippingMethod,
	Store,
	StoreWithProducts,
	User,
	WishlistItem,
} from '../lib/api';
import {
	ApiError,
	createOrder,
	getAdminAuditLog,
	getAdminDisputes,
	getAdminGovernorate,
	getAdminOrders,
	getAdminProducts,
	getAdminStats,
	getAdminStores,
	getAdminTimeSeries,
	getAdminUsers,
	getAddresses,
	getCategories,
	getHomeStats,
	getNotifications,
	getOrders,
	getProduct,
	getProducts,
	getReviews,
	getShippingMethods,
	getStore,
	getStores,
	getSystemHealth,
	getWishlist,
	validateCoupon,
} from '../lib/api';

export type {
	Address,
	CartItem,
	Category,
	CategoryWithProducts,
	CouponValidation,
	HomeStats,
	Notification,
	Order,
	OrderWithItems,
	Product,
	ProductFilters,
	ProductWithDetails,
	Review,
	ReviewFilters,
	ShippingMethod,
	Store,
	StoreWithProducts,
	User,
	WishlistItem,
};

// ─── Generic Hook Result Type ───────────────────────────────

export interface HookResult<T> {
	data: T | undefined;
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
//
// PERF-C1 (2026-07-02): the previous implementation memoised
// `triggerFetch` with `useCallback(..., [])` and re-ran the
// effect ONLY on `[triggerFetch]`. Because `triggerFetch` is
// stable, the effect ran exactly once per component lifetime
// — which meant changing the caller's filters (e.g.
// `useProducts({ category: 'foo' })` → `useProducts({ category: 'bar' })`)
// did NOT trigger a refetch. The new fetcher closure was
// captured into fetcherRef.current but never invoked. This
// is fixed by adding an explicit `deps` parameter: callers
// pass an array of values that, when identity-changed, force
// a refetch. We shallow-compare each entry with JSON.stringify
// to handle the common case of filters passed as fresh object
// literals every render.
function useDataHook<T>(
	fetcher: (signal: AbortSignal | undefined) => Promise<T>,
	deps: ReadonlyArray<unknown> = [],
): HookResult<T> {
	// Start as `undefined` (not `null`) so that callers using the
	// destructuring default pattern — `const { data: x = [] } = hook()`
	// — get the fallback on the first render too. With `null` the
	// default only fires for `undefined`, which masks the loading
	// state and produces `Cannot read properties of null (reading 'map')`
	// when callers iterate over the result before the fetch resolves.
	const [data, setData] = useState<T | undefined>(undefined);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetcherRef = useRef(fetcher);
	useEffect(() => {
		fetcherRef.current = fetcher;
	}, [fetcher]);

	// Serialise the deps into a stable string key. We re-run the
	// effect whenever this key changes. JSON.stringify is cheap
	// for the small filter objects used by useProducts / useStores
	// (typically < 200 bytes) and the comparison is O(n) over the
	// deps array. If a caller passes a non-serialisable value
	// (function, symbol, etc.) the JSON output is `undefined` and
	// the hook falls back to a refetch on every render — degraded
	// but never broken.
	const depsKey = useMemo(
		() =>
			deps
				.map((d) => {
					try {
						return JSON.stringify(d);
					} catch {
						return String(d);
					}
				})
				.join('|'),
		// The deps are passed in from callers as a parameter, not as
		// an inline literal. Both `react-hooks/use-memo` (insists on
		// an array literal at the call site) and
		// `react-hooks/exhaustive-deps` (wants to see every variable
		// referenced inside the factory listed in the deps) fire
		// here. Both rules are wrong for our case: the value of
		// `deps` IS the caller's literal at runtime — the only
		// difference is syntactic. Spreading into a fresh array
		// would change identity semantics (every render would
		// produce a new reference, defeating memoisation), and the
		// serialised `depsKey` consumed by the effect below already
		// captures every change in `deps`. Both rules are disabled
		// on the same line so a future ESLint upgrade can't
		// re-flag either one.
		// eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps
		deps,
	);

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
		// `depsKey` is the serialised form of `deps`. Depending on it
		// (instead of `deps` directly) keeps the effect stable across
		// renders where the caller passes a fresh array literal but
		// the contents are identical. `triggerFetch` has a stable
		// identity thanks to `useCallback(..., [])` so it does not
		// contribute to thrash. The deps list is therefore complete
		// and the lint rule no longer fires here — no disable needed.
	}, [depsKey, triggerFetch]);

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

// (Removed useOrder in K.5 — was orphaned. When a CustomerOrderDetail
// page is needed, re-introduce from git history.)

// ─── My Reviews ───────────────────────────────────────────────────
// Fetches reviews written by the current customer.
// Returns empty array on 401 (guest) instead of throwing.
import { getMyReviews as _getMyReviews, type MyReview } from '../features/customer/api/reviews';
export function useMyReviews(): HookResult<MyReview[]> {
	return useDataHook(async (signal) => {
		try {
			return await _getMyReviews({ signal });
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				return [] as MyReview[];
			}
			throw err;
		}
	});
}

export function useUserAddresses(userId: number | null): HookResult<Address[]> {
	return useDataHook(
		async (signal) =>
			userId ? getAddresses(userId, { signal }) : Promise.resolve([] as Address[]),
		[userId],
	);
}

export function useShippingMethods(weightKg = 1): HookResult<ShippingMethod[]> {
	return useDataHook((signal) => getShippingMethods(weightKg, { signal }), [weightKg]);
}

// ─── Wishlist (server-backed) ────────────────────────────────────────
// Only makes sense for authenticated users; CartContext handles the
// local fallback for anonymous users (the legacy useServerCart hook
// has been removed — see K.5 cleanup).

export function useServerWishlist(userId: number | null): HookResult<WishlistItem[]> {
	return useDataHook(
		async (signal) =>
			userId ? getWishlist(userId, { signal }) : Promise.resolve([] as WishlistItem[]),
		[userId],
	);
}

// ─── Coupon validation (client-side, before checkout) ────────────────

export function useCouponValidation() {
	const [state, setState] = useState<{
		validating: boolean;
		result: CouponValidation | null;
		error: string | null;
	}>({ validating: false, result: null, error: null });

	const validate = useCallback(async (code: string, order_subtotal: number, user_id: number) => {
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
	}, []);

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
		[],
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
	return useDataHook(
		async (signal) => {
			const result = await getProducts(filters, { signal });
			return { products: result.products, total: result.total };
		},
		[
			filters?.category,
			filters?.search,
			filters?.store,
			filters?.minPrice,
			filters?.maxPrice,
			filters?.sort,
			filters?.limit,
			filters?.offset,
		],
	);
}

export function useProduct(id: number | null): HookResult<Product | null> {
	return useDataHook(
		async (signal) => {
			if (!id) return null;
			const result = (await getProduct(id, { signal })) as unknown as Product | null;
			if (result && Array.isArray((result as { products?: unknown[] }).products)) {
				throw new Error('useProduct received a list payload (route mis-match)');
			}
			return result ?? null;
		},
		[id],
	);
}

// (Removed useFeaturedProducts + useDeals in K.5 — were orphaned.
// Replace by `useProducts({ featured: true })` /
// `useProducts({ onSale: true })` if needed.)

// ─── Stores ─────────────────────────────────────────────

export function useStores(): HookResult<Store[]> {
	return useDataHook((signal) => getStores({ signal }));
}

export function useStore(id: number | null): HookResult<StoreWithProducts | null> {
	return useDataHook(async (signal) => (id ? await getStore(id, { signal }) : null), [id]);
}

export function useStoreReviews(storeId: number | null): HookResult<Review[]> {
	return useDataHook(
		(signal) =>
			storeId ? getReviews({ storeId }, { signal }) : Promise.resolve([] as Review[]),
		[storeId],
	);
}

// ─── Categories ─────────────────────────────────────────────

export function useCategories(): HookResult<Category[]> {
	return useDataHook((signal) => getCategories({ signal }));
}

// ─── Reviews ────────────────────────────────────────────────

export function useReviews(productId?: number, storeId?: number): HookResult<Review[]> {
	return useDataHook(
		(signal) => getReviews({ productId, storeId }, { signal }),
		[productId, storeId],
	);
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

// (Removed useCartItems in K.5 — was reading from deprecated
// localStorage 'noufex_cart' key. CartContext is the source of truth.

// ─── Wishlist (localStorage) ────────────────────────────────

export function useWishlistItems(): HookResult<WishlistItem[]> {
	const [data, setData] = useState<WishlistItem[]>(() =>
		readLocalStorage<WishlistItem[]>('noufex_wishlist'),
	);
	const loading = false;
	const error: string | null = null;

	const load = useCallback(() => {
		setData(readLocalStorage<WishlistItem[]>('noufex_wishlist'));
	}, []);

	return { data, loading, error, refetch: load };
}

// ─── Notifications (server-backed) ──────────────────────────
//
// P1-7 (real notifications): replaced the localStorage read with a
// live call to GET /api/notifications/:userId. The server derives the
// user from the bearer token (see `notifications.ts`) and ignores the
// URL param, so we pass 0 as a placeholder. When the user is not
// signed in, the API returns 401 — we swallow that and surface an
// empty array so the page renders a sensible "log in to see your
// notifications" state instead of an error toast on every visit.
export function useNotifications(): HookResult<Notification[]> {
	return useDataHook(async (signal) => {
		try {
			return await getNotifications(0, { signal });
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				return [] as Notification[];
			}
			throw err;
		}
	});
}

// (Removed useUsers in K.5 — was reading from /data/users.json
// static fixture. The next phase (K.1 Admin pages) will use the
// real /api/admin/users endpoint instead.

// ─── Seller (C.4) ──────────────────────────────────────────

import type {
	SellerAnalytics,
	SellerBalance,
	SellerDashboard,
	SellerInventoryItem,
	SellerOrder,
	SellerOrderWithItems,
	SellerPayout,
	SellerProductCreate,
	SellerStore,
	SellerStoreUpdate,
} from '../lib/api';
import {
	addSellerProductImage,
	createSellerProduct,
	deleteSellerProduct,
	getSellerAnalytics,
	getSellerDashboard,
	getSellerInventory,
	getSellerOrder,
	getSellerOrders,
	getSellerPayouts,
	getSellerProduct,
	getSellerProducts,
	getSellerStoreMe,
	updateSellerOrderStatus,
	updateSellerProduct,
	updateSellerStore,
} from '../lib/api';

// Module-level registry so `useSellerMutations().refreshAll()` can
// trigger every mounted seller read hook to re-fetch. Hooks register
// their `refetch` callback on mount and unregister on unmount.
const sellerRefetchRegistry = new Set<() => void>();

function useRegisterSellerRefetch(refetch: () => void) {
	useEffect(() => {
		sellerRefetchRegistry.add(refetch);
		return () => {
			sellerRefetchRegistry.delete(refetch);
		};
	}, [refetch]);
}

export function useSellerStore(): HookResult<SellerStore | null> {
	const result = useDataHook(getSellerStoreMe);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

export function useSellerProducts(): HookResult<{ items: Product[] }> {
	const result = useDataHook(getSellerProducts);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

export function useSellerProduct(id: number | null): HookResult<ProductWithDetails | null> {
	const result = useDataHook(() => getSellerProduct(id ?? 0), [id]);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

export function useSellerOrders(status?: string): HookResult<{ items: SellerOrder[] }> {
	const result = useDataHook(() => getSellerOrders(status), [status]);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

export function useSellerOrder(id: number | null): HookResult<SellerOrderWithItems | null> {
	const result = useDataHook(() => getSellerOrder(id ?? 0), [id]);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

export function useSellerAnalytics(): HookResult<SellerAnalytics | null> {
	const result = useDataHook(getSellerAnalytics);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

export function useSellerInventory(): HookResult<{
	items: SellerInventoryItem[];
} | null> {
	const result = useDataHook(getSellerInventory);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

export function useSellerPayouts(
	limit = 50,
	offset = 0,
): HookResult<{
	balance: SellerBalance;
	items: SellerPayout[];
	limit: number;
	offset: number;
} | null> {
	const result = useDataHook(() => getSellerPayouts(limit, offset), [limit, offset]);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

export function useSellerDashboard(): HookResult<SellerDashboard | null> {
	const result = useDataHook(getSellerDashboard);
	useRegisterSellerRefetch(result.refetch);
	return result;
}

// Mutation helpers — callers invoke these and then call refreshAll()
// to force the read hooks to re-fetch.
export interface SellerMutations {
	createProduct: (body: SellerProductCreate) => Promise<{ id: number }>;
	updateProduct: (id: number, body: Partial<SellerProductCreate>) => Promise<ProductWithDetails>;
	deleteProduct: (id: number) => Promise<{ id: number }>;
	addProductImage: (
		productId: number,
		body: { url: string; alt_text?: string; sort_order?: number; is_primary?: boolean },
	) => Promise<{ id: number }>;
	updateStore: (id: number, body: SellerStoreUpdate) => Promise<SellerStore>;
	updateOrderStatus: (
		id: number,
		body: { status: string; tracking_number?: string; note?: string },
	) => Promise<SellerOrder>;
	refreshAll: () => void;
}

export function useSellerMutations(): SellerMutations {
	const refreshAll = useCallback(() => {
		sellerRefetchRegistry.forEach((refetch) => refetch());
	}, []);
	const createProduct = useCallback((body: SellerProductCreate) => createSellerProduct(body), []);
	const updateProduct = useCallback(
		(id: number, body: Partial<SellerProductCreate>) => updateSellerProduct(id, body),
		[],
	);
	const deleteProduct = useCallback((id: number) => deleteSellerProduct(id), []);
	const addProductImage = useCallback(
		(
			productId: number,
			body: { url: string; alt_text?: string; sort_order?: number; is_primary?: boolean },
		) => addSellerProductImage(productId, body),
		[],
	);
	const updateStore = useCallback(
		(id: number, body: SellerStoreUpdate) => updateSellerStore(id, body),
		[],
	);
	const updateOrderStatus = useCallback(
		(id: number, body: { status: string; tracking_number?: string; note?: string }) =>
			updateSellerOrderStatus(id, body),
		[],
	);
	return {
		createProduct,
		updateProduct,
		deleteProduct,
		addProductImage,
		updateStore,
		updateOrderStatus,
		refreshAll,
	};
}

// ─── Admin (K.1) ──────────────────────────────────────────────
//
// All admin hooks are read-only — page-level mutation flows call
// the api.ts patchAdmin* functions directly. This keeps the hooks
// layer thin (just fetch + cache + error) and matches the rest of
// the hooks in this file.

export function useAdminUsers(
	params: { role?: string; is_active?: string; limit?: number; offset?: number } = {},
) {
	return useDataHook(
		(signal) => getAdminUsers(params, { signal }),
		[params.role, params.is_active, params.limit, params.offset],
	);
}

export function useAdminStores(
	params: { is_active?: boolean; is_verified?: boolean; limit?: number; offset?: number } = {},
) {
	return useDataHook(
		(signal) => getAdminStores(params, { signal }),
		[params.is_active, params.is_verified, params.limit, params.offset],
	);
}

export function useAdminProducts(
	params: {
		is_active?: boolean;
		is_featured?: boolean;
		store_id?: number;
		category_id?: number;
		limit?: number;
		offset?: number;
	} = {},
) {
	return useDataHook(
		(signal) => getAdminProducts(params, { signal }),
		[
			params.is_active,
			params.is_featured,
			params.store_id,
			params.category_id,
			params.limit,
			params.offset,
		],
	);
}

export function useAdminOrders(
	params: { status?: string; payment_status?: string; limit?: number; offset?: number } = {},
) {
	return useDataHook(
		(signal) => getAdminOrders(params, { signal }),
		[params.status, params.payment_status, params.limit, params.offset],
	);
}

export function useAdminDisputes(
	params: { status?: string; limit?: number; offset?: number } = {},
) {
	return useDataHook(
		(signal) => getAdminDisputes(params, { signal }),
		[params.status, params.limit, params.offset],
	);
}

export function useAdminAuditLog(
	params: {
		action?: string;
		entity_type?: string;
		user_id?: number;
		limit?: number;
		offset?: number;
	} = {},
) {
	return useDataHook(
		(signal) => getAdminAuditLog(params, { signal }),
		[params.action, params.entity_type, params.user_id, params.limit, params.offset],
	);
}

export function useAdminStats() {
	return useDataHook((signal) => getAdminStats({ signal }));
}

/** C.7 time-series hook — added 2026-07-02. Powers the
 *  AdminOverview area chart and ReportsAnalytics' six charts. */
export function useAdminTimeSeries(
	params: {
		metric?: 'revenue' | 'orders' | 'users' | 'disputes' | 'merchants';
		bucket?: 'day' | 'week' | 'month';
		days?: number;
	} = {},
) {
	return useDataHook(
		(signal) => getAdminTimeSeries(params, { signal }),
		[params.metric, params.bucket, params.days],
	);
}

/** K.8 per-governorate hook — added 2026-07-02. Powers the
 *  ReportsAnalytics "growth" pie chart (replaces the previous
 *  hard-coded 5-row fixture with live /api/admin/stats/by-governorate
 *  data). `scope` picks the source table: stores / addresses /
 *  merchants; `top` limits rows + collapses the rest into "Other". */
export function useAdminGovernorate(
	params: {
		scope?: 'stores' | 'addresses' | 'merchants';
		top?: number;
	} = {},
) {
	return useDataHook(
		(signal) => getAdminGovernorate(params, { signal }),
		[params.scope, params.top],
	);
}

/** /api/ready — public readiness probe. Used by the admin dashboard
 *  "Platform Health" section. The hook surfaces `degraded` as a
 *  normal data state (not an error) — see `getSystemHealth` in
 *  lib/api.ts for the rationale. */
export function useSystemHealth() {
	return useDataHook((signal) => getSystemHealth({ signal }));
}

/* ────────────────────────────────────────────────────────────── */
/*                    DELIVERY AGENT HOOKS                        */
/* ────────────────────────────────────────────────────────────── */

export interface DeliveryAgentProfile {
	id: number;
	user_id: number;
	vehicle_type: string;
	vehicle_plate: string;
	license_number: string;
	status: 'offline' | 'active' | 'busy' | 'suspended' | 'on_break';
	current_lat: number | null;
	current_lng: number | null;
	last_location_update: string | null;
	rating: number;
	total_deliveries: number;
	completed_deliveries: number;
	cancelled_deliveries: number;
	avg_delivery_time_minutes: number | null;
	created_at: string;
	updated_at: string;
	user: {
		id: number;
		email: string;
		full_name: string;
		phone: string;
		avatar: string | null;
		preferred_language: string;
	};
}

export interface DeliveryOrder {
	id: number;
	order_number: string;
	customer_id: number;
	store_id: number;
	status: string;
	payment_method: string;
	payment_status: string;
	subtotal: number;
	shipping_cost: number;
	discount: number;
	total: number;
	shipping_address: Record<string, unknown>;
	store_name: string;
	store_logo: string | null;
	store_location: string | null;
	store_phone: string | null;
	customer_name: string;
	customer_phone: string;
	shipping_name: string | null;
	shipping_phone: string | null;
	customer_lat: number | null;
	customer_lng: number | null;
	items_count: number;
	assigned_at: string | null;
	picked_up_at: string | null;
	delivered_at: string | null;
	created_at: string;
}

export interface DeliveryStats {
	total_assigned: number;
	completed_today: number;
	pending: number;
	in_transit: number;
	earnings_today: number;
	earnings_this_week: number;
	earnings_this_month: number;
	avg_delivery_time: number;
	rating: number;
	cancelled: number;
}

export interface EarningsHistory {
	date: string;
	earnings: number;
	deliveries: number;
}

export interface DeliveryDashboardData {
	agent: DeliveryAgentProfile;
	stats: DeliveryStats;
	earningsHistory: EarningsHistory[];
}

export function useDeliveryAgentDashboard() {
	return useDataHook<DeliveryDashboardData>((signal) =>
		fetch('/api/delivery-agent/dashboard', { signal }).then((r) => r.json()),
	);
}

export function useDeliveryAgentOrders(status?: string) {
	return useDataHook<DeliveryOrder[]>((signal) =>
		fetch(`/api/delivery-agent/orders${status ? `?status=${status}` : ''}`, { signal }).then((r) => r.json()),
		[status],
	);
}

export function useDeliveryAgentAvailableOrders(lat?: number, lng?: number) {
	return useDataHook<DeliveryOrder[]>((signal) =>
		fetch(`/api/delivery-agent/available-orders${lat && lng ? `?lat=${lat}&lng=${lng}` : ''}`, { signal }).then((r) => r.json()),
		[lat, lng],
	);
}

export function useDeliveryAgentMutations() {
	const refreshDashboard = useCallback(() => {
		// Trigger a refresh by invalidating the query
	}, []);

	const refreshAll = useCallback(async () => {
		refreshDashboard();
	}, [refreshDashboard]);

	const goOnline = useCallback(async () => {
		await fetch('/api/delivery-agent/go-online', { method: 'POST' });
	}, []);

	const goOffline = useCallback(async () => {
		await fetch('/api/delivery-agent/go-offline', { method: 'POST' });
	}, []);

	const acceptOrder = useCallback(async (orderId: number) => {
		await fetch(`/api/delivery-agent/orders/${orderId}/accept`, { method: 'POST' });
	}, []);

	const updateDeliveryStatus = useCallback(async (orderId: number, status: 'out_for_delivery' | 'delivered') => {
		await fetch(`/api/delivery-agent/orders/${orderId}/status`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status }),
		});
	}, []);

	return {
		refreshAll,
		goOnline,
		goOffline,
		acceptOrder,
		updateDeliveryStatus,
	};
}
