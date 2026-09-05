/**
 * JWT signing and verification (HS256).
 *
 * @module shared/lib/jwt
 * @description Single source of truth for access/refresh token operations.
 * Modules MUST go through `signAccessToken` / `signRefreshToken` / `verifyToken`
 * — never import `jose` directly.
 *
 * Token types:
 *   - access: 15 min TTL, sent in Authorization: Bearer header
 *   - refresh: 30 day TTL, sent as HttpOnly cookie (Domain=.saome.org)
 *
 * Phase 2.2 (2026-09-05): every token now carries a `jti` (UUID v4) claim
 * so the server can revoke individual tokens before their natural TTL
 * expires. See `runs/decisions/2026-09-05-auth-logout-revocation-strategy.md`
 * option B for the revocation table layout and pg_cron cleanup job.
 */

import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

/**
 * Canonical JWT payload. Mirrors `packages/shared/schemas/auth.ts::jwtPayloadSchema`.
 * Local copy to avoid cross-repo import (see docs/architecture.md §與 frontend 共享).
 */
export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['tenant', 'admin']),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
  /**
   * JWT ID — unique per token (UUID v4). Used by `verifyToken()` to look up
   * the `revoked_tokens` table and reject tokens that were explicitly
   * revoked (e.g. on logout) before their TTL expired.
   */
  jti: z.string().uuid(),
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

/**
 * Generate a UUID v4 string for use as a JWT `jti` claim.
 *
 * Uses `crypto.randomUUID()` which is available in:
 *   - Node.js 19+
 *   - Cloudflare Workers (workerd) runtime
 *   - Modern browsers
 *
 * Not validated as a real RFC 4122 UUID downstream — the `jwtPayloadSchema`
 * just requires it to be a valid UUID string.
 */
function newJti(): string {
  return crypto.randomUUID();
}

/**
 * Encode the HS256 secret as a Uint8Array (jose requires this).
 */
function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Sign an access token (default TTL: 15 min).
 */
export async function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>,
  secret: string,
  ttlSeconds = 900
): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setJti(newJti())
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey(secret));
}

/**
 * Sign a refresh token (default TTL: 30 days).
 */
export async function signRefreshToken(
  payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>,
  secret: string,
  ttlSeconds = 2592000
): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setJti(newJti())
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey(secret));
}

/**
 * Verify a JWT and return its payload.
 *
 * @throws SaomeError(401) on signature failure / expired / malformed claims
 *
 * Note: import is deferred to break a circular dep with auth.ts middleware.
 * This function throws jose errors which callers wrap.
 *
 * Phase 2.2 (2026-09-05): the returned `JwtPayload` includes the `jti`
 * claim so callers (refreshService, requireAuth middleware) can look up
 * `revoked_tokens` to enforce server-side revocation before TTL expiry.
 */
export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    algorithms: ['HS256'],
  });
  // Normalize jose's loose types into our strict schema
  const parsed = jwtPayloadSchema.parse({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
  });
  return parsed;
}