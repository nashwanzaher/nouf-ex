import { Router, type Request, type Response } from 'express';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	requireRole,
	refundCreateSchema,
} from '../lib/shared.cts';

export const refundsRouter = Router();

refundsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(refundCreateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { order_id, amount, reason } = v.data;
		const userId = req.user!.id;

		const order = (await db
			.prepare('SELECT id, customer_id, total, payment_status FROM orders WHERE id = ?')
			.get(order_id)) as
			| { id: number; customer_id: number; total: number; payment_status: string }
			| undefined;
		if (!order) return sendError(res, 'Order not found', 404);
		if (order.customer_id !== userId) return sendError(res, 'Forbidden', 403);
		if (order.payment_status !== 'paid') {
			return sendError(res, 'Only paid orders are eligible for refund', 400);
		}
		if (amount > order.total) {
			return sendError(res, 'Refund amount exceeds order total', 400);
		}

		const result = (await db
			.prepare(
				`INSERT INTO refunds (order_id, user_id, amount, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'requested', NOW(), NOW()) RETURNING id`,
			)
			.get(order_id, userId, amount, reason)) as { id: number };

		// Fire bilingual i18n notifications (customer + merchant).
		// Best-effort — never blocks the response.
		// (C.1 in MASTER_PLAN.md — real refund-requested notification)
		try {
			const { onRefundRequested } = await import('../lib/notifications/events.cts');
			const orderRow = (await db
				.prepare('SELECT order_number, customer_id, store_id FROM orders WHERE id = ?')
				.get(order_id)) as
				| { order_number: string; customer_id: number; store_id: number | null }
				| undefined;
			if (orderRow) {
				const storeRow = orderRow.store_id
					? ((await db
							.prepare('SELECT owner_id FROM stores WHERE id = ?')
							.get(orderRow.store_id)) as { owner_id: number } | undefined)
					: undefined;
				if (storeRow) {
					await onRefundRequested({
						orderId: order_id,
						orderNumber: orderRow.order_number,
						customerId: orderRow.customer_id,
						merchantId: storeRow.owner_id,
						amount,
					});
				}
			}
		} catch (notifyErr) {
			console.error('[refunds] notification dispatch failed:', notifyErr);
		}

		sendSuccess(res, result, 'Refund requested');
	} catch (err) {
		return sendError(res, err);
	}
});

refundsRouter.post(
	'/:id/resolve',
	requireAuth,
	requireRole('admin'),
	async (req: Request, res: Response) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
			const status = (req.body?.status as string) || '';
			if (status !== 'approved' && status !== 'rejected') {
				return sendError(res, 'status must be approved or rejected', 400);
			}
			const adminNotes = (req.body?.admin_notes as string | undefined) ?? null;
			const finalStatus = status === 'approved' ? 'processed' : 'rejected';
			const result = (await db
				.prepare(
					`UPDATE refunds
            SET status = ?, admin_notes = ?, resolved_at = NOW(), updated_at = NOW()
          WHERE id = ? AND status IN ('requested', 'approved')
          RETURNING order_id, amount`,
				)
				.get(finalStatus, adminNotes, id)) as
				| { order_id: number; amount: number }
				| undefined;
			if (!result) return sendError(res, 'Refund not found or already resolved', 404);

			if (finalStatus === 'processed') {
				await db
					.prepare(
						`UPDATE payments SET status = 'refunded', updated_at = NOW()
            WHERE order_id = ? AND status = 'completed'`,
					)
					.run(result.order_id);
				const order = (await db
					.prepare('SELECT store_id FROM orders WHERE id = ?')
					.get(result.order_id)) as { store_id: number | null } | undefined;
				if (order?.store_id) {
					await db
						.prepare(
							`INSERT INTO transactions (store_id, type, amount, balance_after, reference_type, reference_id, description, created_at)
             VALUES (?, 'refund', ?, 0, 'refund', ?, ?, NOW())`,
						)
						.run(
							order.store_id,
							-result.amount,
							id,
							`Refund #${id} for order ${result.order_id}`,
						);
				}
			}

			// Fire bilingual i18n notification to the customer (best-effort).
			// (C.1 in MASTER_PLAN.md — real refund-resolved notification)
			try {
				const { onRefundResolved } = await import('../lib/notifications/events.cts');
				const orderRow = (await db
					.prepare('SELECT order_number, customer_id FROM orders WHERE id = ?')
					.get(result.order_id)) as
					| { order_number: string; customer_id: number }
					| undefined;
				if (orderRow) {
					await onRefundResolved({
						orderId: result.order_id,
						orderNumber: orderRow.order_number,
						customerId: orderRow.customer_id,
						amount: result.amount,
						status: finalStatus === 'processed' ? 'approved' : 'rejected',
						reason: adminNotes ?? undefined,
					});
				}
			} catch (notifyErr) {
				console.error('[refunds] resolve notification failed:', notifyErr);
			}

			sendSuccess(res, { id, status: finalStatus }, 'Refund resolved');
		} catch (err) {
			return sendError(res, err);
		}
	},
);
