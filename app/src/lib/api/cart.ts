/**
 * Cart + Wishlist + Store followers
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { CartItem, StoreFollowStatus, WishlistItem } from './types';

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

// ─── Store followers ────────────────────────────────────────

/** Check whether the authenticated user follows `store_id`. The server
 *  compares req.user.id with the optional `user_id` query param — so
 *  for the common case (look up self), only `store_id` is needed.
 *  The server ignores `user_id` for the caller's own role. */
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

export async function followStore(body: {
	store_id: number;
	notify_new_products?: boolean;
	notify_offers?: boolean;
}): Promise<{ id: number; store_id: number; following: boolean }> {
	return apiRequest('/store-followers', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function unfollowStore(
	store_id: number,
): Promise<{ store_id: number; following: boolean; removed: boolean }> {
	return apiRequest('/store-followers', {
		method: 'DELETE',
		body: JSON.stringify({ store_id }),
	});
}
