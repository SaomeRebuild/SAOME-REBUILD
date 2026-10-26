/**
 * Unit tests — template settings coupon section.
 *
 * @module shared/schemas/card/templateSettings/coupon.test
 * @description Covers the flat `templates.settings` JSONB schema for the
 * coupon fields.
 *
 * The remaining sections are covered by their sibling test files.
 */

import { describe, it, expect } from 'vitest';
import { templateSettingsSchema } from './index';

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
