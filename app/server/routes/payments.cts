import { Router, type Request, type Response } from 'express';
import {
	db,
	sendSuccess,
	sendError,
	validate,
	requireAuth,
	authLimiter,
	paymentCreateSchema,
} from '../lib/shared.cts';

export const paymentsRouter = Router();

paymentsRouter.post('/', authLimiter, requireAuth, async (req: Request, res: Response) => {
	try {
		const v = validate(paymentCreateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { order_id, amount, currency, method, transaction_id } = v.data;

		const order = (await db
			.prepare('SELECT id, customer_id, total, status FROM orders WHERE id = ?')
			.get(order_id)) as
			| { id: number; customer_id: number; total: number; status: string }
			| undefined;
		if (!order) return sendError(res, 'Order not found', 404);

		if (req.user!.role !== 'admin' && order.customer_id !== req.user!.id) {
			return sendError(res, 'Forbidden', 403);
		}

		const existing = (await db
			.prepare('SELECT id, status FROM payments WHERE order_id = ? AND method = ?')
			.get(order_id, method)) as { id: number; status: string } | undefined;
		if (existing) {
			return sendSuccess(res, { id: existing.id, status: existing.status, idempotent: true });
		}

		const initialStatus = method === 'cod' ? 'pending' : 'processing';
		const result = await db
			.prepare(
				`INSERT INTO payments (order_id, user_id, amount, currency, method, status, transaction_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`
			)
			.run(
				order_id,
				order.customer_id,
				amount,
				currency,
				method,
				initialStatus,
				transaction_id ?? null
			);

		if (method !== 'cod') {
			await db
				.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`)
				.run(order_id);
		}

		sendSuccess(res, { id: result.lastInsertRowid, status: initialStatus }, 'Payment recorded');
	} catch (err) {
		return sendError(res, err);
	}
});

paymentsRouter.get('/order/:orderId', requireAuth, async (req: Request, res: Response) => {
	try {
		const orderId = Number(req.params.orderId);
		if (!Number.isInteger(orderId) || orderId <= 0) {
			return sendError(res, 'Invalid order id', 400);
		}
		const order = (await db.prepare('SELECT customer_id FROM orders WHERE id = ?').get(orderId)) as
			| { customer_id: number }
			| undefined;
		if (!order) return sendError(res, 'Order not found', 404);
		if (req.user!.role !== 'admin' && order.customer_id !== req.user!.id) {
			return sendError(res, 'Forbidden', 403);
		}
		const payments = await db
			.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC')
			.all(orderId);
		sendSuccess(res, payments);
	} catch (err) {
		return sendError(res, err);
	}
});

paymentsRouter.post('/:id/confirm', requireAuth, async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid payment id', 400);

		const payment = (await db.prepare('SELECT order_id FROM payments WHERE id = ?').get(id)) as
			| { order_id: number }
			| undefined;
		if (!payment) return sendError(res, 'Payment not found', 404);
		const order = (await db
			.prepare('SELECT customer_id FROM orders WHERE id = ?')
			.get(payment.order_id)) as { customer_id: number } | undefined;
		if (!order) return sendError(res, 'Order not found', 404);

		if (req.user!.role !== 'admin') {
			return sendError(res, 'Forbidden', 403);
		}

		const result = (await db
			.prepare(
				`UPDATE payments SET status = 'completed', paid_at = NOW(), updated_at = NOW()
          WHERE id = ? RETURNING order_id`
			)
			.get(id)) as { order_id: number } | undefined;
		await db
			.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`)
			.run(result!.order_id);
		sendSuccess(res, { order_id: result!.order_id }, 'Payment confirmed');
	} catch (err) {
		return sendError(res, err);
	}
});
