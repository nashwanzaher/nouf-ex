/**
 * Refunds: request + admin resolve
 */

import { apiRequest } from '@/lib/api/client';

export interface CreateRefundBody {
	order_id: number;
	user_id: number;
	amount: number;
	reason: string;
}

export interface ResolveRefundBody {
	status: 'approved' | 'rejected';
	admin_notes?: string;
}

export async function createRefund(body: CreateRefundBody): Promise<{ id: number }> {
	return apiRequest('/refunds', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function resolveRefund(
	id: number,
	body: ResolveRefundBody,
): Promise<{ id: number; status: string }> {
	return apiRequest(`/refunds/${id}/resolve`, {
		method: 'POST',
		body: JSON.stringify(body),
	});
}
