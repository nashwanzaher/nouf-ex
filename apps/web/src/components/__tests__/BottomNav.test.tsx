import React from 'react';
/**
 * BottomNav component tests
 *
 * BottomNav is the mobile-only fixed bottom navigation. It renders five
 * items (Home, Categories, Messages, Cart, Account) and highlights the
 * active one based on the current route. The cart item shows a badge
 * with the live cart count from CartContext.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BottomNav from '../BottomNav';
import { AppProvider } from '@/context/AppContext';

// Stub out CartContext so we can pin the cart count for the badge test.
vi.mock('@/features/cart/context/CartContext', () => ({
	useCart: () => ({ cartCount: 3 }),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en' },
	}),
}));

function renderBottomAt(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<AppProvider>
				<BottomNav />
			</AppProvider>
		</MemoryRouter>,
	);
}

describe('BottomNav', () => {
	afterEach(() => cleanup());

	it('renders all five items', () => {
		renderBottomAt('/');
		const links = screen.getAllByRole('link');
		expect(links.length).toBeGreaterThanOrEqual(5);
	});

	it('renders the cart link with the cart badge', () => {
		renderBottomAt('/');
		// Cart link points to /checkout and renders the cart-count badge.
		const cartLink = screen.getByText('nav.cart').closest('a');
		expect(cartLink).toHaveAttribute('href', '/checkout');
	});

	it('shows the cart badge with the current cart count', () => {
		renderBottomAt('/checkout');
		expect(screen.getByText('3')).toBeInTheDocument();
	});

	it('caps the cart badge at 99+', async () => {
		// Reset modules so we can re-mock with a different cart count.
		vi.resetModules();
		vi.doMock('@/features/cart/context/CartContext', () => ({
			useCart: () => ({ cartCount: 250 }),
		}));
		const { default: BottomNavReloaded } = await import('../BottomNav');
		const { AppProvider } = await import('@/context/AppContext');
		render(
			<MemoryRouter initialEntries={['/checkout']}>
				<AppProvider>
					<BottomNavReloaded />
				</AppProvider>
			</MemoryRouter>,
		);
		expect(screen.getByText('99+')).toBeInTheDocument();
		vi.doUnmock('@/features/cart/context/CartContext');
		vi.resetModules();
	});

	it('highlights the active item via aria-current or className', () => {
		renderBottomAt('/categories');
		// The i18n stub returns the key (no fallback), so the label is
		// "nav.categories".
		const link = screen.getByText('nav.categories').closest('a');
		expect(link?.className).toMatch(/aliOrange/);
	});
});
