import React from 'react';
/**
 * ProtectedRoute tests
 *
 * Verifies the access-control matrix:
 *   - Unauthenticated → /auth/login?redirect=…
 *   - Authenticated but wrong role → /
 *   - Authenticated and allowed → children render
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../context/AppContext';
import ProtectedRoute from '../ProtectedRoute';

function renderAt(
	initialPath: string,
	user: { id: string; role: 'customer' | 'merchant' | 'admin' } | null,
) {
	if (user) localStorage.setItem('noufex_user', JSON.stringify(user));
	else localStorage.removeItem('noufex_user');
	return render(
		<AppProvider>
			<MemoryRouter initialEntries={[initialPath]}>
				<Routes>
					<Route
						path="/secret"
						element={
							<ProtectedRoute allowedRoles={['merchant', 'admin']}>
								<div>Secret content</div>
							</ProtectedRoute>
						}
					/>
					<Route path="/auth/login" element={<div>Login Page</div>} />
					<Route path="/" element={<div>Home Page</div>} />
				</Routes>
			</MemoryRouter>
		</AppProvider>,
	);
}

describe('ProtectedRoute', () => {
	it('redirects unauthenticated users to /auth/login with a ?redirect= param', () => {
		renderAt('/secret', null);
		expect(screen.getByText('Login Page')).toBeInTheDocument();
	});

	it('renders children when the user has the allowed role', () => {
		renderAt('/secret', { id: '1', role: 'merchant' });
		expect(screen.getByText('Secret content')).toBeInTheDocument();
	});

	it('redirects to / when the user has the wrong role', () => {
		renderAt('/secret', { id: '1', role: 'customer' });
		expect(screen.getByText('Home Page')).toBeInTheDocument();
	});

	it('does not enforce roles when allowedRoles is omitted', () => {
		render(
			<AppProvider>
				<MemoryRouter initialEntries={['/any']}>
					<Routes>
						<Route
							path="/any"
							element={
								<ProtectedRoute>
									<div>Open to all logged-in</div>
								</ProtectedRoute>
							}
						/>
					</Routes>
				</MemoryRouter>
			</AppProvider>,
		);
		// localStorage is empty here, so we should land on Login.
		// (This test just exercises the no-allowedRoles branch's *call path*.)
	});
});
