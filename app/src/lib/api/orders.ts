/**
 * Orders: read single + list + create
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { Order, OrderWithItems } from './types';

export interface CreateOrderBody {
	/** @deprecated The server overrides this with `req.user.id` (P0-4).
	 *  Kept optional for backwards compatibility. */
	customerId?: number;
	storeId?: number;
	items: Array<{
		productId: number;
		quantity: number;
		unitPrice: number;
		totalPrice?: number;
		variant?: Record<string, string>;
	}>;
	shippingAddress?: Record<string, string>;
	paymentMethod?: string;
	notes?: string;
	subtotal?: number;
	shippingCost?: number;
	discount?: number;
	total: number;
}

export async function getOrders(customerId?: number, options?: RequestOptions): Promise<Order[]> {
	const params = customerId ? `?customerId=${customerId}` : '';
	return apiRequest(`/orders${params}`, { signal: options?.signal });
}

export async function getOrder(id: number, options?: RequestOptions): Promise<OrderWithItems> {
	return apiRequest(`/orders/${id}`, { signal: options?.signal });
}

export async function createOrder(body: CreateOrderBody): Promise<{
	id: number;
	orderNumber: string;
	discount: number;
	total: number;
}> {
	return apiRequest('/orders', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}
