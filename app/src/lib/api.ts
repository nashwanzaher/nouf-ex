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
	is_default: number;
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
	user_id: number;
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

// ─── Stats API ──────────────────────────────────────────────

export async function getHomeStats(options?: RequestOptions): Promise<HomeStats> {
	return apiRequest('/stats/home', { signal: options?.signal });
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

// ─── Re-export ──────────────────────────────────────────────

export { ApiError };
