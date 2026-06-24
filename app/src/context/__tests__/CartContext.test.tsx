/**
 * CartContext tests
 *
 * Verifies the reducer semantics and the localStorage persistence model.
 * The reducer itself must be pure — persistence is owned by the provider
 * via useEffect, not by the reducer (see review_code.md §C6).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, useCart } from '../CartContext';

function wrapper() {
	return ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>;
}

describe('CartContext', () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => localStorage.clear());

	it('starts with an empty cart and zero counters', () => {
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		expect(result.current.state.items).toEqual([]);
		expect(result.current.cartCount).toBe(0);
		expect(result.current.cartTotal).toBe(0);
	});

	it('ADD adds a new item with quantity 1', () => {
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		act(() =>
			result.current.dispatch({
				type: 'ADD',
				payload: {
					productId: '1',
					name: 'Widget',
					price: 100,
					quantity: 1,
					image: '',
					merchantName: '',
				},
			}),
		);
		expect(result.current.state.items).toHaveLength(1);
		expect(result.current.cartCount).toBe(1);
		expect(result.current.cartTotal).toBe(100);
	});

	it('ADD merges quantities for the same product', () => {
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		const payload = {
			productId: '1',
			name: 'Widget',
			price: 100,
			quantity: 1,
			image: '',
			merchantName: '',
		};
		act(() => result.current.dispatch({ type: 'ADD', payload }));
		act(() => result.current.dispatch({ type: 'ADD', payload }));
		act(() => result.current.dispatch({ type: 'ADD', payload }));
		expect(result.current.state.items).toHaveLength(1);
		expect(result.current.state.items[0]?.quantity).toBe(3);
		expect(result.current.cartCount).toBe(3);
	});

	it('REMOVE drops the item entirely', () => {
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		act(() =>
			result.current.dispatch({
				type: 'ADD',
				payload: {
					productId: '1',
					name: '',
					price: 50,
					quantity: 1,
					image: '',
					merchantName: '',
				},
			}),
		);
		act(() => result.current.dispatch({ type: 'REMOVE', payload: '1' }));
		expect(result.current.state.items).toEqual([]);
	});

	it('UPDATE_QTY sets an absolute quantity, and 0 removes the line', () => {
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		act(() =>
			result.current.dispatch({
				type: 'ADD',
				payload: {
					productId: '1',
					name: '',
					price: 10,
					quantity: 1,
					image: '',
					merchantName: '',
				},
			}),
		);
		act(() =>
			result.current.dispatch({
				type: 'UPDATE_QTY',
				payload: { productId: '1', quantity: 5 },
			}),
		);
		expect(result.current.state.items[0]?.quantity).toBe(5);
		expect(result.current.cartCount).toBe(5);

		act(() =>
			result.current.dispatch({
				type: 'UPDATE_QTY',
				payload: { productId: '1', quantity: 0 },
			}),
		);
		expect(result.current.state.items).toEqual([]);
	});

	it('CLEAR empties the cart', () => {
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		act(() =>
			result.current.dispatch({
				type: 'ADD',
				payload: {
					productId: '1',
					name: '',
					price: 10,
					quantity: 2,
					image: '',
					merchantName: '',
				},
			}),
		);
		act(() => result.current.dispatch({ type: 'CLEAR' }));
		expect(result.current.state.items).toEqual([]);
	});

	it('persists state to localStorage on every change', async () => {
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		act(() =>
			result.current.dispatch({
				type: 'ADD',
				payload: {
					productId: '1',
					name: '',
					price: 10,
					quantity: 1,
					image: '',
					merchantName: '',
				},
			}),
		);
		// The provider writes via useEffect, which runs after the render.
		await new Promise((r) => setTimeout(r, 0));
		const raw = localStorage.getItem('noufex_cart');
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw ?? '[]')).toHaveLength(1);
	});

	it('loads existing cart from localStorage on mount', () => {
		// Seed BEFORE rendering so the lazy initial state picks it up.
		localStorage.setItem(
			'noufex_cart',
			JSON.stringify([
				{
					productId: '42',
					name: 'Pre',
					price: 9,
					quantity: 2,
					image: '',
					merchantName: '',
				},
			]),
		);
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		expect(result.current.state.items).toHaveLength(1);
		expect(result.current.state.items[0]?.productId).toBe('42');
		expect(result.current.cartCount).toBe(2);
	});

	it('falls back to an empty array on corrupt localStorage', () => {
		localStorage.setItem('noufex_cart', 'not-json');
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		expect(result.current.state.items).toEqual([]);
	});

	it('cartTotal sums price * quantity across distinct lines', () => {
		const { result } = renderHook(() => useCart(), { wrapper: wrapper() });
		act(() =>
			result.current.dispatch({
				type: 'ADD',
				payload: {
					productId: '1',
					name: '',
					price: 100,
					quantity: 2,
					image: '',
					merchantName: '',
				},
			}),
		);
		act(() =>
			result.current.dispatch({
				type: 'ADD',
				payload: {
					productId: '2',
					name: '',
					price: 50,
					quantity: 3,
					image: '',
					merchantName: '',
				},
			}),
		);
		expect(result.current.cartTotal).toBe(350); // 100*2 + 50*3
	});
});
