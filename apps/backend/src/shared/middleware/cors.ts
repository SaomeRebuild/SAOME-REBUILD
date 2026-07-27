/**
 * CORS middleware.
 *
 * @module shared/middleware/cors
 * @description Adds CORS headers based on `env.ALLOWED_ORIGINS` (comma-separated).
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';

export function resolveAllowedOrigin(origin: string | undefined, allowedOrigins: string): string | undefined {
  if (!origin) return undefined;
  const allowList = allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean);
  return allowList.includes(origin) ? origin : undefined;
}

export const corsMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = c.env.ALLOWED_ORIGINS ?? 'http://localhost:5173';
  const allowed = resolveAllowedOrigin(origin, allowedOrigins);
  if (allowed) {
    c.res.headers.set('Access-Control-Allow-Origin', allowed);
    c.res.headers.set('Vary', 'Origin');
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
    c.res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-Id',
    );
    c.res.headers.set('Access-Control-Expose-Headers', 'X-Request-Id');
    c.res.headers.set('Access-Control-Max-Age', '86400');
  }
  // Preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: c.res.headers,
    });
  }
  await next();
};

export function applyCorsHeaders(c: Context<HonoEnv>, response: Response): Response {
  const origin = c.req.header('Origin');
  const allowedOrigins = c.env.ALLOWED_ORIGINS ?? 'http://localhost:5173';
  const allowed = resolveAllowedOrigin(origin, allowedOrigins);
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', allowed);
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return response;
}