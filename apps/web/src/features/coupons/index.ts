/**
 * Coupons feature public surface.
 */
export {
	getMyCoupons,
	redeemCoupon,
	validateCoupon,
	 type RedeemCouponBody,
	 type ValidateCouponBody,
} from './api/coupons';

export type { Coupon, CouponValidation } from '@/lib/api/types';
