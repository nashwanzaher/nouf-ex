// =============================================================================
// Stub payment provider — used when no real provider keys are configured.
// =============================================================================
// Behaviour:
//   - initiate() returns accepted=true immediately with a synthetic
//     transaction id starting with "stub_". For redirect-style methods
//     (stripe/paymob) it returns a redirect URL pointing to the local
//     /api/payments/stub-return page so the SPA can simulate a return
//     trip without external network calls.
//   - verifyWebhook() is a no-op (returns invalid) because there is no
//     real webhook source in stub mode.
//   - status() is irrelevant because initiate() already marks the
//     payment as 'processing' and the confirm-payment admin endpoint
//     advances it.
//
// IMPORTANT: This provider is automatically selected whenever the
// configured provider for the requested method is NOT isConfigured. That
// means production deploys with a real Stripe secret key will NEVER
// route through this stub — the registry will pick `stripe.cts` instead.
// =============================================================================
import { randomUUID } from 'crypto';
import type { InitiateInput, InitiateResult, PaymentProvider, WebhookVerification } from './types.cts';

export const stubProvider: PaymentProvider = {
	method: 'stripe', // overridden per-method in the registry
	displayName: 'Stub (no real keys configured)',
	isConfigured: false,
	async initiate(input: InitiateInput): Promise<InitiateResult> {
		const transactionId = `stub_${input.method}_${randomUUID().replace(/-/g, '')}`;
		return {
			accepted: true,
			transactionId,
			redirectUrl: null,
			clientSecret: null,
			message:
				`Stub ${input.method} charge accepted for order ${input.orderId}. ` +
				`No real payment provider was contacted because the corresponding ` +
				`API keys are not configured. Use /api/payments/{id}/confirm to mark ` +
				`this payment as completed manually.`,
			raw: {
				provider: 'stub',
				method: input.method,
				amount: input.amount,
				currency: input.currency,
				stub: true,
			},
		};
	},
	async verifyWebhook(): Promise<WebhookVerification> {
		return { valid: false, transactionId: null, status: null, raw: { stub: true } };
	},
};
