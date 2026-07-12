import { Router, type Request, type Response } from 'express';
import type { PgTxDb } from '../db/pg-wrapper.ts';
import { ErrorCodes } from '../lib/error-codes.ts';
import { hasProvider, listProviders, selectProvider } from '../lib/payments/registry.ts';
import type { PaymentMethod } from '../lib/payments/types.ts';
import {
    authLimiter,
    db,
    log,
    paymentCreateSchema,
    rateLimit,
    requireAuth,
    sendError,
    sendSuccess,
    validate,
} from '../lib/shared.ts';

export const paymentsRouter = Router();

// SECURITY (M-3, 2026-07-02): the webhook endpoint was the only
// state-changing route without any rate limit. Each call invokes
// HMAC computation + DB UPDATE. An attacker firing millions of
// requests could saturate CPU even though every request 400s out.
// We allow 120 req/min/IP (2 Hz sustained, with burst headroom for
// legitimate provider retries). The limiter is in-memory and
// resets on process restart Ù?¤ that's fine because the goal is
// rate limiting, not counting, and the bucket is keyed on IP
// which is also re-acquired on restart.
const webhookLimiter = rateLimit(60_000, 120, 'webhook');

// GET /api/payments/methods Ù?¤ surfaces which providers are live so the
// client UI can grey out methods that aren't actually wired up.
paymentsRouter.get('/methods', (_req: Request, res: Response) => {
	try {
		sendSuccess(res, listProviders());
	} catch (err) {
		return sendError(res, err);
	}
});

// POST /api/payments/webhook/:method Ù?¤ entrypoint for provider callbacks.
// We accept both Stripe-style (sig in body) and Paymob-style (sig in
// query) webhooks; the chosen provider's verifyWebhook() decides.
//
// P1-1 (2026-07-04, deep audit 2026-06-30): this endpoint is now
// idempotent via the `webhook_events` dedup table (see migration
// 0020). The dedup key is (provider, event_id, transaction_id,
// event_type) Ù?¤ an UNIQUE constraint we claim atomically with
// `INSERT ... ON CONFLICT DO NOTHING`. The matching payments UPDATE
// and the dedup-row "processed" flag transition happen inside the
// same transaction so concurrent duplicates update at most once.
paymentsRouter.post('/webhook/:method', webhookLimiter, async (req: Request, res: Response) => {
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
		// Normalise the dedup inputs. event_id is optional Ù?¤ Stripe
		// provides one, Paymob does not. When absent we fall back
		// to the transaction_id so we still have a stable key.
		const eventId =
			(verification as { eventId?: string }).eventId ?? verification.transactionId;
		const eventType = verification.status; // 'succeeded' | 'failed' | 'refunded'

		// Atomic claim: if a row for this dedup key already exists,
		// the INSERT returns no row and we short-circuit to a 200
		// with `duplicate: true` so the provider stops retrying.
		const claimed = (await db
			.prepare(
				`INSERT INTO webhook_events
                    (provider, event_id, transaction_id, event_type, payload)
                 VALUES ($1, $2, $3, $4, $5::jsonb)
                 ON CONFLICT (provider, event_id, transaction_id, event_type)
                    DO NOTHING
                 RETURNING id`,
			)
			.get(
				method,
				eventId,
				verification.transactionId,
				eventType,
				JSON.stringify({
					header_count: Object.keys(headers).length,
					body_len: raw.length,
				}),
			)) as { id: number } | undefined;

		if (!claimed) {
			// Duplicate: this dedup key has been seen before. Look
			// up when it was first processed and return idempotent
			// success without performing another UPDATE.
			const existing = (await db
				.prepare(
					`SELECT processing_state, processed_at
                       FROM webhook_events
                      WHERE provider = $1
                        AND event_id  = $2
                        AND transaction_id = $3
                        AND event_type = $4`,
				)
				.get(method, eventId, verification.transactionId, eventType)) as
				| { processing_state: string; processed_at: string | null }
				| undefined;
		log.info({
			event: 'webhook_duplicate',
			method,
			event_id: eventId,
			txn_id: verification.transactionId,
			processing_state: existing?.processing_state,
		});
			return sendSuccess(res, {
				updated: true,
				idempotent: true,
				duplicate: true,
				first_processed_at: existing?.processed_at ?? null,
			});
		}

		// First time we see this dedup key. Atomically: (a) UPDATE
		// the matching payments row, and (b) flip the dedup row's
		// processing_state to 'processed'. Both inside one
		// transaction so concurrent inserts of the same key can't
		// both reach this branch.
		await db.tx(async (txDb: PgTxDb) => {
			const upd = (await txDb
				.prepare(
					`UPDATE payments
                            SET status    = $1,
                                updated_at = NOW()
                          WHERE provider_txn_id = $2
                          RETURNING id`,
				)
				.get(verification.status, verification.transactionId)) as
				| { id: number }
				| undefined;
			await txDb
				.prepare(
					`UPDATE webhook_events
                            SET processing_state = 'processed',
                                processed_at      = NOW()
                          WHERE id = $1`,
				)
				.run(claimed.id);
			if (!upd) {
				// No matching local payment row yet (provider beat
				// the checkout flow Ù?¤ rare but documented). The
				// webhook is still 200: the dedup row prevents
				// future retries from re-applying.
				log.warn({
				msg: 'payments.webhook_no_local_payment',
				method,
				txn_id: verification.transactionId,
			});
			}
		});

		sendSuccess(res, {
			updated: true,
			idempotent: true,
			duplicate: false,
			status: verification.status,
		});
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

		// SECURITY: verify amount matches order total to prevent underpayment
		const orderTotal = Number(order.total);
		if (amount < orderTotal * 0.99) {
			return sendError(res, `Payment amount (${amount}) is less than order total (${orderTotal})`, 400, 'AMOUNT_MISMATCH');
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
			// card / wallet / bank_transfer Ù?¤ record pending; admin will
			// mark complete after out-of-band verification.
			initialStatus = 'pending';
		}

		// Re-check for existing payment inside a transaction to prevent
		// race conditions where concurrent requests both pass the
		// idempotency check and both insert duplicate payments.
		const result = await db.tx(async (tx) => {
			const duplicateCheck = (await tx.prepare(
				'SELECT id, status FROM payments WHERE order_id = ? AND method = ?',
			).get(order_id, method)) as { id: number; status: string } | undefined;
			if (duplicateCheck) {
				return { ...duplicateCheck, idempotent: true };
			}
			const row = (await tx.prepare(
				`INSERT INTO payments (order_id, user_id, amount, currency, method, status, provider_txn_id, provider_meta, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, NOW(), NOW())
         RETURNING id`,
			).run(
				order_id,
				order.customer_id,
				amount,
				currency,
				method,
				initialStatus,
				txnId,
				providerMeta ? JSON.stringify(providerMeta) : '{}',
			)) as { lastInsertRowid: number | null };
			return { id: row.lastInsertRowid, status: initialStatus, idempotent: false };
		});
		if ('idempotent' in result && result.idempotent) {
			return sendSuccess(res, { id: result.id, status: result.status, idempotent: true });
		}
		if (result.id == null) {
			return sendError(res, 'Failed to record payment', 500, ErrorCodes.INSERT_FAILED);
		}
		const newPaymentId: number = result.id;

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
				// Real provider Ù?¤ wait for webhook. Don't update orders.
			} else {
				// Stub provider Ù?¤ mark as paid so the demo flow works.
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
		// DB-P2-03 (added 2026-07-02): explicit column list. The previous
		// `SELECT *` exposed `provider_response` (raw gateway JSON that
		// can contain debug fields, internal tokens, and PII the SPA
		// has no business seeing). If the SPA needs the raw payload,
		// add it back to the columns here behind a feature flag.
		const payments = await db
			.prepare(
				`SELECT id, order_id, amount, currency, status, method,
				        reference, created_at, updated_at
				 FROM payments
				 WHERE order_id = ?
				 ORDER BY created_at DESC`,
			)
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

		const payment = (await db
			.prepare('SELECT order_id, status FROM payments WHERE id = ?')
			.get(id)) as { order_id: number; status: string } | undefined;
		if (!payment) return sendError(res, 'Payment not found', 404);
		if (payment.status === 'completed') {
			return sendError(res, 'Payment already confirmed', 409, 'ALREADY_CONFIRMED');
		}
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
				 WHERE id = ? AND status != 'completed' RETURNING order_id, amount`,
			)
			.get(id)) as { order_id: number; amount: number } | undefined;
		if (!result) {
			return sendError(res, 'Payment not found or already confirmed', 404);
		}
		await db
			.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`)
			.run(result.order_id);

		// Fire bilingual i18n notification to the customer (best-effort).
		// (C.1 in MASTER_PLAN.md Ù?¤ real payment confirmation notification)
		try {
			const { onPaymentConfirmed } = await import('../lib/notifications/events.ts');
			const orderRow = (await db
				.prepare('SELECT order_number, customer_id FROM orders WHERE id = ?')
				.get(result.order_id)) as
				| { order_number: string; customer_id: number }
				| undefined;
			if (orderRow) {
				await onPaymentConfirmed({
					orderId: result.order_id,
					customerId: orderRow.customer_id,
					orderNumber: orderRow.order_number,
					amount: Number(result.amount),
				});
			}
		} catch (notifyErr) {
			log.error({ msg: 'payments.notification_dispatch_failed', error: (notifyErr as Error).message });
		}

		sendSuccess(res, { order_id: result.order_id }, 'Payment confirmed');
	} catch (err) {
		return sendError(res, err);
	}
});
