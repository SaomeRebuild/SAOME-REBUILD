/**
 * Unit tests for packages/shared/schemas/card.ts.
 *
 * Coverage focuses on the stamp grid fields (added 2026-09-04) since the rest
 * of the schema is exercised by the backend schema-conformance suite.
 */

import { describe, it, expect } from 'vitest';
import { templateSettingsSchema } from './card';

describe('templateSettingsSchema — stamp grid fields', () => {
  it('accepts stampGridRows = 1', () => {
    const result = templateSettingsSchema.safeParse({ stampGridRows: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts stampGridRows = 2, 3, 4', () => {
    expect(templateSettingsSchema.safeParse({ stampGridRows: 2 }).success).toBe(true);
    expect(templateSettingsSchema.safeParse({ stampGridRows: 3 }).success).toBe(true);
    expect(templateSettingsSchema.safeParse({ stampGridRows: 4 }).success).toBe(true);
  });

  it('rejects stampGridRows = 0 or 5 (out of union)', () => {
    expect(templateSettingsSchema.safeParse({ stampGridRows: 0 }).success).toBe(false);
    expect(templateSettingsSchema.safeParse({ stampGridRows: 5 }).success).toBe(false);
  });

  it('rejects non-numeric stampGridRows', () => {
    expect(templateSettingsSchema.safeParse({ stampGridRows: '2' }).success).toBe(false);
    expect(templateSettingsSchema.safeParse({ stampGridRows: null }).success).toBe(false);
  });

  it('accepts stampIconId as any non-empty string', () => {
    const result = templateSettingsSchema.safeParse({ stampIconId: 'bell' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stampIconId).toBe('bell');
  });

  it('accepts stampIconId as empty string (icon unset, preview shows placeholder)', () => {
    const result = templateSettingsSchema.safeParse({ stampIconId: '' });
    expect(result.success).toBe(true);
  });

  it('accepts both fields omitted (default for non-stamp card types)', () => {
    const result = templateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
