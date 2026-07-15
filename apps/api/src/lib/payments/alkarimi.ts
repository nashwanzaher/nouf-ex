// =============================================================================
// Al-Karimi (الكريمي) payment provider
// =============================================================================
// Al-Karimi is a Yemeni electronic wallet service.
//
// Integration Status: PENDING API ACCESS
// Contact: https://alkarimi.com
// API Documentation: Awaiting merchant onboarding
//
// Environment variables:
//   ALKARIMI_MERCHANT_ID    - Al-Karimi merchant ID
//   ALKARIMI_API_KEY        - Al-Karimi API key
//   ALKARIMI_WEBHOOK_SECRET - Webhook signature secret
// =============================================================================
import { YemeniPaymentProvider, type YemeniProviderConfig, type YemeniPaymentRequest, type YemeniPaymentResponse } from './yemeni-base.ts';

const config: YemeniProviderConfig = {
	method: 'alkarimi',
	displayName: 'Al-Karimi (الكريمي)',
	apiUrl: process.env.ALKARIMI_API_URL || 'https://api.alkarimi.com/v1',
	merchantId: process.env.ALKARIMI_MERCHANT_ID || '',
	apiKey: process.env.ALKARIMI_API_KEY || '',
	webhookSecret: process.env.ALKARIMI_WEBHOOK_SECRET || '',
	callbackUrl: process.env.ALKARIMI_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:3000'}/api/payments/webhook/alkarimi`,
	returnUrl: process.env.ALKARIMI_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:8080',
};

class AlKarimiProvider extends YemeniPaymentProvider {
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
				error: 'Al-Karimi is not configured',
			};
		}

		// STUB: In production, replace with actual API call
		return {
			success: true,
			transaction_id: `alkarimi_${request.reference_id}`,
			payment_url: `${config.apiUrl}/pay/${request.reference_id}`,
			qr_code: null,
			error: null,
		};
	}
}

export const alkarimiProvider = new AlKarimiProvider();
