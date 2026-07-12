/**
 * Coupons feature public surface.
 */
export {
	redeemCoupon,
	validateCoupon,
	 type RedeemCouponBody,
	 type ValidateCouponBody,
} from './api/coupons';

export type { CouponValidation } from '@/lib/api/types';
