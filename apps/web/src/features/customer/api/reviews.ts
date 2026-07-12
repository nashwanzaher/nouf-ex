/**
 * Reviews API client.
 *
 * Endpoints used by the Customer Reviews dashboard
 * (apps/web/src/features/customer/components/Reviews.tsx):
 *   GET  /api/reviews                  ?productId=&storeId=     (public, paginated)
 *   POST /api/reviews                                      (auth, writes a review)
 *   GET  /api/customer/pending-reviews                     (auth, eligible items)
 *   GET  /api/customer/my-reviews                          (auth, customer's reviews)
 *   DELETE /api/reviews/:id                                (auth, owner only)
 *
 * The 'pending' and 'my-reviews' endpoints are added in commit
 * a8... / PR title "feat(api): customer reviews dashboard".
 */
import type { RequestOptions } from '@/lib/api/client';
import { apiRequest } from '@/lib/api/client';
import type { Review, ReviewFilters } from '@/lib/api/types';

/**
 * GET /api/reviews — public list (filtered server-side by is_visible=TRUE).
 */
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

/**
 * POST /api/reviews — write a review. The backend derives customer_id
 * and store_id server-side; clients send only productId + rating + comment.
 */
export async function createReview(body: {
	productId: number;
	storeId?: number;
	customerId?: number; // legacy field; ignored by the backend
	rating: number;
	title?: string;
	comment: string;
}): Promise<{ id: number }> {
	return apiRequest('/reviews', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

/** DELETE /api/reviews/:id — owner only. */
export async function deleteReview(id: number): Promise<{ ok: boolean }> {
	return apiRequest(`/reviews/${id}`, { method: 'DELETE' });
}

/** GET /api/customer/pending-reviews — items the customer can review. */
export interface PendingReview {
	order_item_id: number;
	order_id: number;
	product_id: number;
	quantity: number;
	order_number: string;
	delivered_at: string | null;
	ordered_at: string;
	product_name_en: string | null;
	product_name_ar: string;
	main_image: string | null;
	store_id: number;
	store_name: string;
}

export async function getPendingReviews(
	options?: RequestOptions,
): Promise<PendingReview[]> {
	return apiRequest('/customer/pending-reviews', { signal: options?.signal });
}

/** GET /api/customer/my-reviews — reviews written by the customer. */
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

export async function getMyReviews(
	options?: RequestOptions,
): Promise<MyReview[]> {
	return apiRequest('/customer/my-reviews', { signal: options?.signal });
}
