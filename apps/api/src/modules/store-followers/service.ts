import * as repo from './repository.ts';

export async function check(storeId: number, userId: number) {
	const row = await repo.findFollow(storeId, userId);
	return {
		store_id: storeId,
		user_id: userId,
		following: row !== undefined,
		preferences: row
			? {
					notify_new_products: row.notify_new_products,
					notify_offers: row.notify_offers,
					since: row.created_at,
				}
			: null,
	};
}

export async function follow(
	storeId: number,
	userId: number,
	notifyNewProducts: boolean,
	notifyOffers: boolean,
) {
	const existing = await repo.findExistingId(storeId, userId);
	if (existing) {
		await repo.updatePreferences(existing.id, notifyNewProducts, notifyOffers);
		return { id: existing.id, store_id: storeId, following: true as const, updated: true };
	}
	const result = await repo.insert(storeId, userId, notifyNewProducts, notifyOffers);
	return { id: result.id, store_id: storeId, following: true as const, updated: false };
}

export async function unfollow(storeId: number, userId: number) {
	const result = await repo.unfollow(storeId, userId);
	return { store_id: storeId, following: false as const, removed: result !== undefined };
}