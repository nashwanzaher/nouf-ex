import { db } from '../../lib/shared.ts';

export async function clearForUser(userId: number) {
	const result = await db
		.prepare('DELETE FROM cart_items WHERE user_id = ? RETURNING id')
		.run(userId);
	return Number((result as unknown as { changes: number }).changes ?? 0);
}

export async function sumQuantity(userId: number): Promise<number> {
	const row = (await db
		.prepare('SELECT COALESCE(SUM(quantity), 0)::int AS c FROM cart_items WHERE user_id = $1')
		.get(userId)) as { c: number } | undefined;
	return row?.c ?? 0;
}

export async function listForUser(userId: number) {
	return db
		.prepare(
			`SELECT c.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.stock, s.store_name
			 FROM cart_items c
			 JOIN products p ON c.product_id = p.id
			 LEFT JOIN stores s ON p.store_id = s.id
			 WHERE c.user_id = ?
			 ORDER BY c.created_at DESC`,
		)
		.all(userId);
}

export async function findExisting(userId: number, productId: number, variant: Record<string, unknown> | null) {
	// Cast the variant parameter to text for comparison because
	// PostgreSQL cannot implicitly cast JS null/undefined to JSONB
	// in parameterized queries — passing `null` directly causes
	// 22P02 (invalid_input_syntax_for_type_json). The COALESCE
	// trick converts JSONB NULL → '' text so the comparison is
	// type-safe on both sides.
	const variantParam = variant == null ? '' : JSON.stringify(variant);
	return (await db
		.prepare(
			"SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? AND variant::text = ?",
		)
		.get(userId, productId, variantParam)) as Record<string, unknown> | undefined;
}

export async function insertCartItem(input: {
	userId: number;
	productId: number;
	quantity: number;
	variant: Record<string, unknown> | null;
}) {
	return (await db
		.prepare(
			`INSERT INTO cart_items (user_id, product_id, quantity, variant, created_at)
			 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING *`,
		)
		.run(input.userId, input.productId, input.quantity, input.variant)) as { lastInsertRowid: number | null };
}

export async function updateQuantity(id: number, quantity: number) {
	return (await db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(id, quantity)) as {
		changes: number;
	};
}

export async function deleteOwned(id: number, userId: number) {
	return (await db
		.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ? RETURNING id')
		.get(id, userId)) as { id: number } | undefined;
}