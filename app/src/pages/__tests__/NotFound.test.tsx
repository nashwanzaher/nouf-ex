/**
 * NotFound page tests
 *
 * Verifies the friendly 404 screen renders the right copy and the
 * "Back to home" link points at the site root.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotFound from '../NotFound';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en' },
	}),
}));

function renderNotFound() {
	return render(
		<MemoryRouter>
			<NotFound />
		</MemoryRouter>
	);
}

describe('NotFound', () => {
	afterEach(() => cleanup());

	it('renders the 404 code', () => {
		renderNotFound();
		expect(screen.getByText('404')).toBeInTheDocument();
	});

	it('renders a heading and a description', () => {
		renderNotFound();
		expect(screen.getByRole('heading')).toBeInTheDocument();
		expect(screen.getByText(/page you are looking for/i)).toBeInTheDocument();
	});

	it('renders a "Back to home" link pointing at "/"', () => {
		renderNotFound();
		const link = screen.getByRole('link', { name: /back to home/i });
		expect(link).toHaveAttribute('href', '/');
	});
});
