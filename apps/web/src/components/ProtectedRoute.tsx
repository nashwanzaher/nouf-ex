import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useApp, type Role } from '../context/AppContext';

interface Props {
	children: ReactNode;
	allowedRoles?: Role[];
}

/**
 * M4 fix + G9 fix 2026-07-11: gate protected routes.
 *   - Unauthenticated users are sent to /auth/login with the intended path as ?redirect=.
 *   - Authenticated users without the required role are redirected to
 *     the dashboard that matches their actual role, instead of being
 *     dumped at `/` (which used to silently log them out of a usable
 *     page). This keeps the user oriented and avoids a dead-end UX
 *     when a merchant accidentally navigates to /admin or vice versa.
 */
function dashboardForRole(role: Role): string {
	switch (role) {
		case 'admin':
			return '/admin';
		case 'merchant':
			return '/seller';
		case 'customer':
			return '/customer';
		case 'guest':
		default:
			return '/';
	}
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
	const { state } = useApp();
	const location = useLocation();

	if (!state.user) {
		const search = new URLSearchParams({
			redirect: location.pathname + location.search,
		}).toString();
		return <Navigate to={`/auth/login?${search}`} replace />;
	}

	if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(state.user.role)) {
		return <Navigate to={dashboardForRole(state.user.role)} replace />;
	}

	return <>{children}</>;
}
