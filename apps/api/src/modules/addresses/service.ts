/**
 * Addresses service — business logic.
 */
import * as repo from './repository.ts';

export async function listAddresses(userId: number) {
	return repo.listByUser(userId);
}

export async function createAddress(userId: number, data: Parameters<typeof repo.insert>[0]['data']) {
	if (data.is_default) {
		await repo.clearDefault(userId);
	}
	return repo.insert({ userId, data });
}

export async function deleteAddress(id: number, userId: number): Promise<boolean> {
	const deleted = await repo.deleteOwned(id, userId);
	return deleted !== null;
}

export async function updateAddress(
	id: number,
	userId: number,
	data: Parameters<typeof repo.updateOwned>[2],
) {
	if (!(await repo.existsOwned(id, userId))) return null;
	if (data.is_default) {
		await repo.clearDefaultExcept(userId, id);
	}
	return repo.updateOwned(id, userId, data);
}