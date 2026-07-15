// =============================================================================
// Yemen Wallet (يمن والت) payment provider
// =============================================================================
// Yemen Wallet is a Yemeni electronic wallet service.
//
// Integration Status: PENDING API ACCESS
// Contact: https://yemenwallet.ye
// API Documentation: Awaiting merchant onboarding
//
// Environment variables:
//   YEMEN_WALLET_MERCHANT_ID    - Yemen Wallet merchant ID
//   YEMEN_WALLET_API_KEY        - Yemen Wallet API key
//   YEMEN_WALLET_WEBHOOK_SECRET - Webhook signature secret
// =============================================================================
import { YemeniPaymentProvider, type YemeniProviderConfig, type YemeniPaymentRequest, type YemeniPaymentResponse } from './yemeni-base.ts';

const config: YemeniProviderConfig = {
	method: 'yemen_wallet',
	displayName: 'Yemen Wallet (يمن والت)',
	apiUrl: process.env.YEMEN_WALLET_API_URL || 'https://api.yemenwallet.ye/v1',
	merchantId: process.env.YEMEN_WALLET_MERCHANT_ID || '',
	apiKey: process.env.YEMEN_WALLET_API_KEY || '',
	webhookSecret: process.env.YEMEN_WALLET_WEBHOOK_SECRET || '',
	callbackUrl: process.env.YEMEN_WALLET_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:3000'}/api/payments/webhook/yemen_wallet`,
	returnUrl: process.env.YEMEN_WALLET_RETURN_URL || process.env.FRONTEND_URL || 'http://localhost:8080',
};

class YemenWalletProvider extends YemeniPaymentProvider {
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
				error: 'Yemen Wallet is not configured',
			};
		}

		// STUB: In production, replace with actual API call
		return {
			success: true,
			transaction_id: `yemenwallet_${request.reference_id}`,
			payment_url: `${config.apiUrl}/pay/${request.reference_id}`,
			qr_code: null,
			error: null,
		};
	}
}

export const yemenWalletProvider = new YemenWalletProvider();
