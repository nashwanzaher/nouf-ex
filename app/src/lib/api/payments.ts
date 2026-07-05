/**
 * Payments: create + read + confirm + list providers
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { Payment, PaymentProviderListEntry } from './types';

export interface CreatePaymentBody {
	order_id: number;
	amount: number;
	currency?: string;
	method: Payment['method'];
	transaction_id?: string;
}

export async function createPayment(
	body: CreatePaymentBody,
): Promise<{ id: number; status: string; idempotent?: boolean }> {
	return apiRequest('/payments', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getOrderPayments(orderId: number): Promise<Payment[]> {
	return apiRequest(`/payments/order/${orderId}`);
}

export async function confirmPayment(id: number): Promise<{ order_id: number }> {
	return apiRequest(`/payments/${id}/confirm`, {
		method: 'POST',
	});
}

export async function getPaymentProviders(
	options?: RequestOptions,
): Promise<PaymentProviderListEntry[]> {
	return apiRequest('/payments/methods', { signal: options?.signal });
}
