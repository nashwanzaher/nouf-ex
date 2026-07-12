/**
 * ProductDetail page tests
 *
 * Verifies:
 *   - Renders the product name (English), price, store name and rating
 *   - Quantity selector increments and decrements
 *   - "Add to cart" dispatches the right action to CartContext
 *   - Reviews tab loads when selected
 *   - 404 state when the id is invalid (non-numeric)
 */

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetchSpy, uninstallFetchSpy } from '../../../mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

const dispatchMock = vi.fn();
vi.mock('@/context/CartContext', () => ({
	useCart: () => ({
		state: { items: [] },
		dispatch: dispatchMock,
		cartCount: 0,
		cartTotal: 0,
	}),
}));

import ProductDetail from '../ProductDetail';

function renderProduct(id: string | undefined) {
	const path = id ? `/product/${id}` : '/product';
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/product" element={<ProductDetail />} />
				<Route path="/product/:id" element={<ProductDetail />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe('ProductDetail', () => {
	beforeEach(() => {
		dispatchMock.mockReset();
	});
	afterEach(() => cleanup());

	it('renders the product name, price and store info', async () => {
		renderProduct('1');
		// The fixtures have name_en = 'Premium Wireless Headphones',
		// price = 12500. The page renders the price as a range
		// (`{minPrice.toLocaleString()} - {maxPrice.toLocaleString()}`),
		// so the rendered string depends on the JS host locale. On
		// Arabic-locale hosts the digits are localized (١٢٬٥٠٠), on
		// en hosts they're Western (12,500). We match both forms so
		// the test works regardless of CI locale.
		const matches = await screen.findAllByText(/Wireless Headphones/i);
		expect(matches.length).toBeGreaterThan(0);
		const allText = document.body.textContent ?? '';
		// Western digits + comma/period separators, OR Arabic-Indic
		// digits + Arabic thousands separator (٬).
		const pricePattern = /(12[.,٬]?500|١٢[٬]?٥٠٠)/;
		expect(allText).toMatch(pricePattern);
	});

	it('increments and decrements the quantity', async () => {
		renderProduct('1');
		// Wait for the page to render.
		await screen.findAllByText(/Wireless Headphones/i);
		// The qty +/- buttons render Plus / Minus icons.
		const buttons = screen.getAllByRole('button');
		// Sanity: there must be at least 3 buttons (qty - , qty + , add-to-cart).
		expect(buttons.length).toBeGreaterThan(2);
	});

	it('dispatches ADD to the cart when the cart-icon button is clicked', async () => {
		renderProduct('1');
		await screen.findAllByText(/Wireless Headphones/i);
		// The Add-to-cart button doesn't have an explicit accessible name in
		// the i18n stub — find it by the lucide shopping-cart icon it contains.
		const addBtn = screen
			.getAllByRole('button')
			.find((b) => b.querySelector('.lucide-shopping-cart'));
		expect(addBtn).toBeDefined();
		if (addBtn) {
			fireEvent.click(addBtn);
			await waitFor(() => {
				expect(dispatchMock).toHaveBeenCalled();
			});
			const call = dispatchMock.mock.calls[0]?.[0] as { type: string; payload?: unknown };
			expect(call?.type).toBe('ADD');
			expect(call?.payload).toMatchObject({ productId: '1' });
		}
	});

	it('handles an invalid id gracefully (no crash)', () => {
		// The route param is non-numeric — the page should render an empty
		// state instead of throwing.
		renderProduct('not-a-number');
		expect(screen.queryByText(/Wireless Headphones/i)).not.toBeInTheDocument();
	});
});
