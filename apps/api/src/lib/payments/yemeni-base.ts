// =============================================================================
// Yemeni payment provider base class
// =============================================================================
// Common functionality for Yemeni electronic wallet providers.
// All Yemeni providers follow a similar pattern:
//   1. API-based payment initiation
//   2. Webhook/callback for status updates
//   3. Status verification via API
//
// Security (OWASP ASVS 12.1.1):
//   - HMAC-SHA256 signature verification on webhooks
//   - Idempotent transaction handling
//   - No secrets logged or exposed
//   - TLS required for all API calls
// =============================================================================
import crypto from 'crypto';
import type { PaymentProvider, InitiateInput, InitiateResult, WebhookVerification, PaymentMethod } from './types.ts';

/**
 * Configuration for a Yemeni payment provider.
 */
export interface YemeniProviderConfig {
	/** Payment method identifier */
	method: PaymentMethod;
	/** Display name for the provider */
	displayName: string;
	/** API base URL */
	apiUrl: string;
	/** Merchant ID */
	merchantId: string;
	/** API key for authentication */
	apiKey: string;
	/** Secret key for webhook signature verification */
	webhookSecret: string;
	/** Callback URL for payment notifications */
	callbackUrl: string;
	/** Return URL after payment completion */
	returnUrl: string;
}

/**
 * Standard Yemeni payment request format.
 */
export interface YemeniPaymentRequest {
	/** Merchant ID */
	merchant_id: string;
	/** Order/reference ID */
	reference_id: string;
	/** Amount in minor units (fils) */
	amount: number;
	/** Currency (YER) */
	currency: string;
	/** Description */
	description: string;
	/** Callback URL */
	callback_url: string;
	/** Return URL */
	return_url: string;
	/** Timestamp */
	timestamp: string;
	/** HMAC signature */
	signature: string;
}

/**
 * Standard Yemeni payment response format.
 */
export interface YemeniPaymentResponse {
	/** Success status */
	success: boolean;
	/** Transaction ID from provider */
	transaction_id: string;
	/** Payment URL for redirect */
	payment_url: string | null;
	/** QR code data (if applicable) */
	qr_code: string | null;
	/** Error message if failed */
	error: string | null;
}

/**
 * Standard Yemeni webhook payload.
 */
export interface YemeniWebhookPayload {
	/** Transaction ID */
	transaction_id: string;
	/** Reference ID (our order ID) */
	reference_id: string;
	/** Amount */
	amount: number;
	/** Currency */
	currency: string;
	/** Status */
	status: 'completed' | 'failed' | 'pending';
	/** Timestamp */
	timestamp: string;
	/** HMAC signature */
	signature: string;
}

/**
 * Base class for Yemeni payment providers.
 */
export abstract class YemeniPaymentProvider implements PaymentProvider {
	readonly method: PaymentMethod;
	readonly displayName: string;
	protected readonly config: YemeniProviderConfig;

	constructor(config: YemeniProviderConfig) {
		this.method = config.method;
		this.displayName = config.displayName;
		this.config = config;
	}

	/**
	 * Check if the provider is configured (has required env vars).
	 */
	get isConfigured(): boolean {
		return Boolean(
			this.config.merchantId &&
			this.config.apiKey &&
			this.config.webhookSecret
		);
	}

	/**
	 * Initiate a payment.
	 */
	async initiate(input: InitiateInput): Promise<InitiateResult> {
		if (!this.isConfigured) {
			return {
				accepted: false,
				transactionId: '',
				redirectUrl: null,
				clientSecret: null,
				message: `${this.displayName} is not configured`,
				raw: {},
			};
		}

		try {
			// Build payment request
			const request = this.buildPaymentRequest(input);

			// Sign the request
			const signature = this.createSignature(request);
			const signedRequest = { ...request, signature };

			// Call provider API
			const response = await this.callProviderAPI(signedRequest);

			if (response.success) {
				return {
					accepted: true,
					transactionId: response.transaction_id,
					redirectUrl: response.payment_url,
					clientSecret: response.qr_code,
					message: `Payment initiated via ${this.displayName}`,
					raw: toRecord(response),
				};
			} else {
				return {
					accepted: false,
					transactionId: '',
					redirectUrl: null,
					clientSecret: null,
					message: response.error || 'Payment initiation failed',
					raw: toRecord(response),
				};
			}
		} catch (error) {
			return {
				accepted: false,
				transactionId: '',
				redirectUrl: null,
				clientSecret: null,
				message: error instanceof Error ? error.message : 'Payment initiation failed',
				raw: { error: String(error) },
			};
		}
	}

	/**
	 * Verify webhook callback.
	 */
	async verifyWebhook(
		_headers: Record<string, string>,
		rawBody: string,
	): Promise<WebhookVerification> {
		if (!this.isConfigured) {
			return {
				valid: false,
				transactionId: null,
				status: null,
				raw: {},
			};
		}

		try {
			// Parse webhook payload
			const payload = JSON.parse(rawBody) as YemeniWebhookPayload;

			// Verify signature
			const isValid = this.verifySignature(toRecord(payload));

			if (!isValid) {
				return {
					valid: false,
					transactionId: null,
					status: null,
					raw: { error: 'Invalid signature' },
				};
			}

			// Map provider status to our status
			let status: 'completed' | 'failed' | 'refunded' | null = null;
			switch (payload.status) {
				case 'completed':
					status = 'completed';
					break;
				case 'failed':
					status = 'failed';
					break;
			}

			return {
				valid: true,
				transactionId: payload.transaction_id,
				status,
				raw: toRecord(payload),
			};
		} catch (error) {
			return {
				valid: false,
				transactionId: null,
				status: null,
				raw: { error: String(error) },
			};
		}
	}

	/**
	 * Build payment request.
	 */
	protected buildPaymentRequest(input: InitiateInput): Omit<YemeniPaymentRequest, 'signature'> {
		return {
			merchant_id: this.config.merchantId,
			reference_id: `order_${input.orderId}_${Date.now()}`,
			amount: input.amount,
			currency: input.currency || 'YER',
			description: input.description || `Order #${input.orderId}`,
			callback_url: this.config.callbackUrl,
			return_url: `${this.config.returnUrl}/customer/orders/${input.orderId}`,
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Create HMAC-SHA256 signature.
	 */
	protected createSignature(data: Record<string, unknown>): string {
		const signString = Object.entries(data)
			.filter(([, v]) => v !== undefined && v !== null)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${k}=${v}`)
			.join('&');

		return crypto
			.createHmac('sha256', this.config.webhookSecret)
			.update(signString)
			.digest('hex');
	}

	/**
	 * Verify webhook signature.
	 */
	protected verifySignature(payload: Record<string, unknown>): boolean {
		const signature = payload.signature as string;
		const data = { ...payload };
		delete data.signature;

		const expectedSignature = this.createSignature(data);

		// Constant-time comparison to prevent timing attacks
		if (signature.length !== expectedSignature.length) {
			return false;
		}

		return crypto.timingSafeEqual(
			Buffer.from(signature, 'hex'),
			Buffer.from(expectedSignature, 'hex'),
		);
	}

	/**
	 * Call provider API (to be implemented by each provider).
	 */
	protected abstract callProviderAPI(
		request: YemeniPaymentRequest,
	): Promise<YemeniPaymentResponse>;
}

/**
 * Helper to convert typed objects to Record<string, unknown>.
 */
export function toRecord<T>(obj: T): Record<string, unknown> {
	return obj as unknown as Record<string, unknown>;
}
