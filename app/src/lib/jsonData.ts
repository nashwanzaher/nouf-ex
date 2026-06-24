/**
 * Nouf-ex JSON Data Service
 * Reads data from exported JSON files (build-time database snapshot)
 * This ensures the static deployment has real database data
 */

import type { Product, Store, Category, Review, Order, HomeStats } from './api';

let cache: Record<string, unknown> = {};

async function loadJson<T>(filename: string): Promise<T> {
	if (cache[filename]) return cache[filename] as T;
	const res = await fetch(`/data/${filename}.json`);
	if (!res.ok) throw new Error(`Failed to load ${filename}`);
	const data = await res.json();
	cache[filename] = data;
	return data;
}

// ─── Products ─────────────────────────────────────────────
export async function getProductsJson(filters?: {
	category?: string;
	search?: string;
	store?: number;
	minPrice?: number;
	maxPrice?: number;
	sort?: string;
	limit?: number;
	offset?: number;
}): Promise<{ products: Product[]; total: number }> {
	let products = await loadJson<Product[]>('products');

	if (filters?.search) {
		const q = filters.search.toLowerCase();
		products = products.filter(
			(p) =>
				p.name_ar?.toLowerCase().includes(q) ||
				p.name_en?.toLowerCase().includes(q) ||
				p.name_zh?.includes(q) ||
				p.description?.toLowerCase().includes(q),
		);
	}

	if (filters?.category) {
		const cats = await loadJson<Category[]>('categories');
		const cat = cats.find((c) => c.slug === filters.category);
		if (cat) {
			products = products.filter((p) => p.category_id === cat.id);
		}
	}

	if (filters?.store) {
		products = products.filter((p) => p.store_id === filters.store);
	}

	if (filters?.minPrice !== undefined) {
		products = products.filter((p) => p.price >= (filters.minPrice || 0));
	}
	if (filters?.maxPrice !== undefined) {
		products = products.filter((p) => p.price <= (filters.maxPrice || Infinity));
	}

	// Sort
	const sort = filters?.sort;
	if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
	else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
	else if (sort === 'popular') products.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
	else products.sort((a, b) => b.id - a.id); // newest

	const total = products.length;
	const limit = filters?.limit || 50;
	const offset = filters?.offset || 0;
	products = products.slice(offset, offset + limit);

	return { products, total };
}

export async function getProductJson(id: number): Promise<Product | null> {
	const products = await loadJson<Product[]>('products');
	const product = products.find((p) => p.id === id) || null;
	if (product) {
		const stores = await loadJson<Store[]>('stores');
		const reviews = await loadJson<Review[]>('reviews');
		(product as Product & { store: Store | null; reviews: Review[] }).store =
			stores.find((s) => s.id === product.store_id) || null;
		(product as Product & { store: Store | null; reviews: Review[] }).reviews = reviews.filter(
			(r) => r.product_id === id,
		);
	}
	return product;
}

export async function getFeaturedProductsJson(): Promise<Product[]> {
	const products = await loadJson<Product[]>('products');
	return products.filter((p) => p.is_featured).slice(0, 10);
}

export async function getDealsJson(): Promise<Product[]> {
	const products = await loadJson<Product[]>('products');
	return products.filter((p) => p.deal_discount && p.deal_discount > 0);
}

// ─── Stores ─────────────────────────────────────────────
export async function getStoresJson(): Promise<Store[]> {
	return loadJson<Store[]>('stores');
}

export async function getStoreJson(id: number): Promise<(Store & { products: Product[] }) | null> {
	const stores = await loadJson<Store[]>('stores');
	const store = stores.find((s) => s.id === id) || null;
	if (!store) return null;
	const products = await loadJson<Product[]>('products');
	return { ...store, products: products.filter((p) => p.store_id === id) };
}

// ─── Categories ─────────────────────────────────────────
export async function getCategoriesJson(): Promise<Category[]> {
	return loadJson<Category[]>('categories');
}

// ─── Reviews ────────────────────────────────────────────
export async function getReviewsJson(productId?: number, storeId?: number): Promise<Review[]> {
	const reviews = await loadJson<Review[]>('reviews');
	if (productId) return reviews.filter((r) => r.product_id === productId);
	if (storeId) return reviews.filter((r) => r.store_id === storeId);
	return reviews;
}

// ─── Home Stats ─────────────────────────────────────────
export async function getHomeStatsJson(): Promise<HomeStats> {
	return loadJson<HomeStats>('stats');
}

// ─── Orders ─────────────────────────────────────────────
export async function getOrdersJson(customerId?: number): Promise<Order[]> {
	const orders = await loadJson<Order[]>('orders');
	if (customerId) return orders.filter((o) => o.customer_id === customerId);
	return orders;
}

export async function getOrderJson(id: number): Promise<Order | null> {
	const orders = await loadJson<Order[]>('orders');
	return orders.find((o) => o.id === id) || null;
}

// ─── Clear cache ────────────────────────────────────────
export function clearDataCache() {
	cache = {};
}
