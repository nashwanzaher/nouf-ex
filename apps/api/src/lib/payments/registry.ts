// =============================================================================
// Payment provider registry
// =============================================================================
// Selects a PaymentProvider for a given method. When a real provider
// (Stripe / Paymob / Alipay / WeChat Pay / Yemeni wallets) is configured
// AND its env vars are present, it wins. Otherwise the stub provider is
// used so the rest of the app still works end-to-end during development.
//
// Methods that have NO provider registered at all (wallet, bank_transfer,
// card) return null — the caller treats that as "this method cannot be
// initiated online; the client should fall back to manual confirmation
// (e.g. admin marks wallet/bank as paid after a transfer screenshot).
// =============================================================================
import { stubProvider } from './stub.ts';
import { stripeProvider } from './stripe.ts';
import { paymobProvider } from './paymob.ts';
import { alipayProvider } from './alipay.ts';
import { wechatPayProvider } from './wechat-pay.ts';
import { jibProvider } from './jib.ts';
import { alkarimiProvider } from './alkarimi.ts';
import { jawaliProvider } from './jawali.ts';
import { flooskProvider } from './floosk.ts';
import { yemenWalletProvider } from './yemen-wallet.ts';
import type { PaymentMethod, PaymentProvider } from './types.ts';

const REGISTRY: Record<PaymentMethod, PaymentProvider | null> = {
	// International providers — only active when env keys are configured.
	stripe: stripeProvider,
	paymob: paymobProvider,
	alipay: alipayProvider,
	wechat_pay: wechatPayProvider,
	// Yemeni wallet providers — only active when env keys are configured.
	jib: jibProvider,
	alkarimi: alkarimiProvider,
	jawali: jawaliProvider,
	floosk: flooskProvider,
	yemen_wallet: yemenWalletProvider,
	// Offline / cash methods — never go through a network provider.
	// They are handled directly by the payments route (record + wait
	// for admin confirmation).
	cod: null,
	card: null,
	wallet: null,
	bank_transfer: null,
};

/** Methods that have a real network provider (not null, not stub). */
const PROVIDER_METHODS: PaymentMethod[] = [
	'stripe', 'paymob', 'alipay', 'wechat_pay',
	'jib', 'alkarimi', 'jawali', 'floosk', 'yemen_wallet',
];

/**
 * Returns the provider that should handle `method`. Falls back to the
 * stub provider when no real provider is configured. Returns null for
 * offline methods (cod/card/wallet/bank_transfer) which the route
 * handles inline.
 */
export function selectProvider(method: PaymentMethod): PaymentProvider | null {
	if (
		method === 'cod' ||
		method === 'card' ||
		method === 'wallet' ||
		method === 'bank_transfer'
	) {
		return null;
	}
	const provider = REGISTRY[method];
	if (provider && provider.isConfigured) return provider;
	return stubProvider;
}

/** True if the method has any provider (real or stub) wired in. */
export function hasProvider(method: PaymentMethod): boolean {
	return PROVIDER_METHODS.includes(method);
}

/** Surface configured providers for /api/payments/methods (admin UI). */
export function listProviders(): Array<{
	method: PaymentMethod;
	displayName: string;
	live: boolean;
}> {
	return PROVIDER_METHODS.map((m) => ({
		method: m,
		displayName: REGISTRY[m]!.displayName,
		live: REGISTRY[m]!.isConfigured,
	}));
}

/** Get all available payment methods (including offline). */
export function getAllPaymentMethods(): PaymentMethod[] {
	return Object.keys(REGISTRY) as PaymentMethod[];
}

/** Get Yemeni wallet providers only. */
export function getYemeniProviders(): Array<{
	method: PaymentMethod;
	displayName: string;
	live: boolean;
}> {
	const yemeniMethods: PaymentMethod[] = ['jib', 'alkarimi', 'jawali', 'floosk', 'yemen_wallet'];
	return yemeniMethods.map((m) => ({
		method: m,
		displayName: REGISTRY[m]!.displayName,
		live: REGISTRY[m]!.isConfigured,
	}));
}
