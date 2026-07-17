import { log, isAdminOperator, type AuthRole } from '../../lib/shared.ts';
import * as repo from './repository.ts';

function parseAttachments(raw: unknown): unknown[] {
	try {
		return typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown[]) ?? [];
	} catch {
		return [];
	}
}

export async function send(input: {
	senderId: number;
	receiverId: number;
	body: string;
	storeId?: number;
	productId?: number;
	orderId?: number;
	attachments?: string[];
	role: AuthRole;
}) {
	if (input.receiverId === input.senderId) {
		return { ok: false as const, error: 'Cannot send a message to yourself', status: 400 };
	}

	const receiver = await repo.findReceiver(input.receiverId);
	if (!receiver) return { ok: false as const, error: 'Receiver not found', status: 404 };
	if (receiver.status === 'banned' || receiver.status === 'suspended') {
		return { ok: false as const, error: 'Receiver is not accepting messages', status: 403 };
	}

	if (input.productId) {
		const p = await repo.findProduct(input.productId);
		if (!p) return { ok: false as const, error: 'Product not found or inactive', status: 404 };
	}
	if (input.storeId) {
		const s = await repo.findStore(input.storeId);
		if (!s) return { ok: false as const, error: 'Store not found or inactive', status: 404 };
	}
	if (input.orderId) {
		const o = await repo.findOrder(input.orderId);
		if (!o) return { ok: false as const, error: 'Order not found', status: 404 };
		if (!isAdminOperator(input.role) && o.customer_id !== input.senderId) {
			return {
				ok: false as const,
				error: "Cannot attach message to another user's order",
				status: 403,
			};
		}
	}

	const result = await repo.insertMessage({
		senderId: input.senderId,
		receiverId: input.receiverId,
		storeId: input.storeId,
		productId: input.productId,
		orderId: input.orderId,
		body: input.body,
		attachmentsJson: JSON.stringify(input.attachments ?? []),
	});
	return { ok: true as const, id: result.id, created_at: result.created_at };
}

export async function inbox(userId: number, opts: { limit: number; beforeId: number | null; onlyUnread: boolean }) {
	const limit = Math.min(100, Math.max(1, opts.limit));
	const rows = await repo.listInbox(userId, { onlyUnread: opts.onlyUnread, beforeId: opts.beforeId, limit: limit + 1 });
	const hasMore = rows.length > limit;
	const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
		...r,
		attachments: parseAttachments(r.attachments),
	}));
	const unread = await repo.unreadCount(userId);
	return { items, next_cursor: hasMore ? items[items.length - 1].id : null, unread_count: unread };
}

export async function sent(userId: number, opts: { limit: number; beforeId: number | null }) {
	const limit = Math.min(100, Math.max(1, opts.limit));
	const rows = await repo.listSent(userId, { beforeId: opts.beforeId, limit: limit + 1 });
	const hasMore = rows.length > limit;
	const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
		...r,
		attachments: parseAttachments(r.attachments),
	}));
	return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function conversation(input: { userId: number; peerId: number; limit: number; beforeId?: number }) {
	if (input.peerId === input.userId) {
		return { ok: false as const, error: 'Cannot have a conversation with yourself', status: 400 };
	}
	const rows = await repo.listConversation({
		userId: input.userId,
		peerId: input.peerId,
		beforeId: input.beforeId,
		limit: input.limit + 1,
	});
	const hasMore = rows.length > input.limit;
	const items = (hasMore ? rows.slice(0, input.limit) : rows).map((r) => ({
		...r,
		attachments: parseAttachments(r.attachments),
	}));

	try {
		await repo.markConversationRead(input.peerId, input.userId);
	} catch (markErr) {
		log.error({ msg: 'messages.mark_read_failed', error: (markErr as Error).message });
	}

	return {
		ok: true as const,
		items,
		next_cursor: hasMore ? items[0]?.id : null,
		has_more: hasMore,
	};
}

export async function markRead(id: number, userId: number) {
	const updated = await repo.findForMark(id, userId);
	if (updated) return { ok: true as const, data: updated };
	const exists = await repo.existsForUser(id, userId);
	if (!exists) return { ok: false as const, status: 404, error: 'Message not found' };
	return { ok: true as const, data: { id, read_at: null, already_read: true } };
}