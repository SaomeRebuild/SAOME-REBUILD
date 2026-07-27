/**
 * Route paths — single source of truth.
 *
 * Routes are grouped into public + tenant-only + admin-only sections.
 */

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  tenantDashboard: '/app/dashboard',
  adminDashboard: '/admin/dashboard',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
