import * as repo from './repository.ts';

export async function list(userId: number) {
	return repo.listForUser(userId);
}

export async function add(userId: number, productId: number) {
	const existing = await repo.findExisting(userId, productId);
	if (existing) return { alreadyExists: true as const };
	const result = await repo.insert(userId, productId);
	if (result.lastInsertRowid == null) return { error: 'insert_failed' as const };
	return { id: result.lastInsertRowid };
}

export async function remove(id: number, userId: number) {
	const result = await repo.deleteOwned(id, userId);
	return result ?? null;
}