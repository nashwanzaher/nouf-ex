/**
 * Nouf-ex shared types — consumed by both web and api workspaces.
 *
 * This file mirrors the frontend API entity contracts. Body types for
 * POST/PUT/PATCH endpoints are intentionally kept in domain modules to
 * keep this package from ballooning.
 */

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

export interface AuthResponse {
	user: User;
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
	verified: boolean;
}

export type ErrorCode =
	| 'VALIDATION_ERROR'
	| 'UNAUTHORIZED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'INTERNAL_ERROR'
	| 'BAD_REQUEST'
	| 'DUPLICATE'
	| 'INSERT_FAILED'
	| 'PARTIAL_INVALID'
	| string;
