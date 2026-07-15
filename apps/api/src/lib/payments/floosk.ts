// =============================================================================
// Floosk (فلوسك) payment provider
// =============================================================================
// Floosk is a Yemeni electronic wallet service.
//
// Integration Status: PENDING API ACCESS
// Contact: https://floosk.com
// API Documentation: Awaiting merchant onboarding
//
// Environment variables:
//   FLOOSK_MERCHANT_ID    - Floosk merchant ID
//   FLOOSK_API_KEY        - Floosk API key
//   FLOOSK_WEBHOOK_SECRET - Webhook signature secret
// =============================================================================
import { YemeniPaymentProvider, type YemeniProviderConfig, type YemeniPaymentRequest, type YemeniPaymentResponse } from './yemeni-base.ts';

const config: YemeniProviderConfig = {
	method: 'floosk',
	displayName: 'Floosk (فلوسك)',
	apiUrl: process.env.FLOOSK_API_URL || 'https://api.floosk.com/v1',
	merchantId: process.env.FLOOSK_MERCHANT_ID || '',
	apiKey: process.env.FLOOSK_API_KEY || '',
	webhookSecret: process.env.FLOOSK_WEBHOOK_SECRET || '',
	callbackUrl: process.env.FLOOSK_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:3000'}/api/payments/webhook/floosk`,
	returnUrl: process.env.FLOOSK_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:8080',
};

class FlooskProvider extends YemeniPaymentProvider {
	constructor() {
		super(config);
	}

	protected async callProviderAPI(request: YemeniPaymentRequest): Promise<YemeniPaymentResponse> {
		if (!this.isConfigured) {
			return {
				success: false,
				transaction_id: '',
				payment_url: null,
				qr_code: null,
				error: 'Floosk is not configured',
			};
		}

		// STUB: In production, replace with actual API call
		return {
			success: true,
			transaction_id: `floosk_${request.reference_id}`,
			payment_url: `${config.apiUrl}/pay/${request.reference_id}`,
			qr_code: null,
			error: null,
		};
	}
}

export const flooskProvider = new FlooskProvider();
