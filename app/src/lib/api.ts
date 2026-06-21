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
	customerId: number;
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

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
	const url = `${API_BASE}${endpoint}`;
	const config: RequestInit = {
		headers: {
			'Content-Type': 'application/json',
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
	filters: ProductFilters = {}
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
	return apiRequest(`/products${query ? `?${query}` : ''}`);
}

export async function getProduct(id: number): Promise<ProductWithDetails> {
	return apiRequest(`/products/${id}`);
}

export async function getFeaturedProducts(): Promise<Product[]> {
	return apiRequest('/products/featured');
}

export async function getDeals(): Promise<Product[]> {
	return apiRequest('/products/deals');
}

// ─── Stores API ─────────────────────────────────────────────

export async function getStores(): Promise<Store[]> {
	return apiRequest('/stores');
}

export async function getStore(id: number): Promise<StoreWithProducts> {
	return apiRequest(`/stores/${id}`);
}

export async function getStoreReviews(id: number): Promise<Review[]> {
	return apiRequest(`/stores/${id}/reviews`);
}

// ─── Categories API ─────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
	return apiRequest('/categories');
}

export async function getCategory(slug: string): Promise<CategoryWithProducts> {
	return apiRequest(`/categories/${slug}`);
}

// ─── Reviews API ────────────────────────────────────────────

export async function getReviews(filters: ReviewFilters = {}): Promise<Review[]> {
	const params = new URLSearchParams();
	if (filters.productId) params.set('productId', String(filters.productId));
	if (filters.storeId) params.set('storeId', String(filters.storeId));

	const query = params.toString();
	return apiRequest(`/reviews${query ? `?${query}` : ''}`);
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

export async function getOrders(customerId?: number): Promise<Order[]> {
	const params = customerId ? `?customerId=${customerId}` : '';
	return apiRequest(`/orders${params}`);
}

export async function getOrder(id: number): Promise<OrderWithItems> {
	return apiRequest(`/orders/${id}`);
}

export async function createOrder(body: CreateOrderBody): Promise<{
	id: number;
	orderNumber: string;
}> {
	return apiRequest('/orders', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

// ─── Cart API ───────────────────────────────────────────────

export async function getCart(userId: number): Promise<CartItem[]> {
	return apiRequest(`/cart/${userId}`);
}

export async function addToCart(body: {
	userId: number;
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

export async function getWishlist(userId: number): Promise<WishlistItem[]> {
	return apiRequest(`/wishlist/${userId}`);
}

export async function addToWishlist(body: {
	userId: number;
	productId: number;
}): Promise<{ id: number }> {
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

export async function getNotifications(userId: number): Promise<Notification[]> {
	return apiRequest(`/notifications/${userId}`);
}

export async function markNotificationAsRead(id: number): Promise<void> {
	return apiRequest(`/notifications/${id}/read`, {
		method: 'PUT',
	});
}

// ─── Auth API ───────────────────────────────────────────────

export async function login(body: { email: string; password: string }): Promise<User> {
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
}): Promise<User> {
	return apiRequest('/auth/register', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getCurrentUser(userId: number): Promise<User> {
	return apiRequest('/auth/me', {
		headers: {
			'x-user-id': String(userId),
		},
	});
}

// ─── Stats API ──────────────────────────────────────────────

export async function getHomeStats(): Promise<HomeStats> {
	return apiRequest('/stats/home');
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
	body: CreatePaymentBody
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

export async function getAddresses(userId: number): Promise<Address[]> {
	return apiRequest(`/addresses?user_id=${userId}`);
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

export async function getShippingMethods(weightKg = 1): Promise<ShippingMethod[]> {
	return apiRequest(`/shipping/methods?weight_kg=${weightKg}`);
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
	body: ResolveRefundBody
): Promise<{ id: number; status: string }> {
	return apiRequest(`/refunds/${id}/resolve`, {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

// ─── Re-export ──────────────────────────────────────────────

export { ApiError };
