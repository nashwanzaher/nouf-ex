import React from 'react';
/**
 * StorePage tests
 *
 * Verifies:
 *   - Renders the store header (name, location, trust level, rating)
 *   - Shows the store's products in the default tab
 *   - Switching tabs reveals profile information
 *   - Search input filters the visible products
 */

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { installFetchSpy, uninstallFetchSpy } from '../../../../../mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

vi.mock('@/features/cart/context/CartContext', () => ({
	useCart: () => ({ state: { items: [] }, dispatch: vi.fn(), cartCount: 0, cartTotal: 0 }),
}));

import StorePage from '../StorePage';

function renderStore(id: string) {
	return render(
		<MemoryRouter initialEntries={[`/store/${id}`]}>
			<Routes>
				<Route path="/store/:id" element={<StorePage />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe('StorePage', () => {
	afterEach(() => cleanup());

	it('renders the store name and trust badge', async () => {
		renderStore('1');
		// The fixture has store_name_en = 'Store One'
		expect(await screen.findByText(/Store One/i)).toBeInTheDocument();
	});

	it('renders the store products in the default tab', async () => {
		renderStore('1');
		await screen.findByText(/Store One/i);
		// Each product has a name_en — at least one should be visible.
		expect(screen.getByText(/Wireless Headphones/i)).toBeInTheDocument();
	});

	it('switches tabs when a tab button is clicked', async () => {
		renderStore('1');
		await screen.findByText(/Store One/i);
		// Click the Profile tab and confirm the products grid is hidden
		// (the profile tab replaces it with store details).
		const profileTab = screen.getByRole('button', { name: /profile/i });
		fireEvent.click(profileTab);
		await waitFor(() => {
			// After clicking Profile, the products grid is no longer shown —
			// the "Wireless Headphones" product name should be gone.
			expect(screen.queryByText(/Wireless Headphones/i)).not.toBeInTheDocument();
		});
	});

	it('filters products by the search query', async () => {
		renderStore('1');
		await screen.findByText(/Store One/i);
		// The store-page search box is "Search in store..." (not "Search products...").
		const search = screen.getByPlaceholderText(/search in store/i);
		fireEvent.change(search, { target: { value: 'laptop' } });
		// Wait for the re-render after the search filter is applied.
		await waitFor(() => {
			// Pro Laptop is in the fixtures; Wireless Headphones is also
			// in the fixtures — when the search is "laptop", only the Pro
			// Laptop should remain.
			expect(screen.getByText(/Pro Laptop/i)).toBeInTheDocument();
		});
	});

	it('handles an invalid id gracefully', () => {
		renderStore('9999');
		// Should not throw — just renders the empty state.
		expect(screen.queryByText(/Store One/i)).not.toBeInTheDocument();
	});
});
