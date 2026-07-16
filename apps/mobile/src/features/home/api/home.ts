/**
 * Home API wrapper (Phase 5).
 *
 * Mirrors the web `features/home/api/home.ts` shape. Used by the
 * home screen; cached for 30s on the API side (Redis).
 */
import { api } from '@/lib/api/client';

export interface HomeStats {
	counts: {
		products: number;
		stores: number;
		orders: number;
		users: number;
	};
	featured: Array<{
		id: number;
		name_ar: string;
		name_en: string | null;
		name_zh: string | null;
		price: number;
		currency: string;
		main_image: string | null;
	}>;
	deals: Array<{
		id: number;
		name_ar: string;
		name_en: string | null;
		name_zh: string | null;
		price: number;
		original_price?: number | null;
		currency: string;
		main_image: string | null;
		deal_discount: number;
	}>;
}

export async function fetchHomeStats(): Promise<HomeStats> {
	return api.get<HomeStats>('/api/stats/home');
}