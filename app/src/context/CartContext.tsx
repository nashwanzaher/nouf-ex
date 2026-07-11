import {
	addToCart,
	clearCart as apiClearCart,
	getCart,
	removeFromCart,
	updateCartItem,
} from '@/lib/api/cart';
import type { CartItem as ServerCartItem } from '@/lib/api/types';
import { clearLocalCart, readLocalCart, syncLocalCartToServer } from '@/lib/cart-sync';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	type ReactNode,
} from 'react';
import { useAuth } from './AppContext';

export interface CartItem {
	productId: string;
	name: string;
	price: number;
	quantity: number;
	image: string;
	merchantName: string;
}

interface CartState {
	items: CartItem[];
	loading: boolean;
	error: string | null;
}

interface ServerCartMapping {
	/** productId → server cart item id. Used to issue PATCH/DELETE on the
	 *  server when the user updates quantity or removes an item. */
	ids: Map<string, number>;
}

type CartAction =
	| { type: 'ADD'; payload: CartItem }
	| { type: 'REMOVE'; payload: string }
	| { type: 'UPDATE_QTY'; payload: { productId: string; quantity: number } }
	| { type: 'CLEAR' }
	| { type: 'HYDRATE'; payload: { items: CartItem[]; fromServer: boolean } }
	| { type: 'SET_LOADING'; payload: boolean }
	| { type: 'SET_ERROR'; payload: string | null };

function loadCart(): CartItem[] {
	try {
		const raw = localStorage.getItem('noufex_cart');
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed as CartItem[];
	} catch {
		return [];
	}
}

function cartReducer(state: CartState, action: CartAction): CartState {
	switch (action.type) {
		case 'ADD': {
			const existing = state.items.find((i) => i.productId === action.payload.productId);
			if (existing) {
				return {
					...state,
					items: state.items.map((i) =>
						i.productId === action.payload.productId
							? { ...i, quantity: i.quantity + action.payload.quantity }
							: i,
					),
				};
			}
			return { ...state, items: [...state.items, action.payload] };
		}
		case 'REMOVE':
			return { ...state, items: state.items.filter((i) => i.productId !== action.payload) };
		case 'UPDATE_QTY':
			if (action.payload.quantity <= 0) {
				return {
					...state,
					items: state.items.filter((i) => i.productId !== action.payload.productId),
				};
			}
			return {
				...state,
				items: state.items.map((i) =>
					i.productId === action.payload.productId
						? { ...i, quantity: action.payload.quantity }
						: i,
				),
			};
		case 'CLEAR':
			return { ...state, items: [] };
		case 'HYDRATE':
			return { ...state, items: action.payload.items, loading: false, error: null };
		case 'SET_LOADING':
			return { ...state, loading: action.payload };
		case 'SET_ERROR':
			return { ...state, error: action.payload, loading: false };
		default:
			return state;
	}
}

function toLocalCartItem(serverRow: ServerCartItem): CartItem | null {
	const productId = serverRow.product_id;
	if (!Number.isInteger(productId) || productId <= 0) return null;
	const qty = serverRow.quantity;
	if (!Number.isFinite(qty) || qty <= 0) return null;
	const price = serverRow.price ?? 0;
	return {
		productId: String(productId),
		name: serverRow.name_ar ?? serverRow.name_en ?? '',
		price: Number.isFinite(price) ? price : 0,
		quantity: qty,
		image: serverRow.main_image ?? '',
		merchantName: serverRow.store_name ?? '',
	};
}

function serverCartToLocal(serverCart: ServerCartItem[]): CartItem[] {
	return serverCart.map(toLocalCartItem).filter((i): i is CartItem => i !== null);
}

function buildServerMapping(serverCart: ServerCartItem[]): ServerCartMapping {
	const ids = new Map<string, number>();
	for (const row of serverCart) {
		const id = row.id;
		const productId = row.product_id;
		if (id > 0 && productId > 0) {
			ids.set(String(productId), id);
		}
	}
	return { ids };
}

const CartContext = createContext<{
	state: CartState;
	dispatch: React.Dispatch<CartAction>;
	cartCount: number;
	cartTotal: number;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(cartReducer, undefined, () => ({
		items: loadCart(),
		loading: false,
		error: null,
	}));
	const { user, isAuthenticated } = useAuth();
	const serverMappingRef = useRef<ServerCartMapping>({ ids: new Map() });
	const isInitialSyncRef = useRef(true);

	// Persist guest cart to localStorage. For authenticated users the server
	// is the source of truth, so we avoid overwriting the local backup while
	// sync is in flight.
	useEffect(() => {
		if (isAuthenticated) return;
		try {
			localStorage.setItem('noufex_cart', JSON.stringify(state.items));
		} catch {
			// localStorage may be unavailable (private mode, quota); silent fallback.
		}
	}, [state.items, isAuthenticated]);

	// Sync the cart with the server whenever the authenticated user changes.
	// On login: push any local items to the server, pull the merged server cart,
	// then clear the local backup. On logout: localStorage is already cleared by
	// useAuth().logout; the reducer state will empty itself via the useEffect
	// below or the next mount.
	useEffect(() => {
		if (!isAuthenticated || !user) return;
		const userId = Number(user.id);
		if (!Number.isInteger(userId) || userId <= 0) return;

		let cancelled = false;
		const controller = new AbortController();

		async function sync() {
			dispatch({ type: 'SET_LOADING', payload: true });
			try {
				const local = readLocalCart();
				const result = await syncLocalCartToServer(userId, local, controller.signal);
				if (cancelled) return;
				serverMappingRef.current = buildServerMapping(result.serverCart);
				dispatch({
					type: 'HYDRATE',
					payload: { items: serverCartToLocal(result.serverCart), fromServer: true },
				});
				if (!result.degraded) {
					clearLocalCart();
				}
			} catch {
				if (cancelled) return;
				// Best-effort: keep the local cart if the server is unreachable.
				dispatch({ type: 'SET_ERROR', payload: 'Could not sync cart with server' });
			}
		}

		void sync();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [isAuthenticated, user]);

	// When the user logs out, drop the in-memory cart so a different user (or
	// a guest) never sees the previous user's items. The localStorage backup
	// has already been cleared by useAuth().logout.
	useEffect(() => {
		if (!isAuthenticated && !isInitialSyncRef.current) {
			dispatch({ type: 'CLEAR' });
		}
		isInitialSyncRef.current = false;
	}, [isAuthenticated]);

	// Server-side mutations for authenticated users. The reducer is updated
	// optimistically so the UI feels snappy; we then re-fetch the server cart
	// to reconcile ids/quantities.
	const syncAdd = useCallback(
		async (item: CartItem) => {
			if (!isAuthenticated || !user) return;
			try {
				await addToCart({ productId: Number(item.productId), quantity: item.quantity });
				const serverCart = await getCart(Number(user.id));
				serverMappingRef.current = buildServerMapping(serverCart);
				dispatch({
					type: 'HYDRATE',
					payload: { items: serverCartToLocal(serverCart), fromServer: true },
				});
			} catch {
				dispatch({ type: 'SET_ERROR', payload: 'Could not add item to server cart' });
			}
		},
		[isAuthenticated, user],
	);

	const syncUpdateQty = useCallback(
		async (productId: string, quantity: number) => {
			if (!isAuthenticated || !user) return;
			const cartItemId = serverMappingRef.current.ids.get(productId);
			if (!cartItemId) {
				// Item not on server yet (race). Pull fresh state and let the
				// next user action land on a reconciled mapping.
				const serverCart = await getCart(Number(user.id));
				serverMappingRef.current = buildServerMapping(serverCart);
				dispatch({
					type: 'HYDRATE',
					payload: { items: serverCartToLocal(serverCart), fromServer: true },
				});
				return;
			}
			try {
				if (quantity <= 0) {
					await removeFromCart(cartItemId);
				} else {
					await updateCartItem(cartItemId, { quantity });
				}
				const serverCart = await getCart(Number(user.id));
				serverMappingRef.current = buildServerMapping(serverCart);
				dispatch({
					type: 'HYDRATE',
					payload: { items: serverCartToLocal(serverCart), fromServer: true },
				});
			} catch {
				dispatch({ type: 'SET_ERROR', payload: 'Could not update cart item' });
			}
		},
		[isAuthenticated, user],
	);

	const syncRemove = useCallback(
		async (productId: string) => {
			if (!isAuthenticated || !user) return;
			const cartItemId = serverMappingRef.current.ids.get(productId);
			if (!cartItemId) {
				const serverCart = await getCart(Number(user.id));
				serverMappingRef.current = buildServerMapping(serverCart);
				dispatch({
					type: 'HYDRATE',
					payload: { items: serverCartToLocal(serverCart), fromServer: true },
				});
				return;
			}
			try {
				await removeFromCart(cartItemId);
				const serverCart = await getCart(Number(user.id));
				serverMappingRef.current = buildServerMapping(serverCart);
				dispatch({
					type: 'HYDRATE',
					payload: { items: serverCartToLocal(serverCart), fromServer: true },
				});
			} catch {
				dispatch({ type: 'SET_ERROR', payload: 'Could not remove cart item' });
			}
		},
		[isAuthenticated, user],
	);

	const syncClear = useCallback(async () => {
		if (!isAuthenticated || !user) return;
		try {
			await apiClearCart(Number(user.id));
			serverMappingRef.current = { ids: new Map() };
			dispatch({ type: 'CLEAR' });
		} catch {
			dispatch({ type: 'SET_ERROR', payload: 'Could not clear server cart' });
		}
	}, [isAuthenticated, user]);

	// Wrap the public dispatch so server sync happens automatically for
	// authenticated users while guests stay purely local.
	const dispatchWithSync: React.Dispatch<CartAction> = useCallback(
		(action: CartAction) => {
			dispatch(action);
			switch (action.type) {
				case 'ADD':
					void syncAdd(action.payload);
					break;
				case 'UPDATE_QTY':
					void syncUpdateQty(action.payload.productId, action.payload.quantity);
					break;
				case 'REMOVE':
					void syncRemove(action.payload);
					break;
				case 'CLEAR':
					void syncClear();
					break;
			}
		},
		[syncAdd, syncUpdateQty, syncRemove, syncClear],
	);

	const cartCount = useMemo(() => state.items.reduce((s, i) => s + i.quantity, 0), [state.items]);
	const cartTotal = useMemo(
		() => state.items.reduce((s, i) => s + i.price * i.quantity, 0),
		[state.items],
	);

	const value = useMemo(
		() => ({ state, dispatch: dispatchWithSync, cartCount, cartTotal }),
		[state, dispatchWithSync, cartCount, cartTotal],
	);

	return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
	const ctx = useContext(CartContext);
	if (!ctx) throw new Error('useCart must be inside CartProvider');
	return ctx;
}

export type { CartAction };
