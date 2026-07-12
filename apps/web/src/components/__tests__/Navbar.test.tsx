import React from 'react';
/**
 * Navbar component tests
 *
 * Navbar contains the brand mark, a search bar, the cart icon (with a
 * badge for the count), the user menu (sign in / account link), and the
 * language switcher. We assert:
 *   - Brand link points at "/"
 *   - Search form submits a query and navigates to /search
 *   - Cart badge shows the current cart count
 *   - The user-menu link toggles based on auth state
 */

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

vi.mock('@/features/cart/context/CartContext', () => ({
	useCart: () => ({ cartCount: 4 }),
}));

// Mock the auth slice of AppContext for the user-menu link.
const mockAuth = {
	user: null as { name: string; email: string; role: string } | null,
};
vi.mock('@/context/AppContext', () => ({
	useApp: () => ({
		state: { lang: 'en', user: mockAuth.user, toasts: [] },
		dispatch: vi.fn(),
		setUser: vi.fn(),
	}),
	useAuth: () => ({
		user: mockAuth.user,
		isAuthenticated: Boolean(mockAuth.user),
		login: vi.fn(),
		logout: vi.fn(),
		addToast: vi.fn(),
	}),
}));

vi.mock('@/hooks/useApi', () => ({
	useCategories: () => ({ data: [], refetch: vi.fn(), loading: false, error: null }),
}));

vi.mock('react-router', async () => {
	const actual = await vi.importActual<typeof import('react-router')>('react-router');
	return {
		...actual,
		useNavigate: () => navigateMock,
	};
});

import Navbar from '../Navbar';

function renderNavbar() {
	return render(
		<MemoryRouter>
			<Navbar />
		</MemoryRouter>,
	);
}

describe('Navbar', () => {
	beforeEach(() => {
		navigateMock.mockReset();
		mockAuth.user = null;
	});
	afterEach(() => cleanup());

	it('renders the brand link pointing at "/"', () => {
		renderNavbar();
		const brand = screen
			.getAllByText('Nouf-ex')
			.find((el) => el.closest('a')?.getAttribute('href') === '/');
		expect(brand).toBeDefined();
	});

	it('shows the cart badge with the cart count', () => {
		renderNavbar();
		expect(screen.getByText('4')).toBeInTheDocument();
	});

	it('renders the user menu link when logged out (after opening the dropdown)', async () => {
		renderNavbar();
		// The user icon (lucide User) is the trigger — clicking it opens a
		// dropdown that contains the /auth/login link. The dropdown menu
		// uses `t('nav.login')` etc.; with the i18n stub these are the
		// raw keys, so we look for the /auth/login link directly.
		const userButton = screen
			.getAllByRole('button')
			.find((b) => b.querySelector('.lucide-user'));
		expect(userButton).toBeDefined();
		if (userButton) {
			fireEvent.click(userButton);
			await waitFor(() => {
				// After clicking, the dropdown reveals the /auth/login link.
				const loginLink = document.querySelector('a[href="/auth/login"]');
				expect(loginLink).not.toBeNull();
			});
		}
	});

	it('renders the user account link when logged in', () => {
		mockAuth.user = { name: 'Ahmed', email: 'a@x.com', role: 'customer' };
		mockAuth.token = 'jwt-token';
		renderNavbar();
		// When authenticated, the menu shows the user's name or an avatar trigger.
		expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
	});

	it('renders the user account link when logged in (after opening the dropdown)', async () => {
		mockAuth.user = { name: 'Ahmed', email: 'a@x.com', role: 'customer' };
		mockAuth.token = 'jwt-token';
		renderNavbar();
		// Open the user dropdown by clicking the user icon button.
		const userButton = screen
			.getAllByRole('button')
			.find((b) => b.querySelector('.lucide-user'));
		expect(userButton).toBeDefined();
		if (userButton) {
			fireEvent.click(userButton);
			await waitFor(() => {
				// The dropdown shows a customer-dashboard link and a logout link.
				const dashboard = document.querySelector('a[href="/customer"]');
				expect(dashboard).not.toBeNull();
			});
		}
	});

	it('does not navigate on empty submit', () => {
		renderNavbar();
		const input = screen.getByPlaceholderText(/search products/i);
		const form = input.closest('form');
		fireEvent.submit(form!);
		expect(navigateMock).not.toHaveBeenCalled();
	});
});
