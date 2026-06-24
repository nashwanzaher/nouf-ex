/**
 * Integration test for the Checkout page (P0-1: cart-to-order pipeline).
 *
 * The Checkout page orchestrates:
 *   1. Reading the active customer from useAuth()
 *   2. Showing the user's saved addresses
 *   3. Showing the cheapest shipping option
 *   4. Validating coupon codes
 *   5. Placing the order via POST /api/orders
 *   6. Clearing the cart and redirecting to /customer/orders
 *
 * This test focuses on (1) and (5): it renders the page with a
 * signed-in user + non-empty cart, fills the required fields, and
 * asserts that a POST /api/orders is sent and the page navigates
 * to the success URL.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { installFetchSpy, uninstallFetchSpy } from '../../../tests/mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

// ── Mocks ───────────────────────────────────────────────────────────────

// Stub out the static JSON data module so the cart can be seeded
// without touching localStorage in a complex way.
const MOCK_CART = [
	{
		productId: '1',
		name: 'Premium Wireless Headphones',
		price: 25000,
		quantity: 1,
		image: '/category-electronics.jpg',
		merchantName: 'Test Store',
	},
];

// Mock CartContext so the page can read items + dispatch CLEAR.
vi.mock('@/context/CartContext', () => ({
	useCart: () => ({
		state: { items: MOCK_CART },
		dispatch: vi.fn(),
		cartCount: 1,
		cartTotal: 25000,
	}),
}));

// Mock AppContext with a signed-in customer.
const MOCK_USER = {
	id: '5',
	name: 'Ahmed',
	email: 'ahmed@gmail.com',
	role: 'customer' as const,
};
const addToastMock = vi.fn();
vi.mock('@/context/AppContext', () => ({
	useAuth: () => ({
		user: MOCK_USER,
		token: 'test-jwt-token',
		isAuthenticated: true,
		login: vi.fn(),
		logout: vi.fn(),
		addToast: addToastMock,
	}),
	useApp: () => ({ state: { lang: 'ar' }, dispatch: vi.fn(), addToast: addToastMock }),
	AppProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Stub the i18n hook so useTranslation() returns plain keys — the
// page is exercised in English/LTR mode below.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
	Trans: ({ children }: { children: React.ReactNode }) => children,
	initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Capture the navigate call so we can assert on it.
const navigateMock = vi.fn();
vi.mock('react-router', async () => {
	const actual = await vi.importActual<typeof import('react-router')>('react-router');
	return {
		...actual,
		useNavigate: () => navigateMock,
		useSearchParams: () => [new URLSearchParams(), vi.fn()],
	};
});

// ── Helpers ─────────────────────────────────────────────────────────────

const renderCheckout = () =>
	render(
		<MemoryRouter initialEntries={['/checkout']}>
			<Checkout />
		</MemoryRouter>,
	);

// Import after the mocks so the mocked modules take effect.
import Checkout from '../Checkout';

describe('Checkout page (P0-1: cart-to-order pipeline)', () => {
	beforeEach(() => {
		navigateMock.mockReset();
		addToastMock.mockReset();
		// Seed the Bearer token so apiRequest attaches it.
		localStorage.setItem('noufex_token', 'test-jwt-token-1234');
		// React Testing Library does not always auto-cleanup between
		// Vitest 4 tests; clear the DOM so each test starts from a
		// known state.
		cleanup();
	});

	it('shows the cart total in the summary', async () => {
		renderCheckout();
		// 25,000 appears in both the line item and the summary; we
		// just need to confirm the value is rendered at least once.
		const matches = await screen.findAllByText(/25,000/);
		expect(matches.length).toBeGreaterThan(0);
	});

	it('renders the signed-in user addresses', async () => {
		renderCheckout();
		// The addressesFixture has 2 entries (Home + Office).
		expect(await screen.findByText('Home')).toBeInTheDocument();
		expect(await screen.findByText('Office')).toBeInTheDocument();
	});

	it('renders the place order button', async () => {
		renderCheckout();
		const placeBtn = await screen.findByRole('button', { name: /place order/i });
		expect(placeBtn).toBeInTheDocument();
	});

	it('sends a POST /api/orders request when the user clicks "Place order"', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		renderCheckout();

		// Wait for the address to be auto-selected (Home, default).
		const placeBtn = await screen.findByRole('button', { name: /place order/i });
		// Give the page a tick to apply the default address id.
		await waitFor(() => expect(placeBtn).not.toBeDisabled());

		fireEvent.click(placeBtn);

		// The handler returns id: 3 (next sequence), discount 0, total 25000.
		await waitFor(() => {
			const orderCall = fetchSpy.mock.calls.find((c) => {
				const url = typeof c[0] === 'string' ? c[0] : (c[0] as Request).url;
				return (
					url.includes('/api/orders') &&
					(c[1] as RequestInit | undefined)?.method === 'POST'
				);
			});
			expect(orderCall, 'POST /api/orders was not called').toBeDefined();
		});

		// And we navigated to /customer/orders?just=N.
		await waitFor(() => {
			const navCall = navigateMock.mock.calls.find(
				(c) => typeof c[0] === 'string' && c[0].startsWith('/customer/orders'),
			);
			expect(navCall, 'expected navigation to /customer/orders').toBeDefined();
		});
		fetchSpy.mockRestore();
	});
});
