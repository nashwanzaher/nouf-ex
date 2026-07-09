import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

interface CartItem {
	productId: string;
	name: string;
	price: number;
	quantity: number;
	image: string;
	merchantName: string;
}

interface CartState {
	items: CartItem[];
}

type CartAction =
	| { type: 'ADD'; payload: CartItem }
	| { type: 'REMOVE'; payload: string }
	| { type: 'UPDATE_QTY'; payload: { productId: string; quantity: number } }
	| { type: 'CLEAR' };

function loadCart(): CartItem[] {
	try {
		const parsed = JSON.parse(localStorage.getItem('noufex_cart') || '[]');
		if (!Array.isArray(parsed)) return [];
		return parsed;
	} catch {
		return [];
	}
}

// C6 fix: use a lazy initializer so the cart is read from localStorage at
// component mount, not at module-load time. This means a change made in
// another tab is picked up the next time this provider mounts.
const initialStateFactory = (): CartState => ({ items: loadCart() });

function cartReducer(state: CartState, action: CartAction): CartState {
	// C6 fix: reducer is now a pure function. Persistence moved to useEffect in CartProvider.
	switch (action.type) {
		case 'ADD': {
			const existing = state.items.find((i) => i.productId === action.payload.productId);
			if (existing) {
				return {
					items: state.items.map((i) =>
						i.productId === action.payload.productId
							? { ...i, quantity: i.quantity + action.payload.quantity }
							: i,
					),
				};
			}
			return { items: [...state.items, action.payload] };
		}
		case 'REMOVE':
			return { items: state.items.filter((i) => i.productId !== action.payload) };
		case 'UPDATE_QTY':
			if (action.payload.quantity <= 0) {
				return {
					items: state.items.filter((i) => i.productId !== action.payload.productId),
				};
			}
			return {
				items: state.items.map((i) =>
					i.productId === action.payload.productId
						? { ...i, quantity: action.payload.quantity }
						: i,
				),
			};
		case 'CLEAR':
			return { items: [] };
		default:
			return state;
	}
}

const CartContext = createContext<{
	state: CartState;
	dispatch: React.Dispatch<CartAction>;
	cartCount: number;
	cartTotal: number;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(cartReducer, undefined, initialStateFactory);

	// C6 fix: persist cart via useEffect so the reducer stays pure.
	useEffect(() => {
		try {
			localStorage.setItem('noufex_cart', JSON.stringify(state.items));
		} catch {
			// localStorage might be unavailable (private mode, quota); silent fallback.
		}
	}, [state.items]);

	const cartCount = useMemo(() => state.items.reduce((s, i) => s + i.quantity, 0), [state.items]);
	const cartTotal = useMemo(
		() => state.items.reduce((s, i) => s + i.price * i.quantity, 0),
		[state.items],
	);
	// PERF-H1 (2026-07-02): wrap the context value in useMemo so that
	// consumers (Navbar badge, BottomNav, Cart page, MiniCart, etc.)
	// don't re-render on every parent render. The previous inline
	// object literal created a new reference per render which busted
	// `useContext` reference equality and forced every consumer to
	// reconcile even when the cart itself hadn't changed. `dispatch`
	// is already stable (React guarantee for useReducer).
	const value = useMemo(
		() => ({ state, dispatch, cartCount, cartTotal }),
		[state, cartCount, cartTotal],
	);
	return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
	const ctx = useContext(CartContext);
	if (!ctx) throw new Error('useCart must be inside CartProvider');
	return ctx;
}

export type { CartItem };
