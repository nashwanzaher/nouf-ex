/**
 * Shipping methods (read-only)
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { ShippingMethod } from './types';

export async function getShippingMethods(
	weightKg = 1,
	options?: RequestOptions,
): Promise<ShippingMethod[]> {
	return apiRequest(`/shipping/methods?weight_kg=${weightKg}`, { signal: options?.signal });
}
