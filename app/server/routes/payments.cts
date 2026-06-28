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
import { selectProvider, listProviders, hasProvider } from '../lib/payments/registry.cts';
import type { PaymentMethod } from '../lib/payments/types.cts';

export const paymentsRouter = Router();

// GET /api/payments/methods — surfaces which providers are live so the
// client UI can grey out methods that aren't actually wired up.
paymentsRouter.get('/methods', (_req: Request, res: Response) => {
	try {
		sendSuccess(res, listProviders());
	} catch (err) {
		return sendError(res, err);
	}
});

// POST /api/payments/webhook/:method — entrypoint for provider callbacks.
// We accept both Stripe-style (sig in body) and Paymob-style (sig in
// query) webhooks; the chosen provider's verifyWebhook() decides.
paymentsRouter.post('/webhook/:method', async (req: Request, res: Response) => {
	try {
		const method = req.params.method as PaymentMethod;
		const provider = selectProvider(method);
		if (!provider) return sendError(res, `No provider for method ${method}`, 400);
		const headers: Record<string, string> = {};
		for (const [k, v] of Object.entries(req.headers)) {
			if (typeof v === 'string') headers[k.toLowerCase()] = v;
		}
		const raw = (req as Request & { rawBody?: string }).rawBody ?? '';
		const verification = await provider.verifyWebhook(headers, raw);
		if (!verification.valid || !verification.status || !verification.transactionId) {
			return sendError(res, 'Webhook signature rejected', 400);
		}
		// Update the matching local payment by provider transaction_id.
		await db
			.prepare(
				`UPDATE payments SET status = ?, updated_at = NOW()
					 WHERE provider_txn_id = ?`,
			)
			.run(verification.status, verification.transactionId);
		sendSuccess(res, { updated: true, status: verification.status });
	} catch (err) {
		return sendError(res, err);
	}
});

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

		// Route through the provider registry. If the method is offline
		// (cod/card/wallet/bank_transfer) we just record a pending payment
		// that an admin will confirm later. If it's stripe/paymob we ask
		// the provider to initiate a charge and use the returned ids.
		let txnId = transaction_id ?? null;
		let providerMeta: Record<string, unknown> | null = null;
		let initialStatus: string;
		let redirectUrl: string | null = null;
		let clientSecret: string | null = null;

		if (hasProvider(method as PaymentMethod)) {
			const provider = selectProvider(method as PaymentMethod)!;
			const result = await provider.initiate({
				orderId: order_id,
				userId: order.customer_id,
				amount,
				currency,
				method: method as PaymentMethod,
				description: `Nouf-ex order #${order_id}`,
			});
			if (!result.accepted) {
				return sendError(res, `Provider rejected: ${result.message}`, 402);
			}
			txnId = result.transactionId;
			providerMeta = result.raw;
			redirectUrl = result.redirectUrl;
			clientSecret = result.clientSecret;
			initialStatus = 'processing';
		} else if (method === 'cod') {
			initialStatus = 'pending';
		} else {
			// card / wallet / bank_transfer — record pending; admin will
			// mark complete after out-of-band verification.
			initialStatus = 'pending';
		}

		const result = (await db
			.prepare(
				`INSERT INTO payments (order_id, user_id, amount, currency, method, status, provider_txn_id, provider_meta, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, NOW(), NOW())
         RETURNING id`,
			)
			.run(
				order_id,
				order.customer_id,
				amount,
				currency,
				method,
				initialStatus,
				txnId,
				providerMeta ? JSON.stringify(providerMeta) : '{}',
			)) as { lastInsertRowid: number | null };
		if (result.lastInsertRowid == null) {
			return sendError(res, 'Failed to record payment', 500, 'INSERT_FAILED');
		}
		const newPaymentId: number = result.lastInsertRowid;

		// Auto-mark as 'paid' only when the provider explicitly returned
		// accepted=true (real Stripe / Paymob). Stub returns keep the
		// payment in 'processing' until an admin confirms it.
		if (
			initialStatus === 'processing' &&
			method !== 'cod' &&
			hasProvider(method as PaymentMethod)
		) {
			const provider = selectProvider(method as PaymentMethod)!;
			// Stripe Checkout Sessions are not paid until the user returns
			// from the hosted page; we don't auto-mark here. Paymob is
			// also iframe-based. The webhook updates these after the
			// user completes payment.
			if (provider.isConfigured) {
				// Real provider — wait for webhook. Don't update orders.
			} else {
				// Stub provider — mark as paid so the demo flow works.
				await db
					.prepare(
						`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
					)
					.run(order_id);
			}
		}

		sendSuccess(
			res,
			{
				id: newPaymentId,
				status: initialStatus,
				transaction_id: txnId,
				redirect_url: redirectUrl,
				client_secret: clientSecret,
			},
			'Payment recorded',
		);
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
		const order = (await db
			.prepare('SELECT customer_id FROM orders WHERE id = ?')
			.get(orderId)) as { customer_id: number } | undefined;
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
          WHERE id = ? RETURNING order_id, amount`,
			)
			.get(id)) as { order_id: number; amount: number } | undefined;
		await db
			.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`)
			.run(result!.order_id);

		// Fire bilingual i18n notification to the customer (best-effort).
		// (C.1 in MASTER_PLAN.md — real payment confirmation notification)
		try {
			const { onPaymentConfirmed } = await import('../lib/notifications/events.cts');
			const orderRow = (await db
				.prepare('SELECT order_number, customer_id FROM orders WHERE id = ?')
				.get(result!.order_id)) as
				| { order_number: string; customer_id: number }
				| undefined;
			if (orderRow) {
				await onPaymentConfirmed({
					orderId: result!.order_id,
					customerId: orderRow.customer_id,
					orderNumber: orderRow.order_number,
					amount: Number(result!.amount),
				});
			}
		} catch (notifyErr) {
			console.error('[payments] notification dispatch failed:', notifyErr);
		}

		sendSuccess(res, { order_id: result!.order_id }, 'Payment confirmed');
	} catch (err) {
		return sendError(res, err);
	}
});
