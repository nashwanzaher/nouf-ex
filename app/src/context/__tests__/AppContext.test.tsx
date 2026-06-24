/**
 * AppContext tests
 *
 * The context owns the i18n direction, the user, and the toast queue. We
 * verify:
 *   - Initial state is safe (no crash on missing localStorage)
 *   - Reducer transitions are pure (same input → same output)
 *   - localStorage side effects happen in the right places
 *   - Toast queue is FIFO and self-cleans via the reducer
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp, type User } from '../AppContext';

function wrapper() {
	return ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;
}

describe('AppContext', () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.lang = '';
		document.documentElement.dir = '';
	});

	afterEach(() => {
		localStorage.clear();
		document.documentElement.lang = '';
		document.documentElement.dir = '';
	});

	it('initializes with default Arabic state when localStorage is empty', () => {
		const { result } = renderHook(() => useApp(), { wrapper: wrapper() });
		expect(result.current.state.lang).toBe('ar');
		expect(result.current.state.dir).toBe('rtl');
		expect(result.current.state.user).toBeNull();
	});

	it('loads persisted language from localStorage', () => {
		// Seed BEFORE rendering so the initial reducer picks it up.
		localStorage.setItem('i18nextLng', 'zh');
		const { result } = renderHook(() => useApp(), { wrapper: wrapper() });
		expect(result.current.state.lang).toBe('zh');
	});

	it('falls back to default when persisted language is invalid', () => {
		localStorage.setItem('i18nextLng', 'klingon');
		const { result } = renderHook(() => useApp(), { wrapper: wrapper() });
		expect(result.current.state.lang).toBe('ar');
	});

	it('SET_LANG flips dir to ltr for non-Arabic languages', () => {
		const { result } = renderHook(() => useApp(), { wrapper: wrapper() });
		act(() => result.current.dispatch({ type: 'SET_LANG', payload: 'en' }));
		expect(result.current.state.lang).toBe('en');
		expect(result.current.state.dir).toBe('ltr');
	});

	it('SET_USER persists to localStorage and clears on null', () => {
		const { result } = renderHook(() => useApp(), { wrapper: wrapper() });
		const user: User = { id: '1', name: 'Alice', email: 'a@x.com', role: 'customer' };

		act(() => result.current.dispatch({ type: 'SET_USER', payload: user }));
		expect(result.current.state.user).toEqual(user);
		expect(JSON.parse(localStorage.getItem('noufex_user') ?? 'null')).toEqual(user);

		act(() => result.current.dispatch({ type: 'SET_USER', payload: null }));
		expect(result.current.state.user).toBeNull();
		expect(localStorage.getItem('noufex_user')).toBeNull();
	});

	it('does not crash on corrupt localStorage data', () => {
		// Seed bad data BEFORE rendering.
		localStorage.setItem('noufex_user', '{not valid json}');
		// Constructing the provider should NOT throw.
		const { result } = renderHook(() => useApp(), { wrapper: wrapper() });
		expect(result.current.state.user).toBeNull();
		// The AppContext only removes the bad key on the next SET_USER dispatch.
		// Triggering a state change flushes the cleanup branch.
		act(() => result.current.dispatch({ type: 'SET_LANG', payload: 'en' }));
		expect(localStorage.getItem('noufex_user')).toBeNull();
	});

	it('ADD_TOAST then REMOVE_TOAST is FIFO', () => {
		const { result } = renderHook(() => useApp(), { wrapper: wrapper() });
		act(() =>
			result.current.dispatch({
				type: 'ADD_TOAST',
				payload: { id: '1', message: 'first', type: 'info' },
			}),
		);
		act(() =>
			result.current.dispatch({
				type: 'ADD_TOAST',
				payload: { id: '2', message: 'second', type: 'info' },
			}),
		);
		expect(result.current.state.toasts).toHaveLength(2);
		expect(result.current.state.toasts[0]?.id).toBe('1');

		act(() => result.current.dispatch({ type: 'REMOVE_TOAST', payload: '1' }));
		expect(result.current.state.toasts).toHaveLength(1);
		expect(result.current.state.toasts[0]?.id).toBe('2');
	});

	it('throws if useApp is consumed outside a provider', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		expect(() => renderHook(() => useApp())).toThrow(/must be inside/i);
		spy.mockRestore();
	});
});
