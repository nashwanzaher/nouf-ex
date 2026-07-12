import { db, COUPON_COLUMNS, type CouponRow } from '../../lib/shared.ts';

export async function findByCode(code: string): Promise<CouponRow | undefined> {
	return (await db
		.prepare(`SELECT ${COUPON_COLUMNS} FROM coupons WHERE code = ? AND is_active = TRUE`)
		.get(code)) as CouponRow | undefined;
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