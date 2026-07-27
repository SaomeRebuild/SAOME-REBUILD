/**
 * App-level constants. Mirrors `@saome/shared/constants/role` for FE use.
 */

export const ROLES = {
  tenant: 'tenant',
  admin: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
