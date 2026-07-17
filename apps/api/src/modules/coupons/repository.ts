import { db, COUPON_COLUMNS, type CouponRow } from '../../lib/shared.ts';

export type AvailableCouponRow = {
	id: number;
	code: string;
	type: 'percentage' | 'fixed';
	value: number;
	min_order_amount: number;
	max_discount: number | null;
	starts_at: string | null;
	expires_at: string | null;
	description: string | null;
};

export async function findByCode(code: string): Promise<CouponRow | undefined> {
	return (await db
		.prepare(`SELECT ${COUPON_COLUMNS} FROM coupons WHERE code = ? AND is_active = TRUE`)
		.get(code)) as CouponRow | undefined;
}

export async function listAvailableForUser(userId: number): Promise<AvailableCouponRow[]> {
	return (await db
		.prepare(
			`SELECT c.id, c.code, c.type, c.value, c.min_order_amount, c.max_discount,
			        c.starts_at, c.expires_at, c.description
			 FROM coupons c
			 LEFT JOIN coupon_usage cu ON cu.coupon_id = c.id AND cu.user_id = ?
			 WHERE c.is_active = TRUE
			   AND (c.starts_at IS NULL OR c.starts_at <= CURRENT_TIMESTAMP)
			   AND (c.expires_at IS NULL OR c.expires_at >= CURRENT_TIMESTAMP)
			   AND (c.usage_limit IS NULL OR c.usage_count < c.usage_limit)
			 GROUP BY c.id, c.code, c.type, c.value, c.min_order_amount, c.max_discount,
			          c.starts_at, c.expires_at, c.description, c.per_user_limit
			 HAVING COUNT(cu.id) < c.per_user_limit
			 ORDER BY c.expires_at NULLS LAST, c.id`,
		)
		.all(userId)) as AvailableCouponRow[];
}

export async function getUserUsageCount(couponId: number, userId: number): Promise<number> {
	const row = (await db
		.prepare(
			`SELECT COUNT(*)::int AS c FROM coupon_usage WHERE coupon_id = ? AND user_id = ?`,
		)
		.get(couponId, userId)) as { c: number } | undefined;
	return row?.c ?? 0;
}

export async function findExistingUsage(couponId: number, userId: number, orderId: number) {
	return db
		.prepare(
			'SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ? AND order_id = ?',
		)
		.get(couponId, userId, orderId);
}

export async function getOrderOwner(orderId: number) {
	return (await db
		.prepare('SELECT customer_id FROM orders WHERE id = ?')
		.get(orderId)) as { customer_id: number } | undefined;
}

export async function getOrderSubtotal(orderId: number) {
	return (await db.prepare('SELECT subtotal FROM orders WHERE id = ?').get(orderId)) as
		| { subtotal: number }
		| undefined;
}

export async function redeemTx(couponId: number, userId: number, orderId: number, discount: number) {
	return db.tx(async (tx) => {
		const row = (await tx
			.prepare(
				`INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount, used_at)
				 VALUES (?, ?, ?, ?, NOW()) RETURNING id`,
			)
			.get(couponId, userId, orderId, discount)) as { id: number };
		await tx.prepare('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?').run(couponId);
		return row;
	});
}
