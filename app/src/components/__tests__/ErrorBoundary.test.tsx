/**
 * ErrorBoundary tests
 *
 * Verifies that:
 *   - Normal children render through unchanged
 *   - Throwing children are caught and the fallback renders
 *   - The custom fallback is used when provided
 *   - Resetting returns to the normal tree
 *   - The error is logged to the console
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

function Bomb({ shouldExplode }: { shouldExplode: boolean }) {
	if (shouldExplode) throw new Error('boom');
	return <div>Safe</div>;
}

describe('ErrorBoundary', () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});
	afterEach(() => {
		errorSpy.mockRestore();
	});

	it('renders children when no error is thrown', () => {
		render(
			<ErrorBoundary>
				<Bomb shouldExplode={false} />
			</ErrorBoundary>
		);
		expect(screen.getByText('Safe')).toBeInTheDocument();
	});

	it('catches a render error and shows the default fallback', () => {
		render(
			<ErrorBoundary>
				<Bomb shouldExplode={true} />
			</ErrorBoundary>
		);
		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
	});

	it('uses the custom fallback when provided', () => {
		render(
			<ErrorBoundary fallback={(err) => <div>Custom: {err.message}</div>}>
				<Bomb shouldExplode={true} />
			</ErrorBoundary>
		);
		expect(screen.getByText('Custom: boom')).toBeInTheDocument();
	});

	it('logs the error with a [ErrorBoundary] prefix', () => {
		render(
			<ErrorBoundary>
				<Bomb shouldExplode={true} />
			</ErrorBoundary>
		);
		expect(errorSpy).toHaveBeenCalled();
		// React 19 sometimes passes a printf-style format string as the
		// first arg, so we check the whole call's joined args.
		const firstCall = errorSpy.mock.calls[0];
		const allArgs = (firstCall ?? []).map((a) => String(a)).join(' | ');
		expect(allArgs).toMatch(/ErrorBoundary/);
	});

	it('reset clears the error and re-renders children', () => {
		// We need a way to flip the children's behaviour WITHOUT remounting
		// the boundary, because the reset button is INSIDE the boundary.
		// Use a ref-like object held outside the tree.
		const state = { explode: true };
		const { rerender } = render(
			<ErrorBoundary>
				<Bomb shouldExplode={state.explode} />
			</ErrorBoundary>
		);
		expect(screen.getByRole('alert')).toBeInTheDocument();

		// Stop the children from throwing BEFORE clicking reset.
		state.explode = false;
		rerender(
			<ErrorBoundary>
				<Bomb shouldExplode={state.explode} />
			</ErrorBoundary>
		);

		// Click "Try again" — the boundary should now render the safe child.
		fireEvent.click(screen.getByRole('button', { name: /try again/i }));
		expect(screen.getByText('Safe')).toBeInTheDocument();
	});
});
