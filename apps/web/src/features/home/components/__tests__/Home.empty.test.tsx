import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { CartProvider } from '@/features/cart/context/CartContext';
import { AppProvider } from '@/context/AppContext';
import Home from '../index';

vi.mock('@/hooks/useApi', () => ({
	useHomeStats: () => ({
		data: { products_count: 0, stores_count: 0, orders_count: 0, users_count: 0 },
		loading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useProducts: () => ({
		data: { products: [], total: 0 },
		loading: false,
		error: null,
		refetch: vi.fn(),
	}),
	useStores: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
	useCategories: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en' },
	}),
}));

describe('Home empty catalog', () => {
	it('renders empty states without stores or products', () => {
		render(
			<MemoryRouter>
				<AppProvider>
					<CartProvider>
						<Home />
					</CartProvider>
				</AppProvider>
			</MemoryRouter>,
		);
		expect(screen.getByText('No products are available yet.')).toBeInTheDocument();
		expect(screen.getByText('No stores are available yet.')).toBeInTheDocument();
	});
});
