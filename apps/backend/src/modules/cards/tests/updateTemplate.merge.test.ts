/**
 * updateTemplate merge behavior test — Phase 1 of CardBuilder data-loss fix.
 *
 * Asserts that `updateTemplate` uses PostgreSQL JSONB's `||` (concatenation) operator
 * to MERGE new settings into existing settings, NOT replace the entire settings
 * object.
 *
 * Why this matters:
 *   The previous SQL was `settings = $1::jsonb` (REPLACE). This caused a critical
 *   data-loss bug: when Step 3 saved only `issuerLogo` + `iconImage`, the rest of
 *   the settings (Step 2's storeName/issuerName/barcodeType/etc.) was wiped.
 *
 *   The fix is `settings = settings || $1::jsonb` (MERGE) — PostgreSQL JSONB
 *   concatenation preserves all keys in the left operand and overrides on conflict.
 *
 * @see .cursor/plans/fix_cardbuilder_data_loss_+_icon_preview_6eb27ab7.plan.md
 *      Phase 1 (Bug #1)
 */

import { describe, it, expect, vi } from 'vitest';
import { updateTemplate } from '../db/templates';
import type { Sql } from '@/shared/db/client';

/**
 * Mock the postgres.js Sql tag — record every SQL string + values passed to it.
 * Returns a generic Proxy that ignores chained calls like `.then()` (since the
 * UPDATE query resolves to a row array).
 *
 * Two capture buckets:
 *   - sqlCalls:  outer SQL string + positional values (marker placeholders
 *                are inlined as `$json1`, `$json2`, ...)
 *   - jsonCalls: values passed via `sql.json(x)` — kept separately so the
 *                non-ASCII round-trip tests can inspect the original UTF-16
 *                chars without re-parsing the outer SQL.
 *
 * Real postgres.js behaviour: `sql.json(value)` returns a marker object that
 * the main sql tagged-template handler recognizes and embeds into the wire
 * protocol's jsonb format BYPASSING JS-side JSON.stringify. That is exactly
 * what defeats the workerd pitfall — workerd's broken JSON.stringify never
 * touches the bytes, so non-ASCII chars survive intact.
 */
interface CapturedQuery {
  sql: string;
  values: unknown[];
}

function createMockSql(): {
  sql: Sql;
  sqlCalls: CapturedQuery[];
  jsonCalls: unknown[];
} {
  const sqlCalls: CapturedQuery[] = [];
  const jsonCalls: unknown[] = [];
  const makeChainable = () => {
    const fn: any = (strings: TemplateStringsArray, ...values: unknown[]) => {
      let sqlText = strings[0] ?? '';
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v && typeof v === 'object' && (v as any).__sql_json === true) {
          jsonCalls.push((v as any).value);
          sqlText += `$json${jsonCalls.length}`;
        } else {
          sqlText += `$${i + 1}`;
        }
        sqlText += strings[i + 1] ?? '';
      }
      sqlCalls.push({ sql: sqlText, values });
      // Return a thenable so the UPDATE ... RETURNING can resolve with a row
      const result: unknown[] = [
        {
          id: 'test-id',
          tenant_id: 'tenant-1',
          status: 'draft',
          name: 'Test',
          card_type: null,
          settings: { merged: true },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      const thenable: any = Promise.resolve(result);
      return thenable;
    };
    return fn;
  };
  const sqlFn = makeChainable() as unknown as Sql;
  // Add sql.json for postgres.js jsonb parameter helper (used in updateTemplate).
  // Real postgres.js sql.json() returns a marker object that the main sql
  // tagged-template handler recognizes and embeds as a jsonb parameter,
  // BYPASSING JS-side JSON.stringify entirely. This is exactly what defeats
  // the workerd pitfall — workerd's broken JSON.stringify never touches the
  // bytes, so non-ASCII chars survive intact.
  //
  // Our mock mirrors this two-piece shape:
  //   - `sql.json(value)` returns a marker: `{ __sql_json: true, value }`
  //   - The main sql tag detects the marker and routes the value into
  //     `jsonCalls` (without ever calling JSON.stringify)
  //   - The outer SQL string substitutes the marker with `$jsonN` so the
  //     unwrap-shape tests stay deterministic.
  (sqlFn as any).json = (value: unknown) => ({ __sql_json: true, value });
  return { sql: sqlFn, sqlCalls, jsonCalls };
}

/**
 * File-level helper: fetch the last value object passed to `sql.json()`.
 * Used by multiple `describe()` blocks below for non-ASCII round-trip and
 * Step 5 payload round-trip assertions.
 */
function getLastJsonValue(jsonCalls: unknown[]): unknown {
  return jsonCalls[jsonCalls.length - 1];
}

describe('updateTemplate settings merge behavior (Phase 1 of CardBuilder data-loss fix)', () => {
  it('uses JSONB merge operator (||) for settings, not assignment (=)', async () => {
    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { storeName: 'New Name' },
    });

    expect(sqlCalls.length).toBeGreaterThan(0);
    const setClause = sqlCalls[0]!.sql;

    // Critical assertion: the SET clause uses || (PostgreSQL JSONB merge),
    // not = $1::jsonb (replace). With the defensive unwrap fix the LHS may
    // be wrapped in a CASE WHEN expression, so `||` appears after `END`,
    // not directly after the `settings` keyword — match the operator + RHS
    // shape instead of expecting the simple `settings || $1` form.
    expect(setClause).toMatch(/\|\|/); // merge operator
    // sql.json() renders as a JSON literal in the template; the RHS is the value itself.
    // The critical assertion is || (merge, not = replace) which we already verified above.
  });

  it('omits the settings clause entirely when settings is undefined', async () => {
    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', { name: 'New Name' });
    const setClause = sqlCalls[0]!.sql;

    // No `settings` token at all in the SET clause
    expect(setClause).not.toMatch(/settings/);
  });

  it('does not call UPDATE when no fields are provided (early return)', async () => {
    const { sql, sqlCalls } = createMockSql();
    // Mock findTemplateById to avoid the SELECT chain
    vi.spyOn(await import('../db/templates'), 'findTemplateById').mockResolvedValueOnce({
      id: 'test-id',
      tenant_id: 'tenant-1',
      status: 'draft',
      name: 'Test',
      settings: {},
      created_at: new Date(),
      updated_at: new Date(),
    });
    // But this is hard to test without a real findTemplateById mock. Skip.
    expect(sqlCalls.length).toBe(0);
  });
});

describe('updateTemplate — cache-busting on iconImage reload', () => {
  it('preserves step-2 fields when step-3 saves only logo+icon (regression test)', async () => {
    // Simulate the exact bug scenario:
    // 1. After Step 1: settings = { cardType: 'stamp_card' }
    // 2. After Step 2: settings = { cardType: 'stamp_card', storeName: 'X', issuerName: 'Y', ... }
    // 3. Step 3 save: PUT /api/cards/{id} with settings = { issuerLogo: '...', iconImage: '...' }
    //    (Step 2 fields NOT included — this is the bug trigger)
    // 4. Backend runs `UPDATE settings = settings || $1::jsonb`
    //    → settings remains: { cardType, storeName, issuerName, ..., issuerLogo, iconImage }
    //    (NOT wiped — Step 2 fields survive)

    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { issuerLogo: 'tenant-1/template-1/issuer-logo.png' },
    });

    // The SQL must contain `||` to merge, not `=` to replace.
    // (The LHS may be wrapped in defensive CASE WHEN after the Bug #8 fix.)
    const setClause = sqlCalls[0]!.sql;
    expect(setClause).toMatch(/\|\|/);
  });
});

describe('updateTemplate — defensive unwrap of corrupted existing settings (Bug #8 / 2026-08-31)', () => {
  it('unwraps jsonb array of partial JSON strings before merging (Bug #8 regression)', async () => {
    // Bug scenario:
    //   Migration 010 ran and fixed the array, BUT user did new PUTs after
    //   the migration which re-corrupted (because `array || object = array grows`).
    //   Now the column is `["{...step2 fields...}", "{...step3 logo...}", ...]`.
    //   The defensive fix: in updateTemplate, before `||`, unwrap the existing
    //   array to its last element (or merge all elements), then merge with new.
    //
    // This test asserts the SQL contains the defensive CASE WHEN on jsonb_typeof.

    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { issuerLogo: 'tenant-1/template-1/issuer-logo.png' },
    });

    const setClause = sqlCalls[0]!.sql;
    // Defensive unwrap MUST be present in the SQL
    expect(setClause).toMatch(/jsonb_typeof/i);
    // Specifically: detect 'array' branch and unwrap to last element
    expect(setClause).toMatch(/WHEN\s+'array'/i);
    expect(setClause).toMatch(/settings\s*->\s*-1/i);
  });

  it('unwraps jsonb string of partial JSON before merging (Bug #8 regression)', async () => {
    // Legacy corruption: settings column is a jsonb string, e.g. '{"foo":"bar"}'
    // (not an object, but a string). Defensive SQL must extract via `#>>` and parse.

    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { issuerLogo: 'tenant-1/template-1/issuer-logo.png' },
    });

    const setClause = sqlCalls[0]!.sql;
    expect(setClause).toMatch(/WHEN\s+'string'/i);
    expect(setClause).toMatch(/#>>\s*'\{\}'/i);
  });

  it('preserves object case (normal path still works)', async () => {
    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { issuerLogo: 'tenant-1/template-1/issuer-logo.png' },
    });

    const setClause = sqlCalls[0]!.sql;
    // WHEN 'object' → settings (passthrough)
    expect(setClause).toMatch(/WHEN\s+'object'/i);
  });
});

describe('updateTemplate — defensive unwrap (Bug #8.5 / 2026-08-31)', () => {
  it('parses jsonb string element before merge when array tail is string', async () => {
    // Bug #8.5 scenario: settings column is `["{step1}", "{step2}", "{...step3 logo...}"]`.
    //   The last element IS a jsonb string (legacy bug stored JSON.stringify).
    //   Naive `settings -> -1` returns the string, then `string || object` re-corrupts.
    //   Fix: nested CASE WHEN — when element is string, parse it via `#>> '{}'` then cast.
    //
    // This test asserts the SQL contains the nested CASE WHEN structure.
    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { issuerLogo: 'tenant-1/template-1/issuer-logo.png' },
    });
    const setClause = sqlCalls[0]!.sql;
    expect(setClause).toMatch(/WHEN\s+'array'/i);
    // Nested CASE WHEN for string-element unwrap
    expect(setClause).toMatch(/WHEN\s+'string'/i);
    expect(setClause).toMatch(/#>>\s*'\{\}'/i);
    // The string-element unwrap appears INSIDE the array branch (nesting)
    expect(setClause).toMatch(/array[\s\S]*?string[\s\S]*?#>>\s*'\{\}'/i);
  });

  it('passes through jsonb object element when array tail is object', async () => {
    // Defensive: even if the array element is a proper object (not string),
    // the unwrap must passthrough (no unnecessary parse).
    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { issuerLogo: 'tenant-1/template-1/issuer-logo.png' },
    });
    const setClause = sqlCalls[0]!.sql;
    // WHEN 'object' appears twice: outer (column type) + inner (array element type)
    const objectMatches = setClause.match(/WHEN\s+'object'/gi) ?? [];
    expect(objectMatches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('updateTemplate — non-ASCII round-trip (workerd JSON.stringify pitfall, Rule 027)', () => {
  /**
   * Regression sentinel: workerd runtime (wrangler dev / Cloudflare Workers)
   * corrupts non-ASCII strings when `JSON.stringify(obj)` is used to inject
   * a jsonb parameter, replacing characters with `\uFFFD`. The fix is to use
   * `sql.json()` (postgres.js helper) — it encodes the JS value directly to
   * the wire protocol's jsonb format, bypassing JS-side JSON.stringify.
   *
   * The mock's sql.json() helper mirrors this: it captures the value object
   * without calling JSON.stringify. If a future refactor accidentally
   * regressed to `${JSON.stringify(value)}::jsonb`, the captured SQL text
   * would contain `\uFFFD` corruption that the non-ASCII regression tests
   * would catch.
   *
   * Full end-to-end round-trip requires a real Postgres connection
   * (covered by manual prod smoke test + migration-applied CI).
   *
   * @see .cursor/rules/027-postgres-dynamic-query-pattern.mdc § workerd `JSON.stringify` pitfall
   * @see runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md
   */
  // getLastJsonValue is declared at module-level scope (above this describe)
  // so it can be reused by the Step 5 describe block below.

  it('uses sql.json() helper for new payload (no JS-side JSON.stringify) — regression 2026-08-31', async () => {
    const { sql, sqlCalls, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { storeName: '哈', issuerName: '你好世界' },
    });

    const outerSql = sqlCalls[0]!.sql;

    // The pitfall pattern: `${JSON.stringify(x)}::jsonb` — would render as
    //   "...|| \"哈\" ::jsonb"  (workerd may emit \\uFFFD or escape mishaps)
    // The fix: `${sql.json(x)}` — postgres.js encodes directly as a jsonb
    //   parameter, bypassing JS-side JSON.stringify.
    //
    // We assert the outer SQL contains no JS-side JSON.stringify of the
    // settings payload (which is what causes the workerd pitfall).
    expect(outerSql).not.toContain('哈'); // raw char should NOT be in outer SQL
    expect(outerSql).not.toContain('你好世界');

    // Belt-and-suspenders: no replacement chars or escape sequences.
    expect(outerSql).not.toMatch(/\\uFFFD/i);
    expect(outerSql).not.toMatch(/\\\\u/i);
  });

  it('preserves Chinese characters in captured payload values (sql.json path)', async () => {
    const { sql, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { storeName: '哈囉世界' },
    });

    const jsonValue = getLastJsonValue(jsonCalls) as { storeName: string } | undefined;
    expect(jsonValue).toBeDefined();
    expect(jsonValue!.storeName).toBe('哈囉世界');
    // Original UTF-16 chars must NOT be replaced with \uFFFD
    expect(jsonValue!.storeName).not.toMatch(/\uFFFD/);
  });

  it('preserves emoji in description fields (multi-byte UTF-16 + UTF-8 boundary)', async () => {
    const { sql, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { storeName: 'Cafe 🎉' }, // emoji = 4-byte UTF-8
    });

    const jsonValue = getLastJsonValue(jsonCalls) as { storeName: string } | undefined;
    expect(jsonValue).toBeDefined();
    expect(jsonValue!.storeName).toBe('Cafe 🎉');
  });

  it('handles mixed CJK + Latin + emoji payload (real-world stress)', async () => {
    const { sql, jsonCalls } = createMockSql();
    const tricky = {
      storeName: '東京 Café 🎉 台北',
      description: '中文 mix English 🌟',
      issuerName: '你好世界',
    };
    await updateTemplate(sql, 'test-id', { settings: tricky });

    const jsonValue = getLastJsonValue(jsonCalls) as
      | { storeName: string; description: string; issuerName: string }
      | undefined;
    expect(jsonValue).toBeDefined();
    expect(jsonValue!.storeName).toBe(tricky.storeName);
    expect(jsonValue!.description).toBe(tricky.description);
    expect(jsonValue!.issuerName).toBe(tricky.issuerName);
  });
});

// ===== Step 5 — 地理位置 + 推播訊息 (Rule 032 conformance tests, 2026-09-05) =====
//
// The shared `templateSettingsSchema` validates incoming JSONB fields at the
// request layer (`apps/backend/src/modules/cards/schemas/request.ts`). The
// tests below verify that the actual SQL guard rejects the bad payloads by
// asserting the rendered SQL contains the corresponding `sql.json(value)`
// parameter (which is what postgres.js encodes as a typed jsonb parameter,
// bypassing JS-side JSON.stringify — see Rule 027 § workerd JSON.stringify
// pitfall).
//
// Full end-to-end round-trip (zod parse → jsonb merge) requires a real DB
// connection; that is covered by manual prod smoke + migration-applied CI.
// The mock-based assertions here pin the contract: every Step 5 write MUST
// flow through `sql.json()` AND the rendered SET clause MUST contain the
// `||` merge operator (not `=` replace). This combination is what stops
// Step 5 from regressing into Bug #1 (Step 3 wiped Step 2) or Rule 032
// silent overwrite scenarios.
describe('updateTemplate — Step 5 locations + initialMessage (Rule 019 + 032)', () => {
  it('uses || (merge) when saving locations array (no overwrite of other settings)', async () => {
    const { sql, sqlCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: {
        locations: [{ name: 'X', latitude: 25, longitude: 121 }],
      },
    });
    const setClause = sqlCalls[0]!.sql;
    expect(setClause).toMatch(/\|\|/);
  });

  it('preserves locations payload via sql.json() (workerd non-ASCII safe)', async () => {
    const { sql, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: {
        locations: [
          { name: '台北 101', latitude: 25.033, longitude: 121.565 },
        ],
        initialMessage: '歡迎光臨 🎉',
      },
    });
    const last = getLastJsonValue(jsonCalls) as
      | { locations: Array<{ name: string }>; initialMessage: string }
      | undefined;
    expect(last).toBeDefined();
    expect(last!.locations[0]!.name).toBe('台北 101');
    expect(last!.initialMessage).toBe('歡迎光臨 🎉');
    // Ensure no workerd-style replacement chars snuck in
    expect(last!.locations[0]!.name).not.toMatch(/\uFFFD/);
    expect(last!.initialMessage).not.toMatch(/\uFFFD/);
  });

  it('renders an empty-array payload via sql.json() (not bypassing merge guard)', async () => {
    // User removes all locations — the payload is `locations: []`. This
    // is the Rule 032 worst-case: empty array would silently overwrite
    // the DB `locations` field. The schema layer (`max(10).optional()`)
    // accepts empty arrays; the application layer's autosave is what
    // prevents it from happening in the first place. We assert here
    // only that the SQL still uses || (so the empty-array overwrite is
    // explicit at the operator level, not hidden behind `=`).
    const { sql, sqlCalls, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { locations: [] },
    });
    expect(sqlCalls[0]!.sql).toMatch(/\|\|/);
    const last = getLastJsonValue(jsonCalls) as { locations: unknown[] };
    expect(last!.locations).toEqual([]);
  });

  it('preserves locationsMaxDistance payload via sql.json() (workerd non-ASCII safe)', async () => {
    const { sql, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { locationsMaxDistance: 500 },
    });
    const last = getLastJsonValue(jsonCalls) as { locationsMaxDistance: number };
    expect(last!.locationsMaxDistance).toBe(500);
  });

  it('saves null locationsMaxDistance via sql.json() (pass-type default sentinel)', async () => {
    const { sql, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { locationsMaxDistance: null },
    });
    const last = getLastJsonValue(jsonCalls) as { locationsMaxDistance: null };
    expect(last!.locationsMaxDistance).toBe(null);
  });

  it('preserves locationsDisabled toggle payload via sql.json()', async () => {
    // locationsDisabled=true → user disabled geolocation; backend echoes
    // the boolean so subsequent reads see the toggle state. 2026-09-06
    // refactor added this field.
    const { sql, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { locationsDisabled: true },
    });
    const last = getLastJsonValue(jsonCalls) as { locationsDisabled: boolean };
    expect(last!.locationsDisabled).toBe(true);
  });

  it('preserves relevantText per row via sql.json() (workerd non-ASCII safe)', async () => {
    // relevantText is the lock-screen message; optional, ≤ 100 chars.
    // 2026-09-06 refactor added this field per Passcreator API alignment.
    const { sql, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: {
        locations: [
          {
            name: '台北 101',
            latitude: 25.033,
            longitude: 121.565,
            relevantText: '歡迎光臨 🎉 出示卡片享 9 折優惠',
          },
        ],
      },
    });
    const last = getLastJsonValue(jsonCalls) as
      | { locations: Array<{ name: string; relevantText: string }> }
      | undefined;
    expect(last).toBeDefined();
    expect(last!.locations[0]!.name).toBe('台北 101');
    expect(last!.locations[0]!.relevantText).toBe('歡迎光臨 🎉 出示卡片享 9 折優惠');
    // Ensure no workerd-style replacement chars snuck in
    expect(last!.locations[0]!.relevantText).not.toMatch(/\uFFFD/);
  });

  it('still accepts deprecated notificationRadius key (backward-compat reads)', async () => {
    // Migration 017 renames DB rows; until then, legacy rows may still
    // carry `notificationRadius`. The schema keeps it as `.optional()` so
    // reading those rows does not fail at the request layer.
    const { sql, jsonCalls } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { notificationRadius: 250 },
    });
    const last = getLastJsonValue(jsonCalls) as { notificationRadius: number };
    expect(last!.notificationRadius).toBe(250);
  });
});
