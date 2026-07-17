import { ErrorCodes } from '../../lib/error-codes.ts';
import { HttpError, type AuthRole, isAdminOperator } from '../../lib/shared.ts';
import * as repo from './repository.ts';

export async function clear(userId: number) {
	const removed = await repo.clearForUser(userId);
	return { removed };
}

export async function count(userId: number, requesterId: number, requesterRole: AuthRole) {
	if (requesterId !== userId && !isAdminOperator(requesterRole)) {
		throw new HttpError(403, 'Forbidden', { code: 'FORBIDDEN' });
	}
	const c = await repo.sumQuantity(userId);
	return { user_id: userId, count: c };
}

export async function list(userId: number, requesterId: number, requesterRole: AuthRole) {
	if (requesterId !== userId && !isAdminOperator(requesterRole)) {
		throw new HttpError(403, 'Forbidden', { code: 'FORBIDDEN' });
	}
	return repo.listForUser(userId);
}

export async function add(userId: number, productId: number, quantity: number, variant?: Record<string, unknown> | null) {
	const v = variant ?? null;
	const existing = await repo.findExisting(userId, productId, v);
	if (existing) {
		return { existing };
	}
	const result = await repo.insertCartItem({ userId, productId, quantity, variant: v });
	if (result.lastInsertRowid == null) {
		throw new HttpError(500, 'Failed to add to cart', { code: ErrorCodes.INSERT_FAILED });
	}
	return { id: result.lastInsertRowid };
}

export async function update(id: number, quantity: number, _userId: number) {
	const result = await repo.updateQuantity(id, quantity);
	return { changes: result.changes, id };
}

export async function remove(id: number, userId: number) {
	const result = await repo.deleteOwned(id, userId);
	return result;
}