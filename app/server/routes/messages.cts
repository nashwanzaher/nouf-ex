import { Router, type Request, type Response } from 'express';
import { z as zod } from 'zod';
import { db, sendSuccess, sendError, requireAuth } from '../lib/shared.cts';

export const messagesRouter = Router();

// ──────────────────────────────────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────────────────────────────────

const sendMessageSchema = zod.object({
	receiver_id: zod.number().int().positive(),
	body: zod.string().trim().min(1).max(4000),
	// Optional context — links the message to a product, store, or order
	// so the inbox can group by topic.
	store_id: zod.number().int().positive().optional(),
	product_id: zod.number().int().positive().optional(),
	order_id: zod.number().int().positive().optional(),
	attachments: zod.array(zod.string().url().max(500)).max(10).optional(),
});

const conversationQuerySchema = zod.object({
	peer_id: zod.coerce.number().int().positive(),
	limit: zod.coerce.number().int().min(1).max(100).default(50),
	before_id: zod.coerce.number().int().positive().optional(), // for pagination
});

const messageIdParamSchema = zod.object({
	id: zod.coerce.number().int().positive(),
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/messages — send a message to another user
// ──────────────────────────────────────────────────────────────────────────
// Requires authentication. Validates that the receiver exists and is not
// the sender (DB CHECK enforces this too). Optionally links the message to
// a store / product / order so it can be grouped in the inbox.
messagesRouter.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const parsed = sendMessageSchema.safeParse(req.body);
		if (!parsed.success) {
			return sendError(
				res,
				'Invalid input: ' +
					parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
				400,
			);
		}
		const input = parsed.data;

		if (input.receiver_id === req.user!.id) {
			return sendError(res, 'Cannot send a message to yourself', 400);
		}

		// Receiver must exist and not be deleted.
		const receiver = (await db
			.prepare('SELECT id, status FROM users WHERE id = ? AND deleted_at IS NULL')
			.get(input.receiver_id)) as { id: number; status: string } | undefined;
		if (!receiver) return sendError(res, 'Receiver not found', 404);
		if (receiver.status === 'banned' || receiver.status === 'suspended') {
			return sendError(res, 'Receiver is not accepting messages', 403);
		}

		// Optional context: validate the linked entity exists if provided.
		if (input.product_id) {
			const product = (await db
				.prepare(
					'SELECT id FROM products WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL',
				)
				.get(input.product_id)) as { id: number } | undefined;
			if (!product) return sendError(res, 'Product not found or inactive', 404);
		}
		if (input.store_id) {
			const store = (await db
				.prepare('SELECT id FROM stores WHERE id = ? AND is_active = TRUE')
				.get(input.store_id)) as { id: number } | undefined;
			if (!store) return sendError(res, 'Store not found or inactive', 404);
		}
		if (input.order_id) {
			const order = (await db
				.prepare('SELECT customer_id FROM orders WHERE id = ?')
				.get(input.order_id)) as { customer_id: number } | undefined;
			if (!order) return sendError(res, 'Order not found', 404);
			// Only the customer or an admin can attach a message to an order.
			if (req.user!.role !== 'admin' && order.customer_id !== req.user!.id) {
				return sendError(res, "Cannot attach message to another user's order", 403);
			}
		}

		const result = (await db
			.prepare(
				`INSERT INTO messages (sender_id, receiver_id, store_id, product_id, order_id, body, attachments, is_read, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, FALSE, NOW())
				 RETURNING id, created_at`,
			)
			.get(
				req.user!.id,
				input.receiver_id,
				input.store_id ?? null,
				input.product_id ?? null,
				input.order_id ?? null,
				input.body,
				JSON.stringify(input.attachments ?? []),
			)) as { id: number; created_at: string };

		sendSuccess(res, { id: result.id, created_at: result.created_at }, 'Message sent');
	} catch (err) {
		return sendError(res, err);
	}
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/messages/inbox — paginated inbox for the authenticated user
// ──────────────────────────────────────────────────────────────────────────
messagesRouter.get('/inbox', requireAuth, async (req: Request, res: Response) => {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
		const beforeId = req.query.before_id ? Number(req.query.before_id) : null;
		const onlyUnread = req.query.unread === '1' || req.query.unread === 'true';

		const params: unknown[] = [req.user!.id];
		let where = `receiver_id = ?`;
		if (onlyUnread) where += ` AND is_read = FALSE`;
		if (beforeId) {
			where += ` AND id < ?`;
			params.push(beforeId);
		}
		params.push(limit + 1); // +1 to detect more

		const rows = (await db
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

		const hasMore = rows.length > limit;
		const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
			...r,
			attachments:
				typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
		}));

		// Compute unread count for the badge.
		const unread = (await db
			.prepare(
				'SELECT COUNT(*)::int AS c FROM messages WHERE receiver_id = ? AND is_read = FALSE',
			)
			.get(req.user!.id)) as { c: number };

		sendSuccess(res, {
			items,
			next_cursor: hasMore ? items[items.length - 1].id : null,
			unread_count: unread.c,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/messages/sent — paginated outbox
// ──────────────────────────────────────────────────────────────────────────
messagesRouter.get('/sent', requireAuth, async (req: Request, res: Response) => {
	try {
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
		const beforeId = req.query.before_id ? Number(req.query.before_id) : null;

		const params: unknown[] = [req.user!.id];
		let where = `sender_id = ?`;
		if (beforeId) {
			where += ` AND id < ?`;
			params.push(beforeId);
		}
		params.push(limit + 1);

		const rows = (await db
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

		const hasMore = rows.length > limit;
		const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
			...r,
			attachments:
				typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
		}));

		sendSuccess(res, {
			items,
			next_cursor: hasMore ? items[items.length - 1].id : null,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/messages/conversation?peer_id=X — bidirectional thread
// ──────────────────────────────────────────────────────────────────────────
messagesRouter.get('/conversation', requireAuth, async (req: Request, res: Response) => {
	try {
		const parsed = conversationQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return sendError(
				res,
				'Invalid query: ' +
					parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
				400,
			);
		}
		const { peer_id, limit, before_id } = parsed.data;

		if (peer_id === req.user!.id) {
			return sendError(res, 'Cannot have a conversation with yourself', 400);
		}

		const params: unknown[] = [req.user!.id, peer_id, peer_id, req.user!.id];
		let extra = '';
		if (before_id) {
			extra = ' AND m.id < ?';
			params.push(before_id);
		}
		params.push(limit + 1);

		const rows = (await db
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

		const hasMore = rows.length > limit;
		const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
			...r,
			attachments:
				typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
		}));

		// Best-effort: mark all messages from peer to me as read in this thread.
		// We don't fail the request if this update fails.
		try {
			await db
				.prepare(
					`UPDATE messages SET is_read = TRUE, read_at = NOW()
					 WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE`,
				)
				.run(peer_id, req.user!.id);
		} catch (markErr) {
			console.error('[messages] mark-read failed:', markErr);
		}

		sendSuccess(res, {
			items,
			next_cursor: hasMore ? items[0]?.id : null, // for ASC pagination, cursor is the oldest id loaded
			has_more: hasMore,
		});
	} catch (err) {
		return sendError(res, err);
	}
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/messages/unread-count — cheap badge counter for the UI
// ──────────────────────────────────────────────────────────────────────────
messagesRouter.get('/unread-count', requireAuth, async (req: Request, res: Response) => {
	try {
		const row = (await db
			.prepare(
				'SELECT COUNT(*)::int AS c FROM messages WHERE receiver_id = ? AND is_read = FALSE',
			)
			.get(req.user!.id)) as { c: number };
		sendSuccess(res, { unread_count: row.c });
	} catch (err) {
		return sendError(res, err);
	}
});

// ──────────────────────────────────────────────────────────────────────────
// PUT /api/messages/:id/read — mark a single message read
// ──────────────────────────────────────────────────────────────────────────
// Only the receiver can mark a message as read (sender cannot mark their
// own sent message read on the recipient's behalf).
messagesRouter.put('/:id/read', requireAuth, async (req: Request, res: Response) => {
	try {
		const parsed = messageIdParamSchema.safeParse(req.params);
		if (!parsed.success) {
			return sendError(res, 'Invalid message id', 400);
		}
		const id = parsed.data.id;

		const updated = (await db
			.prepare(
				`UPDATE messages SET is_read = TRUE, read_at = NOW()
				 WHERE id = ? AND receiver_id = ? AND is_read = FALSE
				 RETURNING id, read_at`,
			)
			.get(id, req.user!.id)) as { id: number; read_at: string } | undefined;

		if (!updated) {
			// Either doesn't exist, not yours, or already read. Distinguish.
			const exists = (await db.prepare('SELECT id FROM messages WHERE id = ?').get(id)) as
				| { id: number }
				| undefined;
			if (!exists) return sendError(res, 'Message not found', 404);
			// Already read — return current state (idempotent).
			return sendSuccess(res, { id, read_at: null, already_read: true }, 'Already read');
		}
		sendSuccess(res, updated, 'Marked as read');
	} catch (err) {
		return sendError(res, err);
	}
});
