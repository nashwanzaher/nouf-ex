// =============================================================================
// Jawali (جوالي) payment provider
// =============================================================================
// Jawali is a Yemeni mobile wallet service.
//
// Integration Status: PENDING API ACCESS
// Contact: https://jawali.ye
// API Documentation: Awaiting merchant onboarding
//
// Environment variables:
//   JAWALI_MERCHANT_ID    - Jawali merchant ID
//   JAWALI_API_KEY        - Jawali API key
//   JAWALI_WEBHOOK_SECRET - Webhook signature secret
// =============================================================================
import { YemeniPaymentProvider, type YemeniProviderConfig, type YemeniPaymentRequest, type YemeniPaymentResponse } from './yemeni-base.ts';

const config: YemeniProviderConfig = {
	method: 'jawali',
	displayName: 'Jawali (جوالي)',
	apiUrl: process.env.JAWALI_API_URL || 'https://api.jawali.ye/v1',
	merchantId: process.env.JAWALI_MERCHANT_ID || '',
	apiKey: process.env.JAWALI_API_KEY || '',
	webhookSecret: process.env.JAWALI_WEBHOOK_SECRET || '',
	callbackUrl: process.env.JAWALI_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:3000'}/api/payments/webhook/jawali`,
	returnUrl: process.env.JAWALI_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:8080',
};

class JawaliProvider extends YemeniPaymentProvider {
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
				error: 'Jawali is not configured',
			};
		}

		// STUB: In production, replace with actual API call
		return {
			success: true,
			transaction_id: `jawali_${request.reference_id}`,
			payment_url: `${config.apiUrl}/pay/${request.reference_id}`,
			qr_code: null,
			error: null,
		};
	}
}

export const jawaliProvider = new JawaliProvider();
