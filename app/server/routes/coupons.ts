import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	couponRedeemSchema,
	COUPON_COLUMNS,
	computeCouponDiscount,
	type CouponRow,
} from '../lib/shared.ts';

export const couponsRouter = Router();

couponsRouter.post('/validate', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(couponRedeemSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { code, order_subtotal } = v.data;

		const coupon = (await db
			.prepare(`SELECT ${COUPON_COLUMNS} FROM coupons WHERE code = ? AND is_active = TRUE`)
			.get(code)) as CouponRow | undefined;

		if (!coupon) return sendError(res, 'Coupon not found or inactive', 404);
		if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
			return sendError(res, 'Coupon has expired', 400);
		}
		if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
			return sendError(res, 'Coupon is not yet active', 400);
		}
		if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
			return sendError(res, 'Coupon usage limit reached', 400);
		}

		const userUsageRow = (await db
			.prepare(
				`SELECT COUNT(*)::int AS c FROM coupon_usage WHERE coupon_id = ? AND user_id = ?`,
			)
			.get(coupon.id, req.user!.id)) as { c: number } | undefined;
		const userUsageCount = userUsageRow?.c ?? 0;
		if (userUsageCount >= coupon.per_user_limit) {
			return sendError(res, 'Coupon usage limit reached for this account', 400);
		}

		if (coupon.min_order != null && order_subtotal < coupon.min_order) {
			return sendError(
				res,
				`Minimum order for this coupon is ${coupon.min_order.toLocaleString()}`,
				400,
			);
		}

		const discount = await computeCouponDiscount(coupon, order_subtotal);

		sendSuccess(res, {
			code: coupon.code,
			type: coupon.type,
			value: coupon.value,
			discount,
			final_total: Math.round((order_subtotal - discount) * 100) / 100,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

couponsRouter.post('/redeem', requireAuth, async (req: Request, res: Response) => {
	try {
		const schema = couponRedeemSchema.extend({ order_id: z.number().int().positive() });
		const v = validate(schema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { code, order_id } = v.data;
		const user_id = req.user!.id;

		const coupon = (await db
			.prepare(`SELECT ${COUPON_COLUMNS} FROM coupons WHERE code = ? AND is_active = TRUE`)
			.get(code)) as CouponRow | undefined;
		if (!coupon) return sendError(res, 'Coupon not found', 404);

		const orderOwner = (await db
			.prepare('SELECT customer_id FROM orders WHERE id = ?')
			.get(order_id)) as { customer_id: number } | undefined;
		if (!orderOwner) return sendError(res, 'Order not found', 404);
		if (orderOwner.customer_id !== user_id) return sendError(res, 'Forbidden', 403);

		const already = await db
			.prepare(
				'SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ? AND order_id = ?',
			)
			.get(coupon.id, user_id, order_id);
		if (already)
			return sendSuccess(res, { id: (already as { id: number }).id }, 'Already redeemed');

		// Enforce per-user limit before the INSERT. The DB trigger is the
		// final authority, but checking here gives a clean error message.
		const userUsageRow = (await db
			.prepare(
				`SELECT COUNT(*)::int AS c FROM coupon_usage WHERE coupon_id = ? AND user_id = ?`,
			)
			.get(coupon.id, user_id)) as { c: number } | undefined;
		const userUsageCount = userUsageRow?.c ?? 0;
		if (userUsageCount >= coupon.per_user_limit) {
			return sendError(res, 'Coupon usage limit reached for this account', 400);
		}

		// Atomic: INSERT usage + UPDATE usage_count inside a transaction
		// to prevent race conditions where concurrent requests over-use
		// the coupon.
		const result = await db.tx(async (tx) => {
			const row = (await tx
				.prepare(
					`INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount, used_at)
         VALUES (?, ?, ?, 0, NOW()) RETURNING id`,
				)
				.get(coupon.id, user_id, order_id)) as { id: number };
			await tx
				.prepare('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?')
				.run(coupon.id);
			return row;
		});
		sendSuccess(res, result, 'Coupon redeemed');
	} catch (err) {
		return sendError(res, err);
	}
});
