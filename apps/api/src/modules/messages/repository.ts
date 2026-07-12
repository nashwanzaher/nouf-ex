import { db } from '../../lib/shared.ts';

export async function findReceiver(id: number) {
	return (await db
		.prepare('SELECT id, status FROM users WHERE id = ? AND deleted_at IS NULL')
		.get(id)) as { id: number; status: string } | undefined;
}

export async function findProduct(id: number) {
	return (await db
		.prepare(
			'SELECT id FROM products WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL',
		)
		.get(id)) as { id: number } | undefined;
}

export async function findStore(id: number) {
	return (await db
		.prepare('SELECT id FROM stores WHERE id = ? AND is_active = TRUE')
		.get(id)) as { id: number } | undefined;
}

export async function findOrder(id: number) {
	return (await db.prepare('SELECT customer_id FROM orders WHERE id = ?').get(id)) as
		| { customer_id: number }
		| undefined;
}

export async function insertMessage(input: {
	senderId: number;
	receiverId: number;
	storeId?: number | null;
	productId?: number | null;
	orderId?: number | null;
	body: string;
	attachmentsJson: string;
}) {
	return (await db
		.prepare(
			`INSERT INTO messages (sender_id, receiver_id, store_id, product_id, order_id, body, attachments, is_read, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, FALSE, NOW())
			 RETURNING id, created_at`,
		)
		.get(
			input.senderId,
			input.receiverId,
			input.storeId ?? null,
			input.productId ?? null,
			input.orderId ?? null,
			input.body,
			input.attachmentsJson,
		)) as { id: number; created_at: string };
}

export async function listInbox(userId: number, opts: { onlyUnread: boolean; beforeId: number | null; limit: number }) {
	const params: unknown[] = [userId];
	let where = `receiver_id = ?`;
	if (opts.onlyUnread) where += ` AND is_read = FALSE`;
	if (opts.beforeId) {
		where += ` AND id < ?`;
		params.push(opts.beforeId);
	}
	params.push(opts.limit);
	return (await db
		.prepare(
			`SELECT m.id, m.sender_id, m.receiver_id, m.store_id, m.product_id, m.order_id,
			        m.body, m.attachments, m.is_read, m.read_at, m.created_at,
			        u.email AS sender_email, u.full_name AS sender_name
			 FROM messages m
			 JOIN users u ON u.id = m.sender_id
			 WHERE ${where}
			 ORDER BY m.id DESC
			 LIMIT ?`,
		)
		.all(...params)) as Array<{
		id: number;
		sender_id: number;
		receiver_id: number;
		store_id: number | null;
		product_id: number | null;
		order_id: number | null;
		body: string;
		attachments: unknown;
		is_read: boolean;
		read_at: string | null;
		created_at: string;
		sender_email: string;
		sender_name: string;
	}>;
}

export async function listSent(userId: number, opts: { beforeId: number | null; limit: number }) {
	const params: unknown[] = [userId];
	let where = `sender_id = ?`;
	if (opts.beforeId) {
		where += ` AND id < ?`;
		params.push(opts.beforeId);
	}
	params.push(opts.limit);
	return (await db
		.prepare(
			`SELECT m.id, m.sender_id, m.receiver_id, m.store_id, m.product_id, m.order_id,
			        m.body, m.attachments, m.is_read, m.read_at, m.created_at,
			        u.email AS receiver_email, u.full_name AS receiver_name
			 FROM messages m
			 JOIN users u ON u.id = m.receiver_id
			 WHERE ${where}
			 ORDER BY m.id DESC
			 LIMIT ?`,
		)
		.all(...params)) as Array<{
		id: number;
		receiver_id: number;
		body: string;
		attachments: unknown;
		created_at: string;
		receiver_email: string;
		receiver_name: string;
	}>;
}

export async function listConversation(input: {
	userId: number;
	peerId: number;
	beforeId?: number;
	limit: number;
}) {
	const params: unknown[] = [input.userId, input.peerId, input.peerId, input.userId];
	let extra = '';
	if (input.beforeId) {
		extra = ' AND m.id < ?';
		params.push(input.beforeId);
	}
	params.push(input.limit);
	return (await db
		.prepare(
			`SELECT m.id, m.sender_id, m.receiver_id, m.store_id, m.product_id, m.order_id,
			        m.body, m.attachments, m.is_read, m.read_at, m.created_at
			 FROM messages m
			 WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))${extra}
			 ORDER BY m.id ASC
			 LIMIT ?`,
		)
		.all(...params)) as Array<{
		id: number;
		sender_id: number;
		receiver_id: number;
		body: string;
		attachments: unknown;
		is_read: boolean;
		read_at: string | null;
		created_at: string;
	}>;
}

export async function unreadCount(userId: number): Promise<number> {
	const row = (await db
		.prepare('SELECT COUNT(*)::int AS c FROM messages WHERE receiver_id = ? AND is_read = FALSE')
		.get(userId)) as { c: number };
	return row.c;
}

export async function markConversationRead(peerId: number, userId: number): Promise<void> {
	await db
		.prepare(
			`UPDATE messages SET is_read = TRUE, read_at = NOW()
			 WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE`,
		)
		.run(peerId, userId);
}

export async function findForMark(id: number, userId: number) {
	return (await db
		.prepare(
			`UPDATE messages SET is_read = TRUE, read_at = NOW()
			 WHERE id = ? AND receiver_id = ? AND is_read = FALSE
			 RETURNING id, read_at`,
		)
		.get(id, userId)) as { id: number; read_at: string } | undefined;
}

export async function existsForUser(id: number, userId: number) {
	return (await db
		.prepare('SELECT id FROM messages WHERE id = ? AND receiver_id = ?')
		.get(id, userId)) as { id: number } | undefined;
}