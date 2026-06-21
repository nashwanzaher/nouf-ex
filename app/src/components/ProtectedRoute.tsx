import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useApp, type Role } from '../context/AppContext';

interface Props {
  children: ReactNode;
  allowedRoles?: Role[];
}

/**
 * M4 fix: gate protected routes.
 *   - Unauthenticated users are sent to /auth/login with the intended path as ?redirect=.
 *   - Authenticated users without the required role are sent back to /.
 */
export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { state } = useApp();
  const location = useLocation();

  if (!state.user) {
    const search = new URLSearchParams({ redirect: location.pathname + location.search }).toString();
    return <Navigate to={`/auth/login?${search}`} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(state.user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
