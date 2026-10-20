/**
 * Gift Card schema conformance test (Rule 019 § 3)
 *
 * Asserts that the backend `templateSettingsSchema` (mirror) and the
 * shared `templateSettingsSchema` (source of truth) expose the same set
 * of top-level keys. Drift between these two schemas means requests built
 * from frontend state will fail backend zod validation.
 *
 * 2026-09-27: gift_card Step 6 added two new fields
 * (giftCardAmount, giftCardPoints). This test is the regression guard
 * against future drift on those fields.
 *
 * 2026-10-20 (PR 1 of 雙層 fence): Added two card-design fence fields
 * (giftCardDesignMinPoints, giftCardDesignMaxPoints).
 *
 * 2026-10-20 (PR 2 of 雙層 fence): Added four checkout fence fields
 * (giftCardCheckoutMinPoints, giftCardCheckoutMaxPoints,
 * giftCardCheckoutMinAmount, giftCardCheckoutMaxAmount) — bounds the
 * customer's per-transaction purchase range.
 */

import { describe, expect, it } from 'vitest';
import { templateSettingsSchema as backendTemplateSettingsSchema } from '../schemas/request';
import { templateSettingsSchema as sharedTemplateSettingsSchema } from '@saome/shared/schemas/card';

describe('templateSettingsSchema — shared vs backend (Rule 019 § 3 conformance)', () => {
  it('exposes the same set of top-level keys', () => {
    expect(Object.keys(backendTemplateSettingsSchema.shape).sort())
      .toEqual(Object.keys(sharedTemplateSettingsSchema.shape).sort());
  });

  it('includes the giftCardAmount / giftCardPoints keys (2026-09-27)', () => {
    // Drift guard: if a future refactor removes one of these keys from
    // either schema, the user would silently lose data on save.
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardAmount');
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardPoints');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardAmount');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardPoints');
  });

  it('includes the card-design fence keys (2026-10-20, PR 1)', () => {
    // Card-design fence guards the admin-configurable points range.
    // Drift = either schema missing these keys means user setters will
    // reach the DB with values that backend zod cannot validate.
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardDesignMinPoints');
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardDesignMaxPoints');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardDesignMinPoints');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardDesignMaxPoints');
  });

  it('includes the checkout fence keys (2026-10-20, PR 2)', () => {
    // Checkout fence guards the customer's per-transaction purchase range.
    // Drift = either schema missing these keys means user setters will
    // reach the DB with values that backend zod cannot validate.
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardCheckoutMinPoints');
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardCheckoutMaxPoints');
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardCheckoutMinAmount');
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardCheckoutMaxAmount');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardCheckoutMinPoints');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardCheckoutMaxPoints');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardCheckoutMinAmount');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardCheckoutMaxAmount');
  });

  it('all checkout fence fields are positive int optional (regression guard)', () => {
    // Drift guard — make sure shared schema bounds stay positive int optional.
    for (const key of [
      'giftCardCheckoutMinPoints',
      'giftCardCheckoutMaxPoints',
      'giftCardCheckoutMinAmount',
      'giftCardCheckoutMaxAmount',
    ]) {
      const shape = sharedTemplateSettingsSchema.shape[key];
      expect(shape, `shared schema missing ${key}`).toBeDefined();
      // zod number() chain: parse undefined → expect success (optional)
      // and parse 0 → expect failure (positive).
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (shape as any).safeParse(undefined).success,
        `${key} should accept undefined (optional)`,
      ).toBe(true);
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (shape as any).safeParse(0).success,
        `${key} should reject 0 (positive int)`,
      ).toBe(false);
    }
  });
});