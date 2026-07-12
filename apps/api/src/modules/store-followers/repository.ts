import { db } from '../../lib/shared.ts';

export async function findFollow(storeId: number, userId: number) {
	return (await db
		.prepare(`SELECT id, notify_new_products, notify_offers, created_at FROM store_followers WHERE store_id = $1 AND user_id = $2`)
		.get(storeId, userId)) as
		| { id: number; notify_new_products: boolean; notify_offers: boolean; created_at: string }
		| undefined;
}

export async function findExistingId(storeId: number, userId: number) {
	return (await db
		.prepare('SELECT id FROM store_followers WHERE store_id = $1 AND user_id = $2')
		.get(storeId, userId)) as { id: number } | undefined;
}

export async function updatePreferences(
	id: number,
	notifyNewProducts: boolean,
	notifyOffers: boolean,
) {
	await db
		.prepare(
			`UPDATE store_followers
			 SET notify_new_products = $1, notify_offers = $2
			 WHERE id = $3`,
		)
		.run(notifyNewProducts, notifyOffers, id);
}

export async function insert(storeId: number, userId: number, notifyNewProducts: boolean, notifyOffers: boolean) {
	return (await db
		.prepare(
			`INSERT INTO store_followers (store_id, user_id, notify_new_products, notify_offers, created_at)
			 VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
		)
		.get(storeId, userId, notifyNewProducts, notifyOffers)) as { id: number };
}

export async function unfollow(storeId: number, userId: number) {
	return (await db
		.prepare('DELETE FROM store_followers WHERE store_id = $1 AND user_id = $2 RETURNING id')
		.get(storeId, userId)) as { id: number } | undefined;
}