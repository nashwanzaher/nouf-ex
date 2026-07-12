/**
 * Seller (merchant) endpoints: store, products, orders, analytics, payouts
 */

import { apiRequest } from '@/lib/api/client';
import type { Product, ProductWithDetails, SellerAnalytics, SellerBalance, SellerDashboard, SellerInventoryItem, SellerOrder, SellerOrderWithItems, SellerPayout, SellerProductCreate, SellerStore, SellerStoreCreate, SellerStoreUpdate } from '@/lib/api/types';

export async function getSellerStoreMe(): Promise<SellerStore> {
	return apiRequest('/seller/stores/me');
}

/**
 * G4 fix 2026-07-11: create the caller's first store.
 * Throws on 409 if a store already exists (use `getSellerStoreMe` /
 * `updateSellerStore` to manage it instead).
 */
export async function createSellerStore(body: SellerStoreCreate): Promise<SellerStore> {
	return apiRequest('/seller/stores', {
		method: 'POST',
		body: JSON.stringify(body),
	});
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
