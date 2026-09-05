/**
 * Unit tests for packages/shared/schemas/card.ts.
 *
 * Coverage focuses on the stamp grid fields (added 2026-09-04), the
 * Step 4 card-info fields (added 2026-09-04), and the Step 5 fields
 * (added 2026-09-05 + refactored 2026-09-06: locationsMaxDistance rename,
 * locationsDisabled toggle, relevantText per row).
 *
 * The rest of the schema is exercised by the backend schema-conformance suite.
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

describe('templateSettingsSchema — Step 4 card-info fields (2026-09-04)', () => {
  it('accepts description ≤ 200 chars', () => {
    const result = templateSettingsSchema.safeParse({
      description: 'a'.repeat(200),
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toHaveLength(200);
  });

  it('rejects description > 200 chars', () => {
    const result = templateSettingsSchema.safeParse({
      description: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('accepts description as empty string (UI enforces non-empty via isStep4Valid)', () => {
    const result = templateSettingsSchema.safeParse({ description: '' });
    expect(result.success).toBe(true);
  });

  it('accepts backFields array with valid label/value pairs', () => {
    const result = templateSettingsSchema.safeParse({
      backFields: [
        { label: 'Email', value: 'foo@example.com' },
        { label: 'Phone', value: '+1234567890' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.backFields).toHaveLength(2);
  });

  it('rejects backFields entry with label > 40 chars', () => {
    const result = templateSettingsSchema.safeParse({
      backFields: [{ label: 'a'.repeat(41), value: 'ok' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects backFields entry with value > 80 chars', () => {
    const result = templateSettingsSchema.safeParse({
      backFields: [{ label: 'ok', value: 'a'.repeat(81) }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts links array with valid label/value pairs', () => {
    const result = templateSettingsSchema.safeParse({
      links: [
        { label: 'Website', value: 'https://example.com' },
        { label: 'Phone', value: 'tel:+1234567890' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.links).toHaveLength(2);
  });

  it('accepts links with value up to 2048 chars (PassKit per-field byte limit)', () => {
    const result = templateSettingsSchema.safeParse({
      links: [{ label: 'long', value: 'https://x.com/?q=' + 'a'.repeat(2030) }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects links entry with value > 2048 chars', () => {
    const result = templateSettingsSchema.safeParse({
      links: [{ label: 'long', value: 'a'.repeat(2049) }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all three Step 4 fields omitted (defaults for fresh drafts)', () => {
    const result = templateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts all three Step 4 fields together with other Step 1-3 fields (flat merge)', () => {
    const result = templateSettingsSchema.safeParse({
      name: 'Test',
      cardType: 'membership_card',
      description: 'Hello',
      backFields: [{ label: 'Email', value: 'a@b.c' }],
      links: [{ label: 'Web', value: 'https://x.com' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Hello');
      expect(result.data.backFields).toHaveLength(1);
      expect(result.data.links).toHaveLength(1);
    }
  });
});

// ===== Step 5 — 地理位置 + 推播訊息 (2026-09-06 refactor) =====

describe('templateSettingsSchema — Step 5 locationsDisabled toggle (2026-09-06)', () => {
  it('accepts locationsDisabled = false (geolocation enabled, default)', () => {
    const result = templateSettingsSchema.safeParse({ locationsDisabled: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationsDisabled).toBe(false);
  });

  it('accepts locationsDisabled = true (geolocation disabled, skip Step 5)', () => {
    const result = templateSettingsSchema.safeParse({ locationsDisabled: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationsDisabled).toBe(true);
  });

  it('accepts locationsDisabled omitted (defaults to undefined, treated as enabled)', () => {
    const result = templateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationsDisabled).toBeUndefined();
  });

  it('rejects non-boolean locationsDisabled', () => {
    expect(templateSettingsSchema.safeParse({ locationsDisabled: 'true' }).success).toBe(false);
    expect(templateSettingsSchema.safeParse({ locationsDisabled: 1 }).success).toBe(false);
  });
});

describe('templateSettingsSchema — Step 5 locationsMaxDistance (2026-09-06 rename)', () => {
  it('accepts locationsMaxDistance at the lower bound (100)', () => {
    const result = templateSettingsSchema.safeParse({ locationsMaxDistance: 100 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationsMaxDistance).toBe(100);
  });

  it('accepts locationsMaxDistance at the upper bound (1000)', () => {
    const result = templateSettingsSchema.safeParse({ locationsMaxDistance: 1000 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationsMaxDistance).toBe(1000);
  });

  it('accepts locationsMaxDistance = null (pass-type default sentinel)', () => {
    const result = templateSettingsSchema.safeParse({ locationsMaxDistance: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locationsMaxDistance).toBe(null);
  });

  it('rejects locationsMaxDistance below 100', () => {
    expect(templateSettingsSchema.safeParse({ locationsMaxDistance: 99 }).success).toBe(false);
  });

  it('rejects locationsMaxDistance above 1000', () => {
    expect(templateSettingsSchema.safeParse({ locationsMaxDistance: 1001 }).success).toBe(false);
  });

  it('rejects non-integer locationsMaxDistance (e.g. 150.5)', () => {
    expect(templateSettingsSchema.safeParse({ locationsMaxDistance: 150.5 }).success).toBe(false);
  });

  it('accepts locationsMaxDistance omitted (defaults for fresh drafts)', () => {
    const result = templateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('still accepts the deprecated notificationRadius key for backward-compat reads', () => {
    // Migration 017 renames the DB key; until then, legacy rows may still
    // carry `notificationRadius`. The schema keeps it as `.optional()` so
    // reading those rows does not fail.
    const result = templateSettingsSchema.safeParse({ notificationRadius: 500 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notificationRadius).toBe(500);
  });

  it('accepts all Step 5 fields together (flat merge)', () => {
    const result = templateSettingsSchema.safeParse({
      initialMessage: '歡迎光臨 🎉',
      locationsDisabled: false,
      locationsMaxDistance: 500,
      locations: [
        {
          name: '台北 101',
          latitude: 25.033,
          longitude: 121.565,
          relevantText: '歡迎光臨！出示卡片享 9 折優惠',
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locationsMaxDistance).toBe(500);
      expect(result.data.initialMessage).toBe('歡迎光臨 🎉');
      expect(result.data.locations).toHaveLength(1);
      expect(result.data.locations![0]!.relevantText).toBe('歡迎光臨！出示卡片享 9 折優惠');
    }
  });
});

describe('templateSettingsSchema — Step 5 locations row shape (2026-09-06 refactor)', () => {
  it('accepts a complete location row with relevantText', () => {
    const result = templateSettingsSchema.safeParse({
      locations: [
        {
          name: '台北 101',
          latitude: 25.033,
          longitude: 121.565,
          relevantText: '歡迎光臨',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a row with relevantText=null (no custom lock-screen message)', () => {
    const result = templateSettingsSchema.safeParse({
      locations: [
        { name: 'X', latitude: 0, longitude: 0, relevantText: null },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a row without relevantText key (treated as omitted)', () => {
    const result = templateSettingsSchema.safeParse({
      locations: [
        { name: 'X', latitude: 0, longitude: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a row without latitude (now required, 2026-09-06)', () => {
    const result = templateSettingsSchema.safeParse({
      locations: [{ name: 'X', longitude: 121 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a row without longitude (now required, 2026-09-06)', () => {
    const result = templateSettingsSchema.safeParse({
      locations: [{ name: 'X', latitude: 25 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects relevantText > 100 chars', () => {
    const result = templateSettingsSchema.safeParse({
      locations: [
        { name: 'X', latitude: 0, longitude: 0, relevantText: 'x'.repeat(101) },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts relevantText at exactly 100 chars', () => {
    const result = templateSettingsSchema.safeParse({
      locations: [
        { name: 'X', latitude: 0, longitude: 0, relevantText: 'x'.repeat(100) },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects more than 10 location rows', () => {
    const oversized = Array.from({ length: 11 }, (_, i) => ({
      name: `L${i}`,
      latitude: 0,
      longitude: 0,
      relevantText: null,
    }));
    const result = templateSettingsSchema.safeParse({ locations: oversized });
    expect(result.success).toBe(false);
  });
});