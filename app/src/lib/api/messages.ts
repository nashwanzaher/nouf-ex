/**
 * Messaging: inbox, sent, conversation, send, unread count, mark read
 */

import type { RequestOptions } from './client';
import { apiRequest } from './client';
import type { InboxResponse, Message } from './types';

export async function sendMessage(body: {
	recipient_id: number;
	subject: string;
	body: string;
	related_product_id?: number | null;
	related_store_id?: number | null;
	related_order_id?: number | null;
}): Promise<{ id: number }> {
	return apiRequest('/messages/', {
		method: 'POST',
		body: JSON.stringify(body),
	});
}

export async function getInbox(): Promise<InboxResponse> {
	return apiRequest('/messages/inbox');
}

export async function getSent(): Promise<InboxResponse> {
	return apiRequest('/messages/sent');
}

export async function getConversation(
	peerId: number,
	options?: RequestOptions,
): Promise<Message[]> {
	return apiRequest(`/messages/conversation?peer_id=${peerId}`, {
		signal: options?.signal,
	});
}

export async function getUnreadMessageCount(options?: RequestOptions): Promise<{ count: number }> {
	return apiRequest('/messages/unread-count', { signal: options?.signal });
}

export async function markMessageRead(id: number, options?: RequestOptions): Promise<void> {
	return apiRequest(`/messages/${id}/read`, {
		method: 'PUT',
		signal: options?.signal,
	});
}
