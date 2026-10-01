/**
 * Route paths — single source of truth.
 *
 * Routes are grouped into public + tenant-only + admin-only sections.
 */

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  /** Public "Get Pass" page (no auth). The `:templateId` segment is
   * required for the dynamic route — App.tsx renders this path with the
   * `element` shape `<PassHolderShell><PassHolderRegistrationPage /></PassHolderShell>`.
   * The base path is the URL prefix used in marketing / QR codes; it does
   * NOT include `:templateId` so QR codes stay short. */
  passHolderRegister: '/pass',
  tenantDashboard: '/app/dashboard',
  adminDashboard: '/admin/dashboard',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
