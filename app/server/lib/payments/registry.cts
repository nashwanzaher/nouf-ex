// =============================================================================
// Payment provider registry
// =============================================================================
// Selects a PaymentProvider for a given method. When a real provider
// (Stripe / Paymob) is configured AND its env vars are present, it wins.
// Otherwise the stub provider is used so the rest of the app still works
// end-to-end during development.
//
// Methods that have NO provider registered at all (wallet, bank_transfer,
// card) return null — the caller treats that as "this method cannot be
// initiated online; the client should fall back to manual confirmation
// (e.g. admin marks wallet/bank as paid after a transfer screenshot).
// =============================================================================
import { stubProvider } from './stub.cts';
import { stripeProvider } from './stripe.cts';
import { paymobProvider } from './paymob.cts';
import type { PaymentMethod, PaymentProvider } from './types.cts';

const REGISTRY: Record<PaymentMethod, PaymentProvider | null> = {
	// Real providers — only active when env keys are configured.
	stripe: stripeProvider,
	paymob: paymobProvider,
	// Offline / cash methods — never go through a network provider.
	// They are handled directly by the payments route (record + wait
	// for admin confirmation).
	cod: null,
	card: null,
	wallet: null,
	bank_transfer: null,
};

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
	return method === 'stripe' || method === 'paymob';
}

/** Surface configured providers for /api/payments/methods (admin UI). */
export function listProviders(): Array<{
	method: PaymentMethod;
	displayName: string;
	live: boolean;
}> {
	return (['stripe', 'paymob'] as PaymentMethod[]).map((m) => ({
		method: m,
		displayName: REGISTRY[m]!.displayName,
		live: REGISTRY[m]!.isConfigured,
	}));
}
