/**
 * passHolders db layer — partial update conformance tests.
 *
 * @module modules/pass-templates/db/passHolders
 *
 * 2026-10-19 — Production bug fix conformance suite.
 *
 * Background: the production row `83d3139a-c3bb-4806-8900-5e9b759d0122`
 * landed with `barcode_value` populated but `pass_identifier` /
 * `download_url` / `issued_at` / `iphone_uri` / `android_uri` all
 * `NULL`. Root cause: `updatePassHolderIssuance` issued an
 * unconditional `SET xxx = ${input.xxx ?? null}` for all 7 runtime
 * columns. The barcode-backfill path runs TWO calls (first with all 7
 * fields, second with only `barcodeValue`); the second call wiped
 * the 6 sibling columns back to NULL.
 *
 * Fix: wrap the 6 runtime columns in `COALESCE(${newValue}, <col>)`
 * so the column keeps its previous value when the caller omits the
 * field. `issuance_error` stays unconditional (success path clears
 * stale errors, failure path overwrites with a fresh i18n key).
 *
 * The 4 tests below pin the SQL-level behavior at the db function
 * boundary so a future refactor that re-introduces unconditional
 * `SET xxx = null` is caught loudly. Tests use a counting mock sql
 * (mirrors `cards/tests/sql-count-baseline.test.ts` pattern) so the
 * suite runs in milliseconds without a real Hyperdrive connection.
 *
 * The cardinal assertions verify:
 *   1. The emitted SQL fragment for runtime columns uses
 *      `COALESCE(${...}, <col>)` (NOT plain `= ${...}`).
 *   2. The emitted SQL for `issuance_error` stays unconditional
 *      (`= ${...}`) so success/failure semantics are preserved.
 *   3. The mock dispatcher preserves pre-existing values for
 *      `COALESCE`-wrapped columns when the new value is NULL, and
 *      uses the new value when it is non-NULL.
 *   4. `issuance_error` is always set from the caller's value
 *      (success: undefined → NULL; failure: string → string).
 *
 * @see runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md
 * @see apps/backend/src/modules/pass-templates/db/passHolders.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Sql } from '@/shared/db/client';
import { setTestSql } from '@/shared/db/client';
import {
  updatePassHolderCurrentTier,
  updatePassHolderIssuance,
  updatePassHolderPassValuesSnapshot,
  type PassHolderRow,
} from './passHolders';
import { emptyPassValuesMetrics } from '@saome/shared/schemas/passValues';

const HOLDER_ID = '00000000-0000-0000-0000-000000000099';

/**
 * Pre-existing row state used as the "previous" values for the
 * COALESCE-preserves-previous assertion. Captured verbatim so the
 * test can compare returned row state against this snapshot.
 */
const PRE_EXISTING_ROW: PassHolderRow = {
  id: HOLDER_ID,
  template_id: '716c4244-6c63-496d-a967-6c87cdac605d',
  name: '王小明',
  phone_country_code: '+886',
  phone_number: '912345678',
  birthday: '1990-01-15',
  email: 'wang@example.com',
  created_at: new Date('2026-09-01T00:00:00Z'),
  updated_at: new Date('2026-09-01T00:00:00Z'),
  payment_status: 'not_required',
  // The 7 runtime columns — pre-populated so partial update can
  // preserve them.
  pass_identifier: 'PRESERVED-IDENTIFIER',
  download_url: 'https://app.passcreator.com/p/PRESERVED',
  barcode_value: 'PRESERVED-BARCODE',
  issued_at: new Date('2026-10-18T00:00:00Z'),
  issuance_error: null,
  iphone_uri: 'https://app.passcreator.com/PRESERVED.pkpass',
  android_uri: 'https://passwallet.page.link/PRESERVED',
};

/**
 * Parse the SET clause list from a captured `UPDATE` SQL fragment.
 * Returns a list of `{ col, coalesceWrapped, placeholder }` for each
 * `col = ...` assignment, in the order they appear. Handles the
 * partial-update COALESCE pattern (e.g. `pass_identifier = COALESCE($1,
 * pass_identifier)`) AND the unconditional `issuance_error = $5` form.
 *
 * Comma-aware split: we can't naively `split(',')` because COALESCE
 * contains commas inside its parentheses. We track paren depth and
 * only split at top-level commas.
 */
function parseSetClauses(
  sqlText: string,
): Array<{ col: string; coalesceWrapped: boolean; placeholder: number }> {
  const setMatch = sqlText.match(/SET\s+(.+?)\s+WHERE\s/s);
  if (!setMatch) return [];
  const setBody = setMatch[1]!;

  // Comma-aware split: only split at depth 0.
  const clauses: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of setBody) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      clauses.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) clauses.push(current.trim());

  const out: Array<{ col: string; coalesceWrapped: boolean; placeholder: number }> = [];
  for (const clause of clauses) {
    const m = clause.match(/^(\w+)\s*=\s*(.+)$/);
    if (!m) continue;
    const col = m[1]!;
    const rhs = m[2]!;
    // COALESCE form: `COALESCE($N, <col>)` — preserves pre-existing
    // value when $N is NULL.
    const coalesceMatch = rhs.match(
      new RegExp(`^COALESCE\\(\\$([0-9]+)(?:::[^,)]+)?,\\s*${col}\\)`),
    );
    if (coalesceMatch) {
      out.push({
        col,
        coalesceWrapped: true,
        placeholder: Number(coalesceMatch[1]),
      });
      continue;
    }
    // Plain form: `$N` — unconditional SET (null clears).
    const plainMatch = rhs.match(/^\$([0-9]+)$/);
    if (plainMatch) {
      out.push({
        col,
        coalesceWrapped: false,
        placeholder: Number(plainMatch[1]),
      });
    }
    // Otherwise (e.g. `${iso}::timestamptz`): keep raw — caller decides.
  }
  return out;
}

/**
 * Build a mock Sql that (a) captures the emitted SQL fragment, and
 * (b) simulates postgres.js's `COALESCE(${newValue}, <col>)`
 * semantics by inspecting the captured SQL. If the SQL wraps a
 * column in `COALESCE`, the column keeps its pre-existing value
 * when the new value is `null`; if not, the new value wins.
 *
 * This is intentionally a "smart" mock — without it, the tests
 * could only assert on the SQL TEXT and not the real behavioral
 * effect of `COALESCE`. The mock is local to this test file and
 * has no production impact.
 */
function createPartialUpdateMockSql(preExisting: PassHolderRow): {
  sql: Sql;
  sqlCalls: string[];
} {
  const sqlCalls: string[] = [];

  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    let sqlText = strings[0] ?? '';
    for (let i = 0; i < values.length; i++) {
      sqlText += `$${i + 1}`;
      sqlText += strings[i + 1] ?? '';
    }
    sqlCalls.push(sqlText);

    // Simulate the UPDATE statement.
    if (/UPDATE public\.pass_holders/s.test(sqlText)) {
      // Initialize returned row from pre-existing state.
      const next: PassHolderRow = { ...preExisting };

      const clauses = parseSetClauses(sqlText);
      for (const { col, coalesceWrapped, placeholder } of clauses) {
        const idx = placeholder - 1;
        const newValue = values[idx];
        if (coalesceWrapped) {
          // COALESCE: null/undefined → preserve; else → use new value.
          if (newValue !== null && newValue !== undefined) {
            (next as Record<string, unknown>)[col] = newValue;
          }
          // else: keep pre-existing
        } else {
          // Plain SET: always use new value (null clears).
          (next as Record<string, unknown>)[col] = newValue ?? null;
        }
      }

      // Return the simulated next state wrapped in an array (matches
      // `RETURNING ...` shape).
      return Promise.resolve([next]);
    }
    return Promise.resolve([]);
  }) as unknown as Sql;

  (fn as any).json = (value: unknown) => ({ __sql_json: true, value });

  return { sql: fn, sqlCalls };
}

beforeEach(() => {
  // Reset the module-level mock slot so each test injects its own.
  setTestSql(undefined as unknown as Sql);
});

describe('updatePassHolderIssuance — partial update conformance (regression — 2026-10-19)', () => {
  it('partial update: 5 of 6 runtime columns provided, 1 omitted → omitted column PRESERVES pre-existing value', async () => {
    // 6 runtime columns: pass_identifier, download_url, barcode_value,
    // issued_at, iphone_uri, android_uri. Provide 5 of them (everything
    // except `androidUri`). The 5 provided columns MUST take the new
    // values; the omitted `android_uri` MUST preserve pre-existing
    // 'https://passwallet.page.link/PRESERVED' thanks to the COALESCE
    // wrapper.
    const { sql, sqlCalls } = createPartialUpdateMockSql(PRE_EXISTING_ROW);
    setTestSql(sql);

    const result = await updatePassHolderIssuance(sql, {
      id: HOLDER_ID,
      passIdentifier: 'NEW-IDENTIFIER',
      downloadUrl: 'https://app.passcreator.com/p/NEW',
      barcodeValue: 'NEW-BARCODE',
      issuedAt: new Date('2026-10-19T12:34:56Z'),
      iPhoneUri: 'https://app.passcreator.com/NEW.pkpass',
      // androidUri: OMITTED (undefined)
    });

    // Assert: emitted SQL wraps runtime columns in COALESCE.
    expect(sqlCalls).toHaveLength(1);
    const sqlText = sqlCalls[0]!;
    expect(sqlText).toMatch(/UPDATE public\.pass_holders/);
    // COALESCE wrappers on all 6 runtime columns (allow optional
    // `::typecast` between the placeholder and the column — see
    // `issued_at = COALESCE($4::timestamptz, issued_at)`).
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*pass_identifier\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*download_url\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*barcode_value\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*issued_at\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*iphone_uri\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*android_uri\)/);
    // issuance_error stays unconditional (NOT in COALESCE).
    expect(sqlText).not.toMatch(/COALESCE\(\$\d+,\s*issuance_error\)/);
    expect(sqlText).toMatch(/issuance_error\s*=\s*\$\d+/);

    // Assert: 5 provided columns took new values.
    expect(result.pass_identifier).toBe('NEW-IDENTIFIER');
    expect(result.download_url).toBe('https://app.passcreator.com/p/NEW');
    expect(result.barcode_value).toBe('NEW-BARCODE');
    expect(result.iphone_uri).toBe('https://app.passcreator.com/NEW.pkpass');
    // Assert: 1 omitted column preserved pre-existing value.
    expect(result.android_uri).toBe('https://passwallet.page.link/PRESERVED');
    // Assert: issuance_error was cleared (success path: undefined → NULL).
    expect(result.issuance_error).toBeNull();
  });

  it('partial update: only barcodeValue provided → all 6 sibling columns PRESERVE pre-existing value', async () => {
    // The exact production bug scenario: registerService runs a
    // second `updatePassHolderIssuance` call with only `barcodeValue`
    // to backfill the real per-pass barcode. Before the fix, this
    // wiped the 6 sibling columns back to NULL (root cause of row
    // `83d3139a` having all 6 NULL + only barcode populated).
    const { sql, sqlCalls } = createPartialUpdateMockSql(PRE_EXISTING_ROW);
    setTestSql(sql);

    const result = await updatePassHolderIssuance(sql, {
      id: HOLDER_ID,
      barcodeValue: 'BACKFILLED-BARCODE',
      // Everything else omitted
    });

    // Assert: emitted SQL wraps runtime columns in COALESCE.
    const sqlText = sqlCalls[0]!;
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*pass_identifier\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*download_url\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*barcode_value\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*issued_at\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*iphone_uri\)/);
    expect(sqlText).toMatch(/COALESCE\(\$\d+(?:::[^,)]+)?,\s*android_uri\)/);

    // Assert: barcode took new value, 6 siblings preserved.
    expect(result.barcode_value).toBe('BACKFILLED-BARCODE');
    expect(result.pass_identifier).toBe('PRESERVED-IDENTIFIER');
    expect(result.download_url).toBe('https://app.passcreator.com/p/PRESERVED');
    expect(result.issued_at).toEqual(new Date('2026-10-18T00:00:00Z'));
    expect(result.iphone_uri).toBe('https://app.passcreator.com/PRESERVED.pkpass');
    expect(result.android_uri).toBe('https://passwallet.page.link/PRESERVED');
    // Assert: issuance_error was cleared (success path: undefined → NULL).
    expect(result.issuance_error).toBeNull();
  });

  it('issuanceError: undefined (success path) → issuance_error cleared to NULL (stale error gone)', async () => {
    // Pre-existing row has a stale issuance_error from a previous
    // failed attempt. A successful V3 issuance call passes
    // `issuanceError: undefined`; the column must be cleared (NOT
    // preserved via COALESCE — the success path WANTS to clear stale
    // errors so the frontend banner stops showing the retry CTA).
    const rowWithStaleError: PassHolderRow = {
      ...PRE_EXISTING_ROW,
      issuance_error: 'passHolder.errors.upstreamFailed',
    };
    const { sql } = createPartialUpdateMockSql(rowWithStaleError);
    setTestSql(sql);

    const result = await updatePassHolderIssuance(sql, {
      id: HOLDER_ID,
      passIdentifier: 'NEW-IDENTIFIER',
      // issuanceError: undefined
    });

    // Assert: stale error cleared.
    expect(result.issuance_error).toBeNull();
  });

  it('issuanceError: string (failure path) → issuance_error set to the new i18n key', async () => {
    // Pre-existing row has all 6 runtime fields populated. V3
    // throws; caller invokes `updatePassHolderIssuance({ id,
    // issuanceError })` to mark the row as failed. `issuance_error`
    // MUST take the new value (NOT preserve the old NULL).
    const { sql } = createPartialUpdateMockSql(PRE_EXISTING_ROW);
    setTestSql(sql);

    const result = await updatePassHolderIssuance(sql, {
      id: HOLDER_ID,
      issuanceError: 'passHolder.errors.upstreamFailed',
    });

    expect(result.issuance_error).toBe('passHolder.errors.upstreamFailed');
  });
});

/**
 * Accumulated spend + resolved tier writes (2026-10-27, migration 030).
 *
 * Two contracts are pinned here:
 *
 *  1. `spend_amount` is written in the SAME UPDATE statement as the
 *     runtime snapshot it is derived from. They are the same fact, so
 *     two separate statements would leave a crash window where the
 *     column disagrees with the blob.
 *
 *  2. `current_tier_name` / `current_tier_percent` are written by
 *     their OWN function — the tier is NOT part of the snapshot
 *     JSONB (that blob is the fold of the `pass_events` ledger, and a
 *     tier depends on the template's mutable tier ladder, not on the
 *     ledger alone).
 */
describe('updatePassHolderPassValuesSnapshot — spend_amount rides with the snapshot', () => {
  /**
   * A mock Sql that captures the emitted SQL text AND the bound
   * values, so the test can assert both the statement shape and
   * what was actually bound.
   */
  function createCaptureMockSql(): {
    sql: Sql;
    sqlCalls: string[];
    boundValues: unknown[][];
  } {
    const sqlCalls: string[] = [];
    const boundValues: unknown[][] = [];

    const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      let sqlText = strings[0] ?? '';
      for (let i = 0; i < values.length; i++) {
        sqlText += `$${i + 1}`;
        sqlText += strings[i + 1] ?? '';
      }
      sqlCalls.push(sqlText);
      boundValues.push(values);
      return Promise.resolve([]);
    }) as unknown as Sql;

    (fn as any).json = (value: unknown) => ({ __sql_json: true, value });

    return { sql: fn, sqlCalls, boundValues };
  }

  it('writes spend_amount in the SAME statement as pass_values_snapshot', async () => {
    const { sql, sqlCalls, boundValues } = createCaptureMockSql();
    setTestSql(sql);

    await updatePassHolderPassValuesSnapshot(sql, HOLDER_ID, {
      metrics: { ...emptyPassValuesMetrics(), spendAccumulated: 42.5 },
      expiryDate: null,
    });

    // Exactly ONE statement — the snapshot and the spend amount are
    // written together, so they cannot drift.
    expect(sqlCalls).toHaveLength(1);
    const sqlText = sqlCalls[0]!;
    expect(sqlText).toMatch(/UPDATE public\.pass_holders/);
    expect(sqlText).toMatch(/pass_values_snapshot\s*=\s*\$\d+/);
    expect(sqlText).toMatch(/spend_amount\s*=\s*\$\d+/);

    // The bound spend amount is the snapshot's own metric.
    const bound = boundValues[0]!;
    const spendIndex = sqlText.indexOf('spend_amount');
    const placeholderMatch = sqlText
      .slice(spendIndex)
      .match(/spend_amount\s*=\s*\$(\d+)/);
    expect(placeholderMatch).not.toBeNull();
    const spendValue = bound[Number(placeholderMatch![1]) - 1];
    expect(spendValue).toBe(42.5);
  });

  it('writes a zero spend amount for a holder who has spent nothing', async () => {
    const { sql, boundValues, sqlCalls } = createCaptureMockSql();
    setTestSql(sql);

    await updatePassHolderPassValuesSnapshot(sql, HOLDER_ID, {
      metrics: emptyPassValuesMetrics(),
      expiryDate: null,
    });

    const sqlText = sqlCalls[0]!;
    const placeholderMatch = sqlText.match(/spend_amount\s*=\s*\$(\d+)/);
    expect(placeholderMatch).not.toBeNull();
    expect(boundValues[0]![Number(placeholderMatch![1]) - 1]).toBe(0);
  });
});

describe('updatePassHolderCurrentTier — the resolved discount tier', () => {
  function createCaptureMockSql(): {
    sql: Sql;
    sqlCalls: string[];
    boundValues: unknown[][];
  } {
    const sqlCalls: string[] = [];
    const boundValues: unknown[][] = [];

    const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      let sqlText = strings[0] ?? '';
      for (let i = 0; i < values.length; i++) {
        sqlText += `$${i + 1}`;
        sqlText += strings[i + 1] ?? '';
      }
      sqlCalls.push(sqlText);
      boundValues.push(values);
      return Promise.resolve([]);
    }) as unknown as Sql;

    (fn as any).json = (value: unknown) => ({ __sql_json: true, value });

    return { sql: fn, sqlCalls, boundValues };
  }

  it('writes the tier name and percent', async () => {
    const { sql, sqlCalls, boundValues } = createCaptureMockSql();
    setTestSql(sql);

    await updatePassHolderCurrentTier(sql, HOLDER_ID, {
      name: '及八',
      percent: 1,
    });

    expect(sqlCalls).toHaveLength(1);
    const sqlText = sqlCalls[0]!;
    expect(sqlText).toMatch(/UPDATE public\.pass_holders/);
    expect(sqlText).toMatch(/current_tier_name\s*=\s*\$\d+/);
    expect(sqlText).toMatch(/current_tier_percent\s*=\s*\$\d+/);

    const bound = boundValues[0]!;
    const nameIndex = Number(
      sqlText.match(/current_tier_name\s*=\s*\$(\d+)/)![1],
    ) - 1;
    const percentIndex = Number(
      sqlText.match(/current_tier_percent\s*=\s*\$(\d+)/)![1],
    ) - 1;
    expect(bound[nameIndex]).toBe('及八');
    expect(bound[percentIndex]).toBe(1);
  });

  it('CLEARS both columns for a null tier (no stale tier survives)', async () => {
    // A card type change (discount → cashback) must not leave the
    // old tier behind on the holder's row.
    const { sql, sqlCalls, boundValues } = createCaptureMockSql();
    setTestSql(sql);

    await updatePassHolderCurrentTier(sql, HOLDER_ID, null);

    const sqlText = sqlCalls[0]!;
    const bound = boundValues[0]!;
    const nameIndex = Number(
      sqlText.match(/current_tier_name\s*=\s*\$(\d+)/)![1],
    ) - 1;
    const percentIndex = Number(
      sqlText.match(/current_tier_percent\s*=\s*\$(\d+)/)![1],
    ) - 1;
    expect(bound[nameIndex]).toBeNull();
    expect(bound[percentIndex]).toBeNull();
  });
});
