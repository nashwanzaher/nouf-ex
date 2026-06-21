import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';

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
const initialStateFactory = (): AppState => ({
	lang: loadInitialLang(),
	dir: 'rtl',
	user: loadInitialUser(),
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
		case 'ADD_TOAST':
			return { ...state, toasts: [...state.toasts, action.payload] };
		case 'REMOVE_TOAST':
			return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
		default:
			return state;
	}
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(
	null
);

export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(appReducer, undefined, initialStateFactory);

	// M3 fix: mutate DOM in useEffect (not in render -- avoids side effects during render).
	useEffect(() => {
		if (typeof document === 'undefined') return;
		document.documentElement.lang = state.lang;
		document.documentElement.dir = state.dir;
	}, [state.lang, state.dir]);

	return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
	const ctx = useContext(AppContext);
	if (!ctx) throw new Error('useApp must be inside AppProvider');
	return ctx;
}

export type { User, Role, Lang, Toast };
