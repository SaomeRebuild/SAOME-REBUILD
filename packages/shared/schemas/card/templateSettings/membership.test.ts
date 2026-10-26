/**
 * Unit tests — template settings membership section.
 *
 * @module shared/schemas/card/templateSettings/membership.test
 * @description Covers the flat `templates.settings` JSONB schema for the
 * membership fields.
 *
 * The remaining sections are covered by their sibling test files.
 */

import { describe, it, expect } from 'vitest';
import { templateSettingsSchema } from './index';

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
