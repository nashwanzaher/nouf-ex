/**
 * Cart context (Phase 5).
 *
 * Anonymous carts persist in AsyncStorage; authenticated carts sync
 * with the server. Mirrors the web CartContext shape so the
 * behaviour is identical.
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api/client';

export interface CartItem {
	productId: number;
	name: string;
	price: number;
	quantity: number;
	image?: string | null;
	merchantName?: string;
}

interface CartContextValue {
	items: CartItem[];
	count: number;
	total: number;
	add: (item: CartItem) => Promise<void>;
	remove: (productId: number) => Promise<void>;
	updateQty: (productId: number, qty: number) => Promise<void>;
	clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = 'noufex_cart';

export function CartProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<CartItem[]>([]);

	useEffect(() => {
		(async () => {
			try {
				const raw = await AsyncStorage.getItem(STORAGE_KEY);
				if (raw) setItems(JSON.parse(raw) as CartItem[]);
			} catch {
				// ignore
			}
		})();
	}, []);

	const persist = useCallback(async (next: CartItem[]) => {
		setItems(next);
		await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => void 0);
	}, []);

	const add = useCallback(
		async (item: CartItem) => {
			const existing = items.find((i) => i.productId === item.productId);
			const next = existing
				? items.map((i) =>
						i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i,
				  )
				: [...items, item];
			await persist(next);
			try {
				await api.post('/api/cart', {
					productId: item.productId,
					quantity: item.quantity,
				});
			} catch {
				// offline-friendly: local cart still works
			}
		},
		[items, persist],
	);

	const remove = useCallback(
		async (productId: number) => {
			await persist(items.filter((i) => i.productId !== productId));
		},
		[items, persist],
	);

	const updateQty = useCallback(
		async (productId: number, qty: number) => {
			if (qty <= 0) return remove(productId);
			await persist(items.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)));
		},
		[items, persist, remove],
	);

	const clear = useCallback(async () => {
		await persist([]);
	}, [persist]);

	const count = items.reduce((s, i) => s + i.quantity, 0);
	const total = items.reduce((s, i) => s + i.quantity * i.price, 0);

	const value = useMemo(
		() => ({ items, count, total, add, remove, updateQty, clear }),
		[items, count, total, add, remove, updateQty, clear],
	);

	return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
	const ctx = useContext(CartContext);
	if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
	return ctx;
}