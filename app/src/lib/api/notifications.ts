/**
 * Notifications: read + mark read + unread count
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { Notification } from './types';

export async function getNotifications(
	userId: number,
	options?: RequestOptions,
): Promise<Notification[]> {
	return apiRequest(`/notifications/${userId}`, { signal: options?.signal });
}

export async function markNotificationAsRead(id: number, options?: RequestOptions): Promise<void> {
	return apiRequest(`/notifications/${id}/read`, {
		method: 'PUT',
		signal: options?.signal,
	});
}

export async function getUnreadNotificationCount(
	userId: number,
	options?: RequestOptions,
): Promise<{ count: number }> {
	return apiRequest(`/notifications/unread-count/${userId}`, {
		signal: options?.signal,
	});
}
