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

// ===== Step 6 — Free Membership Card expiry fields (2026-09-14) =====

describe('templateSettingsSchema — membershipExpiryMode (free card, 2026-09-14)', () => {
  it("accepts membershipExpiryMode = 'custom_days'", () => {
    const result = templateSettingsSchema.safeParse({ membershipExpiryMode: 'custom_days' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipExpiryMode).toBe('custom_days');
  });

  it("accepts membershipExpiryMode = 'specific_date'", () => {
    const result = templateSettingsSchema.safeParse({ membershipExpiryMode: 'specific_date' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipExpiryMode).toBe('specific_date');
  });

  it('accepts membershipExpiryMode = null (未設定)', () => {
    const result = templateSettingsSchema.safeParse({ membershipExpiryMode: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipExpiryMode).toBe(null);
  });

  it('rejects invalid membershipExpiryMode value', () => {
    expect(
      templateSettingsSchema.safeParse({ membershipExpiryMode: 'monthly' }).success,
    ).toBe(false);
    expect(
      templateSettingsSchema.safeParse({ membershipExpiryMode: 'foo' }).success,
    ).toBe(false);
  });

  it('accepts membershipExpiryMode omitted (fresh draft, paid card)', () => {
    const result = templateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipExpiryMode).toBeUndefined();
  });
});

describe('templateSettingsSchema — membershipCustomExpiryDays (free card, 2026-09-14)', () => {
  it('accepts membershipCustomExpiryDays at the lower bound (1)', () => {
    const result = templateSettingsSchema.safeParse({ membershipCustomExpiryDays: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipCustomExpiryDays).toBe(1);
  });

  it('accepts membershipCustomExpiryDays at the upper bound (3650)', () => {
    const result = templateSettingsSchema.safeParse({ membershipCustomExpiryDays: 3650 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipCustomExpiryDays).toBe(3650);
  });

  it('rejects membershipCustomExpiryDays = 0', () => {
    expect(
      templateSettingsSchema.safeParse({ membershipCustomExpiryDays: 0 }).success,
    ).toBe(false);
  });

  it('rejects membershipCustomExpiryDays > 3650', () => {
    expect(
      templateSettingsSchema.safeParse({ membershipCustomExpiryDays: 3651 }).success,
    ).toBe(false);
  });

  it('rejects non-integer membershipCustomExpiryDays', () => {
    expect(
      templateSettingsSchema.safeParse({ membershipCustomExpiryDays: 100.5 }).success,
    ).toBe(false);
  });

  it('accepts membershipCustomExpiryDays = null (未填)', () => {
    const result = templateSettingsSchema.safeParse({ membershipCustomExpiryDays: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipCustomExpiryDays).toBe(null);
  });
});

describe('templateSettingsSchema — membershipSpecificExpiryDate (free card, 2026-09-14)', () => {
  it('accepts a valid ISO YYYY-MM-DD date string', () => {
    const result = templateSettingsSchema.safeParse({
      membershipSpecificExpiryDate: '2026-12-31',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipSpecificExpiryDate).toBe('2026-12-31');
  });

  it('accepts membershipSpecificExpiryDate = null (未填)', () => {
    const result = templateSettingsSchema.safeParse({ membershipSpecificExpiryDate: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.membershipSpecificExpiryDate).toBe(null);
  });

  it('accepts an empty string (UI sends empty until user picks date)', () => {
    // zod permits empty string (UI setter pre-filters if needed);
    // downstream consumer should treat "" as "未填".
    const result = templateSettingsSchema.safeParse({ membershipSpecificExpiryDate: '' });
    expect(result.success).toBe(true);
  });

  it('accepts all three free-card expiry fields together (flat merge)', () => {
    const result = templateSettingsSchema.safeParse({
      hasExpiry: true,
      membershipExpiryMode: 'custom_days',
      membershipCustomExpiryDays: 100,
      membershipSpecificExpiryDate: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasExpiry).toBe(true);
      expect(result.data.membershipExpiryMode).toBe('custom_days');
      expect(result.data.membershipCustomExpiryDays).toBe(100);
      expect(result.data.membershipSpecificExpiryDate).toBe(null);
    }
  });
});

// ===== Step 6 — Coupon Card (2026-09-19, coupon_card only) =====

describe('templateSettingsSchema — couponDiscountType (coupon_card, 2026-09-19)', () => {
  it("accepts couponDiscountType = 'amount_off'", () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountType: 'amount_off' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountType).toBe('amount_off');
  });

  it("accepts couponDiscountType = 'percent_off'", () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountType: 'percent_off' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountType).toBe('percent_off');
  });

  it('accepts couponDiscountType = null (unselected)', () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountType: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountType).toBe(null);
  });

  it('rejects invalid couponDiscountType value', () => {
    expect(
      templateSettingsSchema.safeParse({ couponDiscountType: 'fixed' }).success,
    ).toBe(false);
    expect(
      templateSettingsSchema.safeParse({ couponDiscountType: 'cash' }).success,
    ).toBe(false);
  });
});

describe('templateSettingsSchema — couponDiscountAmount (coupon_card, 2026-09-19)', () => {
  it('accepts couponDiscountAmount at the lower bound (1)', () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountAmount: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountAmount).toBe(1);
  });

  it('accepts couponDiscountAmount with a large value (no upper cap per user decision)', () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountAmount: 999_999 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountAmount).toBe(999_999);
  });

  it('rejects couponDiscountAmount = 0', () => {
    expect(
      templateSettingsSchema.safeParse({ couponDiscountAmount: 0 }).success,
    ).toBe(false);
  });

  it('rejects negative couponDiscountAmount', () => {
    expect(
      templateSettingsSchema.safeParse({ couponDiscountAmount: -50 }).success,
    ).toBe(false);
  });

  it('accepts couponDiscountAmount = null (尚未填入)', () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountAmount: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountAmount).toBe(null);
  });
});

describe('templateSettingsSchema — couponDiscountPercent (coupon_card, 2026-09-19)', () => {
  it('accepts couponDiscountPercent at the lower bound (1)', () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountPercent: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountPercent).toBe(1);
  });

  it('accepts couponDiscountPercent at the upper bound (100)', () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountPercent: 100 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountPercent).toBe(100);
  });

  it('rejects couponDiscountPercent = 0', () => {
    expect(
      templateSettingsSchema.safeParse({ couponDiscountPercent: 0 }).success,
    ).toBe(false);
  });

  it('rejects couponDiscountPercent > 100', () => {
    expect(
      templateSettingsSchema.safeParse({ couponDiscountPercent: 101 }).success,
    ).toBe(false);
  });

  it('rejects non-integer couponDiscountPercent', () => {
    expect(
      templateSettingsSchema.safeParse({ couponDiscountPercent: 10.5 }).success,
    ).toBe(false);
  });

  it('accepts couponDiscountPercent = null (尚未填入)', () => {
    const result = templateSettingsSchema.safeParse({ couponDiscountPercent: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponDiscountPercent).toBe(null);
  });
});

describe('templateSettingsSchema — couponIssueCount (coupon_card, 2026-09-19)', () => {
  it('accepts couponIssueCount at the lower bound (1)', () => {
    const result = templateSettingsSchema.safeParse({ couponIssueCount: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponIssueCount).toBe(1);
  });

  it('accepts couponIssueCount with a large value (no upper cap per user decision)', () => {
    const result = templateSettingsSchema.safeParse({ couponIssueCount: 100_000 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.couponIssueCount).toBe(100_000);
  });

  it('rejects couponIssueCount = 0', () => {
    expect(
      templateSettingsSchema.safeParse({ couponIssueCount: 0 }).success,
    ).toBe(false);
  });

  it('rejects negative couponIssueCount', () => {
    expect(
      templateSettingsSchema.safeParse({ couponIssueCount: -1 }).success,
    ).toBe(false);
  });

  it('rejects non-integer couponIssueCount', () => {
    expect(
      templateSettingsSchema.safeParse({ couponIssueCount: 2.5 }).success,
    ).toBe(false);
  });
});