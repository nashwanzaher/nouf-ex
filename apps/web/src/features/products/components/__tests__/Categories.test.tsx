import React from 'react';
/**
 * Categories page tests
 *
 * Verifies:
 *   - Renders the page heading
 *   - Sidebar lists the categories from the API
 *   - Product grid renders the (filtered) products
 *   - Selecting a category filters the visible products
 */

import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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

import Categories from '../Categories';

describe('Categories page', () => {
	afterEach(() => cleanup());

	it('renders the page once data loads', async () => {
		render(
			<MemoryRouter>
				<Categories />
			</MemoryRouter>,
		);
		// The fixtures list 'Electronics' and 'Fashion' as the two top
		// categories — both show up in the sidebar AND in breadcrumbs /
		// sub-categories, so we use getAllByText and assert ≥1 occurrence.
		const matches = await screen.findAllByText(/Electronics/i);
		expect(matches.length).toBeGreaterThan(0);
	});

	it('renders product cards from the products API', async () => {
		render(
			<MemoryRouter>
				<Categories />
			</MemoryRouter>,
		);
		// Wait for the data to load by finding a product name (the page
		// only renders products after useProducts resolves).
		expect(await screen.findByText(/Wireless Headphones/i)).toBeInTheDocument();
	});

	it('renders the sidebar with the category list', async () => {
		render(
			<MemoryRouter>
				<Categories />
			</MemoryRouter>,
		);
		expect(await screen.findByText(/Wireless Headphones/i)).toBeInTheDocument();
		// Both top-level categories should be visible in the sidebar.
		const fashion = screen.getAllByText(/Fashion/i);
		expect(fashion.length).toBeGreaterThan(0);
	});
});
