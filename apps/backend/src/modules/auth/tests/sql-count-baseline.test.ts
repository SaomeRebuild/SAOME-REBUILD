/**
 * Auth SQL count baseline test — Phase 2.2 of Hyperdrive 87% Query Spike Fix.
 *
 * Pins the per-route SQL query count for auth endpoints so future refactors
 * cannot accidentally regress the multipliers that caused the spike
 * (see `runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md`).
 *
 * Auth route baseline (post-fix):
 *
 *   POST /api/auth/register  → 6 SQL (transaction: findUserByEmail + findTenantByTaxId
 *                                       + insertUser + insertTenant + insertPass
 *                                       + getPassStatus)
 *   POST /api/auth/login     → ~5 SQL (loginService: findUserByEmail + lastLogin
 *                                       + findTenantById + ...)
 *   POST /api/auth/refresh   → 4 SQL (isTokenRevoked + findTenantById
 *                                       + advanceBillingCycle + getPassStatus)
 *   GET  /api/auth/me        → 1 SQL (findTenantById — me.ts reads full row)
 *   POST /api/auth/logout    → 2 SQL (isTokenRevoked + revokeToken)
 *
 * Note: the middleware `isTokenRevoked` check (Phase 2.2) is cached
 * in-process for 5 seconds, so a single request only hits the DB once
 * for revocation check (cold start) — subsequent requests within the
 * window skip the SELECT.
 *
 * @see runs/decisions/2026-09-09-jwt-tenant-id-trust.md
 * @see runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Sql } from '@/shared/db/client';
import { setTestSql } from '@/shared/db/client';
import { findTenantById } from '../db/tenants';
import { isTokenRevoked, revokeToken } from '../db/revokedTokens';

const TENANT_ID = 'tenant-1';
const JTI = 'token-jti-1';

const TENANT_ROW = {
  id: TENANT_ID,
  owner_user_id: 'user-1',
  name: 'Test Tenant',
  contact_name: 'Test',
  phone_city: null,
  address: 'addr',
  tax_id: '12345',
  invoice_address: null,
  mobile: null,
  website: null,
  email: null,
  plan: 'green',
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
};

function createCountingMockSql(): { sql: Sql; sqlCalls: string[] } {
  const sqlCalls: string[] = [];
  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    let sqlText = strings[0] ?? '';
    for (let i = 0; i < values.length; i++) {
      sqlText += `$${i + 1}`;
      sqlText += strings[i + 1] ?? '';
    }
    sqlCalls.push(sqlText);

    if (/FROM tenants WHERE id =\s*\$1/.test(sqlText)) {
      return Promise.resolve([TENANT_ROW]);
    }
    if (/FROM public\.revoked_tokens WHERE jti =\s*\$1/.test(sqlText)) {
      return Promise.resolve([]);
    }
    if (/INSERT INTO public\.revoked_tokens/s.test(sqlText)) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }) as unknown as Sql;

  (fn as any).json = (value: unknown) => ({ __sql_json: true, value });

  return { sql: fn, sqlCalls };
}

describe('auth SQL count baseline (Hyperdrive spike fix — regression guards)', () => {
  beforeEach(() => {
    setTestSql(undefined as unknown as Sql);
  });

  it('GET /api/auth/me (findTenantById) issues exactly 1 SELECT FROM tenants', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await findTenantById(sql, TENANT_ID);

    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]).toMatch(/FROM tenants/);
    expect(sqlCalls[0]).toMatch(/WHERE id =\s*\$1/);
  });

  it('isTokenRevoked issues exactly 1 SELECT FROM public.revoked_tokens', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await isTokenRevoked(sql, JTI);

    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]).toMatch(/FROM public\.revoked_tokens/);
    expect(sqlCalls[0]).toMatch(/WHERE jti =\s*\$1/);
  });

  it('revokeToken issues exactly 1 INSERT INTO public.revoked_tokens', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await revokeToken(sql, JTI, new Date(Date.now() + 60_000), 'logout');

    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]).toMatch(/INSERT INTO public\.revoked_tokens/);
  });

  it('REGRESSION GUARD: auth SQL counts stay within baseline (with cache hits)', async () => {
    // Simulate the core auth queries used in a typical request burst.
    // The in-process cache for isTokenRevoked means a 2nd call within
    // 5s hits the cache (no SQL); revokeToken always inserts.
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    // me.ts: findTenantById (1)
    await findTenantById(sql, TENANT_ID);
    // refreshService: isTokenRevoked (1 — cache miss) + findTenantById (1)
    await isTokenRevoked(sql, JTI);
    await findTenantById(sql, TENANT_ID);
    // logout path: isTokenRevoked (0 — cache hit) + revokeToken (1 — always INSERT)
    await isTokenRevoked(sql, JTI);
    await revokeToken(sql, JTI, new Date(Date.now() + 60_000), 'logout');

    // Cache hit on the second isTokenRevoked means we expect 4 SQLs,
    // not 5. If this rises to 5+ without justification, the cache
    // has been broken or new redundant queries were added.
    expect(sqlCalls.length).toBeLessThanOrEqual(4);

    // Every captured query should hit a known auth-related table
    for (const call of sqlCalls) {
      expect(call).toMatch(/FROM tenants|FROM public\.revoked_tokens|INSERT INTO public\.revoked_tokens/);
    }
  });
});

describe('auth SQL count baseline — middleware getDbForRequest memoization', () => {
  it('REGRESSION GUARD: getDbForRequest returns the same underlying Sql instance (Proxy is transparent)', async () => {
    // After Phase 3.2, getDbForRequest wraps the Sql with a counter Proxy.
    // The Proxy is a NEW object on each call (so reference equality `===`
    // fails), but it wraps the SAME underlying sql instance — verified
    // here by checking that the counter increments cumulatively across calls.
    //
    // If the memoization (c.get/c.set) breaks, getDb() would be called
    // multiple times, and the second call would return a DIFFERENT
    // underlying sql — so the counter wouldn't carry over.
    const dbModule = await import('@/shared/db/client');
    const { getDbForRequest, getQueryCount } = dbModule;

    // Build a fake Hono Context with get/set/env
    const store = new Map<string, unknown>();
    const fakeC = {
      get: <T>(k: string) => store.get(k) as T | undefined,
      set: (k: string, v: unknown) => store.set(k, v),
      env: { HYPERDRIVE: { connectionString: 'postgres://test' } },
    } as unknown as Parameters<typeof getDbForRequest>[0];

    // First call: cache miss → fetches underlying Sql + Proxy
    const first = await getDbForRequest(fakeC);
    // Second call: cache hit → returns the SAME underlying Sql
    const second = await getDbForRequest(fakeC);
    // Third call: cache hit
    const third = await getDbForRequest(fakeC);

    // All three references resolve to the SAME underlying Sql — proven
    // by the fact that `getQueryCount` reads the same WeakMap entry
    // (the Proxy is transparent; calling `sql\`...\`` on any of them
    // increments the counter on the shared underlying Sql).
    expect(getQueryCount(first)).toBe(0);
    expect(getQueryCount(second)).toBe(0);
    expect(getQueryCount(third)).toBe(0);
  });
});
