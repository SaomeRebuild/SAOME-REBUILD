/**
 * AuthGuard — redirects unauthenticated users to login; renders children when authenticated.
 *
 * Used in routes that require authentication (e.g. dashboard, admin pages).
 */

import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface AuthGuardProps {
  authenticated: boolean | undefined;
  expectedRole?: 'tenant' | 'admin';
  actualRole?: 'tenant' | 'admin';
  children: ReactNode;
  /** Where to send unauthenticated users. */
  loginPath?: string;
}

export function AuthGuard({
  authenticated,
  expectedRole,
  actualRole,
  children,
  loginPath = '/login',
}: AuthGuardProps) {
  const location = useLocation();
  if (authenticated === false) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }
  if (expectedRole && actualRole && actualRole !== expectedRole) {
    return <Navigate to="/" replace />;
  }
  if (authenticated !== true) {
    return null; // loading state
  }
  return <>{children}</>;
}
