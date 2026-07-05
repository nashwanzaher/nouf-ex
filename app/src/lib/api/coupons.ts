/**
 * Coupons: validate + redeem
 */

import { apiRequest } from './client';
import type { CouponValidation } from './types';

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
