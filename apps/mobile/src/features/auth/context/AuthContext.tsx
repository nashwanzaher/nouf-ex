/**
 * Auth context (Phase 5).
 *
 * Persists the bearer token in SecureStore (iOS Keychain / Android
 * Keystore). The token is also reflected to the `Authorization` header
 * on every fetch (see `lib/api/client.ts`).
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
import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api/client';

export interface AuthUser {
	id: number;
	email: string;
	full_name: string;
	role: 'customer' | 'merchant' | 'admin';
}

interface AuthContextValue {
	user: AuthUser | null;
	loading: boolean;
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'noufex_auth';
const USER_KEY = 'noufex_user';

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				const cached = await SecureStore.getItemAsync(USER_KEY);
				if (cached) setUser(JSON.parse(cached) as AuthUser);
			} catch {
				// ignore
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		const result = await api.post<{ user: AuthUser; token: string }>(
			'/api/auth/login',
			{ email, password },
		);
		await SecureStore.setItemAsync(TOKEN_KEY, result.token).catch(() => void 0);
		await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user)).catch(() => void 0);
		setUser(result.user);
	}, []);

	const logout = useCallback(async () => {
		try {
			await api.post('/api/auth/logout');
		} catch {
			// ignore — server-side token_version bump is best-effort
		}
		await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => void 0);
		await SecureStore.deleteItemAsync(USER_KEY).catch(() => void 0);
		setUser(null);
	}, []);

	const value = useMemo(
		() => ({ user, loading, login, logout }),
		[user, loading, login, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
	return ctx;
}