/**
 * API client wrapper — Phase 5.
 *
 * Thin wrapper around `fetch` with the same auth/CSRF semantics as
 * the web app:
 *   - Reads the auth token from SecureStore (set by login).
 *   - Reads the CSRF token from a non-secret key and echoes it back
 *     on mutating requests.
 *   - Normalises the response envelope (`{success, data, error, ...}`).
 *   - Times out after 30s.
 *
 * The endpoint base URL is read from the Expo `extra.apiUrl` config
 * and overridable via the `EXPO_PUBLIC_API_URL` env var at build time.
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface ApiError {
	status: number;
	code?: string;
	message: string;
	request_id?: string;
	details?: unknown;
}

export class ApiClientError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly code?: string,
		public readonly request_id?: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = 'ApiClientError';
	}
}

export interface ApiResponseEnvelope<T> {
	success: boolean;
	data?: T;
	error?: string;
	code?: string;
	details?: unknown;
	request_id?: string;
}

function apiBase(): string {
	const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
	return process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || 'http://localhost:3000';
}

export async function apiRequest<T>(
	method: string,
	path: string,
	body?: unknown,
): Promise<T> {
	const url = `${apiBase()}${path}`;
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		};
		const token = await SecureStore.getItemAsync('noufex_auth').catch(() => null);
		if (token) headers.Authorization = `Bearer ${token}`;
		const csrf = await SecureStore.getItemAsync('noufex_csrf').catch(() => null);
		if (csrf && method !== 'GET') headers['x-csrf-token'] = csrf;

		const res = await fetch(url, {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		});

		const json = (await res.json().catch(() => null)) as ApiResponseEnvelope<T> | null;
		if (!res.ok || !json?.success) {
			throw new ApiClientError(
				res.status,
				json?.error ?? `HTTP ${res.status}`,
				json?.code,
				json?.request_id,
				json?.details,
			);
		}
		return json.data as T;
	} finally {
		clearTimeout(t);
	}
}

export const api = {
	get: <T,>(path: string) => apiRequest<T>('GET', path),
	post: <T,>(path: string, body?: unknown) => apiRequest<T>('POST', path, body),
	patch: <T,>(path: string, body?: unknown) => apiRequest<T>('PATCH', path, body),
	put: <T,>(path: string, body?: unknown) => apiRequest<T>('PUT', path, body),
	delete: <T,>(path: string) => apiRequest<T>('DELETE', path),
};