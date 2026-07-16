/**
 * Products API wrapper (mobile) — Phase 5.
 *
 * Mirrors `apps/web/src/features/products/api/products.ts` and adds
 * the Elasticsearch-backed `search()` + `suggest()` calls. The
 * server decides whether to use ES or PG FTS internally; the client
 * only sees a unified response shape.
 */
import { api } from '@/lib/api/client';
import type { ProductCardData } from '@/features/products/components/ProductCard';

export interface ProductsListResponse {
	products: ProductCardData[];
	total: number;
	limit: number;
	offset: number;
}

export interface CategoriesResponse {
	categories: Array<{
		id: number;
		slug: string;
		name_ar: string;
		name_en: string | null;
		name_zh: string | null;
		product_count: number;
	}>;
}

export async function fetchProducts(filters: {
	category?: string;
	search?: string;
	store?: number;
	minPrice?: number;
	maxPrice?: number;
	sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'best_selling';
	limit?: number;
	offset?: number;
} = {}): Promise<ProductsListResponse> {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(filters)) {
		if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
	}
	const path = qs.toString() ? `/api/products?${qs}` : '/api/products';
	return api.get<ProductsListResponse>(path);
}

export async function fetchProduct(id: number): Promise<ProductCardData & {
	store: { id: number; store_name: string } | null;
	reviews: Array<unknown>;
	images: Array<unknown>;
	description: string | null;
	stock: number;
}> {
	return api.get(`/api/products/${id}`);
}

export async function fetchCategories(): Promise<CategoriesResponse> {
	return api.get<CategoriesResponse>('/api/categories');
}

export async function searchProducts(q: string, limit = 20): Promise<{
	products: ProductCardData[];
	total: number;
	duration_ms: number;
	source: string;
	facets?: { categories: Array<{ key: string; count: number }>; priceRanges: Array<{ key: string; count: number }> };
}> {
	return api.get(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

export async function suggestProducts(prefix: string): Promise<{
	suggestions: Array<{ text: string; score: number }>;
}> {
	return api.get(`/api/search/suggest?q=${encodeURIComponent(prefix)}`);
}