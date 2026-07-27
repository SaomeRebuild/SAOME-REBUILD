/**
 * useAuthRedirect — pick role-based landing path and redirect.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { ROLE_HOME_PATH, type Role } from '@saome/shared/constants/role';

export function useAuthRedirect() {
  const { state, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAuthenticated || !state.user) return;
    const role = state.user.role as Role;
    const path = ROLE_HOME_PATH[role] ?? '/app/dashboard';
    navigate(path, { replace: true });
  }, [isAuthenticated, state.user, navigate]);
}