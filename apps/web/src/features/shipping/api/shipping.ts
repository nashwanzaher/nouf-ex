/**
 * Shipping methods (read-only)
 */

import type { RequestOptions } from '@/lib/api/client';
import { apiRequest } from '@/lib/api/client';
import type { ShippingMethod } from '@/lib/api/types';

export async function getShippingMethods(
	weightKg = 1,
	options?: RequestOptions,
): Promise<ShippingMethod[]> {
	return apiRequest(`/shipping/methods?weight_kg=${weightKg}`, { signal: options?.signal });
}
