/**
 * Coupons: validate + redeem
 */

import { apiRequest } from '@/lib/api/client';
import type { RequestOptions } from '@/lib/api/client';
import type { Coupon, CouponValidation } from '@/lib/api/types';

export async function getMyCoupons(options?: RequestOptions): Promise<Coupon[]> {
	return apiRequest('/coupons/mine', { signal: options?.signal });
}


export interface ValidateCouponBody {
	code: string;
	user_id: number;
	order_subtotal: number;
}

export interface RedeemCouponBody extends ValidateCouponBody {
	order_id: number;
}

export async function validateCoupon(body: ValidateCouponBody): Promise<CouponValidation> {
	return apiRequest('/coupons/validate', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function redeemCoupon(body: RedeemCouponBody): Promise<{ id: number }> {
	return apiRequest('/coupons/redeem', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}
