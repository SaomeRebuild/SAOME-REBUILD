/**
 * Auth contract — public DTO interfaces.
 *
 * @module contracts/auth
 * @description These types describe the JSON shape of API responses for the
 * auth endpoints. Frontend imports these (via cp sync) to type its services.
 *
 * Conventions:
 *   - Field names use camelCase
 *   - Timestamps are ISO 8601 strings (not Unix)
 *   - UUIDs are strings
 *   - NEVER include `password_hash` or any internal field in a response DTO
 *
 * Each DTO mirrors the zod schema in
 * `src/modules/auth/schemas/response.ts`.
 */

/**
 * Public-safe user info returned by /api/auth/me and embedded in
 * register/login responses.
 */
export interface AuthUserDto {
  id: string;
  email: string;
  role: 'tenant' | 'admin';
}

/**
 * Tenant business info returned by /api/auth/register and /api/auth/me.
 */
export interface TenantDto {
  id: string;
  name: string;
  contactName: string;
  phoneCity: string | null; // nullable — city phone is optional
  address: string;
  taxId: string;
  invoiceAddress: string | null;
  mobile: string; // required — cell phone is mandatory
  website: string | null;
  email: string;
}

/**
 * Response shape of POST /api/auth/register and /api/auth/login.
 *
 * `refreshToken` is returned in the JSON body ONLY for non-cookie clients
 * (mobile, server-to-server). Browser clients receive it via Set-Cookie header
 * only — never via JSON — to mitigate XSS exfiltration.
 *
 * `pass` is embedded to avoid a separate /api/me/pass polling call.
 * The client uses `endDate` to compute a live countdown with setInterval.
 */
export interface AuthSessionDto {
  user: AuthUserDto;
  tenant: TenantDto | null; // null for admin (no tenant record)
  accessToken: string;
  expiresIn: number; // seconds until accessToken expires
  refreshToken?: string; // optional; cookie clients receive via Set-Cookie
  pass?: PassDto | null; // null for admin / no pass yet
}

/**
 * Response shape of POST /api/auth/refresh.
 *
 * `pass` is embedded — frontend AuthProvider uses it to update the session
 * state on every refresh, so TrialBanner sees updated daysRemaining after reload.
 */
export interface RefreshResponseDto {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string; // optional; cookie clients receive via Set-Cookie
  pass?: PassDto | null; // null for admin / no pass yet
}

/**
 * Response shape of GET /api/auth/me.
 */
export interface MeResponseDto {
  user: AuthUserDto;
  tenant: TenantDto | null;
}

/**
 * B4 (2026-09-05): response shape of POST /api/auth/logout.
 *
 * Always returned regardless of whether the caller had a refresh credential
 * (the route is idempotent). The browser-side fix lives in the
 * `Set-Cookie: saome_refresh=; Max-Age=0` header on the response, not in
 * this body. See `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md`.
 */
export interface LogoutResponseDto {
  loggedOut: true;
}

/**
 * Standard error response shape (all endpoints use this on failure).
 */
export interface ErrorResponseDto {
  error: {
    code: string;
    i18nKey: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId: string;
}

export type PassPhase = 'trial' | 'paid' | 'expired';

/**
 * Pass info embedded in AuthSessionDto — avoids a separate /api/me/pass polling call.
 *
 * `endDate` is an ISO 8601 string so the client can compute a live countdown
 * with `setInterval` using `endDate - Date.now()`, requiring zero additional
 * network requests after login/refresh.
 *
 * `plan` mirrors the `passes.plan` CHECK constraint in the DB.
 */
export interface PassDto {
  endDate: string; // ISO 8601, e.g. "2026-08-22T00:00:00.000Z"
  daysRemaining: number;
  status: 'active' | 'expired' | 'cancelled';
  plan: 'green' | 'gold' | 'platinum';
  phase: PassPhase;
  paidAt: string | null; // ISO 8601, NULL = still in trial
  billingCycleEnd: string | null; // ISO 8601, NULL = not yet paid
}