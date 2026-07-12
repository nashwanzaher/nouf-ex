import React from 'react';
/**
 * Deals page tests
 *
 * Verifies:
 *   - Renders the page heading and a countdown timer
 *   - Lists the deal products from the API
 *   - "Add to cart" dispatches the right action to CartContext
 */

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchSpy, uninstallFetchSpy } from '../../../../../mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

const dispatchMock = vi.fn();
vi.mock('@/features/cart/context/CartContext', () => ({
	useCart: () => ({
		state: { items: [] },
		dispatch: dispatchMock,
		cartCount: 0,
		cartTotal: 0,
	}),
}));

import Deals from '../Deals';

describe('Deals page', () => {
	beforeEach(() => dispatchMock.mockReset());
	afterEach(() => cleanup());

	it('renders a countdown timer', async () => {
		render(
			<MemoryRouter>
				<Deals />
			</MemoryRouter>,
		);
		// The countdown renders hours/minutes/seconds labels.
		expect(await screen.findByText(/hours/i)).toBeInTheDocument();
		expect(screen.getByText(/mins/i)).toBeInTheDocument();
		expect(screen.getByText(/secs/i)).toBeInTheDocument();
	});

	it('lists the deal products from the API', async () => {
		render(
			<MemoryRouter>
				<Deals />
			</MemoryRouter>,
		);
		// The deals fixture contains a Pro Laptop (deal_discount > 0).
		expect(await screen.findByText(/Pro Laptop/i)).toBeInTheDocument();
	});

	it('dispatches ADD to the cart when an item is clicked', async () => {
		render(
			<MemoryRouter>
				<Deals />
			</MemoryRouter>,
		);
		await screen.findByText(/Pro Laptop/i);
		// Find any "Add to cart" button on the page and click it.
		const addBtn = screen.getAllByRole('button', { name: /add to cart/i })[0];
		expect(addBtn).toBeDefined();
		fireEvent.click(addBtn!);
		await waitFor(() => {
			expect(dispatchMock).toHaveBeenCalled();
		});
		expect((dispatchMock.mock.calls[0]?.[0] as { type: string }).type).toBe('ADD');
	});
});
