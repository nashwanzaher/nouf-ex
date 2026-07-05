/**
 * Shipping addresses: CRUD
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { Address } from './types';

export interface CreateAddressBody {
	label: string;
	full_name: string;
	phone: string;
	governorate: string;
	city: string;
	district?: string;
	street: string;
	building?: string;
	notes?: string;
	is_default?: boolean;
}

export async function getAddresses(userId: number, options?: RequestOptions): Promise<Address[]> {
	return apiRequest(`/addresses?user_id=${userId}`, { signal: options?.signal });
}

export async function createAddress(body: CreateAddressBody): Promise<Address> {
	return apiRequest('/addresses', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function updateAddress(id: number, body: CreateAddressBody): Promise<Address> {
	return apiRequest(`/addresses/${id}`, {
		method: 'PUT',
		body: JSON.stringify(body),
	});
}

export async function deleteAddress(id: number): Promise<{ id: number }> {
	return apiRequest(`/addresses/${id}`, {
		method: 'DELETE',
	});
}
