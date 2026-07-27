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
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

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
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds = 900
): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey(secret));
}

/**
 * Sign a refresh token (default TTL: 30 days).
 */
export async function signRefreshToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds = 2592000
): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
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
  });
  return parsed;
}