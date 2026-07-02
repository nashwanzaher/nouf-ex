/**
 * Nouf-ex Frontend API Client
 * Type-safe fetch wrapper for all API endpoints
 */

const API_BASE: string =
	(import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env?.VITE_API_URL ?? '/api';

// ─── Types ──────────────────────────────────────────────────

export interface Product {
	id: number;
	store_id: number;
	category_id: number;
	name_ar: string;
	name_en: string;
	name_zh: string;
	description: string;
	description_en: string;
	description_zh: string;
	price: number;
	original_price: number;
	currency: string;
	moq: number;
	stock: number;
	sold_count: number;
	rating: number;
	review_count: number;
	features: string[];
	specifications: Record<string, string>;
	badges: string[];
	colors: string[];
	sizes: string[];
	main_image: string;
	is_active: number;
	is_featured: number;
	deal_discount: number;
	deal_ends_at: string;
	created_at: string;
	updated_at: string;
}

export interface ProductWithDetails extends Product {
	store: Store;
	reviews: Review[];
	images: ProductImage[];
}

export interface ProductImage {
	id: number;
	product_id: number;
	image_url: string;
	sort_order: number;
	created_at: string;
}

export interface Store {
	id: number;
	owner_id: number;
	store_name: string;
	store_name_en: string;
	store_name_zh: string;
	slug: string;
	description: string;
	description_en: string;
	description_zh: string;
	logo: string;
	banner: string;
	location: string;
	governorate: string;
	trust_level: string;
	response_rate: number;
	on_time_delivery: number;
	rating: number;
	review_count: number;
	products_count: number;
	sales_count: number;
	followers_count: number;
	since_year: string;
	is_active: number;
	is_verified: number;
	created_at: string;
	updated_at: string;
}

export interface StoreWithProducts extends Store {
	products: Product[];
}

export interface Category {
	id: number;
	name_ar: string;
	name_en: string;
	name_zh: string;
	slug: string;
	parent_id: number | null;
	icon: string;
	image: string;
	sort_order: number;
	is_active: number;
	created_at: string;
	product_count?: number;
}

export interface CategoryWithProducts extends Category {
	products: Product[];
}

export interface Review {
	id: number;
	product_id: number;
	store_id: number;
	customer_id: number;
	order_id: number;
	rating: number;
	title: string;
	comment: string;
	is_verified: number;
	helpful_count: number;
	merchant_reply: string;
	reply_at: string;
	created_at: string;
	updated_at: string;
	customer_name?: string;
	customer_avatar?: string;
	product_name?: string;
	store_name?: string;
}

export interface Order {
	id: number;
	customer_id: number;
	store_id: number;
	order_number: string;
	status: string;
	payment_method: string;
	payment_status: string;
	subtotal: number;
	shipping_cost: number;
	discount: number;
	total: number;
	shipping_address: string;
	notes: string;
	timeline: string;
	created_at: string;
	updated_at: string;
	store_name?: string;
	store_logo?: string;
}

export interface OrderWithItems extends Order {
	items: OrderItem[];
}

export interface OrderItem {
	id: number;
	order_id: number;
	product_id: number;
	quantity: number;
	unit_price: number;
	total_price: number;
	variant: string;
	created_at: string;
	product_name?: string;
	product_name_ar?: string;
	product_image?: string;
}

export interface CartItem {
	id: number;
	user_id: number;
	product_id: number;
	quantity: number;
	variant: string;
	created_at: string;
	name_en?: string;
	name_ar?: string;
	name_zh?: string;
	price?: number;
	original_price?: number;
	main_image?: string;
	stock?: number;
	store_name?: string;
}

export interface WishlistItem {
	id: number;
	user_id: number;
	product_id: number;
	created_at: string;
	name_en?: string;
	name_ar?: string;
	name_zh?: string;
	price?: number;
	original_price?: number;
	main_image?: string;
	rating?: number;
	review_count?: number;
	store_name?: string;
}

export interface Notification {
	id: number;
	user_id: number;
	type: string;
	title: string;
	body: string;
	data: string;
	is_read: number;
	created_at: string;
}

export interface User {
	id: number;
	email: string;
	full_name: string;
	avatar?: string;
	role: string;
	status: string;
	is_verified: number;
	phone?: string;
	last_login?: string;
	created_at: string;
}

export interface Payment {
	id: number;
	order_id: number;
	user_id: number;
	amount: number;
	currency: string;
	method: 'cod' | 'card' | 'wallet' | 'bank_transfer' | 'stripe' | 'paymob';
	status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
	transaction_id?: string | null;
	paid_at?: string | null;
	created_at: string;
	updated_at: string;
}

export interface Address {
	id: number;
	user_id: number;
	label: string;
	full_name: string;
	phone: string;
	governorate: string;
	city: string;
	district?: string | null;
	street: string;
	building?: string | null;
	notes?: string | null;
	is_default: boolean;
	created_at: string;
	updated_at: string;
}

export interface ShippingMethod {
	id: number;
	name_ar: string;
	name_en: string;
	base_cost: number;
	per_kg_cost: number | null;
	estimated_days: number | null;
	estimated_total?: number; // computed server-side when ?weight_kg= provided
}

export interface CouponValidation {
	code: string;
	type: 'percentage' | 'fixed';
	value: number;
	discount: number;
	final_total: number;
}

export interface Refund {
	id: number;
	order_id: number;
	user_id: number;
	amount: number;
	reason: string;
	status: 'requested' | 'approved' | 'rejected' | 'processed';
	admin_notes?: string | null;
	resolved_at?: string | null;
	created_at: string;
	updated_at: string;
}

export interface HomeStats {
	products_count: number;
	stores_count: number;
	orders_count: number;
	users_count: number;
	featured_products: Product[];
	deals: Product[];
	categories: Category[];
}

// ─── Seller (C.4) ──────────────────────────────────────────

export interface SellerStore {
	id: number;
	owner_id: number;
	store_name: string;
	slug: string | null;
	name_ar: string;
	name_en: string | null;
	description: string | null;
	logo_url: string | null;
	banner_url: string | null;
	phone: string | null;
	city: string | null;
	governorate: string | null;
	rating: number | null;
	is_active: boolean;
	is_verified: boolean;
}

export interface SellerOrder {
	id: number;
	order_number: string;
	customer_id: number;
	customer_email?: string;
	store_id: number | null;
	status: string;
	payment_status: string | null;
	payment_method: string | null;
	subtotal: number;
	shipping_cost: number;
	discount: number;
	total: number;
	timeline: unknown[] | null;
	created_at: string;
	updated_at: string;
}

export interface SellerOrderWithItems extends SellerOrder {
	items: Array<{
		id: number;
		product_id: number;
		quantity: number;
		unit_price: number;
		total_price: number;
	}>;
}

export interface SellerAnalytics {
	store_id: number;
	total_orders: number;
	delivered_orders: number;
	cancelled_orders: number;
	unique_customers: number;
	today_orders: number;
	gross_revenue: number;
	total_revenue: number;
}

export interface SellerInventoryItem {
	id: number;
	name_ar: string;
	name_en: string | null;
	sku: string | null;
	stock: number;
	sold_count: number;
	is_active: boolean;
	stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface SellerPayout {
	id: number;
	type: string;
	amount: number;
	balance_after: number;
	reference_type: string | null;
	reference_id: number | null;
	description: string | null;
	created_at: string;
}

export interface SellerBalance {
	available: number;
	pending: number;
}

export interface SellerDashboard {
	store_id: number;
	active_orders: number;
	pending_orders: number;
	revenue: number;
	low_stock_products: number;
}

export interface SellerProductCreate {
	name_ar: string;
	name_en?: string;
	name_zh?: string;
	slug: string;
	sku?: string;
	category_id: number;
	price: number;
	original_price?: number;
	stock?: number;
	description?: string;
	main_image?: string;
	images?: string[];
	features?: Array<Record<string, unknown>>;
	badges?: string[];
	metadata?: Record<string, unknown>;
}

export interface SellerStoreUpdate {
	store_name?: string;
	name_ar?: string;
	name_en?: string;
	description?: string;
	logo_url?: string;
	banner_url?: string;
	phone?: string;
	city?: string;
	governorate?: string;
}

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
	error?: string;
}

// ─── Query & Filter Types ───────────────────────────────────

export interface ProductFilters {
	category?: string;
	search?: string;
	store?: number;
	minPrice?: number;
	maxPrice?: number;
	sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
	limit?: number;
	offset?: number;
}

export interface ReviewFilters {
	productId?: number;
	storeId?: number;
}

export interface CreateOrderBody {
	/** @deprecated The server overrides this with `req.user.id` (P0-4).
	 *  Kept optional for backwards compatibility. */
	customerId?: number;
	storeId?: number;
	items: Array<{
		productId: number;
		quantity: number;
		unitPrice: number;
		totalPrice?: number;
		variant?: Record<string, string>;
	}>;
	shippingAddress?: Record<string, string>;
	paymentMethod?: string;
	notes?: string;
	subtotal?: number;
	shippingCost?: number;
	discount?: number;
	total: number;
}

export interface CreateAddressBody {
	label: string;
	full_name: string;
	phone: string;
	governorate: string;
	city: string;
	district?: string;
	street: string;
	building?: string;
	notes?: string;
	is_default?: boolean;
}

export interface CreateRefundBody {
	order_id: number;
	user_id: number;
	amount: number;
	reason: string;
}

// ─── Fetch Wrapper ──────────────────────────────────────────

class ApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

/** Optional extras accepted by every read-only API helper. The
 *  `signal` lets callers (e.g. React hooks) abort an in-flight request
 *  on unmount or dep change, so we never setState on a stale
 *  response. */
export interface RequestOptions {
	signal?: AbortSignal;
}

/** Read the auth token from localStorage. Returns null when the user is
 *  not signed in. Reading at request time (not at module load) keeps the
 *  client in sync with the token stored by AppContext on login/logout. */
function readAuthToken(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage.getItem('noufex_token');
	} catch {
		return null;
	}
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
	const url = `${API_BASE}${endpoint}`;
	const token = readAuthToken();
	const config: RequestInit = {
		headers: {
			'Content-Type': 'application/json',
			// Only attach the Authorization header when a token exists; the
			// server's `optionalAuth` will populate `req.user` from it.
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...options?.headers,
		},
		...options,
	};

	const response = await fetch(url, config);
	const json = (await response.json()) as ApiResponse<T>;

	if (!json.success) {
		throw new ApiError(json.error || 'API request failed', response.status);
	}

	return json.data as T;
}

// ─── Products API ───────────────────────────────────────────

export async function getProducts(
	filters: ProductFilters = {},
	options?: RequestOptions,
): Promise<{ products: Product[]; total: number; limit: number; offset: number }> {
	const params = new URLSearchParams();
	if (filters.category) params.set('category', filters.category);
	if (filters.search) params.set('search', filters.search);
	if (filters.store) params.set('store', String(filters.store));
	if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
	if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
	if (filters.sort) params.set('sort', filters.sort);
	if (filters.limit) params.set('limit', String(filters.limit));
	if (filters.offset) params.set('offset', String(filters.offset));

	const query = params.toString();
	return apiRequest(`/products${query ? `?${query}` : ''}`, { signal: options?.signal });
}

export async function getProduct(
	id: number,
	options?: RequestOptions,
): Promise<ProductWithDetails> {
	return apiRequest(`/products/${id}`, { signal: options?.signal });
}

export async function getFeaturedProducts(options?: RequestOptions): Promise<Product[]> {
	return apiRequest('/products/featured', { signal: options?.signal });
}

export async function getDeals(options?: RequestOptions): Promise<Product[]> {
	return apiRequest('/products/deals', { signal: options?.signal });
}

// ─── Stores API ─────────────────────────────────────────────

export async function getStores(options?: RequestOptions): Promise<Store[]> {
	return apiRequest('/stores', { signal: options?.signal });
}

export async function getStore(id: number, options?: RequestOptions): Promise<StoreWithProducts> {
	return apiRequest(`/stores/${id}`, { signal: options?.signal });
}

export async function getStoreReviews(id: number, options?: RequestOptions): Promise<Review[]> {
	return apiRequest(`/stores/${id}/reviews`, { signal: options?.signal });
}

// ─── Categories API ─────────────────────────────────────────

export async function getCategories(options?: RequestOptions): Promise<Category[]> {
	return apiRequest('/categories', { signal: options?.signal });
}

export async function getCategory(
	slug: string,
	options?: RequestOptions,
): Promise<CategoryWithProducts> {
	return apiRequest(`/categories/${slug}`, { signal: options?.signal });
}

// ─── Reviews API ────────────────────────────────────────────

export async function getReviews(
	filters: ReviewFilters = {},
	options?: RequestOptions,
): Promise<Review[]> {
	const params = new URLSearchParams();
	if (filters.productId) params.set('productId', String(filters.productId));
	if (filters.storeId) params.set('storeId', String(filters.storeId));

	const query = params.toString();
	return apiRequest(`/reviews${query ? `?${query}` : ''}`, { signal: options?.signal });
}

export async function createReview(body: {
	productId: number;
	storeId?: number;
	customerId: number;
	rating: number;
	title?: string;
	comment: string;
}): Promise<{ id: number }> {
	return apiRequest('/reviews', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

// ─── Orders API ─────────────────────────────────────────────

export async function getOrders(customerId?: number, options?: RequestOptions): Promise<Order[]> {
	const params = customerId ? `?customerId=${customerId}` : '';
	return apiRequest(`/orders${params}`, { signal: options?.signal });
}

export async function getOrder(id: number, options?: RequestOptions): Promise<OrderWithItems> {
	return apiRequest(`/orders/${id}`, { signal: options?.signal });
}

export async function createOrder(body: CreateOrderBody): Promise<{
	id: number;
	orderNumber: string;
	discount: number;
	total: number;
}> {
	return apiRequest('/orders', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

// ─── Cart API ───────────────────────────────────────────────

export async function getCart(userId: number, options?: RequestOptions): Promise<CartItem[]> {
	return apiRequest(`/cart/${userId}`, { signal: options?.signal });
}

/** Add a product to the server cart. The server identifies the user
 *  from the bearer token (via `requireAuth`), so we deliberately do
 *  NOT include `userId` in the request body — the route's Zod schema
 *  is `.strict()` and would otherwise reject the request. */
export async function addToCart(body: {
	productId: number;
	quantity: number;
	variant?: Record<string, string>;
}): Promise<{ id: number }> {
	return apiRequest('/cart', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function removeFromCart(id: number): Promise<void> {
	return apiRequest(`/cart/${id}`, {
		method: 'DELETE',
	});
}

export async function clearCart(userId: number): Promise<void> {
	return apiRequest(`/cart/clear/${userId}`, {
		method: 'DELETE',
	});
}

// ─── Wishlist API ───────────────────────────────────────────

export async function getWishlist(
	userId: number,
	options?: RequestOptions,
): Promise<WishlistItem[]> {
	return apiRequest(`/wishlist/${userId}`, { signal: options?.signal });
}

/** Add a product to the server wishlist. The server identifies the
 *  user from the bearer token (via `requireAuth`), so we deliberately
 *  do NOT include `userId` in the request body — the route's Zod
 *  schema is `.strict()` and would otherwise reject the request. */
export async function addToWishlist(body: { productId: number }): Promise<{ id: number }> {
	return apiRequest('/wishlist', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function removeFromWishlist(id: number): Promise<void> {
	return apiRequest(`/wishlist/${id}`, {
		method: 'DELETE',
	});
}

// ─── Notifications API ──────────────────────────────────────

/**
 * Fetch the authenticated user's notifications.
 *
 * The route handler ignores the `:userId` URL parameter — it derives
 * the user from `req.user.id` (set by `optionalAuth` from the bearer
 * token). We keep `userId` in the signature because the URL pattern
 * requires a value, and because the test suite (and any future
 * admin-style "view another user's notifications" code) may pass one.
 */
export async function getNotifications(
	userId: number,
	options?: RequestOptions,
): Promise<Notification[]> {
	return apiRequest(`/notifications/${userId}`, { signal: options?.signal });
}

export async function markNotificationAsRead(id: number, options?: RequestOptions): Promise<void> {
	return apiRequest(`/notifications/${id}/read`, {
		method: 'PUT',
		signal: options?.signal,
	});
}

// ─── Auth API ───────────────────────────────────────────────

/** The /api/auth/login and /api/auth/register endpoints return both the
 *  user (without password_hash) and an HMAC-signed token. The server
 *  intentionally returns the token in the same response so the SPA can
 *  immediately persist it without a second round-trip. */
export interface AuthResponse {
	user: User;
	token: string;
}

export async function login(body: { email: string; password: string }): Promise<AuthResponse> {
	return apiRequest('/auth/login', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function register(body: {
	email: string;
	password: string;
	name: string;
	role?: string;
}): Promise<AuthResponse> {
	return apiRequest('/auth/register', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getCurrentUser(): Promise<User> {
	return apiRequest('/auth/me');
}

/** Body for PATCH /api/auth/me — self-service profile update.
 *  All fields optional; only supplied fields are written. */
export interface UpdateProfileBody {
	full_name?: string;
	phone?: string;
	avatar?: string | null;
	preferred_language?: 'ar' | 'en' | 'zh';
	gender?: 'male' | 'female' | 'other' | null;
}

export async function updateProfile(body: UpdateProfileBody): Promise<User> {
	return apiRequest('/auth/me', {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

/** Change the current user's password. Requires the existing
 *  password as proof of identity. Returns { updated: true } on
 *  success, 401 on wrong current password. */
export async function changePassword(body: {
	current_password: string;
	new_password: string;
}): Promise<{ updated: true }> {
	return apiRequest('/auth/change-password', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

// ─── Stats API ──────────────────────────────────────────────

export async function getHomeStats(options?: RequestOptions): Promise<HomeStats> {
	return apiRequest('/stats/home', { signal: options?.signal });
}

// ─── System Health API (K.6.3) ───────────────────────────────
//
// /api/ready (server/index.ts:108-131) is a PUBLIC endpoint that
// returns a readiness probe with DB round-trip latency. It does
// NOT follow the standard `{ success, data }` envelope — the body
// is the payload directly — so we can't reuse `apiRequest()`. Use
// raw fetch() and parse the JSON shape ourselves.
//
// The token is NOT sent on purpose: this endpoint is unauthenticated
// and we want the call to succeed even when the user is logged out
// (so the admin dashboard can render health during incidents).

export interface SystemHealthCheck {
	ok: boolean;
	ms: number;
	detail?: string;
}

export interface SystemHealth {
	status: 'ready' | 'degraded';
	uptime_s: number;
	checks: {
		db: SystemHealthCheck;
	};
}

export async function getSystemHealth(options?: RequestOptions): Promise<SystemHealth> {
	const url = `${API_BASE}/ready`;
	const response = await fetch(url, {
		// No Authorization header — endpoint is public. Sending a
		// token is harmless but pointless (the server reads no user).
		signal: options?.signal,
	});
	const json = (await response.json()) as SystemHealth;
	if (!response.ok || json.status === 'degraded') {
		// We still return the body so the UI can show degraded state
		// instead of erroring out. Throwing here would force every
		// health-card to show an error banner — the readiness probe
		// is supposed to surface "degraded" as a normal state.
		return json;
	}
	return json;
}

// ─── Payments API  (P0-2) ────────────────────────────────────

export interface CreatePaymentBody {
	order_id: number;
	amount: number;
	currency?: string;
	method: Payment['method'];
	transaction_id?: string;
}

export async function createPayment(
	body: CreatePaymentBody,
): Promise<{ id: number; status: string; idempotent?: boolean }> {
	return apiRequest('/payments', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getOrderPayments(orderId: number): Promise<Payment[]> {
	return apiRequest(`/payments/order/${orderId}`);
}

export async function confirmPayment(id: number): Promise<{ order_id: number }> {
	return apiRequest(`/payments/${id}/confirm`, {
		method: 'POST',
	});
}

// ─── Addresses API  (P1-3) ──────────────────────────────────

export async function getAddresses(userId: number, options?: RequestOptions): Promise<Address[]> {
	return apiRequest(`/addresses?user_id=${userId}`, { signal: options?.signal });
}

export async function createAddress(body: CreateAddressBody): Promise<Address> {
	return apiRequest('/addresses', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function updateAddress(id: number, body: CreateAddressBody): Promise<Address> {
	return apiRequest(`/addresses/${id}`, {
		method: 'PUT',
		body: JSON.stringify(body),
	});
}

export async function deleteAddress(id: number): Promise<{ id: number }> {
	return apiRequest(`/addresses/${id}`, {
		method: 'DELETE',
	});
}

// ─── Shipping API  (P1-4) ────────────────────────────────────

export async function getShippingMethods(
	weightKg = 1,
	options?: RequestOptions,
): Promise<ShippingMethod[]> {
	return apiRequest(`/shipping/methods?weight_kg=${weightKg}`, { signal: options?.signal });
}

// ─── Coupons API  (P1-5) ─────────────────────────────────────

export interface ValidateCouponBody {
	code: string;
	user_id: number;
	order_subtotal: number;
}

export async function validateCoupon(body: ValidateCouponBody): Promise<CouponValidation> {
	return apiRequest('/coupons/validate', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export interface RedeemCouponBody extends ValidateCouponBody {
	order_id: number;
}

export async function redeemCoupon(body: RedeemCouponBody): Promise<{ id: number }> {
	return apiRequest('/coupons/redeem', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

// ─── Seller API  (C.3) ──────────────────────────────────────

export async function getSellerStoreMe(): Promise<SellerStore> {
	return apiRequest('/seller/stores/me');
}

export async function updateSellerStore(id: number, body: SellerStoreUpdate): Promise<SellerStore> {
	return apiRequest(`/seller/stores/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function createSellerProduct(body: SellerProductCreate): Promise<{ id: number }> {
	return apiRequest('/seller/products', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getSellerProducts(): Promise<{ items: Product[] }> {
	return apiRequest('/seller/products');
}

export async function getSellerProduct(id: number): Promise<ProductWithDetails> {
	return apiRequest(`/seller/products/${id}`);
}

export async function updateSellerProduct(
	id: number,
	body: Partial<SellerProductCreate>,
): Promise<ProductWithDetails> {
	return apiRequest(`/seller/products/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function deleteSellerProduct(id: number): Promise<{ id: number }> {
	return apiRequest(`/seller/products/${id}`, { method: 'DELETE' });
}

export async function addSellerProductImage(
	productId: number,
	body: { url: string; alt_text?: string; sort_order?: number; is_primary?: boolean },
): Promise<{ id: number }> {
	return apiRequest(`/seller/products/${productId}/images`, {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getSellerOrders(status?: string): Promise<{ items: SellerOrder[] }> {
	const q = status ? `?status=${encodeURIComponent(status)}` : '';
	return apiRequest(`/seller/orders${q}`);
}

export async function getSellerOrder(id: number): Promise<SellerOrderWithItems> {
	return apiRequest(`/seller/orders/${id}`);
}

export async function updateSellerOrderStatus(
	id: number,
	body: { status: string; tracking_number?: string; note?: string },
): Promise<SellerOrder> {
	return apiRequest(`/seller/orders/${id}/status`, {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getSellerAnalytics(): Promise<SellerAnalytics> {
	return apiRequest('/seller/analytics');
}

export async function getSellerInventory(): Promise<{ items: SellerInventoryItem[] }> {
	return apiRequest('/seller/inventory');
}

export async function getSellerPayouts(
	limit = 50,
	offset = 0,
): Promise<{ balance: SellerBalance; items: SellerPayout[]; limit: number; offset: number }> {
	return apiRequest(`/seller/payouts?limit=${limit}&offset=${offset}`);
}

export async function getSellerDashboard(): Promise<SellerDashboard> {
	return apiRequest('/seller/dashboard');
}

// ─── Refunds API  (P1-6) ─────────────────────────────────────

export async function createRefund(body: CreateRefundBody): Promise<{ id: number }> {
	return apiRequest('/refunds', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export interface ResolveRefundBody {
	status: 'approved' | 'rejected';
	admin_notes?: string;
}

export async function resolveRefund(
	id: number,
	body: ResolveRefundBody,
): Promise<{ id: number; status: string }> {
	return apiRequest(`/refunds/${id}/resolve`, {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

// ─── Admin (K.1) ──────────────────────────────────────────────
//
// Endpoints under /api/admin/* (see server/routes/admin.cts).
// All require adminAuth. Backend enforces self-protection
// (admin can't ban/demote themselves).

export interface AdminStats {
	counts: {
		users: number;
		stores: number;
		products: number;
		orders: number;
		reviews: number;
		disputes: number;
	};
	flags: {
		openDisputes: number;
		pendingOrders: number;
		paidOrders: number;
		suspendedUsers: number;
		inactiveStores: number;
	};
	recent7d: {
		orders: number;
		users: number;
	};
	revenueYer: number;
}

/**
 * Admin-view of a user — has more fields than the public `User`
 * interface (status fields, verification flags, last-login, etc.).
 * Self-contained (does not extend `User`) because the underlying
 * nullable semantics differ — e.g. `last_login: string | null`
 * where `User.last_login?: string`.
 */
export interface AdminUser {
	id: number;
	email: string;
	full_name: string;
	avatar: string | null;
	role: 'customer' | 'merchant' | 'admin';
	status: 'active' | 'suspended' | 'banned';
	is_verified: number;
	email_verified: number;
	phone_verified: number;
	two_factor_enabled: number;
	preferred_language: string | null;
	gender: string | null;
	phone: string | null;
	last_login: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Admin-view of a store — adds `is_verified` (Store type only has
 * `is_active`).
 */
export interface AdminStore extends Omit<Store, 'is_verified'> {
	is_verified: number;
}

/**
 * Admin-view of a product — adds `is_active` and `is_featured`
 * (Product type doesn't expose these).
 */
export interface AdminProduct extends Omit<Product, never> {
	is_active: number;
	is_featured: number;
}

/**
 * Admin-view of an order — adds optional customer info for the
 * admin who may not have the customer's profile resolved.
 */
export interface AdminOrder extends Order {
	customer_email?: string;
	customer_name?: string;
}

export interface AdminDispute {
	id: number;
	order_id: number;
	raised_by: number;
	against_type: 'store' | 'courier' | 'platform';
	against_id: number | null;
	category: string;
	description: string;
	evidence_urls: string[] | null;
	status: 'open' | 'investigating' | 'resolved' | 'rejected';
	resolution: string | null;
	admin_notes: string | null;
	resolved_by: number | null;
	resolved_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface AdminAuditLogEntry {
	id: number;
	user_id: number | null;
	action: string;
	entity_type: string;
	entity_id: string | null;
	old_values: Record<string, unknown> | null;
	new_values: Record<string, unknown> | null;
	ip_address: string | null;
	user_agent: string | null;
	created_at: string;
}

export interface AdminUserListResponse {
	users: AdminUser[];
	total: number;
	limit: number;
	offset: number;
}

export interface AdminStoreListResponse {
	stores: AdminStore[];
	total: number;
	limit: number;
	offset: number;
}

export interface AdminProductListResponse {
	products: AdminProduct[];
	total: number;
	limit: number;
	offset: number;
}

export interface AdminOrderListResponse {
	orders: AdminOrder[];
	total: number;
	limit: number;
	offset: number;
}

export interface AdminDisputeListResponse {
	disputes: AdminDispute[];
	total: number;
	limit: number;
	offset: number;
}

export interface AdminAuditLogResponse {
	entries: AdminAuditLogEntry[];
	total: number;
	limit: number;
	offset: number;
}

export interface AdminUserUpdateBody {
	status?: 'active' | 'suspended' | 'banned';
	role?: 'customer' | 'merchant' | 'admin';
	is_verified?: boolean;
	email_verified?: boolean;
	phone_verified?: boolean;
}

export interface AdminStoreUpdateBody {
	is_active?: boolean;
	is_verified?: boolean;
	trust_level?: 'basic' | 'verified' | 'premium';
}

export interface AdminProductUpdateBody {
	is_active?: boolean;
	is_featured?: boolean;
	category_id?: number;
}

export interface AdminOrderStatusUpdateBody {
	status: string;
	admin_notes?: string;
}

export interface AdminDisputeUpdateBody {
	status?: 'open' | 'investigating' | 'resolved' | 'rejected';
	resolution?: string;
	admin_notes?: string;
}

// ─── Reads ──────────────────────────────────────────────

export async function getAdminUsers(
	params: { role?: string; is_active?: string; limit?: number; offset?: number } = {},
	options?: RequestOptions,
): Promise<AdminUserListResponse> {
	const q = new URLSearchParams();
	if (params.role) q.set('role', params.role);
	if (params.is_active) q.set('is_active', params.is_active);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/users${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminStores(
	params: { is_active?: boolean; is_verified?: boolean; limit?: number; offset?: number } = {},
	options?: RequestOptions,
): Promise<AdminStoreListResponse> {
	const q = new URLSearchParams();
	if (params.is_active !== undefined) q.set('is_active', String(params.is_active));
	if (params.is_verified !== undefined) q.set('is_verified', String(params.is_verified));
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/stores${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminProducts(
	params: {
		is_active?: boolean;
		is_featured?: boolean;
		store_id?: number;
		category_id?: number;
		limit?: number;
		offset?: number;
	} = {},
	options?: RequestOptions,
): Promise<AdminProductListResponse> {
	const q = new URLSearchParams();
	if (params.is_active !== undefined) q.set('is_active', String(params.is_active));
	if (params.is_featured !== undefined) q.set('is_featured', String(params.is_featured));
	if (params.store_id !== undefined) q.set('store_id', String(params.store_id));
	if (params.category_id !== undefined) q.set('category_id', String(params.category_id));
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/products${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminOrders(
	params: { status?: string; payment_status?: string; limit?: number; offset?: number } = {},
	options?: RequestOptions,
): Promise<AdminOrderListResponse> {
	const q = new URLSearchParams();
	if (params.status) q.set('status', params.status);
	if (params.payment_status) q.set('payment_status', params.payment_status);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/orders${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminDisputes(
	params: { status?: string; limit?: number; offset?: number } = {},
	options?: RequestOptions,
): Promise<AdminDisputeListResponse> {
	const q = new URLSearchParams();
	if (params.status) q.set('status', params.status);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/disputes${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminAuditLog(
	params: {
		action?: string;
		entity_type?: string;
		user_id?: number;
		limit?: number;
		offset?: number;
	} = {},
	options?: RequestOptions,
): Promise<AdminAuditLogResponse> {
	const q = new URLSearchParams();
	if (params.user_id !== undefined) q.set('user_id', String(params.user_id));
	if (params.action) q.set('action', params.action);
	if (params.entity_type) q.set('entity_type', params.entity_type);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	// The server response shape is { log, total, limit, offset }
	// (server/routes/admin.cts:364) but the client surface uses
	// 'entries' as the canonical name. Map here so callers don't
	// have to translate.
	const raw = await apiRequest<{
		log: AdminAuditLogEntry[];
		total: number;
		limit: number;
		offset: number;
	}>(`/admin/audit-log${qs ? `?${qs}` : ''}`, { signal: options?.signal });
	return { entries: raw.log, total: raw.total, limit: raw.limit, offset: raw.offset };
}

export async function getAdminStats(options?: RequestOptions): Promise<AdminStats> {
	return apiRequest('/admin/stats', { signal: options?.signal });
}

/** C.7 time-series response — added 2026-07-02. */
export interface AdminTimeSeriesPoint {
	ts: string;
	label: string;
	value: number;
}
export interface AdminTimeSeriesResponse {
	metric: 'revenue' | 'orders' | 'users' | 'disputes' | 'merchants';
	bucket: 'day' | 'week' | 'month';
	horizonDays: number;
	points: AdminTimeSeriesPoint[];
}
export async function getAdminTimeSeries(
	params: {
		metric?: 'revenue' | 'orders' | 'users' | 'disputes' | 'merchants';
		bucket?: 'day' | 'week' | 'month';
		days?: number;
	} = {},
	options?: RequestOptions,
): Promise<AdminTimeSeriesResponse> {
	const q = new URLSearchParams();
	if (params.metric) q.set('metric', params.metric);
	if (params.bucket) q.set('bucket', params.bucket);
	if (params.days !== undefined) q.set('days', String(params.days));
	const qs = q.toString();
	return apiRequest(`/admin/stats/timeseries${qs ? `?${qs}` : ''}`, {
		signal: options?.signal,
	});
}

// ─── Mutations ──────────────────────────────────────────────

export async function patchAdminUser(id: number, body: AdminUserUpdateBody): Promise<AdminUser> {
	return apiRequest(`/admin/users/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function patchAdminStore(id: number, body: AdminStoreUpdateBody): Promise<AdminStore> {
	return apiRequest(`/admin/stores/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function patchAdminProduct(
	id: number,
	body: AdminProductUpdateBody,
): Promise<AdminProduct> {
	return apiRequest(`/admin/products/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function patchAdminOrderStatus(
	id: number,
	body: AdminOrderStatusUpdateBody,
): Promise<AdminOrder> {
	return apiRequest(`/admin/orders/${id}/status`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function patchAdminDispute(
	id: number,
	body: AdminDisputeUpdateBody,
): Promise<AdminDispute> {
	return apiRequest(`/admin/disputes/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

// ─── K.4 client wrappers (server routes that lacked a client fn) ─────
//
// Verbatim extracted from §11.1.c of docs/MASTER_PLAN.md (2026-06-29).
// Each entry corresponds to a route in app/server/routes/*.cts that
// had no matching function in lib/api.ts — see the audit table for
// file:line cross-references.

// ── Messaging (app/server/routes/messages.cts) ──

export interface Message {
	id: number;
	sender_id: number;
	recipient_id: number;
	subject: string;
	body: string;
	related_product_id: number | null;
	related_store_id: number | null;
	related_order_id: number | null;
	is_read: number;
	read_at: string | null;
	created_at: string;
	sender_email?: string | null;
	recipient_email?: string | null;
}

export interface MessageThread extends Message {
	peer_id: number;
	peer_email: string;
	direction: 'sent' | 'received';
}

export interface InboxResponse {
	messages: MessageThread[];
	total: number;
	unread: number;
}

export async function sendMessage(body: {
	recipient_id: number;
	subject: string;
	body: string;
	related_product_id?: number | null;
	related_store_id?: number | null;
	related_order_id?: number | null;
}): Promise<{ id: number }> {
	return apiRequest('/messages/', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getInbox(): Promise<InboxResponse> {
	return apiRequest('/messages/inbox');
}

export async function getSent(): Promise<InboxResponse> {
	return apiRequest('/messages/sent');
}

export async function getConversation(
	peerId: number,
	options?: RequestOptions,
): Promise<Message[]> {
	return apiRequest(`/messages/conversation?peer_id=${peerId}`, {
		signal: options?.signal,
	});
}

export async function getUnreadMessageCount(options?: RequestOptions): Promise<{ count: number }> {
	return apiRequest('/messages/unread-count', { signal: options?.signal });
}

export async function markMessageRead(id: number, options?: RequestOptions): Promise<void> {
	return apiRequest(`/messages/${id}/read`, {
		method: 'PUT',
		signal: options?.signal,
	});
}

// ── 2FA (app/server/routes/auth-2fa.cts) ──

export interface TwoFactorSetupResponse {
	secret: string;
	otpauth_url: string;
	backup_codes: string[];
}

export interface TwoFactorEnableResponse {
	enabled: boolean;
}

export interface TwoFactorVerifyResponse {
	token: string;
	partial_token: string;
}

export async function setup2FA(): Promise<TwoFactorSetupResponse> {
	return apiRequest('/auth/2fa/setup', { method: 'POST' });
}

export async function enable2FA(body: { code: string }): Promise<TwoFactorEnableResponse> {
	return apiRequest('/auth/2fa/enable', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function verify2FA(body: {
	partial_token: string;
	code: string;
}): Promise<TwoFactorVerifyResponse> {
	return apiRequest('/auth/2fa/verify', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function disable2FA(body: { password: string }): Promise<{ disabled: boolean }> {
	return apiRequest('/auth/2fa/disable', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function regenerateBackupCodes(): Promise<{
	backup_codes: string[];
}> {
	return apiRequest('/auth/2fa/backup-codes/regenerate', { method: 'POST' });
}

// ── Search (app/server/routes/catalog.cts:387) ──

export async function searchProducts(params: {
	q: string;
	limit?: number;
	offset?: number;
}): Promise<Product[]> {
	const q = new URLSearchParams();
	q.set('q', params.q);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	return apiRequest(`/search?${q.toString()}`);
}

// ── Cart helpers (app/server/routes/cart.cts) ──

export async function getCartCount(
	userId: number,
	options?: RequestOptions,
): Promise<{ count: number }> {
	return apiRequest(`/cart/count/${userId}`, {
		signal: options?.signal,
	});
}

export async function updateCartItem(
	id: number,
	body: { quantity?: number; variant?: Record<string, string> },
): Promise<{ id: number; quantity: number; variant: string | null }> {
	return apiRequest(`/cart/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

// ── Notifications unread count ──

export async function getUnreadNotificationCount(
	userId: number,
	options?: RequestOptions,
): Promise<{ count: number }> {
	return apiRequest(`/notifications/unread-count/${userId}`, {
		signal: options?.signal,
	});
}

// ── Payment providers (app/server/routes/payments.cts:18) ──

export interface PaymentProviderListEntry {
	id: string;
	name: string;
	enabled: boolean;
	currency: string[];
}

export async function getPaymentProviders(
	options?: RequestOptions,
): Promise<PaymentProviderListEntry[]> {
	return apiRequest('/payments/methods', { signal: options?.signal });
}

// ── Store followers (app/server/routes/store-followers.cts) ──

/** Check whether the authenticated user follows `store_id`. The server
 *  (line 28) compares req.user.id with the optional `user_id` query
 *  param — so for the common case (look up self), only `store_id` is
 *  needed. The server ignores `user_id` for the caller's own role. */
export interface StoreFollowStatus {
	store_id: number;
	user_id: number;
	following: boolean;
	preferences: {
		notify_new_products: boolean;
		notify_offers: boolean;
		since: string;
	} | null;
}

export async function checkStoreFollowStatus(
	body: { store_id: number; user_id?: number },
	options?: RequestOptions,
): Promise<StoreFollowStatus> {
	const q = new URLSearchParams();
	q.set('store_id', String(body.store_id));
	if (body.user_id !== undefined) q.set('user_id', String(body.user_id));
	return apiRequest(`/store-followers/check?${q.toString()}`, {
		signal: options?.signal,
	});
}

// ─── Re-export ──────────────────────────────────────────────

export { ApiError };
