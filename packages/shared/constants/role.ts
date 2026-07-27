/**
 * Auth Role Constants
 *
 * @module shared/constants/role
 * @description Pure role enum + role → home-path map.
 * Shared between frontend (useAuthRedirect) and backend (CORS allowed roles, JWT issuance).
 */

export const ROLE_TENANT = 'tenant' as const;
export const ROLE_ADMIN = 'admin' as const;

export type Role = typeof ROLE_TENANT | typeof ROLE_ADMIN;

export const ROLE_HOME_PATH: Record<Role, string> = {
  [ROLE_TENANT]: '/app/dashboard',
  [ROLE_ADMIN]: '/admin/dashboard',
};
