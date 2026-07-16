/**
 * System: home stats + readiness probe
 *
 * `getSystemHealth` bypasses `apiRequest` because /api/ready does NOT
 * follow the standard `{ success, data }` envelope — the body is the
 * payload directly. `getHomeStats` uses the standard path and maps
 * the API response (`counts.products`) to the expected type
 * (`products_count`).
 */

import type { RequestOptions } from '@/lib/api/client';
import { API_BASE, apiRequest } from '@/lib/api/client';
import type { HomeStats, SystemHealth } from '@/lib/api/types';

interface StatsApiResponse {
	counts: {
		products: string | number;
		stores: string | number;
		orders: string | number;
		users: string | number;
	};
	featured?: unknown[];
	deals?: unknown[];
}

export async function getHomeStats(options?: RequestOptions): Promise<HomeStats> {
	const raw = (await apiRequest('/stats/home', { signal: options?.signal })) as unknown as StatsApiResponse;
	const counts = raw?.counts ?? {};
	return {
		products_count: Number(counts.products ?? 0),
		stores_count: Number(counts.stores ?? 0),
		orders_count: Number(counts.orders ?? 0),
		users_count: Number(counts.users ?? 0),
		featured_products: (raw?.featured ?? []) as HomeStats['featured_products'],
		deals: (raw?.deals ?? []) as HomeStats['deals'],
		categories: [],
	};
}

export async function getSystemHealth(options?: RequestOptions): Promise<SystemHealth> {
	const url = `${API_BASE}/ready`;
	const response = await fetch(url, {
		signal: options?.signal,
	});
	const json = (await response.json()) as SystemHealth;
	if (!response.ok || json.status === 'degraded') {
		return json;
	}
	return json;
}
