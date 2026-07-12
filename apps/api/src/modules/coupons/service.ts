import * as repo from './repository.ts';
import { computeCouponDiscount } from '../../lib/shared.ts';

export type ValidateResult =
	| { ok: true; data: { code: string; type: string; value: number; discount: number; final_total: number } }
	| { ok: false; error: string };

export async function validateCoupon(
	code: string,
	orderSubtotal: number,
	userId: number,
): Promise<ValidateResult> {
	const coupon = await repo.findByCode(code);
	if (!coupon) return { ok: false, error: 'Coupon not found or inactive' };

	if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
		return { ok: false, error: 'Coupon has expired' };
	if (coupon.starts_at && new Date(coupon.starts_at) > new Date())
		return { ok: false, error: 'Coupon is not yet active' };
	if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit)
		return { ok: false, error: 'Coupon usage limit reached' };

	const userUsage = await repo.getUserUsageCount(coupon.id, userId);
	if (userUsage >= coupon.per_user_limit)
		return { ok: false, error: 'Coupon usage limit reached for this account' };

	if (coupon.min_order != null && orderSubtotal < coupon.min_order) {
		return {
			ok: false,
			error: `Minimum order for this coupon is ${coupon.min_order.toLocaleString()}`,
		};
	}

	const discount = await computeCouponDiscount(coupon, orderSubtotal);
	return {
		ok: true,
		data: {
			code: coupon.code,
			type: coupon.type,
			value: coupon.value,
			discount,
			final_total: Math.round((orderSubtotal - discount) * 100) / 100,
		},
	};
}

export type RedeemResult =
	| { ok: true; id: number; discount: number; alreadyRedeemed?: false }
	| { ok: true; id: number; alreadyRedeemed: true }
	| { ok: false; error: string; status: 400 | 403 | 404 };

export async function redeemCoupon(
	code: string,
	orderId: number,
	userId: number,
): Promise<RedeemResult> {
	const coupon = await repo.findByCode(code);
	if (!coupon) return { ok: false, error: 'Coupon not found', status: 404 };

	const orderOwner = await repo.getOrderOwner(orderId);
	if (!orderOwner) return { ok: false, error: 'Order not found', status: 404 };
	if (orderOwner.customer_id !== userId)
		return { ok: false, error: 'Forbidden', status: 403 };

	const already = await repo.findExistingUsage(coupon.id, userId, orderId);
	if (already) return { ok: true, id: (already as { id: number }).id, alreadyRedeemed: true };

	const userUsage = await repo.getUserUsageCount(coupon.id, userId);
	if (userUsage >= coupon.per_user_limit)
		return { ok: false, error: 'Coupon usage limit reached for this account', status: 400 };

	const order = await repo.getOrderSubtotal(orderId);
	if (!order) return { ok: false, error: 'Order not found', status: 404 };
	const discount = await computeCouponDiscount(coupon, Number(order.subtotal));

	const tx = await repo.redeemTx(coupon.id, userId, orderId, discount);
	return { ok: true, id: tx.id, discount };
}