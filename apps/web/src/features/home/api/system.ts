/**
 * System: home stats + readiness probe
 *
 * `getSystemHealth` bypasses `apiRequest` because /api/ready does NOT
 * follow the standard `{ success, data }` envelope — the body is the
 * payload directly. `getHomeStats` uses the standard path.
 */

import type { RequestOptions } from '@/lib/api/client';
import { API_BASE, apiRequest } from '@/lib/api/client';
import type { HomeStats, SystemHealth } from '@/lib/api/types';

export async function getHomeStats(options?: RequestOptions): Promise<HomeStats> {
	return apiRequest('/stats/home', { signal: options?.signal });
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
