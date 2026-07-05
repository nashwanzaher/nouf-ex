/**
 * Admin endpoints: user mgmt, store mgmt, product mgmt, order mgmt,
 * dispute mgmt, audit log, stats, time-series, governorate.
 *
 * All require adminAuth on the server side.
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { AdminAuditLogEntry, AdminAuditLogResponse, AdminDispute, AdminDisputeListResponse, AdminDisputeUpdateBody, AdminGovernorateResponse, AdminOrder, AdminOrderListResponse, AdminOrderStatusUpdateBody, AdminProduct, AdminProductListResponse, AdminProductUpdateBody, AdminStats, AdminStore, AdminStoreListResponse, AdminStoreUpdateBody, AdminTimeSeriesResponse, AdminUser, AdminUserListResponse, AdminUserUpdateBody } from './types';

// ─── Reads ──────────────────────────────────────────────

export async function getAdminUsers(
	params: { role?: string; is_active?: string; limit?: number; offset?: number } = {},
	options?: RequestOptions,
): Promise<AdminUserListResponse> {
	const q = new URLSearchParams();
	if (params.role) q.set('role', params.role);
	if (params.is_active) q.set('is_active', params.is_active);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/users${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminStores(
	params: { is_active?: boolean; is_verified?: boolean; limit?: number; offset?: number } = {},
	options?: RequestOptions,
): Promise<AdminStoreListResponse> {
	const q = new URLSearchParams();
	if (params.is_active !== undefined) q.set('is_active', String(params.is_active));
	if (params.is_verified !== undefined) q.set('is_verified', String(params.is_verified));
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/stores${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminProducts(
	params: {
		is_active?: boolean;
		is_featured?: boolean;
		store_id?: number;
		category_id?: number;
		limit?: number;
		offset?: number;
	} = {},
	options?: RequestOptions,
): Promise<AdminProductListResponse> {
	const q = new URLSearchParams();
	if (params.is_active !== undefined) q.set('is_active', String(params.is_active));
	if (params.is_featured !== undefined) q.set('is_featured', String(params.is_featured));
	if (params.store_id !== undefined) q.set('store_id', String(params.store_id));
	if (params.category_id !== undefined) q.set('category_id', String(params.category_id));
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/products${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminOrders(
	params: { status?: string; payment_status?: string; limit?: number; offset?: number } = {},
	options?: RequestOptions,
): Promise<AdminOrderListResponse> {
	const q = new URLSearchParams();
	if (params.status) q.set('status', params.status);
	if (params.payment_status) q.set('payment_status', params.payment_status);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/orders${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminDisputes(
	params: { status?: string; limit?: number; offset?: number } = {},
	options?: RequestOptions,
): Promise<AdminDisputeListResponse> {
	const q = new URLSearchParams();
	if (params.status) q.set('status', params.status);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	return apiRequest(`/admin/disputes${qs ? `?${qs}` : ''}`, { signal: options?.signal });
}

export async function getAdminAuditLog(
	params: {
		action?: string;
		entity_type?: string;
		user_id?: number;
		limit?: number;
		offset?: number;
	} = {},
	options?: RequestOptions,
): Promise<AdminAuditLogResponse> {
	const q = new URLSearchParams();
	if (params.user_id !== undefined) q.set('user_id', String(params.user_id));
	if (params.action) q.set('action', params.action);
	if (params.entity_type) q.set('entity_type', params.entity_type);
	if (params.limit !== undefined) q.set('limit', String(params.limit));
	if (params.offset !== undefined) q.set('offset', String(params.offset));
	const qs = q.toString();
	// Server response shape is { log, total, limit, offset }
	// (server/routes/admin.cts:364) but client surface uses 'entries'.
	const raw = await apiRequest<{
		log: AdminAuditLogEntry[];
		total: number;
		limit: number;
		offset: number;
	}>(`/admin/audit-log${qs ? `?${qs}` : ''}`, { signal: options?.signal });
	return { entries: raw.log, total: raw.total, limit: raw.limit, offset: raw.offset };
}

export async function getAdminStats(options?: RequestOptions): Promise<AdminStats> {
	return apiRequest('/admin/stats', { signal: options?.signal });
}

export async function getAdminTimeSeries(
	params: {
		metric?: 'revenue' | 'orders' | 'users' | 'disputes' | 'merchants';
		bucket?: 'day' | 'week' | 'month';
		days?: number;
	} = {},
	options?: RequestOptions,
): Promise<AdminTimeSeriesResponse> {
	const q = new URLSearchParams();
	if (params.metric) q.set('metric', params.metric);
	if (params.bucket) q.set('bucket', params.bucket);
	if (params.days !== undefined) q.set('days', String(params.days));
	const qs = q.toString();
	return apiRequest(`/admin/stats/timeseries${qs ? `?${qs}` : ''}`, {
		signal: options?.signal,
	});
}

export async function getAdminGovernorate(
	params: {
		scope?: 'stores' | 'addresses' | 'merchants';
		top?: number;
	} = {},
	options?: RequestOptions,
): Promise<AdminGovernorateResponse> {
	const q = new URLSearchParams();
	if (params.scope) q.set('scope', params.scope);
	if (params.top !== undefined) q.set('top', String(params.top));
	const qs = q.toString();
	return apiRequest(`/admin/stats/by-governorate${qs ? `?${qs}` : ''}`, {
		signal: options?.signal,
	});
}

// ─── Mutations ──────────────────────────────────────────────

export async function patchAdminUser(id: number, body: AdminUserUpdateBody): Promise<AdminUser> {
	return apiRequest(`/admin/users/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function patchAdminStore(id: number, body: AdminStoreUpdateBody): Promise<AdminStore> {
	return apiRequest(`/admin/stores/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function patchAdminProduct(
	id: number,
	body: AdminProductUpdateBody,
): Promise<AdminProduct> {
	return apiRequest(`/admin/products/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function patchAdminOrderStatus(
	id: number,
	body: AdminOrderStatusUpdateBody,
): Promise<AdminOrder> {
	return apiRequest(`/admin/orders/${id}/status`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}

export async function patchAdminDispute(
	id: number,
	body: AdminDisputeUpdateBody,
): Promise<AdminDispute> {
	return apiRequest(`/admin/disputes/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(body),
	});
}
