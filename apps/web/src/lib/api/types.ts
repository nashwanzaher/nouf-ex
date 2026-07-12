/**
 * Nouf-ex Frontend API — shared types
 *
 * All entity interfaces (Product, Order, User, etc.) live here so domain
 * modules can import them without circular dependencies. Body types for
 * POST/PUT/PATCH endpoints are co-located with their owning domain file
 * to keep this module from ballooning.
 */

// ─── Catalog: Products, Stores, Categories ──────────────────

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
	image_url?: string;
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

/** Review as returned by /api/customer/my-reviews (includes product & store names) */
export interface MyReview {
	id: number;
	product_id: number;
	store_id: number;
	rating: number;
	title: string | null;
	comment: string | null;
	images: string[] | null;
	is_verified: boolean;
	is_visible: boolean;
	merchant_reply: string | null;
	merchant_replied_at: string | null;
	created_at: string;
	updated_at: string;
	product_name_en: string | null;
	product_name_ar: string | null;
	main_image: string | null;
	store_name: string;
}

// ─── Orders, Cart, Wishlist ─────────────────────────────────

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

// ─── User, Notification, Address ────────────────────────────

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

// ─── Shipping, Coupon, Refund, HomeStats ────────────────────

export interface ShippingMethod {
	id: number;
	name_ar: string;
	name_en: string;
	base_cost: number;
	per_kg_cost: number | null;
	estimated_days: number | null;
	estimated_total?: number;
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

// ─── Auth, 2FA ──────────────────────────────────────────────

export interface AuthResponse {
	user: User;
	/** Optional. Legacy/local-mirror of the auth token for callers that
	 *  still want it in JS. The server's authoritative token is set as
	 *  an HttpOnly cookie and is not accessible from the browser — this
	 *  field may be absent (or still present for backward-compat with
	 *  older server builds) depending on the deployment. */
	token?: string;
}

export interface UpdateProfileBody {
	full_name?: string;
	phone?: string;
	avatar?: string | null;
	preferred_language?: 'ar' | 'en' | 'zh';
	gender?: 'male' | 'female' | 'other' | null;
}

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

// ─── Payments ───────────────────────────────────────────────

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

export interface PaymentProviderListEntry {
	id: string;
	name: string;
	enabled: boolean;
	currency: string[];
}

// ─── Messaging ──────────────────────────────────────────────

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

// ─── Store followers ────────────────────────────────────────

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

// ─── System Health ──────────────────────────────────────────

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

// ─── Seller ─────────────────────────────────────────────────

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
	category_id: number;
	price: number;
	original_price?: number;
	stock?: number;
	description?: string;
	main_image?: string;
	features?: Array<Record<string, unknown>>;
	badges?: string[];
	specifications?: Record<string, unknown>;
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

/**
 * Body for POST /api/seller/stores — G4 fix 2026-07-11.
 * A merchant creates their first store. All fields except `store_name`
 * are optional; the server stamps `owner_id`, `slug`, `trust_level`,
 * and `since_year` automatically.
 */
export interface SellerStoreCreate {
	store_name: string;
	description?: string;
	governorate?: string;
	city?: string;
}

// ─── Admin ──────────────────────────────────────────────────

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

export interface AdminStore extends Omit<Store, 'is_verified'> {
	is_verified: number;
}

export interface AdminProduct extends Omit<Product, never> {
	is_active: number;
	is_featured: number;
}

export interface AdminOrder extends Order {
	customer_email?: string;
	customer_name?: string;
}

export interface AdminDispute {
	id: number;
	order_id: number;
	customer_id: number;
	store_id: number;
	type: string;
	status:
		| 'open'
		| 'investigating'
		| 'resolved_buyer'
		| 'resolved_seller'
		| 'closed'
		| 'rejected';
	priority: 'low' | 'normal' | 'high' | 'urgent';
	subject: string;
	description: string;
	evidence: unknown;
	refund_amount: number | null;
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
	trust_level?: 'verified' | 'golden' | 'diamond';
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
	status?:
		| 'open'
		| 'investigating'
		| 'resolved_buyer'
		| 'resolved_seller'
		| 'closed'
		| 'rejected';
	resolution?: string;
	refund_amount?: number;
}

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

export interface AdminGovernorate {
	name: string;
	count: number;
	percent: number;
}

export interface AdminGovernorateResponse {
	scope: 'stores' | 'addresses' | 'merchants';
	top: number;
	total: number;
	governorates: AdminGovernorate[];
}

// ─── Query & Filter Types (used by multiple domains) ───────

export interface ProductFilters {
	category?: string;
	search?: string;
	store?: number;
	storeId?: number;
	minPrice?: number;
	maxPrice?: number;
	sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
	limit?: number;
	offset?: number;
	onSale?: boolean;
}

export interface ReviewFilters {
	productId?: number;
	storeId?: number;
}
