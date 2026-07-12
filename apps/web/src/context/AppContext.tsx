import { clearLocalCart } from '@/lib/cart-sync';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	type ReactNode,
} from 'react';

type Lang = 'ar' | 'en' | 'zh';
type Role = 'guest' | 'customer' | 'merchant' | 'admin' | 'delivery_agent';

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
	toasts: Toast[];
}

type Action =
	| { type: 'SET_LANG'; payload: Lang }
	| { type: 'SET_USER'; payload: User | null }
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

// C5 fix: pass the initial state as a lazy initializer to useReducer so that
// localStorage is read at *component mount* time, not at module-load time.
// Otherwise a user who logs in or changes language in another tab would never
// see that change reflected on the next page load.
const initialStateFactory = (): AppState => {
	const lang = loadInitialLang();
	return {
		lang,
		dir: lang === 'ar' ? 'rtl' : 'ltr',
		user: loadInitialUser(),
		toasts: [],
	};
};

function appReducer(state: AppState, action: Action): AppState {
	switch (action.type) {
		case 'SET_LANG': {
			const dir = action.payload === 'ar' ? 'rtl' : 'ltr';
			return { ...state, lang: action.payload, dir };
		}
		case 'SET_USER': {
			return { ...state, user: action.payload };
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

	// Persist user to localStorage (side effects outside reducer).
	// Note: Auth token is now stored in HttpOnly cookie (set by server),
	// not in localStorage. This prevents XSS attacks from stealing tokens.
	useEffect(() => {
		if (typeof localStorage === 'undefined') return;
		if (state.user) localStorage.setItem('noufex_user', JSON.stringify(state.user));
		else localStorage.removeItem('noufex_user');
	}, [state.user]);

	/** Imperative helpers — wrap the dispatch cases for convenience and
	 *  so pages don't need to know the action shape. */
	const setUser = useCallback(
		(user: User | null) => dispatch({ type: 'SET_USER', payload: user }),
		[],
	);
	const addToast = useCallback(
		(toast: Omit<Toast, 'id'>) =>
			dispatch({
				type: 'ADD_TOAST',
				payload: {
					...toast,
					id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				},
			}),
		[],
	);
	const removeToast = useCallback(
		(id: string) => dispatch({ type: 'REMOVE_TOAST', payload: id }),
		[],
	);

	// PERF-P2-01 (added 2026-07-02): wrap the context value in useMemo
	// so that consumers don't re-render on every parent render. The
	// previous version created a new object on every render which
	// busted the React.memo / shouldComponentUpdate optimizations in
	// every component that calls useApp() or useAuth().
	const value = useMemo(
		() => ({ state, dispatch, setUser, addToast, removeToast }),
		[state, setUser, addToast, removeToast],
	);
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
 * Cart synchronization is now owned by `CartProvider`: it detects the
 * authenticated user, pushes any anonymous local cart to the server,
 * and hydrates the UI from the server cart. `login` only writes the
 * user info so the UI can display it. The auth token is managed by
 * the server via HttpOnly cookie (not accessible from JavaScript).
 * `logout` clears the local cart synchronously (the server cart is
 * left intact — the user may sign back in from another device and
 * expect their items).
 */
export function useAuth() {
	const { state, setUser, addToast } = useApp();
	// Auth token is now in HttpOnly cookie, so we check user presence
	// The actual auth check happens server-side on each request
	const isAuthenticated = Boolean(state.user);
	const login = useCallback(
		async (user: User): Promise<void> => {
			// Write user info to localStorage for UI state persistence.
			// Auth token is set by server as HttpOnly cookie automatically.
			try {
				localStorage.setItem('noufex_user', JSON.stringify(user));
			} catch {
				/* localStorage may be unavailable in private mode */
			}
			setUser(user);
		},
		[setUser],
	);
	const logout = useCallback(() => {
		// Clear user state from localStorage
		try {
			localStorage.removeItem('noufex_user');
		} catch {
			/* noop */
		}
		setUser(null);
		// Local cart belongs to the (now-gone) user; clear it so the
		// next anonymous visitor starts with an empty cart. The server
		// cart is left intact — the user may sign back in from
		// another device.
		clearLocalCart();
	}, [setUser]);
	return { user: state.user, isAuthenticated, login, logout, addToast };
}

export type { Lang, Role, Toast, User };
