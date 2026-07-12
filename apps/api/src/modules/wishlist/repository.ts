import { db } from '../../lib/shared.ts';

export async function listForUser(userId: number) {
	return db
		.prepare(
			`SELECT w.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.rating, p.review_count, s.store_name
			 FROM wishlist w
			 JOIN products p ON w.product_id = p.id
			 LEFT JOIN stores s ON p.store_id = s.id
			 WHERE w.user_id = ?
			 ORDER BY w.created_at DESC`,
		)
		.all(userId);
}

export async function findExisting(userId: number, productId: number) {
	return (await db.prepare('SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?').get(userId, productId)) as
		| Record<string, unknown>
		| undefined;
}

export async function insert(userId: number, productId: number) {
	return (await db
		.prepare(
			'INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) RETURNING id',
		)
		.run(userId, productId)) as { lastInsertRowid: number | null };
}

export async function deleteOwned(id: number, userId: number) {
	return (await db.prepare('DELETE FROM wishlist WHERE id = ? AND user_id = ? RETURNING id').get(id, userId)) as
		| { id: number }
		| undefined;
}