// =============================================================================
// Jib (جيب) payment provider
// =============================================================================
// Jib is a Yemeni electronic wallet service.
//
// Integration Status: PENDING API ACCESS
// Contact: https://jib.ye
// API Documentation: Awaiting merchant onboarding
//
// Environment variables:
//   JIB_MERCHANT_ID    - Jib merchant ID
//   JIB_API_KEY        - Jib API key
//   JIB_WEBHOOK_SECRET - Webhook signature secret
// =============================================================================
import { YemeniPaymentProvider, type YemeniProviderConfig, type YemeniPaymentRequest, type YemeniPaymentResponse } from './yemeni-base.ts';

const config: YemeniProviderConfig = {
	method: 'jib',
	displayName: 'Jib (جيب)',
	apiUrl: process.env.JIB_API_URL || 'https://api.jib.ye/v1',
	merchantId: process.env.JIB_MERCHANT_ID || '',
	apiKey: process.env.JIB_API_KEY || '',
	webhookSecret: process.env.JIB_WEBHOOK_SECRET || '',
	callbackUrl: process.env.JIB_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:3000'}/api/payments/webhook/jib`,
	returnUrl: process.env.JIB_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:8080',
};

class JibProvider extends YemeniPaymentProvider {
	constructor() {
		super(config);
	}

	protected async callProviderAPI(request: YemeniPaymentRequest): Promise<YemeniPaymentResponse> {
		// In production, this would make an HTTP request to the Jib API.
		// For now, we return a stub response.
		//
		// Expected API format (based on Yemeni wallet standards):
		// POST {config.apiUrl}/payments/create
		// Headers: Authorization: Bearer {apiKey}, Content-Type: application/json
		// Body: { merchant_id, reference_id, amount, currency, description, callback_url, return_url, timestamp, signature }
		// Response: { success, transaction_id, payment_url, qr_code, error }

		if (!this.isConfigured) {
			return {
				success: false,
				transaction_id: '',
				payment_url: null,
				qr_code: null,
				error: 'Jib is not configured',
			};
		}

		// STUB: In production, replace with actual API call
		// const response = await fetch(`${config.apiUrl}/payments/create`, {
		//   method: 'POST',
		//   headers: {
		//     'Authorization': `Bearer ${config.apiKey}`,
		//     'Content-Type': 'application/json',
		//   },
		//   body: JSON.stringify(request),
		// });
		// return await response.json();

		return {
			success: true,
			transaction_id: `jib_${request.reference_id}`,
			payment_url: `${config.apiUrl}/pay/${request.reference_id}`,
			qr_code: null,
			error: null,
		};
	}
}

export const jibProvider = new JibProvider();
