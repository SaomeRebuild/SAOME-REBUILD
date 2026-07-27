/**
 * rateLimit.test.ts ??vitest unit tests for rateLimitMiddleware.
 *
 * RED phase (SAOME-12). Initial test list:
 *   - 0 fails in window ??next() called, no error
 *   - 2 fails in window ??next() called (under threshold)
 *   - 3 fails in window ??RateLimitError(429)
 *   - 5 fails in window ??RateLimitError(429)
 *   - old fails (>10 min) ignored
 *   - email case-insensitive (LOWER() match)
 *
 * Tests run in workerd via @cloudflare/vitest-pool-workers. The DB is mocked
 * via vi.mock for `shared/db/client` and `modules/auth/db/loginAttempts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { HonoEnv } from '@/shared/types/bindings';
import { RateLimitError } from '@/shared/lib/saomeError';
import {
  LOCKOUT_THRESHOLD,
  LOCKOUT_WINDOW_SECONDS,
} from '../middleware/rateLimit';

// Mock the DB layer so rateLimit tests don't need real Postgres.
vi.mock('@/shared/db/client', () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock('../db/loginAttempts', () => ({
  countRecentFailures: vi.fn(),
}));

import { countRecentFailures } from '../db/loginAttempts';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { errorHandler } from '@/shared/middleware/errorHandler';

const mockedCount = vi.mocked(countRecentFailures);

function buildApp() {
  const app = new Hono<HonoEnv>();
  app.onError(errorHandler);
  app.use('*', rateLimitMiddleware);
  app.post('/login', (c) => c.json({ ok: true }));
  return app;
}

const testEnv: HonoEnv['Bindings'] = {
  // Provide a fake Hyperdrive object with connectionString; getDb is mocked.
  HYPERDRIVE: { connectionString: 'postgres://test:test@localhost/test' } as unknown as HonoEnv['Bindings']['HYPERDRIVE'],
  ALLOWED_ORIGINS: 'http://localhost:5173',
};

async function callLogin(app: Hono<HonoEnv>, body: { email: string; password: string }) {
  const res = await app.request('http://localhost/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, testEnv);
  return res;
}

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    mockedCount.mockReset();
  });

  it('exports threshold (3) and window (600s) constants', () => {
    expect(LOCKOUT_THRESHOLD).toBe(3);
    expect(LOCKOUT_WINDOW_SECONDS).toBe(600);
  });

  it('passes through when there are 0 fails in the window', async () => {
    mockedCount.mockResolvedValue(0);
    const app = buildApp();
    const res = await callLogin(app, { email: 'user' + '@example.com', password: 'whatever' });
    expect(res.status).toBe(200);
  });

  it('passes through when there are 2 fails (under threshold)', async () => {
    mockedCount.mockResolvedValue(2);
    const app = buildApp();
    const res = await callLogin(app, { email: 'user' + '@example.com', password: 'whatever' });
    expect(res.status).toBe(200);
  });

  it('blocks (429) when there are exactly 3 fails (threshold)', async () => {
    mockedCount.mockResolvedValue(3);
    const app = buildApp();
    const res = await callLogin(app, { email: 'user' + '@example.com', password: 'whatever' });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMITED');
    expect(json.error.details.retryAfterSec).toBe(LOCKOUT_WINDOW_SECONDS);
  });

  it('blocks (429) when there are 5 fails (over threshold)', async () => {
    mockedCount.mockResolvedValue(5);
    const app = buildApp();
    const res = await callLogin(app, { email: 'user' + '@example.com', password: 'whatever' });
    expect(res.status).toBe(429);
  });

  it('queries with case-insensitive email (the middleware lowercases internally or DB does via LOWER())', async () => {
    mockedCount.mockResolvedValue(0);
    const app = buildApp();
    await callLogin(app, { email: 'user' + '@example.com', password: 'x' });
    // The middleware should pass email (case-preserved) to countRecentFailures,
    // which uses LOWER(email_attempted) = LOWER($1) on the SQL side.
    expect(mockedCount).toHaveBeenCalledWith(
      expect.anything(), // sql (mocked)
      'user' + '@example.com', // email passed through (case-preserved)
      LOCKOUT_WINDOW_SECONDS,
    );
  });

  it('throws RateLimitError with retryAfterSec equal to window', async () => {
    mockedCount.mockResolvedValue(10);
    const app = buildApp();
    // Hono's errorHandler isn't registered in this test app, so the thrown
    // error will surface as a 500 unless we check via onError.
    app.onError((err, c) => {
      if (err instanceof RateLimitError) {
        return c.json(
          { error: { code: err.code, retryAfterSec: err.retryAfterSec } },
          err.status,
        );
      }
      return c.text('Internal', 500);
    });
    const res = await callLogin(app, { email: 'user' + '@example.com', password: 'x' });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMITED');
    expect(json.error.retryAfterSec).toBe(600);
  });
});
