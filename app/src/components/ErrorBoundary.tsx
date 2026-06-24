/**
 * ErrorBoundary.tsx
 *
 * Catches uncaught render-phase errors anywhere below in the tree and
 * renders a friendly fallback UI instead of an empty/blank page. In
 * production this prevents a single broken component (e.g. a malformed
 * translation) from taking down the whole SPA.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * The boundary also reports errors to the console with a clear breadcrumb
 * and exposes a "Reload" action so users can recover without a hard
 * refresh.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
	children: ReactNode;
	fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	override state: State = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, info: ErrorInfo): void {
		// In production, ship to Sentry / LogRocket / etc. here. For now
		// we surface the error in the console with a clear prefix so it
		// shows up in DevTools and in production error reports.
		console.error('[ErrorBoundary]', error, info);
	}

	private reset = (): void => {
		this.setState({ hasError: false, error: null });
	};

	override render(): ReactNode {
		if (!this.state.hasError || !this.state.error) {
			return this.props.children;
		}

		if (this.props.fallback) {
			return this.props.fallback(this.state.error, this.reset);
		}

		return (
			<div
				role="alert"
				className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-12 bg-aliSurface"
			>
				<div className="text-6xl font-bold text-aliOrange mb-4">!</div>
				<h1 className="text-xl font-semibold text-aliText mb-2">Something went wrong</h1>
				<p className="text-sm text-aliTextSec max-w-md mb-6">
					{this.state.error.message || 'An unexpected error occurred.'}
				</p>
				<button
					type="button"
					onClick={this.reset}
					className="px-5 py-2 bg-aliOrange text-white rounded-lg hover:bg-aliOrangeHover transition-colors"
				>
					Try again
				</button>
			</div>
		);
	}
}
