/**
 * Catalog: products, stores, categories, search
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { Category, CategoryWithProducts, Product, ProductFilters, ProductWithDetails, Review, Store, StoreWithProducts } from './types';

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

// ─── Search ─────────────────────────────────────────────────

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
