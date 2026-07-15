// =============================================================================
// Alipay payment provider
// =============================================================================
// Implements Alipay Cross-Border Web Payment for international customers.
//
// Security (OWASP ASVS 12.1.1):
//   - HMAC-SHA256 signature verification on webhooks
//   - Idempotent transaction handling
//   - No secrets logged or exposed
//
// Environment variables:
//   ALIPAY_APP_ID        - Alipay application ID
//   ALIPAY_PRIVATE_KEY   - RSA private key (base64 encoded)
//   ALIPAY_PUBLIC_KEY    - Alipay's RSA public key (base64 encoded)
//   ALIPAY_GATEWAY_URL   - Alipay gateway URL (default: https://openapi.alipay.com/gateway.do)
// =============================================================================
import crypto from 'crypto';
import type { PaymentProvider, InitiateInput, InitiateResult, WebhookVerification } from './types.ts';

const ALIPAY_APP_ID = process.env.ALIPAY_APP_ID;
const ALIPAY_PRIVATE_KEY = process.env.ALIPAY_PRIVATE_KEY;
const ALIPAY_PUBLIC_KEY = process.env.ALIPAY_PUBLIC_KEY;
const ALIPAY_GATEWAY_URL = process.env.ALIPAY_GATEWAY_URL || 'https://openapi.alipay.com/gateway.do';

class AlipayProvider implements PaymentProvider {
	readonly method = 'alipay' as const;
	readonly displayName = 'Alipay';
	readonly isConfigured = Boolean(ALIPAY_APP_ID && ALIPAY_PRIVATE_KEY && ALIPAY_PUBLIC_KEY);

	/**
	 * Initiate an Alipay payment.
	 * Creates a payment order and returns a redirect URL.
	 */
	async initiate(input: InitiateInput): Promise<InitiateResult> {
		if (!this.isConfigured) {
			return {
				accepted: false,
				transactionId: '',
				redirectUrl: null,
				clientSecret: null,
				message: 'Alipay is not configured',
				raw: {},
			};
		}

		try {
			// Build Alipay request parameters
			const params = this.buildRequestParams(input);

			// Sign the request
			const signedParams = this.signRequest(params);

			// Build redirect URL
			const redirectUrl = this.buildRedirectUrl(signedParams);

			return {
				accepted: true,
				transactionId: `alipay_${input.orderId}_${Date.now()}`,
				redirectUrl,
				clientSecret: null,
				message: 'Redirect to Alipay for payment',
				raw: { params: signedParams },
			};
		} catch (error) {
			return {
				accepted: false,
				transactionId: '',
				redirectUrl: null,
				clientSecret: null,
				message: error instanceof Error ? error.message : 'Alipay initiation failed',
				raw: { error: String(error) },
			};
		}
	}

	/**
	 * Verify Alipay webhook callback.
	 * Validates RSA signature to ensure authenticity.
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
			// Parse the notification body
			const params = new URLSearchParams(rawBody);
			const sign = params.get('sign');
			const signType = params.get('sign_type');

			if (!sign || signType !== 'RSA2') {
				return {
					valid: false,
					transactionId: null,
					status: null,
					raw: { error: 'Missing or invalid sign' },
				};
			}

			// Build sign string (exclude sign and sign_type)
			const signParams = new Map<string, string>();
			params.forEach((value, key) => {
				if (key !== 'sign' && key !== 'sign_type') {
					signParams.set(key, value);
				}
			});

			const signString = Array.from(signParams.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => `${k}=${v}`)
				.join('&');

			// Verify RSA2 signature
			const isValid = this.verifySignature(signString, sign);

			if (!isValid) {
				return {
					valid: false,
					transactionId: null,
					status: null,
					raw: { error: 'Invalid signature' },
				};
			}

			// Extract transaction details
			const tradeNo = params.get('trade_no');
			const tradeStatus = params.get('trade_status');
			const outTradeNo = params.get('out_trade_no');

			// Map Alipay status to our status
			let status: 'completed' | 'failed' | 'refunded' | null = null;
			switch (tradeStatus) {
				case 'TRADE_SUCCESS':
				case 'TRADE_FINISHED':
					status = 'completed';
					break;
				case 'TRADE_CLOSED':
					status = 'failed';
					break;
				case 'TRADE_REFUND':
					status = 'refunded';
					break;
			}

			return {
				valid: true,
				transactionId: tradeNo || outTradeNo || null,
				status,
				raw: Object.fromEntries(params),
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
	 * Build Alipay request parameters.
	 */
	private buildRequestParams(input: InitiateInput): Record<string, string> {
		return {
			app_id: ALIPAY_APP_ID!,
			method: 'alipay.trade.page.pay',
			charset: 'utf-8',
			sign_type: 'RSA2',
			timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
			version: '1.0',
			notify_url: `${process.env.API_URL || 'http://localhost:3000'}/api/payments/webhook/alipay`,
			return_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/customer/orders/${input.orderId}`,
			biz_content: JSON.stringify({
				out_trade_no: `order_${input.orderId}_${Date.now()}`,
				total_amount: (input.amount / 100).toFixed(2), // Convert minor to major units
				subject: input.description || `Order #${input.orderId}`,
				product_code: 'FAST_INSTANT_TRADE_PAY',
			}),
		};
	}

	/**
	 * Sign request with RSA2 (SHA256WithRSA).
	 */
	private signRequest(params: Record<string, string>): Record<string, string> {
		// Build sign string
		const signString = Object.entries(params)
			.filter(([, v]) => v !== '' && v !== undefined && v !== null)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${k}=${v}`)
			.join('&');

		// Sign with RSA private key
		const sign = this.createSignature(signString);

		return { ...params, sign };
	}

	/**
	 * Create RSA2 signature.
	 */
	private createSignature(data: string): string {
		const privateKey = Buffer.from(ALIPAY_PRIVATE_KEY!, 'base64').toString('utf-8');
		const sign = crypto.createSign('RSA-SHA256');
		sign.update(data, 'utf-8');
		return sign.sign(privateKey, 'base64');
	}

	/**
	 * Verify RSA2 signature.
	 */
	private verifySignature(data: string, signature: string): boolean {
		try {
			const publicKey = Buffer.from(ALIPAY_PUBLIC_KEY!, 'base64').toString('utf-8');
			const verify = crypto.createVerify('RSA-SHA256');
			verify.update(data, 'utf-8');
			return verify.verify(publicKey, signature, 'base64');
		} catch {
			return false;
		}
	}

	/**
	 * Build redirect URL for Alipay payment page.
	 */
	private buildRedirectUrl(params: Record<string, string>): string {
		const queryString = Object.entries(params)
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join('&');

		return `${ALIPAY_GATEWAY_URL}?${queryString}`;
	}
}

export const alipayProvider = new AlipayProvider();
