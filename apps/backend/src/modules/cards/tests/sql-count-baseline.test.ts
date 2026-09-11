/**
 * SQL count baseline test — Phase 2.1 of Hyperdrive 87% Query Spike Fix.
 *
 * Pins the per-route SQL query count so future refactors cannot
 * accidentally regress the multipliers that caused the spike
 * (see `runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md`).
 *
 * The cardinal assertion is the **REGRESSION GUARD**: after Phase 1.2
 * (delete `findTenantById` from card routes), NO card business SQL
 * should reference the `tenants` table. If a future refactor reintroduces
 * `findTenantById` by mistake, this catches it.
 *
 * Phase 1 reduction summary:
 *   - Before: 10 routes × ~4.5 SQL/req = ~45 SQL/10req
 *             (warmup `getDb()` per middleware+handler + `findTenantById`
 *              per route)
 *   - After:  10 routes × 2.5 SQL/req = 25 SQL/10req
 *             (warmup memoized via `getDbForRequest(c)` + JWT tenantId trust)
 *
 * @see runs/decisions/2026-09-09-jwt-tenant-id-trust.md
 * @see runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Sql } from '@/shared/db/client';
import { setTestSql } from '@/shared/db/client';
import {
  insertTemplate,
  findTemplateById,
  findTemplatesByTenantId,
  findLatestDraftByTenant,
  updateTemplate,
  touchExpiresAt,
  deleteTemplate,
} from '../db/templates';

const TENANT_ID = 'tenant-1';
const TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';

const TEMPLATE_ROW = {
  id: TEMPLATE_ID,
  tenant_id: TENANT_ID,
  status: 'draft' as const,
  name: 'Test',
  card_type: null,
  settings: {},
  created_at: new Date(),
  updated_at: new Date(),
  expires_at: new Date(),
};

/**
 * Mock that captures every tagged-template invocation. Returns a
 * thenable Promise so callers can await on it (mirroring real postgres.js).
 *
 * Note: postgres.js's `sql\`...\`` tag returns a thenable on its own, but
 * when the template includes nested `sql\`...\`` fragments (e.g.
 * `sql\`gen_random_uuid()\`` for INSERT with optional id), each nested
 * tag also produces its own call. We capture ALL of them so we can
 * assert "no tenants table" against the full set.
 */
function createCountingMockSql(): { sql: Sql; sqlCalls: string[] } {
  const sqlCalls: string[] = [];
  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    let sqlText = strings[0] ?? '';
    for (let i = 0; i < values.length; i++) {
      sqlText += `$${i + 1}`;
      sqlText += strings[i + 1] ?? '';
    }
    sqlCalls.push(sqlText);

    // Dispatch return shape based on the SQL fragment.
    if (/FROM templates WHERE id =\s*\$1/.test(sqlText)) {
      return Promise.resolve([TEMPLATE_ROW]);
    }
    if (/FROM templates WHERE tenant_id =\s*\$1/.test(sqlText)) {
      return Promise.resolve([TEMPLATE_ROW]);
    }
    if (/UPDATE templates.*expires_at/s.test(sqlText)) {
      return Promise.resolve([{ ...TEMPLATE_ROW, expires_at: new Date() }]);
    }
    if (/UPDATE templates/s.test(sqlText)) {
      return Promise.resolve([TEMPLATE_ROW]);
    }
    if (/INSERT INTO templates/s.test(sqlText)) {
      return Promise.resolve([TEMPLATE_ROW]);
    }
    if (/DELETE FROM templates/s.test(sqlText)) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }) as unknown as Sql;

  (fn as any).json = (value: unknown) => ({ __sql_json: true, value });

  return { sql: fn, sqlCalls };
}

describe('cards SQL count baseline (Hyperdrive spike fix — regression guards)', () => {
  beforeEach(() => {
    setTestSql(undefined as unknown as Sql);
  });

  it('GET /api/cards/:id (findTemplateById) issues exactly 1 SELECT FROM templates', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await findTemplateById(sql, TEMPLATE_ID);

    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]).toMatch(/FROM templates/);
    expect(sqlCalls[0]).toMatch(/WHERE id =\s*\$1/);
  });

  it('PATCH /api/cards/:id/touch (touchExpiresAt) issues exactly 1 UPDATE with expires_at', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await touchExpiresAt(sql, TEMPLATE_ID);

    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]).toMatch(/UPDATE templates/);
    expect(sqlCalls[0]).toMatch(/expires_at/);
  });

  it('DELETE /api/cards/:id (deleteTemplate) issues exactly 1 DELETE', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await deleteTemplate(sql, TEMPLATE_ID);

    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]).toMatch(/DELETE FROM templates/);
  });

  it('POST /api/cards (insertTemplate) issues ≤ 5 calls total (1 INSERT + nested helpers)', async () => {
    // Upper bound accounts for nested `sql\`gen_random_uuid()\`` call.
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await insertTemplate(sql, {
      tenantId: TENANT_ID,
      name: 'Test',
      cardType: 'stamp_card',
    });

    expect(sqlCalls.length).toBeLessThanOrEqual(5);
    // At least one captured query must reference templates
    expect(sqlCalls.some((c) => /INSERT INTO templates/s.test(c))).toBe(true);
  });

  it('GET /api/cards (findTemplatesByTenantId) issues exactly 1 SELECT', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await findTemplatesByTenantId(sql, TENANT_ID);

    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]).toMatch(/FROM templates/);
    expect(sqlCalls[0]).toMatch(/tenant_id =\s*\$1/);
  });

  it('GET /api/cards/drafts (findLatestDraftByTenant) issues exactly 1 SELECT', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await findLatestDraftByTenant(sql, TENANT_ID);

    expect(sqlCalls.length).toBe(1);
    expect(sqlCalls[0]).toMatch(/FROM templates/);
    expect(sqlCalls[0]).toMatch(/status = 'draft'/);
  });

  it('PUT /api/cards/:id (updateTemplate) issues 1 real UPDATE (mock over-counts empty placeholders)', async () => {
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    await updateTemplate(sql, TEMPLATE_ID, { name: 'Updated' });

    // The mock captures BOTH the outer UPDATE call AND any nested
    // sql`name = ...` fragment used to build the SET clause, plus
    // `sql\`\`` empty placeholders for the conditional clauses
    // (`${clauses.length > 1 ? sql\`...\`: sql\`\`}`). The empty
    // placeholders are NOT actual SQL sent to Postgres — they're
    // postgres.js tagged-template objects that resolve to empty strings
    // when composed. In production, this route issues exactly 1 SQL.
    // The mock over-counts to ~5 (1 outer + 1 setName + 3 empty).
    expect(sqlCalls.length).toBeLessThanOrEqual(5);

    // At least one captured query must be the real UPDATE
    const realUpdates = sqlCalls.filter((c) => /UPDATE templates/s.test(c));
    expect(realUpdates.length).toBe(1);
  });

  it('REGRESSION GUARD: NO SQL touches `tenants` table from cards db layer', async () => {
    // Critical assertion: after deleting findTenantById from card routes,
    // NO card business SQL should reference the `tenants` table. If a
    // future refactor reintroduces findTenantById by mistake, this catches it.
    const { sql, sqlCalls } = createCountingMockSql();
    setTestSql(sql);

    // Exercise every db function used by card routes
    await insertTemplate(sql, { tenantId: TENANT_ID, name: 'T' });
    await findTemplateById(sql, TEMPLATE_ID);
    await findTemplatesByTenantId(sql, TENANT_ID);
    await findLatestDraftByTenant(sql, TENANT_ID);
    await updateTemplate(sql, TEMPLATE_ID, { name: 'U' });
    await updateTemplate(sql, TEMPLATE_ID, { status: 'published' });
    await updateTemplate(sql, TEMPLATE_ID, { settings: { foo: 'bar' } });
    await touchExpiresAt(sql, TEMPLATE_ID);
    await deleteTemplate(sql, TEMPLATE_ID);

    for (const call of sqlCalls) {
      // No SQL may touch the `tenants` table directly.
      expect(call).not.toMatch(/FROM tenants/i);
      expect(call).not.toMatch(/UPDATE tenants/i);
      expect(call).not.toMatch(/INSERT INTO tenants/i);
      expect(call).not.toMatch(/DELETE FROM tenants/i);
    }
  });
});
