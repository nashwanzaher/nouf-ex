// =============================================================================
// Payment providers — shared types
// =============================================================================
// A PaymentProvider knows how to:
//   1. Initiate a charge with an external service (returns a redirect URL,
//      a client secret, or a stub response depending on the provider).
//   2. Verify a webhook callback from the provider (signature + payload).
//   3. Look up the status of a previously-initiated charge.
//
// All real network calls are opt-in via env vars (STRIPE_SECRET_KEY, PAYMOB_API_KEY,
// etc.). Without those keys the corresponding provider falls back to the
// `stub` implementation that simulates the flow locally — useful for the MVP
// and for tests. The schema CHECK on payments.method still lists every
// supported method so we don't drop coverage, but only providers whose
// implementation is registered AND have their keys configured will route
// real money.
// =============================================================================

export type PaymentMethod =
	| 'cod'
	| 'card'
	| 'wallet'
	| 'bank_transfer'
	| 'stripe'
	| 'paymob'
	| 'alipay'
	| 'wechat_pay'
	| 'jib'
	| 'alkarimi'
	| 'jawali'
	| 'floosk'
	| 'yemen_wallet';

export interface InitiateInput {
	orderId: number;
	userId: number;
	amount: number; // major units (e.g. 9500 = 9500.00 YER)
	currency: string; // ISO 4217
	method: PaymentMethod;
	// Free-form descriptor returned to the client (e.g. order number).
	description: string;
	// Optional provider-specific hint (e.g. saved payment-method id).
	providerMeta?: Record<string, unknown>;
}

export interface InitiateResult {
	// True if the provider accepted the request and (eventually) the money
	// will land. False if the provider rejected it synchronously.
	accepted: boolean;
	// Provider's transaction id (or a stub id). Persisted on payments.transaction_id.
	transactionId: string;
	// For redirect-based flows (Stripe Checkout, Paymob iframe), a URL the
	// client should navigate to. Null for in-place flows (Stripe Elements,
	// COD).
	redirectUrl: string | null;
	// For inline-flow providers (Stripe Elements), an opaque blob the
	// client passes back to confirm the payment on-device.
	clientSecret: string | null;
	// Human-readable message (errors, status info).
	message: string;
	// Raw provider payload for debugging. Stored on payments.provider_meta.
	raw: Record<string, unknown>;
}

export interface WebhookVerification {
	valid: boolean;
	// The provider's transaction id extracted from the payload (or null if invalid).
	transactionId: string | null;
	// New status to apply to the local payment: 'completed' | 'failed' | 'refunded'.
	status: 'completed' | 'failed' | 'refunded' | null;
	// Raw payload (after signature verification).
	raw: Record<string, unknown>;
}

export interface PaymentProvider {
	readonly method: PaymentMethod;
	readonly displayName: string;
	// True if this provider has the env vars it needs to talk to a real
	// service. When false the registry routes through the stub.
	readonly isConfigured: boolean;
	initiate(input: InitiateInput): Promise<InitiateResult>;
	verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<WebhookVerification>;
}
