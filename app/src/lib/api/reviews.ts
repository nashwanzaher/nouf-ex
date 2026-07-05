/**
 * Reviews: read + create
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { Review, ReviewFilters } from './types';

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
