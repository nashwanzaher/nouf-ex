import * as repo from './repository.ts';

export async function list(userId: number) {
	return repo.listForUser(userId);
}

export async function markAsRead(id: number, userId: number) {
	return repo.markRead(id, userId);
}

export async function getUnreadCount(userId: number) {
	return repo.unreadCount(userId);
}