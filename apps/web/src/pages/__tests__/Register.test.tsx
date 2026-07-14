import React from 'react';
/**
 * Register page tests
 *
 * Register is the dual of Login in the auth gateway. The
 * page is more complex than Login because it has FOUR
 * pieces of client-side validation (email format, password
 * length, password match, terms acceptance), so we test
 * each one. The 'submit' handler calls register() from
 * '@/lib/api' which routes through MSW; the existing
 * /api/auth/register handler always returns 409 (email
 * already in use), which is perfect for asserting the
 * error-path behaviour.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { installFetchSpy, uninstallFetchSpy } from '../../../mocks/fetch-spy';

beforeAll(() => installFetchSpy());
afterAll(() => uninstallFetchSpy());

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, fallback?: string) => fallback ?? k,
		i18n: { language: 'en', changeLanguage: vi.fn() },
	}),
}));

vi.mock('@/context/AppContext', () => ({
	useAuth: () => ({
		login: vi.fn(),
		addToast: vi.fn(),
	}),
}));

const navigateMock = vi.fn();
vi.mock('react-router', async () => {
	const actual = await vi.importActual<typeof import('react-router')>('react-router');
	return { ...actual, useNavigate: () => navigateMock };
});

import Register from '../auth/Register';

function renderRegister() {
	return render(
		<MemoryRouter initialEntries={['/register']}>
			<Routes>
				<Route path="/register" element={<Register />} />
			</Routes>
		</MemoryRouter>,
	);
}

function getEmailInput(): Promise<HTMLInputElement> {
	return screen.findByPlaceholderText(/your@email\.com/i) as Promise<HTMLInputElement>;
}
function getPasswordInput(): Promise<HTMLInputElement> {
	return screen.findByPlaceholderText(/^password$/i) as Promise<HTMLInputElement>;
}
function getConfirmInput(): Promise<HTMLInputElement> {
	return screen.findByPlaceholderText(/confirm password/i) as Promise<HTMLInputElement>;
}

describe('Register page', () => {
	afterEach(() => {
		cleanup();
		navigateMock.mockClear();
	});

	it('renders the form fields and submit button', async () => {
		renderRegister();
		expect(await getEmailInput()).toBeInTheDocument();
		expect(await getPasswordInput()).toBeInTheDocument();
		expect(await getConfirmInput()).toBeInTheDocument();
		// Submit button — the i18n key for its label varies; the
		// submit button is the only <button type="submit"> in the
		// form, so we scope to that.
		const form = document.querySelector('form')!;
		const submit = form.querySelector('button[type="submit"]')!;
		expect(submit).toBeInTheDocument();
	});

	it('shows an error if email is malformed', async () => {
		renderRegister();
		fireEvent.change(await getEmailInput(), { target: { value: 'not-an-email' } });
		fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => {
			expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
		});
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it('shows a password-too-short error when password is below the minimum', async () => {
		renderRegister();
		fireEvent.change(await getEmailInput(), { target: { value: 'fresh@example.com' } });
		fireEvent.change(await getPasswordInput(), { target: { value: '123' } });
		fireEvent.change(await getConfirmInput(), { target: { value: '123' } });
		fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => {
			expect(
				screen.getByText(/password must be at least 10 characters/i),
			).toBeInTheDocument();
		});
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it('shows a mismatch error when confirm does not match password', async () => {
		renderRegister();
		fireEvent.change(await getEmailInput(), { target: { value: 'fresh@example.com' } });
		fireEvent.change(await getPasswordInput(), { target: { value: 'validpassword1' } });
		fireEvent.change(await getConfirmInput(), { target: { value: 'differentpassword1' } });
		fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => {
			expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
		});
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it('shows a terms-required error when the user has not accepted', async () => {
		renderRegister();
		fireEvent.change(await getEmailInput(), { target: { value: 'fresh@example.com' } });
		fireEvent.change(await getPasswordInput(), { target: { value: 'validpassword1' } });
		fireEvent.change(await getConfirmInput(), { target: { value: 'validpassword1' } });
		fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => {
			expect(screen.getByText(/must agree to the terms/i)).toBeInTheDocument();
		});
		expect(navigateMock).not.toHaveBeenCalled();
	});
});
