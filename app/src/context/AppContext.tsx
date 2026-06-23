import {
	createContext,
	useContext,
	useReducer,
	useEffect,
	useCallback,
	type ReactNode,
} from 'react';
import { clearLocalCart, syncOnLogin } from '@/lib/cart-sync';

type Lang = 'ar' | 'en' | 'zh';
type Role = 'guest' | 'customer' | 'merchant' | 'admin';

interface User {
	id: string;
	name: string;
	email: string;
	role: Role;
	avatar?: string;
}
interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'warning' | 'info';
}

interface AppState {
	lang: Lang;
	dir: 'rtl' | 'ltr';
	user: User | null;
	/** Bearer token from the API (HMAC-signed). Stored in localStorage so
	 *  that the `apiRequest` wrapper can attach it to outgoing requests
	 *  without going through React context. */
	token: string | null;
	toasts: Toast[];
}

type Action =
	| { type: 'SET_LANG'; payload: Lang }
	| { type: 'SET_USER'; payload: User | null }
	| { type: 'SET_TOKEN'; payload: string | null }
	| { type: 'ADD_TOAST'; payload: Toast }
	| { type: 'REMOVE_TOAST'; payload: string };

// C5 fix: safely load persisted state. Corrupt localStorage would otherwise crash the app at boot.
function loadInitialLang(): Lang {
	try {
		const v = localStorage.getItem('i18nextLng');
		return v === 'ar' || v === 'en' || v === 'zh' ? v : 'ar';
	} catch {
		return 'ar';
	}
}

function loadInitialUser(): User | null {
	try {
		const raw = localStorage.getItem('noufex_user');
		return raw ? (JSON.parse(raw) as User) : null;
	} catch {
		try {
			localStorage.removeItem('noufex_user');
		} catch {
			/* noop */
		}
		return null;
	}
}

/** Load the auth token lazily. Kept in localStorage so it survives a page
 *  reload and so the non-React `apiRequest` wrapper can read it. */
function loadInitialToken(): string | null {
	try {
		const v = localStorage.getItem('noufex_token');
		return v && v.length > 0 ? v : null;
	} catch {
		return null;
	}
}

// C5 fix: pass the initial state as a lazy initializer to useReducer so that
// localStorage is read at *component mount* time, not at module-load time.
// Otherwise a user who logs in or changes language in another tab would never
// see that change reflected on the next page load.
const initialStateFactory = (): AppState => ({
	lang: loadInitialLang(),
	dir: 'rtl',
	user: loadInitialUser(),
	token: loadInitialToken(),
	toasts: [],
});

function appReducer(state: AppState, action: Action): AppState {
	switch (action.type) {
		case 'SET_LANG': {
			const dir = action.payload === 'ar' ? 'rtl' : 'ltr';
			// Note: DOM mutation is safe here because the reducer only runs after
			// the React render path is set up (i.e. the AppProvider has mounted).
			if (typeof document !== 'undefined') {
				document.documentElement.lang = action.payload;
				document.documentElement.dir = dir;
			}
			return { ...state, lang: action.payload, dir };
		}
		case 'SET_USER': {
			if (action.payload) localStorage.setItem('noufex_user', JSON.stringify(action.payload));
			else localStorage.removeItem('noufex_user');
			return { ...state, user: action.payload };
		}
		case 'SET_TOKEN': {
			if (action.payload) localStorage.setItem('noufex_token', action.payload);
			else localStorage.removeItem('noufex_token');
			return { ...state, token: action.payload };
		}
		case 'ADD_TOAST':
			return { ...state, toasts: [...state.toasts, action.payload] };
		case 'REMOVE_TOAST':
			return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
		default:
			return state;
	}
}

const AppContext = createContext<{
	state: AppState;
	dispatch: React.Dispatch<Action>;
	setUser: (user: User | null) => void;
	setToken: (token: string | null) => void;
	addToast: (toast: Omit<Toast, 'id'>) => void;
	removeToast: (id: string) => void;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(appReducer, undefined, initialStateFactory);

	// M3 fix: mutate DOM in useEffect (not in render -- avoids side effects during render).
	useEffect(() => {
		if (typeof document === 'undefined') return;
		document.documentElement.lang = state.lang;
		document.documentElement.dir = state.dir;
	}, [state.lang, state.dir]);

	/** Imperative helpers — wrap the dispatch cases for convenience and
	 *  so pages don't need to know the action shape. */
	const setUser = useCallback(
		(user: User | null) => dispatch({ type: 'SET_USER', payload: user }),
		[]
	);
	const setToken = useCallback(
		(token: string | null) => dispatch({ type: 'SET_TOKEN', payload: token }),
		[]
	);
	const addToast = useCallback(
		(toast: Omit<Toast, 'id'>) =>
			dispatch({
				type: 'ADD_TOAST',
				payload: { ...toast, id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
			}),
		[]
	);
	const removeToast = useCallback(
		(id: string) => dispatch({ type: 'REMOVE_TOAST', payload: id }),
		[]
	);

	const value = { state, dispatch, setUser, setToken, addToast, removeToast };
	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
	const ctx = useContext(AppContext);
	if (!ctx) throw new Error('useApp must be inside AppProvider');
	return ctx;
}

/** Convenience hook: returns the auth slice and helpers. Saves callers
 *  from destructuring the context every time.
 *
 * P0-1: `login` is async and runs `syncOnLogin` after the user/token
 * are set. This pushes the anonymous local cart into the server cart
 * (best-effort) and returns when done. `logout` clears the local cart
 * synchronously (the server cart is left intact — the user may sign
 * back in from another device and expect their items). */
export function useAuth() {
	const { state, setUser, setToken, addToast } = useApp();
	const isAuthenticated = Boolean(state.user && state.token);
	const login = useCallback(
		async (user: User, token: string): Promise<void> => {
			setUser(user);
			setToken(token);
			// Best-effort: if the sync fails, the local cart is
			// preserved (cart-sync.ts only clears local on a clean
			// push). A failed sync must never block the login.
			try {
				const result = await syncOnLogin(Number(user.id));
				if (result.degraded) {
					addToast({
						message: 'Some cart items could not be saved to your account. Please review and retry.',
						type: 'warning',
					});
				} else if (result.pushed > 0) {
					addToast({
						message: `Synced ${result.pushed} cart item${result.pushed === 1 ? '' : 's'} to your account.`,
						type: 'success',
					});
				}
			} catch {
				// Silently swallow — login already succeeded.
			}
		},
		[setUser, setToken, addToast]
	);
	const logout = useCallback(() => {
		setUser(null);
		setToken(null);
		// Local cart belongs to the (now-gone) user; clear it so the
		// next anonymous visitor starts with an empty cart. The server
		// cart is left intact — the user may sign back in from
		// another device.
		clearLocalCart();
	}, [setUser, setToken]);
	return { user: state.user, token: state.token, isAuthenticated, login, logout, addToast };
}

export type { User, Role, Lang, Toast };
