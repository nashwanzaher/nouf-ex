/**
 * cart-sync — bridge the local cart (CartContext) to the server cart
 * (noufex_db.cart_items) on login / logout.
 *
 * P0-1 completion: the cart is now persisted in the database for
 * authenticated users, so a customer can start a cart on one device,
 * sign in on another, and find the same items waiting. Anonymous
 * browsing still uses the local cart (localStorage) so the UX is
 * unchanged for unauthenticated visitors.
 *
 * Sync model
 * ----------
 * The server's `POST /api/cart` is idempotent for the merge case:
 * if the product is already in the user's cart, it INCREMENTS the
 * quantity; otherwise it inserts. So the simplest sync is just
 * "push every local item to the server" — the server handles the
 * merge naturally.
 *
 * Failure mode
 * ------------
 * The sync is best-effort. If the network is down or the server
 * returns a transient error, the local cart is preserved (we never
 * clear the local cart until we know the server has accepted every
 * item). Only an auth error (401) aborts the sync immediately —
 * there's no point continuing if the token is no longer valid.
 *
 * The Checkout flow is unaffected: it still reads from the local
 * CartContext, and `placeOrder` builds the order body from those
 * local items. The server's `POST /api/orders` is the source of
 * truth for the order itself (P0-1 / P0-5). Cart persistence is a
 * UX nicety, not a critical path.
 */
import { addToCart, getCart, type CartItem } from './api';

// ── Types ────────────────────────────────────────────────────────────────
/**
 * Subset of CartContext's CartItem that we need to push to the server.
 * We intentionally accept the bare minimum so this helper can be used
 * from anywhere (CartContext, a page, a future migration script).
 */
export interface SyncableCartItem {
	productId: string;
	quantity: number;
}

export interface CartSyncResult {
	/** Number of items successfully pushed to the server cart. */
	pushed: number;
	/** Number of items that failed (kept in local for retry). */
	failed: number;
	/** The server cart after the sync. Empty if the call failed. */
	serverCart: CartItem[];
	/** True when at least one item failed (but the sync otherwise ran). */
	degraded: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────
/** True if the thrown value is an ApiError (or look-alike) with the
 *  given HTTP status. We accept any object with a numeric `status`
 *  property because `ApiError` in api.ts is the only thing that
 *  throws in this codebase, but defensive callers (e.g. tests injecting
 *  their own errors) should still be detected. */
function isApiStatus(err: unknown, status: number): boolean {
	if (typeof err !== 'object' || err === null) return false;
	const e = err as { status?: unknown; name?: unknown };
	return typeof e.status === 'number' && e.status === status;
}

// ── Public API ───────────────────────────────────────────────────────────
/**
 * Read the local cart from localStorage. Returns [] on any failure
 * (corrupt JSON, no localStorage, …). Never throws.
 */
export function readLocalCart(): SyncableCartItem[] {
	try {
		const raw = localStorage.getItem('noufex_cart');
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		// Coerce to the bare shape we need; skip malformed rows.
		const out: SyncableCartItem[] = [];
		for (const row of parsed) {
			if (row && typeof row === 'object' && 'productId' in row && 'quantity' in row) {
				const r = row as { productId: unknown; quantity: unknown };
				const pid = String(r.productId);
				const qty = Number(r.quantity);
				if (pid && Number.isFinite(qty) && qty > 0) {
					out.push({ productId: pid, quantity: qty });
				}
			}
		}
		return out;
	} catch {
		return [];
	}
}

/**
 * Clear the local cart. Safe to call multiple times; never throws.
 */
export function clearLocalCart(): void {
	try {
		localStorage.removeItem('noufex_cart');
	} catch {
		/* localStorage may be unavailable (private mode) */
	}
}

/**
 * Push every item from the local cart to the server cart, then fetch
 * the resulting server cart. Idempotent: the server increments existing
 * quantities rather than creating duplicates.
 *
 * @param userId  The authenticated user id (number, not the AppContext
 *                string form).
 * @param items   The local cart items to push. If empty, the function
 *                still returns the current server cart (useful for a
 *                "load my server cart" call on login).
 * @param signal  Optional AbortSignal for cancellation.
 */
export async function syncLocalCartToServer(
	userId: number,
	items: SyncableCartItem[],
	signal?: AbortSignal,
): Promise<CartSyncResult> {
	let pushed = 0;
	let failed = 0;

	for (const item of items) {
		// Honor abort between items.
		if (signal?.aborted) {
			return { pushed, failed, serverCart: [], degraded: failed > 0 };
		}
		try {
			// addToCart doesn't accept RequestOptions (no signal passthrough
			// today), so we only honour the abort BETWEEN items, not during.
			await addToCart({
				userId,
				productId: Number(item.productId),
				quantity: item.quantity,
			});
			pushed += 1;
		} catch (err) {
			// Auth failure → abort immediately; no point continuing.
			if (isApiStatus(err, 401)) {
				throw err;
			}
			// Validation error (e.g. product out of stock, qty > 100,
			// product id unknown). Keep the local row for the user to
			// resolve later, but don't block the rest of the sync.
			failed += 1;
		}
	}

	// Always pull the final server cart so the caller has the truth.
	let serverCart: CartItem[] = [];
	try {
		serverCart = await getCart(userId, { signal });
	} catch {
		// Best-effort: ignore fetch errors, the caller will see
		// serverCart=[] and can decide what to do.
	}

	return {
		pushed,
		failed,
		serverCart,
		degraded: failed > 0,
	};
}

/**
 * Convenience: full "login just happened" flow.
 * 1. Read the local cart.
 * 2. Push it to the server.
 * 3. Clear the local cart (server is now the source of truth).
 * 4. Return the server cart so the caller can populate the UI.
 *
 * If the sync fails entirely (network down), the local cart is
 * PRESERVED and the caller falls back to the local view.
 */
export async function syncOnLogin(userId: number, signal?: AbortSignal): Promise<CartSyncResult> {
	const local = readLocalCart();
	if (local.length === 0) {
		// Nothing to push. Still pull the server cart so the UI shows
		// items the user added from another device.
		try {
			const serverCart = await getCart(userId, { signal });
			return { pushed: 0, failed: 0, serverCart, degraded: false };
		} catch {
			return { pushed: 0, failed: 0, serverCart: [], degraded: false };
		}
	}

	const result = await syncLocalCartToServer(userId, local, signal);
	if (!result.degraded) {
		// Everything pushed → safe to clear the local cart.
		clearLocalCart();
	}
	return result;
}
